import { useEffect, useMemo, useState } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ALL_STAGES, STAGE_LABEL, STAGE_TONE } from "@/lib/recruitment";
import { ApplicantCard, type ApplicantCardData } from "@/components/recruitment/ApplicantCard";
import { cn } from "@/lib/utils";
import type { RecruitmentCtx } from "./RecruitmentLayout";

type Cohort = { id: string; name: string };
type Cycle = { id: string; season: string; year: number };

export default function RecruitmentPipeline() {
  const ctx = useOutletContext<RecruitmentCtx>();
  const [params, setParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ApplicantCardData[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);

  const cohort = params.get("cohort") ?? "any";
  const cycle = params.get("cycle") ?? "any";

  const setParam = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v === "" || v === "any") next.delete(k); else next.set(k, v);
    setParams(next, { replace: true });
  };

  useEffect(() => {
    document.title = "Recruitment pipeline | PEC";
    (async () => {
      const [c1, c2] = await Promise.all([
        supabase.from("cohorts").select("id,name").order("name"),
        supabase.from("application_cycles").select("id,season,year").order("opens_at", { ascending: false }),
      ]);
      setCohorts(((c1.data ?? []) as Cohort[]));
      setCycles(((c2.data ?? []) as Cycle[]));
    })();
  }, []);

  useEffect(() => {
    setLoading(true);
    (async () => {
      const select =
        "id,full_name,email,major,current_stage,routing_resolved,primary_reviewer_user_id,routed_cohort_id,submitted_at,created_at";
      let q = supabase.from("applicants").select(select).order("created_at", { ascending: false }).limit(500);
      if (cohort !== "any") q = q.eq("routed_cohort_id", cohort);
      if (cycle !== "any") q = q.eq("cycle_id", cycle);
      const { data } = await q;
      setRows((data ?? []) as ApplicantCardData[]);
      setLoading(false);
    })();
  }, [cohort, cycle]);

  const cohortNameById = useMemo(() => {
    const m = new Map<string, string>();
    cohorts.forEach((c) => m.set(c.id, c.name));
    return m;
  }, [cohorts]);

  const grouped = useMemo(() => {
    const m = new Map<string, ApplicantCardData[]>();
    ALL_STAGES.forEach((s) => m.set(s, []));
    rows.forEach((r) => m.get(r.current_stage)?.push(r));
    return m;
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={cycle} onValueChange={(v) => setParam("cycle", v)}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Any cycle" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any cycle</SelectItem>
            {cycles.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.season} {c.year}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={cohort} onValueChange={(v) => setParam("cohort", v)}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Any cohort" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any cohort</SelectItem>
            {cohorts.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="ml-auto text-xs text-muted-foreground">{rows.length} applicant{rows.length === 1 ? "" : "s"}</div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-3" style={{ minWidth: "min-content" }}>
            {ALL_STAGES.map((s) => {
              const items = grouped.get(s) ?? [];
              return (
                <div key={s} className="flex w-72 shrink-0 flex-col">
                  <div className="mb-2 flex items-center justify-between">
                    <Badge variant="outline" className={cn("border-transparent", STAGE_TONE[s])}>
                      {STAGE_LABEL[s]}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{items.length}</span>
                  </div>
                  <Card className="flex-1 bg-muted/20">
                    <CardContent className="space-y-2 p-2">
                      {items.length === 0 ? (
                        <p className="px-2 py-4 text-center text-[11px] text-muted-foreground">Empty</p>
                      ) : items.map((a) => (
                        <ApplicantCard
                          key={a.id}
                          applicant={a}
                          cohortName={a.routed_cohort_id ? cohortNameById.get(a.routed_cohort_id) : undefined}
                          highlight={a.primary_reviewer_user_id === ctx.userId}
                        />
                      ))}
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}