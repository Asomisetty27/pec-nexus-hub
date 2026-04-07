import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Shield, Users, AlertTriangle, Clock, CheckCircle2, FolderKanban,
  HelpCircle, UserCheck, Mail, ChevronRight, Activity, Eye,
  MessageSquare, Send, Cpu,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { logAuditAction } from "@/lib/audit";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const item = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.2 } } };

export default function CommandCenter() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [cohorts, setCohorts] = useState<any[]>([]);
  const [cohortStats, setCohortStats] = useState<Record<string, any>>({});
  const [overdue, setOverdue] = useState<any[]>([]);
  const [pendingInvites, setPendingInvites] = useState<any[]>([]);
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [openHelp, setOpenHelp] = useState<any[]>([]);
  const [recentAudit, setRecentAudit] = useState<any[]>([]);
  const [globalStats, setGlobalStats] = useState({ members: 0, projects: 0, blockedStages: 0, pendingReviews: 0 });

  useEffect(() => {
    if (!isAdmin) return;
    const load = async () => {
      const [cohortRes, delRes, invRes, conflRes, helpRes, auditRes, profRes, projRes, stageRes, revDelRes] = await Promise.all([
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
      ]);
      setCohorts(cohortRes.data || []);
      setOverdue(delRes.data || []);
      setPendingInvites(invRes.data || []);
      setConflicts((conflRes.data as any[]) || []);
      setOpenHelp(helpRes.data || []);
      setRecentAudit(auditRes.data || []);
      setGlobalStats({
        members: profRes.count || 0,
        projects: projRes.count || 0,
        blockedStages: stageRes.count || 0,
        pendingReviews: revDelRes.count || 0,
      });

      // Build per-cohort stats
      for (const c of cohortRes.data || []) {
        const [memRes, mpRes] = await Promise.all([
          supabase.from("cohort_memberships").select("*, profiles:user_id(full_name)").eq("cohort_id", c.id),
          supabase.from("mock_projects").select("*").eq("cohort_id", c.id).eq("status", "active").limit(1).maybeSingle(),
        ]);
        const mems = memRes.data || [];
        const pm = mems.find((m: any) => m.role === "pm");
        const lead = mems.find((m: any) => m.role === "lead");
        setCohortStats(prev => ({ ...prev, [c.id]: { members: mems, pm, lead, project: mpRes.data } }));
      }
    };
    load();
  }, [isAdmin]);

  const resendInvite = async (invite: any) => {
    toast.info(`Invite for ${invite.email} is still valid until ${new Date(invite.expires_at).toLocaleDateString()}`);
  };

  const resolveConflict = async (id: string, action: "matched" | "rejected") => {
    await supabase.from("cohort_roster").update({ identity_status: action } as any).eq("id", id);
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
        <p className="text-xs text-muted-foreground font-mono">Presidential oversight · Club-wide health · Quick actions</p>
      </motion.div>

      {/* Global health */}
      <motion.div variants={item} className="grid gap-3 grid-cols-2 sm:grid-cols-5">
        <HealthCard icon={Users} label="Members" value={globalStats.members} />
        <HealthCard icon={FolderKanban} label="Active Projects" value={globalStats.projects} />
        <HealthCard icon={AlertTriangle} label="Overdue Items" value={overdue.length} variant={overdue.length > 0 ? "destructive" : "default"} />
        <HealthCard icon={Clock} label="Pending Reviews" value={globalStats.pendingReviews} variant={globalStats.pendingReviews > 0 ? "warning" : "default"} />
        <HealthCard icon={HelpCircle} label="Open Help" value={openHelp.length} variant={openHelp.length > 0 ? "warning" : "default"} />
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
            <Badge variant="outline" className="gap-1 cursor-pointer" onClick={() => navigate("/app/admin")}>
              <Mail className="h-3 w-3" />{pendingInvites.length} pending invites
            </Badge>
          )}
        </motion.div>
      )}

      <Tabs defaultValue="cohorts">
        <TabsList>
          <TabsTrigger value="cohorts" className="gap-1.5"><Cpu className="h-3 w-3" />Cohorts</TabsTrigger>
          <TabsTrigger value="overdue" className="gap-1.5">
            <AlertTriangle className="h-3 w-3" />Overdue ({overdue.length})
          </TabsTrigger>
          <TabsTrigger value="help" className="gap-1.5"><HelpCircle className="h-3 w-3" />Help ({openHelp.length})</TabsTrigger>
          <TabsTrigger value="invites" className="gap-1.5"><Mail className="h-3 w-3" />Invites ({pendingInvites.length})</TabsTrigger>
          <TabsTrigger value="audit"><Activity className="h-3 w-3" /> Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="cohorts" className="mt-4 space-y-4">
          {cohorts.map(c => {
            const stats = cohortStats[c.id];
            return (
              <motion.div key={c.id} variants={item}>
                <Card className="hover:border-accent/30 transition-all">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-sm">{c.name}</h3>
                        <p className="text-[10px] text-muted-foreground">{c.description}</p>
                      </div>
                      <Button variant="ghost" size="sm" className="text-[10px] font-mono h-7" onClick={() => navigate("/app/cohort")}>
                        View <ChevronRight className="ml-1 h-3 w-3" />
                      </Button>
                    </div>
                    {stats && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
                        <div>
                          <p className="text-muted-foreground font-mono text-[9px] uppercase tracking-wider">PM</p>
                          <p className="font-medium">{(stats.pm?.profiles as any)?.full_name || "Unassigned"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground font-mono text-[9px] uppercase tracking-wider">Tech Lead</p>
                          <p className="font-medium">{(stats.lead?.profiles as any)?.full_name || "Unassigned"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground font-mono text-[9px] uppercase tracking-wider">Members</p>
                          <p className="font-medium">{stats.members.length}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground font-mono text-[9px] uppercase tracking-wider">Project</p>
                          <p className="font-medium">{stats.project?.title || "None"}</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </TabsContent>

        <TabsContent value="overdue" className="mt-4 space-y-2">
          {overdue.length === 0 ? (
            <Card className="flex flex-col items-center py-12">
              <CheckCircle2 className="h-10 w-10 text-success/30 mb-3" />
              <p className="text-sm text-muted-foreground">Nothing overdue across the org.</p>
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

        <TabsContent value="invites" className="mt-4 space-y-2">
          {pendingInvites.length === 0 ? (
            <Card className="flex flex-col items-center py-12">
              <Mail className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">No pending invites.</p>
            </Card>
          ) : pendingInvites.map(inv => (
            <Card key={inv.id}>
              <CardContent className="flex items-center gap-4 p-4">
                <Mail className="h-4 w-4 text-accent-foreground shrink-0" />
                <div className="flex-1">
                  <p className="font-medium text-sm">{inv.email}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">Expires {new Date(inv.expires_at).toLocaleDateString()}</p>
                </div>
                <Button size="sm" variant="outline" className="text-[10px] h-7" onClick={() => resendInvite(inv)}>
                  <Send className="h-3 w-3 mr-1" />Check
                </Button>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

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
          <CardContent className="pt-0 px-5 pb-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: "Admin Console", path: "/app/admin", icon: Shield },
              { label: "Permissions", path: "/app/permissions", icon: Eye },
              { label: "CRM / Pipeline", path: "/app/crm", icon: FolderKanban },
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
