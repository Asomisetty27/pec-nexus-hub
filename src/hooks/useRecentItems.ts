import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export interface RecentItem {
  id: string;
  item_type: string;
  item_id: string;
  label: string;
  link: string;
  visited_at: string;
  metadata: any;
}

export function useRecentItems(limit = 10) {
  const { user } = useAuth();
  const [items, setItems] = useState<RecentItem[]>([]);
  const [pinned, setPinned] = useState<RecentItem[]>([]);

  const refresh = useCallback(async () => {
    if (!user?.id) return;
    const [r, p] = await Promise.all([
      supabase.from("recent_items").select("*").eq("user_id", user.id)
        .order("visited_at", { ascending: false }).limit(limit),
      supabase.from("pinned_items").select("*").eq("user_id", user.id)
        .order("pinned_at", { ascending: false }),
    ]);
    setItems((r.data as any) || []);
    setPinned(((p.data as any) || []).map((x: any) => ({ ...x, visited_at: x.pinned_at })));
  }, [user?.id, limit]);

  useEffect(() => { void refresh(); }, [refresh]);

  const trackVisit = useCallback(async (item_type: string, item_id: string, label: string, link: string, metadata?: any) => {
    if (!user?.id) return;
    await supabase.rpc("track_recent_item", {
      p_item_type: item_type, p_item_id: item_id, p_label: label, p_link: link, p_metadata: metadata ?? null,
    });
  }, [user?.id]);

  const pinItem = useCallback(async (item_type: string, item_id: string, label: string, link: string) => {
    if (!user?.id) return;
    await supabase.from("pinned_items").insert({
      user_id: user.id, item_type, item_id, label, link,
    });
    void refresh();
  }, [user?.id, refresh]);

  const unpinItem = useCallback(async (id: string) => {
    await supabase.from("pinned_items").delete().eq("id", id);
    void refresh();
  }, [refresh]);

  return { items, pinned, trackVisit, pinItem, unpinItem, refresh };
}
