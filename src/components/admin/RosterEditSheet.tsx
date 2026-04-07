import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, Save, UserPlus, Shield } from "lucide-react";
import { toast } from "sonner";

const COHORTS = [
  "Hardware / Systems / Embedded",
  "Mechanical / Manufacturing",
  "Ops / PM",
  "Software / Systems",
];

const ROLES = ["member", "pm", "lead", "integration_lead"];

const ROLE_LABELS: Record<string, string> = {
  member: "Member",
  pm: "Project Manager",
  lead: "Tech Lead",
  integration_lead: "Integration Lead",
};

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

interface RosterEditSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: RosterEntry | null; // null = new entry mode
  allEntries: RosterEntry[];
  onSaved: () => void;
}

export default function RosterEditSheet({ open, onOpenChange, entry, allEntries, onSaved }: RosterEditSheetProps) {
  const { user } = useAuth();
  const isNew = !entry;

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [cohort, setCohort] = useState("");
  const [role, setRole] = useState("member");
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [showMatchWarning, setShowMatchWarning] = useState(false);

  useEffect(() => {
    if (entry) {
      setFullName(entry.full_name);
      setEmail(entry.email || "");
      setCohort(entry.cohort_name);
      setRole(entry.role);
      setTitle(entry.title || "");
    } else {
      setFullName("");
      setEmail("");
      setCohort("");
      setRole("member");
      setTitle("");
    }
    setShowMatchWarning(false);
  }, [entry, open]);

  const emailValid = !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const emailDuplicate = email
    ? allEntries.some(e => e.id !== entry?.id && e.email?.toLowerCase() === email.toLowerCase())
    : false;
  const nameDuplicate = fullName.trim()
    ? allEntries.some(e => e.id !== entry?.id && e.full_name.toLowerCase() === fullName.trim().toLowerCase())
    : false;

  const isMatchedAndEmailChanging = entry?.matched_user_id && email !== (entry.email || "");

  const canSave = fullName.trim() && cohort && role && emailValid && !emailDuplicate;

  const handleSave = async () => {
    if (!canSave) return;

    if (isMatchedAndEmailChanging && !showMatchWarning) {
      setShowMatchWarning(true);
      return;
    }

    setSaving(true);
    const payload = {
      full_name: fullName.trim(),
      email: email.trim() || null,
      cohort_name: cohort,
      role,
      title: title.trim() || null,
    };

    if (isNew) {
      const { error } = await supabase.from("cohort_roster").insert(payload);
      if (error) { toast.error(error.message); setSaving(false); return; }
      await supabase.from("audit_logs").insert({
        action: "roster_entry_created",
        target_type: "cohort_roster",
        user_id: user!.id,
        metadata: { full_name: payload.full_name, email: payload.email },
      });
      toast.success(`Added ${payload.full_name} to roster`);
    } else {
      // If email changed on an already-invited user, expire old tokens
      if (entry.email && email.trim() && entry.email.toLowerCase() !== email.trim().toLowerCase()) {
        const { data: oldTokens } = await supabase
          .from("invite_tokens")
          .select("id")
          .eq("email", entry.email)
          .is("used_at", null);
        if (oldTokens?.length) {
          await supabase
            .from("invite_tokens")
            .update({ expires_at: new Date().toISOString() } as any)
            .in("id", oldTokens.map(t => t.id));
          toast.info("Previous invite tokens expired due to email change");
        }
      }

      const { error } = await supabase.from("cohort_roster").update(payload).eq("id", entry.id);
      if (error) { toast.error(error.message); setSaving(false); return; }
      await supabase.from("audit_logs").insert({
        action: "roster_entry_updated",
        target_type: "cohort_roster",
        target_id: entry.id,
        user_id: user!.id,
        metadata: { changes: payload },
      });
      toast.success(`Updated ${payload.full_name}`);
    }

    setSaving(false);
    setShowMatchWarning(false);
    onOpenChange(false);
    onSaved();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 font-display">
            {isNew ? <UserPlus className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
            {isNew ? "New Roster Entry" : "Edit Roster Entry"}
          </SheetTitle>
          <SheetDescription className="font-mono text-[10px]">
            {isNew ? "Add a new expected member to the roster" : `Editing: ${entry?.full_name}`}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 mt-6">
          {/* Matched user info (read-only) */}
          {entry?.matched_user_id && (
            <div className="rounded-lg border border-success/30 bg-success/5 p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-success text-xs font-medium">
                <CheckCircle2 className="h-3 w-3" /> Matched to auth user
              </div>
              <p className="text-[10px] font-mono text-muted-foreground">
                User ID: {entry.matched_user_id.slice(0, 8)}…
              </p>
              {entry.matched_at && (
                <p className="text-[10px] font-mono text-muted-foreground">
                  Matched: {new Date(entry.matched_at).toLocaleDateString()}
                </p>
              )}
            </div>
          )}

          {/* Full Name */}
          <div className="space-y-1.5">
            <Label className="text-xs">Full Name *</Label>
            <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Jane Smith" className="h-9 text-sm" />
            {nameDuplicate && (
              <p className="text-[10px] text-warning flex items-center gap-1">
                <AlertTriangle className="h-2.5 w-2.5" /> Similar name exists in roster
              </p>
            )}
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label className="text-xs">Email</Label>
            <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="jsmith@calpoly.edu" type="email" className="h-9 text-sm" />
            {email && !emailValid && (
              <p className="text-[10px] text-destructive">Invalid email format</p>
            )}
            {emailDuplicate && (
              <p className="text-[10px] text-destructive flex items-center gap-1">
                <AlertTriangle className="h-2.5 w-2.5" /> Email already used by another roster entry
              </p>
            )}
            {!email && (
              <p className="text-[10px] text-muted-foreground">Without email, this entry cannot be invited</p>
            )}
          </div>

          {/* Cohort */}
          <div className="space-y-1.5">
            <Label className="text-xs">Cohort *</Label>
            <Select value={cohort} onValueChange={setCohort}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select cohort" /></SelectTrigger>
              <SelectContent>
                {COHORTS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Role */}
          <div className="space-y-1.5">
            <Label className="text-xs">Role *</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLES.map(r => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <Label className="text-xs">Title (optional)</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. VP Engineering" className="h-9 text-sm" />
          </div>

          {/* Match warning */}
          {showMatchWarning && (
            <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 space-y-2">
              <p className="text-xs text-warning font-medium flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" /> Changing email on matched user
              </p>
              <p className="text-[10px] text-muted-foreground">
                This roster entry is already matched to an auth user. Changing the email won't change their auth email — it only affects future invite matching. Any pending invites to the old email will be expired.
              </p>
              <p className="text-[10px] font-medium">Click Save again to confirm.</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button onClick={handleSave} disabled={!canSave || saving} className="flex-1 gap-1.5" size="sm">
              <Save className="h-3 w-3" />
              {saving ? "Saving…" : isNew ? "Add to Roster" : "Save Changes"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
