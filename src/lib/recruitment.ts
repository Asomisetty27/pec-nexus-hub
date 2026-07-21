import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type ApplicantStage = Database["public"]["Enums"]["applicant_stage"];
export type ApplicantDecision = Database["public"]["Enums"]["applicant_decision"];

export const STAGE_ORDER: ApplicantStage[] = [
  "applied",
  "under_review",
  "resume_screen",
  "interview",
  "decision_pending",
];

export const TERMINAL_STAGES: ApplicantStage[] = [
  "accepted",
  "rejected",
  "waitlisted",
  "withdrawn",
];

/**
 * Intake-only stages — not part of normal reviewer progression.
 * `pre_cycle_pool` is reachable only via public submission when no active
 * cycle exists, and exits only via leadership promotion.
 */
export const INTAKE_STAGES: ApplicantStage[] = ["pre_cycle_pool"];

export const ALL_STAGES: ApplicantStage[] = [
  ...INTAKE_STAGES,
  ...STAGE_ORDER,
  ...TERMINAL_STAGES,
];

export const STAGE_LABEL: Record<ApplicantStage, string> = {
  pre_cycle_pool: "Pre-cycle pool",
  applied: "Applied",
  under_review: "Under review",
  resume_screen: "Resume screen",
  interview: "Interview",
  decision_pending: "Decision pending",
  accepted: "Accepted",
  rejected: "Rejected",
  waitlisted: "Waitlisted",
  withdrawn: "Withdrawn",
};

export const STAGE_TONE: Record<ApplicantStage, string> = {
  pre_cycle_pool: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
  applied: "bg-muted text-foreground",
  under_review: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  resume_screen: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
  interview: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  decision_pending: "bg-purple-500/10 text-purple-700 dark:text-purple-300",
  accepted: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  rejected: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  waitlisted: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  withdrawn: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300",
};

export const RECOMMENDATIONS: { value: ApplicantDecision; label: string }[] = [
  { value: "advance", label: "Advance" },
  { value: "hold", label: "Hold" },
  { value: "reject", label: "Reject" },
  { value: "accept", label: "Accept" },
  { value: "waitlist", label: "Waitlist" },
  { value: "request_more_info", label: "Request more info" },
];

export function isTerminal(s: ApplicantStage): boolean {
  return TERMINAL_STAGES.includes(s);
}

export function nextStage(s: ApplicantStage): ApplicantStage | null {
  const i = STAGE_ORDER.indexOf(s);
  if (i < 0 || i >= STAGE_ORDER.length - 1) return null;
  return STAGE_ORDER[i + 1];
}

/**
 * Validates whether a (current → to) transition can be done by a non-leadership
 * eligible reviewer. Leadership can do anything (with reason for skip/back/terminal).
 */
export function canReviewerDoTransition(curr: ApplicantStage, to: ApplicantStage): boolean {
  if (isTerminal(to) || isTerminal(curr)) return false;
  const ci = STAGE_ORDER.indexOf(curr);
  const ti = STAGE_ORDER.indexOf(to);
  return ci >= 0 && ti === ci + 1;
}

export async function fetchSignedResumeUrl(applicantId: string): Promise<string | null> {
  // Authz + audit are enforced inside the edge function via the SQL
  // RPC (under the caller's JWT). Signing happens with service role
  // because the bucket blocks authenticated SELECTs by policy.
  // The bucket itself remains private; URLs are short-lived (300s).
  const { data, error } = await supabase.functions.invoke("get-applicant-resume-url", {
    body: { applicant_id: applicantId },
  });
  if (error) return null;
  const url = (data as { url?: string } | null)?.url;
  return typeof url === "string" ? url : null;
}

export async function submitReview(args: {
  applicantId: string;
  recommendation: ApplicantDecision;
  rating: number | null;
  notes: string | null;
}) {
  return supabase.rpc("submit_applicant_review", {
    _applicant_id: args.applicantId,
    _recommendation: args.recommendation,
    _rating: args.rating,
    _notes: args.notes,
  });
}

export async function advanceStage(args: {
  applicantId: string;
  toStage: ApplicantStage;
  reason?: string | null;
}) {
  return supabase.rpc("advance_applicant_stage", {
    _applicant_id: args.applicantId,
    _to_stage: args.toStage,
    _reason: args.reason ?? null,
  });
}

export async function assignPrimaryReviewer(args: {
  applicantId: string;
  userId: string | null;
}) {
  return supabase.rpc("assign_primary_reviewer", {
    _applicant_id: args.applicantId,
    _user_id: args.userId,
  });
}

export async function rerouteApplicant(args: {
  applicantId: string;
  cohortId: string;
  reason: string;
}) {
  return supabase.rpc("reroute_applicant", {
    _applicant_id: args.applicantId,
    _cohort_id: args.cohortId,
    _reason: args.reason,
  });
}

/**
 * Onboarding action: convert an accepted applicant into either a linked
 * existing member or an issued invite (which will then be sent via the
 * existing send-invite-email edge function).
 *
 * The RPC is idempotent — calling it twice on the same applicant returns
 * either the existing invite token or the existing member link.
 */
export type OnboardResult = {
  state: "joined" | "invite_sent";
  already_member: boolean;
  email: string;
  full_name: string;
  cohort_id: string;
  invite_token_id?: string;
  invite_token?: string;
  converted_member_user_id?: string;
  reissued?: boolean;
};

export async function onboardAcceptedApplicant(applicantId: string): Promise<{ data: OnboardResult | null; error: any }> {
  const { data, error } = await supabase.rpc("onboard_accepted_applicant", {
    _applicant_id: applicantId,
  });
  if (error) return { data: null, error };
  return { data: data as unknown as OnboardResult, error: null };
}

/**
 * After an invite token is issued by the onboarding RPC, dispatch the
 * existing send-invite-email edge function so leadership doesn't need to
 * trigger it manually.
 */
export async function sendOnboardingInviteEmail(args: {
  email: string;
  fullName: string;
  token: string;
  tokenId: string;
}) {
  return supabase.functions.invoke("send-invite-email", {
    body: {
      email: args.email,
      token: args.token,
      fullName: args.fullName,
      tokenId: args.tokenId,
    },
  });
}

/**
 * Permission booleans derived from auth context. We rely on RLS for hard
 * enforcement — these only drive UI visibility.
 */
export type RecruitmentAccess = {
  canSeeRecruitment: boolean;
  isLead: boolean;
};

export async function loadRecruitmentAccess(userId: string | undefined, isAdmin: boolean): Promise<RecruitmentAccess> {
  if (!userId) return { canSeeRecruitment: false, isLead: false };

  // Lead = admin/superadmin/board_member/president/director_of_projects.
  // Must mirror the DB is_recruitment_lead() exactly (it includes board_member),
  // or the VP is shown "no access" while every recruitment RPC would authorize them.
  const { data: roleRows } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const roles = new Set((roleRows ?? []).map((r: any) => r.role));
  const isLead =
    isAdmin ||
    roles.has("admin") ||
    roles.has("superadmin") ||
    roles.has("board_member") ||
    roles.has("president") ||
    roles.has("director_of_projects");

  if (isLead) return { canSeeRecruitment: true, isLead: true };

  // Cohort reviewer eligibility = any cohort_membership with role in (lead,pm,integration_lead)
  const { data: memb } = await supabase
    .from("cohort_memberships")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["lead", "pm", "integration_lead"]);

  return {
    canSeeRecruitment: (memb?.length ?? 0) > 0,
    isLead: false,
  };
}