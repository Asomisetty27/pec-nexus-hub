import { useEffect, useMemo, useState } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { ApplicantCard, type ApplicantCardData } from "@/components/recruitment/ApplicantCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ALL_STAGES, STAGE_LABEL } from "@/lib/recruitment";
import type { RecruitmentCtx } from "./RecruitmentLayout";

type Cohort = { id: string; name: string };

const VIEWS = [
  { value: "all", label: "All visible" },
  { value: "mine", label: "Assigned to me" },
  { value: "needs_routing", label: "Needs routing" },
  { value: "unreviewed", label: "Unreviewed by me" },
];

export default function RecruitmentInbox() {
  const ctx = useOutletContext<RecruitmentCtx>();
  const [params, setParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ApplicantCardData[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set());

  const view = params.get("view") ?? "all";
  const stage = params.get("stage") ?? "any";
  const cohort = params.get("cohort") ?? "any";

  const setParam = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v === "" || v === "any") next.delete(k); else next.set(k, v);
    setParams(next, { replace: true });
  };

  useEffect(() => {
    document.title = "Recruitment inbox | PEC";
    (async () => {
      const { data: cohortRows } = await supabase.from("cohorts").select("id,name").order("name");
      setCohorts((cohortRows ?? []) as Cohort[]);

      const { data: myReviews } = await supabase
        .from("applicant_reviews")
        .select("applicant_id")
        .eq("reviewer_user_id", ctx.userId);
      setReviewedIds(new Set(((myReviews ?? []) as any[]).map((r) => r.applicant_id)));
    })();
  }, [ctx.userId]);

  useEffect(() => {
    setLoading(true);
    (async () => {
      const select =
        "id,full_name,email,major,current_stage,routing_resolved,primary_reviewer_user_id,routed_cohort_id,submitted_at,created_at";
      let q = supabase.from("applicants").select(select).order("created_at", { ascending: false }).limit(100);

      if (view === "mine") q = q.eq("primary_reviewer_user_id", ctx.userId);
      if (view === "needs_routing") q = q.eq("routing_resolved", false);
      if (stage !== "any") q = q.eq("current_stage", stage as any);
      if (cohort !== "any") q = q.eq("routed_cohort_id", cohort);

      const { data } = await q;
      let list = (data ?? []) as ApplicantCardData[];
      if (view === "unreviewed") {
        list = list.filter((a) => !reviewedIds.has(a.id));
      }
      setRows(list);
      setLoading(false);
    })();
  }, [view, stage, cohort, ctx.userId, reviewedIds]);

  const cohortNameById = useMemo(() => {
    const m = new Map<string, string>();
    cohorts.forEach((c) => m.set(c.id, c.name));
    return m;
  }, [cohorts]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={view} onValueChange={(v) => setParam("view", v)}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            {VIEWS.map((v) => <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={stage} onValueChange={(v) => setParam("stage", v)}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Any stage" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any stage</SelectItem>
            {ALL_STAGES.map((s) => <SelectItem key={s} value={s}>{STAGE_LABEL[s]}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={cohort} onValueChange={(v) => setParam("cohort", v)}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Any cohort" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any cohort</SelectItem>
            {cohorts.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <div className="ml-auto text-xs text-muted-foreground">{rows.length} result{rows.length === 1 ? "" : "s"}</div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-md border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
          No applicants match this view.
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {rows.map((a) => (
            <ApplicantCard
              key={a.id}
              applicant={a}
              cohortName={a.routed_cohort_id ? cohortNameById.get(a.routed_cohort_id) : undefined}
              highlight={a.primary_reviewer_user_id === ctx.userId}
            />
          ))}
        </div>
      )}
    </div>
  );
}