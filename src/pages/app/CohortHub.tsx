import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { isBusinessCohort } from "@/lib/cohorts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  Users, BookOpen, Target, ChevronRight, Cpu, Wrench, Code, Briefcase,
  Plus, Compass, Trophy, Activity, Rocket, Building2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { SectionExplainer, InfoDot } from "@/components/ui/SectionExplainer";
import { CadenceHealthCard } from "@/components/CadenceHealthCard";
import { ScoreCard } from "@/components/ScoreCard";

const cohortIcons: Record<string, any> = { cpu: Cpu, wrench: Wrench, code: Code, briefcase: Briefcase };
const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.22 } } };

const PHASE_LABELS: Record<string, string> = {
  thesis: "Thesis", research: "Research", development: "Development",
  validation: "Validation", knowledge_transfer: "Knowledge Transfer", roadmap_update: "Roadmap Update",
};

export default function CohortHub() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [membership, setMembership] = useState<any>(null);
  const [cohort, setCohort] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [mockProjects, setMockProjects] = useState<any[]>([]);
  const [manuals, setManuals] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  const [purposeTrack, setPurposeTrack] = useState<any>(null);
  const [capacity, setCapacity] = useState<any>(null);
  const [activeOpps, setActiveOpps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createMPDialog, setCreateMPDialog] = useState(false);
  const [createLabDialog, setCreateLabDialog] = useState(false);

  const isLeader = membership?.role === "pm" || membership?.role === "lead" || membership?.role === "integration_lead";
  // Business & Marketing runs the CRM/brand lines, not mock projects.
  const isOpsCohort = isBusinessCohort(cohort);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: cm } = await supabase.from("cohort_memberships").select("*, cohorts(*)").eq("user_id", user.id).limit(1).maybeSingle();
      if (!cm) { setLoading(false); return; }
      setMembership(cm);
      setCohort((cm as any).cohorts);
      const cid = cm.cohort_id;

      const [membersRes, projRes, manualRes, ptRes, capRes, oppRes] = await Promise.all([
        supabase.from("cohort_memberships").select("*, profiles:user_id(full_name, avatar_url, major, user_id)").eq("cohort_id", cid).order("role"),
        supabase.from("mock_projects").select("*").eq("cohort_id", cid),
        supabase.from("lab_manuals").select("*").eq("cohort_id", cid),
        supabase.from("purpose_tracks").select("*").eq("cohort_id", cid).eq("status", "active").limit(1).maybeSingle(),
        supabase.from("capacity_allocations").select("*").eq("cohort_id", cid).order("effective_date", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("opportunities").select("*").eq("assigned_cohort_id", cid).in("status", ["approved", "active"]),
      ]);
      setMembers(membersRes.data || []);
      setMockProjects(projRes.data || []);
      setManuals(manualRes.data || []);
      setPurposeTrack(ptRes.data);
      setCapacity(capRes.data);
      setActiveOpps(oppRes.data || []);

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
      await supabase.from("project_stages").insert([
        { name: "Kickoff", order_index: 0, status: "active", mock_project_id: data.id },
        { name: "Discovery", order_index: 1, status: "locked", mock_project_id: data.id },
        { name: "Midpoint", order_index: 2, status: "locked", mock_project_id: data.id },
        { name: "Final", order_index: 3, status: "locked", mock_project_id: data.id },
        { name: "Retro", order_index: 4, status: "locked", mock_project_id: data.id },
      ]);
    }
    toast.success("Mock project created");
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

  if (loading) return <div className="space-y-4">{[1, 2, 3].map(i => <Card key={i} className="h-32 animate-pulse bg-muted/30" />)}</div>;

  if (!cohort) return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <Cpu className="h-16 w-16 text-muted-foreground/20 mb-4" />
      <h2 className="font-display text-xl font-bold mb-2">No Cohort Assigned</h2>
      <p className="text-muted-foreground text-sm max-w-sm">Contact your admin or PM.</p>
    </div>
  );

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

  // Determine current mode
  const activeComps = activeOpps.filter(o => o.type === "competition");
  const activeContracts = activeOpps.filter(o => o.type === "contract");
  const modes: string[] = [];
  if (purposeTrack) modes.push("Purpose");
  if (activeComps.length > 0) modes.push("Competition");
  if (activeContracts.length > 0) modes.push("Contract");
  const currentMode = modes.length === 0 ? "Purpose" : modes.join(" + ");

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-5 max-w-[1100px]">
      {/* Header with Operating Status */}
      <motion.div variants={item} className="relative overflow-hidden rounded-2xl border bg-card">
        <div className="absolute inset-0 bg-grid-animate pointer-events-none" />
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-accent/5 blur-3xl pointer-events-none" />
        <div className="relative p-6">
          <div className="flex items-start gap-5">
            <div className="h-14 w-14 rounded-2xl bg-secondary flex items-center justify-center border border-border/50 glow-subtle">
              <Icon className="h-7 w-7 text-accent-foreground" />
            </div>
            <div className="flex-1">
              <h1 className="font-display text-2xl font-bold">{cohort.name}</h1>
              <SectionExplainer text="Your cohort's operating center — see mode, purpose, active engagements, and team." className="mt-0.5" />
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge variant={roleBadgeVariant(membership.role) as any} className="text-[9px] font-mono uppercase">{roleLabel(membership.role)}</Badge>
                <Badge variant="outline" className="text-[9px] font-mono">{members.length} members</Badge>
                <Badge className="text-[9px] font-mono bg-accent/10 text-accent-foreground border-accent/30">{currentMode}</Badge>
              </div>
            </div>
            {isLeader && (
              <div className="flex flex-wrap gap-2 shrink-0">
                {!isOpsCohort && <Dialog open={createMPDialog} onOpenChange={setCreateMPDialog}>
                  <DialogTrigger asChild><Button size="sm" variant="outline" className="gap-1.5 text-[10px]"><Target className="h-3 w-3" />New Project</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Create Mock Project</DialogTitle></DialogHeader>
                    <form onSubmit={handleCreateMockProject} className="space-y-4">
                      <div className="space-y-2"><Label>Title</Label><Input name="title" required /></div>
                      <div className="space-y-2"><Label>Scenario</Label><Textarea name="scenario" rows={2} /></div>
                      <div className="space-y-2"><Label>Objectives</Label><Textarea name="objectives" rows={2} /></div>
                      <div className="space-y-2"><Label>Deliverables</Label><Textarea name="deliverables" rows={2} /></div>
                      <Button type="submit" className="w-full">Create</Button>
                    </form>
                  </DialogContent>
                </Dialog>}
                {isOpsCohort && (
                  <Button size="sm" variant="outline" className="gap-1.5 text-[10px]" onClick={() => navigate("/app/crm/dashboard")}>
                    <Building2 className="h-3 w-3" /> Open Company Relations
                  </Button>
                )}
                <Dialog open={createLabDialog} onOpenChange={setCreateLabDialog}>
                  <DialogTrigger asChild><Button size="sm" variant="outline" className="gap-1.5 text-[10px]"><BookOpen className="h-3 w-3" />New Lab</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Create Lab Manual</DialogTitle></DialogHeader>
                    <form onSubmit={handleCreateLabManual} className="space-y-4">
                      <div className="space-y-2"><Label>Title</Label><Input name="title" required /></div>
                      <div className="space-y-2"><Label>Description</Label><Textarea name="description" rows={2} /></div>
                      <Button type="submit" className="w-full">Create</Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Operating Status Strip */}
      <motion.div variants={item} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="card-hover cursor-pointer" onClick={() => navigate("/app/purpose")}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-accent/10 flex items-center justify-center"><Compass className="h-4 w-4 text-accent-foreground" /></div>
              <div>
                <p className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">Purpose Track</p>
                <p className="text-sm font-semibold truncate">{purposeTrack?.title || "Not defined"}</p>
                {purposeTrack && <p className="text-[9px] font-mono text-muted-foreground">{PHASE_LABELS[purposeTrack.current_phase]}</p>}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="card-hover">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-warning/10 flex items-center justify-center"><Trophy className="h-4 w-4 text-warning" /></div>
              <div>
                <p className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">Competitions</p>
                <p className="text-sm font-semibold">{activeComps.length > 0 ? activeComps.map(c => c.title).join(", ") : "None active"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="card-hover">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center"><Briefcase className="h-4 w-4 text-primary" /></div>
              <div>
                <p className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">Contracts</p>
                <p className="text-sm font-semibold">{activeContracts.length > 0 ? activeContracts.map(c => c.title).join(", ") : "None active"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="card-hover">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-muted/50 flex items-center justify-center"><Activity className="h-4 w-4 text-muted-foreground" /></div>
              <div>
                <p className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">Capacity Split</p>
                {capacity ? (
                  <div className="flex gap-2 mt-0.5">
                    <span className="text-[10px] font-mono">P:{capacity.purpose_pct}%</span>
                    <span className="text-[10px] font-mono">C:{capacity.competition_pct}%</span>
                    <span className="text-[10px] font-mono">K:{capacity.contract_pct}%</span>
                  </div>
                ) : <p className="text-sm font-semibold">100% Purpose</p>}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* The cohort's production line: what this cohort does, as repeatable
          work units. Data-driven from cohorts.assembly_line so the operating
          model is editable without code changes. */}
      {Array.isArray(cohort.assembly_line) && cohort.assembly_line.length > 0 && (
        <motion.div variants={item}>
          <Card>
            <CardHeader className="py-3 px-5">
              <CardTitle className="text-sm font-sans font-semibold flex items-center gap-2">
                <Rocket className="h-3.5 w-3.5 text-accent-foreground" /> Your line
                <InfoDot tip="Every stage is a repeatable work unit. Finish one, the queue feeds you the next. This is the whole job." />
              </CardTitle>
              {cohort.charter?.mission && (
                <p className="text-[11px] text-muted-foreground mt-1">{cohort.charter.mission}</p>
              )}
            </CardHeader>
            <CardContent className="pt-0 px-5 pb-4 space-y-4">
              {(() => {
                const line: any[] = cohort.assembly_line;
                const sections: any[] = cohort.charter?.sections || [];
                const groups = new Map<string, any[]>();
                for (const s of line) {
                  const key = s.section || "_all";
                  if (!groups.has(key)) groups.set(key, []);
                  groups.get(key)!.push(s);
                }
                return [...groups.entries()].map(([key, stages]) => {
                  const meta = sections.find((s: any) => s.key === key);
                  return (
                    <div key={key}>
                      {meta && (
                        <div className="mb-2">
                          <p className="text-[10px] font-mono uppercase tracking-wider font-semibold">{meta.name}</p>
                          <p className="text-[10px] text-muted-foreground">{meta.who} — {meta.owns}</p>
                        </div>
                      )}
                      <div className="flex flex-wrap items-stretch gap-1.5">
                        {stages.map((s: any, i: number) => (
                          <div
                            key={`${key}-${i}`}
                            className={`rounded-lg border p-2.5 min-w-[120px] flex-1 ${s.where?.startsWith("/app") ? "cursor-pointer card-hover" : ""}`}
                            onClick={() => s.where?.startsWith("/app") && navigate(s.where)}
                          >
                            <p className="text-[10px] font-mono uppercase tracking-wider font-semibold text-accent-foreground">
                              {String(i + 1).padStart(2, "0")} {s.stage}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-1 leading-snug">{s.unit}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                });
              })()}
              {Array.isArray(cohort.charter?.escalates) && cohort.charter.escalates.length > 0 && (
                <div className="border-t pt-3">
                  <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">Escalate, don't sit on it</p>
                  <ul className="space-y-0.5">
                    {cohort.charter.escalates.map((e: string, i: number) => (
                      <li key={i} className="text-[11px] text-muted-foreground">• {e}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Nexus-taught onboarding: Orient -> Learn -> Shadow -> First Unit -> Certified */}
      {Array.isArray(cohort.onboarding_track) && cohort.onboarding_track.length > 0 && (
        <motion.div variants={item}>
          <Card>
            <CardHeader className="py-3 px-5">
              <CardTitle className="text-sm font-sans font-semibold flex items-center gap-2">
                <Compass className="h-3.5 w-3.5 text-accent-foreground" /> Onboarding track
                <InfoDot tip="New to this cohort? Walk these steps in order. After the last one you run the line solo." />
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 px-5 pb-4">
              <div className="flex flex-wrap items-stretch gap-1.5">
                {cohort.onboarding_track.map((t: any, i: number) => (
                  <div
                    key={i}
                    className={`rounded-lg border p-2.5 min-w-[140px] flex-1 ${t.where?.startsWith("/app") ? "cursor-pointer card-hover" : ""}`}
                    onClick={() => t.where?.startsWith("/app") && navigate(t.where)}
                  >
                    <p className="text-[10px] font-mono uppercase tracking-wider font-semibold">
                      {String(i + 1).padStart(2, "0")} {t.step}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1 leading-snug">{t.detail}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Cadence health (Phase 5) — compact, non-blocking */}
      <motion.div variants={item}>
        <CadenceHealthCard scope="cohort" targetId={cohort.id} />
      </motion.div>

      <motion.div variants={item}>
        <ScoreCard scope="cohort" targetId={cohort.id} restricted={!isLeader} />
      </motion.div>

      {/* Lifecycle Timeline */}
      {stages.length > 0 && (
        <motion.div variants={item}>
          <Card>
            <CardHeader className="py-3 px-5">
              <CardTitle className="text-sm font-sans font-semibold flex items-center gap-2">
                <Target className="h-3.5 w-3.5 text-accent-foreground" /> Project Lifecycle
                <InfoDot tip="Your project moves through stages. Complete all required deliverables to advance." />
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

        {/* Projects + Labs */}
        <div className="lg:col-span-2 space-y-5">
          <motion.div variants={item}>
            <Card>
              <CardHeader className="py-3 px-5 flex-row items-center justify-between">
                <CardTitle className="text-sm font-sans font-semibold flex items-center gap-2">
                  <Target className="h-3.5 w-3.5 text-accent-foreground" /> {isOpsCohort ? "Outreach Execution" : "Projects"}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 px-5 pb-4">
                {isOpsCohort ? (
                  <div className="space-y-2">
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Ops doesn't run mock projects. The cohort's operating surface is Company Relations + Outreach Execution.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => navigate("/app/crm/dashboard")} className="rounded-xl border p-3 text-left card-hover">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-3.5 w-3.5 text-accent-foreground" />
                          <span className="text-xs font-semibold">Company Relations</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">Pipeline, accounts, contacts.</p>
                      </button>
                      <button onClick={() => navigate("/app/crm/qualified")} className="rounded-xl border p-3 text-left card-hover">
                        <div className="flex items-center gap-2">
                          <Target className="h-3.5 w-3.5 text-accent-foreground" />
                          <span className="text-xs font-semibold">Qualified Queue</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">Active outreach work.</p>
                      </button>
                    </div>
                  </div>
                ) : mockProjects.length === 0 ? (
                  <div className="flex flex-col items-center py-8 text-muted-foreground">
                    <Target className="h-8 w-8 mb-2 opacity-20" />
                    <p className="text-[11px]">No projects yet.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {mockProjects.map((p: any) => (
                      <motion.div key={p.id} whileHover={{ x: 2 }} className="rounded-xl border p-4 cursor-pointer card-hover group" onClick={() => navigate(isOpsCohort ? "/app/crm/dashboard" : `/app/mock-project/${p.id}`)}>
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

          <motion.div variants={item}>
            <Card>
              <CardHeader className="py-3 px-5 flex-row items-center justify-between">
                <CardTitle className="text-sm font-sans font-semibold flex items-center gap-2">
                  <BookOpen className="h-3.5 w-3.5 text-accent-foreground" /> Playbooks
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 px-5 pb-4">
                {manuals.length === 0 ? (
                  <div className="flex flex-col items-center py-8 text-muted-foreground">
                    <BookOpen className="h-8 w-8 mb-2 opacity-20" />
                    <p className="text-[11px]">No playbooks yet.</p>
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
