// Organization enrichment for confirmed awardees (and optionally likely
// bidders). Resolves an existing org by normalized name, or creates a new
// CRM-ready row, then writes confidence-aware enrichment via
// cm_write_field_if_better.

import { scrape } from "../_shared/contract-monitor/firecrawl.ts";
import { normalizeDomain, normalizeOrgName, normalizeWhitespace } from "../_shared/contract-monitor/normalize.ts";
import {
  adminClient,
  corsHeaders,
  finishRun,
  jsonResponse,
  requireLeadership,
  RunSummary,
  startRun,
} from "../_shared/contract-monitor/runs.ts";

interface EnrichBody {
  opportunity_ids?: string[];
  allow_likely_bidders?: boolean;
  limit?: number;
}

interface AwardeeEvidence {
  candidate_name: string;
  normalized_name: string;
}

function pickPrimaryCandidate(snapshot: Record<string, any>): AwardeeEvidence | null {
  const matches = snapshot?.awardee_evidence?.award_matches as AwardeeEvidence[] | undefined;
  if (!matches || matches.length === 0) return null;
  // Pick the most-frequent normalized name (defends against multiple snippet
  // matches of the same firm).
  const counts = new Map<string, number>();
  for (const m of matches) counts.set(m.normalized_name, (counts.get(m.normalized_name) ?? 0) + 1);
  let best: AwardeeEvidence | null = null;
  let bestCount = -1;
  for (const m of matches) {
    const c = counts.get(m.normalized_name) ?? 0;
    if (c > bestCount) { best = m; bestCount = c; }
  }
  return best;
}

async function resolveOrCreateOrg(
  admin: ReturnType<typeof adminClient>,
  candidateName: string,
  createdBy: string | null,
): Promise<{ id: string; created: boolean } | null> {
  const normalized = normalizeOrgName(candidateName);
  if (!normalized) return null;
  // Try exact case-insensitive name match first
  const { data: byName } = await admin
    .from("organizations")
    .select("id, name")
    .ilike("name", candidateName.trim())
    .limit(1)
    .maybeSingle();
  if (byName?.id) return { id: byName.id, created: false };
  // Try normalized fuzzy: pull a small set and compare normalized names
  const firstWord = candidateName.trim().split(/\s+/)[0];
  if (firstWord && firstWord.length >= 3) {
    const { data: cand } = await admin
      .from("organizations")
      .select("id, name")
      .ilike("name", `${firstWord}%`)
      .limit(20);
    for (const c of cand ?? []) {
      if (normalizeOrgName(c.name) === normalized) return { id: c.id, created: false };
    }
  }
  // Create new
  const { data: created, error } = await admin
    .from("organizations")
    .insert({
      name: candidateName.trim().slice(0, 200),
      type: "client",
      is_company_relation: true,
      crm_status: "researching",
      warmth_score: "cold",
      relationship_goal: "project",
      procurement_vendor: true,
      contract_monitor_notes: "Source: City of San Luis Obispo Public Procurement",
      created_by: createdBy,
    })
    .select("id")
    .single();
  if (error) return null;
  return { id: created.id, created: true };
}

function pickBestExternalLink(links: string[] | undefined, candidateName: string): { website?: string; linkedin?: string } {
  const out: { website?: string; linkedin?: string } = {};
  if (!links) return out;
  const first = candidateName.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  for (const l of links) {
    const lc = l.toLowerCase();
    if (!out.linkedin && lc.includes("linkedin.com/company/")) out.linkedin = l;
    if (
      !out.website && first &&
      /^https?:\/\//.test(l) &&
      !/(slocity|bidnetdirect|google|facebook|linkedin|twitter|x\.com|youtube|wikipedia)/i.test(l) &&
      lc.includes(first)
    ) {
      out.website = l;
    }
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const auth = await requireLeadership(req);
  if (auth.error) return jsonResponse({ error: auth.error }, 403);

  let body: EnrichBody = {};
  try { body = await req.json(); } catch { /* ok */ }

  const admin = adminClient();
  const runId = await startRun(admin, "enrichment_refresh", auth.userId);

  const summary: RunSummary = {
    scanned_count: 0,
    enrichment_success_count: 0,
    enrichment_failure_count: 0,
    errors: [],
    notes: [],
  };

  const allowed = ["confirmed_awardee", ...(body.allow_likely_bidders ? ["likely_active_bidder"] : [])];

  let q = admin
    .from("public_contract_opportunities")
    .select("id, source_url, source_snapshot, awardee_organization_id, confidence_level, solicitation_title")
    .eq("source_agency", "City of San Luis Obispo")
    .eq("is_archived", false)
    .in("confidence_level", allowed)
    .is("awardee_organization_id", null)
    .order("updated_at", { ascending: false })
    .limit(Math.min(body.limit ?? 10, 25));

  if (body.opportunity_ids && body.opportunity_ids.length > 0) {
    q = admin
      .from("public_contract_opportunities")
      .select("id, source_url, source_snapshot, awardee_organization_id, confidence_level, solicitation_title")
      .in("id", body.opportunity_ids);
  }

  const { data: rows, error: loadErr } = await q;
  if (loadErr) {
    await finishRun(admin, runId, "failed", { ...summary, errors: [{ stage: "load", message: loadErr.message }] }, loadErr.message);
    return jsonResponse({ ok: false, error: loadErr.message }, 500);
  }

  let hadFailure = false;

  for (const row of rows ?? []) {
    summary.scanned_count! += 1;
    const candidate = pickPrimaryCandidate(row.source_snapshot ?? {});
    if (!candidate?.candidate_name) {
      summary.enrichment_failure_count! += 1;
      summary.errors!.push({ stage: "candidate", message: "no awardee evidence", context: { id: row.id } });
      continue;
    }
    const resolved = await resolveOrCreateOrg(admin, candidate.candidate_name, auth.userId);
    if (!resolved) {
      hadFailure = true;
      summary.enrichment_failure_count! += 1;
      summary.errors!.push({ stage: "resolve", message: "could not resolve or create org", context: { id: row.id, name: candidate.candidate_name } });
      continue;
    }

    // Try a quick web search via Firecrawl scrape on a Google query page is
    // out-of-scope per source-boundary doctrine. Instead: attempt direct
    // domain guess (firstword.com) only as a *probe* — if scrape returns
    // a real page, harvest links to find the official site or LinkedIn.
    const slug = normalizeOrgName(candidate.candidate_name).split(" ").join("");
    const probeUrl = slug.length >= 3 ? `https://${slug}.com` : null;
    let officialSite: string | null = null;
    let linkedin: string | null = null;

    if (probeUrl) {
      const probe = await scrape(probeUrl, { formats: ["markdown", "links"], onlyMainContent: true });
      if (probe.ok && probe.data) {
        const md = (probe.data.markdown ?? "").toLowerCase();
        // Confirm the page actually mentions the candidate name to avoid
        // accidentally claiming a parked/unrelated domain.
        if (md.includes(candidate.candidate_name.toLowerCase()) || md.includes(slug)) {
          officialSite = probeUrl;
          const picked = pickBestExternalLink(probe.data.links, candidate.candidate_name);
          if (picked.linkedin) linkedin = picked.linkedin;
        }
      }
    }

    // Confidence-aware writes via DB helper. Only write fields we actually found.
    const evidenceUrl = officialSite ?? row.source_url ?? "";
    const sourceKind = officialSite ? "official_company_site" : "city_procurement";

    const writes: Array<[string, string | null, "high" | "medium"]> = [];
    if (officialSite) writes.push(["website_url", officialSite, "high"]);
    if (linkedin) writes.push(["linkedin_url", linkedin, "medium"]);
    // Always preserve attribution
    writes.push(["contract_monitor_notes", "Source: City of San Luis Obispo Public Procurement", "high"]);

    let writeFailed = false;
    for (const [field, value, conf] of writes) {
      if (!value) continue;
      const { error: wErr } = await admin.rpc("cm_write_field_if_better", {
        _org_id: resolved.id,
        _field: field,
        _value: value,
        _new_confidence: conf,
        _source_url: evidenceUrl,
        _source_kind: sourceKind,
      });
      if (wErr) {
        writeFailed = true;
        summary.errors!.push({ stage: "write", message: wErr.message, context: { field } });
      }
    }

    // Stamp the link from the contract opportunity → org
    const { error: linkErr } = await admin
      .from("public_contract_opportunities")
      .update({
        awardee_organization_id: resolved.id,
        source_snapshot: {
          ...(row.source_snapshot ?? {}),
          enrichment: {
            enriched_at: new Date().toISOString(),
            org_id: resolved.id,
            org_created: resolved.created,
            official_site_found: !!officialSite,
            linkedin_found: !!linkedin,
          },
        },
      })
      .eq("id", row.id);
    if (linkErr) {
      hadFailure = true;
      summary.errors!.push({ stage: "link", message: linkErr.message, context: { id: row.id } });
    }

    // Stamp last_enriched_at on the org (best-effort; ignore errors)
    await admin.from("organizations").update({ last_enriched_at: new Date().toISOString() }).eq("id", resolved.id);

    if (writeFailed || linkErr) {
      hadFailure = true;
      summary.enrichment_failure_count! += 1;
    } else {
      summary.enrichment_success_count! += 1;
    }
  }

  const status =
    hadFailure && summary.enrichment_success_count! > 0 ? "partial"
    : hadFailure ? "failed"
    : "succeeded";
  await finishRun(admin, runId, status, summary, hadFailure ? JSON.stringify(summary.errors) : undefined);
  return jsonResponse({ ok: true, run_id: runId, status, summary });
});
