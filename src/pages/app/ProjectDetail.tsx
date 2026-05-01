import { useEffect, useMemo, useState } from "react";
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
import {
  Plus, ArrowLeft, Target, FileOutput, AlertTriangle, Upload, ExternalLink,
  CheckCircle2, ChevronRight, Activity, Sparkles, Trophy, Briefcase, FlaskConical, Wrench,
  UserPlus, TrendingUp, TrendingDown, Minus, Zap
} from "lucide-react";
import { toast } from "sonner";
import InlineDeliverableSubmit from "@/components/InlineDeliverableSubmit";
import DeliverableStatusBadge from "@/components/DeliverableStatusBadge";
import { AssignmentBundleDialog } from "@/components/AssignmentBundleDialog";
import { useRecentItems } from "@/hooks/useRecentItems";
import { DecisionMemoryWidget } from "@/components/decision/DecisionMemoryWidget";
import { ProjectGroupsPanel } from "@/components/ProjectGroupsPanel";
import { approveDeliverable, requestDeliverableChanges, approveWithOverride, validateTechnical, markDeliverableStarted, setDeliverableStage, archiveDeliverable } from "@/lib/reviewActions";
import { getUnifiedStatus, isBlockingStage, isOverdue, getValidationState, stageLabel, CANONICAL_STAGES } from "@/lib/deliverableStatus";
import { canApprove as canApproveD, canTechValidate, canMarkStarted, canSetStage, requiresOverride } from "@/lib/deliverablePermissions";
import { DeliverableOwnerBadge } from "@/components/DeliverableOwnerBadge";

const MODE_META: Record<string, { label: string; Icon: any; tone: string }> = {
  purpose_track: { label: "Purpose", Icon: FlaskConical, tone: "bg-primary/10 text-primary border-primary/20" },
  competition: { label: "Competition", Icon: Trophy, tone: "bg-warning/10 text-warning border-warning/20" },
  client_engagement: { label: "Contract", Icon: Briefcase, tone: "bg-accent/10 text-accent border-accent/20" },
  internal_initiative: { label: "Internal", Icon: Wrench, tone: "bg-muted text-foreground border-border" },
  training_mock: { label: "Training", Icon: Sparkles, tone: "bg-muted text-muted-foreground border-border" },
};

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const { trackVisit } = useRecentItems(0);
  const [project, setProject] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [deliverables, setDeliverables] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [risks, setRisks] = useState<any[]>([]);
  const [decisions, setDecisions] = useState<any[]>([]);
  const [updates, setUpdates] = useState<any[]>([]);
  const [reviewEvents, setReviewEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [taskDialog, setTaskDialog] = useState(false);
  const [submitTarget, setSubmitTarget] = useState<any>(null);
  const [approving, setApproving] = useState<string | null>(null);
  const [momentum, setMomentum] = useState<{ level: string; score: number } | null>(null);
  const [reassigning, setReassigning] = useState<string | null>(null);
  const [myGroupIds, setMyGroupIds] = useState<string[]>([]);
  const [groupsById, setGroupsById] = useState<Record<string, { name: string; member_count: number }>>({});
  const [overrideFor, setOverrideFor] = useState<any | null>(null);
  const [overrideReason, setOverrideReason] = useState("");

  const isProjectLead = members.some((m: any) => m.user_id === user?.id && m.role_on_project === "lead") || isAdmin;
  const isProjectTechLead = members.some((m: any) => m.user_id === user?.id && (m.role_on_project === "tech_lead" || m.role_on_project === "lead")) || isAdmin;

  const fetchAll = async () => {
    if (!id) return;
    setLoading(true);
    const [pRes, tRes, mRes, dRes, memRes, rRes, decRes, uRes, evRes, momRes] = await Promise.all([
      supabase.from("projects").select("*, organizations(name)").eq("id", id).single(),
      supabase.from("tasks").select("*, profiles:assignee_id(full_name)").eq("project_id", id).order("created_at", { ascending: false }),
      supabase.from("milestones").select("*").eq("project_id", id).order("due_date"),
      supabase.from("deliverables").select("*, owner:owner_id(full_name)").eq("project_id", id).order("created_at", { ascending: false }),
      supabase.from("project_memberships").select("*, profiles:user_id(full_name, avatar_url)").eq("project_id", id),
      supabase.from("risks").select("*").eq("project_id", id),
      supabase.from("decisions").select("*").eq("project_id", id).order("decided_at", { ascending: false }),
      supabase.from("project_updates").select("*").eq("project_id", id).order("created_at", { ascending: false }).limit(5),
      supabase.from("deliverable_review_events").select("*").eq("project_id", id).order("created_at", { ascending: false }).limit(8),
      supabase.from("momentum_signals").select("risk_level, risk_score").eq("project_id", id).order("computed_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    setProject(pRes.data);
    setTasks(tRes.data || []);
    setMilestones(mRes.data || []);
    setDeliverables(dRes.data || []);
    setMembers(memRes.data || []);
    setRisks(rRes.data || []);
    setDecisions(decRes.data || []);
    setUpdates(uRes.data || []);
    setReviewEvents(evRes.data || []);
    setMomentum(momRes.data ? { level: momRes.data.risk_level, score: momRes.data.risk_score } : null);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, [id]);

  // Resolve project groups + my membership in them (for group-owned deliverable visibility).
  useEffect(() => {
    const loadGroups = async () => {
      if (!id) return;
      const { data: groups } = await supabase.from("project_groups").select("id, name").eq("project_id", id);
      const ids = (groups || []).map((g: any) => g.id);
      if (!ids.length) { setMyGroupIds([]); setGroupsById({}); return; }
      const { data: gms } = await supabase.from("project_group_members").select("group_id, user_id").in("group_id", ids);
      const counts: Record<string, number> = {};
      const mine: string[] = [];
      (gms || []).forEach((gm: any) => {
        counts[gm.group_id] = (counts[gm.group_id] || 0) + 1;
        if (user && gm.user_id === user.id) mine.push(gm.group_id);
      });
      const map: Record<string, { name: string; member_count: number }> = {};
      (groups || []).forEach((g: any) => { map[g.id] = { name: g.name, member_count: counts[g.id] || 0 }; });
      setMyGroupIds(mine);
      setGroupsById(map);
    };
    loadGroups();
  }, [id, user]);

  useEffect(() => {
    if (project?.id && project?.name) {
      void trackVisit("project", project.id, project.name, `/app/projects/${project.id}`);
    }
  }, [project?.id, project?.name, trackVisit]);

  // ---------- Derived execution state ----------
  const currentStage = useMemo(() => {
    if (!milestones.length) return null;
    return (
      milestones.find((m) => m.status === "in_progress") ||
      milestones.find((m) => m.status === "not_started") ||
      milestones[milestones.length - 1]
    );
  }, [milestones]);

  const stageBlockers = useMemo(() => {
    if (!currentStage) return [] as any[];
    return deliverables.filter(
      (d) => d.milestone_id === currentStage.id && isBlockingStage({
        approval_status: d.approval_status, approval_required: d.approval_required,
        file_url: d.file_url, due_date: d.due_date, required: d.required,
      })
    );
  }, [deliverables, currentStage]);

  const nextDeadline = useMemo(() => {
    const upcoming = deliverables
      .filter((d) => d.due_date && getUnifiedStatus({
        approval_status: d.approval_status, approval_required: d.approval_required,
        file_url: d.file_url, due_date: d.due_date,
      }) !== "approved")
      .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
    return upcoming[0] || null;
  }, [deliverables]);

  // Personal next moves (member-centric). Includes group-owned deliverables where I am a group member.
  const myMoves = useMemo(() => {
    if (!user) return [] as any[];
    const moves: { id: string; label: string; deliverable: any; tone: "danger" | "warn" | "default" }[] = [];
    deliverables.forEach((d) => {
      const mineIndividual = d.owner_type !== "group" && d.owner_id === user.id;
      const mineGroup = d.owner_type === "group" && (myGroupIds || []).includes(d.owning_group_id);
      const mine = mineIndividual || mineGroup;
      if (!mine) return;
      const status = getUnifiedStatus(d);
      const overdue = isOverdue(d);
      if (status === "drafted" || status === "assigned" || status === "in_progress") {
        moves.push({
          id: d.id,
          label: overdue ? "Overdue — submit now" : status === "in_progress" ? "Submit" : "Start & submit",
          deliverable: d,
          tone: overdue ? "danger" : "default",
        });
      } else if (status === "needs_revision") {
        moves.push({ id: d.id, label: "Resubmit revision", deliverable: d, tone: "warn" });
      }
    });
    return moves.slice(0, 3);
  }, [deliverables, user, myGroupIds]);

  // Lead review queue (lead-centric)
  const reviewQueue = useMemo(() => {
    if (!isProjectLead) return [] as any[];
    return deliverables.filter(
      (d) => d.approval_required && d.file_url && d.approval_status === "pending"
    ).slice(0, 3);
  }, [deliverables, isProjectLead]);

  // Ownership gaps: required deliverables with no owner (lead concern).
  const ownershipGaps = useMemo(() => {
    return deliverables.filter((d) => d.required && !d.owner_id && d.approval_status !== "approved");
  }, [deliverables]);

  // Proactive top action — what to do AND why it matters.
  const topAction = useMemo(() => {
    const blocked = stageBlockers.length > 0;
    if (blocked) {
      const b = stageBlockers[0];
      if (!b.owner_id && isProjectLead) {
        return { kind: "assign", label: `Assign owner: ${b.title}`, hint: "to unblock this stage", deliverable: b, variant: "default" as const };
      }
      return { kind: "submit", label: `Unblock: ${b.title}`, hint: "to advance the current stage", deliverable: b, variant: "default" as const };
    }
    if (myMoves[0]) {
      const m = myMoves[0];
      const last = milestones[milestones.length - 1]?.id === m.deliverable.milestone_id;
      const hint = m.tone === "danger" ? "this is overdue" : last ? "to complete the project" : "to keep the stage moving";
      return { kind: "submit", label: m.label, hint, deliverable: m.deliverable, variant: m.tone === "danger" ? "destructive" as const : "default" as const };
    }
    if (reviewQueue[0]) {
      return { kind: "review", label: `Review: ${reviewQueue[0].title}`, hint: "to unblock the submitter", deliverable: reviewQueue[0], variant: "default" as const };
    }
    if (ownershipGaps[0] && isProjectLead) {
      return { kind: "assign", label: `Assign owner: ${ownershipGaps[0].title}`, hint: "no one is on this yet", deliverable: ownershipGaps[0], variant: "default" as const };
    }
    return null;
  }, [stageBlockers, myMoves, reviewQueue, ownershipGaps, isProjectLead, milestones]);

  // Inline owner reassignment for any deliverable.
  const reassignOwner = async (deliverableId: string, newOwnerId: string | null) => {
    setReassigning(deliverableId);
    const { error } = await supabase.from("deliverables")
      .update({ owner_id: newOwnerId })
      .eq("id", deliverableId);
    setReassigning(null);
    if (error) { toast.error(error.message); return; }
    toast.success(newOwnerId ? "Owner updated" : "Owner cleared");
    fetchAll();
  };

  const handleCreateTask = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const { error } = await supabase.from("tasks").insert([{
      project_id: id!,
      title: f.get("title") as string,
      description: f.get("description") as string,
      priority: (f.get("priority") as "low" | "medium" | "high" | "urgent") || "medium",
      status: "todo" as const,
      created_by: user!.id,
    }]);
    if (error) { toast.error(error.message); return; }
    toast.success("Task created");
    setTaskDialog(false);
    fetchAll();
  };

  const updateTaskStatus = async (taskId: string, status: string) => {
    await supabase.from("tasks").update({ status: status as "todo" | "in_progress" | "review" | "done" }).eq("id", taskId);
    fetchAll();
  };

  if (loading) return <div className="flex items-center justify-center py-12"><div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" /></div>;
  if (!project) return <div className="text-center py-12"><p className="text-muted-foreground">Project not found</p></div>;

  const columns = ["todo", "in_progress", "review", "done"];
  const columnLabels: Record<string, string> = { todo: "To Do", in_progress: "In Progress", review: "Review", done: "Done" };
  const mode = MODE_META[project.project_mode as string] || MODE_META.internal_initiative;
  const ModeIcon = mode.Icon;
  const stageProgress = currentStage?.progress ?? 0;
  const stageIsBlocked = stageBlockers.length > 0;

  const ownerName = (d: any) => d.owner?.full_name || (d.owner_id ? "Assigned" : "Unassigned");

  const MOMENTUM_META: Record<string, { label: string; tone: string; Icon: any }> = {
    healthy: { label: "Healthy", tone: "bg-success/10 text-success border-success/20", Icon: TrendingUp },
    watch: { label: "Watch", tone: "bg-muted text-foreground border-border", Icon: Minus },
    at_risk: { label: "At risk", tone: "bg-warning/10 text-warning border-warning/20", Icon: TrendingDown },
    stalled: { label: "Stalled", tone: "bg-destructive/10 text-destructive border-destructive/20", Icon: AlertTriangle },
  };

  return (
    <div className="space-y-5">
      {/* ===================== STATUS HEADER ===================== */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/app/projects")}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={`gap-1 text-[10px] ${mode.tone}`}>
              <ModeIcon className="h-3 w-3" /> {mode.label}
            </Badge>
            <Badge variant="outline" className="text-[10px] capitalize">{project.status}</Badge>
            {project.organizations?.name && (
              <Badge variant="outline" className="text-[10px]">{project.organizations.name}</Badge>
            )}
            {momentum && MOMENTUM_META[momentum.level] && (() => {
              const M = MOMENTUM_META[momentum.level];
              return (
                <Badge variant="outline" className={`gap-1 text-[10px] ${M.tone}`} title={`Momentum score ${momentum.score}/100`}>
                  <M.Icon className="h-3 w-3" /> {M.label}
                </Badge>
              );
            })()}
          </div>
          <h1 className="font-display text-2xl font-bold truncate mt-1">{project.name}</h1>
        </div>
        {isProjectLead && (
          <AssignmentBundleDialog
            projectId={id!}
            members={members.map((m: any) => ({ user_id: m.user_id, full_name: m.profiles?.full_name }))}
            milestones={milestones.map((m: any) => ({ id: m.id, title: m.title }))}
            onCreated={fetchAll}
          />
        )}
      </div>

      {/* ===================== EXECUTION BANNER ===================== */}
      <Card className={stageIsBlocked ? "border-destructive/40 bg-destructive/[0.03]" : "border-primary/30"}>
        <CardContent className="p-4 grid gap-4 md:grid-cols-[1.6fr_1fr_1fr] items-center">
          {/* Current stage */}
          <div className="space-y-2 min-w-0">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary shrink-0" />
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Current stage</p>
            </div>
            {currentStage ? (
              <>
                <p className="text-sm font-semibold truncate">{currentStage.title}</p>
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div className={`h-full ${stageIsBlocked ? "bg-destructive" : "bg-primary"} transition-all`} style={{ width: `${stageProgress}%` }} />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {stageIsBlocked ? (
                    <Badge variant="destructive" className="gap-1 text-[10px]">
                      <AlertTriangle className="h-2.5 w-2.5" /> Blocked · {stageBlockers.length}
                    </Badge>
                  ) : (
                    <Badge className="gap-1 text-[10px] bg-success text-success-foreground border-transparent">
                      <CheckCircle2 className="h-2.5 w-2.5" /> Ready
                    </Badge>
                  )}
                  <span className="text-[10px] text-muted-foreground">{stageProgress}% complete</span>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No stages defined yet.</p>
            )}
          </div>

          {/* Next deadline */}
          <div className="space-y-1 min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Next deadline</p>
            {nextDeadline ? (
              <>
                <p className="text-sm font-medium truncate">{nextDeadline.title}</p>
                <p className="text-xs text-muted-foreground">
                  Due {new Date(nextDeadline.due_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  {" · "}{ownerName(nextDeadline)}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">None upcoming</p>
            )}
          </div>

          {/* Highest-priority action */}
          <div className="space-y-1 min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Top action</p>
            {topAction ? (
              <>
                <Button
                  size="sm"
                  className="w-full justify-between"
                  variant={topAction.variant}
                  onClick={() => {
                    if (topAction.kind === "review") {
                      // jump to review queue card via deliverables tab focus
                      setSubmitTarget(null);
                      const el = document.querySelector(`[data-deliverable-id="${topAction.deliverable.id}"]`);
                      el?.scrollIntoView({ behavior: "smooth", block: "center" });
                    } else {
                      setSubmitTarget(topAction.deliverable);
                    }
                  }}
                >
                  <span className="truncate flex items-center gap-1.5">
                    <Zap className="h-3 w-3 shrink-0" />{topAction.label}
                  </span>
                  <ChevronRight className="h-3 w-3 shrink-0" />
                </Button>
                <p className="text-[10px] text-muted-foreground italic truncate">{topAction.hint}</p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground italic">All clear · nothing blocking</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ===================== TABS ===================== */}
      <Tabs defaultValue="hub" className="space-y-4">
        <TabsList>
          <TabsTrigger value="hub">Hub</TabsTrigger>
          <TabsTrigger value="deliverables">Deliverables{deliverables.length > 0 && <span className="ml-1 text-[10px] text-muted-foreground">{deliverables.length}</span>}</TabsTrigger>
          <TabsTrigger value="board">Board{tasks.length > 0 && <span className="ml-1 text-[10px] text-muted-foreground">{tasks.length}</span>}</TabsTrigger>
          <TabsTrigger value="team">Team{members.length > 0 && <span className="ml-1 text-[10px] text-muted-foreground">{members.length}</span>}</TabsTrigger>
        </TabsList>

        {/* ============ HUB ============ */}
        <TabsContent value="hub" className="space-y-5">
          {/* Personal & lead next moves */}
          {(myMoves.length > 0 || reviewQueue.length > 0) && (
            <div className="grid gap-4 lg:grid-cols-2">
              {myMoves.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Your next moves</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {myMoves.map((m) => (
                      <button key={m.id} onClick={() => setSubmitTarget(m.deliverable)}
                        className="w-full flex items-center justify-between gap-2 rounded-md border bg-card hover:border-primary/40 hover:bg-muted/40 p-2.5 text-left transition-colors">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{m.deliverable.title}</p>
                          <p className="text-[11px] text-muted-foreground">{m.label}{m.deliverable.due_date && ` · Due ${new Date(m.deliverable.due_date).toLocaleDateString()}`}</p>
                        </div>
                        <Upload className="h-4 w-4 text-muted-foreground shrink-0" />
                      </button>
                    ))}
                  </CardContent>
                </Card>
              )}
              {reviewQueue.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Awaiting your review</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {reviewQueue.map((d) => (
                      <div key={d.id} className="flex items-center justify-between gap-2 rounded-md border p-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{d.title}</p>
                          <p className="text-[11px] text-muted-foreground">v{d.version} · {ownerName(d)}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {d.file_url && (
                            <Button asChild variant="ghost" size="sm" className="h-7 px-2">
                              <a href={d.file_url} target="_blank" rel="noreferrer"><ExternalLink className="h-3 w-3" /></a>
                            </Button>
                          )}
                          <Button size="sm" className="h-7 gap-1" disabled={approving === d.id} onClick={async () => {
                            setApproving(d.id);
                            const res = await approveDeliverable(d.id);
                            setApproving(null);
                            if (res.ok === false) return toast.error(res.error);
                            toast.success("Approved"); fetchAll();
                          }}>
                            <CheckCircle2 className="h-3 w-3" /> Approve
                          </Button>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Stages */}
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Stages</CardTitle>
              <span className="text-[11px] text-muted-foreground">{milestones.length} total</span>
            </CardHeader>
            <CardContent>
              {milestones.length === 0 ? (
                <p className="text-sm text-muted-foreground">No stages yet.</p>
              ) : (
                <div className="space-y-2">
                  {milestones.map((m) => {
                    const blockers = deliverables.filter((d: any) => d.milestone_id === m.id && isBlockingStage({
                      approval_status: d.approval_status, approval_required: d.approval_required,
                      file_url: d.file_url, due_date: d.due_date, required: d.required,
                    }));
                    const isCurrent = currentStage?.id === m.id;
                    return (
                      <div key={m.id} className={`rounded-md border p-3 ${isCurrent ? "border-primary/40 bg-primary/[0.03]" : ""}`}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Target className={`h-4 w-4 shrink-0 ${isCurrent ? "text-primary" : "text-muted-foreground"}`} />
                          <p className="font-medium text-sm flex-1 truncate">{m.title}</p>
                          {isCurrent && <Badge variant="outline" className="text-[9px] border-primary/40 text-primary">Current</Badge>}
                          {blockers.length > 0
                            ? <Badge variant="destructive" className="text-[10px] gap-1"><AlertTriangle className="h-2.5 w-2.5" /> {blockers.length} blocking</Badge>
                            : <Badge className="text-[10px] gap-1 bg-success text-success-foreground border-transparent"><CheckCircle2 className="h-2.5 w-2.5" /> Ready</Badge>}
                          {m.due_date && <span className="text-[10px] text-muted-foreground">{new Date(m.due_date).toLocaleDateString()}</span>}
                        </div>
                        <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                          <div className="h-full bg-primary transition-all" style={{ width: `${m.progress}%` }} />
                        </div>
                        {blockers.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {blockers.map((b: any) => (
                              <button key={b.id} onClick={() => setSubmitTarget(b)}
                                className="w-full flex items-center justify-between gap-2 text-xs rounded border border-destructive/20 bg-destructive/5 hover:bg-destructive/10 px-2 py-1.5 text-left">
                                <span className="truncate">{b.title}</span>
                                <span className="flex items-center gap-1.5 shrink-0">
                                  <span className="text-[10px] text-muted-foreground">{ownerName(b)}</span>
                                  <DeliverableStatusBadge status={b.approval_status} fileUrl={b.file_url} dueDate={b.due_date} approvalRequired={b.approval_required} />
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* What changed + Risks side-by-side */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1.5">
                  <Activity className="h-3 w-3" /> What changed
                </CardTitle>
              </CardHeader>
              <CardContent>
                {reviewEvents.length === 0 && updates.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No recent activity.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {reviewEvents.slice(0, 5).map((e) => (
                      <li key={e.id} className="flex items-start gap-2">
                        <span className="text-[10px] text-muted-foreground mt-0.5 w-14 shrink-0">{new Date(e.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                        <span className="capitalize text-foreground">
                          {e.event_type.replace("_", " ")}
                          {e.version && <span className="text-muted-foreground"> · v{e.version}</span>}
                        </span>
                      </li>
                    ))}
                    {updates.slice(0, 2).map((u) => (
                      <li key={u.id} className="flex items-start gap-2">
                        <span className="text-[10px] text-muted-foreground mt-0.5 w-14 shrink-0">{new Date(u.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                        <span className="text-foreground line-clamp-2">{u.summary}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Risks{risks.length > 0 && <span className="ml-1 lowercase tracking-normal text-muted-foreground">· {risks.length}</span>}</CardTitle>
              </CardHeader>
              <CardContent>
                {risks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No risks registered.</p>
                ) : (
                  <ul className="space-y-2">
                    {risks.slice(0, 4).map((r) => (
                      <li key={r.id} className="flex items-start gap-2 text-sm">
                        <AlertTriangle className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${r.severity === "critical" ? "text-destructive" : r.severity === "high" ? "text-warning" : "text-muted-foreground"}`} />
                        <div className="flex-1 min-w-0">
                          <p className="truncate">{r.title}</p>
                          {r.mitigation && <p className="text-[11px] text-muted-foreground truncate">{r.mitigation}</p>}
                        </div>
                        <Badge variant={r.status === "open" ? "destructive" : "secondary"} className="text-[10px] shrink-0">{r.status}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Decisions */}
          <DecisionMemoryWidget projectId={id!} onSaved={fetchAll} />

          {/* Project meta — collapsed at the bottom */}
          {(project.description || project.scope) && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Context</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {project.description && <p>{project.description}</p>}
                {project.scope && <p className="text-muted-foreground"><span className="font-medium text-foreground">Scope:</span> {project.scope}</p>}
                <div className="flex gap-4 text-xs text-muted-foreground">
                  {project.start_date && <span>Start {project.start_date}</span>}
                  {project.end_date && <span>End {project.end_date}</span>}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ============ DELIVERABLES ============ */}
        <TabsContent value="deliverables">
          {deliverables.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No deliverables yet.</p> : (
            <div className="space-y-2">
              {deliverables.map(d => {
                const milestone = milestones.find((m: any) => m.id === d.milestone_id);
                const isOwnerOrLead = d.owner_id === user?.id || !d.owner_id || isProjectLead;
                const canApprove = isProjectLead && d.file_url && d.approval_status === "pending" && d.approval_required;
                const blocking = isBlockingStage({
                  approval_status: d.approval_status, approval_required: d.approval_required,
                  file_url: d.file_url, due_date: d.due_date, required: d.required,
                });
                return (
                  <Card key={d.id} data-deliverable-id={d.id} className={blocking ? "border-destructive/30" : ""}>
                    <CardContent className="flex items-center gap-4 p-4">
                      <FileOutput className="h-5 w-5 text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm truncate">{d.title}</p>
                          <span className="text-[10px] text-muted-foreground font-mono">v{d.version}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap mt-1">
                          <DeliverableStatusBadge
                            status={d.approval_status}
                            fileUrl={d.file_url}
                            dueDate={d.due_date}
                            approvalRequired={d.approval_required}
                            blockingStage={blocking}
                          />
                          {isProjectLead ? (
                            <Select
                              value={d.owner_id || "__unassigned"}
                              onValueChange={(v) => reassignOwner(d.id, v === "__unassigned" ? null : v)}
                              disabled={reassigning === d.id}
                            >
                              <SelectTrigger className="h-6 px-2 text-[10px] w-auto gap-1 border-dashed">
                                <UserPlus className="h-2.5 w-2.5" />
                                <SelectValue>{ownerName(d)}</SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__unassigned">Unassigned</SelectItem>
                                {members.map((m: any) => (
                                  <SelectItem key={m.user_id} value={m.user_id}>
                                    {m.profiles?.full_name || "Member"}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">Owner: {ownerName(d)}</span>
                          )}
                          {milestone && <span className="text-[10px] text-muted-foreground">· {milestone.title}</span>}
                          {d.due_date && <span className="text-[10px] text-muted-foreground">· Due {new Date(d.due_date).toLocaleDateString()}</span>}
                          {d.client_visible && <Badge variant="outline" className="text-[10px]">Client visible</Badge>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {d.file_url && (
                          <Button asChild variant="ghost" size="sm" className="h-8 gap-1">
                            <a href={d.file_url} target="_blank" rel="noreferrer"><ExternalLink className="h-3 w-3" /> Open</a>
                          </Button>
                        )}
                        {isOwnerOrLead && d.approval_status !== "approved" && (
                          <Button size="sm" variant={d.file_url ? "outline" : "default"} className="h-8 gap-1" onClick={() => setSubmitTarget(d)}>
                            <Upload className="h-3 w-3" />
                            {d.file_url ? (d.approval_status === "revision_requested" ? "Resubmit" : "Replace") : "Submit"}
                          </Button>
                        )}
                        {canApprove && (
                          <>
                            <Button size="sm" variant="default" className="h-8 gap-1" disabled={approving === d.id}
                              onClick={async () => {
                                setApproving(d.id);
                                const res = await approveDeliverable(d.id);
                                setApproving(null);
                                if (res.ok === false) { toast.error(`Approve failed: ${res.error}`); return; }
                                toast.success("Approved"); fetchAll();
                              }}>
                              <CheckCircle2 className="h-3 w-3" /> Approve
                            </Button>
                            <Button size="sm" variant="outline" className="h-8" disabled={approving === d.id}
                              onClick={async () => {
                                const reason = window.prompt("What needs to change? (will be visible to owner)");
                                if (reason === null) return;
                                setApproving(d.id);
                                const res = await requestDeliverableChanges(d.id, reason);
                                setApproving(null);
                                if (res.ok === false) { toast.error(res.error); return; }
                                toast.success("Revision requested"); fetchAll();
                              }}>
                              Request changes
                            </Button>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ============ BOARD ============ */}
        <TabsContent value="board">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">{tasks.length} tasks · lightweight working list</p>
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

        {/* ============ TEAM ============ */}
        <TabsContent value="team">
          {(() => {
            const leads = members.filter((m) => m.role_on_project === "lead");
            const others = members.filter((m) => m.role_on_project !== "lead");
            const ownedCount = (uid: string) => deliverables.filter((d) => d.owner_id === uid).length;
            const renderCard = (m: any) => (
              <Card key={m.id}>
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                    {(m.profiles as any)?.full_name?.charAt(0) || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {(m.profiles as any)?.full_name || "Former member"}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Badge variant={m.role_on_project === "lead" ? "default" : "outline"} className="text-[10px] capitalize">{m.role_on_project}</Badge>
                      <span className="text-[10px] text-muted-foreground">· owns {ownedCount(m.user_id)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
            return (
              <div className="space-y-5">
                {leads.length > 0 && (
                  <div>
                    <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-2">Leads</h3>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{leads.map(renderCard)}</div>
                  </div>
                )}
                {others.length > 0 && (
                  <div>
                    <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-2">Members</h3>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{others.map(renderCard)}</div>
                  </div>
                )}
                {members.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No members assigned.</p>}
                <div className="pt-4 border-t border-border/60">
                  <ProjectGroupsPanel
                    projectId={id!}
                    projectName={project?.name || ""}
                    members={members}
                    canManage={isProjectLead}
                    currentUserId={user?.id}
                  />
                </div>
              </div>
            );
          })()}
        </TabsContent>
      </Tabs>

      <InlineDeliverableSubmit
        open={!!submitTarget}
        onOpenChange={(v) => !v && setSubmitTarget(null)}
        deliverable={submitTarget}
        projectName={project?.name || ""}
        milestoneName={milestones.find((m: any) => m.id === submitTarget?.milestone_id)?.title}
        onSubmitted={fetchAll}
      />
    </div>
  );
}
