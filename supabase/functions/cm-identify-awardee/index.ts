// Awardee identification pass. Reads closed_bid_unconfirmed rows and looks
// for explicit award evidence on the source page (or a single linked
// official follow-up). Never fabricates a winner.

import { scrape } from "../_shared/contract-monitor/firecrawl.ts";
import { normalizeWhitespace, normalizeOrgName, absoluteUrl } from "../_shared/contract-monitor/normalize.ts";
import {
  adminClient,
  corsHeaders,
  finishRun,
  jsonResponse,
  requireLeadership,
  RunSummary,
  startRun,
} from "../_shared/contract-monitor/runs.ts";

interface IdentifyBody {
  opportunity_ids?: string[];
  limit?: number;
}

const AWARD_PATTERNS: RegExp[] = [
  /award(?:ed)?\s+(?:to|the\s+contract\s+to)\s+([A-Z][A-Za-z0-9&.,'\- ]{2,80}?)(?:[,.;\n]| for | in | on )/g,
  /contract\s+(?:was\s+)?awarded\s+to\s+([A-Z][A-Za-z0-9&.,'\- ]{2,80}?)(?:[,.;\n]| for | in | on )/g,
  /selected\s+([A-Z][A-Za-z0-9&.,'\- ]{2,80}?)\s+as\s+the\s+(?:successful|winning|awarded)\s+(?:bidder|proposer|firm|contractor)/g,
  /recommended\s+(?:vendor|firm|contractor|bidder|proposer)\s*[:\-]?\s*([A-Z][A-Za-z0-9&.,'\- ]{2,80}?)(?:[,.;\n]| for | in | on )/g,
  /(?:lowest\s+responsive|lowest\s+responsible)\s+bidder\s*[:\-]?\s*([A-Z][A-Za-z0-9&.,'\- ]{2,80}?)(?:[,.;\n]| for | in | on )/g,
];

const BIDDER_LIST_RX = /bidder(?:s|\s+list)\s*[:\-]?\s*([\s\S]{0,800})/i;

// Follow at most this many official-looking links per opportunity.
const MAX_FOLLOWED_LINKS = 2;
const OFFICIAL_LINK_HINTS = /(staff[-_ ]?report|agenda|council|award|resolution|minutes|meeting)/i;
const OFFICIAL_DOMAIN_HINT = /(\.gov|slocity\.org|cityof|county|state\.|public)/i;

function pickOfficialFollowupLinks(links: string[] | undefined, sourceUrl: string): string[] {
  if (!links?.length) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of links) {
    const abs = absoluteUrl(raw, sourceUrl);
    if (!abs || seen.has(abs)) continue;
    seen.add(abs);
    if (OFFICIAL_LINK_HINTS.test(abs) && OFFICIAL_DOMAIN_HINT.test(abs)) {
      out.push(abs);
      if (out.length >= MAX_FOLLOWED_LINKS) break;
    }
  }
  return out;
}

function extractAwardCandidates(text: string): { name: string; raw: string }[] {
  const out: { name: string; raw: string }[] = [];
  for (const rx of AWARD_PATTERNS) {
    rx.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = rx.exec(text)) !== null) {
      const name = normalizeWhitespace(m[1]);
      if (name.length < 3) continue;
      out.push({ name, raw: m[0] });
    }
  }
  return out;
}

function extractBidderNames(text: string): string[] {
  const m = text.match(BIDDER_LIST_RX);
  if (!m) return [];
  const block = m[1];
  // Split on newlines / commas / bullets
  return block
    .split(/[\n;]+|\s\u2022\s|\s-\s/)
    .map((s) => normalizeWhitespace(s))
    .filter((s) => s.length >= 3 && /[A-Z]/.test(s) && s.length <= 120);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const auth = await requireLeadership(req);
  if (auth.error) return jsonResponse({ error: auth.error }, 403);

  let body: IdentifyBody = {};
  try { body = await req.json(); } catch { /* empty body ok */ }

  const admin = adminClient();
  const runId = await startRun(admin, "manual_scan", auth.userId);

  const summary: RunSummary = {
    scanned_count: 0,
    confirmed_awardee_count: 0,
    likely_bidder_count: 0,
    unconfirmed_count: 0,
    errors: [],
    notes: [],
  };

  let q = admin
    .from("public_contract_opportunities")
    .select("id, source_url, source_snapshot, solicitation_status, confidence_level, solicitation_title")
    .eq("source_agency", "City of San Luis Obispo")
    .eq("confidence_level", "closed_bid_unconfirmed")
    .eq("is_archived", false)
    .in("solicitation_status", ["closed", "awarded"])
    .order("updated_at", { ascending: false })
    .limit(Math.min(body.limit ?? 25, 50));

  if (body.opportunity_ids && body.opportunity_ids.length > 0) {
    q = admin
      .from("public_contract_opportunities")
      .select("id, source_url, source_snapshot, solicitation_status, confidence_level, solicitation_title")
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
    if (!row.source_url) {
      summary.unconfirmed_count! += 1;
      continue;
    }
    const fc = await scrape(row.source_url, { formats: ["markdown", "links"], onlyMainContent: true });
    if (!fc.ok || !fc.data?.markdown) {
      hadFailure = true;
      summary.errors!.push({ stage: "scrape", message: fc.error ?? "no markdown", context: { id: row.id } });
      summary.unconfirmed_count! += 1;
      continue;
    }
    const allMarkdown: { url: string; md: string }[] = [{ url: row.source_url, md: fc.data.markdown }];

    // Follow up to 2 official-looking award/agenda links from the source page.
    const followups = pickOfficialFollowupLinks(fc.data.links, row.source_url);
    let followupEvidenceUrl: string | null = null;
    for (const link of followups) {
      const sub = await scrape(link, { formats: ["markdown"], onlyMainContent: true });
      if (sub.ok && sub.data?.markdown) {
        allMarkdown.push({ url: link, md: sub.data.markdown });
        if (!followupEvidenceUrl) followupEvidenceUrl = link;
      }
    }

    let awardCandidates: { name: string; raw: string; from: string }[] = [];
    let bidderNames: string[] = [];
    for (const { url, md } of allMarkdown) {
      const aw = extractAwardCandidates(md).map((c) => ({ ...c, from: url }));
      awardCandidates = awardCandidates.concat(aw);
      bidderNames = bidderNames.concat(extractBidderNames(md));
    }

    let newConfidence: "confirmed_awardee" | "likely_active_bidder" | "closed_bid_unconfirmed" = "closed_bid_unconfirmed";
    const evidence: Record<string, unknown> = {
      checked_at: new Date().toISOString(),
      source_url: row.source_url,
      followups_attempted: followups.length,
      followups_succeeded: allMarkdown.length - 1,
      evidence_url: followupEvidenceUrl,
    };

    if (awardCandidates.length > 0) {
      // Strong-signal heuristic: at least one match must come from an
      // official followup OR appear at least twice across pages.
      const fromOfficial = awardCandidates.some((c) => c.from !== row.source_url);
      const counts = new Map<string, number>();
      for (const c of awardCandidates) {
        const k = normalizeOrgName(c.name);
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
      const repeated = Array.from(counts.values()).some((n) => n >= 2);
      newConfidence = (fromOfficial || repeated) ? "confirmed_awardee" : "likely_active_bidder";
      evidence.award_matches = awardCandidates.map((c) => ({
        candidate_name: c.name,
        normalized_name: normalizeOrgName(c.name),
        evidence_snippet: c.raw.slice(0, 240),
        evidence_from: c.from,
      }));
      if (newConfidence === "confirmed_awardee") summary.confirmed_awardee_count! += 1;
      else summary.likely_bidder_count! += 1;
    } else if (bidderNames.length > 0) {
      newConfidence = "likely_active_bidder";
      evidence.bidder_names = bidderNames.slice(0, 25);
      summary.likely_bidder_count! += 1;
    } else {
      summary.unconfirmed_count! += 1;
    }

    const merged = {
      ...(row.source_snapshot ?? {}),
      awardee_evidence: evidence,
    };

    const update: Record<string, unknown> = {
      source_snapshot: merged,
      awardee_evidence_payload: evidence,
      monitor_evidence_url: followupEvidenceUrl ?? row.source_url,
    };
    if (newConfidence !== "closed_bid_unconfirmed") {
      update.confidence_level = newConfidence;
      if (newConfidence === "confirmed_awardee" && row.solicitation_status !== "awarded") {
        update.solicitation_status = "awarded";
        update.awarded_at = update.awarded_at ?? new Date().toISOString();
      }
    }
    const { error: updErr } = await admin
      .from("public_contract_opportunities")
      .update(update)
      .eq("id", row.id);
    if (updErr) {
      hadFailure = true;
      summary.errors!.push({ stage: "update", message: updErr.message, context: { id: row.id } });
    }
  }

  const status =
    hadFailure && summary.scanned_count! > 0 ? "partial"
    : hadFailure ? "failed"
    : "succeeded";
  await finishRun(admin, runId, status, summary, hadFailure ? JSON.stringify(summary.errors) : undefined);
  return jsonResponse({ ok: true, run_id: runId, status, summary });
});
