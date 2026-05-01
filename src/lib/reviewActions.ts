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

// ---------- Phase 4 RPCs ----------

export async function submitDeliverable(
  deliverableId: string,
  fileUrl: string,
  notes?: string | null,
): Promise<ReviewActionResult> {
  if (!fileUrl?.trim()) return { ok: false, error: "A file URL is required." };
  const { error } = await supabase.rpc("submit_deliverable" as any, {
    p_deliverable_id: deliverableId,
    p_file_url: fileUrl.trim(),
    p_notes: notes?.trim() || null,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function markDeliverableStarted(deliverableId: string): Promise<ReviewActionResult> {
  const { error } = await supabase.rpc("mark_deliverable_started" as any, {
    p_deliverable_id: deliverableId,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function validateTechnical(deliverableId: string): Promise<ReviewActionResult> {
  const { error } = await supabase.rpc("validate_deliverable_technical" as any, {
    p_deliverable_id: deliverableId,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function unvalidateTechnical(
  deliverableId: string,
  reason: string,
): Promise<ReviewActionResult> {
  const trimmed = reason.trim();
  if (trimmed.length < 3) return { ok: false, error: "Add a reason (3+ chars)." };
  const { error } = await supabase.rpc("unvalidate_deliverable_technical" as any, {
    p_deliverable_id: deliverableId,
    p_reason: trimmed,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function approveWithOverride(
  deliverableId: string,
  reason: string,
): Promise<ReviewActionResult> {
  const trimmed = reason.trim();
  if (trimmed.length < 10) {
    return { ok: false, error: "Override requires a reason of at least 10 characters." };
  }
  const { error } = await supabase.rpc("approve_deliverable_with_override" as any, {
    p_deliverable_id: deliverableId,
    p_reason: trimmed,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function archiveDeliverable(
  deliverableId: string,
  reason: string,
): Promise<ReviewActionResult> {
  const trimmed = reason.trim();
  if (trimmed.length < 3) return { ok: false, error: "Add an archive reason (3+ chars)." };
  const { error } = await supabase.rpc("archive_deliverable" as any, {
    p_deliverable_id: deliverableId,
    p_reason: trimmed,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function unarchiveDeliverable(deliverableId: string): Promise<ReviewActionResult> {
  const { error } = await supabase.rpc("unarchive_deliverable" as any, {
    p_deliverable_id: deliverableId,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function setDeliverableStage(
  deliverableId: string,
  stage: "kickoff" | "discovery" | "midpoint" | "final" | "retro",
): Promise<ReviewActionResult> {
  const { error } = await supabase.rpc("set_deliverable_stage" as any, {
    p_deliverable_id: deliverableId,
    p_stage: stage,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}