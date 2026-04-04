import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Shield, Search, Users, CheckCircle2, XCircle, AlertTriangle,
  UserCheck, UserX, Eye,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const item = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.2 } } };

export default function PermissionInspector() {
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState("");
  const [profiles, setProfiles] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userRoles, setUserRoles] = useState<any[]>([]);
  const [userCohorts, setUserCohorts] = useState<any[]>([]);
  const [userProjects, setUserProjects] = useState<any[]>([]);
  const [userChannels, setUserChannels] = useState<any[]>([]);
  const [rosterConflicts, setRosterConflicts] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  useEffect(() => {
    if (!isAdmin) return;
    const load = async () => {
      const [profRes, conflictsRes] = await Promise.all([
        supabase.from("profiles").select("*").order("full_name"),
        supabase.from("cohort_roster").select("*").eq("identity_status", "conflict").order("full_name"),
      ]);
      setProfiles(profRes.data || []);
      setRosterConflicts((conflictsRes.data as any[]) || []);
    };
    load();
  }, [isAdmin]);

  const inspectUser = async (profile: any) => {
    setSelectedUser(profile);
    const [rolesRes, cohortsRes, projectsRes, channelsRes, logsRes] = await Promise.all([
      supabase.from("user_roles").select("*").eq("user_id", profile.user_id),
      supabase.from("cohort_memberships").select("*, cohorts(name)").eq("user_id", profile.user_id),
      supabase.from("project_memberships").select("*, projects(name)").eq("user_id", profile.user_id),
      supabase.from("channel_members").select("*, channels(name)").eq("user_id", profile.user_id),
      supabase.from("audit_logs").select("*").eq("user_id", profile.user_id).order("created_at", { ascending: false }).limit(20),
    ]);
    setUserRoles(rolesRes.data || []);
    setUserCohorts(cohortsRes.data || []);
    setUserProjects(projectsRes.data || []);
    setUserChannels(channelsRes.data || []);
    setAuditLogs(logsRes.data || []);
  };

  const resolveConflict = async (rosterId: string, action: "matched" | "rejected") => {
    await supabase.from("cohort_roster").update({ identity_status: action } as any).eq("id", rosterId);
    setRosterConflicts(prev => prev.filter(r => r.id !== rosterId));
    toast.success(`Identity ${action}`);
    // Log action
    await supabase.from("audit_logs").insert({
      action: `identity_${action}`,
      target_type: "cohort_roster",
      target_id: rosterId,
    });
  };

  const filteredProfiles = profiles.filter(p =>
    p.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    p.cal_poly_email?.toLowerCase().includes(search.toLowerCase())
  );

  if (!isAdmin) return (
    <div className="flex flex-col items-center py-20 text-muted-foreground">
      <Shield className="h-12 w-12 mb-3 opacity-30" />
      <p className="text-sm">Admin access required.</p>
    </div>
  );

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6 max-w-5xl">
      <motion.div variants={item}>
        <h1 className="font-display text-2xl font-bold">Permission Inspector</h1>
        <p className="text-xs text-muted-foreground font-mono">Inspect access · Resolve identity conflicts · Audit actions</p>
      </motion.div>

      <Tabs defaultValue={rosterConflicts.length > 0 ? "conflicts" : "inspector"}>
        <TabsList>
          <TabsTrigger value="inspector">Inspector</TabsTrigger>
          <TabsTrigger value="conflicts" className="gap-1.5">
            Identity Queue
            {rosterConflicts.length > 0 && <Badge className="h-4 min-w-4 p-0 flex items-center justify-center text-[9px]">{rosterConflicts.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inspector" className="mt-4 space-y-4">
          <div className="grid gap-4 lg:grid-cols-12">
            {/* User list */}
            <div className="lg:col-span-4 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search users..." className="pl-9 h-9 text-sm" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <div className="space-y-1 max-h-[500px] overflow-y-auto">
                {filteredProfiles.map(p => (
                  <motion.div key={p.id} variants={item}>
                    <button
                      className={`w-full text-left flex items-center gap-3 p-2.5 rounded-lg transition-colors ${selectedUser?.id === p.id ? "bg-accent/10 border border-accent/30" : "hover:bg-muted/40"}`}
                      onClick={() => inspectUser(p)}
                    >
                      <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold shrink-0">
                        {p.full_name?.charAt(0) || "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{p.full_name || "—"}</p>
                        <p className="text-[10px] text-muted-foreground font-mono truncate">{p.cal_poly_email}</p>
                      </div>
                    </button>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Inspection panel */}
            <div className="lg:col-span-8 space-y-3">
              {!selectedUser ? (
                <Card className="flex flex-col items-center py-16">
                  <Eye className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">Select a user to inspect permissions</p>
                </Card>
              ) : (
                <>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-bold">
                          {selectedUser.full_name?.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium">{selectedUser.full_name}</p>
                          <p className="text-xs text-muted-foreground">{selectedUser.cal_poly_email}</p>
                        </div>
                        <Badge variant="outline" className="ml-auto text-[9px] font-mono capitalize">{selectedUser.status}</Badge>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">Roles</p>
                          <div className="flex gap-1 flex-wrap">
                            {userRoles.map((r: any) => (
                              <Badge key={r.id} variant="outline" className="text-[9px] font-mono">{r.role}</Badge>
                            ))}
                            {userRoles.length === 0 && <span className="text-[10px] text-muted-foreground">No roles</span>}
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">Cohorts</p>
                          <div className="flex gap-1 flex-wrap">
                            {userCohorts.map((c: any) => (
                              <Badge key={c.id} className="text-[9px] font-mono gap-1">
                                {(c.cohorts as any)?.name} <span className="opacity-60">({c.role})</span>
                              </Badge>
                            ))}
                            {userCohorts.length === 0 && <span className="text-[10px] text-muted-foreground">No cohorts</span>}
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">Projects</p>
                          <div className="flex gap-1 flex-wrap">
                            {userProjects.map((p: any) => (
                              <Badge key={p.id} variant="secondary" className="text-[9px] font-mono">{(p.projects as any)?.name} ({p.role_on_project})</Badge>
                            ))}
                            {userProjects.length === 0 && <span className="text-[10px] text-muted-foreground">No projects</span>}
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">Channels ({userChannels.length})</p>
                          <div className="flex gap-1 flex-wrap">
                            {userChannels.slice(0, 10).map((c: any) => (
                              <Badge key={c.id} variant="outline" className="text-[9px] font-mono">#{(c.channels as any)?.name}</Badge>
                            ))}
                            {userChannels.length > 10 && <span className="text-[10px] text-muted-foreground">+{userChannels.length - 10} more</span>}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {auditLogs.length > 0 && (
                    <Card>
                      <CardHeader className="py-3 px-4">
                        <CardTitle className="text-sm font-sans">Recent Actions</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0 px-4 pb-3 space-y-1">
                        {auditLogs.map(log => (
                          <div key={log.id} className="flex items-center gap-2 py-1.5 text-[11px]">
                            <span className="font-medium">{log.action}</span>
                            <span className="text-muted-foreground">on {log.target_type}</span>
                            <span className="ml-auto text-[9px] font-mono text-muted-foreground">{new Date(log.created_at).toLocaleString()}</span>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="conflicts" className="mt-4 space-y-3">
          {rosterConflicts.length === 0 ? (
            <Card className="flex flex-col items-center py-12">
              <UserCheck className="h-10 w-10 text-success/30 mb-3" />
              <p className="text-sm text-muted-foreground">No identity conflicts to resolve.</p>
            </Card>
          ) : rosterConflicts.map((r: any) => (
            <motion.div key={r.id} variants={item}>
              <Card className="border-warning/30">
                <CardContent className="flex items-center gap-4 p-4">
                  <AlertTriangle className="h-5 w-5 text-warning shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">{r.full_name}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">{r.email || "No email"} · {r.cohort_name} · {r.role}</p>
                    <p className="text-[10px] text-warning mt-0.5">Name matched but email did not match signup</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="gap-1 text-[10px] h-7" onClick={() => resolveConflict(r.id, "matched")}>
                      <UserCheck className="h-3 w-3" />Match
                    </Button>
                    <Button size="sm" variant="ghost" className="gap-1 text-[10px] h-7 text-destructive" onClick={() => resolveConflict(r.id, "rejected")}>
                      <UserX className="h-3 w-3" />Reject
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
