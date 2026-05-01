import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ApplicantCard, type ApplicantCardData } from "@/components/recruitment/ApplicantCard";
import { Loader2, Search, Tag as TagIcon, X } from "lucide-react";
import { ALL_STAGES, STAGE_LABEL } from "@/lib/recruitment";
import { toast } from "sonner";
import type { RecruitmentCtx } from "./RecruitmentLayout";

type Row = ApplicantCardData & {
  cycle_id: string | null;
  tags: string[] | null;
  archived_at: string | null;
  onboarding_state: string;
};

export default function RecruitmentTalent() {
  const ctx = useOutletContext<RecruitmentCtx>();
  const [rows, setRows] = useState<Row[]>([]);
  const [cohorts, setCohorts] = useState<{ id: string; name: string }[]>([]);
  const [cycles, setCycles] = useState<{ id: string; year: number; season: string }[]>([]);
  const [reviewers, setReviewers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [stage, setStage] = useState<string>("all");
  const [cohortId, setCohortId] = useState<string>("all");
  const [cycleId, setCycleId] = useState<string>("all");
  const [showArchived, setShowArchived] = useState(false);
  const [tagFilter, setTagFilter] = useState<string>("");
  const [tagDraft, setTagDraft] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    const [aRes, cRes, cyRes] = await Promise.all([
      supabase
        .from("applicants")
        .select("id,full_name,email,major,current_stage,routing_resolved,primary_reviewer_user_id,routed_cohort_id,submitted_at,created_at,cycle_id,tags,archived_at,onboarding_state")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase.from("cohorts").select("id,name"),
      supabase.from("application_cycles").select("id,year,season").order("year", { ascending: false }),
    ]);
    setRows(((aRes.data ?? []) as any) as Row[]);
    setCohorts((cRes.data ?? []) as any);
    setCycles((cyRes.data ?? []) as any);

    const reviewerIds = Array.from(new Set((aRes.data ?? []).map((r: any) => r.primary_reviewer_user_id).filter(Boolean)));
    if (reviewerIds.length) {
      const { data: profs } = await supabase.from("profiles").select("user_id, full_name").in("user_id", reviewerIds);
      const rmap: Record<string, string> = {};
      (profs ?? []).forEach((p: any) => { rmap[p.user_id] = p.full_name; });
      setReviewers(rmap);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const cohortName = (id: string | null) => (id ? cohorts.find((c) => c.id === id)?.name : undefined);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const t = tagFilter.trim().toLowerCase();
    return rows.filter((r) => {
      if (!showArchived && r.archived_at) return false;
      if (stage !== "all" && r.current_stage !== stage) return false;
      if (cohortId !== "all" && r.routed_cohort_id !== cohortId) return false;
      if (cycleId !== "all" && r.cycle_id !== cycleId) return false;
      if (t && !(r.tags ?? []).some((tag) => tag.toLowerCase().includes(t))) return false;
      if (q) {
        const hay = `${r.full_name} ${r.email} ${r.major ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, stage, cohortId, cycleId, showArchived, tagFilter]);

  const addTag = async (row: Row) => {
    if (!ctx.access.isLead) { toast.error("Recruitment lead only"); return; }
    const raw = (tagDraft[row.id] ?? "").trim();
    if (!raw) return;
    const next = Array.from(new Set([...(row.tags ?? []), raw]));
    const { error } = await supabase.from("applicants").update({ tags: next } as any).eq("id", row.id);
    if (error) { toast.error(error.message); return; }
    setTagDraft((d) => ({ ...d, [row.id]: "" }));
    setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, tags: next } : r)));
  };

  const removeTag = async (row: Row, tag: string) => {
    if (!ctx.access.isLead) return;
    const next = (row.tags ?? []).filter((t) => t !== tag);
    const { error } = await supabase.from("applicants").update({ tags: next } as any).eq("id", row.id);
    if (error) { toast.error(error.message); return; }
    setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, tags: next } : r)));
  };

  const toggleArchive = async (row: Row) => {
    if (!ctx.access.isLead) { toast.error("Recruitment lead only"); return; }
    const next = row.archived_at ? null : new Date().toISOString();
    const { error } = await supabase.from("applicants").update({ archived_at: next } as any).eq("id", row.id);
    if (error) { toast.error(error.message); return; }
    setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, archived_at: next } : r)));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading talent pool…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, major…" className="h-8 pl-7 text-sm" />
            </div>
            <Select value={cycleId} onValueChange={setCycleId}>
              <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue placeholder="Cycle" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All cycles</SelectItem>
                {cycles.map((c) => <SelectItem key={c.id} value={c.id}>{c.season} {c.year}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={stage} onValueChange={setStage}>
              <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue placeholder="Stage" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All stages</SelectItem>
                {ALL_STAGES.map((s) => <SelectItem key={s} value={s}>{STAGE_LABEL[s]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={cohortId} onValueChange={setCohortId}>
              <SelectTrigger className="h-8 w-[170px] text-xs"><SelectValue placeholder="Cohort" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All cohorts</SelectItem>
                {cohorts.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="relative w-[150px]">
              <TagIcon className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} placeholder="Tag" className="h-8 pl-7 text-xs" />
            </div>
            <Button size="sm" variant={showArchived ? "default" : "outline"} onClick={() => setShowArchived((v) => !v)}>
              {showArchived ? "Hiding archived" : "Show archived"}
            </Button>
            <div className="ml-auto text-xs text-muted-foreground font-mono">{filtered.length} of {rows.length}</div>
          </div>
        </CardContent>
      </Card>

      {filtered.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No applicants match these filters.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((r) => (
            <div key={r.id} className="space-y-1.5">
              <ApplicantCard
                applicant={r}
                cohortName={cohortName(r.routed_cohort_id)}
                reviewerName={r.primary_reviewer_user_id ? reviewers[r.primary_reviewer_user_id] : undefined}
              />
              <div className="flex flex-wrap items-center gap-1 px-1">
                {(r.tags ?? []).map((t) => (
                  <Badge key={t} variant="secondary" className="h-5 gap-1 px-1.5 text-[10px]">
                    {t}
                    {ctx.access.isLead && (
                      <button onClick={() => removeTag(r, t)} className="opacity-60 hover:opacity-100"><X className="h-2.5 w-2.5" /></button>
                    )}
                  </Badge>
                ))}
                {ctx.access.isLead && (
                  <>
                    <Input
                      value={tagDraft[r.id] ?? ""}
                      onChange={(e) => setTagDraft((d) => ({ ...d, [r.id]: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === "Enter") addTag(r); }}
                      placeholder="+ tag"
                      className="h-5 w-20 px-1.5 text-[10px]"
                    />
                    <button
                      onClick={() => toggleArchive(r)}
                      className="ml-auto text-[10px] text-muted-foreground hover:text-foreground"
                    >
                      {r.archived_at ? "Unarchive" : "Archive"}
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
