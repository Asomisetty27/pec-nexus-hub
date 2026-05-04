// Routes confirmed-awardee public contracts into Company Relations:
// - Logs a structured 'research' activity (de-duped per opportunity).
// - Generates a small set of de-duped follow-up tasks via cm_create_followup_task.
// - Marks the source_snapshot.routed_at so reruns are safe and idempotent.

import {
  adminClient,
  corsHeaders,
  finishRun,
  jsonResponse,
  requireLeadership,
  RunSummary,
  startRun,
} from "../_shared/contract-monitor/runs.ts";

interface RouteBody {
  opportunity_ids?: string[];
  limit?: number;
  force?: boolean;
}

const TASK_TEMPLATES: Array<{ kind: string; title: string; description: string; days: number }> = [
  {
    kind: "verify_awardee",
    title: "Verify awardee + prepare outreach brief",
    description: "Confirm the awardee from the official source, then draft a 3-line outreach brief on PEC's relevant capabilities.",
    days: 3,
  },
  {
    kind: "review_company_fit",
    title: "Review company fit and website",
    description: "Visit the company website. Assess engineering relevance, scale, and possible partnership angle. Update CRM fit fields.",
    days: 5,
  },
  {
    kind: "identify_contact_path",
    title: "Identify best contact path",
    description: "Find a real human contact (engineering / business development / partnerships). No guessed emails.",
    days: 7,
  },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);
  const auth = await requireLeadership(req);
  if (auth.error) return jsonResponse({ error: auth.error }, 403);

  let body: RouteBody = {};
  try { body = await req.json(); } catch { /* ok */ }

  const admin = adminClient();
  const runId = await startRun(admin, "route_to_crm", auth.userId);
  const summary: RunSummary = {
    scanned_count: 0,
    routed_count: 0,
    skipped_already_routed: 0,
    activities_created: 0,
    tasks_created: 0,
    tasks_existed: 0,
    errors: [],
  };

  let q = admin
    .from("public_contract_opportunities")
    .select("id, source_snapshot, awardee_organization_id, solicitation_title, source_url")
    .eq("confidence_level", "confirmed_awardee")
    .eq("is_archived", false)
    .not("awardee_organization_id", "is", null)
    .order("updated_at", { ascending: false })
    .limit(Math.min(body.limit ?? 20, 50));

  if (body.opportunity_ids?.length) {
    q = admin
      .from("public_contract_opportunities")
      .select("id, source_snapshot, awardee_organization_id, solicitation_title, source_url")
      .in("id", body.opportunity_ids);
  }

  const { data: rows, error } = await q;
  if (error) {
    await finishRun(admin, runId, "failed", { ...summary, errors: [{ stage: "load", message: error.message }] }, error.message);
    return jsonResponse({ ok: false, error: error.message }, 500);
  }

  let hadFailure = false;

  for (const row of rows ?? []) {
    summary.scanned_count! += 1;
    if (!row.awardee_organization_id) continue;
    const snap = (row.source_snapshot ?? {}) as Record<string, any>;
    if (snap.routed_at && !body.force) {
      summary.skipped_already_routed! += 1;
      continue;
    }

    // Activity dedupe: check existing 'research' activity tied to this org with our subject prefix.
    const subject = `Sourced via public contract monitor — ${row.solicitation_title?.slice(0, 120) ?? ""}`;
    const { data: existingAct } = await admin
      .from("company_activities")
      .select("id")
      .eq("organization_id", row.awardee_organization_id)
      .eq("subject", subject)
      .limit(1)
      .maybeSingle();

    if (!existingAct) {
      // Use a CRM-leadership user as performed_by so RLS is satisfied (we're service-role anyway, but FK requires a profile).
      const performedBy = auth.userId ?? (await (async () => {
        const { data } = await admin
          .from("user_roles")
          .select("user_id")
          .in("role", ["admin","superadmin","president"])
          .limit(1)
          .maybeSingle();
        return data?.user_id ?? null;
      })());
      if (performedBy) {
        const { error: actErr } = await admin.from("company_activities").insert({
          organization_id: row.awardee_organization_id,
          performed_by: performedBy,
          activity_type: "research",
          subject,
          body: `Public contract monitor identified this organization as awardee.\nSource: ${row.source_url ?? "—"}`,
        });
        if (actErr) {
          hadFailure = true;
          summary.errors!.push({ stage: "activity", message: actErr.message, context: { id: row.id } });
        } else {
          summary.activities_created! += 1;
        }
      }
    }

    // Tasks (idempotent via RPC)
    for (const t of TASK_TEMPLATES) {
      const { data: taskId, error: tErr } = await admin.rpc("cm_create_followup_task", {
        _org_id: row.awardee_organization_id,
        _kind: t.kind,
        _title: t.title,
        _description: t.description,
        _due_in_days: t.days,
        _related_pco_id: row.id,
        _assignee: null,
        _created_by: auth.userId,
      });
      if (tErr) {
        hadFailure = true;
        summary.errors!.push({ stage: "task", message: tErr.message, context: { id: row.id, kind: t.kind } });
      } else if (taskId) {
        // Compare against a quick lookup to know if it was newly created vs reused.
        // Cheap proxy: use created_at recency. Skip if older than 1 minute => already existed.
        const { data: created } = await admin.from("company_tasks").select("created_at").eq("id", taskId).maybeSingle();
        if (created && Date.now() - new Date(created.created_at).getTime() < 60_000) summary.tasks_created! += 1;
        else summary.tasks_existed! += 1;
      }
    }

    // Mark routed.
    await admin.from("public_contract_opportunities").update({
      source_snapshot: { ...snap, routed_at: new Date().toISOString() },
    }).eq("id", row.id);
    summary.routed_count! += 1;
  }

  const status =
    hadFailure && summary.routed_count! > 0 ? "partial"
    : hadFailure ? "failed"
    : "succeeded";
  await finishRun(admin, runId, status, summary, hadFailure ? JSON.stringify(summary.errors) : undefined);
  return jsonResponse({ ok: true, run_id: runId, status, summary });
});