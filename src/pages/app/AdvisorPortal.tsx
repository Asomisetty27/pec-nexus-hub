import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ShieldCheck, Inbox, CalendarDays, Wallet, Users, BookOpen,
  AlertTriangle, ExternalLink, ClipboardList, FileText, Megaphone,
  CheckCircle2, RotateCcw, MessageSquare, Pin, Plus, Lock,
} from "lucide-react";

import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const item = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.2 } } };

const RESOURCE_CATEGORIES: { key: string; label: string }[] = [
  { key: "club_support", label: "Club Support" },
  { key: "events", label: "Events" },
  { key: "finance", label: "Finance" },
  { key: "club_management", label: "Club Management" },
  { key: "advisor_guidance", label: "Advisor Guidance" },
  { key: "reporting_safety", label: "Reporting & Safety" },
];

function formatCurrency(cents?: number | null) {
  const n = (cents ?? 0) / 100;
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function statusTone(status: string): { label: string; cls: string } {
  switch (status) {
    case "approved":
    case "acknowledged":
      return { label: status === "approved" ? "Approved" : "Acknowledged", cls: "border-success/40 bg-success/10 text-success-foreground" };
    case "sent_back":
      return { label: "Sent back", cls: "border-warning/40 bg-warning/10 text-warning-foreground" };
    case "external_action_required":
      return { label: "External action", cls: "border-primary/40 bg-primary/10 text-primary" };
    case "closed":
      return { label: "Closed", cls: "border-muted-foreground/30 bg-muted text-muted-foreground" };
    default:
      return { label: "Pending", cls: "border-warning/40 bg-warning/10 text-warning-foreground" };
  }
}

export default function AdvisorPortal() {
  const { user, profile, isAdvisor, isAdmin } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [financeReqs, setFinanceReqs] = useState<any[]>([]);
  const [eventReqs, setEventReqs] = useState<any[]>([]);
  const [advisorDeliverables, setAdvisorDeliverables] = useState<any[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const [officers, setOfficers] = useState<any[]>([]);
  const [cohorts, setCohorts] = useState<any[]>([]);
  const [capacity, setCapacity] = useState<any[]>([]);
  const [recentDecisions, setRecentDecisions] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [resources, setResources] = useState<any[]>([]);
  const [activeMembers, setActiveMembers] = useState<number>(0);
  const [activeProjects, setActiveProjects] = useState<number>(0);

  // Advisor note dialog state
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteSubject, setNoteSubject] = useState("");
  const [noteBody, setNoteBody] = useState("");

  const canUse = isAdvisor || isAdmin;

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      const todayIso = new Date().toISOString();
      const [
        finRes, evRes, delRes, evtFix, rosterRes, cohRes, capRes,
        decRes, annRes, notesRes, resRes, memRes, projRes,
      ] = await Promise.all([
        supabase.from("finance_requests").select("*").order("created_at", { ascending: false }).limit(50),
        supabase.from("event_requests").select("*").order("event_date", { ascending: true }).limit(50),
        supabase.from("deliverables").select("id, title, project_id, due_date, approval_status, projects(name)").eq("advisor_review_required", true).limit(20),
        supabase.from("events").select("id, title, start_time, location, event_type").gte("start_time", todayIso).order("start_time", { ascending: true }).limit(8),
        supabase.from("cohort_roster").select("id, full_name, cohort_name, role, title, email").in("role", ["pm", "lead", "integration_lead"]).order("cohort_name", { ascending: true }),
        supabase.from("cohorts").select("id, name, description, color, icon"),
        supabase.from("capacity_allocations").select("cohort_id, purpose_pct, competition_pct, contract_pct, effective_date").order("effective_date", { ascending: false }),
        supabase.from("decisions").select("id, title, decided_at, rationale, project_id, projects(name)").order("decided_at", { ascending: false }).limit(5),
        supabase.from("announcements").select("id, title, body, created_at, pinned").order("pinned", { ascending: false }).order("created_at", { ascending: false }).limit(5),
        supabase.from("advisor_notes").select("*").order("pinned", { ascending: false }).order("updated_at", { ascending: false }),
        supabase.from("advisor_resources").select("*").order("category", { ascending: true }).order("display_order", { ascending: true }),
        supabase.from("profiles").select("user_id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("projects").select("id", { count: "exact", head: true }).eq("status", "active"),
      ]);
      setFinanceReqs(finRes.data || []);
      setEventReqs(evRes.data || []);
      setAdvisorDeliverables(delRes.data || []);
      setUpcomingEvents(evtFix.data || []);
      setOfficers(rosterRes.data || []);
      setCohorts(cohRes.data || []);
      // Latest capacity per cohort
      const latestPerCohort: Record<string, any> = {};
      (capRes.data || []).forEach((c: any) => {
        if (!latestPerCohort[c.cohort_id]) latestPerCohort[c.cohort_id] = c;
      });
      setCapacity(Object.values(latestPerCohort));
      setRecentDecisions(decRes.data || []);
      setAnnouncements(annRes.data || []);
      setNotes(notesRes.data || []);
      setResources(resRes.data || []);
      setActiveMembers(memRes.count || 0);
      setActiveProjects(projRes.count || 0);
      setLoading(false);
    };
    load();
  }, [user]);

  const pendingFinance = useMemo(() => financeReqs.filter(r => r.status === "pending"), [financeReqs]);
  const pendingEvents = useMemo(() => eventReqs.filter(r => r.status === "pending"), [eventReqs]);
  const pendingDeliverables = useMemo(
    () => advisorDeliverables.filter(d => d.approval_status !== "approved"),
    [advisorDeliverables]
  );
  const totalPending = pendingFinance.length + pendingEvents.length + pendingDeliverables.length;

  const officersByCohort = useMemo(() => {
    const map: Record<string, any[]> = {};
    officers.forEach(o => {
      const k = o.cohort_name || "Unassigned";
      (map[k] ||= []).push(o);
    });
    return map;
  }, [officers]);

  const cohortName = (id: string) => cohorts.find(c => c.id === id)?.name || "—";

  const refresh = async () => {
    const [fin, evr, del] = await Promise.all([
      supabase.from("finance_requests").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("event_requests").select("*").order("event_date", { ascending: true }).limit(50),
      supabase.from("deliverables").select("id, title, project_id, due_date, approval_status, projects(name)").eq("advisor_review_required", true).limit(20),
    ]);
    setFinanceReqs(fin.data || []);
    setEventReqs(evr.data || []);
    setAdvisorDeliverables(del.data || []);
  };

  const updateRequest = async (
    table: "finance_requests" | "event_requests",
    id: string,
    patch: Record<string, any>,
    successMsg: string,
  ) => {
    const { error } = await supabase
      .from(table)
      .update({ ...patch, reviewed_by: user?.id, reviewed_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(successMsg);
    refresh();
  };

  const createNote = async () => {
    if (!noteSubject.trim()) {
      toast.error("Subject is required");
      return;
    }
    const { error } = await supabase.from("advisor_notes").insert({
      author_id: user!.id,
      subject: noteSubject.trim(),
      body: noteBody.trim(),
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Note saved");
    setNoteOpen(false);
    setNoteSubject("");
    setNoteBody("");
    const { data } = await supabase
      .from("advisor_notes").select("*")
      .order("pinned", { ascending: false }).order("updated_at", { ascending: false });
    setNotes(data || []);
  };

  const deleteNote = async (id: string) => {
    const { error } = await supabase.from("advisor_notes").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setNotes(prev => prev.filter(n => n.id !== id));
  };

  if (!canUse) {
    return (
      <div className="mx-auto max-w-2xl py-16">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4" /> Advisor Portal
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>This portal is reserved for the PEC faculty advisor and admins.</p>
            <Button variant="outline" onClick={() => navigate("/app")}>Back to Mission Control</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <motion.div variants={item} className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            <ShieldCheck className="h-3 w-3" /> Advisor Portal
          </div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">
            Welcome, {profile?.full_name?.split(" ")[0] || "Advisor"}
          </h1>
          <p className="text-sm text-muted-foreground">
            High-signal oversight for PEC. Students run the club; you provide support, awareness, and final review where needed.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-[10px]">{activeMembers} active members</Badge>
          <Badge variant="outline" className="font-mono text-[10px]">{activeProjects} active projects</Badge>
        </div>
      </motion.div>

      {/* Status strip */}
      <motion.div variants={item} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatusCard icon={Inbox} label="Pending advisor items" value={totalPending} tone={totalPending > 0 ? "warning" : "ok"} />
        <StatusCard icon={CalendarDays} label="Upcoming events" value={upcomingEvents.length} tone="neutral" />
        <StatusCard icon={Wallet} label="Open finance requests" value={pendingFinance.length} tone={pendingFinance.length > 0 ? "warning" : "ok"} />
        <StatusCard icon={Users} label="Officers on roster" value={officers.length} tone="neutral" />
      </motion.div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex w-full flex-wrap gap-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="approvals">
            Approvals {totalPending > 0 && <span className="ml-1.5 rounded bg-warning/20 px-1.5 text-[10px] text-warning-foreground">{totalPending}</span>}
          </TabsTrigger>
          <TabsTrigger value="events">Events & Risk</TabsTrigger>
          <TabsTrigger value="finance">Finance</TabsTrigger>
          <TabsTrigger value="leadership">Leadership</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="reporting">Reporting</TabsTrigger>
          <TabsTrigger value="resources">Resources</TabsTrigger>
        </TabsList>

        {/* OVERVIEW */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm font-mono uppercase tracking-wider text-muted-foreground">
                  <Megaphone className="h-3.5 w-3.5" /> Recent announcements
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {announcements.length === 0 && <Empty>No announcements yet.</Empty>}
                {announcements.map(a => (
                  <div key={a.id} className="rounded-lg border border-border/50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-medium text-sm">{a.title}</h4>
                      {a.pinned && <Pin className="h-3 w-3 text-warning" />}
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{a.body}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm font-mono uppercase tracking-wider text-muted-foreground">
                  <ClipboardList className="h-3.5 w-3.5" /> Cohort capacity
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {capacity.length === 0 && <Empty>No capacity allocations recorded.</Empty>}
                {capacity.map(c => (
                  <div key={c.cohort_id} className="rounded-lg border border-border/50 p-3">
                    <div className="text-sm font-medium">{cohortName(c.cohort_id)}</div>
                    <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-muted">
                      <div className="bg-accent" style={{ width: `${c.purpose_pct}%` }} />
                      <div className="bg-warning" style={{ width: `${c.competition_pct}%` }} />
                      <div className="bg-primary" style={{ width: `${c.contract_pct}%` }} />
                    </div>
                    <div className="mt-1.5 flex justify-between text-[10px] font-mono text-muted-foreground">
                      <span>Purpose {c.purpose_pct}%</span>
                      <span>Comp {c.competition_pct}%</span>
                      <span>Contract {c.contract_pct}%</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-mono uppercase tracking-wider text-muted-foreground">
                <FileText className="h-3.5 w-3.5" /> Recent key decisions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {recentDecisions.length === 0 && <Empty>No decisions logged recently.</Empty>}
              {recentDecisions.map(d => (
                <div key={d.id} className="flex items-start gap-3 rounded-lg border border-border/50 p-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-sm font-medium">{d.title}</h4>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {new Date(d.decided_at).toLocaleDateString()}
                      </span>
                    </div>
                    {d.projects?.name && (
                      <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">{d.projects.name}</p>
                    )}
                    {d.rationale && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{d.rationale}</p>}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* APPROVALS */}
        <TabsContent value="approvals" className="space-y-4">
          <Honesty>
            Final university approvals (Cal Poly Now, ASI, etc.) happen in their own systems. This inbox tracks
            internal PEC awareness and signoff. Use the "External action required" status when a follow-up needs
            to happen outside Nexus.
          </Honesty>

          <SectionCard title="Deliverables flagged for advisor review" icon={FileText}>
            {pendingDeliverables.length === 0 && <Empty>Nothing awaiting your review.</Empty>}
            {pendingDeliverables.map(d => (
              <Row
                key={d.id}
                title={d.title}
                subtitle={d.projects?.name || "—"}
                meta={d.due_date ? `Due ${new Date(d.due_date).toLocaleDateString()}` : ""}
                statusBadge={<Badge variant="outline">{d.approval_status}</Badge>}
                actions={
                  <Button size="sm" variant="outline" onClick={() => navigate(`/app/projects/${d.project_id}`)}>
                    Open project
                  </Button>
                }
              />
            ))}
          </SectionCard>

          <SectionCard title="Finance requests" icon={Wallet}>
            {pendingFinance.length === 0 && <Empty>No pending finance requests.</Empty>}
            {pendingFinance.map(r => (
              <ApprovalRow
                key={r.id}
                req={r}
                amount={formatCurrency(r.amount_cents)}
                meta={[
                  r.request_type,
                  r.vendor || null,
                  r.needed_by ? `needed ${new Date(r.needed_by).toLocaleDateString()}` : null,
                ].filter(Boolean).join(" · ")}
                onApprove={(note) => updateRequest("finance_requests", r.id, { status: "approved", advisor_note: note }, "Marked approved")}
                onSendBack={(note) => updateRequest("finance_requests", r.id, { status: "sent_back", advisor_note: note }, "Sent back to requester")}
                onExternal={(note) => updateRequest("finance_requests", r.id, { status: "external_action_required", advisor_note: note }, "Flagged: external action required")}
              />
            ))}
          </SectionCard>

          <SectionCard title="Event requests" icon={CalendarDays}>
            {pendingEvents.length === 0 && <Empty>No pending event requests.</Empty>}
            {pendingEvents.map(r => (
              <ApprovalRow
                key={r.id}
                req={r}
                meta={[
                  r.event_date ? new Date(r.event_date).toLocaleString() : null,
                  r.location || null,
                  r.involves_food ? "food" : null,
                  r.involves_travel ? "travel" : null,
                  r.involves_minors ? "minors" : null,
                ].filter(Boolean).join(" · ")}
                onApprove={(note) => updateRequest("event_requests", r.id, { status: "acknowledged", advisor_note: note }, "Acknowledged")}
                onSendBack={(note) => updateRequest("event_requests", r.id, { status: "sent_back", advisor_note: note }, "Sent back to requester")}
                onExternal={(note) => updateRequest("event_requests", r.id, { status: "external_action_required", advisor_note: note }, "Flagged: external action required")}
              />
            ))}
          </SectionCard>
        </TabsContent>

        {/* EVENTS & RISK */}
        <TabsContent value="events" className="space-y-4">
          <Honesty>
            Some event processes (campus reservations, food permits, travel approvals) live in official Cal Poly
            workflows. The flags below help you ask the right follow-up questions.
          </Honesty>

          <SectionCard title="Upcoming events" icon={CalendarDays}>
            {upcomingEvents.length === 0 && <Empty>No upcoming events scheduled.</Empty>}
            {upcomingEvents.map(e => (
              <Row
                key={e.id}
                title={e.title}
                subtitle={e.location || "—"}
                meta={new Date(e.start_time).toLocaleString()}
                statusBadge={<Badge variant="outline" className="font-mono text-[10px]">{e.event_type}</Badge>}
              />
            ))}
          </SectionCard>

          <SectionCard title="Event requests with risk flags" icon={AlertTriangle}>
            {eventReqs.filter(r => r.involves_food || r.involves_travel || r.involves_minors).length === 0 && (
              <Empty>No event requests with risk flags right now.</Empty>
            )}
            {eventReqs.filter(r => r.involves_food || r.involves_travel || r.involves_minors).map(r => (
              <Row
                key={r.id}
                title={r.title}
                subtitle={[
                  r.involves_food && "food",
                  r.involves_travel && "travel",
                  r.involves_minors && "minors",
                ].filter(Boolean).join(" · ")}
                meta={r.event_date ? new Date(r.event_date).toLocaleDateString() : ""}
                statusBadge={<Badge variant="outline" className={statusTone(r.status).cls}>{statusTone(r.status).label}</Badge>}
              />
            ))}
          </SectionCard>
        </TabsContent>

        {/* FINANCE */}
        <TabsContent value="finance" className="space-y-4">
          <Honesty>
            Final payment processing happens through ASI Club Services. Nexus tracks intent, awareness, and
            internal status — it does not move money.
          </Honesty>
          <SectionCard title="All finance requests" icon={Wallet}>
            {financeReqs.length === 0 && <Empty>No finance requests yet.</Empty>}
            {financeReqs.map(r => (
              <Row
                key={r.id}
                title={r.title}
                subtitle={[r.request_type, r.vendor].filter(Boolean).join(" · ")}
                meta={`${formatCurrency(r.amount_cents)}${r.needed_by ? ` · need by ${new Date(r.needed_by).toLocaleDateString()}` : ""}`}
                statusBadge={<Badge variant="outline" className={statusTone(r.status).cls}>{statusTone(r.status).label}</Badge>}
              />
            ))}
          </SectionCard>
        </TabsContent>

        {/* LEADERSHIP */}
        <TabsContent value="leadership" className="space-y-4">
          <SectionCard title="Officer roster" icon={Users}>
            {officers.length === 0 && <Empty>No officers on roster yet.</Empty>}
            {Object.entries(officersByCohort).map(([cohort, list]) => (
              <div key={cohort} className="space-y-2">
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{cohort}</div>
                {list.map((o: any) => (
                  <div key={o.id} className="flex items-center justify-between rounded-md border border-border/40 px-3 py-2">
                    <div>
                      <div className="text-sm font-medium">{o.full_name}</div>
                      <div className="text-xs text-muted-foreground">{o.title || o.role}</div>
                    </div>
                    {o.email && <span className="font-mono text-[11px] text-muted-foreground">{o.email}</span>}
                  </div>
                ))}
              </div>
            ))}
          </SectionCard>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm font-mono uppercase tracking-wider text-muted-foreground">
                <MessageSquare className="h-3.5 w-3.5" /> Advisor notes
                <Badge variant="outline" className="ml-2 font-mono text-[9px]">private</Badge>
              </CardTitle>
              <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline"><Plus className="mr-1 h-3.5 w-3.5" /> New note</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>New advisor note</DialogTitle>
                    <DialogDescription>Visible only to advisors and admins. Use for continuity, follow-ups, or concerns.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label htmlFor="note-subject">Subject</Label>
                      <Input id="note-subject" value={noteSubject} onChange={e => setNoteSubject(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="note-body">Body</Label>
                      <Textarea id="note-body" rows={6} value={noteBody} onChange={e => setNoteBody(e.target.value)} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setNoteOpen(false)}>Cancel</Button>
                    <Button onClick={createNote}>Save note</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="space-y-2">
              {notes.length === 0 && <Empty>No notes yet. Use these for follow-ups, transition reminders, or concerns.</Empty>}
              {notes.map(n => (
                <div key={n.id} className="rounded-lg border border-border/40 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-medium">{n.subject}</h4>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {new Date(n.updated_at).toLocaleDateString()}
                      </span>
                      <Button size="sm" variant="ghost" onClick={() => deleteNote(n.id)}>Delete</Button>
                    </div>
                  </div>
                  {n.body && <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{n.body}</p>}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* COMPLIANCE */}
        <TabsContent value="compliance" className="space-y-4">
          <Honesty>
            Cal Poly's official requirements (advisor training, club re-registration, officer training) are tracked
            in their respective systems. Use this section as a checklist and jump-off point.
          </Honesty>
          <div className="grid gap-3 md:grid-cols-2">
            <ChecklistCard
              icon={ShieldCheck}
              title="Advisor training"
              description="Annual advisor training as required by Student Affairs."
              link={resources.find(r => r.category === "advisor_guidance")?.url}
            />
            <ChecklistCard
              icon={ClipboardList}
              title="Club re-registration"
              description="Annual recognition / re-registration through ASI Clubs."
              link={resources.find(r => r.category === "club_support")?.url}
            />
            <ChecklistCard
              icon={Users}
              title="Officer roster up to date"
              description={`${officers.length} officers currently listed in the roster.`}
            />
            <ChecklistCard
              icon={FileText}
              title="Bylaws & policy reminders"
              description="Review elections, transitions, and bylaw updates each spring."
              link={resources.find(r => r.category === "club_management")?.url}
            />
          </div>
        </TabsContent>

        {/* REPORTING */}
        <TabsContent value="reporting" className="space-y-4">
          <Honesty>
            This is a calm reference, not a substitute for official reporting. Use the official channels below to
            report concerns. Nothing entered into Nexus constitutes a university report.
          </Honesty>
          <div className="grid gap-3 md:grid-cols-2">
            {resources.filter(r => r.category === "reporting_safety").map(r => (
              <ResourceCard key={r.id} resource={r} />
            ))}
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground">Reminders</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>• As a faculty advisor you may be a Campus Security Authority (CSA) under the Clery Act.</p>
              <p>• Cal Poly employees are typically mandated reporters for Title IX–related concerns.</p>
              <p>• Equal Opportunity handles discrimination and harassment intake.</p>
              <p>• Use official channels — do not rely on Nexus for incident reporting.</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* RESOURCES */}
        <TabsContent value="resources" className="space-y-4">
          {RESOURCE_CATEGORIES.map(cat => {
            const items = resources.filter(r => r.category === cat.key);
            if (items.length === 0) return null;
            return (
              <SectionCard key={cat.key} title={cat.label} icon={BookOpen}>
                <div className="grid gap-3 md:grid-cols-2">
                  {items.map(r => <ResourceCard key={r.id} resource={r} />)}
                </div>
              </SectionCard>
            );
          })}
          <p className="text-[11px] text-muted-foreground">
            Links are seeded with official Cal Poly Clubs / ASI landing pages and can be edited by advisors and admins as official guidance evolves.
          </p>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}

/* ---------- helpers ---------- */

function StatusCard({ icon: Icon, label, value, tone }: { icon: any; label: string; value: number; tone: "ok" | "warning" | "neutral" }) {
  const toneCls =
    tone === "warning" ? "text-warning" :
    tone === "ok" ? "text-success" : "text-muted-foreground";
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
          <div className="mt-1 font-display text-2xl font-bold">{value}</div>
        </div>
        <Icon className={`h-5 w-5 ${toneCls}`} />
      </CardContent>
    </Card>
  );
}

function SectionCard({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-mono uppercase tracking-wider text-muted-foreground">
          <Icon className="h-3.5 w-3.5" /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">{children}</CardContent>
    </Card>
  );
}

function Row({ title, subtitle, meta, statusBadge, actions }: { title: string; subtitle?: string; meta?: string; statusBadge?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border/40 px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{title}</div>
        {subtitle && <div className="truncate text-xs text-muted-foreground">{subtitle}</div>}
        {meta && <div className="font-mono text-[10px] text-muted-foreground">{meta}</div>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {statusBadge}
        {actions}
      </div>
    </div>
  );
}

function ApprovalRow({
  req, amount, meta, onApprove, onSendBack, onExternal,
}: {
  req: any;
  amount?: string;
  meta?: string;
  onApprove: (note: string) => void;
  onSendBack: (note: string) => void;
  onExternal: (note: string) => void;
}) {
  const [noteOpen, setNoteOpen] = useState(false);
  const [mode, setMode] = useState<"sent_back" | "external_action_required">("sent_back");
  const [note, setNote] = useState("");

  const submitNote = () => {
    if (mode === "sent_back") onSendBack(note);
    else onExternal(note);
    setNote("");
    setNoteOpen(false);
  };

  return (
    <div className="rounded-md border border-border/40 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">{req.title}</div>
          {req.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{req.description}</p>}
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] font-mono text-muted-foreground">
            {amount && <span className="text-foreground">{amount}</span>}
            {meta && <span>{meta}</span>}
            <span>· submitted {new Date(req.created_at).toLocaleDateString()}</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => onApprove("")}>
            <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Approve
          </Button>
          <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="ghost" onClick={() => setMode("sent_back")}>
                <RotateCcw className="mr-1 h-3.5 w-3.5" /> Send back
              </Button>
            </DialogTrigger>
            <DialogTrigger asChild>
              <Button size="sm" variant="ghost" onClick={() => setMode("external_action_required")}>
                <ExternalLink className="mr-1 h-3.5 w-3.5" /> External action
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{mode === "sent_back" ? "Send back for revision" : "Flag external action required"}</DialogTitle>
                <DialogDescription>Add a short note for the requester. They will see this on their request.</DialogDescription>
              </DialogHeader>
              <Textarea rows={4} value={note} onChange={e => setNote(e.target.value)} placeholder="What needs to change, or what external step is needed?" />
              <DialogFooter>
                <Button variant="outline" onClick={() => setNoteOpen(false)}>Cancel</Button>
                <Button onClick={submitNote}>Submit</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}

function ResourceCard({ resource }: { resource: any }) {
  return (
    <a
      href={resource.url || "#"}
      target="_blank"
      rel="noreferrer noopener"
      className="group block rounded-lg border border-border/50 p-3 transition-colors hover:border-primary/50 hover:bg-muted/40"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-medium">{resource.title}</h4>
          {resource.description && <p className="mt-1 text-xs text-muted-foreground">{resource.description}</p>}
          {(resource.contact_email || resource.contact_phone) && (
            <p className="mt-1.5 font-mono text-[10px] text-muted-foreground">
              {[resource.contact_email, resource.contact_phone].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground transition-colors group-hover:text-primary" />
      </div>
    </a>
  );
}

function ChecklistCard({ icon: Icon, title, description, link }: { icon: any; title: string; description: string; link?: string }) {
  return (
    <div className="rounded-lg border border-border/50 p-4">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h4 className="text-sm font-medium">{title}</h4>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      {link && (
        <a
          href={link}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          Open official guidance <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-md border border-dashed border-border/50 p-3 text-xs text-muted-foreground">{children}</p>;
}

function Honesty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 p-3 text-xs text-muted-foreground">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
      <span>{children}</span>
    </div>
  );
}