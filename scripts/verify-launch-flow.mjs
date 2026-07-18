#!/usr/bin/env node
/*
 * End-to-end verification for the launch-critical flow (recruit -> onboard -> board).
 * Drives the REAL pipeline against a target project and reports PASS/FAIL per step,
 * then cleans up everything it created.
 *
 * Run against STAGING first (never prod for a dry run):
 *   SUPABASE_URL=https://aehsuxvlbehqekbcxtll.supabase.co \
 *   SUPABASE_ANON_KEY=<staging anon key> \
 *   SUPABASE_SERVICE_ROLE_KEY=<staging service role key> \
 *   node scripts/verify-launch-flow.mjs
 *
 * What it verifies:
 *   1. Preflight: board tables + seeded positions, cohort function keys.
 *   2. Recruit routing fallback (Section 1): an UNMAPPED major + a preferred
 *      cohort routes to the preference (the launch fix); a MAPPED major routes
 *      by major. Exercises the deployed submit-application edge function.
 *   3. Onboard: accept -> onboard_accepted_applicant -> cohort_roster + invite.
 *   4. Board: accept a board application -> role granted (VP -> board_member).
 *
 * Requires the board migration applied and the submit-application edge function
 * REDEPLOYED on the target. A failure in phase 2 usually means "redeploy the
 * edge function"; a failure in preflight means "apply the board migration".
 */
import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !ANON || !SERVICE) {
  console.error("Missing env. Need SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(2);
}

const admin = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
const stamp = Date.now();
const TEST_TAG = `verify_${stamp}`;

let passed = 0, failed = 0;
const lines = [];
function ok(name, cond, detail = "") {
  (cond ? passed++ : failed++);
  const mark = cond ? "PASS" : "FAIL";
  lines.push(`  [${mark}] ${name}${detail ? ` — ${detail}` : ""}`);
  console.log(`  [${mark}] ${name}${detail ? ` — ${detail}` : ""}`);
}
function info(msg) { console.log(`  … ${msg}`); }

// A minimal valid PDF (the edge fn checks the %PDF magic bytes).
function pdfBlob() {
  const bytes = new TextEncoder().encode("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF");
  return new Blob([bytes], { type: "application/pdf" });
}

const cleanup = { applicantEmails: [], userIds: [], createdCycleId: null, createdBoardCycleId: null };

async function main() {
  console.log(`\n=== PEC launch-flow verification (${new Date(stamp).toISOString()}) ===`);
  console.log(`Target: ${URL}\n`);

  // Resolve the four cohorts by function key (robust to renamed display names).
  const { data: cohorts } = await admin.from("cohorts").select("id, function_key").not("function_key", "is", null);
  const cohortByKey = Object.fromEntries((cohorts ?? []).map((c) => [c.function_key, c.id]));

  // ---------------------------------------------------------------- Phase 1
  console.log("Phase 1 — preflight (board migration + schema)");
  const { data: positions, error: posErr } = await admin.from("board_positions").select("*");
  ok("board_positions table exists", !posErr, posErr?.message);
  ok("board seats seeded (8 rows)", (positions?.length ?? 0) === 8, `${positions?.length ?? 0} rows`);
  const openSeats = (positions ?? []).filter((p) => p.is_open).length;
  ok("6 open seats", openSeats === 6, `${openSeats} open`);
  ok("all four cohort function keys present",
    ["business_marketing", "software_ai", "hardware_embedded", "mech_manufacturing"].every((k) => cohortByKey[k]));

  // ---------------------------------------------------------------- Phase 2
  console.log("\nPhase 2 — recruit routing fallback (edge function)");
  // Need an active application cycle so the edge fn routes (else intake pooling).
  let { data: cycleRow } = await admin.from("application_cycles").select("id").eq("is_active", true).maybeSingle();
  if (!cycleRow) {
    const ins = await admin.from("application_cycles")
      .insert({ season: "fall", year: 2026, is_active: true, opens_at: new Date().toISOString(), closes_at: null, notes: TEST_TAG })
      .select("id").single();
    cycleRow = ins.data;
    cleanup.createdCycleId = ins.data?.id ?? null;
    info("created a temporary active application cycle");
  }
  ok("active application cycle available", !!cycleRow);

  async function submit(fields) {
    const fd = new FormData();
    const base = {
      full_name: `Verify Test ${stamp}`,
      phone: "8055551234",
      year_standing: "junior",
      expected_grad_term: "Spring 2027",
      relevant_experience: "Automated verification run exercising the routing fallback path end to end.",
      why_pec: "This is an automated end-to-end verification of the application routing behavior.",
      availability: "10 hours per week",
      source: "other",
      honeypot: "",
    };
    for (const [k, v] of Object.entries({ ...base, ...fields })) fd.append(k, v);
    fd.append("resume", pdfBlob(), "resume.pdf");
    const res = await fetch(`${URL}/functions/v1/submit-application`, {
      method: "POST",
      headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
      body: fd,
    });
    return { status: res.status, body: await res.json().catch(() => ({})) };
  }

  // 2a. Unmapped major + preferred cohort -> routes to the preference (the fix).
  const unmappedEmail = `verify_unmapped_${stamp}@example.com`;
  cleanup.applicantEmails.push(unmappedEmail);
  const r1 = await submit({ email: unmappedEmail, major: "Underwater Basket Weaving", preferred_cohort_key: "hardware_embedded" });
  ok("edge fn accepted unmapped-major submission", r1.status === 200, `HTTP ${r1.status} ${JSON.stringify(r1.body).slice(0, 120)}`);
  const { data: a1 } = await admin.from("applicants").select("routed_cohort_id, preferred_cohort_id, primary_reviewer_user_id").eq("email", unmappedEmail).maybeSingle();
  ok("unmapped major routed to the PREFERRED cohort (fallback works)",
    a1?.routed_cohort_id === cohortByKey["hardware_embedded"],
    a1 ? `routed=${a1.routed_cohort_id}` : "no applicant row");
  ok("preferred_cohort_id stored", a1?.preferred_cohort_id === cohortByKey["hardware_embedded"]);

  // 2b. Mapped major (no preference) -> routes by major. Pick a real mapped major.
  const { data: mapRow } = await admin.from("major_cohort_routing").select("major, cohort_id").limit(1).maybeSingle();
  if (mapRow) {
    const mappedEmail = `verify_mapped_${stamp}@example.com`;
    cleanup.applicantEmails.push(mappedEmail);
    const r2 = await submit({ email: mappedEmail, major: mapRow.major });
    ok("edge fn accepted mapped-major submission", r2.status === 200, `HTTP ${r2.status}`);
    const { data: a2 } = await admin.from("applicants").select("routed_cohort_id").eq("email", mappedEmail).maybeSingle();
    ok(`mapped major "${mapRow.major}" routed by major`, a2?.routed_cohort_id === mapRow.cohort_id);
  } else {
    ok("major_cohort_routing seeded", false, "no routing rows — seed majors before launch");
  }

  // ---------------------------------------------------------------- Phase 3+4 need an admin session
  console.log("\nPhase 3 — onboard + Phase 4 — board grant (via a temp admin session)");
  const adminEmail = `verify_admin_${stamp}@example.com`;
  const adminPass = `Verify!${stamp}aA`;
  const memberEmail = `verify_member_${stamp}@example.com`;
  const memberPass = `Verify!${stamp}bB`;

  const { data: adminUser } = await admin.auth.admin.createUser({ email: adminEmail, password: adminPass, email_confirm: true });
  const { data: memberUser } = await admin.auth.admin.createUser({ email: memberEmail, password: memberPass, email_confirm: true });
  if (adminUser?.user) cleanup.userIds.push(adminUser.user.id);
  if (memberUser?.user) cleanup.userIds.push(memberUser.user.id);
  // Grant roles directly (service role). createUser fires handle_new_user, which
  // may already have granted applicant/member, so upsert-ignore avoids a unique
  // conflict while still adding the admin role we need.
  await admin.from("user_roles").upsert([
    { user_id: adminUser.user.id, role: "admin" },
    { user_id: memberUser.user.id, role: "member" },
  ], { onConflict: "user_id,role", ignoreDuplicates: true });
  const userClient = createClient(URL, ANON, { auth: { persistSession: false } });
  const signIn = await userClient.auth.signInWithPassword({ email: adminEmail, password: adminPass });
  ok("temp admin session established", !!signIn.data?.session, signIn.error?.message);

  // Phase 3: onboard the unmapped applicant (already accepted-worthy). Set accepted
  // (service role) then call onboard_accepted_applicant as the admin (a recruitment lead).
  const { data: appRow } = await admin.from("applicants").select("id, routed_cohort_id").eq("email", unmappedEmail).maybeSingle();
  if (appRow) {
    await admin.from("applicants").update({ current_stage: "accepted" }).eq("id", appRow.id);
    const onboard = await userClient.rpc("onboard_accepted_applicant", { _applicant_id: appRow.id });
    ok("onboard_accepted_applicant ran", !onboard.error, onboard.error?.message);
    const { data: roster } = await admin.from("cohort_roster").select("id").eq("email", unmappedEmail);
    ok("cohort_roster row created for onboarded applicant", (roster?.length ?? 0) >= 1);
    const { data: onb } = await admin.from("applicants").select("onboarding_state").eq("id", appRow.id).maybeSingle();
    ok("applicant onboarding_state advanced", onb && onb.onboarding_state !== "not_started", `state=${onb?.onboarding_state}`);
  } else {
    ok("applicant available to onboard", false);
  }

  // Phase 4: board application accepted -> role granted.
  const { data: bCycle } = await admin.from("board_application_cycles")
    .insert({ name: TEST_TAG, is_active: true, opens_at: new Date().toISOString() }).select("id").single()
    .then((r) => r, () => ({ data: null }));
  // (single active cycle index: deactivate others first if the insert failed)
  let boardCycleId = bCycle?.id;
  if (!boardCycleId) {
    await admin.from("board_application_cycles").update({ is_active: false }).eq("is_active", true);
    const retry = await admin.from("board_application_cycles").insert({ name: TEST_TAG, is_active: true, opens_at: new Date().toISOString() }).select("id").single();
    boardCycleId = retry.data?.id;
  }
  cleanup.createdBoardCycleId = boardCycleId ?? null;
  ok("board cycle opened", !!boardCycleId);

  if (boardCycleId) {
    const { data: bApp, error: bAppErr } = await admin.from("board_applications").insert({
      cycle_id: boardCycleId, applicant_user_id: memberUser.user.id, position_key: "vp_business",
      why_you: "verify", vision: "verify",
    }).select("id").single();
    ok("board application inserted", !bAppErr, bAppErr?.message);
    if (bApp) {
      const decide = await userClient.rpc("decide_board_application", { _app_id: bApp.id, _decision: "accepted", _note: "verify" });
      ok("decide_board_application(accepted) ran as admin", !decide.error, decide.error?.message);
      const { data: granted } = await admin.from("user_roles").select("role").eq("user_id", memberUser.user.id).eq("role", "board_member");
      ok("VP acceptance granted board_member role", (granted?.length ?? 0) === 1);
    }
    // Negative check: a non-admin cannot decide.
    await userClient.auth.signOut();
    await userClient.auth.signInWithPassword({ email: memberEmail, password: memberPass });
    const badApp = await admin.from("board_applications").insert({
      cycle_id: boardCycleId, applicant_user_id: memberUser.user.id, position_key: "vp_members", why_you: "x", vision: "x",
    }).select("id").single();
    if (badApp.data) {
      const bad = await userClient.rpc("decide_board_application", { _app_id: badApp.data.id, _decision: "accepted", _note: "x" });
      ok("non-admin BLOCKED from deciding (security)", !!bad.error, bad.error ? "correctly rejected" : "SECURITY: it succeeded!");
    }
  }
}

async function doCleanup() {
  console.log("\nCleanup…");
  try {
    if (cleanup.applicantEmails.length) {
      await admin.from("cohort_roster").delete().in("email", cleanup.applicantEmails);
      await admin.from("applicants").delete().in("email", cleanup.applicantEmails);
    }
    for (const uid of cleanup.userIds) {
      // FK on delete cascade clears user_roles / board_applications / etc.
      await admin.auth.admin.deleteUser(uid).catch(() => {});
    }
    if (cleanup.createdBoardCycleId) await admin.from("board_application_cycles").delete().eq("id", cleanup.createdBoardCycleId);
    if (cleanup.createdCycleId) await admin.from("application_cycles").delete().eq("id", cleanup.createdCycleId);
    console.log("  cleanup done");
  } catch (e) {
    console.log(`  cleanup warning: ${e.message} (test rows tagged ${TEST_TAG} may remain)`);
  }
}

main()
  .catch((e) => { console.error("\nRUN ERROR:", e); failed++; })
  .finally(async () => {
    await doCleanup();
    console.log(`\n=== ${passed} passed, ${failed} failed ===`);
    process.exit(failed === 0 ? 0 : 1);
  });
