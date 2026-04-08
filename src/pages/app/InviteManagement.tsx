import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Shield, Mail, Send, Clock, CheckCircle2, XCircle, UserPlus,
  Search, RefreshCw, Users, Pencil, AlertTriangle, Filter,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import RosterEditSheet from "@/components/admin/RosterEditSheet";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.03 } } };
const item = { hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0, transition: { duration: 0.15 } } };

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

type QuickFilter = "all" | "missing_email" | "ready" | "pending" | "accepted" | "expired" | "conflict";

const ROLE_LABELS: Record<string, string> = {
  member: "Member", pm: "PM", lead: "Tech Lead", integration_lead: "Int. Lead",
};

export default function InviteManagement() {
  const { user, isAdmin } = useAuth();
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [invites, setInvites] = useState<InviteToken[]>([]);
  const [search, setSearch] = useState("");
  const [filterCohort, setFilterCohort] = useState("all");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [sending, setSending] = useState<string | null>(null);
  const [editEntry, setEditEntry] = useState<RosterEntry | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [isNewEntry, setIsNewEntry] = useState(false);

  const fetchData = async () => {
    const [rosterRes, inviteRes] = await Promise.all([
      supabase.from("cohort_roster").select("*").order("cohort_name, role, full_name"),
      supabase.from("invite_tokens").select("*").order("created_at", { ascending: false }),
    ]);
    setRoster((rosterRes.data as RosterEntry[]) || []);
    setInvites((inviteRes.data as InviteToken[]) || []);
  };

  useEffect(() => { if (isAdmin) fetchData(); }, [isAdmin]);

  // --- Status helpers ---
  const getStatus = (entry: RosterEntry): { label: string; color: string; icon: any; priority: number } => {
    if (!entry.email) return { label: "Missing email", color: "bg-warning/10 text-warning border-warning/20", icon: AlertTriangle, priority: 0 };
    if (entry.matched_user_id) return { label: "Accepted", color: "bg-success/10 text-success border-success/20", icon: CheckCircle2, priority: 4 };
    if (entry.identity_status === "conflict") return { label: "Conflict", color: "bg-destructive/10 text-destructive border-destructive/20", icon: AlertTriangle, priority: 1 };
    const invite = invites.find(i => i.email.toLowerCase() === entry.email!.toLowerCase());
    if (invite) {
      if (invite.used_at) return { label: "Used", color: "bg-success/10 text-success border-success/20", icon: CheckCircle2, priority: 4 };
      if (new Date(invite.expires_at) < new Date()) return { label: "Expired", color: "bg-destructive/10 text-destructive border-destructive/20", icon: XCircle, priority: 2 };
      return { label: "Pending", color: "bg-accent/10 text-accent border-accent/20", icon: Clock, priority: 3 };
    }
    return { label: "Ready to invite", color: "bg-primary/10 text-primary border-primary/20", icon: Mail, priority: 1 };
  };

  // --- Quick filter counts ---
  const counts = useMemo(() => {
    const c = { all: roster.length, missing_email: 0, ready: 0, pending: 0, accepted: 0, expired: 0, conflict: 0 };
    roster.forEach(r => {
      const s = getStatus(r).label;
      if (s === "Missing email") c.missing_email++;
      else if (s === "Ready to invite") c.ready++;
      else if (s === "Pending") c.pending++;
      else if (s === "Accepted" || s === "Used") c.accepted++;
      else if (s === "Expired") c.expired++;
      else if (s === "Conflict") c.conflict++;
    });
    return c;
  }, [roster, invites]);

  const cohorts = useMemo(() => [...new Set(roster.map(r => r.cohort_name))].sort(), [roster]);

  // --- Filtering ---
  const filtered = useMemo(() => {
    return roster.filter(r => {
      if (filterCohort !== "all" && r.cohort_name !== filterCohort) return false;
      const status = getStatus(r).label;
      if (quickFilter === "missing_email" && status !== "Missing email") return false;
      if (quickFilter === "ready" && status !== "Ready to invite") return false;
      if (quickFilter === "pending" && status !== "Pending") return false;
      if (quickFilter === "accepted" && status !== "Accepted" && status !== "Used") return false;
      if (quickFilter === "expired" && status !== "Expired") return false;
      if (quickFilter === "conflict" && status !== "Conflict") return false;
      if (search) {
        const s = search.toLowerCase();
        return r.full_name.toLowerCase().includes(s) || (r.email || "").toLowerCase().includes(s);
      }
      return true;
    });
  }, [roster, invites, filterCohort, quickFilter, search]);

  // --- Actions ---
  const issueInvite = async (entry: RosterEntry) => {
    if (!entry.email) { toast.error("Add email first"); return; }
    setSending(entry.id);

    // Insert invite token and get the token value back
    const { data: tokenData, error } = await supabase
      .from("invite_tokens")
      .insert({ email: entry.email, created_by: user!.id })
      .select("token")
      .single();
    if (error) { toast.error(error.message); setSending(null); return; }

    // Log the invite
    await supabase.from("audit_logs").insert({
      action: "invite_issued", target_type: "invite_tokens", target_id: entry.id,
      user_id: user!.id, metadata: { email: entry.email, roster_name: entry.full_name },
    });

    // Send invite email via edge function
    try {
      const { data: emailResult, error: emailError } = await supabase.functions.invoke("send-invite-email", {
        body: { email: entry.email, token: tokenData.token, fullName: entry.full_name },
      });
      if (emailError) throw emailError;
      if (emailResult?.error) throw new Error(emailResult.error);
      toast.success(`Invite sent to ${entry.email}`);
    } catch (emailErr: any) {
      console.error("Email send failed:", emailErr);
      toast.warning(`Invite created but email failed to send. You may need to share the link manually.`);
    }

    setSending(null);
    fetchData();
  };

  const resendInvite = async (entry: RosterEntry) => {
    if (!entry.email) return;
    const oldInvite = invites.find(i => i.email.toLowerCase() === entry.email!.toLowerCase() && !i.used_at);
    if (oldInvite) {
      await supabase.from("invite_tokens").update({ expires_at: new Date().toISOString() } as any).eq("id", oldInvite.id);
    }
    await issueInvite(entry);
  };

  const expireInvite = async (entry: RosterEntry) => {
    if (!entry.email) return;
    const invite = invites.find(i => i.email.toLowerCase() === entry.email!.toLowerCase() && !i.used_at);
    if (!invite) return;
    await supabase.from("invite_tokens").update({ expires_at: new Date().toISOString() } as any).eq("id", invite.id);
    toast.success("Invite expired");
    fetchData();
  };

  const openEdit = (entry: RosterEntry) => {
    setEditEntry(entry);
    setIsNewEntry(false);
    setSheetOpen(true);
  };

  const openNew = () => {
    setEditEntry(null);
    setIsNewEntry(true);
    setSheetOpen(true);
  };

  if (!isAdmin) return (
    <div className="flex flex-col items-center py-20 text-muted-foreground">
      <Shield className="h-12 w-12 mb-3 opacity-30" />
      <p className="text-sm">Admin access required.</p>
    </div>
  );

  const quickFilters: { key: QuickFilter; label: string; count: number; color?: string }[] = [
    { key: "all", label: "All", count: counts.all },
    { key: "missing_email", label: "Missing email", count: counts.missing_email, color: "text-warning" },
    { key: "ready", label: "Ready to invite", count: counts.ready, color: "text-primary" },
    { key: "pending", label: "Pending", count: counts.pending },
    { key: "accepted", label: "Accepted", count: counts.accepted, color: "text-success" },
    { key: "expired", label: "Expired", count: counts.expired, color: "text-destructive" },
    { key: "conflict", label: "Conflicts", count: counts.conflict, color: "text-destructive" },
  ];

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-5 max-w-5xl">
      {/* Header */}
      <motion.div variants={item} className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Roster & Invites</h1>
          <p className="text-xs text-muted-foreground font-mono">Manage roster entries, fix missing data, issue invites</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={fetchData}>
            <RefreshCw className="h-3 w-3" /> Refresh
          </Button>
          <Button size="sm" className="gap-1.5" onClick={openNew}>
            <UserPlus className="h-3 w-3" /> New Entry
          </Button>
        </div>
      </motion.div>

      {/* Quick filter chips */}
      <motion.div variants={item} className="flex gap-1.5 flex-wrap">
        {quickFilters.map(f => (
          <button
            key={f.key}
            onClick={() => setQuickFilter(f.key)}
            className={`px-2.5 py-1 rounded-full text-[10px] font-mono border transition-all ${
              quickFilter === f.key
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card border-border hover:border-primary/30"
            } ${f.color && quickFilter !== f.key ? f.color : ""}`}
          >
            {f.label} ({f.count})
          </button>
        ))}
      </motion.div>

      {/* Search + cohort filter */}
      <motion.div variants={item} className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search name or email…" className="pl-9 h-9 text-sm" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterCohort} onValueChange={setFilterCohort}>
          <SelectTrigger className="w-56 h-9 text-sm"><SelectValue placeholder="All cohorts" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All cohorts</SelectItem>
            {cohorts.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </motion.div>

      {/* Roster table */}
      <div className="space-y-1.5">
        {/* Column header */}
        <div className="grid grid-cols-[1fr_140px_100px_100px_120px] gap-2 px-3 py-1.5 text-[9px] font-mono uppercase text-muted-foreground tracking-wider">
          <span>Name / Email</span>
          <span>Cohort</span>
          <span>Role</span>
          <span>Status</span>
          <span className="text-right">Actions</span>
        </div>

        {filtered.map(entry => {
          const status = getStatus(entry);
          const StatusIcon = status.icon;
          return (
            <motion.div key={entry.id} variants={item}>
              <Card className="hover:border-accent/20 transition-all">
                <CardContent className="grid grid-cols-[1fr_140px_100px_100px_120px] gap-2 items-center p-2.5">
                  {/* Name/Email */}
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{entry.full_name}</p>
                    {entry.email ? (
                      <p className="text-[10px] text-muted-foreground font-mono truncate">{entry.email}</p>
                    ) : (
                      <p className="text-[10px] text-warning font-mono flex items-center gap-1">
                        <AlertTriangle className="h-2.5 w-2.5" /> No email
                      </p>
                    )}
                  </div>

                  {/* Cohort */}
                  <p className="text-[10px] text-muted-foreground font-mono truncate">{entry.cohort_name}</p>

                  {/* Role */}
                  <Badge variant="outline" className="text-[9px] font-mono w-fit">
                    {ROLE_LABELS[entry.role] || entry.role}
                  </Badge>

                  {/* Status */}
                  <Badge className={`text-[9px] font-mono w-fit ${status.color}`}>
                    <StatusIcon className="h-2.5 w-2.5 mr-1" />{status.label}
                  </Badge>

                  {/* Actions */}
                  <div className="flex gap-1 justify-end">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(entry)} title="Edit">
                      <Pencil className="h-3 w-3" />
                    </Button>

                    {status.label === "Missing email" && (
                      <Button size="sm" variant="outline" className="text-[10px] h-7 gap-1" onClick={() => openEdit(entry)}>
                        Add email
                      </Button>
                    )}

                    {status.label === "Ready to invite" && (
                      <Button size="sm" variant="outline" className="text-[10px] h-7 gap-1" disabled={sending === entry.id} onClick={() => issueInvite(entry)}>
                        <Send className="h-2.5 w-2.5" />Invite
                      </Button>
                    )}

                    {status.label === "Pending" && (
                      <>
                        <Button size="sm" variant="outline" className="text-[10px] h-7 gap-1" onClick={() => resendInvite(entry)}>
                          <RefreshCw className="h-2.5 w-2.5" />Resend
                        </Button>
                        <Button size="sm" variant="ghost" className="text-[10px] h-7 gap-1 text-destructive" onClick={() => expireInvite(entry)}>
                          <XCircle className="h-2.5 w-2.5" />
                        </Button>
                      </>
                    )}

                    {status.label === "Expired" && (
                      <Button size="sm" variant="outline" className="text-[10px] h-7 gap-1" disabled={sending === entry.id} onClick={() => issueInvite(entry)}>
                        <Send className="h-2.5 w-2.5" />Re-invite
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
            <Filter className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No roster entries match filters.</p>
          </Card>
        )}
      </div>

      {/* Edit/New Sheet */}
      <RosterEditSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        entry={isNewEntry ? null : editEntry}
        allEntries={roster}
        onSaved={fetchData}
      />
    </motion.div>
  );
}
