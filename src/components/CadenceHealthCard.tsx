/**
 * Compact cadence health card.
 *
 * - Single-row, non-blocking
 * - At most 2 warnings shown (severity-prioritized)
 * - Sparse-data states phrased honestly
 */
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Activity,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Info,
} from "lucide-react";
import {
  CadenceScope,
  CadenceSignal,
  fetchCadenceSignal,
  prioritizeWarnings,
  healthLabel,
} from "@/lib/cadence";
import { cn } from "@/lib/utils";

interface Props {
  scope: CadenceScope;
  targetId: string;
  className?: string;
  /** Optional compact mode for tight surfaces (CommandCenter list). */
  dense?: boolean;
}

function healthBadgeVariant(h: CadenceSignal["health"]) {
  switch (h) {
    case "healthy":
      return "secondary" as const;
    case "warning":
      return "outline" as const;
    case "at_risk":
      return "destructive" as const;
  }
}

function healthIcon(h: CadenceSignal["health"]) {
  switch (h) {
    case "healthy":
      return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    case "warning":
      return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    case "at_risk":
      return <AlertTriangle className="h-4 w-4 text-destructive" />;
  }
}

function severityIcon(sev: string) {
  if (sev === "at_risk") return <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />;
  if (sev === "warning") return <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />;
  return <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;
}

function formatRel(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = Date.now();
  const diffDays = Math.round((d.getTime() - now) / (1000 * 60 * 60 * 24));
  if (Math.abs(diffDays) < 1) return "today";
  if (diffDays > 0 && diffDays < 7) return `in ${diffDays}d`;
  if (diffDays < 0 && diffDays > -7) return `${Math.abs(diffDays)}d ago`;
  return d.toLocaleDateString();
}

export function CadenceHealthCard({ scope, targetId, className, dense }: Props) {
  const [signal, setSignal] = useState<CadenceSignal | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchCadenceSignal(scope, targetId).then((s) => {
      if (!active) return;
      setSignal(s);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [scope, targetId]);

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <Skeleton className="h-5 w-40 mb-2" />
          <Skeleton className="h-4 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!signal) {
    // Honest sparse-data fallback for unauthorized / missing scope
    return null;
  }

  const warnings = prioritizeWarnings(signal.warnings, 2);
  const last = formatRel(signal.last_meeting_at);
  const next = formatRel(signal.next_meeting_at);

  return (
    <Card className={cn("border-l-4", className,
      signal.health === "at_risk" && "border-l-destructive",
      signal.health === "warning" && "border-l-amber-500",
      signal.health === "healthy" && "border-l-emerald-500",
    )}>
      <CardContent className={cn(dense ? "p-3" : "p-4", "space-y-2")}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {healthIcon(signal.health)}
            <span className="text-sm font-medium truncate">
              {healthLabel(signal.health)}
            </span>
          </div>
          <Badge variant={healthBadgeVariant(signal.health)} className="text-[10px] uppercase tracking-wide">
            {signal.health.replace("_", " ")}
          </Badge>
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <CalendarClock className="h-3.5 w-3.5" />
            Last: {last}
          </span>
          <span className="flex items-center gap-1">
            <Activity className="h-3.5 w-3.5" />
            Next: {next}
          </span>
        </div>

        {warnings.length > 0 && (
          <ul className="space-y-1 pt-1">
            {warnings.map((w) => (
              <li key={w.code} className="flex items-start gap-2 text-xs">
                {severityIcon(w.severity)}
                <span className="flex-1">
                  <span className="text-foreground">{w.message}</span>
                  {w.action && (
                    <span className="text-muted-foreground"> · {w.action}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export default CadenceHealthCard;