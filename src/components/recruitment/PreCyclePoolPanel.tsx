import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Inbox, ArrowRightCircle, Archive } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

type PoolRow = {
  id: string;
  full_name: string;
  email: string;
  major: string | null;
  created_at: string;
  last_resubmitted_at: string | null;
  source: string | null;
};

type Summary = {
  cycle_id: string;
  promoted_count: number;
  skipped_duplicate_count: number;
  routed_count: number;
  reviewer_assigned_count: number;
  routing_unresolved_count: number;
};

export default function PreCyclePoolPanel({ isLead }: { isLead: boolean }) {
  const [rows, setRows] = useState<PoolRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeCycleId, setActiveCycleId] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const [confirmSelected, setConfirmSelected] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const [poolRes, cycleRes] = await Promise.all([
      supabase
        .from("applicants")
        .select("id,full_name,email,major,created_at,last_resubmitted_at,source")
        .eq("current_stage", "pre_cycle_pool")
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(500),
      supabase.rpc("get_active_application_cycle"),
    ]);
    setRows(((poolRes.data ?? []) as any) as PoolRow[]);
    const cycle = Array.isArray(cycleRes.data) ? (cycleRes.data as any)[0] : null;
    setActiveCycleId(cycle?.id ?? null);
    setSelected(new Set());
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggle = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };
  const toggleAll = () => {
    if (selected.size === rows.length) setSelected(new Set());
    else setSelected(new Set(rows.map((r) => r.id)));
  };

  const runPromotion = async (ids: string[] | null) => {
    if (!activeCycleId) {
      toast.error("No active recruitment cycle. Open a cycle first.");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("promote_pre_cycle_applicants", {
        _applicant_ids: ids,
        _cycle_id: null,
      });
      if (error) throw error;
      const s = data as unknown as Summary;
      toast.success(
        `Promoted ${s.promoted_count} · routed ${s.routed_count} · reviewer assigned ${s.reviewer_assigned_count}` +
          (s.routing_unresolved_count > 0 ? ` · ${s.routing_unresolved_count} need routing` : "") +
          (s.skipped_duplicate_count > 0 ? ` · ${s.skipped_duplicate_count} skipped` : "")
      );
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Promotion failed");
    } finally {
      setBusy(false);
      setConfirmAll(false);
      setConfirmSelected(false);
    }
  };

  const archiveOne = async (id: string) => {
    const { error } = await supabase
      .from("applicants")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Archived from pool");
    load();
  };

  if (!isLead) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Inbox className="h-4 w-4" /> Pre-cycle pool
              <Badge variant="secondary" className="ml-1 font-mono">{rows.length}</Badge>
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Applications collected outside an active cycle. No reviewers assigned. Promote into the
              active cycle to begin formal review.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={busy || selected.size === 0 || !activeCycleId}
              onClick={() => setConfirmSelected(true)}
            >
              <ArrowRightCircle className="mr-1 h-3.5 w-3.5" />
              Promote selected ({selected.size})
            </Button>
            <Button
              size="sm"
              disabled={busy || rows.length === 0 || !activeCycleId}
              onClick={() => setConfirmAll(true)}
            >
              Promote all
            </Button>
          </div>
        </div>
        {!activeCycleId && (
          <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
            No active cycle is open. Promotion requires an open recruitment cycle.
          </p>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center py-6 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading pool…
          </div>
        ) : rows.length === 0 ? (
          <p className="py-3 text-sm text-muted-foreground">No applicants in the pool.</p>
        ) : (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 px-3 py-1 text-[11px] text-muted-foreground">
              <Checkbox
                checked={selected.size > 0 && selected.size === rows.length}
                onCheckedChange={toggleAll}
                aria-label="Select all"
              />
              <span>Select all ({rows.length})</span>
            </div>
            {rows.map((r) => (
              <div key={r.id} className="flex items-center gap-3 rounded-lg border bg-card/50 px-3 py-2">
                <Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggle(r.id)} aria-label={`Select ${r.full_name}`} />
                <Link to={`/app/recruitment/c/${r.id}`} className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{r.full_name}</div>
                  <div className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-muted-foreground">
                    <span className="truncate">{r.email}</span>
                    {r.major && <span>· {r.major}</span>}
                    <span>· received {new Date(r.created_at).toLocaleDateString()}</span>
                    {r.last_resubmitted_at && <span>· resubmitted {new Date(r.last_resubmitted_at).toLocaleDateString()}</span>}
                  </div>
                </Link>
                <Button size="sm" variant="ghost" onClick={() => archiveOne(r.id)} title="Archive from pool">
                  <Archive className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <AlertDialog open={confirmAll} onOpenChange={setConfirmAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Promote all eligible pool applicants?</AlertDialogTitle>
            <AlertDialogDescription>
              This will move <strong>{rows.length}</strong> applicant{rows.length === 1 ? "" : "s"} from the
              pre-cycle pool into the active cycle, run cohort routing, and assign reviewers.
              Already-promoted applicants are skipped automatically.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => runPromotion(null)} disabled={busy}>
              {busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
              Promote all
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmSelected} onOpenChange={setConfirmSelected}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Promote selected applicants?</AlertDialogTitle>
            <AlertDialogDescription>
              This will promote <strong>{selected.size}</strong> selected applicant
              {selected.size === 1 ? "" : "s"} into the active cycle and assign reviewers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => runPromotion(Array.from(selected))} disabled={busy}>
              {busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
              Promote {selected.size}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
