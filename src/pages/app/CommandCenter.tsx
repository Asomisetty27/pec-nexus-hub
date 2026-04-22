import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Shield, Users, AlertTriangle, Clock, CheckCircle2, FolderKanban,
  HelpCircle, Mail, ChevronRight, Activity, Eye, Compass, Trophy,
  Briefcase, Rocket, Target, Cpu, Wrench, Code, Building2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { logAuditAction } from "@/lib/audit";
import { SectionExplainer } from "@/components/ui/SectionExplainer";
import { MomentumRiskPanel } from "@/components/momentum/MomentumRiskPanel";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const item = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.2 } } };
const cohortIcons: Record<string, any> = { cpu: Cpu, wrench: Wrench, code: Code, briefcase: Briefcase };

const PHASE_SHORT: Record<string, string> = {
  thesis: "Thesis", research: "Research", development: "Dev",
  validation: "Validation", knowledge_transfer: "KT", roadmap_update: "Roadmap",
};

export default function CommandCenter() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [cohorts, setCohorts] = useState<any[]>([]);
  const [cohortData, setCohortData] = useState<Record<string, any>>({});
  const [overdue, setOverdue] = useState<any[]>([]);
  const [pendingInvites, setPendingInvites] = useState<any[]>([]);
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [openHelp, setOpenHelp] = useState<any[]>([]);
  const [recentAudit, setRecentAudit] = useState<any[]>([]);
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [globalStats, setGlobalStats] = useState({ members: 0, projects: 0, blockedStages: 0, pendingReviews: 0 });
  const [opsTasks, setOpsTasks] = useState<any[]>([]);
  const [opsLeads, setOpsLeads] = useState<any[]>([]);
  const [opsSponsors, setOpsSponsors] = useState<any[]>([]);

  useEffect(() => {
    if (!isAdmin) return;
    const load = async () => {
      const [cohortRes, delRes, invRes, conflRes, helpRes, auditRes, profRes, projRes, stageRes, revDelRes, oppRes] = await Promise.all([
        supabase.from("cohorts").select("*").order("name"),
        supabase.from("deliverables").select("*, projects(name), profiles:owner_id(full_name)").lt("due_date", new Date().toISOString()).neq("approval_status", "approved").order("due_date").limit(20),
        supabase.from("invite_tokens").select("*").is("used_at", null).gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }),
        supabase.from("cohort_roster").select("*").eq("identity_status", "conflict"),
        supabase.from("help_requests").select("*, profiles:requester_id(full_name)").eq("status", "open").order("created_at").limit(20),
        supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(20),
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("projects").select("*", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("project_stages").select("*", { count: "exact", head: true }).eq("status", "blocked"),
        supabase.from("deliverables").select("*", { count: "exact", head: true }).eq("approval_status", "pending").eq("approval_required", true),
        supabase.from("opportunities").select("*, cohorts:recommended_cohort_id(name)").in("status", ["intake", "evaluating", "approved", "active"]).order("strategic_value", { ascending: false }),
      ]);
      setCohorts(cohortRes.data || []);
      setOverdue(delRes.data || []);
      setPendingInvites(invRes.data || []);
      setConflicts((conflRes.data as any[]) || []);
      setOpenHelp(helpRes.data || []);
      setRecentAudit(auditRes.data || []);
      setOpportunities(oppRes.data || []);
      setGlobalStats({
        members: profRes.count || 0,
        projects: projRes.count || 0,
        blockedStages: stageRes.count || 0,
        pendingReviews: revDelRes.count || 0,
      });

      // Operations consolidated from former Ops Dashboard
      const [opsTaskRes, opsLeadRes, opsSpRes] = await Promise.all([
        supabase.from("ops_tasks").select("*, profiles:assignee_id(full_name)").order("created_at", { ascending: false }).limit(30),
        supabase.from("leads").select("*, organizations(name)").order("updated_at", { ascending: false }).limit(15),
        supabase.from("sponsorship_packages").select("*, organizations(name)").order("created_at", { ascending: false }).limit(15),
      ]);
      setOpsTasks((opsTaskRes.data as any[]) || []);
      setOpsLeads(opsLeadRes.data || []);
      setOpsSponsors(opsSpRes.data || []);

      // Per-cohort enrichment
      for (const c of cohortRes.data || []) {
        const [memRes, mpRes, ptRes, capRes, oppRes2] = await Promise.all([
          supabase.from("cohort_memberships").select("*, profiles:user_id(full_name)").eq("cohort_id", c.id),
          supabase.from("mock_projects").select("*").eq("cohort_id", c.id).eq("status", "active").limit(1).maybeSingle(),
          supabase.from("purpose_tracks").select("*").eq("cohort_id", c.id).eq("status", "active").limit(1).maybeSingle(),
          supabase.from("capacity_allocations").select("*").eq("cohort_id", c.id).order("effective_date", { ascending: false }).limit(1).maybeSingle(),
          supabase.from("opportunities").select("*").eq("assigned_cohort_id", c.id).in("status", ["approved", "active"]),
        ]);
        const mems = memRes.data || [];
        setCohortData(prev => ({
          ...prev, [c.id]: {
            members: mems,
            pm: mems.find((m: any) => m.role === "pm"),
            lead: mems.find((m: any) => m.role === "lead"),
            project: mpRes.data,
            purpose: ptRes.data,
            capacity: capRes.data,
            engagements: oppRes2.data || [],
          }
        }));
      }
    };
    load();
  }, [isAdmin]);

  const resolveConflict = async (id: string, action: "matched" | "rejected") => {
    const { error } = await supabase.from("cohort_roster").update({ identity_status: action } as any).eq("id", id);
    if (error) { toast.error(`Failed: ${error.message}`); return; }
    await logAuditAction(`identity_${action}`, "cohort_roster", id);
    setConflicts(prev => prev.filter(c => c.id !== id));
    toast.success(`Identity ${action}`);
  };

  if (!isAdmin) return (
    <div className="flex flex-col items-center py-20 text-muted-foreground">
      <Shield className="h-12 w-12 mb-3 opacity-30" />
      <p className="text-sm">Presidential / Admin access required.</p>
    </div>
  );

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6 max-w-6xl">
      <motion.div variants={item}>
        <h1 className="font-display text-2xl font-bold">Command Center</h1>
        <SectionExplainer text="Presidential strategy view — monitor cohort modes, allocations, opportunities, and club health." />
      </motion.div>

      {/* Global health */}
      <motion.div variants={item} className="grid gap-3 grid-cols-2 sm:grid-cols-5">
        <HealthCard icon={Users} label="Members" value={globalStats.members} />
        <HealthCard icon={FolderKanban} label="Projects" value={globalStats.projects} />
        <HealthCard icon={AlertTriangle} label="Overdue" value={overdue.length} variant={overdue.length > 0 ? "destructive" : "default"} />
        <HealthCard icon={Clock} label="Pending Reviews" value={globalStats.pendingReviews} variant={globalStats.pendingReviews > 0 ? "warning" : "default"} />
        <HealthCard icon={Rocket} label="Opportunities" value={opportunities.length} />
      </motion.div>

      {/* Alerts strip */}
      {(conflicts.length > 0 || pendingInvites.length > 0) && (
        <motion.div variants={item} className="flex flex-wrap gap-2">
          {conflicts.length > 0 && (
            <Badge variant="destructive" className="gap-1 cursor-pointer" onClick={() => navigate("/app/permissions")}>
              <AlertTriangle className="h-3 w-3" />{conflicts.length} identity conflicts
            </Badge>
          )}
          {pendingInvites.length > 0 && (
            <Badge variant="outline" className="gap-1 cursor-pointer" onClick={() => navigate("/app/invites")}>
              <Mail className="h-3 w-3" />{pendingInvites.length} pending invites
            </Badge>
          )}
        </motion.div>
      )}

      {/* Momentum Risk across the club */}
      <motion.div variants={item}>
        <MomentumRiskPanel mode="leadership" limit={10} title="Momentum Risk · Club-wide" />
      </motion.div>

      <Tabs defaultValue="strategy">
        <TabsList>
          <TabsTrigger value="strategy" className="gap-1.5"><Target className="h-3 w-3" />Strategic Allocation</TabsTrigger>
          <TabsTrigger value="opportunities" className="gap-1.5"><Rocket className="h-3 w-3" />Opportunities ({opportunities.length})</TabsTrigger>
          <TabsTrigger value="overdue" className="gap-1.5"><AlertTriangle className="h-3 w-3" />Overdue ({overdue.length})</TabsTrigger>
          <TabsTrigger value="help" className="gap-1.5"><HelpCircle className="h-3 w-3" />Help ({openHelp.length})</TabsTrigger>
          <TabsTrigger value="ops" className="gap-1.5"><Briefcase className="h-3 w-3" />Operations</TabsTrigger>
          <TabsTrigger value="audit"><Activity className="h-3 w-3" /> Activity</TabsTrigger>
        </TabsList>

        {/* Strategic Allocation View */}
        <TabsContent value="strategy" className="mt-4 space-y-4">
          {cohorts.map(c => {
            const data = cohortData[c.id];
            const CIcon = cohortIcons[c.icon] || Cpu;
            const modes: string[] = [];
            if (data?.purpose) modes.push("Purpose");
            const comps = (data?.engagements || []).filter((e: any) => e.type === "competition");
            const contracts = (data?.engagements || []).filter((e: any) => e.type === "contract");
            if (comps.length > 0) modes.push("Competition");
            if (contracts.length > 0) modes.push("Contract");
            const modeLabel = modes.length === 0 ? "Idle" : modes.join(" + ");

            return (
              <motion.div key={c.id} variants={item}>
                <Card className="hover:border-accent/30 transition-all">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="h-11 w-11 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                        <CIcon className="h-5 w-5 text-accent-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <h3 className="font-semibold text-sm">{c.name}</h3>
                          <Badge className="text-[9px] font-mono bg-accent/10 text-accent-foreground border-accent/30">{modeLabel}</Badge>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-[11px]">
                          <div>
                            <p className="text-muted-foreground font-mono text-[9px] uppercase tracking-wider">Purpose Track</p>
                            <p className="font-medium truncate">{data?.purpose?.title || "—"}</p>
                            {data?.purpose && <p className="text-[9px] text-muted-foreground">{PHASE_SHORT[data.purpose.current_phase]}</p>}
                          </div>
                          <div>
                            <p className="text-muted-foreground font-mono text-[9px] uppercase tracking-wider">PM</p>
                            <p className="font-medium">{(data?.pm?.profiles as any)?.full_name || "—"}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground font-mono text-[9px] uppercase tracking-wider">Tech Lead</p>
                            <p className="font-medium">{(data?.lead?.profiles as any)?.full_name || "—"}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground font-mono text-[9px] uppercase tracking-wider">Members</p>
                            <p className="font-medium">{data?.members?.length || 0}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground font-mono text-[9px] uppercase tracking-wider">Capacity</p>
                            {data?.capacity ? (
                              <div className="flex gap-1">
                                <span className="font-mono text-[10px]">P:{data.capacity.purpose_pct}%</span>
                                <span className="font-mono text-[10px]">C:{data.capacity.competition_pct}%</span>
                                <span className="font-mono text-[10px]">K:{data.capacity.contract_pct}%</span>
                              </div>
                            ) : <p className="font-mono text-[10px]">100% Purpose</p>}
                          </div>
                        </div>
                        {(comps.length > 0 || contracts.length > 0) && (
                          <div className="flex gap-2 mt-2 flex-wrap">
                            {comps.map((e: any) => <Badge key={e.id} variant="outline" className="text-[9px] font-mono gap-1"><Trophy className="h-2.5 w-2.5" />{e.title}</Badge>)}
                            {contracts.map((e: any) => <Badge key={e.id} variant="outline" className="text-[9px] font-mono gap-1"><Briefcase className="h-2.5 w-2.5" />{e.title}</Badge>)}
                          </div>
                        )}
                      </div>
                      <Button variant="ghost" size="sm" className="text-[10px] font-mono h-7 shrink-0" onClick={() => navigate("/app/cohort")}>
                        View <ChevronRight className="ml-1 h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </TabsContent>

        {/* Opportunities */}
        <TabsContent value="opportunities" className="mt-4 space-y-3">
          {opportunities.length === 0 ? (
            <Card className="flex flex-col items-center py-12">
              <Rocket className="h-10 w-10 text-muted-foreground/20 mb-3" />
              <p className="text-sm text-muted-foreground">No open opportunities.</p>
            </Card>
          ) : opportunities.map(opp => (
            <Card key={opp.id} className="hover:border-accent/30 transition-all">
              <CardContent className="flex items-center gap-4 p-4">
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${opp.type === "competition" ? "bg-warning/10" : "bg-primary/10"}`}>
                  {opp.type === "competition" ? <Trophy className="h-4 w-4 text-warning" /> : <Briefcase className="h-4 w-4 text-primary" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm">{opp.title}</p>
                    <Badge variant="outline" className="text-[9px] font-mono">{opp.status}</Badge>
                  </div>
                  <div className="flex gap-3 text-[10px] text-muted-foreground mt-0.5">
                    <span>Value: {opp.strategic_value}/10</span>
                    <span>Effort: {opp.effort_estimate}</span>
                    {(opp.cohorts as any)?.name && <span>→ {(opp.cohorts as any).name}</span>}
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="text-[10px] h-7" onClick={() => navigate("/app/opportunities")}>
                  Review <ChevronRight className="ml-1 h-3 w-3" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Overdue */}
        <TabsContent value="overdue" className="mt-4 space-y-2">
          {overdue.length === 0 ? (
            <Card className="flex flex-col items-center py-12">
              <CheckCircle2 className="h-10 w-10 text-success/30 mb-3" />
              <p className="text-sm text-muted-foreground">Nothing overdue.</p>
            </Card>
          ) : overdue.map(d => (
            <Card key={d.id}>
              <CardContent className="flex items-center gap-4 p-4">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                <div className="flex-1">
                  <p className="font-medium text-sm">{d.title}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">
                    {(d.profiles as any)?.full_name || "Unassigned"} · {(d.projects as any)?.name} · Due {new Date(d.due_date).toLocaleDateString()}
                  </p>
                </div>
                <Badge variant="destructive" className="text-[9px] font-mono">{d.approval_status}</Badge>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Help */}
        <TabsContent value="help" className="mt-4 space-y-2">
          {openHelp.length === 0 ? (
            <Card className="flex flex-col items-center py-12">
              <HelpCircle className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">No open help requests.</p>
            </Card>
          ) : openHelp.map(h => (
            <Card key={h.id}>
              <CardContent className="flex items-center gap-4 p-4">
                <HelpCircle className="h-4 w-4 text-warning shrink-0" />
                <div className="flex-1">
                  <p className="font-medium text-sm">{h.subject}</p>
                  <p className="text-[10px] text-muted-foreground">{(h.profiles as any)?.full_name} · {new Date(h.created_at).toLocaleDateString()}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Operations (consolidated from Ops Dashboard) */}
        <TabsContent value="ops" className="mt-4 space-y-4">
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
            <HealthCard icon={Target} label="Active tasks" value={opsTasks.filter(t => t.status !== "done").length} />
            <HealthCard icon={AlertTriangle} label="Blocked" value={opsTasks.filter(t => t.status === "blocked").length} variant={opsTasks.some(t => t.status === "blocked") ? "destructive" : "default"} />
            <HealthCard icon={Mail} label="Open leads" value={opsLeads.length} />
            <HealthCard icon={Building2} label="Sponsors tracked" value={opsSponsors.length} />
          </div>

          <div>
            <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">Recent ops tasks</p>
            <div className="space-y-1.5">
              {opsTasks.length === 0 ? (
                <Card><CardContent className="py-8 text-center text-xs text-muted-foreground">No ops tasks yet.</CardContent></Card>
              ) : opsTasks.slice(0, 8).map(t => (
                <Card key={t.id}>
                  <CardContent className="flex items-center gap-3 p-3">
                    <div className={`h-2 w-2 rounded-full ${t.status === "done" ? "bg-success" : t.status === "blocked" ? "bg-destructive" : t.status === "in_progress" ? "bg-warning" : "bg-muted-foreground/40"}`} />
                    <p className={`flex-1 min-w-0 truncate text-sm ${t.status === "done" ? "line-through text-muted-foreground" : ""}`}>{t.title}</p>
                    <Badge variant="outline" className="text-[9px] font-mono capitalize">{t.category}</Badge>
                    {t.due_date && (
                      <span className={`text-[10px] font-mono ${new Date(t.due_date) < new Date() && t.status !== "done" ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                        {new Date(t.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">Active leads</p>
              {opsLeads.length === 0 ? (
                <Card><CardContent className="py-6 text-center text-xs text-muted-foreground">No leads tracked.</CardContent></Card>
              ) : (
                <div className="space-y-1.5">
                  {opsLeads.slice(0, 5).map(l => (
                    <Card key={l.id} className="cursor-pointer hover:border-accent/30" onClick={() => navigate("/app/crm")}>
                      <CardContent className="flex items-center gap-3 p-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{l.contact_name}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{(l.organizations as any)?.name || l.contact_email || "—"}</p>
                        </div>
                        <Badge variant="outline" className="text-[9px] font-mono capitalize">{l.stage}</Badge>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">Sponsorship pipeline</p>
              {opsSponsors.length === 0 ? (
                <Card><CardContent className="py-6 text-center text-xs text-muted-foreground">No sponsorship packages.</CardContent></Card>
              ) : (
                <div className="space-y-1.5">
                  {opsSponsors.slice(0, 5).map(s => (
                    <Card key={s.id}>
                      <CardContent className="flex items-center gap-3 p-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{s.name}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{(s.organizations as any)?.name} · {s.tier}</p>
                        </div>
                        {s.amount && <span className="text-sm font-mono font-bold">${Number(s.amount).toLocaleString()}</span>}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Audit */}
        <TabsContent value="audit" className="mt-4 space-y-2">
          {recentAudit.map(log => (
            <Card key={log.id}>
              <CardContent className="flex items-center gap-4 p-3 text-sm">
                <Activity className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1">
                  <span className="font-medium">{log.action}</span>
                  <span className="text-muted-foreground ml-2">on {log.target_type}</span>
                </div>
                <span className="text-[10px] text-muted-foreground font-mono">{new Date(log.created_at).toLocaleString()}</span>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      {/* Quick actions */}
      <motion.div variants={item}>
        <Card>
          <CardHeader className="py-3 px-5">
            <CardTitle className="text-sm font-sans font-semibold">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 px-5 pb-3 grid grid-cols-2 sm:grid-cols-5 gap-2">
            {[
              { label: "Opportunities", path: "/app/opportunities", icon: Rocket },
              { label: "Admin Console", path: "/app/admin", icon: Shield },
              { label: "Invites", path: "/app/invites", icon: Mail },
              { label: "Permissions", path: "/app/permissions", icon: Eye },
              { label: "Members", path: "/app/members", icon: Users },
            ].map(a => (
              <Button key={a.path} variant="outline" className="h-auto flex-col py-3 text-[10px] gap-1.5 card-hover" onClick={() => navigate(a.path)}>
                <a.icon className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{a.label}</span>
              </Button>
            ))}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

function HealthCard({ icon: Icon, label, value, variant = "default" }: { icon: any; label: string; value: number; variant?: string }) {
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
