// Canonical, single source of truth for deliverable review actions.
// All UI surfaces (ReviewQueue, LeadWorkspace, ProjectDetail, AdvisorPortal) MUST
// route through these helpers so behaviour, audit logging, and notifications stay consistent.

import { supabase } from "@/integrations/supabase/client";

export type ReviewActionResult = { ok: true } | { ok: false; error: string };

export async function approveDeliverable(deliverableId: string): Promise<ReviewActionResult> {
  const { error } = await supabase.rpc("approve_deliverable", { p_deliverable_id: deliverableId });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function requestDeliverableChanges(
  deliverableId: string,
  reason: string,
): Promise<ReviewActionResult> {
  const trimmed = reason.trim();
  if (trimmed.length < 3) {
    return { ok: false, error: "Add a reason (3+ chars) so the owner knows what to change." };
  }
  const { error } = await supabase.rpc("request_deliverable_changes", {
    p_deliverable_id: deliverableId,
    p_reason: trimmed,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function rejectDeliverable(
  deliverableId: string,
  reason: string,
): Promise<ReviewActionResult> {
  const trimmed = reason.trim();
  if (trimmed.length < 3) {
    return { ok: false, error: "Add a rejection reason (3+ chars)." };
  }
  const { error } = await supabase.rpc("reject_deliverable", {
    p_deliverable_id: deliverableId,
    p_reason: trimmed,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}