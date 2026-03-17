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
import { Shield, Cpu, Award, User, Mail, GraduationCap, Linkedin, Phone, BookOpen } from "lucide-react";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.2 } } };

export default function Settings() {
  const { profile, roles, highestRole, refreshProfile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [cohort, setCohort] = useState<any>(null);

  useEffect(() => {
    if (!profile) return;
    supabase.from("cohort_memberships").select("*, cohorts(*)").eq("user_id", profile.user_id).limit(1).maybeSingle()
      .then(({ data }) => setCohort(data));
  }, [profile]);

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
    </motion.div>
  );
}
