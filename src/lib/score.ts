import { supabase } from "@/integrations/supabase/client";

export type ScoreScope = "cohort" | "project";
export type ScoreConfidence = "high" | "medium" | "low" | "insufficient";

export type ScoreComponent = {
  key: string;
  label: string;
  weight: number;
  pct: number | null;
  sufficient: boolean;
  detail: any;
};

export type ScoreDriver = {
  k: string;
  lbl: string;
  w: number;
  pct: number | null;
  ok: boolean;
  impact: number;
} | null;

export type ScorePayload = {
  scope: ScoreScope;
  target_id: string;
  window_days: number;
  window_start: string;
  window_end: string;
  score: number;
  trend_score: number | null;
  trend_delta: number;
  confidence: ScoreConfidence;
  components: ScoreComponent[];
  top_positive_driver: ScoreDriver;
  top_negative_driver: ScoreDriver;
  recommended_action: string;
  sufficient_components: number;
  weight_covered: number;
};

export async function fetchScore(
  scope: ScoreScope,
  targetId: string,
  windowDays = 14
): Promise<ScorePayload | null> {
  const { data, error } = await supabase.rpc("compute_score", {
    p_scope: scope,
    p_target_id: targetId,
    p_window_days: windowDays,
  });
  if (error || !data) return null;
  return data as unknown as ScorePayload;
}

export const CONFIDENCE_LABEL: Record<ScoreConfidence, string> = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence",
  insufficient: "Insufficient data",
};

export const CONFIDENCE_TONE: Record<ScoreConfidence, string> = {
  high: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  medium: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  low: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
  insufficient: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border-zinc-500/30",
};

export function scoreTone(score: number, confidence: ScoreConfidence): string {
  if (confidence === "insufficient") return "text-muted-foreground";
  if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 60) return "text-amber-600 dark:text-amber-400";
  return "text-rose-600 dark:text-rose-400";
}
