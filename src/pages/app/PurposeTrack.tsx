import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Compass, Target, BookOpen, Lightbulb, Plus, CheckCircle2,
  ChevronRight, Milestone, FileText, FlaskConical, Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { SectionExplainer } from "@/components/ui/SectionExplainer";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.22 } } };

const PHASES = ["thesis", "research", "development", "validation", "knowledge_transfer", "roadmap_update"] as const;
const PHASE_LABELS: Record<string, string> = {
  thesis: "Thesis / Mission Definition",
  research: "Research",
  development: "Development",
  validation: "Validation",
  knowledge_transfer: "Knowledge Transfer",
  roadmap_update: "Roadmap Update",
};

export default function PurposeTrack() {
  const { user } = useAuth();
  const [membership, setMembership] = useState<any>(null);
  const [track, setTrack] = useState<any>(null);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [artifacts, setArtifacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialog, setCreateDialog] = useState(false);
  const [milestoneDialog, setMilestoneDialog] = useState(false);
  const [artifactDialog, setArtifactDialog] = useState(false);
  const isLeader = membership?.role === "pm" || membership?.role === "lead" || membership?.role === "integration_lead";

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: cm } = await supabase.from("cohort_memberships")
        .select("*, cohorts(*)").eq("user_id", user.id).limit(1).maybeSingle();
      if (!cm) { setLoading(false); return; }
      setMembership(cm);

      const { data: pt } = await supabase.from("purpose_tracks")
        .select("*").eq("cohort_id", cm.cohort_id).eq("status", "active").limit(1).maybeSingle();
      setTrack(pt);

      if (pt) {
        const [msRes, artRes] = await Promise.all([
          supabase.from("purpose_milestones").select("*").eq("purpose_track_id", pt.id).order("order_index"),
          supabase.from("purpose_artifacts").select("*").eq("purpose_track_id", pt.id).order("created_at", { ascending: false }).limit(20),
        ]);
        setMilestones(msRes.data || []);
        setArtifacts(artRes.data || []);
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const { error } = await supabase.from("purpose_tracks").insert({
      cohort_id: membership.cohort_id,
      title: f.get("title") as string,
      mission_statement: f.get("mission") as string,
      field_thesis: f.get("thesis") as string,
      why_it_matters: f.get("why") as string,
      long_term_objective: f.get("objective") as string,
      current_phase: "thesis",
      created_by: user!.id,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Purpose Track created");
    setCreateDialog(false);
    window.location.reload();
  };

  const handleAddMilestone = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const { error } = await supabase.from("purpose_milestones").insert({
      purpose_track_id: track.id,
      title: f.get("title") as string,
      description: f.get("description") as string,
      target_date: (f.get("target_date") as string) || null,
      order_index: milestones.length,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Milestone added");
    setMilestoneDialog(false);
    const { data } = await supabase.from("purpose_milestones").select("*").eq("purpose_track_id", track.id).order("order_index");
    setMilestones(data || []);
  };

  const handleAddArtifact = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const { error } = await supabase.from("purpose_artifacts").insert({
      purpose_track_id: track.id,
      title: f.get("title") as string,
      artifact_type: f.get("type") as string,
      content: f.get("content") as string,
      created_by: user!.id,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Artifact added");
    setArtifactDialog(false);
    const { data } = await supabase.from("purpose_artifacts").select("*").eq("purpose_track_id", track.id).order("created_at", { ascending: false }).limit(20);
    setArtifacts(data || []);
  };

  const completeMilestone = async (id: string) => {
    const { error } = await supabase.from("purpose_milestones").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", id);
    if (error) { toast.error(`Failed: ${error.message}`); return; }
    setMilestones(prev => prev.map(m => m.id === id ? { ...m, status: "completed", completed_at: new Date().toISOString() } : m));
    toast.success("Milestone completed");
  };

  const advancePhase = async () => {
    const idx = PHASES.indexOf(track.current_phase);
    if (idx < PHASES.length - 1) {
      const next = PHASES[idx + 1];
      const { error } = await supabase.from("purpose_tracks").update({ current_phase: next }).eq("id", track.id);
      if (error) { toast.error(`Failed: ${error.message}`); return; }
      setTrack({ ...track, current_phase: next });
      toast.success(`Advanced to ${PHASE_LABELS[next]}`);
    }
  };

  if (loading) return <div className="space-y-4">{[1,2].map(i => <Card key={i} className="h-32 animate-pulse bg-muted/30" />)}</div>;

  if (!membership) return (
    <div className="flex flex-col items-center py-20 text-muted-foreground">
      <Compass className="h-12 w-12 mb-3 opacity-20" />
      <p className="text-sm">No cohort assigned.</p>
    </div>
  );

  if (!track) return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center py-20 max-w-md mx-auto text-center">
      <Compass className="h-16 w-16 text-accent-foreground/20 mb-4" />
      <h2 className="font-display text-xl font-bold mb-2">No Purpose Track Yet</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Every cohort needs a long-term purpose — a mission that drives deep development even when there's no competition or contract.
      </p>
      {isLeader && (
        <Dialog open={createDialog} onOpenChange={setCreateDialog}>
          <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" />Define Purpose Track</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Define Cohort Purpose</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2"><Label>Purpose Title</Label><Input name="title" required placeholder="Developer Systems & Tooling" /></div>
              <div className="space-y-2"><Label>Mission Statement</Label><Textarea name="mission" placeholder="We exist to..." rows={2} /></div>
              <div className="space-y-2"><Label>Field Thesis</Label><Textarea name="thesis" placeholder="We believe that..." rows={2} /></div>
              <div className="space-y-2"><Label>Why It Matters</Label><Textarea name="why" placeholder="This matters because..." rows={2} /></div>
              <div className="space-y-2"><Label>Long-Term Objective</Label><Textarea name="objective" placeholder="By end of year, we will have..." rows={2} /></div>
              <Button type="submit" className="w-full">Create Purpose Track</Button>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </motion.div>
  );

  const cohortName = (membership as any)?.cohorts?.name || "Cohort";
  const completedMs = milestones.filter(m => m.status === "completed").length;
  const phaseIdx = PHASES.indexOf(track.current_phase);

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-5 max-w-[1100px]">
      {/* Hero */}
      <motion.div variants={item} className="relative overflow-hidden rounded-2xl border bg-card">
        <div className="absolute inset-0 bg-grid-animate pointer-events-none" />
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-accent/5 blur-3xl pointer-events-none" />
        <div className="relative p-6 sm:p-8">
          <div className="flex items-center gap-2 mb-1">
            <div className="h-2 w-2 rounded-full bg-success status-pulse" />
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">Purpose Track · {cohortName}</span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold mt-2">{track.title}</h1>
          <SectionExplainer text="Your cohort's long-term mission. This drives development when no external engagement is active." className="mt-1" />

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {track.mission_statement && (
              <div className="glass rounded-xl p-4">
                <p className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground mb-1">Mission Statement</p>
                <p className="text-sm leading-relaxed">{track.mission_statement}</p>
              </div>
            )}
            {track.field_thesis && (
              <div className="glass rounded-xl p-4">
                <p className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground mb-1">Field Thesis</p>
                <p className="text-sm leading-relaxed">{track.field_thesis}</p>
              </div>
            )}
          </div>

          {/* Phase timeline */}
          <div className="mt-6">
            <div className="flex items-center gap-1.5">
              {PHASES.map((phase, i) => (
                <div key={phase} className="flex items-center gap-1.5 flex-1">
                  <div className={`flex-1 rounded-lg p-2.5 text-center border transition-all ${
                    i < phaseIdx ? "bg-success/10 border-success/30 text-success" :
                    i === phaseIdx ? "bg-primary/10 border-primary/30 glow-primary" :
                    "bg-muted/20 border-border/50 text-muted-foreground"
                  }`}>
                    <p className="text-[9px] font-mono uppercase tracking-wider font-semibold leading-tight">{PHASE_LABELS[phase]?.split(" / ")[0]}</p>
                  </div>
                  {i < PHASES.length - 1 && <div className="w-2 h-px bg-border shrink-0" />}
                </div>
              ))}
            </div>
            {isLeader && phaseIdx < PHASES.length - 1 && (
              <Button size="sm" variant="outline" className="mt-3 text-[10px]" onClick={advancePhase}>
                Advance to {PHASE_LABELS[PHASES[phaseIdx + 1]]}
              </Button>
            )}
          </div>
        </div>
      </motion.div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Milestones */}
        <motion.div variants={item} className="lg:col-span-2">
          <Card>
            <CardHeader className="py-3 px-5 flex-row items-center justify-between">
              <CardTitle className="text-sm font-sans font-semibold flex items-center gap-2">
                <Milestone className="h-3.5 w-3.5 text-accent-foreground" /> Mission Milestones ({completedMs}/{milestones.length})
              </CardTitle>
              {isLeader && (
                <Dialog open={milestoneDialog} onOpenChange={setMilestoneDialog}>
                  <DialogTrigger asChild><Button size="sm" variant="outline" className="text-[10px] gap-1"><Plus className="h-3 w-3" />Add</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Add Mission Milestone</DialogTitle></DialogHeader>
                    <form onSubmit={handleAddMilestone} className="space-y-4">
                      <div className="space-y-2"><Label>Milestone Title</Label><Input name="title" required placeholder="Working architecture demo" /></div>
                      <div className="space-y-2"><Label>Description</Label><Textarea name="description" rows={2} /></div>
                      <div className="space-y-2"><Label>Target Date</Label><Input name="target_date" type="date" /></div>
                      <Button type="submit" className="w-full">Add Milestone</Button>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent className="pt-0 px-5 pb-4">
              {milestones.length === 0 ? (
                <div className="flex flex-col items-center py-10 text-muted-foreground">
                  <Target className="h-8 w-8 mb-2 opacity-20" />
                  <p className="text-[11px]">No milestones defined yet.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {milestones.map(ms => (
                    <div key={ms.id} className={`flex items-center gap-3 rounded-lg px-3 py-3 border transition-all ${
                      ms.status === "completed" ? "bg-success/5 border-success/20" : "hover:bg-muted/30"
                    }`}>
                      <button
                        onClick={() => ms.status !== "completed" && isLeader && completeMilestone(ms.id)}
                        disabled={ms.status === "completed" || !isLeader}
                        className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 border-2 transition-colors ${
                          ms.status === "completed" ? "bg-success border-success text-success-foreground" : "border-border hover:border-primary"
                        }`}
                      >
                        {ms.status === "completed" && <CheckCircle2 className="h-3.5 w-3.5" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium leading-tight ${ms.status === "completed" ? "line-through text-muted-foreground" : ""}`}>{ms.title}</p>
                        {ms.description && <p className="text-[10px] text-muted-foreground mt-0.5">{ms.description}</p>}
                      </div>
                      {ms.target_date && (
                        <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                          {new Date(ms.target_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Sidebar: info + artifacts */}
        <motion.div variants={item} className="space-y-5">
          {track.why_it_matters && (
            <Card>
              <CardHeader className="py-3 px-5">
                <CardTitle className="text-sm font-sans font-semibold flex items-center gap-2">
                  <Lightbulb className="h-3.5 w-3.5 text-accent-foreground" /> Why It Matters
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 px-5 pb-4">
                <p className="text-sm text-muted-foreground leading-relaxed">{track.why_it_matters}</p>
              </CardContent>
            </Card>
          )}

          {track.long_term_objective && (
            <Card>
              <CardHeader className="py-3 px-5">
                <CardTitle className="text-sm font-sans font-semibold flex items-center gap-2">
                  <Target className="h-3.5 w-3.5 text-accent-foreground" /> Strategic Objective
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 px-5 pb-4">
                <p className="text-sm text-muted-foreground leading-relaxed">{track.long_term_objective}</p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="py-3 px-5 flex-row items-center justify-between">
              <CardTitle className="text-sm font-sans font-semibold flex items-center gap-2">
                <FlaskConical className="h-3.5 w-3.5 text-accent-foreground" /> Artifacts ({artifacts.length})
              </CardTitle>
              <Dialog open={artifactDialog} onOpenChange={setArtifactDialog}>
                <DialogTrigger asChild><Button size="sm" variant="outline" className="text-[10px] gap-1"><Plus className="h-3 w-3" />Add</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add Artifact</DialogTitle></DialogHeader>
                  <form onSubmit={handleAddArtifact} className="space-y-4">
                    <div className="space-y-2"><Label>Title</Label><Input name="title" required /></div>
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Select name="type" defaultValue="document">
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="document">Document</SelectItem>
                          <SelectItem value="prototype">Prototype</SelectItem>
                          <SelectItem value="experiment">Experiment</SelectItem>
                          <SelectItem value="technical_note">Technical Note</SelectItem>
                          <SelectItem value="strategy_note">Strategy Note</SelectItem>
                          <SelectItem value="knowledge_card">Knowledge Card</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2"><Label>Content / Description</Label><Textarea name="content" rows={3} /></div>
                    <Button type="submit" className="w-full">Add Artifact</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="pt-0 px-5 pb-4">
              {artifacts.length === 0 ? (
                <p className="text-[11px] text-muted-foreground text-center py-6">No artifacts yet. Add research, prototypes, or findings.</p>
              ) : (
                <div className="space-y-1.5">
                  {artifacts.slice(0, 8).map(a => (
                    <div key={a.id} className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-muted/30 transition-colors">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{a.title}</p>
                        <p className="text-[9px] font-mono text-muted-foreground">{a.artifact_type}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}
