/**
 * Leadership cadence overview — CommandCenter only.
 *
 * Shows aggregate cohort + project cadence health.
 * Compact list, severity-prioritized, capped at 2 visible "needs attention"
 * items per group (cohorts / projects).
 */
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  CadenceOverview,
  CadenceOverviewItem,
  fetchCadenceOverview,
  SEVERITY_RANK,
} from "@/lib/cadence";
import { cn } from "@/lib/utils";

function dot(h: CadenceOverviewItem["health"]) {
  if (h === "at_risk") return "bg-destructive";
  if (h === "warning") return "bg-amber-500";
  return "bg-emerald-500";
}

function rankItem(i: CadenceOverviewItem): number {
  if (i.health === "at_risk") return 0;
  if (i.health === "warning") return 1;
  return 2;
}

export function CadenceOverviewCard() {
  const [data, setData] = useState<CadenceOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchCadenceOverview().then((d) => {
      if (!active) return;
      setData(d);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4" /> Cadence Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const cohorts = [...data.cohorts].sort((a, b) => rankItem(a) - rankItem(b));
  const projects = [...data.projects].sort((a, b) => rankItem(a) - rankItem(b));

  const cohortIssues = cohorts.filter((c) => c.health !== "healthy").length;
  const projectIssues = projects.filter((p) => p.health !== "healthy").length;
  const totalIssues = cohortIssues + projectIssues;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Activity className="h-4 w-4" /> Cadence Overview
          </span>
          {totalIssues === 0 ? (
            <Badge variant="secondary" className="text-[10px]">
              <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-500" /> All healthy
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px]">
              <AlertTriangle className="h-3 w-3 mr-1 text-amber-500" />
              {totalIssues} need{totalIssues === 1 ? "s" : ""} attention
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Group title="Cohorts" items={cohorts.slice(0, 6)} />
        <Group title="Projects" items={projects.slice(0, 6)} />
      </CardContent>
    </Card>
  );
}

function Group({ title, items }: { title: string; items: CadenceOverviewItem[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">
        {title}
      </div>
      <ul className="space-y-1">
        {items.map((it) => (
          <li
            key={it.id}
            className="flex items-center justify-between gap-2 text-xs py-1 border-b border-border/40 last:border-0"
          >
            <span className="flex items-center gap-2 min-w-0">
              <span className={cn("h-2 w-2 rounded-full shrink-0", dot(it.health))} />
              <span className="truncate">{it.name}</span>
            </span>
            <span className="text-muted-foreground truncate max-w-[55%] text-right">
              {it.top_warning?.message ?? "On cadence"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default CadenceOverviewCard;