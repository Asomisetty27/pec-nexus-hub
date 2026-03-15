import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProgressRing } from "@/components/ui/ProgressRing";
import {
  FolderKanban, CheckCircle2, CalendarDays, Megaphone, ArrowRight,
  AlertTriangle, Zap, BookOpen, MessageSquare, Cpu, ChevronRight,
  Target, Sparkles, Play, GraduationCap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.25 } } };

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function Dashboard() {
  const { user, profile, highestRole, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [cohort, setCohort] = useState<any>(null);
  const [cohortProgress, setCohortProgress] = useState(0);
  const [labManual, setLabManual] = useState<any>(null);
  const [mockProject, setMockProject] = useState<any>(null);
  const [currentStage, setCurrentStage] = useState<any>(null);
  const [stats, setStats] = useState({ activeProjects: 0, overdueTasks: 0, upcomingEvents: 0, unreadMessages: 0 });

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
        const [subsRes, manualRes, mpRes] = await Promise.all([
          supabase.from("submissions").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "approved"),
          supabase.from("lab_manuals").select("*").eq("cohort_id", cohortId).limit(1).maybeSingle(),
          supabase.from("mock_projects").select("*").eq("cohort_id", cohortId).eq("status", "active").limit(1).maybeSingle(),
        ]);
        setCohortProgress(Math.min((subsRes.count || 0) * 15, 100));
        setLabManual(manualRes.data);
        setMockProject(mpRes.data);
        if (mpRes.data) {
          const { data: stage } = await supabase.from("project_stages").select("*").eq("mock_project_id", mpRes.data.id).eq("status", "active").order("order_index").limit(1).maybeSingle();
          setCurrentStage(stage);
        }
      }

      const { count: eventCount } = await supabase.from("events").select("*", { count: "exact", head: true }).gte("start_time", new Date().toISOString());
      setStats({
        activeProjects: projRes.data?.length || 0,
        overdueTasks: (taskRes.data || []).filter((t: any) => t.due_date && new Date(t.due_date) < new Date()).length,
        upcomingEvents: eventCount || 0,
        unreadMessages: 0,
      });
    };
    load();
  }, [user]);

  const isApplicant = highestRole === "applicant";
  const firstName = profile?.full_name?.split(" ")[0] || "there";

  const computeNextMove = () => {
    const overdueTasks = tasks.filter(t => t.due_date && new Date(t.due_date) < new Date());
    if (overdueTasks.length > 0) return { label: overdueTasks[0].title, sublabel: "Overdue task", action: () => navigate("/app/projects"), icon: AlertTriangle, urgent: true };
    if (tasks.length > 0) return { label: tasks[0].title, sublabel: "Next task", action: () => navigate("/app/projects"), icon: CheckCircle2, urgent: false };
    if (labManual) return { label: "Continue Lab Manual", sublabel: labManual.title, action: () => navigate(`/app/lab/${labManual.id}`), icon: BookOpen, urgent: false };
    return { label: "Explore Projects", sublabel: "Browse active projects", action: () => navigate("/app/projects"), icon: FolderKanban, urgent: false };
  };
  const nextMove = computeNextMove();

  if (isApplicant) return <ApplicantDashboard />;

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6 max-w-6xl">
      {/* Cinematic Hero */}
      <motion.div variants={item} className="relative overflow-hidden rounded-2xl border bg-card p-6 sm:p-8">
        <div className="absolute inset-0 bg-grid opacity-30 pointer-events-none" />
        <div className="absolute top-0 right-0 w-80 h-80 bg-accent/5 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary/5 rounded-full translate-y-1/2 -translate-x-1/4 blur-3xl" />
        <div className="relative flex flex-col lg:flex-row lg:items-center gap-6">
          <div className="flex-1 space-y-4">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-2">
                {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              </p>
              <h1 className="font-display text-3xl sm:text-4xl font-bold leading-tight">{getGreeting()}, {firstName}</h1>
              {cohort && (
                <p className="text-sm text-muted-foreground mt-1">
                  {(cohort as any).cohorts?.name} · <span className="capitalize">{cohort.role}</span>
                </p>
              )}
            </div>
            {currentStage && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-accent/20 bg-accent/5">
                <Target className="h-3.5 w-3.5 text-accent" />
                <span className="text-xs font-mono uppercase tracking-wider text-accent">Phase: {currentStage.name}</span>
              </div>
            )}
            <div className={`glass rounded-xl p-4 max-w-md ${nextMove.urgent ? "border-destructive/30" : "border-accent/20"}`}>
              <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">
                <Sparkles className="inline h-3 w-3 mr-1" />Your Next Move
              </p>
              <p className="text-sm font-semibold mb-0.5">{nextMove.label}</p>
              <p className="text-xs text-muted-foreground mb-3">{nextMove.sublabel}</p>
              <Button size="sm" onClick={nextMove.action} className="group gap-2 rounded-lg" variant={nextMove.urgent ? "destructive" : "default"}>
                <Play className="h-3 w-3" />Resume Work
                <ChevronRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
              </Button>
            </div>
          </div>
          <div className="flex flex-col items-center gap-4">
            {cohort && (
              <div className="glass rounded-xl p-5 flex flex-col items-center text-center min-w-[180px]">
                <ProgressRing progress={cohortProgress} size={80} strokeWidth={5}>
                  <Cpu className="h-6 w-6 text-accent" />
                </ProgressRing>
                <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground mt-3">{(cohort as any).cohorts?.name || "Cohort"}</p>
                <p className="text-2xl font-bold font-mono mt-1">{cohortProgress}%</p>
                <p className="text-[10px] text-muted-foreground">Training Complete</p>
              </div>
            )}
            {mockProject && (
              <motion.div whileHover={{ scale: 1.02 }} className="glass rounded-xl p-4 cursor-pointer w-full text-center" onClick={() => navigate(`/app/mock-project/${mockProject.id}`)}>
                <Target className="h-4 w-4 text-accent mx-auto mb-1" />
                <p className="text-xs font-semibold truncate">{mockProject.title}</p>
                <p className="text-[10px] text-muted-foreground capitalize">{mockProject.status}</p>
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div variants={item} className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <StatTile icon={FolderKanban} label="Active Projects" value={stats.activeProjects} />
        <StatTile icon={AlertTriangle} label="Overdue" value={stats.overdueTasks} variant={stats.overdueTasks > 0 ? "destructive" : "default"} />
        <StatTile icon={CalendarDays} label="Events" value={stats.upcomingEvents} />
        <StatTile icon={MessageSquare} label="Unread" value={stats.unreadMessages} />
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3 space-y-6">
          <motion.div variants={item}>
            <Card className="overflow-hidden">
              <CardHeader className="flex-row items-center justify-between py-4">
                <CardTitle className="text-base font-sans font-semibold">My Tasks</CardTitle>
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate("/app/projects")}>View all <ArrowRight className="ml-1 h-3 w-3" /></Button>
              </CardHeader>
              <CardContent className="pt-0">
                {tasks.length === 0 ? (
                  <div className="flex flex-col items-center py-8 text-muted-foreground"><CheckCircle2 className="h-8 w-8 mb-2 opacity-30" /><p className="text-sm">All clear</p></div>
                ) : (
                  <div className="space-y-1">
                    {tasks.slice(0, 5).map((task: any) => (
                      <motion.div key={task.id} whileHover={{ x: 2 }} className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/50 transition-colors cursor-pointer group">
                        <div className={`h-2 w-2 rounded-full shrink-0 ${task.priority === "urgent" ? "bg-destructive animate-pulse" : task.priority === "high" ? "bg-warning" : "bg-muted-foreground/30"}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{task.title}</p>
                          <p className="text-[11px] text-muted-foreground font-mono">{(task as any).projects?.name}</p>
                        </div>
                        {task.due_date && <span className={`text-[11px] font-mono ${new Date(task.due_date) < new Date() ? "text-destructive font-semibold" : "text-muted-foreground"}`}>{new Date(task.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>}
                        <ChevronRight className="h-3 w-3 text-muted-foreground/0 group-hover:text-muted-foreground transition-colors" />
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
          <motion.div variants={item}>
            <Card>
              <CardHeader className="flex-row items-center justify-between py-4">
                <CardTitle className="text-base font-sans font-semibold">My Projects</CardTitle>
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate("/app/projects")}>View all <ArrowRight className="ml-1 h-3 w-3" /></Button>
              </CardHeader>
              <CardContent className="pt-0">
                {projects.length === 0 ? (
                  <div className="flex flex-col items-center py-8 text-muted-foreground"><FolderKanban className="h-8 w-8 mb-2 opacity-30" /><p className="text-sm">No active projects</p></div>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {projects.map((p: any) => (
                      <motion.div key={p.id} whileHover={{ scale: 1.01 }} className="rounded-xl border p-4 hover:border-accent/50 cursor-pointer transition-all duration-200" onClick={() => navigate(`/app/projects/${p.id}`)}>
                        <div className="flex items-start justify-between mb-1"><h3 className="font-medium text-sm">{p.name}</h3><Badge variant="outline" className="text-[9px] font-mono shrink-0">{p.status}</Badge></div>
                        <p className="text-xs text-muted-foreground line-clamp-2">{p.description || "No description"}</p>
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
        <div className="lg:col-span-2 space-y-6">
          {labManual && (
            <motion.div variants={item}>
              <Card className="cursor-pointer hover:border-accent/50 transition-all group overflow-hidden" onClick={() => navigate(`/app/lab/${labManual.id}`)}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-accent/10 flex items-center justify-center shrink-0"><BookOpen className="h-6 w-6 text-accent" /></div>
                  <div className="flex-1 min-w-0"><p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Resume Lab</p><p className="text-sm font-semibold truncate">{labManual.title}</p></div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/0 group-hover:text-muted-foreground transition-colors shrink-0" />
                </CardContent>
              </Card>
            </motion.div>
          )}
          <motion.div variants={item}>
            <Card>
              <CardHeader className="py-4"><CardTitle className="text-base font-sans font-semibold flex items-center gap-2"><Megaphone className="h-4 w-4 text-accent" /> Announcements</CardTitle></CardHeader>
              <CardContent className="pt-0">
                {announcements.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">No announcements.</p> : (
                  <div className="space-y-3">{announcements.map((a: any) => (<div key={a.id} className="border-l-2 border-accent pl-3"><p className="text-sm font-medium">{a.title}</p><p className="text-xs text-muted-foreground line-clamp-2">{a.body}</p><p className="text-[10px] text-muted-foreground font-mono mt-1">{new Date(a.created_at).toLocaleDateString()}</p></div>))}</div>
                )}
              </CardContent>
            </Card>
          </motion.div>
          <motion.div variants={item}>
            <Card>
              <CardHeader className="py-4"><CardTitle className="text-base font-sans font-semibold">Quick Actions</CardTitle></CardHeader>
              <CardContent className="pt-0 space-y-1">
                {[
                  { icon: Cpu, label: "Cohort Hub", path: "/app/cohort" },
                  { icon: FolderKanban, label: "View Projects", path: "/app/projects" },
                  { icon: CalendarDays, label: "Upcoming Events", path: "/app/events" },
                  { icon: GraduationCap, label: "Training Academy", path: "/app/academy" },
                ].map((a) => (
                  <Button key={a.path} variant="ghost" size="sm" className="w-full justify-start h-9 text-xs" onClick={() => navigate(a.path)}>
                    <a.icon className="mr-2 h-3.5 w-3.5" /> {a.label}
                  </Button>
                ))}
              </CardContent>
            </Card>
          </motion.div>
          {isAdmin && (
            <motion.div variants={item}>
              <Card>
                <CardHeader className="py-4"><CardTitle className="text-base font-sans font-semibold">Admin Overview</CardTitle></CardHeader>
                <CardContent className="pt-0 grid grid-cols-2 gap-2">
                  {[{ label: "Approvals", path: "/app/admin" }, { label: "Members", path: "/app/members" }, { label: "Analytics", path: "/app/analytics" }, { label: "Pipeline", path: "/app/crm" }].map((m) => (
                    <Button key={m.path} variant="outline" className="h-auto flex-col py-3 text-xs" onClick={() => navigate(m.path)}><span className="text-muted-foreground">{m.label}</span></Button>
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
      <div className="text-center"><h1 className="font-display text-3xl font-bold">Welcome to PEC Nexus</h1><p className="text-muted-foreground mt-2">Your application is being reviewed.</p></div>
      <Card><CardContent className="pt-6">
        <div className="flex justify-center mb-6"><ProgressRing progress={progress} size={100} strokeWidth={6}><span className="text-lg font-bold">{Math.round(progress)}%</span></ProgressRing></div>
        <div className="space-y-3">{steps.map((s, i) => (<div key={i} className="flex items-center gap-3"><div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold ${s.done ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"}`}>{s.done ? "✓" : i + 1}</div><span className={`text-sm ${s.done ? "line-through text-muted-foreground" : "font-medium"}`}>{s.label}</span></div>))}</div>
        <Button className="mt-6 w-full" onClick={() => navigate("/app/settings")}>Complete Profile</Button>
      </CardContent></Card>
    </motion.div>
  );
}

function StatTile({ icon: Icon, label, value, variant = "default" }: { icon: any; label: string; value: number; variant?: string }) {
  return (
    <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.15 }}>
      <Card className="overflow-hidden"><CardContent className="flex items-center gap-3 p-4">
        <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${variant === "destructive" ? "bg-destructive/10 text-destructive" : "bg-accent/10 text-accent"}`}><Icon className="h-4 w-4" /></div>
        <div><p className="text-xl font-bold font-mono">{value}</p><p className="text-[11px] text-muted-foreground">{label}</p></div>
      </CardContent></Card>
    </motion.div>
  );
}
