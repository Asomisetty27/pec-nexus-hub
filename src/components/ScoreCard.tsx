import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TrendingUp, TrendingDown, Minus, Target, Sparkles, AlertTriangle, Info, Loader2 } from "lucide-react";
import {
  fetchScore,
  type ScorePayload,
  type ScoreScope,
  CONFIDENCE_LABEL,
  CONFIDENCE_TONE,
  scoreTone,
} from "@/lib/score";

type Props = {
  scope: ScoreScope;
  targetId: string;
  windowDays?: number;
  /** Compact variant — no component breakdown rows. */
  compact?: boolean;
  /** Hide the recommended action footer. */
  hideRecommendation?: boolean;
  /** Hide component breakdown even in non-compact mode (members view). */
  restricted?: boolean;
  className?: string;
};

export function ScoreCard({
  scope,
  targetId,
  windowDays = 14,
  compact = false,
  hideRecommendation = false,
  restricted = false,
  className,
}: Props) {
  const [data, setData] = useState<ScorePayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchScore(scope, targetId, windowDays).then((d) => {
      if (!cancelled) {
        setData(d);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [scope, targetId, windowDays]);

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center gap-2 py-6 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading score…
        </CardContent>
      </Card>
    );
  }
  if (!data) {
    return (
      <Card className={className}>
        <CardContent className="py-6 text-xs text-muted-foreground">Score unavailable.</CardContent>
      </Card>
    );
  }

  const insufficient = data.confidence === "insufficient";
  const TrendIcon = data.trend_delta > 0 ? TrendingUp : data.trend_delta < 0 ? TrendingDown : Minus;
  const trendTone =
    data.trend_delta > 0 ? "text-emerald-600 dark:text-emerald-400" :
    data.trend_delta < 0 ? "text-rose-600 dark:text-rose-400" :
    "text-muted-foreground";

  return (
    <Card className={className}>
      <CardContent className="space-y-3 p-4">
        {/* Header: score + confidence + trend */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <span className={`font-display text-3xl font-bold leading-none ${scoreTone(data.score, data.confidence)}`}>
                {insufficient ? "—" : data.score}
              </span>
              {!insufficient && <span className="text-xs text-muted-foreground">/ 100</span>}
              {!insufficient && data.trend_score !== null && (
                <span className={`inline-flex items-center gap-0.5 text-[11px] ${trendTone}`}>
                  <TrendIcon className="h-3 w-3" />
                  {data.trend_delta > 0 ? "+" : ""}{data.trend_delta}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
              {scope === "cohort" ? "Cohort score" : "Project score"} · {data.window_days}d window
            </p>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className={`shrink-0 text-[10px] ${CONFIDENCE_TONE[data.confidence]}`}>
                  {CONFIDENCE_LABEL[data.confidence]}
                </Badge>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">
                {insufficient
                  ? "Not enough signal yet — log meetings, deliverables, or training to start measuring."
                  : `Based on ${data.sufficient_components} components covering ${Math.round(data.weight_covered)} of 100 weight points.`}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Drivers */}
        {!insufficient && (data.top_positive_driver || data.top_negative_driver) && (
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="rounded-md border border-emerald-500/20 bg-emerald-500/[0.04] p-2">
              <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-emerald-700 dark:text-emerald-300 font-mono">
                <Sparkles className="h-3 w-3" /> Helping most
              </div>
              <div className="mt-0.5 truncate font-medium">
                {data.top_positive_driver?.lbl ?? "—"}
                {data.top_positive_driver?.pct != null && (
                  <span className="ml-1 text-muted-foreground font-mono">{data.top_positive_driver.pct}%</span>
                )}
              </div>
            </div>
            <div className="rounded-md border border-rose-500/20 bg-rose-500/[0.04] p-2">
              <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-rose-700 dark:text-rose-300 font-mono">
                <AlertTriangle className="h-3 w-3" /> Hurting most
              </div>
              <div className="mt-0.5 truncate font-medium">
                {data.top_negative_driver?.lbl ?? "—"}
                {data.top_negative_driver?.pct != null && (
                  <span className="ml-1 text-muted-foreground font-mono">{data.top_negative_driver.pct}%</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Component breakdown — leadership only */}
        {!compact && !restricted && (
          <div className="space-y-1.5">
            {data.components.map((c) => (
              <div key={c.key} className="space-y-0.5">
                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <span className="text-foreground">{c.label}</span>
                    <span className="text-[9px] text-muted-foreground font-mono">w{c.weight}</span>
                    {!c.sufficient && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="h-2.5 w-2.5 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs text-xs">
                            {c.detail?.note ?? "Insufficient sample — excluded from score."}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                  <span className={`font-mono ${c.sufficient ? "text-foreground" : "text-muted-foreground"}`}>
                    {c.pct != null && c.sufficient ? `${c.pct}%` : "—"}
                  </span>
                </div>
                <Progress value={c.pct ?? 0} className={`h-1 ${c.sufficient ? "" : "opacity-30"}`} />
              </div>
            ))}
          </div>
        )}

        {/* Recommended action */}
        {!hideRecommendation && (
          <div className="flex items-start gap-2 rounded-md border border-primary/20 bg-primary/[0.04] p-2">
            <Target className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">Next move</div>
              <div className="text-xs leading-snug">{data.recommended_action}</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
