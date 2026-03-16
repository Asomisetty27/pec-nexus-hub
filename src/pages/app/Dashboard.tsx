import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProgressRing } from "@/components/ui/ProgressRing";
import {
  FolderKanban, CheckCircle2, CalendarDays, Megaphone, ArrowRight,
  AlertTriangle, Zap, BookOpen, MessageSquare, Cpu, ChevronRight,
  Target, Sparkles, Play, GraduationCap, Shield, Users, BarChart3,
  Clock, Activity, Wrench, Code, Briefcase, FileText, Award,
} from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

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

export default function Dashboard() {
  const { user, profile, highestRole, isAdmin, isBoardOrAdmin } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [cohort, setCohort] = useState<any>(null);
  const [cohortProgress, setCohortProgress] = useState(0);
  const [labManual, setLabManual] = useState<any>(null);
  const [mockProject, setMockProject] = useState<any>(null);
  const [currentStage, setCurrentStage] = useState<any>(null);
  const [rosterMembers, setRosterMembers] = useState<any[]>([]);
  const [stats, setStats] = useState({ activeProjects: 0, overdueTasks: 0, upcomingEvents: 0, totalMembers: 0 });

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [projRes, taskRes, annRes, cohortRes] = await Promise.all([
        supabase.from("projects").select("*, project_memberships!inner(user_id)").eq("project_memberships.user_id", user.id).eq("status", "active").limit(5),
        supabase.from("tasks").select("*, projects(name)").eq("assignee_id", user.id).in("status", ["todo", "in_progress"]).order("due_date", { ascending: true }).limit(10),
        supabase.from("announcements").select("*").order("created_at", { ascending: false }).limit(3),
        supabase.from("cohort_memberships").select("*, cohorts(*)").eq("user_id", user.id).limit(1).maybeSingle(),
      ]);
      setProjects(projRes.data || []);
      setTasks(taskRes.data || []);
      setAnnouncements(annRes.data || []);

      if (cohortRes.data) {
        setCohort(cohortRes.data);
        const cohortId = cohortRes.data.cohort_id;
        const [subsRes, manualRes, mpRes, rosterRes] = await Promise.all([
          supabase.from("submissions").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "approved"),
          supabase.from("lab_manuals").select("*").eq("cohort_id", cohortId).limit(1).maybeSingle(),
          supabase.from("mock_projects").select("*").eq("cohort_id", cohortId).eq("status", "active").limit(1).maybeSingle(),
          supabase.from("cohort_memberships").select("*, profiles:user_id(full_name)").eq("cohort_id", cohortId).order("role"),
        ]);
        setCohortProgress(Math.min((subsRes.count || 0) * 15, 100));
        setLabManual(manualRes.data);
        setMockProject(mpRes.data);
        setRosterMembers(rosterRes.data || []);
        if (mpRes.data) {
          const { data: stage } = await supabase.from("project_stages").select("*").eq("mock_project_id", mpRes.data.id).eq("status", "active").order("order_index").limit(1).maybeSingle();
          setCurrentStage(stage);
        }
      }

      const [eventRes, memberRes] = await Promise.all([
        supabase.from("events").select("*", { count: "exact", head: true }).gte("start_time", new Date().toISOString()),
        supabase.from("profiles").select("*", { count: "exact", head: true }),
      ]);
      setStats({
        activeProjects: projRes.data?.length || 0,
        overdueTasks: (taskRes.data || []).filter((t: any) => t.due_date && new Date(t.due_date) < new Date()).length,
        upcomingEvents: eventRes.count || 0,
        totalMembers: memberRes.count || 0,
      });
    };
    load();
  }, [user]);

  const isApplicant = highestRole === "applicant";
  const firstName = profile?.full_name?.split(" ")[0] || "Operator";

  const computeNextMove = () => {
    const overdueTasks = tasks.filter(t => t.due_date && new Date(t.due_date) < new Date());
    if (overdueTasks.length > 0) return { label: overdueTasks[0].title, sublabel: "Overdue — immediate action required", action: () => navigate("/app/projects"), icon: AlertTriangle, urgent: true };
    if (tasks.length > 0) return { label: tasks[0].title, sublabel: `Next task · ${(tasks[0] as any).projects?.name || ""}`, action: () => navigate("/app/projects"), icon: CheckCircle2, urgent: false };
    if (labManual) return { label: "Continue Lab Manual", sublabel: labManual.title, action: () => navigate(`/app/lab/${labManual.id}`), icon: BookOpen, urgent: false };
    return { label: "Explore Projects", sublabel: "Browse active projects", action: () => navigate("/app/projects"), icon: FolderKanban, urgent: false };
  };
  const nextMove = computeNextMove();

  if (isApplicant) return <ApplicantDashboard />;

  const CohortIcon = cohortIcons[(cohort as any)?.cohorts?.icon] || Cpu;
  const cohortName = (cohort as any)?.cohorts?.name || "PEC";

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-5 max-w-[1200px]">
      {/* ── HERO: Mission Control ── */}
      <motion.div variants={item} className="relative overflow-hidden rounded-2xl border bg-card">
        <div className="absolute inset-0 bg-grid-animate pointer-events-none" />
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-accent/5 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full bg-primary/5 blur-3xl pointer-events-none" />

        <div className="relative p-6 sm:p-8">
          {/* Top bar: date + status */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-success status-pulse" />
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
                {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              </span>
            </div>
            <div className="badge-verified">
              <Shield className="h-2.5 w-2.5" />
              <span>{highestRole}</span>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-start gap-8">
            {/* Left: Greeting + Next Move */}
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

              {/* Current Phase */}
              {currentStage && (
                <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-accent/5 border border-accent/15">
                  <div className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                  <Target className="h-3 w-3 text-accent-foreground" />
                  <span className="text-[11px] font-mono uppercase tracking-wider text-accent-foreground">Phase: {currentStage.name}</span>
                </div>
              )}

              {/* Next Move Card */}
              <div className={`glass-strong rounded-xl p-5 max-w-md ${nextMove.urgent ? "border-destructive/30" : ""}`}>
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-3 w-3 text-accent-foreground" />
                  <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground">Your Next Move</span>
                </div>
                <div className="flex items-start gap-3">
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${nextMove.urgent ? "bg-destructive/10" : "bg-accent/10"}`}>
                    <nextMove.icon className={`h-4 w-4 ${nextMove.urgent ? "text-destructive" : "text-accent-foreground"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold leading-tight">{nextMove.label}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{nextMove.sublabel}</p>
                  </div>
                </div>
                <Button size="sm" onClick={nextMove.action} className="mt-4 gap-2 rounded-lg w-full justify-center" variant={nextMove.urgent ? "destructive" : "default"}>
                  <Play className="h-3 w-3" />Resume Work
                  <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Right: Cohort + Project status */}
            <div className="flex flex-col gap-4 min-w-[200px]">
              {cohort && (
                <div className="glass-strong rounded-xl p-5 flex flex-col items-center text-center">
                  <ProgressRing progress={cohortProgress} size={88} strokeWidth={5}>
                    <CohortIcon className="h-6 w-6 text-accent-foreground" />
                  </ProgressRing>
                  <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mt-3">{cohortName}</p>
                  <p className="text-2xl font-bold font-mono mt-1">{cohortProgress}%</p>
                  <p className="text-[10px] text-muted-foreground">Training Progress</p>
                </div>
              )}
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
                  <p className="text-[10px] text-muted-foreground">Continue Lab</p>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── STATS ROW ── */}
      <motion.div variants={item} className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <StatTile icon={FolderKanban} label="Active Projects" value={stats.activeProjects} />
        <StatTile icon={AlertTriangle} label="Overdue" value={stats.overdueTasks} variant={stats.overdueTasks > 0 ? "destructive" : "default"} />
        <StatTile icon={CalendarDays} label="Events" value={stats.upcomingEvents} />
        <StatTile icon={Users} label="Members" value={stats.totalMembers} />
      </motion.div>

      {/* ── MAIN GRID ── */}
      <div className="grid gap-5 lg:grid-cols-12">
        {/* Left column: Tasks + Projects */}
        <div className="lg:col-span-7 space-y-5">
          <motion.div variants={item}>
            <Card className="overflow-hidden">
              <CardHeader className="flex-row items-center justify-between py-3 px-5">
                <CardTitle className="text-sm font-sans font-semibold flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-accent-foreground" />My Tasks
                </CardTitle>
                <Button variant="ghost" size="sm" className="text-[10px] font-mono h-7" onClick={() => navigate("/app/projects")}>View all <ArrowRight className="ml-1 h-3 w-3" /></Button>
              </CardHeader>
              <CardContent className="pt-0 px-5 pb-4">
                {tasks.length === 0 ? (
                  <EmptyState icon={CheckCircle2} text="All clear — no pending tasks" />
                ) : (
                  <div className="space-y-0.5">
                    {tasks.slice(0, 6).map((task: any) => (
                      <motion.div key={task.id} whileHover={{ x: 2 }} className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/40 transition-all cursor-pointer group">
                        <div className={`h-2 w-2 rounded-full shrink-0 ${task.priority === "urgent" ? "bg-destructive animate-pulse" : task.priority === "high" ? "bg-warning" : "bg-muted-foreground/30"}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate leading-tight">{task.title}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{(task as any).projects?.name}</p>
                        </div>
                        {task.due_date && (
                          <span className={`text-[10px] font-mono ${new Date(task.due_date) < new Date() ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                            {new Date(task.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                        )}
                        <ChevronRight className="h-3 w-3 text-transparent group-hover:text-muted-foreground transition-colors" />
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={item}>
            <Card>
              <CardHeader className="flex-row items-center justify-between py-3 px-5">
                <CardTitle className="text-sm font-sans font-semibold flex items-center gap-2">
                  <FolderKanban className="h-3.5 w-3.5 text-accent-foreground" />My Projects
                </CardTitle>
                <Button variant="ghost" size="sm" className="text-[10px] font-mono h-7" onClick={() => navigate("/app/projects")}>View all <ArrowRight className="ml-1 h-3 w-3" /></Button>
              </CardHeader>
              <CardContent className="pt-0 px-5 pb-4">
                {projects.length === 0 ? (
                  <EmptyState icon={FolderKanban} text="No active projects" />
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {projects.map((p: any) => (
                      <motion.div key={p.id} whileHover={{ scale: 1.01 }} className="rounded-xl border p-4 card-hover cursor-pointer" onClick={() => navigate(`/app/projects/${p.id}`)}>
                        <div className="flex items-start justify-between mb-1">
                          <h3 className="font-medium text-sm leading-tight">{p.name}</h3>
                          <Badge variant="outline" className="text-[9px] font-mono shrink-0">{p.status}</Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground line-clamp-2">{p.description || "No description"}</p>
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Right column: Activity + Quick Actions */}
        <div className="lg:col-span-5 space-y-5">
          {/* Cohort team mini-roster */}
          {rosterMembers.length > 0 && (
            <motion.div variants={item}>
              <Card className="card-hover cursor-pointer" onClick={() => navigate("/app/cohort")}>
                <CardHeader className="py-3 px-5">
                  <CardTitle className="text-sm font-sans font-semibold flex items-center gap-2">
                    <CohortIcon className="h-3.5 w-3.5 text-accent-foreground" /> Cohort Team
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 px-5 pb-4">
                  <div className="flex items-center -space-x-2">
                    {rosterMembers.slice(0, 8).map((m: any) => (
                      <div key={m.id} className="h-7 w-7 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold text-secondary-foreground border-2 border-card" title={(m.profiles as any)?.full_name}>
                        {(m.profiles as any)?.full_name?.[0] || "?"}
                      </div>
                    ))}
                    {rosterMembers.length > 8 && (
                      <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-mono text-muted-foreground border-2 border-card">+{rosterMembers.length - 8}</div>
                    )}
                  </div>
                  <p className="text-[10px] font-mono text-muted-foreground mt-2">{rosterMembers.length} members · View cohort hub →</p>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Announcements */}
          <motion.div variants={item}>
            <Card>
              <CardHeader className="py-3 px-5">
                <CardTitle className="text-sm font-sans font-semibold flex items-center gap-2">
                  <Megaphone className="h-3.5 w-3.5 text-accent-foreground" /> Announcements
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 px-5 pb-4">
                {announcements.length === 0 ? <p className="text-[11px] text-muted-foreground text-center py-4">No announcements.</p> : (
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

          {/* Quick Actions */}
          <motion.div variants={item}>
            <Card>
              <CardHeader className="py-3 px-5">
                <CardTitle className="text-sm font-sans font-semibold">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 px-5 pb-3 space-y-0.5">
                {[
                  { icon: Cpu, label: "Cohort Hub", path: "/app/cohort" },
                  { icon: FolderKanban, label: "Projects", path: "/app/projects" },
                  { icon: MessageSquare, label: "Messages", path: "/app/messages" },
                  { icon: CalendarDays, label: "Events", path: "/app/events" },
                  { icon: GraduationCap, label: "Academy", path: "/app/academy" },
                  { icon: FileText, label: "Documents", path: "/app/docs" },
                ].map((a) => (
                  <Button key={a.path} variant="ghost" size="sm" className="w-full justify-start h-8 text-[11px] font-sans" onClick={() => navigate(a.path)}>
                    <a.icon className="mr-2 h-3.5 w-3.5 text-muted-foreground" /> {a.label}
                  </Button>
                ))}
              </CardContent>
            </Card>
          </motion.div>

          {/* Admin panel */}
          {isAdmin && (
            <motion.div variants={item}>
              <Card className="border-accent/20">
                <CardHeader className="py-3 px-5">
                  <CardTitle className="text-sm font-sans font-semibold flex items-center gap-2">
                    <Shield className="h-3.5 w-3.5 text-accent-foreground" /> Admin
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 px-5 pb-3 grid grid-cols-2 gap-2">
                  {[
                    { label: "Approvals", path: "/app/admin", icon: Shield },
                    { label: "Members", path: "/app/members", icon: Users },
                    { label: "Analytics", path: "/app/analytics", icon: BarChart3 },
                    { label: "Pipeline", path: "/app/crm", icon: Activity },
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

/* ── Sub-components ── */

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
