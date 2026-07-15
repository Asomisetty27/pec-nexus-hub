import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, CheckCircle2, Save, UserPlus, Shield } from "lucide-react";
import { toast } from "sonner";

const COHORTS = [
  "Business & Marketing",
  "Hardware & Embedded Delivery",
  "Mechanical & Manufacturing Delivery",
  "Software & AI Delivery",
] as const;

const ROLES = ["member", "pm", "lead", "integration_lead"] as const;

const ROLE_LABELS: Record<(typeof ROLES)[number], string> = {
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
  entry: RosterEntry | null;
  allEntries: RosterEntry[];
  onSaved: () => void;
}

interface FormState {
  fullName: string;
  email: string;
  cohort: string;
  role: string;
  title: string;
}

const DEFAULT_FORM: FormState = {
  fullName: "",
  email: "",
  cohort: "",
  role: "member",
  title: "",
};

function normalizeEmail(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function normalizeName(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default function RosterEditSheet({ open, onOpenChange, entry, allEntries, onSaved }: RosterEditSheetProps) {
  const { user } = useAuth();
  const isNew = !entry;

  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [showMatchWarning, setShowMatchWarning] = useState(false);

  useEffect(() => {
    if (!open) return;

    if (entry) {
      setForm({
        fullName: entry.full_name ?? "",
        email: entry.email ?? "",
        cohort: entry.cohort_name ?? "",
        role: entry.role ?? "member",
        title: entry.title ?? "",
      });
    } else {
      setForm(DEFAULT_FORM);
    }

    setShowMatchWarning(false);
  }, [entry, open]);

  const trimmedFullName = form.fullName.trim();
  const normalizedFullName = useMemo(() => normalizeName(form.fullName), [form.fullName]);
  const trimmedEmail = form.email.trim();
  const normalizedEmail = useMemo(() => normalizeEmail(form.email), [form.email]);
  const trimmedTitle = form.title.trim();

  const originalEmailNormalized = normalizeEmail(entry?.email);
  const emailValid = !trimmedEmail || isValidEmail(trimmedEmail);

  const emailDuplicate = useMemo(() => {
    if (!normalizedEmail) return false;

    return allEntries.some((rosterEntry) => {
      if (rosterEntry.id === entry?.id) return false;
      return normalizeEmail(rosterEntry.email) === normalizedEmail;
    });
  }, [allEntries, entry?.id, normalizedEmail]);

  const nameDuplicate = useMemo(() => {
    if (!normalizedFullName) return false;

    return allEntries.some((rosterEntry) => {
      if (rosterEntry.id === entry?.id) return false;
      return normalizeName(rosterEntry.full_name) === normalizedFullName;
    });
  }, [allEntries, entry?.id, normalizedFullName]);

  const matchedUserEmailChanging = Boolean(entry?.matched_user_id) && normalizedEmail !== originalEmailNormalized;

  const canSave =
    Boolean(trimmedFullName) && Boolean(form.cohort) && Boolean(form.role) && emailValid && !emailDuplicate && !saving;

  const resetAndClose = () => {
    setShowMatchWarning(false);
    setForm(DEFAULT_FORM);
    onOpenChange(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      resetAndClose();
      return;
    }
    onOpenChange(true);
  };

  const handleFieldChange = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));

    if (field === "email" && showMatchWarning) {
      setShowMatchWarning(false);
    }
  };

  const handleSave = async () => {
    if (!canSave) return;

    if (!user?.id) {
      toast.error("You must be signed in to make roster changes.");
      return;
    }

    if (matchedUserEmailChanging && !showMatchWarning) {
      setShowMatchWarning(true);
      return;
    }

    setSaving(true);

    const payload = {
      full_name: trimmedFullName,
      email: trimmedEmail || null,
      cohort_name: form.cohort,
      role: form.role,
      title: trimmedTitle || null,
    };

    try {
      if (isNew) {
        const { error: insertError } = await supabase.from("cohort_roster").insert(payload);

        if (insertError) {
          throw insertError;
        }

        const { error: auditError } = await supabase.from("audit_logs").insert({
          action: "roster_entry_created",
          target_type: "cohort_roster",
          user_id: user.id,
          metadata: {
            full_name: payload.full_name,
            email: payload.email,
            cohort_name: payload.cohort_name,
            role: payload.role,
            title: payload.title,
          },
        });

        if (auditError) {
          console.error("Audit log insert failed after roster create:", auditError);
          toast.warning("Roster entry created, but audit log failed to write.");
        } else {
          toast.success(`Added ${payload.full_name} to roster`);
        }
      } else {
        if (entry.email && normalizedEmail && originalEmailNormalized !== normalizedEmail) {
          const { data: oldTokens, error: oldTokensError } = await supabase
            .from("invite_tokens")
            .select("id")
            .eq("email", entry.email)
            .is("used_at", null);

          if (oldTokensError) {
            throw oldTokensError;
          }

          if (oldTokens?.length) {
            const { error: expireError } = await supabase
              .from("invite_tokens")
              .update({ expires_at: new Date().toISOString() } as never)
              .in(
                "id",
                oldTokens.map((token) => token.id),
              );

            if (expireError) {
              throw expireError;
            }

            toast.info("Previous invite tokens expired due to email change.");
          }
        }

        const { error: updateError } = await supabase.from("cohort_roster").update(payload).eq("id", entry.id);

        if (updateError) {
          throw updateError;
        }

        const { error: auditError } = await supabase.from("audit_logs").insert({
          action: "roster_entry_updated",
          target_type: "cohort_roster",
          target_id: entry.id,
          user_id: user.id,
          metadata: {
            previous: {
              full_name: entry.full_name,
              email: entry.email,
              cohort_name: entry.cohort_name,
              role: entry.role,
              title: entry.title,
            },
            next: payload,
          },
        });

        if (auditError) {
          console.error("Audit log insert failed after roster update:", auditError);
          toast.warning("Roster entry updated, but audit log failed to write.");
        } else {
          toast.success(`Updated ${payload.full_name}`);
        }
      }

      setShowMatchWarning(false);
      onOpenChange(false);
      onSaved();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Something went wrong while saving.";
      toast.error(message);
      console.error("Failed to save roster entry:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 font-display">
            {isNew ? <UserPlus className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
            {isNew ? "New Roster Entry" : "Edit Roster Entry"}
          </SheetTitle>
          <SheetDescription className="font-mono text-[10px]">
            {isNew ? "Add a new expected member to the roster" : `Editing: ${entry?.full_name}`}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {entry?.matched_user_id && (
            <div className="space-y-1 rounded-lg border border-success/30 bg-success/5 p-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-success">
                <CheckCircle2 className="h-3 w-3" />
                Matched to auth user
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

          <div className="space-y-1.5">
            <Label className="text-xs" htmlFor="roster-full-name">
              Full Name *
            </Label>
            <Input
              id="roster-full-name"
              value={form.fullName}
              onChange={(e) => handleFieldChange("fullName", e.target.value)}
              placeholder="Jane Smith"
              className="h-9 text-sm"
              autoComplete="name"
            />
            {nameDuplicate && (
              <p className="flex items-center gap-1 text-[10px] text-warning">
                <AlertTriangle className="h-2.5 w-2.5" />
                Similar name exists in roster
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs" htmlFor="roster-email">
              Email
            </Label>
            <Input
              id="roster-email"
              value={form.email}
              onChange={(e) => handleFieldChange("email", e.target.value)}
              placeholder="jsmith@calpoly.edu"
              type="email"
              className="h-9 text-sm"
              autoComplete="email"
              inputMode="email"
            />
            {trimmedEmail && !emailValid && <p className="text-[10px] text-destructive">Invalid email format</p>}
            {emailDuplicate && (
              <p className="flex items-center gap-1 text-[10px] text-destructive">
                <AlertTriangle className="h-2.5 w-2.5" />
                Email already used by another roster entry
              </p>
            )}
            {!trimmedEmail && (
              <p className="text-[10px] text-muted-foreground">Without email, this entry cannot be invited</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Cohort *</Label>
            <Select value={form.cohort} onValueChange={(value) => handleFieldChange("cohort", value)}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Select cohort" />
              </SelectTrigger>
              <SelectContent>
                {COHORTS.map((cohort) => (
                  <SelectItem key={cohort} value={cohort}>
                    {cohort}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Role *</Label>
            <Select value={form.role} onValueChange={(value) => handleFieldChange("role", value)}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((roleOption) => (
                  <SelectItem key={roleOption} value={roleOption}>
                    {ROLE_LABELS[roleOption]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs" htmlFor="roster-title">
              Title (optional)
            </Label>
            <Input
              id="roster-title"
              value={form.title}
              onChange={(e) => handleFieldChange("title", e.target.value)}
              placeholder="e.g. VP Engineering"
              className="h-9 text-sm"
            />
          </div>

          {showMatchWarning && (
            <div className="space-y-2 rounded-lg border border-warning/40 bg-warning/10 p-3">
              <p className="flex items-center gap-1.5 text-xs font-medium text-warning">
                <AlertTriangle className="h-3.5 w-3.5" />
                Changing email on matched user
              </p>
              <p className="text-[10px] text-muted-foreground">
                This roster entry is already matched to an auth user. Changing the email will not update their
                authentication email. It only affects future invite matching. Any pending invites to the old email will
                be expired.
              </p>
              <p className="text-[10px] font-medium">Click Save again to confirm.</p>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button onClick={handleSave} disabled={!canSave} className="flex-1 gap-1.5" size="sm">
              <Save className="h-3 w-3" />
              {saving ? "Saving…" : isNew ? "Add to Roster" : "Save Changes"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
