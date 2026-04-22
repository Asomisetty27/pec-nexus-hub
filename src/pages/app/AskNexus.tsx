import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Sparkles, Search, AlertTriangle, Clock, Target, Rocket,
  HelpCircle, TrendingDown, FileCheck2, ChevronRight, Loader2, Inbox,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { SectionExplainer } from "@/components/ui/SectionExplainer";
import { FeedbackPrompt } from "@/components/FeedbackPrompt";

type AnswerRow = {
  primary: string;
  secondary?: string;
  meta?: string;
  href?: string;
  badge?: { label: string; tone?: "default" | "destructive" | "warning" | "accent" };
};

type Answer = {
  headline: string;
  rows: AnswerRow[];
  emptyText?: string;
};

type QueryDef = {
  key: string;
  icon: any;
  label: string;
  description: string;
  needsCohort?: boolean;
  run: (ctx: { cohortId?: string | null; allHandsAt?: string | null }) => Promise<Answer>;
};

const toneClass = (tone?: string) =>
  tone === "destructive" ? "bg-destructive/10 text-destructive border-destructive/30" :
  tone === "warning" ? "bg-warning/10 text-warning border-warning/30" :
  tone === "accent" ? "bg-accent/10 text-accent-foreground border-accent/30" :
  "bg-muted text-muted-foreground border-transparent";

const QUERIES: QueryDef[] = [
  {
    key: "blocking_cohort",
    icon: AlertTriangle,
    label: "What is blocking [cohort] right now?",
    description: "Blocked stages, overdue deliverables, and open help requests for the chosen cohort.",
    needsCohort: true,
    run: async ({ cohortId }) => {
      if (!cohortId) return { headline: "Pick a cohort.", rows: [] };
      const { data: members } = await supabase.from("cohort_memberships").select("user_id").eq("cohort_id", cohortId);
      const ids = (members || []).map((m: any) => m.user_id);
      const [overdue, help, blocked] = await Promise.all([
        ids.length === 0 ? { data: [] as any[] } : supabase.from("deliverables")
          .select("id, title, due_date, project_id, projects(name)")
          .in("owner_id", ids)
          .lt("due_date", new Date().toISOString().slice(0, 10))
          .neq("approval_status", "approved")
          .order("due_date").limit(10),
        supabase.from("help_requests").select("id, subject, created_at").eq("cohort_id", cohortId).eq("status", "open").order("created_at").limit(10),
        supabase.from("project_stages").select("id, title, project_id, projects(name)").eq("status", "blocked").limit(10),
      ]);
      const rows: AnswerRow[] = [];
      for (const d of (overdue.data as any[]) || []) {
        rows.push({
          primary: d.title,
          secondary: `Overdue · ${(d.projects as any)?.name || "Project"}`,
          meta: d.due_date ? `due ${new Date(d.due_date).toLocaleDateString()}` : undefined,
          href: `/app/projects/${d.project_id}`,
          badge: { label: "overdue", tone: "destructive" },
        });
      }
      for (const s of (blocked.data as any[]) || []) {
        rows.push({
          primary: s.title,
          secondary: `Blocked stage · ${(s.projects as any)?.name || "Project"}`,
          href: `/app/projects/${s.project_id}`,
          badge: { label: "blocked", tone: "warning" },
        });
      }
      for (const h of (help.data as any[]) || []) {
        rows.push({
          primary: h.subject,
          secondary: "Open help request",
          meta: new Date(h.created_at).toLocaleDateString(),
          href: `/app/lead`,
          badge: { label: "help", tone: "accent" },
        });
      }
      return {
        headline: rows.length === 0 ? "Nothing is blocking this cohort." : `${rows.length} blocker${rows.length === 1 ? "" : "s"} found.`,
        rows,
        emptyText: "No blockers. 🎉",
      };
    },
  },
  {
    key: "overdue_deliverables",
    icon: Clock,
    label: "Which deliverables are overdue?",
    description: "All overdue deliverables across projects you can see, sorted by how late they are.",
    run: async () => {
      const { data } = await supabase.from("deliverables")
        .select("id, title, due_date, project_id, projects(name), profiles:owner_id(full_name)")
        .lt("due_date", new Date().toISOString().slice(0, 10))
        .neq("approval_status", "approved")
        .order("due_date").limit(25);
      const rows: AnswerRow[] = ((data as any[]) || []).map(d => {
        const days = d.due_date ? Math.max(0, Math.floor((Date.now() - new Date(d.due_date).getTime()) / 86400000)) : 0;
        return {
          primary: d.title,
          secondary: `${(d.projects as any)?.name || "Project"} · ${(d.profiles as any)?.full_name || "Unassigned"}`,
          meta: days > 0 ? `${days}d late` : "due today",
          href: `/app/projects/${d.project_id}`,
          badge: { label: days > 7 ? "critical" : "overdue", tone: days > 7 ? "destructive" : "warning" },
        };
      });
      return { headline: rows.length === 0 ? "No overdue deliverables." : `${rows.length} overdue.`, rows, emptyText: "All caught up." };
    },
  },
  {
    key: "needs_advisor_review",
    icon: FileCheck2,
    label: "What needs advisor review?",
    description: "Pending deliverables, finance requests, and event requests awaiting advisor sign-off.",
    run: async () => {
      const [delvs, fin, evReq] = await Promise.all([
        supabase.from("deliverables")
          .select("id, title, project_id, updated_at, projects(name)")
          .eq("advisor_review_required", true)
          .eq("approval_status", "pending")
          .order("updated_at").limit(15),
        supabase.from("finance_requests").select("id, title, amount_cents, created_at").eq("status", "pending").order("created_at").limit(15),
        supabase.from("event_requests").select("id, title, event_date, created_at").eq("status", "pending").order("created_at").limit(15),
      ]);
      const rows: AnswerRow[] = [];
      for (const d of (delvs.data as any[]) || []) {
        rows.push({
          primary: d.title,
          secondary: `Deliverable · ${(d.projects as any)?.name || "Project"}`,
          meta: `waiting since ${new Date(d.updated_at).toLocaleDateString()}`,
          href: `/app/projects/${d.project_id}`,
          badge: { label: "deliverable", tone: "accent" },
        });
      }
      for (const f of (fin.data as any[]) || []) {
        rows.push({
          primary: f.title,
          secondary: f.amount_cents ? `Finance · $${(f.amount_cents / 100).toFixed(2)}` : "Finance request",
          meta: new Date(f.created_at).toLocaleDateString(),
          href: `/app/advisor`,
          badge: { label: "finance", tone: "warning" },
        });
      }
      for (const e of (evReq.data as any[]) || []) {
        rows.push({
          primary: e.title,
          secondary: "Event request",
          meta: e.event_date ? new Date(e.event_date).toLocaleDateString() : "no date",
          href: `/app/advisor`,
          badge: { label: "event", tone: "accent" },
        });
      }
      return { headline: rows.length === 0 ? "No advisor reviews pending." : `${rows.length} item${rows.length === 1 ? "" : "s"} waiting on the advisor.`, rows, emptyText: "Inbox zero." };
    },
  },
  {
    key: "projects_at_risk",
    icon: TrendingDown,
    label: "Which projects are at risk?",
    description: "Latest momentum scores — at_risk and stalled projects first.",
    run: async () => {
      const { data: sigs } = await supabase
        .from("momentum_signals")
        .select("project_id, risk_level, risk_score, signals, computed_at")
        .order("computed_at", { ascending: false });
      const latest = new Map<string, any>();
      for (const s of sigs || []) if (!latest.has(s.project_id)) latest.set(s.project_id, s);
      const arr = Array.from(latest.values()).filter((s: any) => s.risk_level !== "healthy")
        .sort((a: any, b: any) => b.risk_score - a.risk_score).slice(0, 15);
      const projIds = arr.map((s: any) => s.project_id);
      const { data: projs } = projIds.length === 0 ? { data: [] as any[] } : await supabase.from("projects").select("id, name").in("id", projIds);
      const nameMap = new Map<string, string>();
      for (const p of projs || []) nameMap.set((p as any).id, (p as any).name);
      const rows: AnswerRow[] = arr.map((s: any) => {
        const sig = s.signals || {};
        const factors = Object.entries(sig).filter(([_, v]) => Number(v) > 0)
          .sort((a: any, b: any) => Number(b[1]) - Number(a[1])).slice(0, 2)
          .map(([k, v]) => `${v} ${k.replace(/_/g, " ")}`).join(" · ");
        return {
          primary: nameMap.get(s.project_id) || "Project",
          secondary: factors || "No live signals",
          meta: `score ${s.risk_score}`,
          href: `/app/projects/${s.project_id}`,
          badge: { label: s.risk_level, tone: s.risk_level === "stalled" ? "destructive" : "warning" },
        };
      });
      return { headline: rows.length === 0 ? "No at-risk projects detected." : `${rows.length} project${rows.length === 1 ? "" : "s"} need attention.`, rows, emptyText: "All projects healthy." };
    },
  },
  {
    key: "untriaged_opportunities",
    icon: Rocket,
    label: "Which opportunities are untriaged?",
    description: "Opportunities still in intake, ranked by strategic value.",
    run: async () => {
      const { data } = await supabase.from("opportunities")
        .select("id, title, type, strategic_value, deadline, status")
        .eq("status", "intake")
        .order("strategic_value", { ascending: false }).limit(20);
      const rows: AnswerRow[] = ((data as any[]) || []).map(o => ({
        primary: o.title,
        secondary: `${o.type} · strategic value ${o.strategic_value ?? "—"}`,
        meta: o.deadline ? `deadline ${new Date(o.deadline).toLocaleDateString()}` : "no deadline",
        href: `/app/opportunities`,
        badge: { label: "intake", tone: "accent" },
      }));
      return { headline: rows.length === 0 ? "Pipeline is clear." : `${rows.length} untriaged opportunit${rows.length === 1 ? "y" : "ies"}.`, rows, emptyText: "Pipeline clear." };
    },
  },
  {
    key: "changed_since_all_hands",
    icon: Sparkles,
    label: "What changed since the last all-hands?",
    description: "Decisions, approvals, and announcements since the most recent all_hands event (or last 14 days).",
    run: async ({ allHandsAt }) => {
      let since = allHandsAt;
      if (!since) {
        const { data: ev } = await supabase.from("events")
          .select("start_time, title")
          .lt("start_time", new Date().toISOString())
          .order("start_time", { ascending: false }).limit(20);
        const lastAH = (ev || []).find((e: any) => /all.?hands/i.test(e.title || ""));
        since = lastAH?.start_time || new Date(Date.now() - 14 * 86400000).toISOString();
      }
      const [decRes, delRes, annRes] = await Promise.all([
        supabase.from("decisions").select("id, title, project_id, decided_at, category").gt("decided_at", since!).order("decided_at", { ascending: false }).limit(15),
        supabase.from("deliverables").select("id, title, project_id, approved_at").gt("approved_at", since!).order("approved_at", { ascending: false }).limit(15),
        supabase.from("announcements").select("id, title, created_at").gt("created_at", since!).order("created_at", { ascending: false }).limit(10),
      ]);
      const rows: AnswerRow[] = [];
      for (const a of (annRes.data as any[]) || []) {
        rows.push({ primary: a.title, secondary: "Announcement", meta: new Date(a.created_at).toLocaleDateString(), href: `/app/announcements`, badge: { label: "announce", tone: "accent" } });
      }
      for (const d of (decRes.data as any[]) || []) {
        rows.push({ primary: d.title, secondary: `Decision · ${d.category}`, meta: new Date(d.decided_at).toLocaleDateString(), href: `/app/projects/${d.project_id}`, badge: { label: "decision", tone: "default" } });
      }
      for (const d of (delRes.data as any[]) || []) {
        rows.push({ primary: d.title, secondary: "Deliverable approved", meta: d.approved_at ? new Date(d.approved_at).toLocaleDateString() : "", href: `/app/projects/${d.project_id}`, badge: { label: "approved", tone: "default" } });
      }
      return {
        headline: rows.length === 0 ? "No major changes." : `${rows.length} change${rows.length === 1 ? "" : "s"} since ${new Date(since!).toLocaleDateString()}.`,
        rows,
        emptyText: "No notable changes.",
      };
    },
  },
];

export default function AskNexus() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [filter, setFilter] = useState("");
  const [active, setActive] = useState<QueryDef | null>(null);
  const [cohortId, setCohortId] = useState<string>("");
  const [cohorts, setCohorts] = useState<any[]>([]);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<any[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void supabase.from("cohorts").select("id, name").order("name").then(({ data }) => setCohorts(data || []));
    if (user) {
      void supabase.from("ask_nexus_query_log")
        .select("query_key, created_at, result_count")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }).limit(5)
        .then(({ data }) => setRecent(data || []));
    }
  }, [user]);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const filtered = useMemo(() =>
    QUERIES.filter(q => q.label.toLowerCase().includes(filter.toLowerCase()) || q.description.toLowerCase().includes(filter.toLowerCase())),
    [filter]);

  const runQuery = async (q: QueryDef) => {
    const effectiveCohort = cohortId && cohortId !== "all" ? cohortId : null;
    if (q.needsCohort && !effectiveCohort) {
      setActive(q);
      setAnswer({ headline: "Pick a cohort to run this query.", rows: [] });
      return;
    }
    setActive(q);
    setLoading(true);
    setAnswer(null);
    try {
      const a = await q.run({ cohortId: effectiveCohort });
      setAnswer(a);
      if (user) {
        void supabase.from("ask_nexus_query_log").insert({ user_id: user.id, query_key: q.key, result_count: a.rows.length });
      }
    } catch (e: any) {
      setAnswer({ headline: `Query failed: ${e.message || e}`, rows: [] });
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-4xl">
      <div>
        <h1 className="font-display text-2xl font-bold flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-accent-foreground" /> Ask Nexus
        </h1>
        <SectionExplainer text="Operational answers from real Nexus data — not a chatbot. Pick a question, get an actionable list with deep links." className="mt-1" />
      </div>

      {/* Command bar */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              placeholder="Filter questions… (e.g. overdue, advisor, risk)"
              value={filter}
              onChange={e => setFilter(e.target.value)}
              className="border-0 shadow-none focus-visible:ring-0 px-0 text-sm"
            />
            <Select value={cohortId} onValueChange={setCohortId}>
              <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue placeholder="Cohort scope" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All cohorts</SelectItem>
                {cohorts.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            {filtered.map(q => {
              const Icon = q.icon;
              const isActive = active?.key === q.key;
              return (
                <button
                  key={q.key}
                  onClick={() => runQuery(q)}
                  className={`w-full text-left rounded-md border p-2.5 flex items-center gap-3 transition-all hover:border-accent/40 hover:bg-muted/40 ${isActive ? "border-accent/50 bg-muted/40" : ""}`}
                >
                  <div className="h-7 w-7 rounded-md bg-accent/10 flex items-center justify-center shrink-0">
                    <Icon className="h-3.5 w-3.5 text-accent-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{q.label}</p>
                    <p className="text-[11px] text-muted-foreground line-clamp-1">{q.description}</p>
                  </div>
                  {q.needsCohort && <Badge variant="outline" className="text-[9px] font-mono">cohort</Badge>}
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                </button>
              );
            })}
            {filtered.length === 0 && <p className="text-xs text-muted-foreground py-2 text-center">No matching questions.</p>}
          </div>
        </CardContent>
      </Card>

      {/* Answer surface */}
      {active && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="outline" className="text-[10px] font-mono">answer</Badge>
              <p className="text-sm font-medium">{active.label}</p>
            </div>
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
                <Loader2 className="h-4 w-4 animate-spin" /> Running query…
              </div>
            ) : answer ? (
              <>
                <p className="text-xs text-muted-foreground mb-3">{answer.headline}</p>
                {answer.rows.length === 0 ? (
                  <div className="flex flex-col items-center py-8 text-muted-foreground">
                    <Inbox className="h-8 w-8 opacity-30 mb-2" />
                    <p className="text-xs">{answer.emptyText || "Nothing to show."}</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {answer.rows.map((r, i) => (
                      <button
                        key={i}
                        onClick={() => r.href && navigate(r.href)}
                        disabled={!r.href}
                        className={`w-full text-left rounded-md border p-2.5 flex items-center gap-3 transition-all ${r.href ? "hover:border-accent/40 hover:bg-muted/40 cursor-pointer" : "cursor-default"}`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{r.primary}</p>
                          {r.secondary && <p className="text-[11px] text-muted-foreground truncate">{r.secondary}</p>}
                        </div>
                        {r.meta && <span className="text-[10px] font-mono text-muted-foreground shrink-0">{r.meta}</span>}
                        {r.badge && <Badge className={`text-[9px] font-mono border ${toneClass(r.badge.tone)}`}>{r.badge.label}</Badge>}
                        {r.href && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : null}
          </CardContent>
        </Card>
      )}

      {recent.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground mb-2">Your recent queries</p>
          <div className="flex flex-wrap gap-1.5">
            {recent.map((r, i) => {
              const q = QUERIES.find(x => x.key === r.query_key);
              if (!q) return null;
              return (
                <button key={i} onClick={() => runQuery(q)} className="rounded-full border px-2.5 py-1 text-[10px] font-mono hover:border-accent/40">
                  {q.label.slice(0, 38)}{q.label.length > 38 ? "…" : ""}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </motion.div>
  );
}