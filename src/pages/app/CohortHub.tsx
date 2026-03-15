import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Users, BookOpen, Target, ChevronRight, Cpu, Wrench, Code, Briefcase, Plus, Settings2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";

const cohortIcons: Record<string, any> = { cpu: Cpu, wrench: Wrench, code: Code, briefcase: Briefcase };
const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.25 } } };

export default function CohortHub() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [membership, setMembership] = useState<any>(null);
  const [cohort, setCohort] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [mockProjects, setMockProjects] = useState<any[]>([]);
  const [manuals, setManuals] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createMPDialog, setCreateMPDialog] = useState(false);
  const [createLabDialog, setCreateLabDialog] = useState(false);

  const isLeader = membership?.role === "pm" || membership?.role === "lead" || membership?.role === "integration_lead";

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: cm } = await supabase.from("cohort_memberships").select("*, cohorts(*)").eq("user_id", user.id).limit(1).maybeSingle();
      if (!cm) { setLoading(false); return; }
      setMembership(cm);
      setCohort((cm as any).cohorts);
      const cohortId = cm.cohort_id;

      const [membersRes, projRes, manualRes] = await Promise.all([
        supabase.from("cohort_memberships").select("*, profiles:user_id(full_name, avatar_url, major)").eq("cohort_id", cohortId).order("role"),
        supabase.from("mock_projects").select("*").eq("cohort_id", cohortId),
        supabase.from("lab_manuals").select("*").eq("cohort_id", cohortId),
      ]);
      setMembers(membersRes.data || []);
      setMockProjects(projRes.data || []);
      setManuals(manualRes.data || []);

      // Get stages for first mock project
      if (projRes.data && projRes.data.length > 0) {
        const { data: stageData } = await supabase.from("project_stages").select("*").eq("mock_project_id", projRes.data[0].id).order("order_index");
        setStages(stageData || []);
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const handleCreateMockProject = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const { data, error } = await supabase.from("mock_projects").insert({
      cohort_id: cohort.id,
      title: f.get("title") as string,
      scenario: f.get("scenario") as string,
      objectives: f.get("objectives") as string,
      deliverables_desc: f.get("deliverables") as string,
      status: "active",
    }).select().single();
    if (error) { toast.error(error.message); return; }

    // Create default stages
    if (data) {
      const defaultStages = [
        { name: "Kickoff", order_index: 0, status: "active" },
        { name: "Discovery", order_index: 1, status: "locked" },
        { name: "Midpoint", order_index: 2, status: "locked" },
        { name: "Final", order_index: 3, status: "locked" },
        { name: "Retro", order_index: 4, status: "locked" },
      ];
      await supabase.from("project_stages").insert(defaultStages.map(s => ({ ...s, mock_project_id: data.id })));
    }

    toast.success("Mock project created with lifecycle stages");
    setCreateMPDialog(false);
    window.location.reload();
  };

  const handleCreateLabManual = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const { error } = await supabase.from("lab_manuals").insert({
      cohort_id: cohort.id,
      title: f.get("title") as string,
      description: f.get("description") as string,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Lab manual created");
    setCreateLabDialog(false);
    window.location.reload();
  };

  if (loading) {
    return <div className="space-y-4">{[1, 2, 3].map(i => <Card key={i} className="h-32 animate-pulse bg-muted/30" />)}</div>;
  }

  if (!cohort) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Cpu className="h-16 w-16 text-muted-foreground/30 mb-4" />
        <h2 className="font-display text-xl font-bold mb-2">No Cohort Assigned</h2>
        <p className="text-muted-foreground text-sm max-w-sm">You haven't been assigned to a cohort yet. Contact your admin or PM.</p>
      </div>
    );
  }

  const Icon = cohortIcons[cohort.icon] || Cpu;
  const roleOrder = ["pm", "lead", "integration_lead", "member"];
  const sortedMembers = [...members].sort((a, b) => roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role));
  const roleBadgeColor = (role: string) => role === "pm" ? "default" : role === "lead" || role === "integration_lead" ? "secondary" : "outline";

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6 max-w-5xl">
      {/* Cohort Header */}
      <motion.div variants={item} className="relative overflow-hidden rounded-2xl border bg-card p-6">
        <div className="absolute inset-0 bg-grid opacity-20 pointer-events-none" />
        <div className="absolute top-0 right-0 w-48 h-48 bg-accent/5 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl" />
        <div className="relative flex items-center gap-5">
          <div className="h-16 w-16 rounded-2xl bg-accent/10 flex items-center justify-center border border-accent/20">
            <Icon className="h-8 w-8 text-accent" />
          </div>
          <div className="flex-1">
            <h1 className="font-display text-2xl font-bold">{cohort.name}</h1>
            <p className="text-sm text-muted-foreground">{cohort.description}</p>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant={roleBadgeColor(membership.role) as any} className="text-[10px] font-mono uppercase">{membership.role}</Badge>
              <span className="text-[10px] font-mono text-muted-foreground">{members.length} members</span>
            </div>
          </div>
          {isLeader && (
            <div className="flex gap-2">
              <Dialog open={createMPDialog} onOpenChange={setCreateMPDialog}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="gap-1.5 text-xs"><Target className="h-3.5 w-3.5" />New Project</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Create Mock Project</DialogTitle></DialogHeader>
                  <form onSubmit={handleCreateMockProject} className="space-y-4">
                    <div className="space-y-2"><Label>Title</Label><Input name="title" required placeholder="Autonomous Assembly Fixture" /></div>
                    <div className="space-y-2"><Label>Scenario</Label><Textarea name="scenario" placeholder="A local manufacturing firm needs..." rows={3} /></div>
                    <div className="space-y-2"><Label>Objectives</Label><Textarea name="objectives" placeholder="Design, prototype, and test..." rows={2} /></div>
                    <div className="space-y-2"><Label>Deliverables</Label><Textarea name="deliverables" placeholder="Charter, research report, CAD models..." rows={2} /></div>
                    <Button type="submit" className="w-full">Create Project</Button>
                  </form>
                </DialogContent>
              </Dialog>
              <Dialog open={createLabDialog} onOpenChange={setCreateLabDialog}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="gap-1.5 text-xs"><BookOpen className="h-3.5 w-3.5" />New Lab Manual</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Create Lab Manual</DialogTitle></DialogHeader>
                  <form onSubmit={handleCreateLabManual} className="space-y-4">
                    <div className="space-y-2"><Label>Title</Label><Input name="title" required placeholder="CAD Fundamentals Lab" /></div>
                    <div className="space-y-2"><Label>Description</Label><Textarea name="description" placeholder="Step-by-step guide to..." rows={3} /></div>
                    <Button type="submit" className="w-full">Create Manual</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>
      </motion.div>

      {/* Project Stages Timeline */}
      {stages.length > 0 && (
        <motion.div variants={item}>
          <Card>
            <CardHeader className="py-4">
              <CardTitle className="text-base font-sans font-semibold flex items-center gap-2">
                <Target className="h-4 w-4 text-accent" /> Project Lifecycle
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center gap-2">
                {stages.map((stage, i) => (
                  <div key={stage.id} className="flex items-center gap-2 flex-1">
                    <div className={`flex-1 rounded-lg p-3 text-center border transition-all ${
                      stage.status === "completed" ? "bg-success/10 border-success/30 text-success" :
                      stage.status === "active" ? "bg-accent/10 border-accent/30 text-accent glow-accent" :
                      "bg-muted/30 border-border/50 text-muted-foreground"
                    }`}>
                      <p className="text-[10px] font-mono uppercase tracking-wider">{stage.name}</p>
                      <p className="text-[9px] mt-0.5 capitalize">{stage.status}</p>
                    </div>
                    {i < stages.length - 1 && <div className="w-4 h-px bg-border shrink-0" />}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Team Roster */}
        <motion.div variants={item} className="lg:col-span-1">
          <Card>
            <CardHeader className="py-4">
              <CardTitle className="text-base font-sans font-semibold flex items-center gap-2">
                <Users className="h-4 w-4 text-accent" /> Team ({members.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-1.5">
              {sortedMembers.map((m: any) => (
                <motion.div key={m.id} whileHover={{ x: 2 }} className="flex items-center gap-3 py-1.5 rounded-lg px-2 hover:bg-muted/30 transition-colors">
                  <div className="h-7 w-7 rounded-full bg-accent/10 flex items-center justify-center text-xs font-bold text-accent">
                    {(m.profiles as any)?.full_name?.[0] || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{(m.profiles as any)?.full_name}</p>
                  </div>
                  <Badge variant={roleBadgeColor(m.role) as any} className="text-[9px] font-mono uppercase shrink-0">{m.role}</Badge>
                </motion.div>
              ))}
            </CardContent>
          </Card>
        </motion.div>

        {/* Mock Projects + Lab Manuals */}
        <div className="lg:col-span-2 space-y-6">
          <motion.div variants={item}>
            <Card>
              <CardHeader className="py-4 flex-row items-center justify-between">
                <CardTitle className="text-base font-sans font-semibold flex items-center gap-2">
                  <Target className="h-4 w-4 text-accent" /> Mock Projects
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {mockProjects.length === 0 ? (
                  <div className="flex flex-col items-center py-8 text-muted-foreground">
                    <Target className="h-8 w-8 mb-2 opacity-30" />
                    <p className="text-sm">No mock projects yet.</p>
                    {isLeader && <p className="text-xs mt-1">Create one using the button above.</p>}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {mockProjects.map((p: any) => (
                      <motion.div
                        key={p.id}
                        whileHover={{ x: 2 }}
                        className="rounded-xl border p-4 cursor-pointer hover:border-accent/50 transition-all group"
                        onClick={() => navigate(`/app/mock-project/${p.id}`)}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="text-sm font-semibold">{p.title}</h3>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.scenario || "No scenario defined"}</p>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground/0 group-hover:text-muted-foreground transition-colors shrink-0" />
                        </div>
                        <Badge variant="outline" className="mt-2 text-[9px] font-mono">{p.status}</Badge>
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={item}>
            <Card>
              <CardHeader className="py-4 flex-row items-center justify-between">
                <CardTitle className="text-base font-sans font-semibold flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-accent" /> Lab Manuals
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {manuals.length === 0 ? (
                  <div className="flex flex-col items-center py-8 text-muted-foreground">
                    <BookOpen className="h-8 w-8 mb-2 opacity-30" />
                    <p className="text-sm">No lab manuals yet.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {manuals.map((m: any) => (
                      <motion.div
                        key={m.id}
                        whileHover={{ x: 2 }}
                        className="rounded-xl border p-4 cursor-pointer hover:border-accent/50 transition-all group"
                        onClick={() => navigate(`/app/lab/${m.id}`)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-sm font-semibold">{m.title}</h3>
                            <p className="text-xs text-muted-foreground">{m.description}</p>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground/0 group-hover:text-muted-foreground transition-colors" />
                        </div>
                        <span className="text-[10px] font-mono text-muted-foreground">v{m.version}</span>
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
