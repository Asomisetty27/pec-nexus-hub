import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Briefcase, Plus, CheckCircle2, Clock, AlertTriangle,
  Users, Mail, FileText, Target, Building2, ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const item = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.2 } } };

const CATEGORIES = ["outreach", "sponsorship", "logistics", "documentation", "planning"];
const STATUSES = ["todo", "in_progress", "blocked", "done"];

export default function OpsDashboard() {
  const { user, isAdmin } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [sponsors, setSponsors] = useState<any[]>([]);
  const [cohortId, setCohortId] = useState<string | null>(null);
  const [taskDialog, setTaskDialog] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const cohortRes = await supabase.from("cohort_memberships").select("cohort_id").eq("user_id", user.id).limit(1).maybeSingle();
      const cId = cohortRes.data?.cohort_id;
      setCohortId(cId || null);

      const [taskRes, leadRes, sponsorRes] = await Promise.all([
        supabase.from("ops_tasks").select("*, profiles:assignee_id(full_name)").order("created_at", { ascending: false }),
        supabase.from("leads").select("*, organizations(name)").order("updated_at", { ascending: false }).limit(20),
        supabase.from("sponsorship_packages").select("*, organizations(name)").order("created_at", { ascending: false }).limit(20),
      ]);
      setTasks((taskRes.data as any[]) || []);
      setLeads(leadRes.data || []);
      setSponsors(sponsorRes.data || []);
    };
    load();
  }, [user]);

  const createTask = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const { error } = await supabase.from("ops_tasks").insert({
      title: f.get("title") as string,
      description: f.get("description") as string,
      category: f.get("category") as string,
      priority: f.get("priority") as string,
      due_date: (f.get("due_date") as string) || null,
      created_by: user!.id,
      cohort_id: cohortId,
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success("Task created");
    setTaskDialog(false);
    const { data } = await supabase.from("ops_tasks").select("*, profiles:assignee_id(full_name)").order("created_at", { ascending: false });
    setTasks((data as any[]) || []);
  };

  const updateTaskStatus = async (id: string, status: string) => {
    await supabase.from("ops_tasks").update({ status } as any).eq("id", id);
    setTasks(ts => ts.map(t => t.id === id ? { ...t, status } : t));
  };

  const statusIcon = (s: string) => {
    if (s === "done") return <CheckCircle2 className="h-3 w-3 text-success" />;
    if (s === "blocked") return <AlertTriangle className="h-3 w-3 text-destructive" />;
    if (s === "in_progress") return <Clock className="h-3 w-3 text-warning" />;
    return <div className="h-3 w-3 rounded-full border border-muted-foreground/30" />;
  };

  const categoryColor = (c: string) => {
    const map: Record<string, string> = {
      outreach: "bg-blue-500/10 text-blue-600", sponsorship: "bg-accent/10 text-accent-foreground",
      logistics: "bg-purple-500/10 text-purple-600", documentation: "bg-emerald-500/10 text-emerald-600",
      planning: "bg-orange-500/10 text-orange-600",
    };
    return map[c] || "bg-muted text-muted-foreground";
  };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6 max-w-5xl">
      <motion.div variants={item} className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Ops Command</h1>
          <p className="text-xs text-muted-foreground font-mono">Outreach · Sponsorship · Logistics · Internal Ops</p>
        </div>
        <Dialog open={taskDialog} onOpenChange={setTaskDialog}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2"><Plus className="h-3.5 w-3.5" />New Task</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Ops Task</DialogTitle></DialogHeader>
            <form onSubmit={createTask} className="space-y-4">
              <div className="space-y-2"><Label>Title</Label><Input name="title" required /></div>
              <div className="space-y-2"><Label>Description</Label><Textarea name="description" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select name="category" defaultValue="outreach">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select name="priority" defaultValue="medium">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2"><Label>Due Date</Label><Input name="due_date" type="date" /></div>
              <Button type="submit" className="w-full">Create Task</Button>
            </form>
          </DialogContent>
        </Dialog>
      </motion.div>

      {/* Summary stats */}
      <motion.div variants={item} className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <StatCard icon={Target} label="Active Tasks" value={tasks.filter(t => t.status !== "done").length} />
        <StatCard icon={AlertTriangle} label="Blocked" value={tasks.filter(t => t.status === "blocked").length} variant="destructive" />
        <StatCard icon={Building2} label="Leads" value={leads.length} />
        <StatCard icon={Briefcase} label="Sponsors" value={sponsors.length} />
      </motion.div>

      <Tabs defaultValue="tasks">
        <TabsList>
          <TabsTrigger value="tasks">Tasks ({tasks.length})</TabsTrigger>
          <TabsTrigger value="leads">Leads ({leads.length})</TabsTrigger>
          <TabsTrigger value="sponsors">Sponsors ({sponsors.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="mt-4 space-y-2">
          {STATUSES.map(status => {
            const filtered = tasks.filter(t => t.status === status);
            if (filtered.length === 0) return null;
            return (
              <motion.div key={status} variants={item}>
                <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5 mt-3 first:mt-0">
                  {status.replace("_", " ")} ({filtered.length})
                </p>
                <div className="space-y-1.5">
                  {filtered.map(t => (
                    <Card key={t.id} className="hover:border-accent/30 transition-colors">
                      <CardContent className="flex items-center gap-3 p-3">
                        <button onClick={() => updateTaskStatus(t.id, t.status === "done" ? "todo" : t.status === "todo" ? "in_progress" : "done")}>
                          {statusIcon(t.status)}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium truncate ${t.status === "done" ? "line-through text-muted-foreground" : ""}`}>{t.title}</p>
                          {t.description && <p className="text-[10px] text-muted-foreground truncate">{t.description}</p>}
                        </div>
                        <Badge className={`text-[9px] font-mono ${categoryColor(t.category)}`}>{t.category}</Badge>
                        {t.due_date && (
                          <span className={`text-[10px] font-mono ${new Date(t.due_date) < new Date() && t.status !== "done" ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                            {new Date(t.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </TabsContent>

        <TabsContent value="leads" className="mt-4 space-y-2">
          {leads.length === 0 ? (
            <Card className="flex flex-col items-center py-12">
              <Mail className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">No leads yet. Start outreach!</p>
            </Card>
          ) : leads.map(l => (
            <motion.div key={l.id} variants={item}>
              <Card className="hover:border-accent/30 transition-colors">
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="h-9 w-9 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                    <Users className="h-4 w-4 text-accent-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{l.contact_name}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">{l.contact_email || "No email"} · {l.source}</p>
                  </div>
                  <Badge variant="outline" className="text-[9px] font-mono capitalize">{l.stage}</Badge>
                  {l.value && <span className="text-[10px] font-mono text-accent-foreground">${l.value.toLocaleString()}</span>}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </TabsContent>

        <TabsContent value="sponsors" className="mt-4 space-y-2">
          {sponsors.length === 0 ? (
            <Card className="flex flex-col items-center py-12">
              <Building2 className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">No sponsorship packages yet.</p>
            </Card>
          ) : sponsors.map(s => (
            <motion.div key={s.id} variants={item}>
              <Card>
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{s.name}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">{(s.organizations as any)?.name} · {s.tier}</p>
                  </div>
                  {s.amount && <span className="text-sm font-mono font-bold">${s.amount.toLocaleString()}</span>}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}

function StatCard({ icon: Icon, label, value, variant }: { icon: any; label: string; value: number; variant?: string }) {
  return (
    <Card className="card-hover">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${variant === "destructive" && value > 0 ? "bg-destructive/10" : "bg-muted/50"}`}>
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
