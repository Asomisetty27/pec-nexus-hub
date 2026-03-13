import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProgressRing } from "@/components/ui/ProgressRing";
import {
  FolderKanban, CheckCircle2, CalendarDays, Megaphone, ArrowRight, Clock,
  AlertTriangle, Zap, BookOpen, MessageSquare, Cpu, ChevronRight, Rocket,
} from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.25 } } };

export default function Dashboard() {
  const { user, profile, roles, highestRole, isAdmin, isBoardOrAdmin } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [cohort, setCohort] = useState<any>(null);
  const [cohortProgress, setCohortProgress] = useState(0);
  const [stats, setStats] = useState({ activeProjects: 0, overdueTasks: 0, upcomingEvents: 0 });

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
        // Calculate progress from submissions
        const { count } = await supabase.from("submissions").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "approved");
        setCohortProgress(Math.min((count || 0) * 15, 100));
      }
      setStats({
        activeProjects: projRes.data?.length || 0,
        overdueTasks: (taskRes.data || []).filter((t: any) => t.due_date && new Date(t.due_date) < new Date()).length,
        upcomingEvents: 0,
      });
    };
    load();
  }, [user]);

  const isApplicant = highestRole === "applicant";
  const firstName = profile?.full_name?.split(" ")[0] || "there";

  // Compute "next move"
  const nextMove = tasks.length > 0
    ? { label: `Complete: ${tasks[0]?.title}`, action: () => navigate("/app/projects"), icon: CheckCircle2 }
    : cohort
    ? { label: "Continue Lab Manual", action: () => navigate("/app/cohort"), icon: BookOpen }
    : { label: "Explore Projects", action: () => navigate("/app/projects"), icon: FolderKanban };

  if (isApplicant) return <ApplicantDashboard />;

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6 max-w-6xl">
      {/* Hero Section */}
      <motion.div variants={item} className="relative overflow-hidden rounded-2xl border bg-card p-6 sm:p-8">
        <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="flex-1">
            <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1">
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold mb-2">
              Welcome back, {firstName}
            </h1>
            <p className="text-muted-foreground text-sm mb-4">Here's your mission briefing.</p>

            {/* Next Move CTA */}
            <Button
              onClick={nextMove.action}
              className="group gap-2 rounded-xl shadow-lg shadow-primary/10"
            >
              <Zap className="h-4 w-4" />
              {nextMove.label}
              <ChevronRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
            </Button>
          </div>

          {/* Cohort Identity Card */}
          {cohort && (
            <div className="flex items-center gap-4 p-4 rounded-xl glass">
              <ProgressRing progress={cohortProgress} size={64} strokeWidth={5}>
                <Cpu className="h-5 w-5 text-accent" />
              </ProgressRing>
              <div>
                <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">{(cohort as any).cohorts?.name || "Cohort"}</p>
                <p className="text-sm font-semibold capitalize">{cohort.role}</p>
                <p className="text-xs text-muted-foreground">{cohortProgress}% complete</p>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Stats Row */}
      <motion.div variants={item} className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <StatTile icon={FolderKanban} label="Active Projects" value={stats.activeProjects} />
        <StatTile icon={AlertTriangle} label="Overdue" value={stats.overdueTasks} variant={stats.overdueTasks > 0 ? "destructive" : "default"} />
        <StatTile icon={CalendarDays} label="Events" value={stats.upcomingEvents} />
        <StatTile icon={MessageSquare} label="Unread" value={0} />
      </motion.div>

      {/* Main Grid */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Left: Tasks + Projects */}
        <div className="lg:col-span-3 space-y-6">
          <motion.div variants={item}>
            <Card className="overflow-hidden">
              <CardHeader className="flex-row items-center justify-between py-4">
                <CardTitle className="text-base font-sans font-semibold">My Tasks</CardTitle>
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate("/app/projects")}>
                  View all <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </CardHeader>
              <CardContent className="pt-0">
                {tasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">No tasks assigned yet.</p>
                ) : (
                  <div className="space-y-1">
                    {tasks.slice(0, 5).map((task: any) => (
                      <motion.div
                        key={task.id}
                        whileHover={{ x: 2 }}
                        className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/50 transition-colors cursor-pointer group"
                      >
                        <div className={`h-2 w-2 rounded-full shrink-0 ${
                          task.priority === "urgent" ? "bg-destructive" :
                          task.priority === "high" ? "bg-warning" : "bg-muted-foreground/30"
                        }`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{task.title}</p>
                          <p className="text-[11px] text-muted-foreground font-mono">{(task as any).projects?.name}</p>
                        </div>
                        {task.due_date && (
                          <span className={`text-[11px] font-mono ${new Date(task.due_date) < new Date() ? "text-destructive" : "text-muted-foreground"}`}>
                            {new Date(task.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                        )}
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
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate("/app/projects")}>
                  View all <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </CardHeader>
              <CardContent className="pt-0">
                {projects.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">You're not part of any projects yet.</p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {projects.map((p: any) => (
                      <motion.div
                        key={p.id}
                        whileHover={{ scale: 1.01 }}
                        className="rounded-xl border p-4 hover:border-accent/50 cursor-pointer transition-all duration-200"
                        onClick={() => navigate(`/app/projects/${p.id}`)}
                      >
                        <div className="flex items-start justify-between mb-1">
                          <h3 className="font-medium text-sm">{p.name}</h3>
                          <Badge variant="outline" className="text-[9px] font-mono shrink-0">{p.status}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">{p.description || "No description"}</p>
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Right sidebar */}
        <div className="lg:col-span-2 space-y-6">
          {/* Announcements */}
          <motion.div variants={item}>
            <Card>
              <CardHeader className="py-4">
                <CardTitle className="text-base font-sans font-semibold flex items-center gap-2">
                  <Megaphone className="h-4 w-4 text-accent" /> Announcements
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {announcements.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No announcements.</p>
                ) : (
                  <div className="space-y-3">
                    {announcements.map((a: any) => (
                      <div key={a.id} className="border-l-2 border-accent pl-3">
                        <p className="text-sm font-medium">{a.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2">{a.body}</p>
                        <p className="text-[10px] text-muted-foreground font-mono mt-1">{new Date(a.created_at).toLocaleDateString()}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Quick Actions */}
          <motion.div variants={item}>
            <Card>
              <CardHeader className="py-4">
                <CardTitle className="text-base font-sans font-semibold">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-1">
                {[
                  { icon: FolderKanban, label: "View Projects", path: "/app/projects" },
                  { icon: CalendarDays, label: "Upcoming Events", path: "/app/events" },
                  { icon: Cpu, label: "Cohort Hub", path: "/app/cohort" },
                  { icon: BookOpen, label: "Training Academy", path: "/app/academy" },
                ].map((a) => (
                  <Button key={a.path} variant="ghost" size="sm" className="w-full justify-start h-9 text-xs" onClick={() => navigate(a.path)}>
                    <a.icon className="mr-2 h-3.5 w-3.5" /> {a.label}
                  </Button>
                ))}
              </CardContent>
            </Card>
          </motion.div>

          {/* Admin metrics */}
          {isAdmin && (
            <motion.div variants={item}>
              <Card>
                <CardHeader className="py-4">
                  <CardTitle className="text-base font-sans font-semibold">Admin Overview</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 grid grid-cols-2 gap-2">
                  {[
                    { label: "Approvals", path: "/app/admin" },
                    { label: "Members", path: "/app/members" },
                    { label: "Projects", path: "/app/analytics" },
                    { label: "Pipeline", path: "/app/crm" },
                  ].map((m) => (
                    <Button key={m.path} variant="outline" className="h-auto flex-col py-3 text-xs" onClick={() => navigate(m.path)}>
                      <span className="text-lg font-bold font-mono">—</span>
                      <span className="text-muted-foreground">{m.label}</span>
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
        <h1 className="font-display text-3xl font-bold">Welcome to PEC Nexus</h1>
        <p className="text-muted-foreground mt-2">Your application is being reviewed. Complete your profile below.</p>
      </div>
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-center mb-6">
            <ProgressRing progress={progress} size={100} strokeWidth={6}>
              <span className="text-lg font-bold">{Math.round(progress)}%</span>
            </ProgressRing>
          </div>
          <div className="space-y-3">
            {steps.map((s, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  s.done ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"
                }`}>
                  {s.done ? "✓" : i + 1}
                </div>
                <span className={`text-sm ${s.done ? "line-through text-muted-foreground" : "font-medium"}`}>{s.label}</span>
              </div>
            ))}
          </div>
          <Button className="mt-6 w-full" onClick={() => navigate("/app/settings")}>Complete Profile</Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function StatTile({ icon: Icon, label, value, variant = "default" }: { icon: any; label: string; value: number; variant?: string }) {
  return (
    <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.15 }}>
      <Card className="overflow-hidden">
        <CardContent className="flex items-center gap-3 p-4">
          <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${
            variant === "destructive" ? "bg-destructive/10 text-destructive" : "bg-accent/10 text-accent"
          }`}>
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xl font-bold font-mono">{value}</p>
            <p className="text-[11px] text-muted-foreground">{label}</p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
