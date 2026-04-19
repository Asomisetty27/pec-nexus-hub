// Single source of truth for deliverable lifecycle state.
// DB enum approval_status: pending | approved | rejected | revision_requested
// Derived UI states blend in file_url + due_date.

export type UnifiedStatus =
  | "not_started"
  | "submitted"
  | "awaiting_review"
  | "revision_requested"
  | "approved"
  | "rejected"
  | "overdue";

export interface DeliverableLike {
  approval_status: string | null;
  approval_required: boolean | null;
  file_url: string | null;
  due_date: string | null;
  required?: boolean | null;
}

export function getUnifiedStatus(d: DeliverableLike): UnifiedStatus {
  const status = d.approval_status || "pending";
  if (status === "approved") return "approved";
  if (status === "rejected") return "rejected";
  if (status === "revision_requested") return "revision_requested";

  const isOverdue = !!d.due_date && new Date(d.due_date) < new Date();
  if (!d.file_url) return isOverdue ? "overdue" : "not_started";
  return d.approval_required ? "awaiting_review" : "submitted";
}

// True if this deliverable currently blocks its stage.
// Required + (approval needed but not approved) OR (no approval needed but no file).
export function isBlockingStage(d: DeliverableLike): boolean {
  if (!d.required) return false;
  if (d.approval_required) return d.approval_status !== "approved";
  return !d.file_url;
}

export const STATUS_LABELS: Record<UnifiedStatus, string> = {
  not_started: "Not started",
  submitted: "Submitted",
  awaiting_review: "Awaiting review",
  revision_requested: "Revision requested",
  approved: "Approved",
  rejected: "Rejected",
  overdue: "Overdue",
};
