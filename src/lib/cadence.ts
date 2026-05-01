/**
 * Cadence Engine — Phase 5 client helpers.
 *
 * Wraps the `cadence_signals` and `cadence_overview` RPCs with typed
 * fetchers and prioritization rules used by the four approved surfaces:
 * CohortHub, ProjectDetail, LeadWorkspace, CommandCenter.
 */
import { supabase } from "@/integrations/supabase/client";

export type CadenceScope = "cohort" | "project";
export type CadenceHealth = "healthy" | "warning" | "at_risk";
export type CadenceSeverity = "info" | "warning" | "at_risk";

export type CadenceWarningCode =
  | "no_meeting_recorded_yet"
  | "no_meeting_this_week"
  | "no_meetings_2_weeks"
  | "tech_lead_absent_last_meeting"
  | "tech_lead_presence_unknown"
  | "no_attendance_recorded";

export interface CadenceWarning {
  code: CadenceWarningCode;
  severity: CadenceSeverity;
  message: string;
  action: string | null;
}

export interface CadenceSignal {
  scope: CadenceScope;
  target_id: string;
  health: CadenceHealth;
  weeks_without_meeting: number;
  last_meeting_at: string | null;
  next_meeting_at: string | null;
  tech_lead_present_last_meeting?: boolean | null;
  warnings: CadenceWarning[];
  viewer_role: "member" | "lead" | "admin";
}

export interface CadenceOverviewItem {
  id: string;
  name: string;
  health: CadenceHealth;
  top_warning: CadenceWarning | null;
}

export interface CadenceOverview {
  cohorts: CadenceOverviewItem[];
  projects: CadenceOverviewItem[];
  generated_at: string;
}

/** Severity rank for sort: lower = more urgent. */
export const SEVERITY_RANK: Record<CadenceSeverity, number> = {
  at_risk: 0,
  warning: 1,
  info: 2,
};

/** Doctrine: at most 2 warnings shown per surface, prioritized by severity. */
export function prioritizeWarnings(
  warnings: CadenceWarning[] | undefined,
  cap = 2,
): CadenceWarning[] {
  if (!warnings?.length) return [];
  return [...warnings]
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])
    .slice(0, cap);
}

export function healthLabel(h: CadenceHealth): string {
  switch (h) {
    case "healthy":
      return "Healthy cadence";
    case "warning":
      return "Cadence warning";
    case "at_risk":
      return "Cadence at risk";
  }
}

/** Safe RPC fetch — returns null on error or unauthorized. */
export async function fetchCadenceSignal(
  scope: CadenceScope,
  targetId: string,
): Promise<CadenceSignal | null> {
  if (!targetId) return null;
  const { data, error } = await supabase.rpc("cadence_signals" as any, {
    p_scope: scope,
    p_target_id: targetId,
  });
  if (error) {
    console.warn("cadence_signals failed", error.message);
    return null;
  }
  if (!data || (data as any).error) return null;
  return data as unknown as CadenceSignal;
}

export async function fetchCadenceOverview(): Promise<CadenceOverview | null> {
  const { data, error } = await supabase.rpc("cadence_overview" as any);
  if (error) {
    console.warn("cadence_overview failed", error.message);
    return null;
  }
  if (!data || (data as any).error) return null;
  return data as unknown as CadenceOverview;
}