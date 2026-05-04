// Thin Firecrawl v2 wrapper used by contract-monitor edge functions.
// Returns explicit { ok, data, error } objects — never throws on HTTP failure.

const FIRECRAWL_BASE = "https://api.firecrawl.dev/v2";

export interface FirecrawlScrapeOptions {
  formats?: Array<"markdown" | "html" | "links" | "summary">;
  onlyMainContent?: boolean;
  waitFor?: number;
}

export interface FirecrawlResult<T = any> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

function getKey(): string | null {
  return Deno.env.get("FIRECRAWL_API_KEY") ?? null;
}

async function call<T>(path: string, body: Record<string, unknown>, retries = 1): Promise<FirecrawlResult<T>> {
  const key = getKey();
  if (!key) return { ok: false, status: 0, error: "FIRECRAWL_API_KEY not configured" };
  let lastErr = "";
  let lastStatus = 0;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${FIRECRAWL_BASE}${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      lastStatus = res.status;
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        lastErr = json?.error || `HTTP ${res.status}`;
        // 402/401/403 should not be retried.
        if ([401, 402, 403].includes(res.status)) {
          return { ok: false, status: res.status, error: lastErr };
        }
        continue;
      }
      return { ok: true, status: res.status, data: json as T };
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
  }
  return { ok: false, status: lastStatus, error: lastErr || "Firecrawl request failed" };
}

export interface ScrapeDoc {
  markdown?: string;
  html?: string;
  links?: string[];
  metadata?: Record<string, any>;
  summary?: string;
}

export async function scrape(url: string, opts: FirecrawlScrapeOptions = {}): Promise<FirecrawlResult<ScrapeDoc>> {
  const body = {
    url,
    formats: opts.formats ?? ["markdown", "links"],
    onlyMainContent: opts.onlyMainContent ?? true,
    waitFor: opts.waitFor,
  };
  const res = await call<{ data?: ScrapeDoc } & ScrapeDoc>("/scrape", body, 1);
  if (!res.ok) return res as FirecrawlResult<ScrapeDoc>;
  // v2 may return doc fields at top level or under .data
  const raw: any = res.data ?? {};
  const doc: ScrapeDoc = raw.data ?? raw;
  return { ok: true, status: res.status, data: doc };
}
