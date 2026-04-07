import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Shield, Mail, Send, Clock, CheckCircle2, XCircle, UserPlus,
  Search, RefreshCw, AlertTriangle, Users,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const item = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.2 } } };

interface RosterEntry {
  id: string;
  full_name: string;
  email: string | null;
  cohort_name: string;
  role: string;
  title: string | null;
  identity_status: string;
  matched_user_id: string | null;
  matched_at: string | null;
}

interface InviteToken {
  id: string;
  email: string;
  token: string;
  created_at: string;
  expires_at: string;
  used_at: string | null;
  created_by: string | null;
}

export default function InviteManagement() {
  const { user, isAdmin } = useAuth();
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [invites, setInvites] = useState<InviteToken[]>([]);
  const [search, setSearch] = useState("");
  const [filterCohort, setFilterCohort] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [sending, setSending] = useState<string | null>(null);

  const fetchData = async () => {
    const [rosterRes, inviteRes] = await Promise.all([
      supabase.from("cohort_roster").select("*").order("cohort_name, role, full_name"),
      supabase.from("invite_tokens").select("*").order("created_at", { ascending: false }),
    ]);
    setRoster((rosterRes.data as RosterEntry[]) || []);
    setInvites((inviteRes.data as InviteToken[]) || []);
  };

  useEffect(() => { if (isAdmin) fetchData(); }, [isAdmin]);

  const getInviteState = (entry: RosterEntry): { label: string; color: string; icon: any } => {
    if (entry.matched_user_id) return { label: "Accepted", color: "bg-success/10 text-success border-success/20", icon: CheckCircle2 };
    const invite = invites.find(i => i.email && entry.email && i.email.toLowerCase() === entry.email.toLowerCase());
    if (invite) {
      if (invite.used_at) return { label: "Used", color: "bg-success/10 text-success border-success/20", icon: CheckCircle2 };
      if (new Date(invite.expires_at) < new Date()) return { label: "Expired", color: "bg-destructive/10 text-destructive border-destructive/20", icon: XCircle };
      return { label: "Pending", color: "bg-warning/10 text-warning border-warning/20", icon: Clock };
    }
    return { label: "Not invited", color: "bg-muted text-muted-foreground", icon: Mail };
  };

  const issueInvite = async (entry: RosterEntry) => {
    if (!entry.email) { toast.error("No email on roster entry"); return; }
    setSending(entry.id);
    const { error } = await supabase.from("invite_tokens").insert({
      email: entry.email,
      created_by: user!.id,
    });
    if (error) { toast.error(error.message); setSending(null); return; }
    await supabase.from("audit_logs").insert({
      action: "invite_issued",
      target_type: "invite_tokens",
      target_id: entry.id,
      user_id: user!.id,
      metadata: { email: entry.email, roster_name: entry.full_name },
    });
    toast.success(`Invite issued for ${entry.email}`);
    setSending(null);
    fetchData();
  };

  const resendInvite = async (entry: RosterEntry) => {
    if (!entry.email) return;
    // Expire old invite and create new
    const oldInvite = invites.find(i => i.email?.toLowerCase() === entry.email?.toLowerCase() && !i.used_at);
    if (oldInvite) {
      await supabase.from("invite_tokens").update({ expires_at: new Date().toISOString() } as any).eq("id", oldInvite.id);
    }
    await issueInvite(entry);
  };

  const expireInvite = async (entry: RosterEntry) => {
    if (!entry.email) return;
    const invite = invites.find(i => i.email?.toLowerCase() === entry.email?.toLowerCase() && !i.used_at);
    if (!invite) return;
    await supabase.from("invite_tokens").update({ expires_at: new Date().toISOString() } as any).eq("id", invite.id);
    toast.success("Invite expired");
    fetchData();
  };

  const cohorts = [...new Set(roster.map(r => r.cohort_name))];

  const filtered = roster.filter(r => {
    if (filterCohort !== "all" && r.cohort_name !== filterCohort) return false;
    if (filterStatus !== "all") {
      const state = getInviteState(r);
      if (filterStatus === "accepted" && state.label !== "Accepted") return false;
      if (filterStatus === "pending" && state.label !== "Pending") return false;
      if (filterStatus === "expired" && state.label !== "Expired") return false;
      if (filterStatus === "not_invited" && state.label !== "Not invited") return false;
    }
    if (search) {
      const s = search.toLowerCase();
      return r.full_name.toLowerCase().includes(s) || (r.email || "").toLowerCase().includes(s);
    }
    return true;
  });

  const stats = {
    total: roster.length,
    accepted: roster.filter(r => getInviteState(r).label === "Accepted").length,
    pending: roster.filter(r => getInviteState(r).label === "Pending").length,
    expired: roster.filter(r => getInviteState(r).label === "Expired").length,
    notInvited: roster.filter(r => getInviteState(r).label === "Not invited").length,
  };

  if (!isAdmin) return (
    <div className="flex flex-col items-center py-20 text-muted-foreground">
      <Shield className="h-12 w-12 mb-3 opacity-30" />
      <p className="text-sm">Admin access required.</p>
    </div>
  );

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6 max-w-5xl">
      <motion.div variants={item} className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Invite Management</h1>
          <p className="text-xs text-muted-foreground font-mono">Issue, track, and manage member invitations</p>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={fetchData}>
          <RefreshCw className="h-3 w-3" /> Refresh
        </Button>
      </motion.div>

      {/* Stats */}
      <motion.div variants={item} className="grid gap-3 grid-cols-2 sm:grid-cols-5">
        {[
          { label: "Total", value: stats.total, icon: Users, color: "bg-primary/10 text-primary" },
          { label: "Accepted", value: stats.accepted, icon: CheckCircle2, color: "bg-success/10 text-success" },
          { label: "Pending", value: stats.pending, icon: Clock, color: "bg-warning/10 text-warning" },
          { label: "Expired", value: stats.expired, icon: XCircle, color: "bg-destructive/10 text-destructive" },
          { label: "Not Invited", value: stats.notInvited, icon: Mail, color: "bg-muted text-muted-foreground" },
        ].map(s => (
          <Card key={s.label} className="card-hover">
            <CardContent className="p-3 flex items-center gap-2">
              <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${s.color}`}>
                <s.icon className="h-3.5 w-3.5" />
              </div>
              <div>
                <p className="text-lg font-bold font-mono leading-none">{s.value}</p>
                <p className="text-[9px] text-muted-foreground font-mono uppercase">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      {/* Filters */}
      <motion.div variants={item} className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search name or email..." className="pl-9 h-9 text-sm" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterCohort} onValueChange={setFilterCohort}>
          <SelectTrigger className="w-48 h-9 text-sm"><SelectValue placeholder="All cohorts" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All cohorts</SelectItem>
            {cohorts.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40 h-9 text-sm"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="accepted">Accepted</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="not_invited">Not invited</SelectItem>
          </SelectContent>
        </Select>
      </motion.div>

      {/* Roster list */}
      <div className="space-y-2">
        {filtered.map(entry => {
          const state = getInviteState(entry);
          const StateIcon = state.icon;
          return (
            <motion.div key={entry.id} variants={item}>
              <Card className="hover:border-accent/20 transition-all">
                <CardContent className="flex items-center gap-3 p-3">
                  <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${state.label === "Accepted" ? "bg-success" : state.label === "Pending" ? "bg-warning" : state.label === "Expired" ? "bg-destructive" : "bg-muted-foreground/30"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{entry.full_name}</p>
                      <Badge variant="outline" className="text-[9px] font-mono shrink-0">{entry.role}</Badge>
                      {entry.title && <Badge variant="secondary" className="text-[9px] font-mono shrink-0 hidden sm:flex">{entry.title}</Badge>}
                    </div>
                    <p className="text-[10px] text-muted-foreground font-mono">{entry.email || "no email"} · {entry.cohort_name}</p>
                  </div>
                  <Badge className={`text-[9px] font-mono shrink-0 ${state.color}`}>
                    <StateIcon className="h-2.5 w-2.5 mr-1" />{state.label}
                  </Badge>
                  <div className="flex gap-1 shrink-0">
                    {state.label === "Not invited" && entry.email && (
                      <Button size="sm" variant="outline" className="text-[10px] h-7 gap-1" disabled={sending === entry.id} onClick={() => issueInvite(entry)}>
                        <Send className="h-2.5 w-2.5" />Invite
                      </Button>
                    )}
                    {state.label === "Pending" && (
                      <Button size="sm" variant="outline" className="text-[10px] h-7 gap-1" onClick={() => resendInvite(entry)}>
                        <RefreshCw className="h-2.5 w-2.5" />Resend
                      </Button>
                    )}
                    {state.label === "Expired" && entry.email && (
                      <Button size="sm" variant="outline" className="text-[10px] h-7 gap-1" onClick={() => issueInvite(entry)}>
                        <Send className="h-2.5 w-2.5" />Re-invite
                      </Button>
                    )}
                    {state.label === "Pending" && (
                      <Button size="sm" variant="ghost" className="text-[10px] h-7 gap-1 text-destructive" onClick={() => expireInvite(entry)}>
                        <XCircle className="h-2.5 w-2.5" />Expire
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
        {filtered.length === 0 && (
          <Card className="flex flex-col items-center py-12">
            <Users className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No roster entries match filters.</p>
          </Card>
        )}
      </div>
    </motion.div>
  );
}
