import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import {
  CheckCircle2, AlertTriangle, Shield, Search, ExternalLink, RefreshCw, Ban, Loader2, History, Filter,
} from "lucide-react";
import { toast } from "sonner";
import DeliverableStatusBadge from "@/components/DeliverableStatusBadge";
import DeliverableReviewHistory from "@/components/DeliverableReviewHistory";
import { getUnifiedStatus, isBlockingStage } from "@/lib/deliverableStatus";
import { approveDeliverable, requestDeliverableChanges, rejectDeliverable } from "@/lib/reviewActions";
import { FeedbackPrompt } from "@/components/FeedbackPrompt";

interface Row {
  id: string;
  title: string;
  description: string | null;
  project_id: string;
  milestone_id: string | null;
  owner_id: string | null;
  due_date: string | null;
  version: number;
  file_url: string | null;
  approval_status: string;
  approval_required: boolean;
  required: boolean;
  engagement_type: string | null;
  updated_at: string;
  project_name?: string;
  stage_name?: string;
  owner_name?: string;
}

export default function ReviewQueue() {
  const { id: focusedId } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [engagementFilter, setEngagementFilter] = useState<string>("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [reasonFor, setReasonFor] = useState<{ id: string; mode: "request_changes" | "reject" } | null>(null);
  const [reasonText, setReasonText] = useState("");
  const [historyFor, setHistoryFor] = useState<Row | null>(null);
  const [reviewedOnce, setReviewedOnce] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);

    // Find projects where I'm a lead (or all if admin).
    const { data: leadMemberships } = await supabase
      .from("project_memberships")
      .select("project_id")
      .eq("user_id", user.id)
      .eq("role_on_project", "lead");
    const leadProjectIds = (leadMemberships || []).map((m: any) => m.project_id);

    let q = supabase
      .from("deliverables")
      .select("*")
      .not("file_url", "is", null)
      .in("approval_status", ["pending"])
      .eq("approval_required", true)
      .order("due_date", { ascending: true, nullsFirst: false });

    if (!isAdmin) {
      if (leadProjectIds.length === 0) {
        setRows([]); setLoading(false); return;
      }
      q = q.in("project_id", leadProjectIds);
    }

    const { data: dels, error } = await q;
    if (error) { toast.error(`Failed to load queue: ${error.message}`); setLoading(false); return; }

    const projIds = Array.from(new Set((dels || []).map((d: any) => d.project_id)));
    const milestoneIds = Array.from(new Set((dels || []).map((d: any) => d.milestone_id).filter(Boolean)));
    const ownerIds = Array.from(new Set((dels || []).map((d: any) => d.owner_id).filter(Boolean)));

    const [{ data: projs }, { data: ms }, { data: profs }] = await Promise.all([
      projIds.length ? supabase.from("projects").select("id, name").in("id", projIds) : Promise.resolve({ data: [] as any[] }),
      milestoneIds.length ? supabase.from("milestones").select("id, title").in("id", milestoneIds) : Promise.resolve({ data: [] as any[] }),
      ownerIds.length ? supabase.from("profiles").select("user_id, full_name").in("user_id", ownerIds) : Promise.resolve({ data: [] as any[] }),
    ]);

    const projMap = Object.fromEntries((projs || []).map((p: any) => [p.id, p.name]));
    const msMap = Object.fromEntries((ms || []).map((m: any) => [m.id, m.title]));
    const profMap = Object.fromEntries((profs || []).map((p: any) => [p.user_id, p.full_name]));

    setRows((dels || []).map((d: any) => ({
      ...d,
      project_name: projMap[d.project_id] || "Project",
      stage_name: d.milestone_id ? msMap[d.milestone_id] : undefined,
      owner_name: d.owner_id ? profMap[d.owner_id] : "Unassigned",
    })));
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user, isAdmin]);

  // Auto-open the focused deliverable in history drawer if route param given.
  useEffect(() => {
    if (focusedId && rows.length) {
      const r = rows.find(x => x.id === focusedId);
      if (r) setHistoryFor(r);
    }
  }, [focusedId, rows]);

  const projectOptions = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach(r => map.set(r.project_id, r.project_name || "Project"));
    return Array.from(map.entries());
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (projectFilter !== "all" && r.project_id !== projectFilter) return false;
      if (engagementFilter !== "all" && (r.engagement_type || "purpose") !== engagementFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!r.title.toLowerCase().includes(q)
          && !(r.project_name || "").toLowerCase().includes(q)
          && !(r.owner_name || "").toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [rows, projectFilter, engagementFilter, search]);

  const approve = async (r: Row) => {
    setBusy(r.id);
    const res = await approveDeliverable(r.id);
    setBusy(null);
    if (res.ok === false) { toast.error(`Approve failed: ${res.error}`); return; }
    toast.success(`Approved · ${r.title}`);
    setRows(prev => prev.filter(x => x.id !== r.id));
    setReviewedOnce(true);
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
    setRows(prev => prev.filter(x => x.id !== reasonFor.id));
    setReasonFor(null); setReasonText("");
    setReviewedOnce(true);
  };

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" /> Review Queue
          </h1>
          <p className="text-xs text-muted-foreground font-mono mt-1">
            Deliverables awaiting your decision. {filtered.length} item{filtered.length === 1 ? "" : "s"}.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} className="gap-1">
          <RefreshCw className="h-3 w-3" /> Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="h-3 w-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search title, project, owner…" className="h-8 pl-7 text-xs" />
          </div>
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="h-8 w-[180px] text-xs"><Filter className="h-3 w-3 mr-1" /><SelectValue placeholder="Project" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All projects</SelectItem>
              {projectOptions.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={engagementFilter} onValueChange={setEngagementFilter}>
            <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue placeholder="Engagement" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All engagements</SelectItem>
              <SelectItem value="purpose">Purpose</SelectItem>
              <SelectItem value="competition">Competition</SelectItem>
              <SelectItem value="contract">Contract</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {reviewedOnce && (
        <FeedbackPrompt
          feature="deliverable_review"
          prompt="Did reviewing feel clear?"
          options={[
            { label: "Clear", rating: "positive" },
            { label: "Okay", rating: "neutral" },
            { label: "Needs improvement", rating: "negative" },
          ]}
          onClose={() => setReviewedOnce(false)}
        />
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center py-12 gap-2">
          <CheckCircle2 className="h-10 w-10 text-success/40" />
          <p className="text-sm text-muted-foreground">Nothing waiting on your review. Nice work.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(r => {
            const overdue = !!r.due_date && new Date(r.due_date) < new Date();
            const blocking = isBlockingStage(r);
            return (
              <Card key={r.id} className={overdue ? "border-destructive/30" : ""}>
                <CardContent className="p-4 flex items-start gap-4">
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm">{r.title}</p>
                      <Badge variant="outline" className="text-[9px] font-mono h-4">v{r.version}</Badge>
                      {r.engagement_type && <Badge variant="outline" className="text-[9px] capitalize h-4">{r.engagement_type}</Badge>}
                    </div>
                    <p className="text-[11px] text-muted-foreground font-mono">
                      {r.project_name}{r.stage_name ? ` · ${r.stage_name}` : ""} · Owner: {r.owner_name}
                      {r.due_date && <> · Due {new Date(r.due_date).toLocaleDateString()}</>}
                    </p>
                    <DeliverableStatusBadge
                      status={r.approval_status}
                      fileUrl={r.file_url}
                      dueDate={r.due_date}
                      approvalRequired={r.approval_required}
                      blockingStage={blocking}
                    />
                    {r.description && <p className="text-xs text-muted-foreground line-clamp-2">{r.description}</p>}
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    {r.file_url && (
                      <Button asChild size="sm" variant="ghost" className="h-7 gap-1 text-[10px]">
                        <a href={r.file_url} target="_blank" rel="noreferrer"><ExternalLink className="h-3 w-3" /> Open</a>
                      </Button>
                    )}
                    <Button size="sm" className="h-7 gap-1 text-[10px]" disabled={busy === r.id} onClick={() => approve(r)}>
                      <CheckCircle2 className="h-3 w-3" /> Approve
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 gap-1 text-[10px]" disabled={busy === r.id} onClick={() => { setReasonFor({ id: r.id, mode: "request_changes" }); setReasonText(""); }}>
                      <RefreshCw className="h-3 w-3" /> Request changes
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 gap-1 text-[10px] text-destructive hover:text-destructive" disabled={busy === r.id} onClick={() => { setReasonFor({ id: r.id, mode: "reject" }); setReasonText(""); }}>
                      <Ban className="h-3 w-3" /> Reject
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 gap-1 text-[10px]" onClick={() => setHistoryFor(r)}>
                      <History className="h-3 w-3" /> History
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

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
            <Textarea autoFocus rows={5} value={reasonText} onChange={e => setReasonText(e.target.value)} placeholder={reasonFor?.mode === "reject" ? "Why is this being rejected? What would have to change for it to be re-considered?" : "What needs to change? Reference sections / steps if helpful."} />
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
              {historyFor?.title} · {historyFor?.project_name}{historyFor?.stage_name ? ` · ${historyFor.stage_name}` : ""}
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-4">
            {historyFor && <DeliverableReviewHistory deliverableId={historyFor.id} />}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
