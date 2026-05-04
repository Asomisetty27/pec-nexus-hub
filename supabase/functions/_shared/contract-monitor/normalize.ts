// Deterministic normalization helpers used across contract-monitor functions.
// No network calls, no LLMs — pure string/date hygiene so we never insert
// duplicate or fabricated rows.

const COMPANY_SUFFIXES = [
  "inc", "incorporated", "llc", "l.l.c", "llp", "l.l.p", "ltd", "limited",
  "corp", "corporation", "co", "company", "plc", "pllc", "p.c", "pc",
  "the",
];

export function normalizeWhitespace(s: string | null | undefined): string {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

export function normalizeTitle(t: string | null | undefined): string {
  return normalizeWhitespace(t).replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"');
}

export function normalizeOrgName(raw: string | null | undefined): string {
  let s = normalizeWhitespace(raw).toLowerCase();
  s = s.replace(/[.,]/g, " ");
  s = s.replace(/&/g, " and ");
  s = s.replace(/\s+/g, " ").trim();
  // Strip trailing legal suffixes
  let changed = true;
  while (changed) {
    changed = false;
    for (const suf of COMPANY_SUFFIXES) {
      if (s.endsWith(" " + suf)) {
        s = s.slice(0, -suf.length - 1).trim();
        changed = true;
      }
    }
  }
  return s;
}

export function normalizeDomain(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = raw.trim().toLowerCase();
  s = s.replace(/^https?:\/\//, "").replace(/^www\./, "");
  s = s.split("/")[0]?.split("?")[0] ?? "";
  if (!s.includes(".")) return null;
  return s || null;
}

export function normalizeSolicitationId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = normalizeWhitespace(raw).toUpperCase().replace(/\s+/g, "-");
  return s || null;
}

export function safeParseDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = normalizeWhitespace(raw);
  if (!s) return null;
  const t = Date.parse(s);
  if (isNaN(t)) return null;
  return new Date(t).toISOString();
}

export function absoluteUrl(href: string, base: string): string | null {
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}
