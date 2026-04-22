import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThumbsUp, ThumbsDown, MessageSquare, Loader2 } from "lucide-react";

interface SummaryRow {
  feature: string;
  total: number;
  positive: number;
  neutral: number;
  negative: number;
  positive_pct: number | null;
}

interface CommentRow {
  id: string;
  feature: string;
  rating: string;
  tag: string | null;
  comment: string | null;
  created_at: string;
}

/**
 * Lightweight feedback dashboard for admins.
 * Shows per-feature rollup + recent free-text comments.
 * Reads via RLS (admin-only).
 */
export default function FeedbackDashboard() {
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [recent, setRecent] = useState<CommentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [s, r] = await Promise.all([
        supabase.rpc("feedback_summary", { p_days: 30 }),
        supabase
          .from("feedback_events")
          .select("id, feature, rating, tag, comment, created_at")
          .not("comment", "is", null)
          .order("created_at", { ascending: false })
          .limit(25),
      ]);
      setSummary((s.data as SummaryRow[]) || []);
      setRecent((r.data as CommentRow[]) || []);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold mb-2">Feedback by feature · last 30 days</h2>
        {summary.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-xs text-muted-foreground">
            No feedback recorded yet.
          </CardContent></Card>
        ) : (
          <div className="space-y-2">
            {summary.map((row) => {
              const pct = row.positive_pct ?? 0;
              const tone =
                pct >= 70 ? "text-success" :
                pct >= 40 ? "text-warning" : "text-destructive";
              return (
                <Card key={row.feature}>
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium font-mono truncate">{row.feature}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">
                        {row.total} response{row.total === 1 ? "" : "s"}
                      </p>
                    </div>
                    <Badge variant="outline" className="gap-1 text-[10px]">
                      <ThumbsUp className="h-3 w-3" /> {row.positive}
                    </Badge>
                    <Badge variant="outline" className="gap-1 text-[10px]">
                      — {row.neutral}
                    </Badge>
                    <Badge variant="outline" className="gap-1 text-[10px]">
                      <ThumbsDown className="h-3 w-3" /> {row.negative}
                    </Badge>
                    <span className={`text-sm font-mono font-semibold w-12 text-right ${tone}`}>
                      {pct.toFixed(0)}%
                    </span>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-sm font-semibold mb-2 flex items-center gap-2">
          <MessageSquare className="h-3.5 w-3.5" /> Recent comments
        </h2>
        {recent.length === 0 ? (
          <p className="text-xs text-muted-foreground">No written comments yet.</p>
        ) : (
          <div className="space-y-2">
            {recent.map((c) => (
              <Card key={c.id}>
                <CardContent className="p-3 space-y-1">
                  <div className="flex items-center gap-2 text-[10px] font-mono">
                    <Badge variant="outline" className="text-[9px]">{c.feature}</Badge>
                    <Badge
                      variant="outline"
                      className={
                        c.rating === "positive" ? "text-success border-success/30 text-[9px]" :
                        c.rating === "negative" ? "text-destructive border-destructive/30 text-[9px]" :
                        "text-warning border-warning/30 text-[9px]"
                      }
                    >
                      {c.rating}
                    </Badge>
                    {c.tag && <span className="text-muted-foreground">tag: {c.tag}</span>}
                    <span className="text-muted-foreground ml-auto">
                      {new Date(c.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs">{c.comment}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}