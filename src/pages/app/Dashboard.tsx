import { useAuth } from "@/lib/auth";
import { Navigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProgressRing } from "@/components/ui/ProgressRing";
import {
  FolderKanban, CheckCircle2, CalendarDays, Megaphone, ArrowRight,
  AlertTriangle, Zap, BookOpen, MessageSquare, Cpu, ChevronRight,
  Target, Sparkles, Play, GraduationCap, Shield, Users, BarChart3,
  Clock, Wrench, Code, Briefcase, FileText, Compass, Trophy, Rocket,
  Activity, Bell, GitCommit, HelpCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { SectionExplainer, InfoDot } from "@/components/ui/SectionExplainer";
import DeliverableStatusBadge from "@/components/DeliverableStatusBadge";
import { ResumeStrip } from "@/components/ResumeStrip";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.22 } } };
const cohortIcons: Record<string, any> = { cpu: Cpu, wrench: Wrench, code: Code, briefcase: Briefcase };

function getGreeting() {
  const h = new Date().getHours();
  if (h < 6) return "Late night";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Late night";
}

interface NextMove {
  label: string;
  sublabel: string;
  reason: string;
  action: () => void;
  icon: any;
  urgent: boolean;
  engagement?: string; // "purpose" | "competition" | "contract"
}

const ENGAGEMENT_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  purpose: { label: "Purpose", icon: Compass, color: "text-accent-foreground" },
  competition: { label: "Competition", icon: Trophy, color: "text-warning" },
  contract: { label: "Contract", icon: Briefcase, color: "text-primary" },
};

const PHASE_LABELS: Record<string, string> = {
  thesis: "Thesis", research: "Research", development: "Development",
  validation: "Validation", knowledge_transfer: "Knowledge Transfer", roadmap_update: "Roadmap Update",
};

export default function Dashboard() {
  const { user, profile, highestRole, isAdmin, isBoardOrAdmin, isAdvisor } = useAuth();
  const navigate = useNavigate();
  const [deliverables, setDeliverables] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [cohort, setCohort] = useState<any>(null);
  const [labManual, setLabManual] = useState<any>(null);
  const [mockProject, setMockProject] = useState<any>(null);
  const [currentStage, setCurrentStage] = useState<any>(null);
  const [purposeTrack, setPurposeTrack] = useState<any>(null);
  const [capacity, setCapacity] = useState<any>(null);
  const [activeEngagements, setActiveEngagements] = useState<any[]>([]);
  const [helpRequests, setHelpRequests] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [stats, setStats] = useState({ activeProjects: 0, overdueDeliverables: 0, upcomingEvents: 0, totalMembers: 0 });
  const [changes, setChanges] = useState<any | null>(null);
  const [lastVisit, setLastVisit] = useState<string | null>(null);
  const [needsAvailability, setNeedsAvailability] = useState(false);
  const [availabilityDismissed, setAvailabilityDismissed] = useState<boolean>(() =>
    typeof window !== "undefined" && sessionStorage.getItem("avail_nudge_dismissed") === "1"
  );
  const [cohortScore, setCohortScore] = useState<{ score: number; attendance_pct: number; deliverable_pct: number; training_pct: number } | null>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      // Read prior visit timestamp first, then compute "what changed since".
      // touch_dashboard_visit returns the previous value and stamps a new one atomically.
      const { data: prev } = await supabase.rpc("touch_dashboard_visit");
      setLastVisit(prev as any);
      const sinceIso = (prev as any) || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      supabase.rpc("dashboard_changes_since", { p_since: sinceIso }).then(({ data }) => setChanges(data));

      const [delRes, annRes, cohortRes, helpRes] = await Promise.all([
        supabase.from("deliverables").select("*, projects(name)").eq("owner_id", user.id).in("approval_status", ["pending", "revision_requested"]).order("due_date", { ascending: true }).limit(10),
        supabase.from("announcements").select("*").order("created_at", { ascending: false }).limit(3),
        supabase.from("cohort_memberships").select("*, cohorts(*)").eq("user_id", user.id).limit(1).maybeSingle(),
        supabase.from("help_requests").select("*").eq("requester_id", user.id).eq("status", "open").limit(5),
      ]);
      setDeliverables(delRes.data || []);
      setAnnouncements(annRes.data || []);
      setHelpRequests(helpRes.data || []);

      if (cohortRes.data) {
        setCohort(cohortRes.data);
        const cohortId = cohortRes.data.cohort_id;
        supabase.rpc("cohort_performance", { p_cohort_id: cohortId }).then(({ data }) => {
          if (data) setCohortScore(data as any);
        });
        const [manualRes, mpRes, ptRes, capRes, oppRes] = await Promise.all([
          supabase.from("lab_manuals").select("*").eq("cohort_id", cohortId).limit(1).maybeSingle(),
          supabase.from("mock_projects").select("*").eq("cohort_id", cohortId).eq("status", "active").limit(1).maybeSingle(),
          supabase.from("purpose_tracks").select("*").eq("cohort_id", cohortId).eq("status", "active").limit(1).maybeSingle(),
          supabase.from("capacity_allocations").select("*").eq("cohort_id", cohortId).order("effective_date", { ascending: false }).limit(1).maybeSingle(),
          supabase.from("opportunities").select("*").eq("assigned_cohort_id", cohortId).in("status", ["approved", "active"]),
        ]);
        setLabManual(manualRes.data);
        setMockProject(mpRes.data);
        setPurposeTrack(ptRes.data);
        setCapacity(capRes.data);
        setActiveEngagements(oppRes.data || []);
        if (mpRes.data) {
          const { data: stage } = await supabase.from("project_stages").select("*").eq("mock_project_id", mpRes.data.id).eq("status", "active").order("order_index").limit(1).maybeSingle();
          setCurrentStage(stage);
        }
      }

      // Availability nudge: surface a dismissible banner until profiles.availability_set_at is stamped.
      const { data: prof } = await supabase
        .from("profiles")
        .select("availability_set_at")
        .eq("user_id", user.id)
        .maybeSingle();
      setNeedsAvailability(!prof?.availability_set_at);

      // Real deliverable review queue: deliverables I lead, awaiting my review.
      // (Falls back to admin: every awaiting_review row capped at 5 for the dashboard preview.)
      const { data: leadProjs } = await supabase
        .from("project_memberships")
        .select("project_id")
        .eq("user_id", user.id)
        .eq("role_on_project", "lead");
      const leadIds = (leadProjs || []).map((m: any) => m.project_id);
      let revQ = supabase
        .from("deliverables")
        .select("id, title, project_id, due_date, version, projects(name)")
        .not("file_url", "is", null)
        .in("approval_status", ["pending"])
        .eq("approval_required", true)
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(5);
      if (!isBoardOrAdmin && leadIds.length > 0) revQ = revQ.in("project_id", leadIds);
      const { data: revData } = (isBoardOrAdmin || leadIds.length > 0) ? await revQ : { data: [] as any[] };
      setReviews(revData || []);

      const [projRes, eventRes, memberRes] = await Promise.all([
        supabase.from("project_memberships").select("project_id").eq("user_id", user.id),
        supabase.from("events").select("*", { count: "exact", head: true }).gte("start_time", new Date().toISOString()),
        supabase.from("profiles").select("*", { count: "exact", head: true }),
      ]);

      const overdueCount = (delRes.data || []).filter((d: any) => d.due_date && new Date(d.due_date) < new Date()).length;

      setStats({
        activeProjects: projRes.data?.length || 0,
        overdueDeliverables: overdueCount,
        upcomingEvents: eventRes.count || 0,
        totalMembers: memberRes.count || 0,
      });
    };
    load();
  }, [user]);

  const isApplicant = highestRole === "applicant";
  const firstName = profile?.full_name?.split(" ")[0] || "Operator";

  // Determine current mode
  const modes: string[] = [];
  if (purposeTrack) modes.push("Purpose");
  const comps = activeEngagements.filter(e => e.type === "competition");
  const contracts = activeEngagements.filter(e => e.type === "contract");
  if (comps.length > 0) modes.push("Competition");
  if (contracts.length > 0) modes.push("Contract");
  const currentMode = modes.length === 0 ? "Purpose" : modes.join(" + ");

  // Strict ranking: blocking > overdue > awaiting your review > due soon > high-impact
  // Role-aware: members get only their work; PMs/leads also see review queue + open help.
  const isLead = highestRole === "project_lead" || isBoardOrAdmin;
  const computeNextMoves = (): NextMove[] => {
    const moves: NextMove[] = [];
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    // 1. BLOCKING: revision requested on your deliverables (team is blocked on you)
    deliverables
      .filter(d => d.approval_status === "revision_requested")
      .forEach(d => moves.push({
        label: `Revise: ${d.title}`,
        sublabel: (d.projects as any)?.name || "Project",
        reason: "Reviewer requested changes — team is waiting",
        action: () => navigate(`/app/projects/${d.project_id}`),
        icon: Zap, urgent: true,
        engagement: d.engagement_type || "purpose",
      }));

    // 2. OVERDUE: your deliverables past due, not yet submitted/approved
    deliverables
      .filter(d => d.due_date && new Date(d.due_date).getTime() < now && d.approval_status !== "approved" && d.approval_status !== "revision_requested")
      .forEach(d => moves.push({
        label: `Submit: ${d.title}`,
        sublabel: (d.projects as any)?.name || "Project",
        reason: `Overdue — was due ${new Date(d.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
        action: () => navigate(`/app/projects/${d.project_id}`),
        icon: AlertTriangle, urgent: true,
        engagement: d.engagement_type || "purpose",
      }));

    // 3. AWAITING YOUR REVIEW (leads/PMs only) — real deliverable queue
    if (isLead) {
      reviews.forEach((r: any) => moves.push({
        label: `Review: ${r.title}`,
        sublabel: (r.projects as any)?.name || "Project",
        reason: r.due_date ? `v${r.version} · due ${new Date(r.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : `v${r.version} · awaiting your decision`,
        action: () => navigate(`/app/review/${r.id}`),
        icon: CheckCircle2, urgent: true,
      }));
    }

    // 4. DUE SOON (within 3 days, not yet submitted)
    deliverables
      .filter(d => {
        if (!d.due_date) return false;
        const t = new Date(d.due_date).getTime();
        return t >= now && t - now <= 3 * dayMs && d.approval_status === "pending" && !d.file_url;
      })
      .forEach(d => {
        const days = Math.ceil((new Date(d.due_date).getTime() - now) / dayMs);
        moves.push({
          label: `Submit: ${d.title}`,
          sublabel: (d.projects as any)?.name || "Project",
          reason: days <= 1 ? "Due tomorrow" : `Due in ${days} days`,
          action: () => navigate(`/app/projects/${d.project_id}`),
          icon: Target, urgent: days <= 1,
          engagement: d.engagement_type || "purpose",
        });
      });

    // 5. HIGH-IMPACT contribution (only if no urgent items above)
    if (moves.length === 0 && labManual) {
      moves.push({
        label: "Continue training playbook",
        sublabel: labManual.title,
        reason: "Advance your cohort readiness",
        action: () => navigate(`/app/lab/${labManual.id}`),
        icon: BookOpen, urgent: false,
        engagement: "purpose",
      });
    }
    if (moves.length === 0 && purposeTrack) {
      moves.push({
        label: "Advance Purpose Track",
        sublabel: purposeTrack.title,
        reason: "No urgent items — push the long-term mission",
        action: () => navigate("/app/purpose"),
        icon: Compass, urgent: false,
        engagement: "purpose",
      });
    }

    // Cap at 3 — strict
    return moves.slice(0, 3);
  };
  const nextMoves = computeNextMoves();

  // Advisors land on the dedicated portal. Admins keep the normal dashboard so they can access both.
  if (isAdvisor && !isAdmin) return <Navigate to="/app/advisor" replace />;

  if (isApplicant) return <ApplicantDashboard />;

  const CohortIcon = cohortIcons[(cohort as any)?.cohorts?.icon] || Cpu;
  const cohortName = (cohort as any)?.cohorts?.name || "PEC";

  // Pick most-relevant project for context strip + Resume deep-link.
  const primaryDeliverable = deliverables[0];
  const primaryProjectName = (primaryDeliverable?.projects as any)?.name || mockProject?.title || null;

  // Role-aware blockers. Members: own pending/overdue. Leads/admins: review queue.
  const memberBlockers = deliverables.filter(d =>
    d.approval_status === "revision_requested" ||
    (d.due_date && new Date(d.due_date) < new Date() && d.approval_status !== "approved")
  );
  const blockerSection = isLead ? reviews : memberBlockers;
  const blockerTitle = isLead ? "Review Queue" : "Your Blockers";
  const blockerEmpty = isLead ? "No submissions awaiting your review." : "No blockers — you're clear.";

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-5 max-w-[1200px]">
      {/* CONTEXT STRIP — sticky, always visible */}
      <motion.div variants={item} className="sticky top-0 z-20 -mx-4 px-4 py-2 backdrop-blur-md bg-background/85 border-b border-border/40">
        <div className="flex items-center gap-2.5 flex-wrap text-[10px] font-mono">
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-success status-pulse" />
            <span className="uppercase tracking-[0.15em] text-muted-foreground">Mission Control</span>
          </div>
          <span className="text-muted-foreground/40">·</span>
          <button onClick={() => navigate("/app/purpose")} className="inline-flex items-center gap-1.5 hover:text-accent-foreground transition-colors">
            <CohortIcon className="h-3 w-3 text-accent-foreground" />
            <span className="text-foreground">{cohortName}</span>
          </button>
          <span className="text-muted-foreground/40">·</span>
          <Badge className="text-[9px] font-mono bg-accent/10 text-accent-foreground border-accent/30 h-4 px-1.5">{currentMode}</Badge>
          {primaryProjectName && (
            <>
              <span className="text-muted-foreground/40">·</span>
              <button onClick={() => primaryDeliverable && navigate(`/app/projects/${primaryDeliverable.project_id}`)} className="inline-flex items-center gap-1.5 hover:text-accent-foreground transition-colors truncate max-w-[200px]">
                <Target className="h-3 w-3 text-primary" />
                <span className="truncate">{primaryProjectName}</span>
              </button>
            </>
          )}
          {capacity && (
            <span className="ml-auto text-muted-foreground hidden sm:inline">
              {capacity.purpose_pct > 0 && <>P {capacity.purpose_pct}%</>}
              {capacity.competition_pct > 0 && <> · C {capacity.competition_pct}%</>}
              {capacity.contract_pct > 0 && <> · K {capacity.contract_pct}%</>}
            </span>
          )}
        </div>
      </motion.div>

      {/* Availability nudge — dismissible per session, reappears next login until set */}
      {needsAvailability && !availabilityDismissed && (
        <motion.div variants={item} className="rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-xs flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-warning shrink-0" />
          <span className="flex-1">
            <span className="font-medium">Set your weekly availability</span> so leads can schedule meetings that work for you.
          </span>
          <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => navigate("/app/scheduling")}>Set now</Button>
          <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => { sessionStorage.setItem("avail_nudge_dismissed","1"); setAvailabilityDismissed(true); }}>Later</Button>
        </motion.div>
      )}

      {/* Cohort performance mini-widget */}
      {cohortScore && cohort && (
        <motion.div variants={item} className="rounded-lg border bg-card px-3 py-2 text-xs flex items-center gap-3">
          <BarChart3 className="h-3.5 w-3.5 text-accent-foreground shrink-0" />
          <span className="font-medium">{(cohort as any)?.cohorts?.name || "Your cohort"} score</span>
          <span className="font-mono text-base font-semibold">{cohortScore.score}</span>
          <span className="text-[10px] text-muted-foreground hidden sm:inline">/ 100</span>
          <span className="ml-auto flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
            <span>att {cohortScore.attendance_pct}%</span>
            <span>·</span>
            <span>deliv {cohortScore.deliverable_pct}%</span>
            <span>·</span>
            <span>train {cohortScore.training_pct}%</span>
          </span>
        </motion.div>
      )}

      {/* HERO + 1. NEXT MOVE (max 3) */}
      <motion.div variants={item} className="relative overflow-hidden rounded-2xl border bg-card">
        <div className="absolute inset-0 bg-grid-animate pointer-events-none" />
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-accent/5 blur-3xl pointer-events-none" />
        <div className="relative p-6 sm:p-8 space-y-5">
          <div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold leading-tight tracking-tight">
              {getGreeting()}, {firstName}
            </h1>
            <p className="text-sm text-muted-foreground mt-1.5">
              {nextMoves.length === 0
                ? (isLead ? "Inbox clear. Push the long-term mission." : "No urgent items. Continue training or advance Purpose.")
                : `${nextMoves.length} action${nextMoves.length === 1 ? "" : "s"} ranked by urgency.`}
            </p>
          </div>

          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2 mb-0.5">
              <Sparkles className="h-3 w-3 text-accent-foreground" />
              <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground">Next Move</span>
            </div>
            {nextMoves.length === 0 ? (
              <div className="glass rounded-xl p-4 flex items-center gap-3">
                <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                <p className="text-sm flex-1">All clear.</p>
                {labManual && (
                  <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => navigate(`/app/lab/${labManual.id}`)}>
                    Open playbook
                  </Button>
                )}
              </div>
            ) : nextMoves.map((move, i) => {
              const eng = move.engagement ? ENGAGEMENT_LABELS[move.engagement] : null;
              return (
                <div key={i} className={`glass-strong rounded-xl p-4 cursor-pointer hover:border-accent/30 transition-all ${move.urgent ? "border-destructive/30" : ""}`} onClick={move.action}>
                  <div className="flex items-start gap-3">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${move.urgent ? "bg-destructive/10" : "bg-accent/10"}`}>
                      <move.icon className={`h-3.5 w-3.5 ${move.urgent ? "text-destructive" : "text-accent-foreground"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold leading-tight truncate">{move.label}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{move.sublabel}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-[9px] font-mono text-accent-foreground/70">{move.reason}</p>
                        {eng && (
                          <Badge variant="outline" className="text-[8px] font-mono gap-0.5 py-0">
                            <eng.icon className={`h-2 w-2 ${eng.color}`} />{eng.label}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Button size="sm" variant={move.urgent ? "destructive" : "default"} className="shrink-0 gap-1 h-7 text-[10px]">
                      <Play className="h-2.5 w-2.5" />Go
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* 2. RESUME — continuation, not history */}
      <motion.div variants={item}><ResumeStrip /></motion.div>

      {/* 3. WHAT CHANGED */}
      {changes && changes.total > 0 && lastVisit && (
        <motion.div variants={item}>
          <Card className="border-accent/20 bg-accent/[0.03]">
            <CardContent className="py-3 px-5">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 shrink-0">
                  <Activity className="h-3.5 w-3.5 text-accent-foreground" />
                  <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    Since last visit · {new Date(lastVisit).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  </span>
                </div>
                <div className="flex items-center gap-3 flex-wrap text-[11px] font-mono">
                  {changes.new_submissions > 0 && (
                    <button onClick={() => navigate(isLead ? "/app/lead" : "/app/projects")} className="inline-flex items-center gap-1.5 hover:text-accent-foreground transition-colors">
                      <span className="h-1.5 w-1.5 rounded-full bg-warning" />
                      <span className="font-bold">{changes.new_submissions}</span> new submission{changes.new_submissions === 1 ? "" : "s"}
                    </button>
                  )}
                  {changes.approvals > 0 && (
                    <button onClick={() => navigate("/app/projects")} className="inline-flex items-center gap-1.5 hover:text-accent-foreground transition-colors">
                      <span className="h-1.5 w-1.5 rounded-full bg-success" />
                      <span className="font-bold">{changes.approvals}</span> approval{changes.approvals === 1 ? "" : "s"}
                    </button>
                  )}
                  {changes.revisions > 0 && (
                    <button onClick={() => navigate("/app/projects")} className="inline-flex items-center gap-1.5 hover:text-accent-foreground transition-colors">
                      <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                      <span className="font-bold">{changes.revisions}</span> revision{changes.revisions === 1 ? "" : "s"}
                    </button>
                  )}
                  {changes.new_decisions > 0 && (
                    <button onClick={() => navigate("/app/projects")} className="inline-flex items-center gap-1.5 hover:text-accent-foreground transition-colors">
                      <GitCommit className="h-3 w-3 text-primary" />
                      <span className="font-bold">{changes.new_decisions}</span> decision{changes.new_decisions === 1 ? "" : "s"}
                    </button>
                  )}
                  {changes.new_events > 0 && (
                    <button onClick={() => navigate("/app/events")} className="inline-flex items-center gap-1.5 hover:text-accent-foreground transition-colors">
                      <CalendarDays className="h-3 w-3" />
                      <span className="font-bold">{changes.new_events}</span> new event{changes.new_events === 1 ? "" : "s"}
                    </button>
                  )}
                  {changes.new_announcements > 0 && (
                    <button onClick={() => navigate("/app/announcements")} className="inline-flex items-center gap-1.5 hover:text-accent-foreground transition-colors">
                      <Megaphone className="h-3 w-3" />
                      <span className="font-bold">{changes.new_announcements}</span> announcement{changes.new_announcements === 1 ? "" : "s"}
                    </button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* 4. BLOCKERS / REVIEWS — role-aware */}
      <motion.div variants={item}>
        <Card className="overflow-hidden">
          <CardHeader className="flex-row items-center justify-between py-3 px-5">
            <CardTitle className="text-sm font-sans font-semibold flex items-center gap-2">
              {isLead ? <CheckCircle2 className="h-3.5 w-3.5 text-accent-foreground" /> : <AlertTriangle className="h-3.5 w-3.5 text-accent-foreground" />}
              {blockerTitle}
              {blockerSection.length > 0 && <Badge variant="outline" className="text-[9px] font-mono h-4 px-1.5">{blockerSection.length}</Badge>}
            </CardTitle>
            <Button variant="ghost" size="sm" className="text-[10px] font-mono h-7" onClick={() => navigate(isLead ? "/app/lead" : "/app/projects")}>
              {isLead ? "Lead workspace" : "All deliverables"} <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent className="pt-0 px-5 pb-4">
            {blockerSection.length === 0 ? (
              <EmptyState icon={CheckCircle2} text={blockerEmpty} />
            ) : (
              <div className="space-y-0.5">
                {blockerSection.slice(0, 6).map((d: any) => {
                  const eng = ENGAGEMENT_LABELS[d.engagement_type || "purpose"];
                  const isOverdue = d.due_date && new Date(d.due_date) < new Date();
                  const link = isLead ? `/app/review/${d.id}` : `/app/projects/${d.project_id}`;
                  return (
                    <motion.div key={d.id} whileHover={{ x: 2 }} className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/40 transition-all cursor-pointer group" onClick={() => navigate(link)}>
                      <div className={`h-2 w-2 rounded-full shrink-0 ${isOverdue ? "bg-destructive animate-pulse" : isLead ? "bg-warning" : "bg-muted-foreground/30"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate leading-tight">{d.title}</p>
                        <p className="text-[10px] text-muted-foreground font-mono truncate">{(d.projects as any)?.name}{isLead && d.version ? ` · v${d.version}` : ""}</p>
                      </div>
                      {eng && !isLead && <Badge variant="outline" className="text-[8px] font-mono gap-0.5 py-0 shrink-0"><eng.icon className={`h-2 w-2 ${eng.color}`} />{eng.label}</Badge>}
                      {!isLead && <DeliverableStatusBadge status={d.approval_status} fileUrl={d.file_url} dueDate={d.due_date} approvalRequired={d.approval_required} />}
                      {d.due_date && (
                        <span className={`text-[10px] font-mono ${isOverdue ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                          {new Date(d.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      )}
                      <ChevronRight className="h-3 w-3 text-transparent group-hover:text-muted-foreground transition-colors" />
                    </motion.div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Latest announcement — secondary, only when present */}
      {announcements.length > 0 && (
        <motion.div variants={item}>
          <Card>
            <CardHeader className="py-3 px-5 flex-row items-center justify-between">
              <CardTitle className="text-sm font-sans font-semibold flex items-center gap-2">
                <Megaphone className="h-3.5 w-3.5 text-accent-foreground" /> Latest Announcement
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-[10px] font-mono h-7" onClick={() => navigate("/app/announcements")}>All <ArrowRight className="ml-1 h-3 w-3" /></Button>
            </CardHeader>
            <CardContent className="pt-0 px-5 pb-4">
              <div className="border-l-2 border-accent/40 pl-3">
                <p className="text-sm font-medium leading-tight">{announcements[0].title}</p>
                <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{announcements[0].body}</p>
                <p className="text-[9px] text-muted-foreground font-mono mt-1">{new Date(announcements[0].created_at).toLocaleDateString()}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}


function CapChip({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="text-lg font-bold font-mono">{pct}%</div>
      <div className={`h-1.5 w-12 rounded-full ${color}/20 overflow-hidden`}>
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[9px] font-mono text-muted-foreground">{label}</span>
    </div>
  );
}

function StatTile({ icon: Icon, label, value, variant = "default" }: { icon: any; label: string; value: number; variant?: string }) {
  return (
    <Card className="card-hover">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${variant === "destructive" && value > 0 ? "bg-destructive/10" : "bg-muted/50"}`}>
          <Icon className={`h-4 w-4 ${variant === "destructive" && value > 0 ? "text-destructive" : "text-muted-foreground"}`} />
        </div>
        <div>
          <p className="text-xl font-bold font-mono leading-none">{value}</p>
          <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider mt-0.5">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <div className="flex flex-col items-center py-8 text-muted-foreground">
      <Icon className="h-8 w-8 mb-2 opacity-20" />
      <p className="text-[11px]">{text}</p>
    </div>
  );
}

function ApplicantDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const steps = [
    { label: "Create account", done: true },
    { label: "Verify email", done: true },
    { label: "Complete profile", done: !!profile?.major && !!profile?.bio },
    { label: "Admin review", done: false },
  ];
  const progress = (steps.filter(s => s.done).length / steps.length) * 100;
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="max-w-xl mx-auto space-y-6 pt-8">
      <div className="text-center">
        <div className="badge-verified mx-auto mb-4 w-fit">
          <Shield className="h-2.5 w-2.5" />
          <span>Pending Verification</span>
        </div>
        <h1 className="font-display text-3xl font-bold">Welcome to PEC Nexus</h1>
        <p className="text-muted-foreground mt-2 text-sm">Your application is being reviewed. Complete your profile to speed things up.</p>
      </div>
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-center mb-6">
            <ProgressRing progress={progress} size={100} strokeWidth={6}>
              <span className="text-lg font-bold font-mono">{Math.round(progress)}%</span>
            </ProgressRing>
          </div>
          <div className="space-y-3">{steps.map((s, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold ${s.done ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"}`}>
                {s.done ? "✓" : i + 1}
              </div>
              <span className={`text-sm ${s.done ? "line-through text-muted-foreground" : "font-medium"}`}>{s.label}</span>
            </div>
          ))}</div>
          <Button className="mt-6 w-full" onClick={() => navigate("/app/settings")}>Complete Profile</Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}
