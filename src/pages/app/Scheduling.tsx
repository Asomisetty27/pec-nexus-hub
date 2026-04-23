import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AvailabilityChips from "@/components/AvailabilityChips";
import SmartScheduleImport from "@/components/SmartScheduleImport";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import {
  CalendarDays, Clock, Plus, Trash2, Users, Zap, ChevronLeft, ChevronRight,
  CalendarRange, List, MapPin, Flag, Target, AlertCircle, Pencil, Link2,
  Sparkles, ArrowRight, UserCheck, UserX, Crown, X, Lightbulb, CheckCircle2, Repeat,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  addDays, addMonths, endOfMonth, endOfWeek, format, isSameDay, isSameMonth,
  isToday, startOfMonth, startOfWeek, subMonths, addWeeks, subWeeks,
} from "date-fns";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const item = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.2 } } };
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const HOURS = Array.from({ length: 14 }, (_, i) => i + 8);

// ---------- types ----------
type CalEvent = {
  id: string;
  source: "event" | "proposal" | "deadline" | "milestone";
  title: string;
  start: Date;
  end?: Date;
  category: string;
  location?: string;
  description?: string;
  link?: string;
  meta?: Record<string, any>;
};

const CATEGORY_STYLES: Record<string, { bg: string; dot: string; label: string }> = {
  meeting:        { bg: "bg-primary/10 text-primary border-primary/20",                 dot: "bg-primary",          label: "Meeting" },
  workshop:       { bg: "bg-accent/15 text-accent-foreground border-accent/30",         dot: "bg-accent",           label: "Workshop" },
  social:         { bg: "bg-secondary/15 text-secondary-foreground border-secondary/30",dot: "bg-secondary",        label: "Social" },
  presentation:   { bg: "bg-success/10 text-success border-success/20",                 dot: "bg-success",          label: "Presentation" },
  proposal:       { bg: "bg-warning/10 text-warning border-warning/20",                 dot: "bg-warning",          label: "Proposal" },
  deadline:       { bg: "bg-destructive/10 text-destructive border-destructive/20",     dot: "bg-destructive",      label: "Deadline" },
  milestone:      { bg: "bg-primary/10 text-primary border-primary/20",                 dot: "bg-primary",          label: "Milestone" },
  other:          { bg: "bg-muted text-muted-foreground border-border",                 dot: "bg-muted-foreground", label: "Other" },
};

const FILTERS = [
  { value: "all",      label: "All items" },
  { value: "meetings", label: "Meetings only" },
  { value: "events",   label: "Events only" },
  { value: "deadlines",label: "Deadlines only" },
  { value: "proposals",label: "Proposals only" },
] as const;

// ---------- main ----------
export default function Scheduling() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"calendar" | "availability">("calendar");

  // Availability state (kept from original)
  const [windows, setWindows] = useState<any[]>([]);
  const [cohortWindows, setCohortWindows] = useState<any[]>([]);
  const [proposals, setProposals] = useState<any[]>([]);
  const [cohort, setCohort] = useState<any>(null);
  const [addDialog, setAddDialog] = useState(false);
  const [newDay, setNewDay] = useState(1);
  const [newStart, setNewStart] = useState("10:00");
  const [newEnd, setNewEnd] = useState("12:00");
  const [newWeight, setNewWeight] = useState(3);

  // Calendar state
  const [view, setView] = useState<"month" | "week" | "agenda">("month");
  const [cursor, setCursor] = useState(new Date());
  const [filter, setFilter] = useState<typeof FILTERS[number]["value"]>("all");
  const [events, setEvents] = useState<any[]>([]);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [deliverables, setDeliverables] = useState<any[]>([]);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalEvent | null>(null);

  // v2 recommendations
  const [recDuration, setRecDuration] = useState(60);
  const [smartRecs, setSmartRecs] = useState<any[]>([]);
  const [memberNames, setMemberNames] = useState<Record<string, string>>({});
  const [loadingRecs, setLoadingRecs] = useState(false);
  // Passive vs Active mode: when planMode is on, show recommendations side panel
  const [planMode, setPlanMode] = useState(false);
  // Awareness layer
  const [hints, setHints] = useState<any[]>([]);
  const [pattern, setPattern] = useState<any>(null);
  const [pickedRec, setPickedRec] = useState<any>(null);

  const loadRecommendations = async (cohortId: string, durationMin: number) => {
    setLoadingRecs(true);
    const [recRes, hintRes, patRes] = await Promise.all([
      supabase.rpc("recommend_meeting_slots", {
        p_cohort_id: cohortId,
        p_duration_min: durationMin,
        p_attendee_ids: null,
        p_limit: 6,
      }),
      supabase.rpc("calendar_awareness_hints", { p_cohort_id: cohortId }),
      supabase.rpc("detect_cohort_meeting_pattern", { p_cohort_id: cohortId }),
    ]);
    if (!recRes.error) setSmartRecs((recRes.data as any[]) || []);
    if (!hintRes.error) setHints((hintRes.data as any[]) || []);
    if (!patRes.error) setPattern(((patRes.data as any[]) || [])[0] || null);
    setLoadingRecs(false);
  };

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [winRes, cohortRes, evRes, msRes, delRes] = await Promise.all([
        supabase.from("availability_windows").select("*").eq("user_id", user.id).order("day_of_week"),
        supabase.from("cohort_memberships").select("*, cohorts(*)").eq("user_id", user.id).limit(1).maybeSingle(),
        supabase.from("events").select("*").order("start_time"),
        supabase.from("milestones").select("id,title,due_date,project_id,status").not("due_date", "is", null),
        supabase.from("deliverables").select("id,title,due_date,project_id,required,approval_required,approval_status").not("due_date", "is", null),
      ]);
      setWindows((winRes.data as any[]) || []);
      setCohort(cohortRes.data);
      setEvents(evRes.data || []);
      setMilestones(msRes.data || []);
      setDeliverables(delRes.data || []);

      if (cohortRes.data?.cohort_id) {
        const memRes = await supabase.from("cohort_memberships").select("user_id").eq("cohort_id", cohortRes.data.cohort_id);
        const userIds = memRes.data?.map((m: any) => m.user_id) || [];
        const [cwRes, propRes] = await Promise.all([
          supabase.from("availability_windows").select("*, profiles:user_id(full_name)").in("user_id", userIds),
          supabase.from("meeting_proposals").select("*").eq("cohort_id", cohortRes.data.cohort_id).order("attendance_score", { ascending: false }),
        ]);
        setCohortWindows((cwRes.data as any[]) || []);
        setProposals((propRes.data as any[]) || []);

        // Build a quick id->name map for "missing" attendee chips
        if (userIds.length > 0) {
          const { data: nameRows } = await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds);
          const m: Record<string, string> = {};
          (nameRows || []).forEach((r: any) => { m[r.user_id] = r.full_name || "Unknown"; });
          setMemberNames(m);
        }

        await loadRecommendations(cohortRes.data.cohort_id, recDuration);
      }
    };
    load();
  }, [user]);

  // -------- compute calendar items --------
  const calItems: CalEvent[] = useMemo(() => {
    const items: CalEvent[] = [];
    events.forEach((e) => {
      items.push({
        id: `ev-${e.id}`, source: "event", title: e.title,
        start: new Date(e.start_time), end: e.end_time ? new Date(e.end_time) : undefined,
        category: e.event_type || "other", location: e.location, description: e.description,
        meta: e,
      });
    });
    proposals.forEach((p) => {
      items.push({
        id: `pr-${p.id}`, source: "proposal",
        title: `Proposed: ${p.duration_minutes}min meeting`,
        start: new Date(p.candidate_time), category: "proposal",
        description: p.explanation, meta: p,
      });
    });
    milestones.forEach((m) => {
      if (m.status === "completed") return;
      items.push({
        id: `ms-${m.id}`, source: "milestone", title: `Milestone: ${m.title}`,
        start: new Date(m.due_date), category: "milestone",
        link: `/app/projects/${m.project_id}`, meta: m,
      });
    });
    deliverables.forEach((d) => {
      if (d.approval_status === "approved") return;
      if (!d.required) return;
      items.push({
        id: `dl-${d.id}`, source: "deadline", title: d.title,
        start: new Date(d.due_date), category: "deadline",
        link: `/app/projects/${d.project_id}`, meta: d,
      });
    });

    if (filter === "meetings")   return items.filter(i => i.source === "event" && i.category === "meeting");
    if (filter === "events")     return items.filter(i => i.source === "event");
    if (filter === "deadlines")  return items.filter(i => i.source === "deadline" || i.source === "milestone");
    if (filter === "proposals")  return items.filter(i => i.source === "proposal");
    return items;
  }, [events, proposals, milestones, deliverables, filter]);

  const itemsByDay = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    calItems.forEach((it) => {
      const key = format(it.start, "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(it);
    });
    map.forEach((arr) => arr.sort((a, b) => a.start.getTime() - b.start.getTime()));
    return map;
  }, [calItems]);

  // -------- nav handlers --------
  const goPrev = () => setCursor(view === "month" ? subMonths(cursor, 1) : subWeeks(cursor, 1));
  const goNext = () => setCursor(view === "month" ? addMonths(cursor, 1) : addWeeks(cursor, 1));
  const goToday = () => { setCursor(new Date()); setSelectedDay(new Date()); };

  const isLeadOrPM = cohort?.role && ["pm", "lead", "integration_lead"].includes(cohort.role);

  // -------- availability helpers --------
  const addWindow = async () => {
    const { error } = await supabase.from("availability_windows").insert({
      user_id: user!.id, day_of_week: newDay, start_time: newStart, end_time: newEnd, preference_weight: newWeight,
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success("Availability added");
    setAddDialog(false);
    const { data } = await supabase.from("availability_windows").select("*").eq("user_id", user!.id).order("day_of_week");
    setWindows((data as any[]) || []);
  };
  const removeWindow = async (id: string) => {
    await supabase.from("availability_windows").delete().eq("id", id);
    setWindows(w => w.filter(x => x.id !== id));
    toast.success("Removed");
  };

  // recommendations (carried over)
  const heatmap = DAYS.map((_, dayIdx) =>
    HOURS.map(hour =>
      cohortWindows.filter(w =>
        w.day_of_week === dayIdx && parseInt(w.start_time) <= hour && parseInt(w.end_time) > hour
      ).length
    )
  );
  const maxCount = Math.max(1, ...heatmap.flat());
  const recommendations = DAYS.flatMap((dayName, dayIdx) =>
    HOURS.map(hour => {
      const available = cohortWindows.filter(w => w.day_of_week === dayIdx && parseInt(w.start_time) <= hour && parseInt(w.end_time) > hour);
      const totalMembers = cohort ? new Set(cohortWindows.map(w => w.user_id)).size : 1;
      const score = totalMembers > 0 ? Math.round((available.length / totalMembers) * 100) : 0;
      return { dayIdx, dayName, hour, score, conflicts: totalMembers - available.length, available: available.length, totalMembers };
    })
  ).filter(r => r.score > 50).sort((a, b) => b.score - a.score).slice(0, 3);

  const createProposal = async (rec: typeof recommendations[0]) => {
    const nextDate = getNextDate(rec.dayIdx, rec.hour);
    const { error } = await supabase.from("meeting_proposals").insert({
      proposed_by: user!.id, cohort_id: cohort!.cohort_id, candidate_time: nextDate.toISOString(),
      duration_minutes: 60, conflict_count: rec.conflicts, attendance_score: rec.score,
      explanation: `${rec.available}/${rec.totalMembers} members available. ${rec.dayName} ${rec.hour}:00 has ${rec.score}% attendance.`,
      status: "draft",
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success("Meeting proposal created");
  };

  // v2: create a proposal from a multi-factor recommendation
  const createSmartProposal = async (rec: any) => {
    const nextDate = getNextDate(rec.day_of_week, rec.start_hour);
    const { error } = await supabase.from("meeting_proposals").insert({
      proposed_by: user!.id, cohort_id: cohort!.cohort_id, candidate_time: nextDate.toISOString(),
      duration_minutes: rec.duration_min,
      conflict_count: rec.conflict_count, attendance_score: rec.attendance_pct,
      explanation: `${rec.available_count}/${rec.total_count} available · ${rec.lead_count} lead${rec.lead_count === 1 ? "" : "s"} · score ${rec.score}`,
      status: "draft",
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success("Meeting proposal created");
    const { data } = await supabase.from("meeting_proposals").select("*").eq("cohort_id", cohort!.cohort_id).order("attendance_score", { ascending: false });
    setProposals((data as any[]) || []);
  };

  // Compute a rank label for the top 3 recs (best overall / lowest conflict / best for leads)
  const labeledRecs = useMemo(() => {
    if (smartRecs.length === 0) return [];
    // Compute confidence per rec from data completeness + lead coverage
    const arr = smartRecs.map((r) => {
      const dataPct = r.total_count > 0 ? r.available_count / r.total_count : 0;
      const matchesPattern = pattern &&
        r.day_of_week === pattern.day_of_week &&
        r.start_hour === pattern.start_hour;
      let confidence: "high" | "medium" | "low" = "low";
      if (dataPct >= 0.8 && r.total_count >= 3) confidence = "high";
      else if (dataPct >= 0.6 && r.total_count >= 2) confidence = "medium";
      if (matchesPattern && pattern?.stability === "strong") confidence = "high";
      return { ...r, confidence, matches_pattern: !!matchesPattern };
    });
    // Float pattern-matching rec to the top
    arr.sort((a, b) => {
      if (a.matches_pattern && !b.matches_pattern) return -1;
      if (!a.matches_pattern && b.matches_pattern) return 1;
      return (b.score ?? 0) - (a.score ?? 0);
    });
    if (arr[0]) {
      arr[0].rank_label = arr[0].matches_pattern ? "Your usual cadence" : "Best overall";
    }
    const lowest = [...arr].sort((a, b) => a.conflict_count - b.conflict_count)[0];
    if (lowest && lowest !== arr[0]) lowest.rank_label = "Lowest conflict";
    const bestLead = [...arr].sort((a, b) => b.lead_count - a.lead_count || b.score - a.score)[0];
    if (bestLead && !bestLead.rank_label) bestLead.rank_label = "Best lead coverage";
    return arr;
  }, [smartRecs, pattern]);

  // -------- header --------
  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-5 max-w-6xl">
      <motion.div variants={item} className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-bold">Calendar & Scheduling</h1>
          <p className="text-xs text-muted-foreground font-mono">Your operational calendar — meetings, deadlines, proposals</p>
        </div>
      </motion.div>

      <Tabs value={tab} onValueChange={(v: any) => setTab(v)}>
        <TabsList>
          <TabsTrigger value="calendar" className="gap-1.5"><CalendarRange className="h-3.5 w-3.5" /> Calendar</TabsTrigger>
          <TabsTrigger value="availability" className="gap-1.5"><Clock className="h-3.5 w-3.5" /> Availability</TabsTrigger>
        </TabsList>

        {/* ============= CALENDAR ============= */}
        <TabsContent value="calendar" className="mt-4 space-y-4">
          {/* Awareness hints (passive mode) */}
          {!planMode && hints.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {hints.slice(0, 3).map((h, i) => {
                const tone = h.tone === "warning"
                  ? "border-warning/30 bg-warning/5 text-warning"
                  : h.tone === "positive"
                  ? "border-success/30 bg-success/5 text-success"
                  : "border-border bg-muted/30 text-muted-foreground";
                const Icon = h.hint_type === "usual_slot" ? Repeat
                  : h.hint_type === "high_conflict" ? AlertCircle
                  : h.hint_type === "no_meeting_this_week" ? Lightbulb
                  : Lightbulb;
                return (
                  <button
                    key={i}
                    onClick={() => isLeadOrPM && setPlanMode(true)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] ${tone} ${isLeadOrPM ? "hover:opacity-80 cursor-pointer" : "cursor-default"}`}
                    title={isLeadOrPM ? "Open Plan a meeting" : undefined}
                  >
                    <Icon className="h-3 w-3" />
                    <span>{h.message}</span>
                  </button>
                );
              })}
            </div>
          )}

          <div className={`grid gap-4 ${planMode && isLeadOrPM ? "lg:grid-cols-[1fr_320px]" : "grid-cols-1"}`}>
          <div className="space-y-4 min-w-0">
          <Card>
            <CardHeader className="py-3 px-5 flex flex-row items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={goPrev}><ChevronLeft className="h-4 w-4" /></Button>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={goToday}>Today</Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={goNext}><ChevronRight className="h-4 w-4" /></Button>
                <CardTitle className="text-base font-display ml-2">
                  {view === "month" && format(cursor, "MMMM yyyy")}
                  {view === "week" && `${format(startOfWeek(cursor), "MMM d")} – ${format(endOfWeek(cursor), "MMM d, yyyy")}`}
                  {view === "agenda" && "Upcoming"}
                </CardTitle>
              </div>
              <div className="flex items-center gap-2">
                {isLeadOrPM && (
                  <Button
                    variant={planMode ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-xs gap-1.5"
                    onClick={() => setPlanMode(p => !p)}
                  >
                    <Sparkles className="h-3 w-3" />
                    {planMode ? "Browsing" : "Plan a meeting"}
                  </Button>
                )}
                <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
                  <SelectTrigger className="h-7 w-[140px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FILTERS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <div className="flex rounded-md border bg-muted/30 p-0.5">
                  {(["month", "week", "agenda"] as const).map(v => (
                    <Button key={v} variant={view === v ? "default" : "ghost"} size="sm"
                      className="h-6 px-2 text-[11px] capitalize" onClick={() => setView(v)}>
                      {v === "agenda" ? <List className="h-3 w-3 mr-1" /> : null}{v}
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-3 pb-4 pt-0">
              {view === "month" && (
                <MonthGrid cursor={cursor} itemsByDay={itemsByDay} onDayClick={setSelectedDay} onEventClick={setSelectedEvent} />
              )}
              {view === "week" && (
                <WeekGrid cursor={cursor} itemsByDay={itemsByDay} onEventClick={setSelectedEvent} />
              )}
              {view === "agenda" && (
                <AgendaList items={calItems} onEventClick={setSelectedEvent} />
              )}
            </CardContent>
          </Card>

          {/* Legend */}
          <div className="flex items-center gap-3 flex-wrap text-[11px] text-muted-foreground px-1">
            {Object.entries(CATEGORY_STYLES).slice(0, 7).map(([k, s]) => (
              <span key={k} className="inline-flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${s.dot}`} />{s.label}
              </span>
            ))}
          </div>
          </div>

          {/* Plan-mode side panel: recommendations (active mode only) */}
          {planMode && isLeadOrPM && (
            <aside className="space-y-3">
              <Card className="border-accent/30 bg-accent/[0.03] sticky top-4">
                <CardHeader className="py-2.5 px-4 flex flex-row items-center justify-between">
                  <CardTitle className="text-xs font-sans font-semibold flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-accent-foreground" />
                    Smart meeting times
                  </CardTitle>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setPlanMode(false)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </CardHeader>
                <CardContent className="px-4 pb-3 pt-0 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-mono text-muted-foreground">Duration</span>
                    <Select value={String(recDuration)} onValueChange={async (v) => {
                      const d = parseInt(v);
                      setRecDuration(d);
                      if (cohort?.cohort_id) await loadRecommendations(cohort.cohort_id, d);
                    }}>
                      <SelectTrigger className="h-6 w-[96px] text-[10px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="30">30 min</SelectItem>
                        <SelectItem value="60">60 min</SelectItem>
                        <SelectItem value="90">90 min</SelectItem>
                        <SelectItem value="120">2 hours</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {labeledRecs.length > 0 ? (
                    <div className="space-y-1.5">
                      {labeledRecs.slice(0, 4).map((rec, i) => (
                        <SmartRecRow
                          key={i}
                          rec={rec}
                          memberNames={memberNames}
                          onPropose={async () => { await createSmartProposal(rec); setPickedRec(rec); }}
                        />
                      ))}
                      <p className="text-[9px] font-mono text-muted-foreground pt-1">
                        Ranked by attendance · lead coverage · preference{pattern?.stability === "strong" ? " · pattern-aware" : ""}
                      </p>
                    </div>
                  ) : (
                    <div className="py-3 text-center space-y-2">
                      <AlertCircle className="h-4 w-4 text-muted-foreground/60 mx-auto" />
                      <p className="text-[11px] text-muted-foreground">
                        Not enough availability yet. Ask your team to upload schedules.
                      </p>
                      <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1.5" onClick={() => setTab("availability")}>
                        <ArrowRight className="h-3 w-3" /> Set availability
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Decision feedback after picking a slot */}
              {pickedRec && (
                <Card className="border-success/30 bg-success/5">
                  <CardHeader className="py-2.5 px-4 flex flex-row items-center justify-between">
                    <CardTitle className="text-xs font-sans font-semibold flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                      Good choice
                    </CardTitle>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setPickedRec(null)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </CardHeader>
                  <CardContent className="px-4 pb-3 pt-0 space-y-1.5">
                    <p className="text-[11px]">
                      <span className="font-medium">{pickedRec.available_count}/{pickedRec.total_count}</span> available
                      {pickedRec.lead_count > 0 && <> · includes {pickedRec.lead_count} lead{pickedRec.lead_count === 1 ? "" : "s"}</>}
                      {pickedRec.matches_pattern && <> · matches your usual cadence</>}
                    </p>
                    {pickedRec.conflict_count > 0 && (
                      <p className="text-[10px] text-muted-foreground">
                        Tradeoff: {pickedRec.conflict_count} member{pickedRec.conflict_count === 1 ? "" : "s"} unavailable
                        {(() => {
                          const missing = (pickedRec.missing_user_ids || []).map((id: string) => memberNames[id]).filter(Boolean);
                          return missing.length > 0 ? ` (${missing.slice(0, 3).join(", ")}${missing.length > 3 ? "…" : ""})` : "";
                        })()}
                      </p>
                    )}
                    <p className="text-[10px] text-muted-foreground font-mono pt-1">Proposal created. Members will see it on their dashboard.</p>
                  </CardContent>
                </Card>
              )}

              {/* Active proposals (merged from Proposals tab) */}
              {proposals.length > 0 && (
                <Card>
                  <CardHeader className="py-2.5 px-4">
                    <CardTitle className="text-xs font-sans font-semibold flex items-center gap-2">
                      <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                      Active proposals
                      <Badge variant="outline" className="ml-1 h-4 min-w-4 px-1 text-[9px]">{proposals.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-3 pt-0 space-y-1.5">
                    {proposals.slice(0, 4).map((p) => (
                      <div key={p.id} className="rounded-md border p-2 text-[11px] space-y-0.5">
                        <p className="font-medium leading-tight">{format(new Date(p.candidate_time), "EEE MMM d 'at' h:mm a")}</p>
                        <p className="text-[10px] text-muted-foreground font-mono leading-tight">{p.explanation}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </aside>
          )}
          </div>
        </TabsContent>

        {/* ============= AVAILABILITY ============= */}
        <TabsContent value="availability" className="mt-4 space-y-5">
          <div className="rounded-lg border border-accent/30 bg-accent/5 p-4 space-y-1">
            <p className="text-sm font-medium">Fast path: upload your class schedule</p>
            <p className="text-xs text-muted-foreground">
              Drop a screenshot of your weekly calendar or class schedule. Nexus extracts recurring busy times — you review every block before anything saves. Manual edits below remain available as fallback.
            </p>
          </div>

          <SmartScheduleImport onSaved={async () => {
            const { data } = await supabase.from("availability_windows").select("*").eq("user_id", user!.id).order("day_of_week");
            setWindows((data as any[]) || []);
            if (cohort?.cohort_id) {
              const memRes = await supabase.from("cohort_memberships").select("user_id").eq("cohort_id", cohort.cohort_id);
              const userIds = memRes.data?.map((m: any) => m.user_id) || [];
              const cwRes = await supabase.from("availability_windows").select("*, profiles:user_id(full_name)").in("user_id", userIds);
              setCohortWindows((cwRes.data as any[]) || []);
            }
          }} />

          <div className="flex items-center justify-between pt-2 border-t border-border/40">
            <div>
              <p className="text-sm font-medium">Manual refinement</p>
              <p className="text-xs text-muted-foreground">Add or tweak individual windows. Use the chips below for quick weekly preferences.</p>
            </div>
            <Dialog open={addDialog} onOpenChange={setAddDialog}>
              <DialogTrigger asChild><Button size="sm" variant="outline" className="gap-2"><Plus className="h-3.5 w-3.5" />Add Window</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Availability Window</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Day</Label>
                    <Select value={String(newDay)} onValueChange={v => setNewDay(parseInt(v))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{DAYS.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2"><Label>Start</Label><Input type="time" value={newStart} onChange={e => setNewStart(e.target.value)} /></div>
                    <div className="space-y-2"><Label>End</Label><Input type="time" value={newEnd} onChange={e => setNewEnd(e.target.value)} /></div>
                  </div>
                  <div className="space-y-2">
                    <Label>Preference (1=avoid, 5=preferred)</Label>
                    <Slider value={[newWeight]} onValueChange={v => setNewWeight(v[0])} min={1} max={5} step={1} />
                    <p className="text-[10px] font-mono text-muted-foreground text-center">{newWeight}/5</p>
                  </div>
                  <Button onClick={addWindow} className="w-full">Save</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <AvailabilityChips />

          {windows.length > 0 && (
            <Card>
              <CardHeader className="py-3 px-5"><CardTitle className="text-sm">Saved Windows</CardTitle></CardHeader>
              <CardContent className="pt-0 px-5 pb-4">
                <div className="grid gap-2 sm:grid-cols-2">
                  {windows.map(w => (
                    <div key={w.id} className="flex items-center gap-3 p-3 rounded-lg border group hover:border-accent/40 transition-colors">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{DAYS[w.day_of_week]}</p>
                        <p className="text-[11px] font-mono text-muted-foreground">{w.start_time.slice(0,5)} – {w.end_time.slice(0,5)}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: w.preference_weight }).map((_, i) => (
                          <div key={i} className="h-1.5 w-1.5 rounded-full bg-accent" />
                        ))}
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => removeWindow(w.id)}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {cohortWindows.length > 0 && (
            <Card>
              <CardHeader className="py-3 px-5">
                <CardTitle className="text-sm flex items-center gap-2"><Users className="h-3.5 w-3.5 text-accent-foreground" />Cohort Availability Heatmap</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 px-5 pb-4 overflow-x-auto">
                <div className="min-w-[600px]">
                  <div className="grid gap-0.5" style={{ gridTemplateColumns: `80px repeat(${HOURS.length}, 1fr)` }}>
                    <div />
                    {HOURS.map(h => <div key={h} className="text-[9px] font-mono text-muted-foreground text-center">{h}:00</div>)}
                    {DAYS.map((day, dIdx) => (
                      <div key={dIdx} className="contents">
                        <div className="text-[10px] font-mono text-muted-foreground flex items-center">{day.slice(0, 3)}</div>
                        {HOURS.map((_, hIdx) => {
                          const val = heatmap[dIdx][hIdx];
                          const intensity = val / maxCount;
                          return (
                            <div key={`${dIdx}-${hIdx}`} className="h-6 rounded-sm transition-colors"
                              style={{ backgroundColor: val > 0 ? `hsl(var(--success) / ${0.15 + intensity * 0.7})` : `hsl(var(--muted) / 0.3)` }}
                              title={`${val} members available`} />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ============= PROPOSALS ============= */}
        <TabsContent value="proposals" className="mt-4 space-y-4">
          {labeledRecs.length > 0 && (
            <Card className="border-accent/20">
              <CardHeader className="py-3 px-5 flex flex-row items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-accent-foreground" />
                  Recommended Times
                  <span className="text-[10px] font-mono text-muted-foreground font-normal">· ranked by attendance, lead coverage, preference</span>
                </CardTitle>
                <Select value={String(recDuration)} onValueChange={async (v) => {
                  const d = parseInt(v);
                  setRecDuration(d);
                  if (cohort?.cohort_id) await loadRecommendations(cohort.cohort_id, d);
                }}>
                  <SelectTrigger className="h-7 w-[100px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 min</SelectItem>
                    <SelectItem value="60">60 min</SelectItem>
                    <SelectItem value="90">90 min</SelectItem>
                    <SelectItem value="120">2 hours</SelectItem>
                  </SelectContent>
                </Select>
              </CardHeader>
              <CardContent className="pt-0 px-5 pb-4 space-y-2">
                {labeledRecs.map((rec, i) => (
                  <SmartRecRow key={i} rec={rec} memberNames={memberNames} expanded onPropose={isLeadOrPM ? () => createSmartProposal(rec) : undefined} />
                ))}
              </CardContent>
            </Card>
          )}
          {labeledRecs.length === 0 && !loadingRecs && (
            <Card className="border-dashed">
              <CardContent className="py-6 px-5 text-center">
                <Clock className="h-6 w-6 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm font-medium">No recommendations yet</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Recommendations need cohort availability data. Have members upload schedules or set availability windows.
                </p>
                <Button variant="outline" size="sm" className="h-7 text-[10px] mt-3" onClick={() => setTab("availability")}>Set availability</Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="py-3 px-5"><CardTitle className="text-sm flex items-center gap-2"><CalendarDays className="h-3.5 w-3.5 text-accent-foreground" />Active Proposals</CardTitle></CardHeader>
            <CardContent className="pt-0 px-5 pb-4 space-y-2">
              {proposals.length === 0 ? (
                <p className="text-xs text-muted-foreground py-6 text-center">No active proposals. Leads can propose meeting times from the recommended slots above.</p>
              ) : proposals.map((p) => (
                <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg border">
                  <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{format(new Date(p.candidate_time), "EEEE, MMM d 'at' h:mm a")}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">{p.explanation}</p>
                  </div>
                  <Badge variant="outline" className="text-[9px] font-mono capitalize">{p.status}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Day-detail sheet */}
      <Sheet open={!!selectedDay} onOpenChange={(o) => !o && setSelectedDay(null)}>
        <SheetContent className="w-[420px] sm:max-w-[420px]">
          {selectedDay && (() => {
            const dayItems = itemsByDay.get(format(selectedDay, "yyyy-MM-dd")) || [];
            return (
              <>
                <SheetHeader>
                  <SheetTitle className="font-display">{format(selectedDay, "EEEE, MMMM d")}</SheetTitle>
                  <SheetDescription>{dayItems.length === 0 ? "Nothing scheduled." : `${dayItems.length} item${dayItems.length === 1 ? "" : "s"}`}</SheetDescription>
                </SheetHeader>
                <div className="mt-4 space-y-2">
                  {dayItems.map((it) => <EventCard key={it.id} item={it} onClick={() => { setSelectedDay(null); setSelectedEvent(it); }} />)}
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>

      {/* Event-detail sheet */}
      <Sheet open={!!selectedEvent} onOpenChange={(o) => !o && setSelectedEvent(null)}>
        <SheetContent className="w-[420px] sm:max-w-[420px]">
          {selectedEvent && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${CATEGORY_STYLES[selectedEvent.category]?.dot || "bg-muted-foreground"}`} />
                  <Badge variant="outline" className="text-[10px] capitalize">{selectedEvent.source}</Badge>
                </div>
                <SheetTitle className="font-display mt-2">{selectedEvent.title}</SheetTitle>
                <SheetDescription>{format(selectedEvent.start, "EEEE, MMMM d 'at' h:mm a")}</SheetDescription>
              </SheetHeader>
              <div className="mt-4 space-y-3 text-sm">
                {selectedEvent.location && (
                  <div className="flex items-center gap-2 text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{selectedEvent.location}</div>
                )}
                {selectedEvent.description && (
                  <p className="text-muted-foreground whitespace-pre-line">{selectedEvent.description}</p>
                )}
                {selectedEvent.meta?.meeting_link && (
                  <Button asChild size="sm" variant="outline" className="w-full gap-2">
                    <a href={selectedEvent.meta.meeting_link} target="_blank" rel="noreferrer"><Link2 className="h-3.5 w-3.5" /> Join meeting</a>
                  </Button>
                )}
                {selectedEvent.meta?.teams_link && (
                  <Button asChild size="sm" className="w-full gap-2">
                    <a href={selectedEvent.meta.teams_link} target="_blank" rel="noreferrer"><Link2 className="h-3.5 w-3.5" /> Open in Teams</a>
                  </Button>
                )}
                {selectedEvent.link && (
                  <Button asChild size="sm" variant="outline" className="w-full"><a href={selectedEvent.link}>Open project</a></Button>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </motion.div>
  );
}

// ---------- subcomponents ----------
function MonthGrid({ cursor, itemsByDay, onDayClick, onEventClick }: {
  cursor: Date; itemsByDay: Map<string, CalEvent[]>;
  onDayClick: (d: Date) => void; onEventClick: (e: CalEvent) => void;
}) {
  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const gridStart = startOfWeek(monthStart);
  const gridEnd = endOfWeek(monthEnd);
  const days: Date[] = [];
  let d = gridStart;
  while (d <= gridEnd) { days.push(d); d = addDays(d, 1); }

  return (
    <div>
      <div className="grid grid-cols-7 gap-px text-[10px] font-medium uppercase text-muted-foreground tracking-wider mb-1 px-1">
        {DAYS.map((day) => <div key={day} className="text-center py-1">{day.slice(0, 3)}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-px bg-border rounded-md overflow-hidden border">
        {days.map((day) => {
          const inMonth = isSameMonth(day, cursor);
          const today = isToday(day);
          const items = itemsByDay.get(format(day, "yyyy-MM-dd")) || [];
          return (
            <button
              key={day.toISOString()} type="button" onClick={() => onDayClick(day)}
              className={`min-h-[112px] p-2 text-left bg-card hover:bg-accent/5 transition-colors flex flex-col gap-1 ${!inMonth ? "bg-muted/20 text-muted-foreground/60" : ""} ${today ? "bg-primary/[0.04] ring-1 ring-inset ring-primary/30" : ""}`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs font-mono ${today ? "h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold" : "font-medium"}`}>
                  {format(day, "d")}
                </span>
                {items.length > 3 && <span className="text-[9px] font-mono text-muted-foreground">+{items.length - 3} more</span>}
              </div>
              <div className="space-y-0.5">
                {items.slice(0, 3).map((it) => {
                  const s = CATEGORY_STYLES[it.category] || CATEGORY_STYLES.other;
                  return (
                    <div
                      key={it.id}
                      onClick={(e) => { e.stopPropagation(); onEventClick(it); }}
                      className={`text-[10px] truncate px-1.5 py-0.5 rounded border ${s.bg} cursor-pointer hover:opacity-90 leading-tight`}
                      title={it.title}
                    >
                      <span className="font-mono opacity-70 mr-1">{format(it.start, "h:mma").toLowerCase()}</span>
                      {it.title}
                    </div>
                  );
                })}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WeekGrid({ cursor, itemsByDay, onEventClick }: {
  cursor: Date; itemsByDay: Map<string, CalEvent[]>; onEventClick: (e: CalEvent) => void;
}) {
  const weekStart = startOfWeek(cursor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  return (
    <div className="rounded-md border overflow-hidden">
      {/* Day header bar */}
      <div className="grid grid-cols-7 bg-muted/30 border-b">
        {days.map((day) => {
          const today = isToday(day);
          return (
            <div key={day.toISOString()} className={`px-2 py-2 text-center border-r last:border-r-0 ${today ? "bg-primary/[0.06]" : ""}`}>
              <div className="text-[10px] uppercase text-muted-foreground tracking-wider">{format(day, "EEE")}</div>
              <div className={`text-lg font-display leading-tight ${today ? "text-primary font-bold" : ""}`}>{format(day, "d")}</div>
            </div>
          );
        })}
      </div>
      {/* Day columns */}
      <div className="grid grid-cols-7 bg-card">
        {days.map((day) => {
          const items = itemsByDay.get(format(day, "yyyy-MM-dd")) || [];
          const today = isToday(day);
          return (
            <div key={day.toISOString()} className={`min-h-[340px] p-1.5 border-r last:border-r-0 space-y-1 ${today ? "bg-primary/[0.03]" : ""}`}>
              {items.length === 0 ? (
                <p className="text-[10px] text-muted-foreground/40 italic text-center pt-6">—</p>
              ) : items.map((it) => {
                const s = CATEGORY_STYLES[it.category] || CATEGORY_STYLES.other;
                return (
                  <button key={it.id} onClick={() => onEventClick(it)}
                    className={`w-full text-left text-[10px] rounded border px-1.5 py-1 ${s.bg} hover:opacity-90 leading-tight`}>
                    <div className="font-mono opacity-70 text-[9px]">{format(it.start, "h:mma").toLowerCase()}</div>
                    <div className="font-medium truncate">{it.title}</div>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AgendaList({ items, onEventClick }: { items: CalEvent[]; onEventClick: (e: CalEvent) => void }) {
  const upcoming = items.filter(i => i.start >= new Date(new Date().setHours(0, 0, 0, 0))).sort((a, b) => a.start.getTime() - b.start.getTime()).slice(0, 30);
  if (upcoming.length === 0) return <p className="text-sm text-muted-foreground py-12 text-center">No upcoming items.</p>;
  // group by date
  const grouped = new Map<string, CalEvent[]>();
  upcoming.forEach((it) => {
    const k = format(it.start, "yyyy-MM-dd");
    if (!grouped.has(k)) grouped.set(k, []);
    grouped.get(k)!.push(it);
  });
  return (
    <div className="space-y-4 px-2 py-2">
      {Array.from(grouped.entries()).map(([k, list]) => {
        const d = new Date(k);
        return (
          <div key={k}>
            <div className="flex items-center gap-3 mb-2">
              <div className="text-center w-12">
                <div className="text-[10px] uppercase text-muted-foreground tracking-wider">{format(d, "EEE")}</div>
                <div className={`text-lg font-display ${isToday(d) ? "text-primary" : ""}`}>{format(d, "d")}</div>
              </div>
              <div className="flex-1 h-px bg-border" />
              <span className="text-[10px] font-mono text-muted-foreground">{format(d, "MMM yyyy")}</span>
            </div>
            <div className="space-y-1.5 ml-14">
              {list.map((it) => <EventCard key={it.id} item={it} onClick={() => onEventClick(it)} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EventCard({ item, onClick }: { item: CalEvent; onClick: () => void }) {
  const s = CATEGORY_STYLES[item.category] || CATEGORY_STYLES.other;
  const Icon = item.source === "deadline" ? AlertCircle : item.source === "milestone" ? Flag : item.source === "proposal" ? Target : CalendarDays;
  return (
    <button onClick={onClick} className={`w-full text-left rounded-md border px-3 py-2 ${s.bg} hover:opacity-90 transition-opacity`}>
      <div className="flex items-start gap-2">
        <Icon className="h-3.5 w-3.5 mt-0.5 shrink-0 opacity-70" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate">{item.title}</p>
          <p className="text-[10px] opacity-70 font-mono">{format(item.start, "h:mm a")}{item.location ? ` · ${item.location}` : ""}</p>
        </div>
      </div>
    </button>
  );
}

function getNextDate(dayOfWeek: number, hour: number): Date {
  const now = new Date();
  let daysUntil = dayOfWeek - now.getDay();
  if (daysUntil <= 0) daysUntil += 7;
  const d = new Date(now);
  d.setDate(d.getDate() + daysUntil);
  d.setHours(hour, 0, 0, 0);
  return d;
}

function SmartRecRow({
  rec, memberNames, onPropose, expanded = false,
}: {
  rec: any;
  memberNames: Record<string, string>;
  onPropose?: () => void;
  expanded?: boolean;
}) {
  const dayName = DAYS[rec.day_of_week];
  const fmtHour = (h: number) => {
    const ampm = h >= 12 ? "pm" : "am";
    const hh = h % 12 === 0 ? 12 : h % 12;
    return `${hh}${ampm}`;
  };
  const missing: string[] = (rec.missing_user_ids || [])
    .map((id: string) => memberNames[id])
    .filter(Boolean);
  const tone =
    rec.attendance_pct >= 80 ? "bg-success/10 text-success border-success/20" :
    rec.attendance_pct >= 60 ? "bg-warning/10 text-warning border-warning/20" :
    "bg-muted text-muted-foreground border-border";

  return (
    <div className="rounded-lg border p-3 hover:border-accent/40 transition-colors">
      <div className="flex items-center gap-3">
        <div className={`h-9 w-9 rounded-lg flex flex-col items-center justify-center text-[10px] font-bold leading-none ${tone}`}>
          <span className="text-sm">{rec.attendance_pct}</span>
          <span className="text-[8px] font-mono opacity-70">%</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium">{dayName} {fmtHour(rec.start_hour)}–{fmtHour(rec.end_hour)}</p>
            {rec.rank_label && (
              <Badge variant="outline" className="text-[9px] font-mono py-0">{rec.rank_label}</Badge>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-[10px] font-mono text-muted-foreground">
            <span className="inline-flex items-center gap-1"><UserCheck className="h-2.5 w-2.5 text-success" />{rec.available_count}/{rec.total_count}</span>
            {rec.conflict_count > 0 && (
              <span className="inline-flex items-center gap-1"><UserX className="h-2.5 w-2.5 text-destructive" />{rec.conflict_count} conflict{rec.conflict_count === 1 ? "" : "s"}</span>
            )}
            <span className="inline-flex items-center gap-1"><Crown className="h-2.5 w-2.5 text-warning" />{rec.lead_count} lead{rec.lead_count === 1 ? "" : "s"}</span>
          </div>
        </div>
        {onPropose && (
          <Button size="sm" variant="outline" className="text-[10px] h-7 shrink-0" onClick={onPropose}>Propose</Button>
        )}
      </div>
      {expanded && missing.length > 0 && (
        <div className="mt-2 pt-2 border-t border-border/40 flex items-start gap-2 flex-wrap">
          <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mt-0.5">Missing:</span>
          {missing.slice(0, 8).map((n, i) => (
            <Badge key={i} variant="secondary" className="text-[9px] font-mono py-0 px-1.5">{n}</Badge>
          ))}
          {missing.length > 8 && (
            <span className="text-[9px] font-mono text-muted-foreground">+{missing.length - 8} more</span>
          )}
        </div>
      )}
    </div>
  );
}
