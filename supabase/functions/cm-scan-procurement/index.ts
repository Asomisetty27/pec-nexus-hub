// Manually-triggered procurement scan for the City of San Luis Obispo.
// Leadership-only. Idempotent. Skips irrelevant rows. Never fabricates data.

import { scrape } from "../_shared/contract-monitor/firecrawl.ts";
import {
  classifyRelevance,
  classifyStatus,
  initialConfidence,
} from "../_shared/contract-monitor/classify.ts";
import {
  absoluteUrl,
  normalizeSolicitationId,
  normalizeTitle,
  normalizeWhitespace,
  safeParseDate,
} from "../_shared/contract-monitor/normalize.ts";
import {
  adminClient,
  corsHeaders,
  finishRun,
  jsonResponse,
  requireLeadership,
  RunSummary,
  startRun,
} from "../_shared/contract-monitor/runs.ts";

const SOURCES = [
  {
    label: "BidNetDirect",
    url: "https://www.bidnetdirect.com/california/cityofsanluisobispo",
  },
  {
    label: "SLO City Bids/RFPs",
    url: "https://www.slocity.org/government/department-directory/finance-it/purchasing-contracting/bids-rfps",
  },
];

interface RawOpportunity {
  title: string;
  url: string;
  externalId?: string | null;
  statusRaw?: string | null;
  description?: string | null;
  publishedRaw?: string | null;
  closedRaw?: string | null;
  awardedRaw?: string | null;
}

/**
 * Best-effort markdown parser for procurement listing pages. We extract
 * candidate rows by scanning markdown links and surrounding text for
 * status/date keywords. If we can't find a meaningful title we skip the row
 * entirely rather than insert junk.
 */
function extractFromMarkdown(markdown: string, baseUrl: string): RawOpportunity[] {
  if (!markdown) return [];
  const out: RawOpportunity[] = [];
  const seen = new Set<string>();
  // Capture markdown links: [text](href)
  const linkRx = /\[([^\]]{6,200})\]\(([^)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = linkRx.exec(markdown)) !== null) {
    const text = normalizeWhitespace(m[1]);
    const href = m[2];
    if (!text || !href) continue;
    const abs = absoluteUrl(href, baseUrl);
    if (!abs) continue;
    // Skip obvious nav/utility links
    if (/^(home|next|previous|login|register|contact|help|search|sign\s*in)$/i.test(text)) continue;
    if (/\.(jpg|png|gif|svg|css|js)(\?|$)/i.test(abs)) continue;
    if (seen.has(abs)) continue;
    seen.add(abs);
    // Look at the surrounding ~400 chars for status/date hints
    const windowStart = Math.max(0, m.index - 200);
    const windowEnd = Math.min(markdown.length, m.index + m[0].length + 200);
    const ctx = markdown.slice(windowStart, windowEnd);
    const statusRaw = (ctx.match(/\b(open|closed|awarded|cancell?ed|active|expired)\b/i)?.[1] ?? "").toLowerCase();
    const idMatch = ctx.match(/\b(?:RFP|RFQ|IFB|Bid|Project|Solicitation)[\s#:-]*([A-Z0-9][A-Z0-9\-_/]{2,40})/i);
    const closedRaw = ctx.match(/clos(?:e|ing|ed)\s*[:\-]?\s*([A-Z][a-z]+\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4})/i)?.[1];
    const publishedRaw = ctx.match(/(?:posted|published|issued)\s*[:\-]?\s*([A-Z][a-z]+\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4})/i)?.[1];
    const awardedRaw = ctx.match(/award(?:ed)?\s*[:\-]?\s*([A-Z][a-z]+\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4})/i)?.[1];
    out.push({
      title: normalizeTitle(text),
      url: abs,
      externalId: idMatch?.[1] ? normalizeSolicitationId(idMatch[1]) : null,
      statusRaw: statusRaw || null,
      publishedRaw: publishedRaw || null,
      closedRaw: closedRaw || null,
      awardedRaw: awardedRaw || null,
    });
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const auth = await requireLeadership(req);
  if (auth.error) return jsonResponse({ error: auth.error }, 403);

  const admin = adminClient();
  const runId = await startRun(admin, "manual_scan", auth.userId);

  const summary: RunSummary = {
    scanned_count: 0,
    relevant_count: 0,
    inserted_count: 0,
    updated_count: 0,
    duplicate_skipped_count: 0,
    unconfirmed_count: 0,
    errors: [],
    notes: [],
  };

  let hadFailure = false;

  for (const src of SOURCES) {
    const fc = await scrape(src.url, { formats: ["markdown", "links"], onlyMainContent: true });
    if (!fc.ok || !fc.data?.markdown) {
      hadFailure = true;
      summary.errors!.push({ stage: "scrape", message: fc.error ?? "no markdown", context: { source: src.label } });
      continue;
    }
    const raws = extractFromMarkdown(fc.data.markdown, src.url);
    summary.scanned_count! += raws.length;

    for (const r of raws) {
      const rel = classifyRelevance(r.title, r.description ?? "");
      if (!rel.relevant) continue;
      summary.relevant_count! += 1;
      const status = classifyStatus(r.statusRaw);
      const confidence = initialConfidence(status);

      const row = {
        source_agency: "City of San Luis Obispo",
        source_type: "public_procurement",
        external_solicitation_id: r.externalId ?? null,
        solicitation_title: r.title.slice(0, 500),
        solicitation_status: status,
        published_at: safeParseDate(r.publishedRaw),
        closed_at: safeParseDate(r.closedRaw),
        awarded_at: safeParseDate(r.awardedRaw),
        confidence_level: confidence,
        source_url: r.url,
        source_snapshot: {
          source_label: src.label,
          scraped_at: new Date().toISOString(),
          status_raw: r.statusRaw ?? null,
          published_raw: r.publishedRaw ?? null,
          closed_raw: r.closedRaw ?? null,
          awarded_raw: r.awardedRaw ?? null,
          relevance_reason: rel.reason,
        },
        category: rel.category,
      } as const;

      // Manual idempotent insert-or-update (partial unique indexes don't
      // satisfy PostgREST's ON CONFLICT, so we look up explicitly).
      let existingId: string | null = null;
      let existingStatus: string | null = null;
      const lookup = row.external_solicitation_id
        ? admin
            .from("public_contract_opportunities")
            .select("id, solicitation_status")
            .eq("source_agency", row.source_agency)
            .eq("external_solicitation_id", row.external_solicitation_id)
            .maybeSingle()
        : admin
            .from("public_contract_opportunities")
            .select("id, solicitation_status")
            .eq("source_agency", row.source_agency)
            .eq("source_url", r.url)
            .maybeSingle();
      const { data: ex } = await lookup;
      existingId = ex?.id ?? null;
      existingStatus = ex?.solicitation_status ?? null;

      if (existingId) {
        const { error: updErr } = await admin
          .from("public_contract_opportunities")
          .update({
            solicitation_title: row.solicitation_title,
            solicitation_status: row.solicitation_status,
            published_at: row.published_at,
            closed_at: row.closed_at,
            awarded_at: row.awarded_at,
            source_url: row.source_url,
            source_snapshot: row.source_snapshot,
            category: row.category,
          })
          .eq("id", existingId);
        if (updErr) {
          hadFailure = true;
          summary.errors!.push({ stage: "update", message: updErr.message, context: { url: r.url } });
          continue;
        }
        if (existingStatus !== status) summary.updated_count! += 1;
        else summary.duplicate_skipped_count! += 1;
      } else {
        const { error: insErr } = await admin
          .from("public_contract_opportunities")
          .insert(row);
        if (insErr) {
          // Race: another concurrent run may have inserted same key. Treat as duplicate.
          if (/duplicate key|unique/i.test(insErr.message)) {
            summary.duplicate_skipped_count! += 1;
          } else {
            hadFailure = true;
            summary.errors!.push({ stage: "insert", message: insErr.message, context: { url: r.url } });
          }
          continue;
        }
        summary.inserted_count! += 1;
        summary.unconfirmed_count! += 1;
      }
    }
  }

  const status =
    hadFailure && (summary.inserted_count! + summary.updated_count!) > 0 ? "partial"
    : hadFailure ? "failed"
    : "succeeded";

  await finishRun(admin, runId, status, summary, hadFailure ? JSON.stringify(summary.errors) : undefined);
  return jsonResponse({ ok: true, run_id: runId, status, summary });
});
