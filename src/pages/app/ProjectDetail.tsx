import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, ArrowLeft, Users, Target, FileOutput, AlertTriangle, BookOpen, Clock } from "lucide-react";
import { toast } from "sonner";

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [project, setProject] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [deliverables, setDeliverables] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [risks, setRisks] = useState<any[]>([]);
  const [decisions, setDecisions] = useState<any[]>([]);
  const [updates, setUpdates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [taskDialog, setTaskDialog] = useState(false);

  const fetchAll = async () => {
    if (!id) return;
    setLoading(true);
    const [pRes, tRes, mRes, dRes, memRes, rRes, decRes, uRes] = await Promise.all([
      supabase.from("projects").select("*, organizations(name)").eq("id", id).single(),
      supabase.from("tasks").select("*, profiles:assignee_id(full_name)").eq("project_id", id).order("created_at", { ascending: false }),
      supabase.from("milestones").select("*").eq("project_id", id).order("due_date"),
      supabase.from("deliverables").select("*").eq("project_id", id).order("created_at", { ascending: false }),
      supabase.from("project_memberships").select("*, profiles:user_id(full_name, avatar_url)").eq("project_id", id),
      supabase.from("risks").select("*").eq("project_id", id),
      supabase.from("decisions").select("*").eq("project_id", id).order("decided_at", { ascending: false }),
      supabase.from("project_updates").select("*").eq("project_id", id).order("created_at", { ascending: false }).limit(5),
    ]);
    setProject(pRes.data);
    setTasks(tRes.data || []);
    setMilestones(mRes.data || []);
    setDeliverables(dRes.data || []);
    setMembers(memRes.data || []);
    setRisks(rRes.data || []);
    setDecisions(decRes.data || []);
    setUpdates(uRes.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, [id]);

  const handleCreateTask = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const { error } = await supabase.from("tasks").insert({
      project_id: id,
      title: f.get("title") as string,
      description: f.get("description") as string,
      priority: f.get("priority") as string || "medium",
      status: "todo",
      created_by: user!.id,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Task created");
    setTaskDialog(false);
    fetchAll();
  };

  const updateTaskStatus = async (taskId: string, status: string) => {
    await supabase.from("tasks").update({ status }).eq("id", taskId);
    fetchAll();
  };

  if (loading) return <div className="flex items-center justify-center py-12"><div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" /></div>;
  if (!project) return <div className="text-center py-12"><p className="text-muted-foreground">Project not found</p></div>;

  const columns = ["todo", "in_progress", "review", "done"];
  const columnLabels: Record<string, string> = { todo: "To Do", in_progress: "In Progress", review: "Review", done: "Done" };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/app/projects")}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex-1">
          <h1 className="font-display text-2xl font-bold">{project.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge>{project.status}</Badge>
            {project.organizations?.name && <Badge variant="outline">{project.organizations.name}</Badge>}
          </div>
        </div>
      </div>

      <Tabs defaultValue="board" className="space-y-4">
        <TabsList>
          <TabsTrigger value="board">Task Board</TabsTrigger>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="milestones">Milestones</TabsTrigger>
          <TabsTrigger value="deliverables">Deliverables</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="risks">Risks</TabsTrigger>
          <TabsTrigger value="decisions">Decisions</TabsTrigger>
        </TabsList>

        <TabsContent value="board">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">{tasks.length} tasks</p>
            <Dialog open={taskDialog} onOpenChange={setTaskDialog}>
              <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-3 w-3" /> Add Task</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>New Task</DialogTitle></DialogHeader>
                <form onSubmit={handleCreateTask} className="space-y-4">
                  <div className="space-y-2"><Label>Title</Label><Input name="title" required /></div>
                  <div className="space-y-2"><Label>Description</Label><Textarea name="description" /></div>
                  <div className="space-y-2">
                    <Label>Priority</Label>
                    <Select name="priority" defaultValue="medium">
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" className="w-full">Create</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-4">
            {columns.map(col => (
              <div key={col} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">{columnLabels[col]}</h3>
                  <Badge variant="secondary" className="text-[10px]">{tasks.filter(t => t.status === col).length}</Badge>
                </div>
                <div className="space-y-2 min-h-[100px] rounded-lg bg-muted/30 p-2">
                  {tasks.filter(t => t.status === col).map(task => (
                    <Card key={task.id} className="cursor-pointer hover:border-primary/30">
                      <CardContent className="p-3">
                        <p className="text-sm font-medium">{task.title}</p>
                        <div className="flex items-center justify-between mt-2">
                          <Badge variant={task.priority === "urgent" ? "destructive" : "secondary"} className="text-[10px]">{task.priority}</Badge>
                          {task.due_date && <span className="text-[10px] text-muted-foreground">{new Date(task.due_date).toLocaleDateString()}</span>}
                        </div>
                        <div className="flex gap-1 mt-2">
                          {columns.filter(c => c !== col).map(c => (
                            <Button key={c} variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={() => updateTaskStatus(task.id, c)}>
                              → {columnLabels[c]}
                            </Button>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="overview">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div><span className="text-muted-foreground">Description:</span> <p>{project.description || "—"}</p></div>
                <div><span className="text-muted-foreground">Scope:</span> <p>{project.scope || "—"}</p></div>
                <div className="flex gap-4">
                  <div><span className="text-muted-foreground">Start:</span> {project.start_date || "—"}</div>
                  <div><span className="text-muted-foreground">End:</span> {project.end_date || "—"}</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Recent Updates</CardTitle></CardHeader>
              <CardContent>
                {updates.length === 0 ? <p className="text-sm text-muted-foreground">No updates yet.</p> : (
                  <div className="space-y-3">
                    {updates.map(u => (
                      <div key={u.id} className="border-l-2 pl-3" style={{ borderColor: u.health === "green" ? "var(--success)" : u.health === "yellow" ? "var(--warning)" : "var(--destructive)" }}>
                        <p className="text-sm">{u.summary}</p>
                        <p className="text-[10px] text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="milestones">
          <div className="space-y-3">
            {milestones.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No milestones yet.</p> : milestones.map(m => (
              <Card key={m.id}>
                <CardContent className="flex items-center gap-4 p-4">
                  <Target className="h-5 w-5 text-primary shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">{m.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-[10px]">{m.status}</Badge>
                      {m.due_date && <span className="text-xs text-muted-foreground">{new Date(m.due_date).toLocaleDateString()}</span>}
                    </div>
                    <div className="mt-2 h-2 w-full rounded-full bg-muted">
                      <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${m.progress}%` }} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="deliverables">
          {deliverables.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No deliverables yet.</p> : (
            <div className="space-y-2">
              {deliverables.map(d => (
                <Card key={d.id}>
                  <CardContent className="flex items-center gap-4 p-4">
                    <FileOutput className="h-5 w-5 text-primary shrink-0" />
                    <div className="flex-1">
                      <p className="font-medium text-sm">{d.title}</p>
                      <p className="text-xs text-muted-foreground">v{d.version}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {d.client_visible && <Badge variant="outline" className="text-[10px]">Client visible</Badge>}
                      {d.approved && <Badge className="text-[10px] bg-success">Approved</Badge>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="team">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {members.map(m => (
              <Card key={m.id}>
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                    {(m.profiles as any)?.full_name?.charAt(0) || "?"}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{(m.profiles as any)?.full_name || "Unknown"}</p>
                    <Badge variant="outline" className="text-[10px]">{m.role_on_project}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="risks">
          {risks.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No risks registered.</p> : (
            <div className="space-y-2">
              {risks.map(r => (
                <Card key={r.id}>
                  <CardContent className="flex items-center gap-4 p-4">
                    <AlertTriangle className={`h-5 w-5 shrink-0 ${r.severity === "critical" ? "text-destructive" : r.severity === "high" ? "text-warning" : "text-muted-foreground"}`} />
                    <div className="flex-1">
                      <p className="font-medium text-sm">{r.title}</p>
                      <p className="text-xs text-muted-foreground">{r.mitigation || "No mitigation plan"}</p>
                    </div>
                    <Badge variant={r.status === "open" ? "destructive" : "secondary"} className="text-[10px]">{r.status}</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="decisions">
          {decisions.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No decisions logged.</p> : (
            <div className="space-y-2">
              {decisions.map(d => (
                <Card key={d.id}>
                  <CardContent className="p-4">
                    <p className="font-medium text-sm">{d.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{d.rationale}</p>
                    <p className="text-[10px] text-muted-foreground mt-2">{new Date(d.decided_at).toLocaleDateString()}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
