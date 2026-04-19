import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, RefreshCw, Ban, Upload, History, Loader2 } from "lucide-react";

interface Event {
  id: string;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  version: number | null;
  reason: string | null;
  created_at: string;
  actor_id: string;
  actor_name?: string;
}

const ICONS: Record<string, any> = {
  submitted: Upload,
  revised: RefreshCw,
  approved: CheckCircle2,
  revision_requested: RefreshCw,
  rejected: Ban,
  reopened: History,
};

const COLORS: Record<string, string> = {
  approved: "text-success",
  rejected: "text-destructive",
  revision_requested: "text-destructive",
  submitted: "text-muted-foreground",
  revised: "text-muted-foreground",
  reopened: "text-muted-foreground",
};

export default function DeliverableReviewHistory({ deliverableId }: { deliverableId: string }) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: evs } = await supabase
        .from("deliverable_review_events")
        .select("*")
        .eq("deliverable_id", deliverableId)
        .order("created_at", { ascending: false });
      if (cancelled) return;
      const actorIds = Array.from(new Set((evs || []).map((e: any) => e.actor_id).filter(Boolean)));
      let nameMap: Record<string, string> = {};
      if (actorIds.length) {
        const { data: profs } = await supabase.from("profiles").select("user_id, full_name").in("user_id", actorIds);
        nameMap = Object.fromEntries((profs || []).map((p: any) => [p.user_id, p.full_name]));
      }
      setEvents((evs || []).map((e: any) => ({ ...e, actor_name: nameMap[e.actor_id] || "Someone" })));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [deliverableId]);

  if (loading) return <div className="flex items-center gap-2 text-xs text-muted-foreground py-3"><Loader2 className="h-3 w-3 animate-spin" /> Loading history…</div>;
  if (events.length === 0) return <p className="text-xs text-muted-foreground py-3">No review history yet.</p>;

  return (
    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
      {events.map(e => {
        const Icon = ICONS[e.event_type] || History;
        return (
          <div key={e.id} className="flex gap-3 rounded-md border p-2.5">
            <Icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${COLORS[e.event_type] || "text-muted-foreground"}`} />
            <div className="flex-1 min-w-0 text-xs">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-medium capitalize">{e.event_type.replace("_", " ")}</span>
                {e.version != null && <Badge variant="outline" className="text-[9px] h-4">v{e.version}</Badge>}
                <span className="text-muted-foreground">· by {e.actor_name}</span>
                <span className="text-muted-foreground">· {new Date(e.created_at).toLocaleString()}</span>
              </div>
              {e.reason && <p className="text-muted-foreground mt-1 whitespace-pre-wrap">{e.reason}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
