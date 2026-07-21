import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Shield, Cpu, Award, User, Mail, GraduationCap, Linkedin, Phone, BookOpen, MessageSquare, CheckCircle2, XCircle, AlertTriangle, ExternalLink, Loader2 } from "lucide-react";
import { NotificationPreferences } from "@/components/NotificationPreferences";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.2 } } };

export default function Settings() {
  const { profile, roles, highestRole, refreshProfile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [cohort, setCohort] = useState<any>(null);
  const [msState, setMsState] = useState<{ status: "idle" | "checking" | "connected" | "not_connected" | "blocked" | "error"; detail?: string }>({ status: "idle" });
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwSaving, setPwSaving] = useState(false);

  const changePassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (newPw.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    if (newPw !== confirmPw) { toast.error("Passwords do not match"); return; }
    setPwSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setPwSaving(false);
    if (error) { toast.error(error.message); return; }
    setNewPw(""); setConfirmPw("");
    toast.success("Password updated");
  };

  useEffect(() => {
    if (!profile) return;
    supabase.from("cohort_memberships").select("*, cohorts(*)").eq("user_id", profile.user_id).limit(1).maybeSingle()
      .then(({ data }) => setCohort(data));
  }, [profile]);

  const checkMicrosoft = async () => {
    setMsState({ status: "checking" });
    try {
      const { data, error } = await supabase.functions.invoke("microsoft-status", { body: {} });
      if (error) {
        setMsState({ status: "error", detail: error.message });
        return;
      }
      const d = data as any;
      if (d?.status === "connected") setMsState({ status: "connected", detail: d.account });
      else if (d?.status === "blocked") setMsState({ status: "blocked", detail: d.message });
      else if (d?.status === "not_configured") setMsState({ status: "not_connected", detail: d.message });
      else setMsState({ status: "error", detail: d?.message || "Unknown response" });
    } catch (e: any) {
      setMsState({ status: "error", detail: e.message });
    }
  };

  useEffect(() => { if (profile) checkMicrosoft(); }, [profile]);

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    const f = new FormData(e.currentTarget);
    const { error } = await supabase.from("profiles").update({
      full_name: f.get("full_name") as string,
      bio: f.get("bio") as string,
      major: f.get("major") as string,
      graduation_year: parseInt(f.get("graduation_year") as string) || null,
      linkedin_url: f.get("linkedin_url") as string,
      phone: f.get("phone") as string,
    }).eq("user_id", profile!.user_id);
    if (error) { toast.error(error.message); } else { toast.success("Profile updated"); refreshProfile(); }
    setSaving(false);
  };

  if (!profile) return null;

  const roleLabel = (r: string) => {
    const map: Record<string, string> = {
      superadmin: "Super Admin", admin: "Admin", board_member: "Board",
      project_lead: "Project Lead", project_consultant: "Consultant",
      member: "Member", applicant: "Applicant",
    };
    return map[r] || r;
  };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6 max-w-2xl">
      <motion.div variants={item}>
        <h1 className="font-display text-2xl font-bold">Profile Settings</h1>
        <p className="text-xs text-muted-foreground font-mono">Manage your identity and preferences</p>
      </motion.div>

      {/* Identity card */}
      <motion.div variants={item}>
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-r from-primary/10 to-accent/10 px-6 py-5">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg shrink-0">
                {profile.full_name?.split(" ").map(n => n[0]).join("").slice(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-semibold truncate">{profile.full_name}</h2>
                <p className="text-xs text-muted-foreground">{profile.cal_poly_email}</p>
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  <div className="badge-verified">
                    <Shield className="h-2.5 w-2.5" />
                    <span>{roleLabel(highestRole)}</span>
                  </div>
                  {cohort && (
                    <Badge variant="outline" className="text-[9px] font-mono gap-1">
                      <Cpu className="h-2.5 w-2.5" />
                      {(cohort.cohorts as any)?.name}
                    </Badge>
                  )}
                  {cohort && cohort.role !== "member" && (
                    <Badge variant="secondary" className="text-[9px] font-mono capitalize">{cohort.role}</Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Edit form */}
      <motion.div variants={item}>
        <Card>
          <CardHeader className="py-4 px-6">
            <CardTitle className="text-sm font-sans font-semibold flex items-center gap-2">
              <User className="h-3.5 w-3.5 text-accent-foreground" /> Profile Information
            </CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-xs flex items-center gap-1.5"><User className="h-3 w-3 text-muted-foreground" />Full Name</Label>
                  <Input name="full_name" defaultValue={profile.full_name} required />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs flex items-center gap-1.5"><Mail className="h-3 w-3 text-muted-foreground" />Email</Label>
                  <Input value={profile.cal_poly_email || ""} disabled className="opacity-60" />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-xs flex items-center gap-1.5"><GraduationCap className="h-3 w-3 text-muted-foreground" />Major</Label>
                  <Input name="major" defaultValue={profile.major || ""} placeholder="e.g. Mechanical Engineering" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs flex items-center gap-1.5"><BookOpen className="h-3 w-3 text-muted-foreground" />Graduation Year</Label>
                  <Input name="graduation_year" type="number" defaultValue={profile.graduation_year || ""} placeholder="2026" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Bio</Label>
                <Textarea name="bio" defaultValue={profile.bio || ""} rows={3} placeholder="Tell us about yourself..." />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-xs flex items-center gap-1.5"><Linkedin className="h-3 w-3 text-muted-foreground" />LinkedIn</Label>
                  <Input name="linkedin_url" defaultValue={profile.linkedin_url || ""} placeholder="https://linkedin.com/in/..." />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs flex items-center gap-1.5"><Phone className="h-3 w-3 text-muted-foreground" />Phone</Label>
                  <Input name="phone" defaultValue={profile.phone || ""} placeholder="(805) 555-0123" />
                </div>
              </div>
              <Separator />
              <Button type="submit" disabled={saving} className="w-full sm:w-auto">
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>

      {/* Roles & Permissions */}
      <motion.div variants={item}>
        <Card>
          <CardHeader className="py-4 px-6">
            <CardTitle className="text-sm font-sans font-semibold flex items-center gap-2">
              <Shield className="h-3.5 w-3.5 text-accent-foreground" /> Roles & Permissions
            </CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="flex gap-2 flex-wrap">
              {roles.map((r, i) => (
                <Badge key={i} variant="outline" className="text-xs font-mono capitalize">{roleLabel(r)}</Badge>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-3">
              Roles are assigned by admins and determined by your cohort membership.
            </p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Change password */}
      <motion.div variants={item}>
        <Card>
          <CardHeader className="py-4 px-6">
            <CardTitle className="text-sm font-sans font-semibold flex items-center gap-2">
              <Shield className="h-3.5 w-3.5 text-accent-foreground" /> Password
            </CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <form onSubmit={changePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPw">New password</Label>
                <Input id="newPw" type="password" autoComplete="new-password" placeholder="••••••••" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPw">Confirm new password</Label>
                <Input id="confirmPw" type="password" autoComplete="new-password" placeholder="••••••••" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} />
              </div>
              <Button type="submit" disabled={pwSaving || !newPw || !confirmPw}>
                {pwSaving ? "Updating..." : "Update password"}
              </Button>
              <p className="text-[11px] text-muted-foreground">At least 8 characters. You stay signed in after changing it.</p>
            </form>
          </CardContent>
        </Card>
      </motion.div>

      {/* Microsoft 365 / Teams integration */}
      <motion.div variants={item}>
        <Card>
          <CardHeader className="py-4 px-6">
            <CardTitle className="text-sm font-sans font-semibold flex items-center gap-2">
              <MessageSquare className="h-3.5 w-3.5 text-accent-foreground" /> Microsoft 365 / Teams
            </CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6 space-y-3">
            <div className="flex items-start gap-3 rounded-md border border-border bg-muted/20 p-3">
              {msState.status === "checking" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mt-0.5" />}
              {msState.status === "connected" && <CheckCircle2 className="h-4 w-4 text-success mt-0.5" />}
              {msState.status === "not_connected" && <XCircle className="h-4 w-4 text-muted-foreground mt-0.5" />}
              {msState.status === "blocked" && <AlertTriangle className="h-4 w-4 text-warning mt-0.5" />}
              {msState.status === "error" && <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium">
                  {msState.status === "checking" && "Checking connection…"}
                  {msState.status === "connected" && "Connected"}
                  {msState.status === "not_connected" && "Not connected"}
                  {msState.status === "blocked" && "Tenant restricted"}
                  {msState.status === "error" && "Connection error"}
                  {msState.status === "idle" && "Status unknown"}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5 break-words">
                  {msState.detail || (msState.status === "not_connected"
                    ? "Connect a Microsoft 365 account to attach Teams meeting context to events. Nexus messaging keeps working either way."
                    : "")}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={checkMicrosoft} disabled={msState.status === "checking"} className="text-xs">
                Recheck
              </Button>
            </div>

            <div className="rounded-md border border-dashed border-border p-3 space-y-2">
              <p className="text-xs font-medium">How this works honestly</p>
              <ul className="text-[11px] text-muted-foreground space-y-1 list-disc pl-4">
                <li>Nexus messaging is the system of record. Microsoft integration layers on top — never replaces it.</li>
                <li>If your Cal Poly tenant blocks third-party Microsoft Graph apps, you'll see "Tenant restricted" — Nexus features keep working.</li>
                <li>Teams meeting links you paste on events are surfaced as "Open in Teams" buttons regardless of integration state.</li>
              </ul>
              <a href="https://teams.microsoft.com" target="_blank" rel="noreferrer"
                 className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline mt-1">
                Open Teams <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            <p className="text-[10px] text-muted-foreground">
              Full per-user Microsoft OAuth requires Cal Poly tenant admin approval. We do not claim Teams delivery succeeded unless it actually did.
            </p>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={item}>
        <NotificationPreferences />
      </motion.div>
    </motion.div>
  );
}
