import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card";

// Landing page for the password-recovery email link. Supabase auto-detects the
// recovery token in the URL and establishes a temporary session, after which
// updateUser({ password }) sets the new password.
export default function ResetPassword() {
  const [ready, setReady] = useState<"checking" | "ok" | "no-session">("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) setReady("ok");
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setReady((r) => (r === "ok" ? r : session ? "ok" : "no-session"));
    });
    return () => subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    if (password !== confirm) { toast.error("Passwords do not match"); return; }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Password updated. You're signed in.");
    navigate("/app");
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center py-12">
      <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md px-4">
        <div className="mb-8 text-center">
          <Link to="/" className="inline-flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <span className="font-display text-xl font-bold text-primary-foreground">P</span>
            </div>
          </Link>
        </div>
        <Card>
          <CardHeader className="text-center">
            <h1 className="font-display text-2xl font-semibold leading-none tracking-tight">Set a new password</h1>
            <CardDescription>Choose a new password for your PEC Nexus account</CardDescription>
          </CardHeader>
          <CardContent>
            {ready === "checking" && (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying your reset link…
              </div>
            )}
            {ready === "no-session" && (
              <div className="space-y-4 text-center">
                <p className="text-sm text-muted-foreground">
                  This reset link is invalid or has expired. Request a new one from the sign-in page.
                </p>
                <Button asChild className="w-full"><Link to="/login">Back to sign in</Link></Button>
              </div>
            )}
            {ready === "ok" && (
              <form className="space-y-4" onSubmit={submit}>
                <div className="space-y-2">
                  <Label htmlFor="password">New password</Label>
                  <Input id="password" type="password" autoComplete="new-password" placeholder="••••••••" required value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm">Confirm new password</Label>
                  <Input id="confirm" type="password" autoComplete="new-password" placeholder="••••••••" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
                </div>
                <Button type="submit" className="w-full" disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Update password
                </Button>
                <p className="text-center text-[11px] text-muted-foreground">At least 8 characters.</p>
              </form>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
