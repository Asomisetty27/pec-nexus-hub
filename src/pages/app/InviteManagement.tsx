import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Shield, Mail, Send, Clock, CheckCircle2, XCircle, UserPlus,
  Search, RefreshCw, Users, Pencil, AlertTriangle, Filter,
  Copy, Link2, MailX, MailCheck, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import RosterEditSheet from "@/components/admin/RosterEditSheet";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.03 } } };
const item = { hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0, transition: { duration: 0.15 } } };

const APP_URL = "https://pecnexus.com";

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
  email_status: string;
  email_error: string | null;
  email_provider_id: string | null;
  email_sent_at: string | null;
}

type QuickFilter = "all" | "missing_email" | "ready" | "pending" | "sent" | "failed" | "accepted" | "expired" | "conflict";

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

  const getInvite = (entry: RosterEntry): InviteToken | undefined => {
    if (!entry.email) return undefined;
    return invites.find(i => i.email.toLowerCase() === entry.email!.toLowerCase());
  };

  const getStatus = (entry: RosterEntry): { label: string; color: string; icon: any; priority: number; detail?: string } => {
    if (!entry.email) return { label: "Missing email", color: "bg-warning/10 text-warning border-warning/20", icon: AlertTriangle, priority: 0 };
    if (entry.matched_user_id) return { label: "Accepted", color: "bg-success/10 text-success border-success/20", icon: CheckCircle2, priority: 5 };
    if (entry.identity_status === "conflict") return { label: "Conflict", color: "bg-destructive/10 text-destructive border-destructive/20", icon: AlertTriangle, priority: 1 };

    const invite = getInvite(entry);
    if (invite) {
      if (invite.used_at) return { label: "Accepted", color: "bg-success/10 text-success border-success/20", icon: CheckCircle2, priority: 5 };
      if (new Date(invite.expires_at) < new Date()) return { label: "Expired", color: "bg-destructive/10 text-destructive border-destructive/20", icon: XCircle, priority: 2 };

      // Email delivery states
      if (invite.email_status === "failed") {
        return {
          label: "Send failed",
          color: "bg-destructive/10 text-destructive border-destructive/20",
          icon: MailX,
          priority: 1,
          detail: invite.email_error || "Unknown error",
        };
      }
      if (invite.email_status === "manual_only") {
        return { label: "Manual only", color: "bg-warning/10 text-warning border-warning/20", icon: Link2, priority: 2 };
      }
      if (invite.email_status === "sent") {
        return { label: "Sent", color: "bg-accent/10 text-accent border-accent/20", icon: MailCheck, priority: 3 };
      }
      // pending_send
      return { label: "Pending send", color: "bg-muted text-muted-foreground border-border", icon: Clock, priority: 3 };
    }
    return { label: "Ready", color: "bg-primary/10 text-primary border-primary/20", icon: Mail, priority: 1 };
  };

  const counts = useMemo(() => {
    const c = { all: roster.length, missing_email: 0, ready: 0, pending: 0, sent: 0, failed: 0, accepted: 0, expired: 0, conflict: 0 };
    roster.forEach(r => {
      const s = getStatus(r).label;
      if (s === "Missing email") c.missing_email++;
      else if (s === "Ready") c.ready++;
      else if (s === "Pending send") c.pending++;
      else if (s === "Sent") c.sent++;
      else if (s === "Send failed" || s === "Manual only") c.failed++;
      else if (s === "Accepted") c.accepted++;
      else if (s === "Expired") c.expired++;
      else if (s === "Conflict") c.conflict++;
    });
    return c;
  }, [roster, invites]);

  const cohorts = useMemo(() => [...new Set(roster.map(r => r.cohort_name))].sort(), [roster]);

  const filtered = useMemo(() => {
    return roster.filter(r => {
      if (filterCohort !== "all" && r.cohort_name !== filterCohort) return false;
      const status = getStatus(r).label;
      if (quickFilter === "missing_email" && status !== "Missing email") return false;
      if (quickFilter === "ready" && status !== "Ready") return false;
      if (quickFilter === "pending" && status !== "Pending send") return false;
      if (quickFilter === "sent" && status !== "Sent") return false;
      if (quickFilter === "failed" && status !== "Send failed" && status !== "Manual only") return false;
      if (quickFilter === "accepted" && status !== "Accepted") return false;
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
  const copyInviteLink = (entry: RosterEntry) => {
    const invite = getInvite(entry);
    if (!invite) { toast.error("No invite token found"); return; }
    const link = `${APP_URL}/invite/${invite.token}`;
    navigator.clipboard.writeText(link);
    toast.success("Invite link copied to clipboard");
  };

  const copyMessageTemplate = (entry: RosterEntry) => {
    const invite = getInvite(entry);
    if (!invite) { toast.error("No invite token found"); return; }
    const link = `${APP_URL}/invite/${invite.token}`;
    const msg = `Hi ${entry.full_name},\n\nYou've been invited to join PEC Nexus. Use this link to accept your invitation:\n\n${link}\n\nPlease sign up with your Cal Poly email (@calpoly.edu) to ensure your account is matched correctly.\n\nThis invite expires in 7 days.`;
    navigator.clipboard.writeText(msg);
    toast.success("Message template copied to clipboard");
  };

  const issueInvite = async (entry: RosterEntry) => {
    if (!entry.email) { toast.error("Add email first"); return; }
    setSending(entry.id);

    // 1. Create invite token
    const { data: tokenData, error } = await supabase
      .from("invite_tokens")
      .insert({ email: entry.email, created_by: user!.id, email_status: "pending_send" })
      .select("id, token")
      .single();

    if (error || !tokenData) {
      toast.error(error?.message || "Failed to create invite token");
      setSending(null);
      return;
    }

    // 2. Log
    await supabase.from("audit_logs").insert({
      action: "invite_issued", target_type: "invite_tokens", target_id: tokenData.id,
      user_id: user!.id, metadata: { email: entry.email, roster_name: entry.full_name },
    });

    // 3. Send email
    try {
      const { data: emailResult, error: emailError } = await supabase.functions.invoke("send-invite-email", {
        body: { email: entry.email, token: tokenData.token, fullName: entry.full_name, tokenId: tokenData.id },
      });

      if (emailError) {
        throw new Error(emailError.message || "Function invocation failed");
      }

      if (emailResult?.error) {
        // Edge function returned an error response
        console.error("Email send error:", emailResult);

        // Token status already updated by edge function if tokenId was passed
        toast.error(
          `Invite created but email failed: ${emailResult.error}`,
          {
            action: {
              label: "Copy Link",
              onClick: () => {
                const link = `${APP_URL}/invite/${tokenData.token}`;
                navigator.clipboard.writeText(link);
                toast.success("Link copied");
              },
            },
            duration: 10000,
          }
        );
      } else if (emailResult?.success) {
        toast.success(`Invite sent to ${entry.email}`, { duration: 4000 });
      } else {
        // Ambiguous response
        toast.warning("Invite created but email status is unclear. Check the invite status.", {
          action: {
            label: "Copy Link",
            onClick: () => {
              const link = `${APP_URL}/invite/${tokenData.token}`;
              navigator.clipboard.writeText(link);
              toast.success("Link copied");
            },
          },
          duration: 10000,
        });
      }
    } catch (emailErr: any) {
      console.error("Email send exception:", emailErr);

      // Update token to failed since edge function might not have done it
      await supabase.from("invite_tokens").update({
        email_status: "failed",
        email_error: emailErr.message || "Function invocation failed",
        email_sent_at: new Date().toISOString(),
      } as any).eq("id", tokenData.id);

      toast.error(
        `Invite created but email failed to send.`,
        {
          action: {
            label: "Copy Link",
            onClick: () => {
              const link = `${APP_URL}/invite/${tokenData.token}`;
              navigator.clipboard.writeText(link);
              toast.success("Link copied");
            },
          },
          duration: 10000,
        }
      );
    }

    setSending(null);
    fetchData();
  };

  const retrySendEmail = async (entry: RosterEntry) => {
    const invite = getInvite(entry);
    if (!invite || !entry.email) return;
    setSending(entry.id);

    try {
      const { data: emailResult, error: emailError } = await supabase.functions.invoke("send-invite-email", {
        body: { email: entry.email, token: invite.token, fullName: entry.full_name, tokenId: invite.id },
      });

      if (emailError) throw new Error(emailError.message);
      if (emailResult?.error) {
        toast.error(`Retry failed: ${emailResult.error}`);
      } else if (emailResult?.success) {
        toast.success(`Email sent to ${entry.email}`);
      }
    } catch (err: any) {
      toast.error(`Retry failed: ${err.message}`);
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
    { key: "ready", label: "Ready", count: counts.ready, color: "text-primary" },
    { key: "pending", label: "Pending", count: counts.pending },
    { key: "sent", label: "Sent", count: counts.sent, color: "text-accent" },
    { key: "failed", label: "Failed", count: counts.failed, color: "text-destructive" },
    { key: "accepted", label: "Accepted", count: counts.accepted, color: "text-success" },
    { key: "expired", label: "Expired", count: counts.expired, color: "text-destructive" },
    { key: "conflict", label: "Conflicts", count: counts.conflict, color: "text-destructive" },
  ];

  return (
    <TooltipProvider>
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
          <div className="grid grid-cols-[1fr_120px_80px_120px_160px] gap-2 px-3 py-1.5 text-[9px] font-mono uppercase text-muted-foreground tracking-wider">
            <span>Name / Email</span>
            <span>Cohort</span>
            <span>Role</span>
            <span>Status</span>
            <span className="text-right">Actions</span>
          </div>

          {filtered.map(entry => {
            const status = getStatus(entry);
            const StatusIcon = status.icon;
            const invite = getInvite(entry);
            const isSending = sending === entry.id;

            return (
              <motion.div key={entry.id} variants={item}>
                <Card className="hover:border-accent/20 transition-all">
                  <CardContent className="grid grid-cols-[1fr_120px_80px_120px_160px] gap-2 items-center p-2.5">
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
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge className={`text-[9px] font-mono w-fit cursor-help ${status.color}`}>
                          <StatusIcon className="h-2.5 w-2.5 mr-1" />{status.label}
                        </Badge>
                      </TooltipTrigger>
                      {status.detail && (
                        <TooltipContent side="top" className="max-w-xs">
                          <p className="text-xs font-mono break-all">{status.detail}</p>
                        </TooltipContent>
                      )}
                    </Tooltip>

                    {/* Actions */}
                    <div className="flex gap-1 justify-end flex-wrap">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(entry)} title="Edit">
                        <Pencil className="h-3 w-3" />
                      </Button>

                      {status.label === "Missing email" && (
                        <Button size="sm" variant="outline" className="text-[10px] h-7 gap-1" onClick={() => openEdit(entry)}>
                          Add email
                        </Button>
                      )}

                      {status.label === "Ready" && (
                        <Button size="sm" variant="outline" className="text-[10px] h-7 gap-1" disabled={isSending} onClick={() => issueInvite(entry)}>
                          {isSending ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Send className="h-2.5 w-2.5" />}
                          Invite
                        </Button>
                      )}

                      {/* Failed: retry + copy link */}
                      {(status.label === "Send failed" || status.label === "Manual only") && invite && (
                        <>
                          <Button size="sm" variant="outline" className="text-[10px] h-7 gap-1" disabled={isSending} onClick={() => retrySendEmail(entry)}>
                            {isSending ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <RefreshCw className="h-2.5 w-2.5" />}
                            Retry
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => copyInviteLink(entry)} title="Copy invite link">
                            <Link2 className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => copyMessageTemplate(entry)} title="Copy message template">
                            <Copy className="h-3 w-3" />
                          </Button>
                        </>
                      )}

                      {/* Sent/Pending: copy link + resend */}
                      {(status.label === "Sent" || status.label === "Pending send") && invite && (
                        <>
                          <Button size="sm" variant="outline" className="text-[10px] h-7 gap-1" disabled={isSending} onClick={() => resendInvite(entry)}>
                            <RefreshCw className="h-2.5 w-2.5" />Resend
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => copyInviteLink(entry)} title="Copy invite link">
                            <Link2 className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="ghost" className="text-[10px] h-7 gap-1 text-destructive" onClick={() => expireInvite(entry)}>
                            <XCircle className="h-2.5 w-2.5" />
                          </Button>
                        </>
                      )}

                      {status.label === "Expired" && (
                        <Button size="sm" variant="outline" className="text-[10px] h-7 gap-1" disabled={isSending} onClick={() => issueInvite(entry)}>
                          {isSending ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Send className="h-2.5 w-2.5" />}
                          Re-invite
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
    </TooltipProvider>
  );
}
