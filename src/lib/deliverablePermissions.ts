// Centralized permission checks for deliverable actions.
// Used by every UI surface — never inline these rules elsewhere.

import type { DeliverableLike } from "./deliverableStatus";

export interface PermissionContext {
  userId: string | null | undefined;
  isAdmin?: boolean;
  isProjectLead?: boolean;
  isProjectTechLead?: boolean;
  /** group_ids the current user is a member of (for the deliverable's project). */
  groupMemberIds?: string[];
}

function isAssigneeOrGroupMember(d: DeliverableLike, ctx: PermissionContext): boolean {
  if (!ctx.userId) return false;
  if (d.owner_type === "group") {
    return !!d.owning_group_id && (ctx.groupMemberIds || []).includes(d.owning_group_id);
  }
  // individual (or legacy)
  return d.owner_id === ctx.userId;
}

export function canSubmit(d: DeliverableLike, ctx: PermissionContext): boolean {
  if (d.archived) return false;
  if (ctx.isAdmin || ctx.isProjectLead) return true;
  return isAssigneeOrGroupMember(d, ctx);
}

export function canMarkStarted(d: DeliverableLike, ctx: PermissionContext): boolean {
  if (d.archived) return false;
  if (d.file_url) return false;
  if (d.started_at) return false;
  if (ctx.isAdmin || ctx.isProjectLead) return true;
  return isAssigneeOrGroupMember(d, ctx);
}

export function canTechValidate(d: DeliverableLike, ctx: PermissionContext): boolean {
  if (d.archived) return false;
  if (!d.file_url) return false;
  if (d.approval_status === "approved") return false;
  return !!(ctx.isAdmin || ctx.isProjectTechLead);
}

export function canApprove(d: DeliverableLike, ctx: PermissionContext): boolean {
  if (d.archived) return false;
  if (!d.file_url) return false;
  if (d.approval_status === "approved") return false;
  return !!(ctx.isAdmin || ctx.isProjectLead);
}

/** True when PM approval would require the override path (tech validation missing). */
export function requiresOverride(d: DeliverableLike): boolean {
  return !!d.tech_validation_required && !d.tech_validated_at && !!d.file_url && d.approval_status !== "approved";
}

export function canArchive(d: DeliverableLike, ctx: PermissionContext): boolean {
  if (d.archived) return false;
  return !!(ctx.isAdmin || ctx.isProjectLead);
}

export function canSetStage(d: DeliverableLike, ctx: PermissionContext): boolean {
  if (d.archived) return false;
  return !!(ctx.isAdmin || ctx.isProjectLead);
}