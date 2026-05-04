import { INACTIVE_STATUSES, type CrmStatus } from "@/lib/crmConstants";

export const STALE_DAYS = 14;
export const RECENT_DAYS = 7;
const EARLY: CrmStatus[] = ["not_started", "researching", "queued_for_outreach", "contacted"];

export type QueueKey =
  | "mine" | "unowned" | "ready" | "research" | "stale" | "recent" | "qualified" | "tasks";

export interface QueueDef {
  key: QueueKey;
  label: string;
  hint: string;
}

export const QUEUES: QueueDef[] = [
  { key: "mine", label: "My companies", hint: "Companies you own, assist on, or oversee." },
  { key: "unowned", label: "Unowned", hint: "No owner yet — claim one to start working it." },
  { key: "ready", label: "Ready for outreach", hint: "Queued or in conversation, ready for the next contact." },
  { key: "research", label: "Needs research", hint: "Missing contacts or basic profile info before outreach." },
  { key: "stale", label: "Stale", hint: `Active companies with no contact in ${STALE_DAYS}+ days.` },
  { key: "recent", label: "Recently changed", hint: `Updated in the last ${RECENT_DAYS} days.` },
  { key: "qualified", label: "Qualified", hint: "In conversation, meeting scheduled, or proposal sent." },
  { key: "tasks", label: "Tasks due", hint: "Open tasks assigned to you, due in the next 7 days." },
];

export function isStale(c: any): boolean {
  if (INACTIVE_STATUSES.includes(c.crm_status)) return false;
  if (!c.last_contacted_at) return c.crm_status !== "not_started";
  return Date.now() - new Date(c.last_contacted_at).getTime() > STALE_DAYS * 86400000;
}

export function isUnowned(c: any): boolean {
  return !c.owner_user_id && !c.secondary_owner_user_id && !c.overseeing_lead_user_id;
}

export function isEarly(c: any): boolean {
  return EARLY.includes(c.crm_status);
}

export function needsResearch(c: any, contactCount: number): boolean {
  if (!isEarly(c)) return false;
  if (contactCount === 0) return true;
  if (!c.industry || !c.website_url) return true;
  return false;
}

export function readyForOutreach(c: any, contactCount: number): boolean {
  if (INACTIVE_STATUSES.includes(c.crm_status)) return false;
  if (c.crm_status === "queued_for_outreach") return true;
  if (c.crm_status === "researching" && contactCount >= 1) return true;
  return false;
}

export function isRecentlyChanged(c: any): boolean {
  if (!c.updated_at) return false;
  return Date.now() - new Date(c.updated_at).getTime() < RECENT_DAYS * 86400000;
}

export function fmtRelative(iso?: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.round(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}
