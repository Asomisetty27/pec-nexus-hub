import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const TextSchema = z.object({
  full_name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().min(7).max(40),
  calpoly_email: z.string().trim().email().max(255).optional().or(z.literal("")),
  major: z.string().trim().min(2).max(120),
  year_standing: z.enum(["freshman", "sophomore", "junior", "senior", "graduate", "other"]),
  expected_grad_term: z.string().trim().min(2).max(40),
  portfolio_url: z.string().trim().url().max(500).optional().or(z.literal("")),
  linkedin_url: z.string().trim().url().max(500).optional().or(z.literal("")),
  relevant_experience: z.string().trim().min(20).max(4000),
  why_pec: z.string().trim().min(20).max(4000),
  availability: z.string().trim().min(5).max(1000),
  source: z.enum([
    "website", "flyer", "referral", "event", "info_session",
    "social_media", "search", "professor", "club_fair", "other",
  ]),
  source_detail: z.string().trim().max(255).optional().or(z.literal("")),
  // The public form cannot read the cohorts table (RLS), so the applicant
  // sends a fixed function key; the server resolves it to a cohort id.
  preferred_cohort_key: z
    .enum(["business_marketing", "software_ai", "hardware_embedded", "mech_manufacturing"])
    .optional()
    .or(z.literal("")),
  honeypot: z.string().max(0).optional().or(z.literal("")),
});

const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const MAX_RESUME_BYTES = 5 * 1024 * 1024;

function detectExt(mime: string, name: string): string {
  if (mime === "application/pdf") return "pdf";
  if (mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "docx";
  if (mime === "application/msword") return "doc";
  const m = name.match(/\.(pdf|docx|doc)$/i);
  return m ? m[1].toLowerCase() : "bin";
}

function checkMagicBytes(bytes: Uint8Array, mime: string): boolean {
  if (bytes.length < 4) return false;
  if (mime === "application/pdf") {
    return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
  }
  if (mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    return bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
  }
  if (mime === "application/msword") {
    return bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0;
  }
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // Client IP
  const ipHeader = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "";
  const ip = (ipHeader.split(",")[0] || "0.0.0.0").trim();
  const ua = (req.headers.get("user-agent") || "").slice(0, 500);

  // Parse multipart
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json(400, { error: "Invalid form data" });
  }

  const fields: Record<string, string> = {};
  for (const [k, v] of form.entries()) {
    if (typeof v === "string") fields[k] = v;
  }

  const parsed = TextSchema.safeParse(fields);
  if (!parsed.success) {
    return json(400, { error: "Validation failed", details: parsed.error.flatten().fieldErrors });
  }
  const data = parsed.data;

  // Honeypot — silently accept
  if (data.honeypot && data.honeypot.length > 0) {
    return json(200, { ok: true, ref: "ok" });
  }

  // Resume
  const resume = form.get("resume");
  if (!(resume instanceof File)) return json(400, { error: "Resume is required" });
  if (resume.size === 0) return json(400, { error: "Resume is empty" });
  if (resume.size > MAX_RESUME_BYTES) return json(400, { error: "Resume must be 5 MB or smaller" });
  if (!ALLOWED_MIME.has(resume.type)) return json(400, { error: "Resume must be PDF, DOC, or DOCX" });

  const buf = new Uint8Array(await resume.arrayBuffer());
  if (!checkMagicBytes(buf, resume.type)) {
    return json(400, { error: "Resume file appears corrupted or has the wrong format" });
  }

  // Rate limit by IP — 3 per hour
  try {
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await admin
      .from("submission_rate_limit")
      .select("id", { count: "exact", head: true })
      .eq("ip", ip)
      .gte("created_at", since);
    if ((count ?? 0) >= 3) {
      return json(429, { error: "Too many submissions. Please try again later." });
    }
  } catch (_) { /* non-fatal */ }

  // Active cycle (may be null — pre-cycle intake mode)
  const { data: cycleRows, error: cycleErr } = await admin.rpc("get_active_application_cycle");
  if (cycleErr) return json(500, { error: "Could not check application cycle" });
  const cycle = Array.isArray(cycleRows) ? cycleRows[0] : null;
  const intakeMode = !cycle;

  const emailNorm = data.email.toLowerCase();

  // Duplicate checks
  if (intakeMode) {
    // One live pre-cycle pool record per email (DB enforces this with a
    // partial unique index; we check first to return a friendly response).
    const { data: poolDup } = await admin
      .from("applicants")
      .select("id")
      .eq("current_stage", "pre_cycle_pool")
      .is("archived_at", null)
      .ilike("email", emailNorm)
      .maybeSingle();
    if (poolDup) {
      // Touch last_resubmitted_at so leadership can see they're still interested.
      await admin
        .from("applicants")
        .update({ last_resubmitted_at: new Date().toISOString() })
        .eq("id", poolDup.id);
      return json(200, {
        ok: true,
        intake: true,
        already_in_pool: true,
        ref: poolDup.id.slice(0, 8),
      });
    }
  } else {
    // Same email + same cycle dedupe (existing behavior).
    const { data: dup } = await admin
      .from("applicants")
      .select("id")
      .eq("cycle_id", cycle.id)
      .ilike("email", emailNorm)
      .maybeSingle();
    if (dup) return json(409, { error: "You've already submitted an application for this cycle." });
  }

  // Routing + reviewer assignment ONLY when an active cycle is open.
  // In intake mode we never route or assign — that happens at promotion time.
  const majorNorm = data.major.trim().toLowerCase();
  let routedCohortId: string | null = null;
  let primaryReviewerId: string | null = null;

  // Validate the applicant's stated cohort preference against real cohorts so a
  // bad value can never break submission; a verified id becomes the routing
  // fallback below and is stored regardless of which route wins.
  let preferredCohortId: string | null = null;
  if (data.preferred_cohort_key) {
    const { data: pref } = await admin
      .from("cohorts")
      .select("id")
      .eq("function_key", data.preferred_cohort_key)
      .maybeSingle();
    preferredCohortId = pref?.id ?? null;
  }

  if (!intakeMode) {
    try {
      const { data: route } = await admin
        .from("major_cohort_routing")
        .select("cohort_id")
        .ilike("major", majorNorm)
        .maybeSingle();
      routedCohortId = route?.cohort_id ?? null;
    } catch (_) {}

    // Fallback: a free-text major that maps to nothing would otherwise leave
    // the applicant unrouted with no reviewer. Honor their stated preference so
    // every applicant lands in a cohort and gets a reviewer.
    if (!routedCohortId && preferredCohortId) {
      routedCohortId = preferredCohortId;
    }

    if (routedCohortId) {
    const { data: reviewers } = await admin
      .from("cohort_memberships")
      .select("user_id")
      .eq("cohort_id", routedCohortId)
      .in("role", ["lead", "pm", "integration_lead"]);
    if (reviewers && reviewers.length > 0) {
      const ids = reviewers.map((r: any) => r.user_id);
      const { data: openCounts } = await admin
        .from("applicants")
        .select("primary_reviewer_user_id")
        .in("primary_reviewer_user_id", ids)
        .not("current_stage", "in", "(accepted,rejected,withdrawn)");
      const counts = new Map<string, number>();
      ids.forEach((id) => counts.set(id, 0));
      (openCounts ?? []).forEach((r: any) => {
        if (r.primary_reviewer_user_id) {
          counts.set(r.primary_reviewer_user_id, (counts.get(r.primary_reviewer_user_id) ?? 0) + 1);
        }
      });
      let best: string | null = null;
      let bestCount = Infinity;
      for (const [id, c] of counts.entries()) {
        if (c < bestCount) { best = id; bestCount = c; }
      }
      primaryReviewerId = best;
    }
    }
  }

  // Generate applicant id so we can name the resume file before insert
  const applicantId = crypto.randomUUID();
  const ext = detectExt(resume.type, resume.name || "");
  const storageBucket = intakeMode ? "pool" : cycle!.id;
  const storagePath = `${storageBucket}/${applicantId}.${ext}`;

  // Upload resume
  const { error: upErr } = await admin.storage
    .from("applicant-resumes")
    .upload(storagePath, buf, { contentType: resume.type, upsert: false });
  if (upErr) return json(500, { error: "Could not save resume", detail: upErr.message });

  // Insert applicant
  const links: Record<string, string> = {};
  if (data.portfolio_url) links.portfolio = data.portfolio_url;
  if (data.linkedin_url) links.linkedin = data.linkedin_url;

  const insertRow: any = {
    id: applicantId,
    cycle_id: intakeMode ? null : cycle!.id,
    full_name: data.full_name,
    email: emailNorm,
    phone: data.phone,
    major: data.major.trim(),
    graduation_year: null,
    experience: data.relevant_experience,
    why_join: data.why_pec,
    links,
    source: data.source,
    source_detail: data.source_detail || (data.calpoly_email ? `calpoly_email:${data.calpoly_email}` : null),
    routed_cohort_id: routedCohortId,
    preferred_cohort_id: preferredCohortId,
    routing_resolved: !intakeMode && routedCohortId !== null,
    primary_reviewer_user_id: primaryReviewerId,
    resume_storage_path: storagePath,
    resume_uploaded_at: new Date().toISOString(),
    submission_ip: ip,
    submission_user_agent: ua,
    current_stage: intakeMode ? "pre_cycle_pool" : "applied",
  };

  const { error: insErr } = await admin.from("applicants").insert(insertRow);
  if (insErr) {
    // best-effort cleanup
    await admin.storage.from("applicant-resumes").remove([storagePath]);
    if (insErr.code === "23505") {
      // Race: another submission for the same email landed first.
      if (intakeMode) {
        return json(200, {
          ok: true,
          intake: true,
          already_in_pool: true,
          ref: "pool",
        });
      }
      return json(409, { error: "You've already submitted an application for this cycle." });
    }
    return json(500, { error: "Could not save application", detail: insErr.message });
  }

  // Rate limit row
  try {
    await admin.from("submission_rate_limit").insert({ ip, email: emailNorm });
  } catch (_) {}

  // Audit
  try {
    await admin.from("audit_logs").insert({
      action: intakeMode ? "applicant.intake_pooled" : "applicant.submitted",
      target_type: "applicant",
      target_id: applicantId,
      metadata: {
        cycle_id: intakeMode ? null : cycle!.id,
        intake_mode: intakeMode,
        routed_cohort_id: routedCohortId,
        primary_reviewer_user_id: primaryReviewerId,
        major: data.major,
        source: data.source,
      },
    });
  } catch (_) {}

  return json(200, {
    ok: true,
    intake: intakeMode,
    ref: applicantId.slice(0, 8),
    routed: routedCohortId !== null,
  });
});