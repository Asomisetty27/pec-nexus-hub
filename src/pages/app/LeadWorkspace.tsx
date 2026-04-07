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
  BookOpen, Send,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Textarea } from "@/components/ui/textarea";
import { logAuditAction } from "@/lib/audit";
import { SectionExplainer, InfoDot } from "@/components/ui/SectionExplainer";

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
  const [announceText, setAnnounceText] = useState("");
  const [announceTitle, setAnnounceTitle] = useState("");

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: cm } = await supabase.from("cohort_memberships").select("*, cohorts(*)").eq("user_id", user.id).limit(1).maybeSingle();
      setCohort(cm);
      if (!cm) return;
      const cohortId = cm.cohort_id;

      const memberIds = (await supabase.from("cohort_memberships").select("user_id").eq("cohort_id", cohortId)).data?.map((m: any) => m.user_id) || [];

      const [projRes, delRes, helpRes, memRes] = await Promise.all([
        supabase.from("mock_projects").select("*").eq("cohort_id", cohortId).order("created_at", { ascending: false }),
        supabase.from("deliverables").select("*, projects(name), profiles:owner_id(full_name)").in("owner_id", memberIds).order("due_date", { ascending: true }).limit(50),
        supabase.from("help_requests").select("*, profiles:requester_id(full_name)").eq("cohort_id", cohortId).eq("status", "open").order("created_at"),
        supabase.from("cohort_memberships").select("*, profiles:user_id(full_name, cal_poly_email)").eq("cohort_id", cohortId).order("role"),
      ]);
      setProjects(projRes.data || []);
      setDeliverables(delRes.data || []);
      setHelpRequests(helpRes.data || []);
      setMembers(memRes.data || []);

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
  const cohortName = (cohort?.cohorts as any)?.name || "Your Cohort";

  const approveDeliverable = async (id: string) => {
    await supabase.from("deliverables").update({ approval_status: "approved" as any, approved: true, approved_by: user!.id, approved_at: new Date().toISOString() }).eq("id", id);
    await logAuditAction("deliverable_approved", "deliverables", id);
    toast.success("Deliverable approved");
    setDeliverables(prev => prev.map(d => d.id === id ? { ...d, approval_status: "approved", approved: true } : d));
  };

  const requestChanges = async (id: string) => {
    await supabase.from("deliverables").update({ approval_status: "revision_requested" as any }).eq("id", id);
    toast.info("Revision requested");
    setDeliverables(prev => prev.map(d => d.id === id ? { ...d, approval_status: "changes_requested" } : d));
  };

  const postAnnouncement = async () => {
    if (!announceTitle.trim() || !announceText.trim()) return;
    await supabase.from("announcements").insert({ title: announceTitle, body: announceText, author_id: user!.id });
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
      </motion.div>

      {/* Summary cards */}
      <motion.div variants={item} className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <SummaryCard icon={AlertTriangle} label="Overdue" value={overdueDeliverables.length} variant={overdueDeliverables.length > 0 ? "destructive" : "default"} />
        <SummaryCard icon={Clock} label="Pending Review" value={pendingReview.length} />
        <SummaryCard icon={HelpCircle} label="Help Requests" value={helpRequests.length} variant={helpRequests.length > 0 ? "warning" : "default"} />
        <SummaryCard icon={Users} label="Members" value={members.length} />
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
          {pendingReview.length === 0 ? (
            <Card className="flex flex-col items-center py-12">
              <CheckCircle2 className="h-10 w-10 text-success/30 mb-3" />
              <p className="text-sm text-muted-foreground">No pending reviews.</p>
            </Card>
          ) : pendingReview.map(d => (
            <motion.div key={d.id} variants={item}>
              <Card className="hover:border-accent/30 transition-all">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{d.title}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">
                      {(d.profiles as any)?.full_name || "Unassigned"} · {(d.projects as any)?.name}
                    </p>
                    {d.due_date && <p className="text-[10px] font-mono text-muted-foreground mt-0.5">Due: {new Date(d.due_date).toLocaleDateString()}</p>}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="gap-1 h-7 text-[10px]" onClick={() => approveDeliverable(d.id)}>
                      <CheckCircle2 className="h-3 w-3" />Approve
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1 h-7 text-[10px]" onClick={() => requestChanges(d.id)}>
                      Request Changes
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
