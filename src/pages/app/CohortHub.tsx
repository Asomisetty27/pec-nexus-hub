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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, BookOpen, Target, ChevronRight, Cpu, Wrench, Code, Briefcase, Plus, Shield, Activity, Award } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { SectionExplainer, InfoDot } from "@/components/ui/SectionExplainer";

const cohortIcons: Record<string, any> = { cpu: Cpu, wrench: Wrench, code: Code, briefcase: Briefcase };
const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.22 } } };

export default function CohortHub() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [membership, setMembership] = useState<any>(null);
  const [cohort, setCohort] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [mockProjects, setMockProjects] = useState<any[]>([]);
  const [manuals, setManuals] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  const [tracks, setTracks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createMPDialog, setCreateMPDialog] = useState(false);
  const [createLabDialog, setCreateLabDialog] = useState(false);
  const [createTrackDialog, setCreateTrackDialog] = useState(false);
  const [assignTrackDialog, setAssignTrackDialog] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<string>("");
  const [selectedMember, setSelectedMember] = useState<string>("");

  const isLeader = membership?.role === "pm" || membership?.role === "lead" || membership?.role === "integration_lead";

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: cm } = await supabase.from("cohort_memberships").select("*, cohorts(*)").eq("user_id", user.id).limit(1).maybeSingle();
      if (!cm) { setLoading(false); return; }
      setMembership(cm);
      setCohort((cm as any).cohorts);
      const cohortId = cm.cohort_id;

      const [membersRes, projRes, manualRes, tracksRes] = await Promise.all([
        supabase.from("cohort_memberships").select("*, profiles:user_id(full_name, avatar_url, major, user_id)").eq("cohort_id", cohortId).order("role"),
        supabase.from("mock_projects").select("*").eq("cohort_id", cohortId),
        supabase.from("lab_manuals").select("*").eq("cohort_id", cohortId),
        supabase.from("tracks").select("*").eq("cohort_id", cohortId),
      ]);
      setMembers(membersRes.data || []);
      setMockProjects(projRes.data || []);
      setManuals(manualRes.data || []);
      setTracks(tracksRes.data || []);

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
      cohort_id: cohort.id, title: f.get("title") as string, scenario: f.get("scenario") as string,
      objectives: f.get("objectives") as string, deliverables_desc: f.get("deliverables") as string, status: "active",
    }).select().single();
    if (error) { toast.error(error.message); return; }
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
      cohort_id: cohort.id, title: f.get("title") as string, description: f.get("description") as string,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Lab manual created");
    setCreateLabDialog(false);
    window.location.reload();
  };

  const handleCreateTrack = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const { error } = await supabase.from("tracks").insert({
      cohort_id: cohort.id, name: f.get("name") as string,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Track created");
    setCreateTrackDialog(false);
    window.location.reload();
  };

  const handleAssignTrack = async () => {
    if (!selectedTrack || !selectedMember) return;
    const { error } = await supabase.from("track_assignments").insert({
      track_id: selectedTrack, user_id: selectedMember,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Member assigned to track");
    setAssignTrackDialog(false);
  };

  if (loading) return <div className="space-y-4">{[1, 2, 3].map(i => <Card key={i} className="h-32 animate-pulse bg-muted/30" />)}</div>;

  if (!cohort) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Cpu className="h-16 w-16 text-muted-foreground/20 mb-4" />
        <h2 className="font-display text-xl font-bold mb-2">No Cohort Assigned</h2>
        <p className="text-muted-foreground text-sm max-w-sm">You haven't been assigned to a cohort yet. Contact your admin or PM.</p>
      </div>
    );
  }

  const Icon = cohortIcons[cohort.icon] || Cpu;
  const roleOrder = ["pm", "lead", "integration_lead", "member"];
  const sortedMembers = [...members].sort((a, b) => roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role));
  const roleBadgeVariant = (role: string) => role === "pm" ? "default" : role === "lead" || role === "integration_lead" ? "secondary" : "outline";
  const roleLabel = (role: string) => {
    if (role === "pm") return "PM";
    if (role === "lead") return "Tech Lead";
    if (role === "integration_lead") return "Integration Lead";
    return "Member";
  };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-5 max-w-[1100px]">
      {/* Header */}
      <motion.div variants={item} className="relative overflow-hidden rounded-2xl border bg-card">
        <div className="absolute inset-0 bg-grid-animate pointer-events-none" />
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-accent/5 blur-3xl pointer-events-none" />
        <div className="relative p-6">
          <div className="flex items-center gap-5">
            <div className="h-14 w-14 rounded-2xl bg-secondary flex items-center justify-center border border-border/50 glow-subtle">
              <Icon className="h-7 w-7 text-accent-foreground" />
            </div>
            <div className="flex-1">
              <h1 className="font-display text-2xl font-bold">{cohort.name}</h1>
              <SectionExplainer text="Your cohort hub — see your team, projects, and training materials in one place." className="mt-0.5" />
              <div className="flex items-center gap-2 mt-2">
                <Badge variant={roleBadgeVariant(membership.role) as any} className="text-[9px] font-mono uppercase">{roleLabel(membership.role)}</Badge>
                <span className="text-[10px] font-mono text-muted-foreground">{members.length} members</span>
              </div>
            </div>
            {isLeader && (
              <div className="flex flex-wrap gap-2">
                <Dialog open={createMPDialog} onOpenChange={setCreateMPDialog}>
                  <DialogTrigger asChild><Button size="sm" variant="outline" className="gap-1.5 text-[10px]"><Target className="h-3 w-3" />New Project</Button></DialogTrigger>
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
                  <DialogTrigger asChild><Button size="sm" variant="outline" className="gap-1.5 text-[10px]"><BookOpen className="h-3 w-3" />New Lab</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Create Lab Manual</DialogTitle></DialogHeader>
                    <form onSubmit={handleCreateLabManual} className="space-y-4">
                      <div className="space-y-2"><Label>Title</Label><Input name="title" required placeholder="CAD Fundamentals Lab" /></div>
                      <div className="space-y-2"><Label>Description</Label><Textarea name="description" placeholder="Step-by-step guide to..." rows={3} /></div>
                      <Button type="submit" className="w-full">Create Manual</Button>
                    </form>
                  </DialogContent>
                </Dialog>
                <Dialog open={createTrackDialog} onOpenChange={setCreateTrackDialog}>
                  <DialogTrigger asChild><Button size="sm" variant="outline" className="gap-1.5 text-[10px]"><Plus className="h-3 w-3" />New Track</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Create Track</DialogTitle></DialogHeader>
                    <form onSubmit={handleCreateTrack} className="space-y-4">
                      <div className="space-y-2"><Label>Track Name</Label><Input name="name" required placeholder="CAD Beginner" /></div>
                      <Button type="submit" className="w-full">Create Track</Button>
                    </form>
                  </DialogContent>
                </Dialog>
                <Dialog open={assignTrackDialog} onOpenChange={setAssignTrackDialog}>
                  <DialogTrigger asChild><Button size="sm" variant="outline" className="gap-1.5 text-[10px]"><Users className="h-3 w-3" />Assign Track</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Assign Member to Track</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Member</Label>
                        <Select value={selectedMember} onValueChange={setSelectedMember}>
                          <SelectTrigger><SelectValue placeholder="Select member" /></SelectTrigger>
                          <SelectContent>
                            {members.filter(m => m.role === "member").map(m => (
                              <SelectItem key={m.user_id} value={m.user_id}>{(m.profiles as any)?.full_name || "Unknown"}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Track</Label>
                        <Select value={selectedTrack} onValueChange={setSelectedTrack}>
                          <SelectTrigger><SelectValue placeholder="Select track" /></SelectTrigger>
                          <SelectContent>
                            {tracks.map(t => (<SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button onClick={handleAssignTrack} className="w-full" disabled={!selectedTrack || !selectedMember}>Assign</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Lifecycle Timeline */}
      {stages.length > 0 && (
        <motion.div variants={item}>
          <Card>
            <CardHeader className="py-3 px-5">
              <CardTitle className="text-sm font-sans font-semibold flex items-center gap-2">
                <Target className="h-3.5 w-3.5 text-accent-foreground" /> Project Lifecycle
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 px-5 pb-4">
              <div className="flex items-center gap-1.5">
                {stages.map((stage, i) => (
                  <div key={stage.id} className="flex items-center gap-1.5 flex-1">
                    <div className={`flex-1 rounded-lg p-3 text-center border transition-all ${
                      stage.status === "completed" ? "bg-success/10 border-success/30 text-success" :
                      stage.status === "active" ? "bg-primary/10 border-primary/30 glow-primary" :
                      "bg-muted/20 border-border/50 text-muted-foreground"
                    }`}>
                      <p className="text-[10px] font-mono uppercase tracking-wider font-semibold">{stage.name}</p>
                      <p className="text-[9px] mt-0.5 capitalize opacity-70">{stage.status}</p>
                    </div>
                    {i < stages.length - 1 && <div className="w-3 h-px bg-border shrink-0" />}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Team Roster */}
        <motion.div variants={item} className="lg:col-span-1">
          <Card>
            <CardHeader className="py-3 px-5">
              <CardTitle className="text-sm font-sans font-semibold flex items-center gap-2">
                <Users className="h-3.5 w-3.5 text-accent-foreground" /> Team ({members.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 px-5 pb-4 space-y-1">
              {sortedMembers.map((m: any) => (
                <motion.div key={m.id} whileHover={{ x: 2 }} className="flex items-center gap-3 py-2 rounded-lg px-2 hover:bg-muted/30 transition-colors">
                  <div className="h-7 w-7 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold text-secondary-foreground">
                    {(m.profiles as any)?.full_name?.[0] || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate leading-tight">{(m.profiles as any)?.full_name}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">{(m.profiles as any)?.major || ""}</p>
                  </div>
                  <Badge variant={roleBadgeVariant(m.role) as any} className="text-[8px] font-mono uppercase shrink-0">{roleLabel(m.role)}</Badge>
                </motion.div>
              ))}
            </CardContent>
          </Card>
        </motion.div>

        {/* Projects + Manuals + Tracks */}
        <div className="lg:col-span-2 space-y-5">
          {/* Tracks */}
          {tracks.length > 0 && (
            <motion.div variants={item}>
              <Card>
                <CardHeader className="py-3 px-5">
                  <CardTitle className="text-sm font-sans font-semibold flex items-center gap-2">
                    <Activity className="h-3.5 w-3.5 text-accent-foreground" /> Tracks
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 px-5 pb-4">
                  <div className="flex flex-wrap gap-2">
                    {tracks.map(t => (
                      <Badge key={t.id} variant="secondary" className="text-xs font-mono py-1.5 px-3">{t.name}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Mock Projects */}
          <motion.div variants={item}>
            <Card>
              <CardHeader className="py-3 px-5 flex-row items-center justify-between">
                <CardTitle className="text-sm font-sans font-semibold flex items-center gap-2">
                  <Target className="h-3.5 w-3.5 text-accent-foreground" /> Mock Projects
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 px-5 pb-4">
                {mockProjects.length === 0 ? (
                  <div className="flex flex-col items-center py-8 text-muted-foreground">
                    <Target className="h-8 w-8 mb-2 opacity-20" />
                    <p className="text-[11px]">No mock projects yet.</p>
                    {isLeader && <p className="text-[10px] mt-1 text-muted-foreground/60">Create one using the button above.</p>}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {mockProjects.map((p: any) => (
                      <motion.div key={p.id} whileHover={{ x: 2 }} className="rounded-xl border p-4 cursor-pointer card-hover group" onClick={() => navigate(`/app/mock-project/${p.id}`)}>
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="text-sm font-semibold leading-tight">{p.title}</h3>
                            <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{p.scenario || "No scenario defined"}</p>
                          </div>
                          <ChevronRight className="h-4 w-4 text-transparent group-hover:text-muted-foreground transition-colors shrink-0" />
                        </div>
                        <Badge variant="outline" className="mt-2 text-[9px] font-mono">{p.status}</Badge>
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Lab Manuals */}
          <motion.div variants={item}>
            <Card>
              <CardHeader className="py-3 px-5 flex-row items-center justify-between">
                <CardTitle className="text-sm font-sans font-semibold flex items-center gap-2">
                  <BookOpen className="h-3.5 w-3.5 text-accent-foreground" /> Lab Manuals
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 px-5 pb-4">
                {manuals.length === 0 ? (
                  <div className="flex flex-col items-center py-8 text-muted-foreground">
                    <BookOpen className="h-8 w-8 mb-2 opacity-20" />
                    <p className="text-[11px]">No lab manuals yet.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {manuals.map((m: any) => (
                      <motion.div key={m.id} whileHover={{ x: 2 }} className="rounded-xl border p-4 cursor-pointer card-hover group" onClick={() => navigate(`/app/lab/${m.id}`)}>
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-sm font-semibold leading-tight">{m.title}</h3>
                            <p className="text-[11px] text-muted-foreground">{m.description}</p>
                          </div>
                          <ChevronRight className="h-4 w-4 text-transparent group-hover:text-muted-foreground transition-colors" />
                        </div>
                        <span className="text-[9px] font-mono text-muted-foreground">v{m.version}</span>
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
