import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowLeft, Target, FileText, CheckSquare, Lock, Unlock, Plus,
  Users, BookOpen, Shield, AlertTriangle, MessageSquare, Layers,
  ChevronRight, Play, Zap, FolderOpen, Award, Clock, BarChart3,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import SmartDocImport from "@/components/SmartDocImport";
import { SectionExplainer, InfoDot } from "@/components/ui/SectionExplainer";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.2 } } };

const stageIcons: Record<string, any> = {
  Kickoff: Zap,
  Discovery: Target,
  "Direction / Concept Selection": BarChart3,
  "Build / Detailed Design": Layers,
  "Final Delivery": Award,
  "Strategy Direction": Target,
  "Execution Design": Layers,
  "System Design": Layers,
  "Integration Build": Cpu,
  "Final System": Award,
  Retro: BookOpen,
};

const STANDARD_WORKSTREAMS = [
  {
    key: "foundations",
    name: "Foundations Lane",
    desc: "Architecture understanding, codebase walkthrough, guided outputs",
    cardClass: "bg-accent/5 border-accent/20",
    labelClass: "text-accent-foreground",
  },
  {
    key: "systems",
    name: "Systems Lane",
    desc: "Implementation ownership, systems reasoning, consulting-grade artifacts",
    cardClass: "bg-primary/5 border-primary/20",
    labelClass: "text-primary",
  },
];

const EE_WORKSTREAMS = [
  {
    key: "hardware_bringup",
    name: "Hardware & Bring-Up",
    desc: "Pi setup, GPIO/I2C config, sensor wiring, hardware validation",
    cardClass: "bg-accent/5 border-accent/20",
    labelClass: "text-accent-foreground",
  },
  {
    key: "sensor_integration",
    name: "Sensor Integration",
    desc: "Reading data, validating signals, combining inputs, reliability",
    cardClass: "bg-primary/5 border-primary/20",
    labelClass: "text-primary",
  },
  {
    key: "decision_logic",
    name: "Decision Logic",
    desc: "State definitions, transitions, noise filtering, edge cases",
    cardClass: "bg-accent/5 border-accent/20",
    labelClass: "text-accent-foreground",
  },
  {
    key: "interface_display",
    name: "Interface & Display",
    desc: "UI build, real-time updates, status communication, readability",
    cardClass: "bg-primary/5 border-primary/20",
    labelClass: "text-primary",
  },
  {
    key: "data_logging",
    name: "Data Logging & Stability",
    desc: "CSV/DB logging, error handling, long-running stability, debugging",
    cardClass: "bg-accent/5 border-accent/20",
    labelClass: "text-accent-foreground",
  },
];

const getRoleOnProject = (role?: string) => {
  if (role === "pm") return "Project Manager";
  if (role === "lead") return "Tech Lead";
  if (role === "integration_lead") return "Integration Lead";
  return "Member";
};

const formatLaneLabel = (lane?: string | null) =>
  lane ? lane.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()) : "Unassigned";

const getMemberDisplayName = (member: any) => member?.profiles?.full_name || member?.user_id?.slice(0, 8) || "Unknown member";
const getMemberSubline = (member: any) => member?.profiles?.cal_poly_email || member?.role_on_project || "";
const getWorkstreams = (isEECohort: boolean) => (isEECohort ? EE_WORKSTREAMS : STANDARD_WORKSTREAMS);

export default function MockProject() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [project, setProject] = useState<any>(null);
  const [stages, setStages] = useState<any[]>([]);
  const [membership, setMembership] = useState<any>(null);
  const [mockMembers, setMockMembers] = useState<any[]>([]);
  const [playbooks, setPlaybooks] = useState<any[]>([]);
  const [rubrics, setRubrics] = useState<any[]>([]);
  const [folders, setFolders] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [laneDialog, setLaneDialog] = useState<any>(null);
  const [overrideDialog, setOverrideDialog] = useState<any>(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [importDialog, setImportDialog] = useState(false);

  const isLeader = membership?.role === "pm" || membership?.role === "lead" || membership?.role === "integration_lead";

  const load = useCallback(async () => {
    if (!id || !user) return;
    const [projRes, stagesRes, membersRes, rubricsRes, foldersRes, docsRes] = await Promise.all([
      supabase.from("mock_projects").select("*, cohorts(name, id)").eq("id", id).single(),
      supabase.from("project_stages").select("*").eq("mock_project_id", id).order("order_index"),
      supabase.from("mock_project_memberships").select("*, profiles:user_id(full_name, cal_poly_email)").eq("mock_project_id", id),
      supabase.from("review_rubrics").select("*").eq("mock_project_id", id),
      supabase.from("folders").select("*").eq("mock_project_id", id),
      supabase.from("documents").select("*").eq("mock_project_id", id).order("created_at", { ascending: false }),
    ]);
    const projectData = projRes.data;
    setProject(projectData);
    setStages(stagesRes.data || []);
    setRubrics(rubricsRes.data || []);
    setFolders(foldersRes.data || []);
    setDocuments(docsRes.data || []);

    if (projectData?.cohorts?.id) {
      const [playbooksRes, cohortMembersRes, membershipRes] = await Promise.all([
        supabase.from("lab_manuals").select("*, lab_steps(*)").eq("cohort_id", (projectData as any).cohorts.id),
        supabase.from("cohort_memberships").select("user_id, role, profiles:user_id(full_name, cal_poly_email)").eq("cohort_id", (projectData as any).cohorts.id).order("role"),
        supabase.from("cohort_memberships").select("*").eq("cohort_id", (projectData as any).cohorts.id).eq("user_id", user.id).maybeSingle(),
      ]);

      setPlaybooks(((playbooksRes.data as any[]) || []).map((p: any) => ({ ...p, steps: p.lab_steps || [] })));
      setMembership(membershipRes.data || null);

      const seededMembers = ((membersRes.data as any[]) || []).map((member) => ({ ...member, source: "membership" }));
      const seededUserIds = new Set(seededMembers.map((member: any) => member.user_id));
      const fallbackMembers = ((cohortMembersRes.data as any[]) || [])
        .filter((member: any) => !seededUserIds.has(member.user_id))
        .map((member: any) => ({
          id: `cohort-${member.user_id}`,
          user_id: member.user_id,
          role_on_project: getRoleOnProject(member.role),
          lane: null,
          profiles: member.profiles,
          source: "cohort",
        }));

      setMockMembers([...seededMembers, ...fallbackMembers]);
    } else {
      setPlaybooks([]);
      setMembership(null);
      setMockMembers((membersRes.data as any[]) || []);
    }

    setLoading(false);
  }, [id, user]);

  useEffect(() => { load(); }, [load]);

  const advanceStage = async (stageId: string, nextStageId: string) => {
    await supabase.from("project_stages").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", stageId);
    await supabase.from("project_stages").update({ status: "active", unlocked_at: new Date().toISOString() }).eq("id", nextStageId);
    toast.success("Stage advanced!");
    load();
  };

  const overrideStage = async (stageId: string, nextStageId: string) => {
    if (!overrideReason.trim()) { toast.error("Override reason required"); return; }
    await supabase.from("audit_logs").insert({
      user_id: user?.id, action: "stage_override", target_type: "project_stage", target_id: stageId,
      metadata: { reason: overrideReason, project_id: id } as any,
    });
    await advanceStage(stageId, nextStageId);
    setOverrideDialog(null);
    setOverrideReason("");
    toast.success("Stage overridden with logged justification");
  };

  const assignLane = async (member: any, lane: string) => {
    if (!id) return;

    const isFallbackMember = String(member.id).startsWith("cohort-");
    const { error } = isFallbackMember
      ? await supabase.from("mock_project_memberships").insert({
          mock_project_id: id,
          user_id: member.user_id,
          role_on_project: member.role_on_project,
          lane,
        })
      : await supabase.from("mock_project_memberships").update({ lane }).eq("mock_project_id", id).eq("id", member.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(`Workstream assigned: ${formatLaneLabel(lane)}`);
    setLaneDialog(null);
    load();
  };

  if (loading) return <div className="max-w-5xl mx-auto py-8"><Card className="h-48 animate-pulse bg-muted/30" /></div>;
  if (!project) return (
    <div className="flex flex-col items-center py-20 text-muted-foreground">
      <Target className="h-12 w-12 mb-3 opacity-30" />
      <p>Project not found.</p>
    </div>
  );

  const isEECohort = (project as any)?.cohorts?.name?.toLowerCase().includes("hardware") || (project as any)?.cohorts?.name?.toLowerCase().includes("embedded");
  const activeStage = stages.find(s => s.status === "active");
  const completedCount = stages.filter(s => s.status === "completed").length;
  const myMembership = mockMembers.find(m => m.user_id === user?.id);
  const rubric = Array.isArray(project.rubric) ? project.rubric : [];
  const workstreams = getWorkstreams(isEECohort);

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <motion.div variants={item} className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/app/cohort")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            {(project as any).cohorts?.name} • Training Program
          </p>
          <h1 className="font-display text-2xl font-bold">{project.title}</h1>
          <SectionExplainer text="This is your project workspace. It shows what your team is building and where you are in the process." className="mt-1" />
        </div>
        <div className="flex items-center gap-2">
          {myMembership?.lane && (
            <Badge variant="outline" className="text-xs font-mono border-accent/40 text-accent">
              {formatLaneLabel(myMembership.lane)}
            </Badge>
          )}
          <Badge variant="outline" className="text-xs font-mono">{project.status}</Badge>
        </div>
      </motion.div>

      {/* Stage Timeline */}
      <motion.div variants={item}>
        <Card className="border-border/50">
          <CardContent className="py-4">
            <div className="flex items-center gap-1.5 mb-3">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Project Stages</span>
              <InfoDot tip="Stages show where you are in the project timeline. Complete all required deliverables before moving to the next stage." />
            </div>
            <div className="flex items-center gap-1">
              {stages.map((stage, i) => {
                const isActive = stage.status === "active";
                const isCompleted = stage.status === "completed";
                const nextStage = stages[i + 1];
                const Icon = stageIcons[stage.name] || Target;
                return (
                  <div key={stage.id} className="flex items-center gap-1 flex-1">
                    <div className={`flex-1 rounded-lg p-3 border text-center transition-all ${
                      isCompleted ? "bg-success/10 border-success/30" :
                      isActive ? "bg-accent/10 border-accent/30 shadow-sm" :
                      "bg-muted/20 border-border/30 opacity-60"
                    }`}>
                      <Icon className={`h-4 w-4 mx-auto mb-1 ${
                        isCompleted ? "text-success" : isActive ? "text-accent" : "text-muted-foreground/50"
                      }`} />
                      <p className="text-[11px] font-semibold">{stage.name}</p>
                      {stage.due_date && (
                        <p className="text-[9px] text-muted-foreground mt-0.5">
                          {new Date(stage.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </p>
                      )}
                      {isActive && isLeader && nextStage && (
                        <div className="flex gap-1 mt-2 justify-center">
                          <Button size="sm" variant="outline" className="text-[10px] h-6 px-2"
                            onClick={() => advanceStage(stage.id, nextStage.id)}>
                            Complete
                          </Button>
                          <Button size="sm" variant="ghost" className="text-[10px] h-6 px-2 text-warning"
                            onClick={() => setOverrideDialog({ stageId: stage.id, nextId: nextStage.id })}>
                            Override
                          </Button>
                        </div>
                      )}
                    </div>
                    {i < stages.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground/30 shrink-0" />}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-muted/30 w-full justify-start">
          <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
          <TabsTrigger value="deliverables" className="text-xs">Deliverables</TabsTrigger>
          <TabsTrigger value="playbooks" className="text-xs">Playbooks</TabsTrigger>
          <TabsTrigger value="team" className="text-xs">Team & Lanes</TabsTrigger>
          <TabsTrigger value="docs" className="text-xs">Documents</TabsTrigger>
          <TabsTrigger value="rubric" className="text-xs">Rubric</TabsTrigger>
          {isLeader && <TabsTrigger value="control" className="text-xs">Control</TabsTrigger>}
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <motion.div variants={item}>
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Target className="h-4 w-4 text-accent" /> Project Brief
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{project.scenario}</p>
                </CardContent>
              </Card>
            </motion.div>
            <motion.div variants={item}>
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <CheckSquare className="h-4 w-4 text-accent" /> Objectives
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{project.objectives}</p>
                </CardContent>
              </Card>
            </motion.div>
            <motion.div variants={item}>
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4 text-accent" /> Deliverables Overview
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{project.deliverables_desc}</p>
                </CardContent>
              </Card>
            </motion.div>
            <motion.div variants={item}>
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Layers className="h-4 w-4 text-accent" /> Workstreams
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                    {workstreams.map((ws) => (
                      <div key={ws.key} className={`p-2 rounded-md border ${ws.cardClass}`}>
                        <p className={`text-xs font-semibold ${ws.labelClass}`}>{ws.name}</p>
                        <p className="text-[11px] text-muted-foreground">{ws.desc}</p>
                      </div>
                    ))}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </TabsContent>

        {/* Deliverables by Stage */}
        <TabsContent value="deliverables" className="mt-4 space-y-4">
          <SectionExplainer text="Deliverables are required outputs. They must be submitted and approved before the project can progress to the next stage." className="mb-2" />
          {stages.map(stage => {
            const reqs = Array.isArray(stage.required_deliverables) ? stage.required_deliverables : [];
            const isActive = stage.status === "active";
            return (
              <Card key={stage.id} className={isActive ? "border-accent/30" : "opacity-70"}>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    {isActive ? <Unlock className="h-4 w-4 text-accent" /> : <Lock className="h-4 w-4 text-muted-foreground/50" />}
                    {stage.name}
                    <Badge variant="outline" className="text-[10px] ml-auto">{reqs.length} deliverables</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-1.5">
                    {reqs.map((d: string, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-sm py-1.5 px-2 rounded-md hover:bg-muted/30 transition-colors">
                        <CheckSquare className="h-3.5 w-3.5 text-muted-foreground/40" />
                        <span className="flex-1">{d}</span>
                        {isActive && (
                          <Button size="sm" variant="ghost" className="h-6 text-[10px] text-accent"
                            onClick={() => setImportDialog(true)}>
                            Submit
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        {/* Playbooks */}
        <TabsContent value="playbooks" className="mt-4 space-y-4">
          <SectionExplainer text="Playbooks guide you step-by-step on how to complete your work. Follow each step and submit when done." className="mb-2" />
          {playbooks.map(pb => (
            <Card key={pb.id}>
              <CardHeader className="py-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-accent" />
                  {pb.title}
                  <Badge variant="outline" className="text-[10px] ml-auto">{pb.steps.length} steps</Badge>
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">{pb.description}</p>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-1">
                  {pb.steps.sort((a: any, b: any) => a.order_index - b.order_index).map((step: any, i: number) => (
                    <div key={step.id}
                      className="flex items-center gap-2 text-sm py-2 px-2 rounded-md hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => navigate(`/app/lab/${pb.id}`)}>
                      <span className="text-[10px] font-mono text-muted-foreground w-5">{i + 1}</span>
                      <span className="flex-1">{step.title}</span>
                      <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Team & Lanes */}
        <TabsContent value="team" className="mt-4">
          <Card>
            <CardHeader className="py-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="h-4 w-4 text-accent" /> Team Members
                <InfoDot tip="Workstreams define your responsibility within the project. Your lane determines your playbooks and deliverables." />
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {mockMembers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                  No members assigned yet. {isLeader ? "Add team members from the Control tab." : "Your PM will assign team members soon."}
                </p>
              ) : (
                <div className="space-y-2">
                  {mockMembers.map(m => (
                    <div key={m.id} className="flex items-center gap-3 py-2 px-2 rounded-md hover:bg-muted/20">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-mono">
                        {getMemberDisplayName(m).charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{getMemberDisplayName(m)}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">{getMemberSubline(m)}</p>
                      </div>
                      <Badge variant="secondary" className="text-[10px]">{m.role_on_project}</Badge>
                      <Badge variant="outline" className={`text-[10px] ${
                        m.lane ? "border-accent/40 text-accent" : "text-muted-foreground"
                      }`}>
                        {formatLaneLabel(m.lane)}
                      </Badge>
                      {isLeader && (
                        <Button size="sm" variant="ghost" className="h-6 text-[10px]"
                          onClick={() => setLaneDialog(m)}>
                          Assign
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Documents */}
        <TabsContent value="docs" className="mt-4 space-y-4">
          <SectionExplainer text="Upload files, link documents, and track versions. The system infers stage and deliverable automatically." className="mb-1" />
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Project Files</h3>
            <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setImportDialog(true)}>
              <Plus className="h-3 w-3 mr-1" /> Import Document
            </Button>
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            {folders.map(f => (
              <Card key={f.id} className="cursor-pointer hover:bg-muted/20 transition-colors">
                <CardContent className="py-3 flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 text-accent" />
                  <span className="text-sm font-medium">{f.name}</span>
                  <Badge variant="outline" className="text-[9px] ml-auto">
                    {documents.filter(d => d.folder_id === f.id).length}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
          {documents.length > 0 && (
            <Card>
              <CardContent className="py-3">
                <div className="space-y-1">
                  {documents.slice(0, 10).map(doc => (
                    <div key={doc.id} className="flex items-center gap-2 text-sm py-1.5 px-2 rounded-md hover:bg-muted/20">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="flex-1">{doc.title}</span>
                      <Badge variant="outline" className="text-[9px]">v{doc.version}</Badge>
                      <span className="text-[10px] text-muted-foreground">{doc.doc_type}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Rubric */}
        <TabsContent value="rubric" className="mt-4">
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Award className="h-4 w-4 text-accent" /> Review Rubric
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {(rubrics.length > 0 ? rubrics : rubric).map((r: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-sm border-b border-border/30 last:border-0 pb-2 last:pb-0">
                  <div>
                    <span className="font-medium">{r.category || r.criteria || `Criteria ${i + 1}`}</span>
                    {r.description && <p className="text-[11px] text-muted-foreground mt-0.5">{r.description}</p>}
                  </div>
                  <Badge variant="outline" className="text-[10px] font-mono shrink-0 ml-4">
                    {r.weight || r.points || "—"} pts
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Control Surface (Leader Only) */}
        {isLeader && (
          <TabsContent value="control" className="mt-4 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Shield className="h-4 w-4 text-accent" /> Stage Readiness
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  {stages.map(stage => {
                    const reqs = Array.isArray(stage.required_deliverables) ? stage.required_deliverables : [];
                    return (
                      <div key={stage.id} className="flex items-center justify-between text-sm">
                        <span className={stage.status === "active" ? "font-semibold text-accent" : "text-muted-foreground"}>
                          {stage.name}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground">{reqs.length} req</span>
                          <Badge variant={stage.status === "completed" ? "default" : "outline"} className="text-[10px]">
                            {stage.status}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-warning" /> Quick Actions
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  <Button size="sm" variant="outline" className="w-full text-xs justify-start h-8"
                    onClick={() => navigate("/app/messages")}>
                    <MessageSquare className="h-3 w-3 mr-2" /> Open Project Channels
                  </Button>
                  <Button size="sm" variant="outline" className="w-full text-xs justify-start h-8"
                    onClick={() => setImportDialog(true)}>
                    <Plus className="h-3 w-3 mr-2" /> Import Document
                  </Button>
                  <Button size="sm" variant="outline" className="w-full text-xs justify-start h-8"
                    onClick={() => navigate("/app/scheduling")}>
                    <Clock className="h-3 w-3 mr-2" /> Meeting Planner
                  </Button>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Users className="h-4 w-4 text-accent" /> Lane Management
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs text-muted-foreground mb-3">Assign members to a workstream so ownership is visible across playbooks, documents, and reviews.</p>
                <div className="space-y-2">
                  {mockMembers.map(m => (
                    <div key={m.id} className="flex items-center gap-3 py-1.5">
                      <span className="text-sm flex-1">{getMemberDisplayName(m)} <span className="text-muted-foreground">· {m.role_on_project}</span></span>
                      <Select value={m.lane || ""} onValueChange={(val) => assignLane(m, val)}>
                        <SelectTrigger className="w-44 h-7 text-xs"><SelectValue placeholder="Assign workstream" /></SelectTrigger>
                        <SelectContent>
                          {isEECohort ? (
                            <>
                              <SelectItem value="hardware_bringup">Hardware & Bring-Up</SelectItem>
                              <SelectItem value="sensor_integration">Sensor Integration</SelectItem>
                              <SelectItem value="decision_logic">Decision Logic</SelectItem>
                              <SelectItem value="interface_display">Interface & Display</SelectItem>
                              <SelectItem value="data_logging">Data Logging & Stability</SelectItem>
                            </>
                          ) : (
                            <>
                              <SelectItem value="foundations">Foundations</SelectItem>
                              <SelectItem value="systems">Systems</SelectItem>
                            </>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                  {mockMembers.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-3">
                      Members will appear here once added via the cohort hub.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Lane/Workstream Assignment Dialog */}
      <Dialog open={!!laneDialog} onOpenChange={() => setLaneDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Assign Workstream</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {isEECohort ? (
              <>
                {[
                  { key: "hardware_bringup", label: "Hardware & Bring-Up", icon: Zap },
                  { key: "sensor_integration", label: "Sensor Integration", icon: Target },
                  { key: "decision_logic", label: "Decision Logic", icon: Layers },
                  { key: "interface_display", label: "Interface & Display", icon: Play },
                  { key: "data_logging", label: "Data Logging & Stability", icon: Shield },
                ].map(ws => (
                  <Button key={ws.key} className="w-full justify-start" variant="outline"
                    onClick={() => laneDialog && assignLane(laneDialog, ws.key)}>
                    <ws.icon className="h-4 w-4 mr-2 text-accent" /> {ws.label}
                  </Button>
                ))}
              </>
            ) : (
              <>
                <Button className="w-full justify-start" variant="outline"
                  onClick={() => laneDialog && assignLane(laneDialog, "foundations")}>
                  <Layers className="h-4 w-4 mr-2 text-accent" /> Foundations Lane
                </Button>
                <Button className="w-full justify-start" variant="outline"
                  onClick={() => laneDialog && assignLane(laneDialog, "systems")}>
                  <Zap className="h-4 w-4 mr-2 text-primary" /> Systems Lane
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Override Dialog */}
      <Dialog open={!!overrideDialog} onOpenChange={() => setOverrideDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" /> Stage Override
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">This will advance the stage without all deliverables being approved. A justification is required and will be logged.</p>
          <Textarea placeholder="Why is this override necessary?"
            value={overrideReason} onChange={e => setOverrideReason(e.target.value)}
            className="text-sm" rows={3} />
          <Button size="sm" className="w-full" onClick={() => overrideDialog && overrideStage(overrideDialog.stageId, overrideDialog.nextId)}>
            Confirm Override
          </Button>
        </DialogContent>
      </Dialog>

      {/* Smart Import Dialog */}
      <Dialog open={importDialog} onOpenChange={setImportDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Import Document</DialogTitle>
          </DialogHeader>
          <SmartDocImport
            projectId={id!}
            projectTitle={project.title}
            stages={stages}
            folders={folders}
            activeStage={activeStage}
            onComplete={() => { setImportDialog(false); load(); }}
          />
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
