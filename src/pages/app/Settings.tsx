import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function Settings() {
  const { profile, refreshProfile } = useAuth();
  const [saving, setSaving] = useState(false);

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

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="font-display text-2xl font-bold">Profile Settings</h1>
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Full Name</Label><Input name="full_name" defaultValue={profile.full_name} required /></div>
              <div className="space-y-2"><Label>Email</Label><Input value={profile.cal_poly_email || ""} disabled /></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Major</Label><Input name="major" defaultValue={profile.major || ""} /></div>
              <div className="space-y-2"><Label>Graduation Year</Label><Input name="graduation_year" type="number" defaultValue={profile.graduation_year || ""} /></div>
            </div>
            <div className="space-y-2"><Label>Bio</Label><Textarea name="bio" defaultValue={profile.bio} rows={3} /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>LinkedIn URL</Label><Input name="linkedin_url" defaultValue={profile.linkedin_url || ""} /></div>
              <div className="space-y-2"><Label>Phone</Label><Input name="phone" defaultValue={profile.phone || ""} /></div>
            </div>
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
