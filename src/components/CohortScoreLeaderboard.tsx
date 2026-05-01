import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, TrendingDown, Minus, Trophy } from "lucide-react";
import { fetchScore, type ScorePayload, CONFIDENCE_TONE, scoreTone } from "@/lib/score";

type Row = { id: string; name: string; score: ScorePayload | null };

export function CohortScoreLeaderboard() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: cohorts } = await supabase.from("cohorts").select("id,name").order("name");
      const results: Row[] = [];
      for (const c of cohorts ?? []) {
        const s = await fetchScore("cohort", c.id, 14);
        results.push({ id: c.id, name: c.name, score: s });
      }
      results.sort((a, b) => (b.score?.score ?? -1) - (a.score?.score ?? -1));
      setRows(results);
      setLoading(false);
    })();
  }, []);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Trophy className="h-3.5 w-3.5 text-accent-foreground" /> Cohort Score · 14d
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {loading ? (
          <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Computing…
          </div>
        ) : rows.length === 0 ? (
          <p className="py-3 text-xs text-muted-foreground">No cohorts.</p>
        ) : rows.map((r) => {
          const s = r.score;
          const insufficient = !s || s.confidence === "insufficient";
          const TrendIcon = !s ? Minus : s.trend_delta > 0 ? TrendingUp : s.trend_delta < 0 ? TrendingDown : Minus;
          const trendTone = !s ? "text-muted-foreground" :
            s.trend_delta > 0 ? "text-emerald-600 dark:text-emerald-400" :
            s.trend_delta < 0 ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground";
          return (
            <div key={r.id} className="flex items-center justify-between gap-2 rounded-md border bg-card/50 px-2.5 py-2">
              <div className="min-w-0 flex-1 truncate text-sm">{r.name}</div>
              <div className="flex shrink-0 items-center gap-2">
                {s && (
                  <Badge variant="outline" className={`text-[9px] ${CONFIDENCE_TONE[s.confidence]}`}>
                    {s.confidence}
                  </Badge>
                )}
                {!insufficient && s && (
                  <span className={`inline-flex items-center gap-0.5 text-[10px] font-mono ${trendTone}`}>
                    <TrendIcon className="h-2.5 w-2.5" />{s.trend_delta > 0 ? "+" : ""}{s.trend_delta}
                  </span>
                )}
                <span className={`font-display text-lg font-bold leading-none ${s ? scoreTone(s.score, s.confidence) : "text-muted-foreground"}`}>
                  {insufficient ? "—" : s!.score}
                </span>
              </div>
            </div>
          );
        })}
        {!loading && rows.some(r => r.score && r.score.recommended_action) && (
          <div className="mt-2 space-y-1 border-t pt-2">
            {rows.filter(r => r.score && r.score.confidence !== "insufficient")
                 .slice(0, 2)
                 .map(r => (
              <div key={`rec-${r.id}`} className="text-[10px] text-muted-foreground">
                <span className="font-medium text-foreground">{r.name}:</span> {r.score!.recommended_action}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
