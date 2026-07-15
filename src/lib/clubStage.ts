// Club-stage tiering: the app shows a surface sized to how big the club
// actually is (progressive disclosure). A 2-person launch sees a lean set of
// tabs and controls; power features reveal automatically as the club grows
// into them. All the machinery stays in the code; stage only governs what is
// surfaced by default. Every page reads stage from one cached RPC.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ClubStage = "launch" | "growing" | "established";

export interface ClubStageInfo {
  stage: ClubStage;
  active_members: number;
  cohorts: number;
  active_projects: number;
  delivered_projects: number;
  clients: number;
}

const STAGE_ORDER: ClubStage[] = ["launch", "growing", "established"];

/** True when `current` is at or beyond the `min` stage. */
export function stageAtLeast(current: ClubStage, min: ClubStage): boolean {
  return STAGE_ORDER.indexOf(current) >= STAGE_ORDER.indexOf(min);
}

const FALLBACK: ClubStageInfo = {
  stage: "launch",
  active_members: 0,
  cohorts: 0,
  active_projects: 0,
  delivered_projects: 0,
  clients: 0,
};

/**
 * Current club stage plus the raw counts. Cached for 5 minutes since size
 * changes slowly. Falls back to "launch" (the leanest surface) while loading
 * or on error, so the UI never over-exposes on a transient failure.
 */
export function useClubStage() {
  const { data, isLoading } = useQuery({
    queryKey: ["club-stage"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<ClubStageInfo> => {
      const { data, error } = await supabase.rpc("get_club_stage");
      if (error || !data) return FALLBACK;
      return data as unknown as ClubStageInfo;
    },
  });
  const info = data ?? FALLBACK;
  return {
    ...info,
    isLoading,
    /** Does the club's current stage meet or exceed `min`? */
    atLeast: (min: ClubStage) => stageAtLeast(info.stage, min),
  };
}
