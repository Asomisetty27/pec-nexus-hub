import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FolderKanban, CheckCircle2, AlertTriangle, Clock, Users,
  MessageSquare, Target, Shield, ChevronRight, Megaphone, HelpCircle,
  BookOpen, Send, RefreshCw, Ban, ExternalLink, History, Loader2, Sparkles,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Textarea } from "@/components/ui/textarea";
import { logAuditAction } from "@/lib/audit";
import { SectionExplainer, InfoDot } from "@/components/ui/SectionExplainer";
import { MomentumRiskPanel } from "@/components/momentum/MomentumRiskPanel";
import { approveDeliverable as approveDeliverableRpc, requestDeliverableChanges, rejectDeliverable } from "@/lib/reviewActions";
import { displayName } from "@/lib/utils";
import { AssignmentBundleDialog } from "@/components/AssignmentBundleDialog";
import DeliverableReviewHistory from "@/components/DeliverableReviewHistory";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { getUnifiedStatus, getValidationState, stageLabel } from "@/lib/deliverableStatus";
import { ShieldAlert, ShieldCheck, Layers } from "lucide-react";
import { CadenceHealthCard } from "@/components/CadenceHealthCard";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const item = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.2 } } };

export default function LeadWorkspace() {
  const { user, isAdmin, isBoardOrAdmin } = useAuth();
  const navigate = useNavigate();
  const [cohort, setCohort] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [deliverables, setDeliverables] = useState<any[]>([]);
  const [helpRequests, setHelpRequests] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [cohortProjectIds, setCohortProjectIds] = useState<string[]>([]);
  const [announceText, setAnnounceText] = useState("");
  const [announceTitle, setAnnounceTitle] = useState("");
  const [reasonFor, setReasonFor] = useState<{ id: string; mode: "request_changes" | "reject" } | null>(null);
  const [reasonText, setReasonText] = useState("");
  const [historyFor, setHistoryFor] = useState<any | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: cm } = await supabase.from("cohort_memberships").select("*, cohorts(*)").eq("user_id", user.id).limit(1).maybeSingle();
      setCohort(cm);
      if (!cm) return;
      const cohortId = cm.cohort_id;

      const memberIds = (await supabase.from("cohort_memberships").select("user_id").eq("cohort_id", cohortId)).data?.map((m: any) => m.user_id) || [];

      // Resolve project_groups whose membership intersects this cohort, so we
      // also surface group-owned deliverables. One shared "ownership" lens.
      let cohortGroupIds: string[] = [];
      if (memberIds.length > 0) {
        const { data: gms } = await supabase
          .from("project_group_members")
          .select("group_id")
          .in("user_id", memberIds);
        cohortGroupIds = Array.from(new Set((gms || []).map((g: any) => g.group_id)));
      }
      const groupOrFilter = cohortGroupIds.length
        ? `,and(owner_type.eq.group,owning_group_id.in.(${cohortGroupIds.join(",")}))`
        : "";
      const ownerOrFilter = memberIds.length
        ? `or=and(owner_type.neq.group,owner_id.in.(${memberIds.join(",")}))${groupOrFilter}`
        : "";

      const [projRes, delRes, helpRes, memRes] = await Promise.all([
        supabase.from("mock_projects").select("*").eq("cohort_id", cohortId).order("created_at", { ascending: false }),
        memberIds.length === 0
          ? Promise.resolve({ data: [] as any[] })
          : supabase.from("deliverables")
              .select("*, projects(name), profiles:owner_id(full_name)")
              .or(`and(owner_type.neq.group,owner_id.in.(${memberIds.join(",")}))${groupOrFilter}`)
              .order("due_date", { ascending: true }).limit(80),
        supabase.from("help_requests").select("*, profiles:requester_id(full_name)").eq("cohort_id", cohortId).eq("status", "open").order("created_at"),
        supabase.from("cohort_memberships").select("*, profiles:user_id(full_name, cal_poly_email)").eq("cohort_id", cohortId).order("role"),
      ]);
      setProjects(projRes.data || []);
      setDeliverables(delRes.data || []);
      setHelpRequests(helpRes.data || []);
      setMembers(memRes.data || []);

      // Resolve projects this cohort touches (via project memberships)
      if (memberIds.length > 0) {
        const { data: pms } = await supabase.from("project_memberships").select("project_id").in("user_id", memberIds);
        setCohortProjectIds(Array.from(new Set((pms || []).map((p: any) => p.project_id))));
      }

      // Fetch stages for active mock projects
      if (projRes.data && projRes.data.length > 0) {
        const { data: stagesData } = await supabase.from("project_stages").select("*").in("mock_project_id", projRes.data.map((p: any) => p.id)).order("order_index");
        setStages(stagesData || []);
      }
    };
    load();
  }, [user]);

  const overdueDeliverables = deliverables.filter(d => d.due_date && new Date(d.due_date) < new Date() && d.approval_status !== "approved");
  const pendingReview = deliverables.filter(d => d.approval_status === "pending" && d.approval_required);

  // ---- Phase 4 doctrine prompt rows (high-signal, compact) ----
  const unstagedRows = deliverables.filter(d =>
    !d.archived && !d.canonical_stage && d.approval_status !== "approved"
  );
  const awaitingTechValidationRows = deliverables.filter(d => {
    const v = getValidationState(d);
    return v === "awaiting_tech_validation";
  });
  const awaitingPmApprovalRows = deliverables.filter(d => {
    const v = getValidationState(d);
    return v === "awaiting_pm_approval" || (
      // also surface plain pending-with-file when no tech-validation gating exists
      d.approval_status === "pending" && d.approval_required && d.file_url && !d.tech_validation_required
    );
  });

  const cohortName = (cohort?.cohorts as any)?.name || "Your Cohort";

  const approveDeliverable = async (id: string) => {
    const res = await approveDeliverableRpc(id);
    if (res.ok === false) { toast.error(`Approval failed: ${res.error}`); return; }
    toast.success("Deliverable approved");
    setDeliverables(prev => prev.map(d => d.id === id ? { ...d, approval_status: "approved", approved: true } : d));
  };

  const requestChanges = async (id: string) => {
    setReasonFor({ id, mode: "request_changes" });
    setReasonText("");
  };

  const rejectDelv = (id: string) => {
    setReasonFor({ id, mode: "reject" });
    setReasonText("");
  };

  const submitReason = async () => {
    if (!reasonFor) return;
    setBusy(reasonFor.id);
    const res = reasonFor.mode === "reject"
      ? await rejectDeliverable(reasonFor.id, reasonText)
      : await requestDeliverableChanges(reasonFor.id, reasonText);
    setBusy(null);
    if (res.ok === false) { toast.error(res.error); return; }
    toast.success(reasonFor.mode === "reject" ? "Deliverable rejected" : "Revision requested");
    setDeliverables(prev => prev.map(d => d.id === reasonFor.id
      ? { ...d, approval_status: reasonFor.mode === "reject" ? "rejected" : "revision_requested" }
      : d));
    setReasonFor(null); setReasonText("");
  };

  const postAnnouncement = async () => {
    if (!announceTitle.trim() || !announceText.trim()) return;
    const { error } = await supabase.from("announcements").insert({ title: announceTitle, body: announceText, author_id: user!.id });
    if (error) { toast.error(`Post failed: ${error.message}`); return; }
    toast.success("Announcement posted");
    setAnnounceTitle("");
    setAnnounceText("");
  };

  const isLead = cohort?.role && ["pm", "lead", "integration_lead"].includes(cohort.role);
  if (!isLead && !isAdmin) {
    return (
      <div className="flex flex-col items-center py-20 text-muted-foreground">
        <Shield className="h-12 w-12 mb-3 opacity-30" />
        <p className="text-sm">PM / Tech Lead access required.</p>
        <p className="text-xs text-muted-foreground mt-1">Contact your cohort PM for access.</p>
      </div>
    );
  }

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6 max-w-5xl">
      <motion.div variants={item}>
        <h1 className="font-display text-2xl font-bold">Leadership Workspace</h1>
        <p className="text-xs text-muted-foreground font-mono">{cohortName} · {cohort?.role}</p>
        <SectionExplainer text="You manage progress, assign work, and move stages forward. Review pending deliverables and resolve blockers here." className="mt-1" />
      </motion.div>

      {/* Summary cards */}
      <motion.div variants={item} className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <SummaryCard icon={AlertTriangle} label="Overdue" value={overdueDeliverables.length} variant={overdueDeliverables.length > 0 ? "destructive" : "default"} />
        <SummaryCard icon={Clock} label="Pending Review" value={pendingReview.length} />
        <SummaryCard icon={HelpCircle} label="Help Requests" value={helpRequests.length} variant={helpRequests.length > 0 ? "warning" : "default"} />
        <SummaryCard icon={Users} label="Members" value={members.length} />
      </motion.div>

      {/* Momentum risk for projects this cohort touches */}
      <motion.div variants={item}>
        <MomentumRiskPanel
          projectIds={cohortProjectIds}
          mode="leadership"
          limit={6}
          title="Momentum Risk · Your Projects"
        />
      </motion.div>

      {/* Doctrine prompt rows — show only when actionable, keep compact */}
      {(unstagedRows.length > 0 || awaitingTechValidationRows.length > 0 || awaitingPmApprovalRows.length > 0) && (
        <motion.div variants={item} className="space-y-2">
          {unstagedRows.length > 0 && (
            <DoctrinePromptRow
              icon={Layers}
              tone="muted"
              title="Unstaged deliverables"
              count={unstagedRows.length}
              hint="Set a canonical stage so progress can be tracked."
              items={unstagedRows.slice(0, 4)}
              onItemClick={(d) => navigate(`/app/projects/${d.project_id}`)}
            />
          )}
          {awaitingTechValidationRows.length > 0 && (
            <DoctrinePromptRow
              icon={ShieldAlert}
              tone="warning"
              title="Awaiting tech validation"
              count={awaitingTechValidationRows.length}
              hint="Tech Lead review is gating PM approval."
              items={awaitingTechValidationRows.slice(0, 4)}
              onItemClick={(d) => navigate(`/app/projects/${d.project_id}`)}
            />
          )}
          {awaitingPmApprovalRows.length > 0 && (
            <DoctrinePromptRow
              icon={ShieldCheck}
              tone="primary"
              title="Awaiting PM approval"
              count={awaitingPmApprovalRows.length}
              hint="Tech-validated work ready for your final sign-off."
              items={awaitingPmApprovalRows.slice(0, 4)}
              showOverrideWarning
              onItemClick={(d) => navigate(`/app/projects/${d.project_id}`)}
            />
          )}
        </motion.div>
      )}

      {/* Cadence health (Phase 5) — cohort + first project */}
      <motion.div variants={item} className="grid gap-3 md:grid-cols-2">
        {cohort?.cohort_id && <CadenceHealthCard scope="cohort" targetId={cohort.cohort_id} dense />}
        {projects[0]?.id && <CadenceHealthCard scope="project" targetId={projects[0].id} dense />}
      </motion.div>

      <Tabs defaultValue="review">
        <TabsList>
          <TabsTrigger value="review" className="gap-1.5">
            <CheckCircle2 className="h-3 w-3" />Review Queue
            {pendingReview.length > 0 && <Badge className="h-4 min-w-4 p-0 flex items-center justify-center text-[9px]">{pendingReview.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="overdue" className="gap-1.5">
            <AlertTriangle className="h-3 w-3" />Overdue ({overdueDeliverables.length})
          </TabsTrigger>
          <TabsTrigger value="help" className="gap-1.5">
            <HelpCircle className="h-3 w-3" />Help ({helpRequests.length})
          </TabsTrigger>
          <TabsTrigger value="team"><Users className="h-3 w-3" /> Team</TabsTrigger>
          <TabsTrigger value="announce"><Megaphone className="h-3 w-3" /> Announce</TabsTrigger>
        </TabsList>

        <TabsContent value="review" className="mt-4 space-y-2">
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              {pendingReview.length} item{pendingReview.length === 1 ? "" : "s"} awaiting your decision
            </p>
            {projects.length > 0 && members.length > 0 && cohortProjectIds[0] && (
              <AssignmentBundleDialog
                projectId={cohortProjectIds[0]}
                members={members.map((m: any) => ({
                  user_id: m.user_id,
                  full_name: (m.profiles as any)?.full_name,
                  cal_poly_email: (m.profiles as any)?.cal_poly_email,
                }))}
              />
            )}
          </div>
          {pendingReview.length === 0 ? (
           <Card className="flex flex-col items-center py-12">
              <CheckCircle2 className="h-10 w-10 text-success/30 mb-3" />
              <p className="text-sm text-muted-foreground">No pending reviews.</p>
              <p className="text-[10px] text-muted-foreground/60 mt-1">Deliverables needing your approval will appear here.</p>
            </Card>
          ) : pendingReview.map(d => (
            <motion.div key={d.id} variants={item}>
              <Card className="hover:border-accent/30 transition-all">
                <CardContent className="p-4 flex items-start gap-4">
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm">{d.title}</p>
                      <Badge variant="outline" className="text-[9px] font-mono h-4">v{d.version}</Badge>
                      {d.engagement_type && <Badge variant="outline" className="text-[9px] capitalize h-4">{d.engagement_type}</Badge>}
                    </div>
                    <p className="text-[11px] text-muted-foreground font-mono">
                      {displayName((d.profiles as any) ?? null, "Unassigned")} · {(d.projects as any)?.name}
                      {d.due_date && <> · Due {new Date(d.due_date).toLocaleDateString()}</>}
                    </p>
                    {d.description && <p className="text-xs text-muted-foreground line-clamp-2">{d.description}</p>}
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    {d.file_url && (
                      <Button asChild size="sm" variant="ghost" className="h-7 gap-1 text-[10px]">
                        <a href={d.file_url} target="_blank" rel="noreferrer"><ExternalLink className="h-3 w-3" /> Open</a>
                      </Button>
                    )}
                    <Button size="sm" className="h-7 gap-1 text-[10px]" disabled={busy === d.id} onClick={() => approveDeliverable(d.id)}>
                      <CheckCircle2 className="h-3 w-3" /> Approve
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 gap-1 text-[10px]" disabled={busy === d.id} onClick={() => requestChanges(d.id)}>
                      <RefreshCw className="h-3 w-3" /> Request changes
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 gap-1 text-[10px] text-destructive hover:text-destructive" disabled={busy === d.id} onClick={() => rejectDelv(d.id)}>
                      <Ban className="h-3 w-3" /> Reject
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 gap-1 text-[10px]" onClick={() => setHistoryFor(d)}>
                      <History className="h-3 w-3" /> History
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </TabsContent>

        <TabsContent value="overdue" className="mt-4 space-y-2">
          {overdueDeliverables.length === 0 ? (
            <Card className="flex flex-col items-center py-12">
              <CheckCircle2 className="h-10 w-10 text-success/30 mb-3" />
              <p className="text-sm text-muted-foreground">Nothing overdue. 🎉</p>
            </Card>
          ) : overdueDeliverables.map(d => (
            <Card key={d.id}>
              <CardContent className="flex items-center gap-4 p-4">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                <div className="flex-1">
                  <p className="font-medium text-sm">{d.title}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">
                    {(d.profiles as any)?.full_name} · Due {new Date(d.due_date).toLocaleDateString()}
                  </p>
                </div>
                <Badge variant="destructive" className="text-[9px] font-mono">Overdue</Badge>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="help" className="mt-4 space-y-2">
          {helpRequests.length === 0 ? (
            <Card className="flex flex-col items-center py-12">
              <HelpCircle className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">No open help requests.</p>
              <p className="text-[10px] text-muted-foreground/60 mt-1">When members need help, their requests will appear here for you to resolve.</p>
            </Card>
          ) : helpRequests.map(h => (
            <Card key={h.id}>
              <CardContent className="flex items-center gap-4 p-4">
                <HelpCircle className="h-4 w-4 text-warning shrink-0" />
                <div className="flex-1">
                  <p className="font-medium text-sm">{h.subject}</p>
                  <p className="text-[10px] text-muted-foreground">{(h.profiles as any)?.full_name} · {new Date(h.created_at).toLocaleDateString()}</p>
                  {h.body && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{h.body}</p>}
                </div>
                <Badge variant="outline" className="text-[9px] font-mono">{h.status}</Badge>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="team" className="mt-4 space-y-2">
          {members.map(m => (
            <Card key={m.id}>
              <CardContent className="flex items-center gap-3 p-3">
                <div className="h-8 w-8 rounded-full bg-accent/10 flex items-center justify-center text-xs font-bold text-accent-foreground">
                  {(m.profiles as any)?.full_name?.[0] || "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{(m.profiles as any)?.full_name}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">{(m.profiles as any)?.cal_poly_email}</p>
                </div>
                <Badge variant="outline" className="text-[9px] font-mono">{m.role}</Badge>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="announce" className="mt-4 space-y-4">
          <Card>
            <CardContent className="p-4 space-y-3">
              <input className="w-full text-sm font-medium bg-transparent border-b border-border pb-2 outline-none placeholder:text-muted-foreground" placeholder="Announcement title..." value={announceTitle} onChange={e => setAnnounceTitle(e.target.value)} />
              <Textarea placeholder="Write an announcement to your cohort..." rows={3} value={announceText} onChange={e => setAnnounceText(e.target.value)} />
              <Button size="sm" className="gap-2" onClick={postAnnouncement} disabled={!announceTitle.trim() || !announceText.trim()}>
                <Send className="h-3.5 w-3.5" />Post Announcement
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Reason drawer */}
      <Drawer open={!!reasonFor} onOpenChange={(v) => { if (!v) { setReasonFor(null); setReasonText(""); } }}>
        <DrawerContent className="max-w-lg mx-auto">
          <DrawerHeader>
            <DrawerTitle className="text-left flex items-center gap-2">
              {reasonFor?.mode === "reject" ? <Ban className="h-4 w-4 text-destructive" /> : <RefreshCw className="h-4 w-4" />}
              {reasonFor?.mode === "reject" ? "Reject deliverable" : "Request changes"}
            </DrawerTitle>
            <DrawerDescription className="text-left text-xs">
              The owner will see this. Be specific so they don't have to guess.
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-4 space-y-3">
            <Textarea autoFocus rows={5} value={reasonText} onChange={e => setReasonText(e.target.value)}
              placeholder={reasonFor?.mode === "reject" ? "Why is this being rejected? What would have to change for it to be re-considered?" : "What needs to change? Reference sections / steps if helpful."} />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setReasonFor(null); setReasonText(""); }} disabled={!!busy}>Cancel</Button>
              <Button className="flex-1" onClick={submitReason} disabled={!!busy || reasonText.trim().length < 3}>
                {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : (reasonFor?.mode === "reject" ? "Reject" : "Send request")}
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* History drawer */}
      <Drawer open={!!historyFor} onOpenChange={(v) => { if (!v) setHistoryFor(null); }}>
        <DrawerContent className="max-w-lg mx-auto">
          <DrawerHeader>
            <DrawerTitle className="text-left flex items-center gap-2"><History className="h-4 w-4" /> Review history</DrawerTitle>
            <DrawerDescription className="text-left text-xs">
              {historyFor?.title} · {(historyFor?.projects as any)?.name}
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-4">
            {historyFor && <DeliverableReviewHistory deliverableId={historyFor.id} />}
          </div>
        </DrawerContent>
      </Drawer>
    </motion.div>
  );
}

function SummaryCard({ icon: Icon, label, value, variant = "default" }: { icon: any; label: string; value: number; variant?: string }) {
  const bg = variant === "destructive" && value > 0 ? "bg-destructive/10" : variant === "warning" && value > 0 ? "bg-warning/10" : "bg-muted/50";
  const fg = variant === "destructive" && value > 0 ? "text-destructive" : variant === "warning" && value > 0 ? "text-warning" : "text-muted-foreground";
  return (
    <Card className="card-hover">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${bg}`}>
          <Icon className={`h-4 w-4 ${fg}`} />
        </div>
        <div>
          <p className="text-xl font-bold font-mono leading-none">{value}</p>
          <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider mt-0.5">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function DoctrinePromptRow({
  icon: Icon, tone, title, count, hint, items, onItemClick, showOverrideWarning,
}: {
  icon: any;
  tone: "muted" | "warning" | "primary";
  title: string;
  count: number;
  hint: string;
  items: any[];
  onItemClick: (d: any) => void;
  showOverrideWarning?: boolean;
}) {
  const toneClasses =
    tone === "warning" ? "border-warning/30 bg-warning/[0.04]" :
    tone === "primary" ? "border-primary/30 bg-primary/[0.04]" :
    "border-border bg-muted/30";
  const iconTone =
    tone === "warning" ? "text-warning" :
    tone === "primary" ? "text-primary" :
    "text-muted-foreground";
  return (
    <Card className={toneClasses}>
      <CardContent className="p-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Icon className={`h-3.5 w-3.5 ${iconTone}`} />
          <p className="text-xs font-medium">{title}</p>
          <Badge variant="outline" className="h-4 text-[10px]">{count}</Badge>
          <p className="text-[11px] text-muted-foreground hidden sm:block">· {hint}</p>
        </div>
        <div className="mt-2 grid gap-1">
          {items.map((d) => {
            const overrideRequired = showOverrideWarning && d.tech_validation_required && !d.tech_validated_at;
            return (
              <button key={d.id} onClick={() => onItemClick(d)}
                className="flex items-center justify-between gap-2 rounded-md border bg-card px-2.5 py-1.5 text-left text-xs hover:border-primary/40">
                <span className="truncate flex items-center gap-1.5 min-w-0">
                  <span className="truncate">{d.title}</span>
                  {d.canonical_stage && <span className="text-[10px] text-muted-foreground">· {stageLabel(d.canonical_stage)}</span>}
                  {overrideRequired && (
                    <Badge variant="outline" className="text-[9px] gap-1 border-warning/40 text-warning shrink-0">
                      <ShieldAlert className="h-2.5 w-2.5" /> Override needed
                    </Badge>
                  )}
                </span>
                <span className="text-[10px] text-muted-foreground shrink-0 truncate max-w-[35%]">
                  {(d.projects as any)?.name}
                </span>
              </button>
            );
          })}
          {count > items.length && (
            <p className="text-[10px] text-muted-foreground px-1">+{count - items.length} more</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
