// Deterministic relevance + status classifier. Conservative: prefers to skip
// rather than guess. No LLMs.

export const RELEVANT_CATEGORIES = [
  "engineering",
  "electrical",
  "mechanical",
  "structural",
  "surveying",
  "infrastructure",
  "construction",
  "transit",
  "consulting",
  "technology",
  "communications",
  "utilities",
  "water",
  "wastewater",
  "transportation",
  "facilities",
  "public_works",
] as const;

export type Category = typeof RELEVANT_CATEGORIES[number];

const CATEGORY_PATTERNS: Array<{ cat: Category; rx: RegExp }> = [
  { cat: "water", rx: /\b(water|reservoir|hydrant|pump\s*station)\b/i },
  { cat: "wastewater", rx: /\b(wastewater|sewer|sewage|wwtp|lift\s*station)\b/i },
  { cat: "electrical", rx: /\belectric(al)?|switchgear|substation\b/i },
  { cat: "mechanical", rx: /\bmechanical|hvac|boiler|chiller\b/i },
  { cat: "structural", rx: /\bstructural|seismic|retrofit|bridge\b/i },
  { cat: "surveying", rx: /\bsurvey(ing|or)?\b/i },
  { cat: "transportation", rx: /\b(road|street|pavement|traffic|signal|bike\s*lane|sidewalk|intersection)\b/i },
  { cat: "transit", rx: /\btransit|bus\s*stop|transit\s*center\b/i },
  { cat: "infrastructure", rx: /\binfrastructure|cip\b/i },
  { cat: "construction", rx: /\b(construction|reconstruction|rehabilitation|repair\s*project)\b/i },
  { cat: "engineering", rx: /\bengineer(ing)?\b/i },
  { cat: "consulting", rx: /\bconsult(ing|ant)\b/i },
  { cat: "technology", rx: /\b(software|saas|it\s*services|platform|cybersecurity)\b/i },
  { cat: "communications", rx: /\b(communications?|fiber|broadband|telecom)\b/i },
  { cat: "utilities", rx: /\butilit(y|ies)\b/i },
  { cat: "facilities", rx: /\b(facility|facilities|building\s*maintenance|janitorial|hvac\s*maintenance)\b/i },
  { cat: "public_works", rx: /\bpublic\s*works\b/i },
];

const IRRELEVANT_PATTERNS: RegExp[] = [
  /\bcatering\b/i,
  /\buniforms?\b/i,
  /\bjanitorial\s+supplies\b/i,
  /\boffice\s+supplies\b/i,
  /\bart(work|ist)?\b/i,
  /\bmural\b/i,
  /\bevent\s+rental\b/i,
];

export interface RelevanceResult {
  relevant: boolean;
  category: Category | null;
  reason: string;
}

export function classifyRelevance(title: string, description = ""): RelevanceResult {
  const text = `${title}\n${description}`;
  for (const rx of IRRELEVANT_PATTERNS) {
    if (rx.test(text)) return { relevant: false, category: null, reason: `excluded:${rx.source}` };
  }
  for (const { cat, rx } of CATEGORY_PATTERNS) {
    if (rx.test(text)) return { relevant: true, category: cat, reason: `match:${cat}` };
  }
  return { relevant: false, category: null, reason: "no-category-match" };
}

// Map raw status text from procurement portals to a normalized lower-case token.
export type SolicitationStatus =
  | "open"
  | "closed"
  | "awarded"
  | "cancelled"
  | "unknown";

export function classifyStatus(raw: string | null | undefined): SolicitationStatus {
  const s = (raw ?? "").toLowerCase();
  if (!s) return "unknown";
  if (/cancel/.test(s)) return "cancelled";
  if (/award/.test(s)) return "awarded";
  if (/clos|expired|past/.test(s)) return "closed";
  if (/open|active|accept/.test(s)) return "open";
  return "unknown";
}

// Initial confidence based purely on the scan-step evidence.
// Awardee identification is a separate function.
export function initialConfidence(status: SolicitationStatus): "closed_bid_unconfirmed" | "likely_active_bidder" {
  // Per doctrine: scan never assigns confirmed_awardee. Awarded/closed without
  // proof = closed_bid_unconfirmed. Open solicitations don't go in the
  // unconfirmed bucket either — but we still record them as
  // closed_bid_unconfirmed since the column is non-null and the row will be
  // upgraded later. We use closed_bid_unconfirmed as the safe default.
  return "closed_bid_unconfirmed";
}
