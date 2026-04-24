import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Search, UserCheck, UserX, Clock, ShieldCheck, MinusCircle, Users } from "lucide-react";
import { toast } from "sonner";

type Status = "present" | "absent" | "excused" | "late" | "unmarked";

const STATUS_META: Record<Status, { label: string; icon: any; className: string }> = {
  present:  { label: "Present", icon: UserCheck,    className: "bg-success/15 text-success border-success/30" },
  absent:   { label: "Absent",  icon: UserX,        className: "bg-destructive/15 text-destructive border-destructive/30" },
  excused:  { label: "Excused", icon: ShieldCheck,  className: "bg-muted text-muted-foreground border-border" },
  late:     { label: "Late",    icon: Clock,        className: "bg-warning/15 text-warning border-warning/30" },
  unmarked: { label: "—",       icon: MinusCircle,  className: "bg-muted/40 text-muted-foreground border-border" },
};

interface Row { user_id: string; full_name: string | null; status: Status; }

export function EventAttendanceDrawer({
  open, onOpenChange, eventId, eventTitle,
}: { open: boolean; onOpenChange: (v: boolean) => void; eventId: string; eventTitle: string }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    if (!open || !eventId) return;
    (async () => {
      setLoading(true);
      const [expRes, attRes] = await Promise.all([
        supabase.rpc("event_expected_attendees", { p_event_id: eventId }),
        supabase.from("event_attendance").select("user_id, status").eq("event_id", eventId),
      ]);
      if (expRes.error) { toast.error(`Attendees: ${expRes.error.message}`); setLoading(false); return; }
      const attMap = new Map<string, Status>();
      (attRes.data || []).forEach((r: any) => attMap.set(r.user_id, r.status as Status));
      const merged: Row[] = (expRes.data || [])
        .map((p: any) => ({ user_id: p.user_id, full_name: p.full_name, status: attMap.get(p.user_id) || "unmarked" }))
        .sort((a: Row, b: Row) => (a.full_name || "").localeCompare(b.full_name || ""));
      setRows(merged);
      setLoading(false);
    })();
  }, [open, eventId]);

  const counts = useMemo(() => {
    const c: Record<Status, number> = { present: 0, absent: 0, excused: 0, late: 0, unmarked: 0 };
    rows.forEach(r => { c[r.status]++; });
    return c;
  }, [rows]);

  const filtered = filter
    ? rows.filter(r => (r.full_name || "").toLowerCase().includes(filter.toLowerCase()))
    : rows;

  const setStatus = (userId: string, status: Status) => {
    setRows(prev => prev.map(r => r.user_id === userId ? { ...r, status } : r));
  };

  const bulkAll = (status: Status) => setRows(prev => prev.map(r => ({ ...r, status })));

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const payload = rows
      .filter(r => r.status !== "unmarked")
      .map(r => ({
        event_id: eventId, user_id: r.user_id, status: r.status,
        marked_by: user.id, marked_at: new Date().toISOString(),
      }));
    const toClear = rows.filter(r => r.status === "unmarked").map(r => r.user_id);

    const errs: string[] = [];
    if (payload.length > 0) {
      const { error } = await supabase.from("event_attendance").upsert(payload, { onConflict: "event_id,user_id" });
      if (error) errs.push(error.message);
    }
    if (toClear.length > 0) {
      const { error } = await supabase.from("event_attendance").delete().eq("event_id", eventId).in("user_id", toClear);
      if (error) errs.push(error.message);
    }
    setSaving(false);
    if (errs.length) toast.error(errs.join("; "));
    else toast.success(`Attendance saved (${payload.length} marked)`);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2"><Users className="h-4 w-4" /> Attendance</SheetTitle>
          <SheetDescription className="line-clamp-1">{eventTitle}</SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="flex-1 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : rows.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-sm text-muted-foreground">
            <Users className="h-10 w-10 mb-3 opacity-30" />
            No expected attendees for this audience.
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5 text-[10px] font-mono">
              {(["present","late","excused","absent","unmarked"] as Status[]).map(s => (
                <Badge key={s} variant="outline" className={STATUS_META[s].className}>{STATUS_META[s].label}: {counts[s]}</Badge>
              ))}
            </div>

            <div className="flex gap-2 items-center">
              <div className="relative flex-1">
                <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter by name…" className="h-8 pl-7 text-xs" />
              </div>
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => bulkAll("present")}>Mark all present</Button>
              <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => bulkAll("unmarked")}>Clear</Button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1 -mx-2 px-2">
              {filtered.map(r => {
                const meta = STATUS_META[r.status];
                const Icon = meta.icon;
                return (
                  <div key={r.user_id} className="flex items-center gap-2 rounded-md border border-border/60 bg-card px-2 py-1.5">
                    <Icon className={`h-3.5 w-3.5 ${r.status === "present" ? "text-success" : r.status === "absent" ? "text-destructive" : r.status === "late" ? "text-warning" : "text-muted-foreground"}`} />
                    <div className="flex-1 text-xs truncate">{r.full_name || r.user_id.slice(0,8)}</div>
                    <Select value={r.status} onValueChange={(v) => setStatus(r.user_id, v as Status)}>
                      <SelectTrigger className="h-7 w-28 text-[11px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(["present","late","excused","absent","unmarked"] as Status[]).map(s => (
                          <SelectItem key={s} value={s} className="text-xs">{STATUS_META[s].label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
            </div>

            <div className="border-t pt-3 flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button className="flex-1" onClick={save} disabled={saving}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save attendance"}
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
