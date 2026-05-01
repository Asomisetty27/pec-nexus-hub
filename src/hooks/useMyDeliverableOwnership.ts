import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

/**
 * Centralized "what does the current user own?" resolver for deliverables.
 *
 * Returns:
 *   - userId   the current user id (or null)
 *   - groupIds project_group ids the user is a member of (across all projects)
 *   - ready    true once the lookup has completed at least once
 *
 * Use this everywhere we need to filter deliverables by "owned by me",
 * so individual + group ownership stay consistent.
 */
export function useMyDeliverableOwnership() {
  const { user } = useAuth();
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!user) { setGroupIds([]); setReady(true); return; }
    (async () => {
      const { data } = await supabase
        .from("project_group_members")
        .select("group_id")
        .eq("user_id", user.id);
      if (cancelled) return;
      setGroupIds(Array.from(new Set((data || []).map((r: any) => r.group_id))));
      setReady(true);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  return { userId: user?.id ?? null, groupIds, ready };
}

/**
 * Predicate: does this deliverable belong to the current user (individually
 * or via group membership)? Use after fetching with the broadened filter.
 */
export function isOwnedByMe(
  d: { owner_type?: string | null; owner_id?: string | null; owning_group_id?: string | null },
  userId: string | null,
  groupIds: string[],
): boolean {
  if (!userId) return false;
  if (d.owner_type === "group") {
    return !!d.owning_group_id && groupIds.includes(d.owning_group_id);
  }
  return d.owner_id === userId;
}