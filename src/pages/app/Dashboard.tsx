import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FolderKanban, CheckCircle2, CalendarDays, Megaphone, ArrowRight, Clock, AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

export default function Dashboard() {
  const { user, profile, roles, highestRole, isAdmin, isBoardOrAdmin } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [stats, setStats] = useState({ activeProjects: 0, overdueTasks: 0, upcomingEvents: 0 });

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [projRes, taskRes, annRes] = await Promise.all([
        supabase.from("projects").select("*, project_memberships!inner(user_id)").eq("project_memberships.user_id", user.id).eq("status", "active").limit(5),
        supabase.from("tasks").select("*, projects(name)").eq("assignee_id", user.id).in("status", ["todo", "in_progress"]).order("due_date", { ascending: true }).limit(10),
        supabase.from("announcements").select("*").order("created_at", { ascending: false }).limit(5),
      ]);
      setProjects(projRes.data || []);
      setTasks(taskRes.data || []);
      setAnnouncements(annRes.data || []);
      setStats({
        activeProjects: projRes.data?.length || 0,
        overdueTasks: (taskRes.data || []).filter((t: any) => t.due_date && new Date(t.due_date) < new Date()).length,
        upcomingEvents: 0,
      });
    };
    load();
  }, [user]);

  const isApplicant = highestRole === "applicant";

  const fade = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } };

  return (
    <div className="space-y-6">
      <motion.div {...fade}>
        <h1 className="font-display text-3xl font-bold">
          {isApplicant ? "Welcome to PEC Nexus" : `Welcome back, ${profile?.full_name?.split(" ")[0] || "there"}`}
        </h1>
        <p className="text-muted-foreground mt-1">
          {isApplicant ? "Your application is being reviewed. Complete your onboarding steps below." : "Here's what's happening across your projects."}
        </p>
      </motion.div>

      {isApplicant ? (
        <ApplicantDashboard />
      ) : (
        <>
          {/* Stats row */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
            <StatCard icon={FolderKanban} label="Active Projects" value={stats.activeProjects} />
            <StatCard icon={AlertTriangle} label="Overdue Tasks" value={stats.overdueTasks} variant={stats.overdueTasks > 0 ? "destructive" : "default"} />
            <StatCard icon={CalendarDays} label="Upcoming Events" value={stats.upcomingEvents} />
          </div>

          {/* Main grid */}
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              {/* My Tasks */}
              <Card>
                <CardHeader className="flex-row items-center justify-between">
                  <CardTitle className="text-lg">My Tasks</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => navigate("/app/projects")}>View all <ArrowRight className="ml-1 h-3 w-3" /></Button>
                </CardHeader>
                <CardContent>
                  {tasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">No tasks assigned yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {tasks.map((task: any) => (
                        <div key={task.id} className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors">
                          <CheckCircle2 className={`h-4 w-4 shrink-0 ${task.status === "done" ? "text-success" : "text-muted-foreground"}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{task.title}</p>
                            <p className="text-xs text-muted-foreground">{(task as any).projects?.name}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={task.priority === "urgent" ? "destructive" : task.priority === "high" ? "default" : "secondary"} className="text-[10px]">
                              {task.priority}
                            </Badge>
                            {task.due_date && (
                              <span className={`text-xs ${new Date(task.due_date) < new Date() ? "text-destructive" : "text-muted-foreground"}`}>
                                <Clock className="inline h-3 w-3 mr-1" />
                                {new Date(task.due_date).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* My Projects */}
              <Card>
                <CardHeader className="flex-row items-center justify-between">
                  <CardTitle className="text-lg">My Projects</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => navigate("/app/projects")}>View all <ArrowRight className="ml-1 h-3 w-3" /></Button>
                </CardHeader>
                <CardContent>
                  {projects.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">You're not part of any projects yet.</p>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {projects.map((p: any) => (
                        <div key={p.id} className="rounded-lg border p-4 hover:bg-muted/50 cursor-pointer transition-colors" onClick={() => navigate(`/app/projects/${p.id}`)}>
                          <h3 className="font-medium text-sm">{p.name}</h3>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.description || "No description"}</p>
                          <Badge variant="outline" className="mt-2 text-[10px]">{p.status}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Sidebar column */}
            <div className="space-y-6">
              {/* Announcements */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Announcements</CardTitle>
                </CardHeader>
                <CardContent>
                  {announcements.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No announcements.</p>
                  ) : (
                    <div className="space-y-3">
                      {announcements.map((a: any) => (
                        <div key={a.id} className="border-l-2 border-accent pl-3">
                          <p className="text-sm font-medium">{a.title}</p>
                          <p className="text-xs text-muted-foreground line-clamp-2">{a.body}</p>
                          <p className="text-[10px] text-muted-foreground mt-1">{new Date(a.created_at).toLocaleDateString()}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Quick actions */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => navigate("/app/projects")}>
                    <FolderKanban className="mr-2 h-4 w-4" /> View Projects
                  </Button>
                  <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => navigate("/app/events")}>
                    <CalendarDays className="mr-2 h-4 w-4" /> Upcoming Events
                  </Button>
                  <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => navigate("/app/academy")}>
                    <Megaphone className="mr-2 h-4 w-4" /> Training Academy
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Admin metrics */}
          {isAdmin && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Admin Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-4">
                  <Button variant="outline" className="h-auto flex-col py-4" onClick={() => navigate("/app/admin")}>
                    <span className="text-2xl font-bold">—</span>
                    <span className="text-xs text-muted-foreground">Pending Approvals</span>
                  </Button>
                  <Button variant="outline" className="h-auto flex-col py-4" onClick={() => navigate("/app/admin")}>
                    <span className="text-2xl font-bold">—</span>
                    <span className="text-xs text-muted-foreground">Total Members</span>
                  </Button>
                  <Button variant="outline" className="h-auto flex-col py-4" onClick={() => navigate("/app/analytics")}>
                    <span className="text-2xl font-bold">—</span>
                    <span className="text-xs text-muted-foreground">Active Projects</span>
                  </Button>
                  <Button variant="outline" className="h-auto flex-col py-4" onClick={() => navigate("/app/crm")}>
                    <span className="text-2xl font-bold">—</span>
                    <span className="text-xs text-muted-foreground">Pipeline Leads</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function ApplicantDashboard() {
  const { profile } = useAuth();
  const steps = [
    { label: "Create account", done: true },
    { label: "Verify email", done: true },
    { label: "Complete profile", done: !!profile?.major && !!profile?.bio },
    { label: "Admin review", done: false },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Onboarding Checklist</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium ${
                s.done ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"
              }`}>
                {s.done ? "✓" : i + 1}
              </div>
              <span className={`text-sm ${s.done ? "line-through text-muted-foreground" : ""}`}>{s.label}</span>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-muted-foreground">Complete your profile to speed up the review process.</p>
        <Button className="mt-3" asChild><a href="/app/settings">Complete Profile</a></Button>
      </CardContent>
    </Card>
  );
}

function StatCard({ icon: Icon, label, value, variant = "default" }: { icon: any; label: string; value: number; variant?: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${variant === "destructive" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
