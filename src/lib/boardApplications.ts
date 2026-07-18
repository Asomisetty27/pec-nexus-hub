// Board applications: the data layer for the competitive leadership process.
// Tables (board_positions, board_application_cycles, board_applications) and the
// decide_board_application RPC are defined in
// supabase/migrations/20260718100000_board_applications.sql. Generated types do
// not include them yet, so queries cast through `any` (same pattern as the
// cohort_onboarding_progress calls in CohortHub).
import { supabase } from "@/integrations/supabase/client";

export type BoardPositionKind = "president" | "vp" | "cohort_lead";
export type BoardApplicationStatus =
  | "submitted" | "under_review" | "accepted" | "declined" | "withdrawn";

export interface BoardPosition {
  key: string;
  title: string;
  description: string;
  kind: BoardPositionKind;
  cohort_function_key: string | null;
  seats: number;
  is_open: boolean;
  filled_note: string | null;
  sort_order: number;
}

export interface BoardApplication {
  id: string;
  cycle_id: string;
  applicant_user_id: string;
  position_key: string;
  preference_rank: number;
  why_you: string;
  vision: string;
  relevant_experience: string;
  status: BoardApplicationStatus;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
  created_at: string;
  updated_at: string;
}

const db = supabase as any;

export async function getActiveCycle(): Promise<{ id: string; name: string; closes_at: string | null } | null> {
  const { data } = await db
    .from("board_application_cycles")
    .select("id, name, closes_at")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

export async function getPositions(): Promise<BoardPosition[]> {
  const { data } = await db.from("board_positions").select("*").order("sort_order");
  return (data as BoardPosition[]) ?? [];
}

export async function getMyApplications(userId: string): Promise<BoardApplication[]> {
  const { data } = await db
    .from("board_applications")
    .select("*")
    .eq("applicant_user_id", userId)
    .order("preference_rank");
  return (data as BoardApplication[]) ?? [];
}

/** Admin/board view: every application in the active cycle, with applicant name. */
export async function getAllApplications(): Promise<(BoardApplication & { applicant_name: string })[]> {
  const { data } = await db
    .from("board_applications")
    .select("*, profiles:applicant_user_id(full_name)")
    .order("position_key");
  return ((data as any[]) ?? []).map((r) => ({
    ...r,
    applicant_name: r.profiles?.full_name ?? "Unknown",
  }));
}

export async function submitApplication(input: {
  cycleId: string;
  userId: string;
  positionKey: string;
  preferenceRank: number;
  whyYou: string;
  vision: string;
  relevantExperience: string;
}): Promise<{ error: string | null }> {
  const { error } = await db.from("board_applications").insert({
    cycle_id: input.cycleId,
    applicant_user_id: input.userId,
    position_key: input.positionKey,
    preference_rank: input.preferenceRank,
    why_you: input.whyYou,
    vision: input.vision,
    relevant_experience: input.relevantExperience,
  });
  return { error: error ? error.message : null };
}

export async function withdrawApplication(id: string): Promise<{ error: string | null }> {
  const { error } = await db.from("board_applications").update({ status: "withdrawn" }).eq("id", id);
  return { error: error ? error.message : null };
}

/** Admin-only; the DB RPC enforces admin + grants the role on accept. */
export async function decideApplication(
  appId: string, decision: "accepted" | "declined", note: string,
): Promise<{ error: string | null }> {
  const { error } = await db.rpc("decide_board_application", {
    _app_id: appId, _decision: decision, _note: note || null,
  });
  return { error: error ? error.message : null };
}
