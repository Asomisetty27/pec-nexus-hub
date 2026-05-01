// Single source of truth for deliverable lifecycle state.
// Storage truth: approval_status enum (pending|approved|rejected|revision_requested) + columns.
// UI truth: canonical doctrine statuses derived below. No second storage truth.

export type UnifiedStatus =
  | "drafted"
  | "assigned"
  | "in_progress"
  | "submitted"
  | "needs_revision"
  | "approved"
  | "archived";

export interface DeliverableLike {
  approval_status: string | null;
  approval_required: boolean | null;
  file_url: string | null;
  due_date: string | null;
  required?: boolean | null;
  // Phase 4 columns (all optional so legacy callers compile)
  owner_id?: string | null;
  owner_type?: "individual" | "group" | null;
  owning_group_id?: string | null;
  started_at?: string | null;
  archived?: boolean | null;
  canonical_stage?: string | null;
  is_technical?: boolean | null;
  tech_validation_required?: boolean | null;
  tech_validated_at?: string | null;
  pm_override_at?: string | null;
}

function hasOwner(d: DeliverableLike): boolean {
  if (d.owner_type === "group") return !!d.owning_group_id;
  if (d.owner_type === "individual") return !!d.owner_id;
  // legacy rows: owner_type defaults to individual on the DB; trust owner_id.
  return !!d.owner_id || !!d.owning_group_id;
}

export function getUnifiedStatus(d: DeliverableLike): UnifiedStatus {
  if (d.archived) return "archived";
  const status = d.approval_status || "pending";
  if (status === "approved") return "approved";
  // Doctrine maps rejected → needs_revision (legacy rejected rows still legible via secondary tone).
  if (status === "revision_requested" || status === "rejected") return "needs_revision";
  if (d.file_url) return "submitted";
  if (!hasOwner(d)) return "drafted";
  return d.started_at ? "in_progress" : "assigned";
}

/** Overdue is a modifier badge, NOT a primary status. */
export function isOverdue(d: DeliverableLike): boolean {
  if (d.archived) return false;
  if (d.approval_status === "approved") return false;
  if (!d.due_date) return false;
  return new Date(d.due_date) < new Date();
}

/** True for legacy rejected rows so UI can show a secondary "Rejected" sub-tone. */
export function wasRejected(d: DeliverableLike): boolean {
  return d.approval_status === "rejected" && !d.archived;
}

// True if this deliverable currently blocks its stage.
export function isBlockingStage(d: DeliverableLike): boolean {
  if (!d.required) return false;
  if (d.archived) return false;
  if (d.approval_required) return d.approval_status !== "approved";
  return !d.file_url;
}

export const STATUS_LABELS: Record<UnifiedStatus, string> = {
  drafted: "Drafted",
  assigned: "Assigned",
  in_progress: "In progress",
  submitted: "Submitted",
  needs_revision: "Needs revision",
  approved: "Approved",
  archived: "Archived",
};

// ---------------- Tech validation derived state ----------------

export type ValidationState =
  | "not_required"
  | "awaiting_submission"
  | "awaiting_tech_validation"
  | "tech_validated"
  | "awaiting_pm_approval"
  | "approved_via_override"
  | "approved";

export function getValidationState(d: DeliverableLike): ValidationState {
  if (!d.tech_validation_required) {
    if (d.approval_status === "approved") return "approved";
    return "not_required";
  }
  if (d.approval_status === "approved") {
    return d.pm_override_at ? "approved_via_override" : "approved";
  }
  if (!d.file_url) return "awaiting_submission";
  if (!d.tech_validated_at) return "awaiting_tech_validation";
  return "awaiting_pm_approval";
}

// ---------------- Canonical stage labels ----------------

export const STAGE_LABELS: Record<string, string> = {
  kickoff: "Kickoff",
  discovery: "Discovery",
  midpoint: "Midpoint",
  final: "Final",
  retro: "Retro",
};

export const CANONICAL_STAGES = ["kickoff", "discovery", "midpoint", "final", "retro"] as const;
export type CanonicalStage = typeof CANONICAL_STAGES[number];

export function stageLabel(stage: string | null | undefined): string {
  if (!stage) return "Unstaged";
  return STAGE_LABELS[stage] || stage;
}
