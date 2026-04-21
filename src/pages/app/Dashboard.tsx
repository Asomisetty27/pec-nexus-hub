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
} from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { SectionExplainer, InfoDot } from "@/components/ui/SectionExplainer";
import DeliverableStatusBadge from "@/components/DeliverableStatusBadge";

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
  // Advisors land on the dedicated portal, not student-facing Mission Control.
  // Admins keep their normal dashboard so they can still access both surfaces.
  if (isAdvisor && !isAdmin) {
    return <Navigate to="/app/advisor" replace />;
  }
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

  useEffect(() => {
    if (!user) return;
    const load = async () => {
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

  if (isApplicant) return <ApplicantDashboard />;

  const CohortIcon = cohortIcons[(cohort as any)?.cohorts?.icon] || Cpu;
  const cohortName = (cohort as any)?.cohorts?.name || "PEC";

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-5 max-w-[1200px]">
      {/* Hero */}
      <motion.div variants={item} className="relative overflow-hidden rounded-2xl border bg-card">
        <div className="absolute inset-0 bg-grid-animate pointer-events-none" />
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-accent/5 blur-3xl pointer-events-none" />

        <div className="relative p-6 sm:p-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-success status-pulse" />
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
                Mission Control · {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="text-[9px] font-mono bg-accent/10 text-accent-foreground border-accent/30">{currentMode}</Badge>
              <div className="badge-verified">
                <Shield className="h-2.5 w-2.5" />
                <span>{highestRole}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-start gap-8">
            <div className="flex-1 space-y-5">
              <div>
                <h1 className="font-display text-3xl sm:text-4xl font-bold leading-tight tracking-tight">
                  {getGreeting()}, {firstName}
                </h1>
                <div className="flex items-center gap-2 mt-2">
                  <CohortIcon className="h-3.5 w-3.5 text-accent-foreground" />
                  <span className="text-sm text-muted-foreground">{cohortName}</span>
                  {cohort && <span className="text-[10px] font-mono text-muted-foreground/60">· {cohort.role}</span>}
                </div>
              </div>

              {/* Purpose + stage context */}
              <div className="flex flex-wrap gap-2">
                {purposeTrack && (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent/5 border border-accent/15 cursor-pointer" onClick={() => navigate("/app/purpose")}>
                    <Compass className="h-3 w-3 text-accent-foreground" />
                    <span className="text-[10px] font-mono text-accent-foreground">{purposeTrack.title}</span>
                    <Badge variant="outline" className="text-[8px] font-mono">{PHASE_LABELS[purposeTrack.current_phase]}</Badge>
                  </div>
                )}
                {currentStage && (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/5 border border-primary/15">
                    <Target className="h-3 w-3 text-primary" />
                    <span className="text-[10px] font-mono text-primary">Phase: {currentStage.name}</span>
                  </div>
                )}
              </div>

              {/* Next Moves with engagement tags */}
              <div className="space-y-2 max-w-md">
                <div className="flex items-center gap-2 mb-0.5">
                  <Sparkles className="h-3 w-3 text-accent-foreground" />
                  <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground">Your Next Moves</span>
                  <InfoDot tip="Ranked by urgency. Each shows what it advances — Purpose, Competition, or Contract." />
                </div>
                {nextMoves.length === 0 ? (
                  <div className="glass rounded-xl p-4">
                    <p className="text-sm font-semibold leading-tight">
                      {isLead ? "Inbox is clear." : "Nothing urgent right now."}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {isLead
                        ? "No deliverables waiting on your review. When team members submit work, it'll appear here."
                        : labManual
                          ? "Continue your training playbook to stay ready for live engagements."
                          : "Open Cohort Hub or Projects to see what's in flight."}
                    </p>
                    <div className="flex gap-2 mt-3">
                      {labManual && (
                        <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => navigate(`/app/lab/${labManual.id}`)}>
                          <BookOpen className="h-3 w-3 mr-1" /> Open playbook
                        </Button>
                      )}
                      <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => navigate("/app/projects")}>
                        <FolderKanban className="h-3 w-3 mr-1" /> View projects
                      </Button>
                      {isLead && (
                        <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => navigate("/app/review")}>
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Review queue
                        </Button>
                      )}
                    </div>
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
                          <p className="text-[10px] text-muted-foreground mt-0.5">{move.sublabel}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-[9px] font-mono text-accent-foreground/70">{move.reason}</p>
                            {eng && (
                              <Badge variant="outline" className="text-[8px] font-mono gap-0.5 py-0">
                                <eng.icon className={`h-2 w-2 ${eng.color}`} />
                                {eng.label}
                              </Badge>
                            )}
                          </div>
                        </div>
                        {i === 0 && (
                          <Button size="sm" variant={move.urgent ? "destructive" : "default"} className="shrink-0 gap-1 h-7 text-[10px]">
                            <Play className="h-2.5 w-2.5" />Resume
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right column */}
            <div className="flex flex-col gap-4 min-w-[200px]">
              {/* Capacity card */}
              <div className="glass rounded-xl p-4 text-center">
                <p className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground mb-2">Capacity Split</p>
                {capacity ? (
                  <div className="flex justify-center gap-3">
                    {capacity.purpose_pct > 0 && <CapChip label="Purpose" pct={capacity.purpose_pct} color="bg-accent" />}
                    {capacity.competition_pct > 0 && <CapChip label="Comp" pct={capacity.competition_pct} color="bg-warning" />}
                    {capacity.contract_pct > 0 && <CapChip label="Contract" pct={capacity.contract_pct} color="bg-primary" />}
                  </div>
                ) : (
                  <div className="flex justify-center"><CapChip label="Purpose" pct={100} color="bg-accent" /></div>
                )}
              </div>

              {mockProject && (
                <motion.div whileHover={{ scale: 1.02 }} className="glass rounded-xl p-4 cursor-pointer text-center card-hover" onClick={() => navigate(`/app/mock-project/${mockProject.id}`)}>
                  <Target className="h-4 w-4 text-accent-foreground mx-auto mb-1.5" />
                  <p className="text-xs font-semibold truncate">{mockProject.title}</p>
                  <p className="text-[10px] text-muted-foreground capitalize mt-0.5">{mockProject.status}</p>
                </motion.div>
              )}
              {labManual && (
                <motion.div whileHover={{ scale: 1.02 }} className="glass rounded-xl p-4 cursor-pointer text-center card-hover" onClick={() => navigate(`/app/lab/${labManual.id}`)}>
                  <BookOpen className="h-4 w-4 text-accent-foreground mx-auto mb-1.5" />
                  <p className="text-xs font-semibold truncate">{labManual.title}</p>
                  <p className="text-[10px] text-muted-foreground">Continue Playbook</p>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div variants={item} className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <StatTile icon={FolderKanban} label="Projects" value={stats.activeProjects} />
        <StatTile icon={AlertTriangle} label="Overdue" value={stats.overdueDeliverables} variant={stats.overdueDeliverables > 0 ? "destructive" : "default"} />
        <StatTile icon={CalendarDays} label="Events" value={stats.upcomingEvents} />
        <StatTile icon={Users} label="Members" value={stats.totalMembers} />
      </motion.div>

      {/* Main grid */}
      <div className="grid gap-5 lg:grid-cols-12">
        <div className="lg:col-span-7 space-y-5">
          <motion.div variants={item}>
            <Card className="overflow-hidden">
              <CardHeader className="flex-row items-center justify-between py-3 px-5">
                <CardTitle className="text-sm font-sans font-semibold flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-accent-foreground" />My Deliverables
                  <InfoDot tip="Required outputs you must submit. Each shows what engagement it advances." />
                </CardTitle>
                <Button variant="ghost" size="sm" className="text-[10px] font-mono h-7" onClick={() => navigate("/app/projects")}>View all <ArrowRight className="ml-1 h-3 w-3" /></Button>
              </CardHeader>
              <CardContent className="pt-0 px-5 pb-4">
                {deliverables.length === 0 ? (
                  <EmptyState icon={CheckCircle2} text="All clear — no pending deliverables." />
                ) : (
                  <div className="space-y-0.5">
                    {deliverables.slice(0, 6).map((d: any) => {
                      const eng = ENGAGEMENT_LABELS[d.engagement_type || "purpose"];
                      return (
                        <motion.div key={d.id} whileHover={{ x: 2 }} className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/40 transition-all cursor-pointer group" onClick={() => navigate(`/app/projects/${d.project_id}`)}>
                          <div className={`h-2 w-2 rounded-full shrink-0 ${d.due_date && new Date(d.due_date) < new Date() && d.approval_status !== "approved" ? "bg-destructive animate-pulse" : "bg-muted-foreground/30"}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate leading-tight">{d.title}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">{(d.projects as any)?.name}</p>
                          </div>
                          {eng && <Badge variant="outline" className="text-[8px] font-mono gap-0.5 py-0 shrink-0"><eng.icon className={`h-2 w-2 ${eng.color}`} />{eng.label}</Badge>}
                          <DeliverableStatusBadge status={d.approval_status} fileUrl={d.file_url} dueDate={d.due_date} approvalRequired={d.approval_required} />
                          {d.due_date && (
                            <span className={`text-[10px] font-mono ${new Date(d.due_date) < new Date() && d.approval_status !== "approved" ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
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
        </div>

        <div className="lg:col-span-5 space-y-5">
          <motion.div variants={item}>
            <Card>
              <CardHeader className="py-3 px-5">
                <CardTitle className="text-sm font-sans font-semibold flex items-center gap-2">
                  <Megaphone className="h-3.5 w-3.5 text-accent-foreground" /> Announcements
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 px-5 pb-4">
                {announcements.length === 0 ? <p className="text-[11px] text-muted-foreground text-center py-4">No announcements yet.</p> : (
                  <div className="space-y-3">{announcements.map((a: any) => (
                    <div key={a.id} className="border-l-2 border-accent/40 pl-3">
                      <p className="text-sm font-medium leading-tight">{a.title}</p>
                      <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{a.body}</p>
                      <p className="text-[9px] text-muted-foreground font-mono mt-1">{new Date(a.created_at).toLocaleDateString()}</p>
                    </div>
                  ))}</div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={item}>
            <Card>
              <CardHeader className="py-3 px-5">
                <CardTitle className="text-sm font-sans font-semibold">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 px-5 pb-3 space-y-0.5">
                {[
                  { icon: Compass, label: "Purpose Track", path: "/app/purpose" },
                  { icon: Cpu, label: "Cohort Hub", path: "/app/cohort" },
                  { icon: Rocket, label: "Opportunities", path: "/app/opportunities" },
                  { icon: FolderKanban, label: "Projects", path: "/app/projects" },
                  { icon: MessageSquare, label: "Messages", path: "/app/messages" },
                  { icon: CalendarDays, label: "Events", path: "/app/events" },
                  { icon: FileText, label: "Documents", path: "/app/docs" },
                ].map((a) => (
                  <Button key={a.path} variant="ghost" size="sm" className="w-full justify-start h-8 text-[11px] font-sans" onClick={() => navigate(a.path)}>
                    <a.icon className="mr-2 h-3.5 w-3.5 text-muted-foreground" /> {a.label}
                  </Button>
                ))}
              </CardContent>
            </Card>
          </motion.div>

          {(isBoardOrAdmin || highestRole === "project_lead") && (
            <motion.div variants={item}>
              <Card className="border-accent/20">
                <CardHeader className="py-3 px-5">
                  <CardTitle className="text-sm font-sans font-semibold flex items-center gap-2">
                    <Shield className="h-3.5 w-3.5 text-accent-foreground" /> Leadership
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 px-5 pb-3 grid grid-cols-2 gap-2">
                  {[
                    { label: "Lead Workspace", path: "/app/lead", icon: Briefcase },
                    { label: "Members", path: "/app/members", icon: Users },
                    ...(isAdmin ? [
                      { label: "Command Center", path: "/app/command", icon: Shield },
                      { label: "Opportunities", path: "/app/opportunities", icon: Rocket },
                    ] : []),
                  ].map((m) => (
                    <Button key={m.path} variant="outline" className="h-auto flex-col py-3 text-[10px] gap-1.5 card-hover" onClick={() => navigate(m.path)}>
                      <m.icon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{m.label}</span>
                    </Button>
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      </div>
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
