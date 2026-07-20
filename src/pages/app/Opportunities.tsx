import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Rocket, Trophy, Briefcase, Plus, Star, Clock, Users, ChevronRight,
  CheckCircle2, XCircle, ArrowRight, Zap, Target,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { SectionExplainer } from "@/components/ui/SectionExplainer";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.22 } } };

const STATUS_COLORS: Record<string, string> = {
  intake: "bg-muted text-muted-foreground",
  evaluating: "bg-warning/10 text-warning border-warning/30",
  approved: "bg-primary/10 text-primary border-primary/30",
  active: "bg-success/10 text-success border-success/30",
  declined: "bg-destructive/10 text-destructive",
  completed: "bg-muted text-muted-foreground",
  deferred: "bg-muted text-muted-foreground",
};

export default function Opportunities() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [cohorts, setCohorts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialog, setCreateDialog] = useState(false);
  const [membership, setMembership] = useState<any>(null);

  const isLeader = isAdmin || membership?.role === "pm" || membership?.role === "lead" || membership?.role === "integration_lead";

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [oppRes, cohortRes, cmRes] = await Promise.all([
        supabase.from("opportunities").select("*, cohorts:recommended_cohort_id(name), assigned:assigned_cohort_id(name)").order("created_at", { ascending: false }),
        supabase.from("cohorts").select("*").order("name"),
        supabase.from("cohort_memberships").select("*").eq("user_id", user.id).limit(1).maybeSingle(),
      ]);
      setOpportunities(oppRes.data || []);
      setCohorts(cohortRes.data || []);
      setMembership(cmRes.data);
      setLoading(false);
    };
    load();
  }, [user]);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const { error } = await supabase.from("opportunities").insert({
      type: f.get("type") as any,
      title: f.get("title") as string,
      summary: f.get("summary") as string,
      source: f.get("source") as string,
      deadline: (f.get("deadline") as string) || null,
      strategic_value: parseInt(f.get("strategic_value") as string) || 5,
      effort_estimate: f.get("effort") as string,
      recommended_cohort_id: (f.get("cohort") as string) || null,
      created_by: user!.id,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Opportunity submitted");
    setCreateDialog(false);
    const { data } = await supabase.from("opportunities").select("*, cohorts:recommended_cohort_id(name), assigned:assigned_cohort_id(name)").order("created_at", { ascending: false });
    setOpportunities(data || []);
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("opportunities").update({ status } as any).eq("id", id);
    if (error) { toast.error(`Update failed: ${error.message}`); return; }
    setOpportunities(prev => prev.map(o => o.id === id ? { ...o, status } : o));
    toast.success(`Status updated to ${status}`);
  };

  // Accept -> pod wire: turn an accepted opportunity into a real project (pod),
  // link it, and make the creator the lead so they staff it from the Team tab.
  // Admin-only because projects insert is admin-gated (proj_manage_admin).
  const startEngagement = async (opp: any) => {
    const { data: proj, error } = await supabase.from("projects").insert({
      name: opp.title,
      description: opp.description || "",
      status: "active",
      project_mode: "client_engagement",
      created_by: user!.id,
    } as any).select("id").single();
    if (error) { toast.error(`Could not start engagement: ${error.message}`); return; }
    await supabase.from("project_memberships").insert({ project_id: proj.id, user_id: user!.id, role_on_project: "lead" } as any);
    await supabase.from("opportunities").update({ engagement_project_id: proj.id, status: "active" } as any).eq("id", opp.id);
    toast.success("Engagement started — pod created");
    navigate(`/app/projects/${proj.id}`);
  };

  const pipeline = opportunities.filter(o => ["intake", "evaluating"].includes(o.status));
  const active = opportunities.filter(o => ["approved", "active"].includes(o.status));
  const archived = opportunities.filter(o => ["completed", "declined", "deferred"].includes(o.status));

  if (loading) return <div className="space-y-4">{[1,2].map(i => <Card key={i} className="h-32 animate-pulse bg-muted/30" />)}</div>;

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-5 max-w-5xl">
      <motion.div variants={item} className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2"><Rocket className="h-6 w-6 text-accent-foreground" />Opportunities</h1>
          <SectionExplainer text="Incoming competitions and contracts. Evaluate, assign to the right cohort, and activate." />
        </div>
        {isLeader && (
          <Dialog open={createDialog} onOpenChange={setCreateDialog}>
            <DialogTrigger asChild><Button size="sm" className="gap-2"><Plus className="h-3.5 w-3.5" />Propose Opportunity</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Submit Opportunity</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select name="type" defaultValue="competition">
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="competition">Competition</SelectItem>
                        <SelectItem value="contract">Contract</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Strategic Value (1-10)</Label>
                    <Input name="strategic_value" type="number" min="1" max="10" defaultValue="5" />
                  </div>
                </div>
                <div className="space-y-2"><Label>Title</Label><Input name="title" required placeholder="HackSC 2026" /></div>
                <div className="space-y-2"><Label>Summary</Label><Textarea name="summary" rows={2} placeholder="What is this opportunity about?" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Source</Label><Input name="source" placeholder="HackSC website" /></div>
                  <div className="space-y-2"><Label>Deadline</Label><Input name="deadline" type="date" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Effort Estimate</Label>
                    <Select name="effort" defaultValue="medium">
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="heavy">Heavy</SelectItem>
                        <SelectItem value="all_hands">All Hands</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Recommended Cohort</Label>
                    <Select name="cohort">
                      <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
                      <SelectContent>
                        {cohorts.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button type="submit" className="w-full">Submit Opportunity</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </motion.div>

      <Tabs defaultValue="pipeline">
        <TabsList>
          <TabsTrigger value="pipeline" className="gap-1.5"><Zap className="h-3 w-3" />Pipeline ({pipeline.length})</TabsTrigger>
          <TabsTrigger value="active" className="gap-1.5"><Target className="h-3 w-3" />Active ({active.length})</TabsTrigger>
          <TabsTrigger value="archived" className="gap-1.5"><CheckCircle2 className="h-3 w-3" />Archived ({archived.length})</TabsTrigger>
        </TabsList>

        {[
          { key: "pipeline", items: pipeline, emptyIcon: Rocket, emptyText: "No opportunities in the pipeline." },
          { key: "active", items: active, emptyIcon: Target, emptyText: "No active engagements." },
          { key: "archived", items: archived, emptyIcon: CheckCircle2, emptyText: "No archived opportunities." },
        ].map(tab => (
          <TabsContent key={tab.key} value={tab.key} className="mt-4 space-y-3">
            {tab.items.length === 0 ? (
              <Card className="flex flex-col items-center py-12">
                <tab.emptyIcon className="h-10 w-10 text-muted-foreground/20 mb-3" />
                <p className="text-sm text-muted-foreground">{tab.emptyText}</p>
              </Card>
            ) : tab.items.map(opp => (
              <motion.div key={opp.id} variants={item}>
                <Card className="hover:border-accent/30 transition-all">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${opp.type === "competition" ? "bg-warning/10" : "bg-primary/10"}`}>
                        {opp.type === "competition" ? <Trophy className="h-5 w-5 text-warning" /> : <Briefcase className="h-5 w-5 text-primary" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-semibold">{opp.title}</h3>
                          <Badge className={`text-[9px] font-mono ${STATUS_COLORS[opp.status] || ""}`}>{opp.status}</Badge>
                          <Badge variant="outline" className="text-[9px] font-mono capitalize">{opp.type}</Badge>
                        </div>
                        {opp.summary && <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{opp.summary}</p>}
                        <div className="flex items-center gap-4 mt-2 text-[10px] text-muted-foreground">
                          <span className="flex items-center gap-1"><Star className="h-3 w-3" />Value: {opp.strategic_value}/10</span>
                          <span className="flex items-center gap-1"><Users className="h-3 w-3" />Effort: {opp.effort_estimate}</span>
                          {opp.deadline && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(opp.deadline).toLocaleDateString()}</span>}
                          {(opp.cohorts as any)?.name && <span className="font-mono">→ {(opp.cohorts as any).name}</span>}
                        </div>
                      </div>
                      {isLeader && tab.key === "pipeline" && (
                        <div className="flex gap-1.5 shrink-0">
                          <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => updateStatus(opp.id, "approved")}>Approve</Button>
                          <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => updateStatus(opp.id, "declined")}>Decline</Button>
                        </div>
                      )}
                      {isLeader && opp.status === "approved" && (
                        <Button size="sm" variant="ghost" className="h-7 text-[10px] shrink-0" onClick={() => updateStatus(opp.id, "active")}>Activate</Button>
                      )}
                      {isAdmin && ["approved", "active"].includes(opp.status) && !opp.engagement_project_id && (
                        <Button size="sm" className="h-7 text-[10px] shrink-0" onClick={() => startEngagement(opp)}>Start engagement</Button>
                      )}
                      {opp.engagement_project_id && (
                        <Button size="sm" variant="outline" className="h-7 text-[10px] shrink-0" onClick={() => navigate(`/app/projects/${opp.engagement_project_id}`)}>Open pod</Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </TabsContent>
        ))}
      </Tabs>
    </motion.div>
  );
}
