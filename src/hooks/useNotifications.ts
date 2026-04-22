import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export interface NotificationRow {
  id: string;
  user_id: string;
  title: string;
  body: string | null;
  link: string | null;
  category: string;
  priority: string;
  actor_id: string | null;
  target_type: string | null;
  target_id: string | null;
  read: boolean;
  escalated: boolean;
  created_at: string;
  metadata: any;
}

export function useNotifications(limit = 30) {
  const { user } = useAuth();
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit);
    setItems((data as any) || []);
    setLoading(false);
  }, [user?.id, limit]);

  useEffect(() => {
    if (!user?.id) { setItems([]); setLoading(false); return; }
    void fetchNotifications();
    const ch = supabase
      .channel(`notif-feed:${user.id}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => void fetchNotifications())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [user?.id, fetchNotifications]);

  const unreadCount = useMemo(() => items.filter(n => !n.read).length, [items]);

  const markRead = useCallback(async (ids?: string[]) => {
    await supabase.rpc("mark_notifications_read", { p_ids: ids ?? null });
    void fetchNotifications();
  }, [fetchNotifications]);

  return { items, unreadCount, loading, markRead, refresh: fetchNotifications };
}
