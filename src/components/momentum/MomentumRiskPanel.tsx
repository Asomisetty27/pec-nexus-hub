import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, AlertTriangle, ChevronRight, RefreshCw, TrendingDown, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

type Row = {
  project_id: string;
  project_name: string;
  risk_score: number;
  risk_level: "healthy" | "watch" | "at_risk" | "stalled" | string;
  signals: any;
  computed_at: string;
};

const LEVEL_STYLE: Record<string, { bg: string; fg: string; label: string; ring: string }> = {
  stalled: { bg: "bg-destructive/10", fg: "text-destructive", label: "Stalled", ring: "ring-destructive/30" },
  at_risk: { bg: "bg-warning/10", fg: "text-warning", label: "At risk", ring: "ring-warning/30" },
  watch: { bg: "bg-accent/10", fg: "text-accent-foreground", label: "Watch", ring: "ring-accent/30" },
  healthy: { bg: "bg-success/10", fg: "text-success", label: "Healthy", ring: "ring-success/30" },
};

const SIGNAL_LABELS: Record<string, string> = {
  days_since_update: "days idle",
  overdue_deliverables: "overdue",
  blocked_stages: "blocked stages",
  open_help_requests: "open help",
  stale_pending_reviews: "stale reviews",
};

function topFactors(signals: any): { key: string; value: number }[] {
  if (!signals) return [];
  return Object.entries(signals)
    .map(([k, v]) => ({ key: k, value: Number(v) || 0 }))
    .filter(x => x.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 3);
}

/**
 * Show momentum risk for a set of projects (or all visible if cohortId omitted).
 * `mode="leadership"` filters to watch+ only; `mode="all"` shows everything.
 */
export function MomentumRiskPanel({
  projectIds,
  mode = "leadership",
  limit = 8,
  title = "Momentum Risk",
}: {
  projectIds?: string[] | null;
  mode?: "leadership" | "all";
  limit?: number;
  title?: string;
}) {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setLoading(true);
    // Pull projects in scope
    let pq = supabase.from("projects").select("id, name, status").eq("status", "active");
    if (projectIds && projectIds.length > 0) pq = pq.in("id", projectIds);
    const { data: projects } = await pq;
    const projIds = (projects || []).map((p: any) => p.id);
    if (projIds.length === 0) { setRows([]); setLoading(false); return; }

    // Pull latest momentum_signals per project
    const { data: sigs } = await supabase
      .from("momentum_signals")
      .select("project_id, risk_score, risk_level, signals, computed_at")
      .in("project_id", projIds)
      .order("computed_at", { ascending: false });

    const latest = new Map<string, any>();
    for (const s of sigs || []) if (!latest.has(s.project_id)) latest.set(s.project_id, s);

    const merged: Row[] = (projects || [])
      .map(p => {
        const s = latest.get((p as any).id);
        return s ? {
          project_id: (p as any).id,
          project_name: (p as any).name,
          risk_score: s.risk_score,
          risk_level: s.risk_level,
          signals: s.signals,
          computed_at: s.computed_at,
        } : null;
      })
      .filter(Boolean) as Row[];

    const filtered = mode === "leadership"
      ? merged.filter(r => r.risk_level !== "healthy")
      : merged;

    filtered.sort((a, b) => b.risk_score - a.risk_score);
    setRows(filtered.slice(0, limit));
    setLoading(false);
  };

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [JSON.stringify(projectIds), mode, limit]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      let pq = supabase.from("projects").select("id").eq("status", "active");
      if (projectIds && projectIds.length > 0) pq = pq.in("id", projectIds);
      const { data: projects } = await pq;
      await Promise.all((projects || []).map((p: any) => supabase.rpc("compute_momentum_risk", { _project_id: p.id })));
      await load();
      toast.success("Momentum scores recomputed");
    } catch (e: any) {
      toast.error(`Refresh failed: ${e.message || e}`);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <TrendingDown className="h-4 w-4 text-warning" />
          {title}
          {rows.length > 0 && <Badge variant="outline" className="text-[9px] font-mono">{rows.length}</Badge>}
        </CardTitle>
        <Button variant="ghost" size="sm" className="h-7 gap-1 text-[10px]" onClick={refresh} disabled={refreshing}>
          <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Scanning…" : "Recompute"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <p className="text-xs text-muted-foreground py-3">Loading momentum signals…</p>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center py-6 text-muted-foreground">
            <Activity className="h-8 w-8 opacity-30 mb-2" />
            <p className="text-xs">{mode === "leadership" ? "All projects healthy. 🎉" : "No projects scored yet — click Recompute."}</p>
          </div>
        ) : rows.map(r => {
          const s = LEVEL_STYLE[r.risk_level] || LEVEL_STYLE.watch;
          const factors = topFactors(r.signals);
          return (
            <button
              key={r.project_id}
              onClick={() => navigate(`/app/projects/${r.project_id}`)}
              className={`w-full text-left rounded-lg border p-3 hover:border-accent/40 hover:bg-muted/40 transition-all flex items-center gap-3 ring-1 ring-transparent hover:${s.ring}`}
            >
              <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${s.bg}`}>
                {r.risk_level === "stalled" ? <AlertTriangle className={`h-4 w-4 ${s.fg}`} /> : <Zap className={`h-4 w-4 ${s.fg}`} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium truncate">{r.project_name}</p>
                  <Badge className={`text-[9px] font-mono border-transparent ${s.bg} ${s.fg}`}>{s.label}</Badge>
                  <span className="text-[10px] font-mono text-muted-foreground">score {r.risk_score}</span>
                </div>
                {factors.length > 0 && (
                  <p className="text-[10px] text-muted-foreground mt-0.5 font-mono truncate">
                    {factors.map(f => `${f.value} ${SIGNAL_LABELS[f.key] || f.key}`).join(" · ")}
                  </p>
                )}
                <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                  Last scored {new Date(r.computed_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}

export default MomentumRiskPanel;