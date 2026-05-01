// Phase 3 Company Relations CRM constants.
// The live `crm_status` enum has 11 values from the Phase 1 schema. The product doctrine
// describes a richer canonical vocabulary. Until a future enum migration aligns storage,
// this module maps each live status to a canonical UI label + bucket so the UI presentation
// reflects doctrine while writes stay aligned with the live DB.

export type CrmStatus =
  | "not_started"
  | "researching"
  | "queued_for_outreach"
  | "contacted"
  | "in_conversation"
  | "meeting_scheduled"
  | "proposal_sent"
  | "won"
  | "lost"
  | "dormant"
  | "do_not_contact";

export type CrmStatusBucket =
  | "unqualified"
  | "outreach"
  | "engaged"
  | "qualified"
  | "converted"
  | "closed"
  | "dormant";

export const CRM_STATUS_LABEL: Record<CrmStatus, string> = {
  not_started: "Not started",
  researching: "Researching",
  queued_for_outreach: "Ready for outreach",
  contacted: "Initial outreach sent",
  in_conversation: "In conversation",
  meeting_scheduled: "Intro call scheduled",
  proposal_sent: "Proposal / scoping",
  won: "Converted",
  lost: "Closed — not a fit",
  dormant: "Dormant — revisit later",
  do_not_contact: "Closed — do not contact",
};

export const CRM_STATUS_BUCKET: Record<CrmStatus, CrmStatusBucket> = {
  not_started: "unqualified",
  researching: "unqualified",
  queued_for_outreach: "outreach",
  contacted: "outreach",
  in_conversation: "engaged",
  meeting_scheduled: "qualified",
  proposal_sent: "qualified",
  won: "converted",
  lost: "closed",
  do_not_contact: "closed",
  dormant: "dormant",
};

export const CRM_BUCKET_LABEL: Record<CrmStatusBucket, string> = {
  unqualified: "Unqualified",
  outreach: "Outreach",
  engaged: "Engaged",
  qualified: "Qualified",
  converted: "Converted",
  closed: "Closed",
  dormant: "Dormant",
};

// Pipeline stage order for the Kanban view.
export const PIPELINE_STAGES: CrmStatus[] = [
  "not_started",
  "researching",
  "queued_for_outreach",
  "contacted",
  "in_conversation",
  "meeting_scheduled",
  "proposal_sent",
  "won",
];

// Statuses that count as "qualified" in the Qualified view.
export const QUALIFIED_STATUSES: CrmStatus[] = [
  "in_conversation",
  "meeting_scheduled",
  "proposal_sent",
];

// Closed / inactive statuses (excluded from active pipeline counts).
export const INACTIVE_STATUSES: CrmStatus[] = ["lost", "do_not_contact", "dormant"];

export type RelationshipGoal =
  | "project"
  | "sponsorship"
  | "speaker"
  | "judge"
  | "recruiting"
  | "general_partnership";

export const RELATIONSHIP_GOAL_LABEL: Record<RelationshipGoal, string> = {
  project: "Project",
  sponsorship: "Sponsorship",
  speaker: "Speaker",
  judge: "Judge",
  recruiting: "Recruiting",
  general_partnership: "General partnership",
};

export const RELATIONSHIP_GOAL_OPTIONS: { value: RelationshipGoal; label: string }[] = [
  { value: "project", label: "Project" },
  { value: "sponsorship", label: "Sponsorship" },
  { value: "speaker", label: "Speaker" },
  { value: "judge", label: "Judge" },
  { value: "recruiting", label: "Recruiting" },
  { value: "general_partnership", label: "General partnership" },
];

export type CrmWarmth = "cold" | "warm" | "hot";
export const WARMTH_LABEL: Record<CrmWarmth, string> = { cold: "Cold", warm: "Warm", hot: "Hot" };

export type CrmTier = "tier_1" | "tier_2" | "tier_3";
export const TIER_LABEL: Record<CrmTier, string> = { tier_1: "Tier 1", tier_2: "Tier 2", tier_3: "Tier 3" };

export function statusBucketTone(bucket: CrmStatusBucket): string {
  // Tailwind class snippets keyed off semantic tokens.
  switch (bucket) {
    case "converted":
      return "bg-success/10 text-success border-success/30";
    case "qualified":
      return "bg-accent/10 text-accent-foreground border-accent/30";
    case "engaged":
      return "bg-primary/10 text-primary border-primary/30";
    case "outreach":
      return "bg-warning/10 text-warning border-warning/30";
    case "closed":
      return "bg-destructive/10 text-destructive border-destructive/30";
    case "dormant":
      return "bg-muted/40 text-muted-foreground border-border";
    default:
      return "bg-muted/30 text-muted-foreground border-border";
  }
}

export function fitScoreTone(score?: number | null): string {
  if (score == null) return "text-muted-foreground";
  if (score >= 80) return "text-success";
  if (score >= 60) return "text-accent-foreground";
  if (score >= 40) return "text-warning";
  return "text-destructive";
}

export function relationshipGoalLabel(goal?: string | null): string {
  if (!goal) return "Unset";
  return RELATIONSHIP_GOAL_LABEL[goal as RelationshipGoal] ?? goal;
}

export function statusLabel(status?: string | null): string {
  if (!status) return "—";
  return CRM_STATUS_LABEL[status as CrmStatus] ?? status;
}

export function statusBucket(status?: string | null): CrmStatusBucket | null {
  if (!status) return null;
  return CRM_STATUS_BUCKET[status as CrmStatus] ?? null;
}