import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  Shield, Users, ScrollText, Check, X, Search, ChevronRight,
  Mail, Send, Clock, UserPlus, AlertCircle, CheckCircle2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { logAuditAction } from "@/lib/audit";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const item = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.2 } } };

export default function Admin() {
  const { user, isAdmin } = useAuth();
  const [roleRequests, setRoleRequests] = useState<any[]>([]);
  const [allProfiles, setAllProfiles] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [roster, setRoster] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [sendingInvites, setSendingInvites] = useState(false);

  const fetchAll = async () => {
    const [rrRes, profRes, alRes, rosterRes] = await Promise.all([
      supabase.from("role_requests").select("*, profiles:user_id(full_name, cal_poly_email)").eq("status", "pending").order("created_at"),
      supabase.from("profiles").select("*, user_roles(role)").order("full_name"),
      supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("cohort_roster").select("*").order("cohort_name, role, full_name"),
    ]);
    setRoleRequests(rrRes.data || []);
    setAllProfiles(profRes.data || []);
    setAuditLogs(alRes.data || []);
    setRoster(rosterRes.data || []);
  };

  useEffect(() => { if (isAdmin) fetchAll(); }, [isAdmin]);

  const handleRoleRequest = async (id: string, status: "approved" | "rejected", userId: string, role: string) => {
    await supabase.from("role_requests").update({ status, reviewer_id: user!.id, reviewed_at: new Date().toISOString() }).eq("id", id);
    if (status === "approved") {
      await supabase.from("user_roles").insert([{ user_id: userId, role: role as any }]);
    }
    toast.success(`Request ${status}`);
    fetchAll();
  };

  if (!isAdmin) return (
    <div className="flex flex-col items-center py-20 text-muted-foreground">
      <Shield className="h-12 w-12 mb-3 opacity-30" />
      <p className="text-sm">Admin access required.</p>
    </div>
  );

  const filteredProfiles = allProfiles.filter(p =>
    p.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    p.cal_poly_email?.toLowerCase().includes(search.toLowerCase())
  );

  const matchedCount = roster.filter(r => r.matched_user_id).length;
  const unmatchedRoster = roster.filter(r => !r.matched_user_id);

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6 max-w-5xl">
      <motion.div variants={item} className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Admin Console</h1>
          <p className="text-xs text-muted-foreground font-mono">Manage users, invites, approvals, and audit trail</p>
        </div>
      </motion.div>

      {/* Roster status summary */}
      <motion.div variants={item} className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <Card className="card-hover">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg flex items-center justify-center bg-success/10">
              <CheckCircle2 className="h-4 w-4 text-success" />
            </div>
            <div>
              <p className="text-xl font-bold font-mono leading-none">{matchedCount}</p>
              <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider mt-0.5">Matched</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-hover">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg flex items-center justify-center bg-warning/10">
              <Clock className="h-4 w-4 text-warning" />
            </div>
            <div>
              <p className="text-xl font-bold font-mono leading-none">{unmatchedRoster.length}</p>
              <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider mt-0.5">Pending</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-hover">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg flex items-center justify-center bg-muted/50">
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xl font-bold font-mono leading-none">{allProfiles.length}</p>
              <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider mt-0.5">Accounts</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-hover">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg flex items-center justify-center bg-accent/10">
              <AlertCircle className="h-4 w-4 text-accent-foreground" />
            </div>
            <div>
              <p className="text-xl font-bold font-mono leading-none">{roleRequests.length}</p>
              <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider mt-0.5">Approvals</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <Tabs defaultValue="roster">
        <TabsList>
          <TabsTrigger value="roster" className="gap-1.5">
            <UserPlus className="h-3 w-3" /> Roster ({roster.length})
          </TabsTrigger>
          <TabsTrigger value="approvals" className="gap-1.5">
            Approvals {roleRequests.length > 0 && <Badge className="h-4 min-w-4 p-0 flex items-center justify-center text-[9px]">{roleRequests.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="users">Users ({allProfiles.length})</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        <TabsContent value="roster" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Members auto-match when they sign up with their @calpoly.edu email.
            </p>
          </div>

          {/* Group by cohort */}
          {["Hardware / Systems / Embedded", "Software / Systems", "Mechanical / Manufacturing", "Ops / PM"].map(cohortName => {
            const cohortRoster = roster.filter(r => r.cohort_name === cohortName);
            if (cohortRoster.length === 0) return null;
            return (
              <motion.div key={cohortName} variants={item}>
                <Card>
                  <CardHeader className="py-3 px-5">
                    <CardTitle className="text-sm font-sans font-semibold">{cohortName}</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 px-5 pb-4 space-y-1">
                    {cohortRoster.map(r => (
                      <div key={r.id} className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-muted/30 transition-colors">
                        <div className={`h-2 w-2 rounded-full shrink-0 ${r.matched_user_id ? "bg-success" : "bg-warning"}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{r.full_name}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{r.email || "no email"}</p>
                        </div>
                        <Badge variant="outline" className="text-[9px] font-mono shrink-0">{r.role}</Badge>
                        {r.title && <Badge variant="secondary" className="text-[9px] font-mono shrink-0 hidden sm:flex">{r.title}</Badge>}
                        {r.matched_user_id ? (
                          <Badge className="text-[9px] font-mono bg-success/10 text-success border-success/20 shrink-0">
                            <CheckCircle2 className="h-2.5 w-2.5 mr-1" />Matched
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[9px] font-mono text-warning border-warning/30 shrink-0">
                            <Clock className="h-2.5 w-2.5 mr-1" />Pending
                          </Badge>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </TabsContent>

        <TabsContent value="approvals" className="mt-4 space-y-2">
          {roleRequests.length === 0 ? (
            <Card className="flex flex-col items-center py-12">
              <Check className="h-10 w-10 text-success/30 mb-3" />
              <p className="text-sm text-muted-foreground">No pending approvals.</p>
            </Card>
          ) : roleRequests.map(rr => (
            <motion.div key={rr.id} variants={item}>
              <Card>
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="h-10 w-10 rounded-full bg-accent/10 flex items-center justify-center text-sm font-bold text-accent-foreground">
                    {(rr.profiles as any)?.full_name?.[0] || "?"}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{(rr.profiles as any)?.full_name}</p>
                    <p className="text-xs text-muted-foreground">{(rr.profiles as any)?.cal_poly_email}</p>
                    <Badge variant="outline" className="mt-1 text-[10px] font-mono">Requesting: {rr.requested_role}</Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleRoleRequest(rr.id, "approved", rr.user_id, rr.requested_role)} className="gap-1"><Check className="h-3 w-3" /> Approve</Button>
                    <Button size="sm" variant="destructive" onClick={() => handleRoleRequest(rr.id, "rejected", rr.user_id, rr.requested_role)} className="gap-1"><X className="h-3 w-3" /> Reject</Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </TabsContent>

        <TabsContent value="users" className="mt-4 space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search users..." className="pl-9 h-9 text-sm" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="space-y-2">
            {filteredProfiles.map(p => (
              <motion.div key={p.id} variants={item}>
                <Card className="hover:border-accent/30 transition-all">
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="h-9 w-9 rounded-full bg-accent/10 flex items-center justify-center text-xs font-bold text-accent-foreground">{p.full_name?.charAt(0) || "?"}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{p.full_name || "—"}</p>
                      <p className="text-xs text-muted-foreground">{p.cal_poly_email}</p>
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      {(p.user_roles || []).map((r: any, i: number) => (
                        <Badge key={i} variant="outline" className="text-[9px] font-mono">{r.role}</Badge>
                      ))}
                    </div>
                    <Badge variant={p.status === "active" ? "default" : "secondary"} className="text-[9px] font-mono">{p.status}</Badge>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="audit" className="mt-4 space-y-2">
          {auditLogs.length === 0 ? (
            <Card className="flex flex-col items-center py-12">
              <ScrollText className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">No audit logs yet.</p>
            </Card>
          ) : auditLogs.map(log => (
            <motion.div key={log.id} variants={item}>
              <Card>
                <CardContent className="flex items-center gap-4 p-3 text-sm">
                  <ScrollText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{log.action}</span>
                    <span className="text-muted-foreground ml-2">on {log.target_type}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-mono">{new Date(log.created_at).toLocaleString()}</span>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
