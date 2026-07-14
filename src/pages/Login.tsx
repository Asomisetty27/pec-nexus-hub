import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Loader2, MailCheck, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface InviteState {
  loading: boolean;
  valid: boolean;
  email: string;
  fullName: string;
  cohortName: string;
  role: string;
  message: string;
}

export default function Login() {
  const { token } = useParams();
  const inviteMode = Boolean(token);
  const [isSignUp, setIsSignUp] = useState(Boolean(token));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [invite, setInvite] = useState<InviteState>({
    loading: inviteMode,
    valid: !inviteMode,
    email: "",
    fullName: "",
    cohortName: "",
    role: "",
    message: "",
  });
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    setIsSignUp(true);

    const loadInvite = async () => {
      setInvite((current) => ({ ...current, loading: true, message: "" }));

      const { data, error } = await supabase.functions.invoke("validate-invite-token", {
        body: { token },
      });

      if (cancelled) return;

      if (error || data?.valid === false) {
        setInvite({
          loading: false,
          valid: false,
          email: data?.email ?? "",
          fullName: "",
          cohortName: "",
          role: "",
          message: data?.error || error?.message || "This invite is invalid or has expired.",
        });
        return;
      }

      setEmail(data.email ?? "");
      setFullName((current) => current || data.fullName || "");
      setInvite({
        loading: false,
        valid: true,
        email: data.email ?? "",
        fullName: data.fullName ?? "",
        cohortName: data.cohortName ?? "",
        role: data.role ?? "",
        message: "",
      });
    };

    loadInvite();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (isSignUp) {
      if (inviteMode) {
        if (invite.loading) {
          toast.error("Checking your invite. Please wait a moment.");
          setLoading(false);
          return;
        }

        if (!invite.valid) {
          toast.error(invite.message || "This invite is no longer valid.");
          setLoading(false);
          return;
        }

        if (email.trim().toLowerCase() !== invite.email.toLowerCase()) {
          toast.error(`Use the invited email: ${invite.email}`);
          setLoading(false);
          return;
        }
      } else if (!email.endsWith("@calpoly.edu")) {
        toast.error("Please use your Cal Poly email (@calpoly.edu)");
        setLoading(false);
        return;
      }

      if (password.length < 8) {
        toast.error("Password must be at least 8 characters");
        setLoading(false);
        return;
      }

      const { error } = await signUp(email, password, fullName);
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Check your email to verify your account");
        if (inviteMode) navigate("/login");
      }
    } else {
      const { error } = await signIn(email, password);
      if (error) {
        toast.error(error.message);
      } else {
        navigate("/app");
      }
    }
    setLoading(false);
  };

  const showInviteError = inviteMode && isSignUp && !invite.loading && !invite.valid;
  const disableSubmit = loading || (inviteMode && isSignUp && (invite.loading || !invite.valid));

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
            <h1 className="font-display text-2xl font-semibold leading-none tracking-tight">
              {inviteMode && isSignUp ? "Accept Invitation" : isSignUp ? "Create Account" : "Welcome Back"}
            </h1>
            <CardDescription>
              {inviteMode && isSignUp
                ? "Finish your PEC Nexus signup with the invited email address"
                : isSignUp
                ? "Sign up with your Cal Poly email (@calpoly.edu)"
                : "Sign in to your PEC Nexus account"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {inviteMode && isSignUp && (
              <div className={`mb-4 rounded-lg border p-3 text-left ${showInviteError ? "border-destructive/30 bg-destructive/5" : "border-accent/20 bg-accent/5"}`}>
                <div className="flex items-start gap-2">
                  {showInviteError ? (
                    <ShieldAlert className="mt-0.5 h-4 w-4 text-destructive" />
                  ) : (
                    <MailCheck className="mt-0.5 h-4 w-4 text-accent" />
                  )}
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      {invite.loading ? "Checking your invite…" : showInviteError ? "Invite unavailable" : invite.email}
                    </p>
                    {!invite.loading && !showInviteError && (
                      <p className="text-xs text-muted-foreground">
                        {invite.cohortName}
                        {invite.role ? ` · ${invite.role.replace(/_/g, " ")}` : ""}
                      </p>
                    )}
                    {showInviteError && <p className="text-xs text-muted-foreground">{invite.message}</p>}
                  </div>
                </div>
              </div>
            )}

            {showInviteError ? (
              <div className="space-y-3">
                <Button asChild className="w-full">
                  <Link to="/login">Go to sign in</Link>
                </Button>
                <p className="text-center text-sm text-muted-foreground">Need a new invite? Contact an admin.</p>
              </div>
            ) : (
              <form className="space-y-4" onSubmit={handleSubmit}>
                {isSignUp && (
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name</Label>
                    <Input id="fullName" placeholder="Jane Smith" required value={fullName} onChange={e => setFullName(e.target.value)} />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="jsmith@calpoly.edu"
                    required
                    value={email}
                    disabled={inviteMode && isSignUp && invite.valid}
                    onChange={e => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" placeholder="••••••••" required value={password} onChange={e => setPassword(e.target.value)} />
                </div>
                <Button type="submit" className="w-full" disabled={disableSubmit}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isSignUp ? "Create Account" : "Sign In"}
                </Button>
              </form>
            )}
            <div className="mt-4 text-center text-sm text-muted-foreground">
              {inviteMode ? (
                <>Already have an account?{" "}<Link to="/login" className="text-accent underline-offset-4 hover:underline">Sign in</Link></>
              ) : isSignUp ? (
                <>Already have an account?{" "}<button onClick={() => setIsSignUp(false)} className="text-accent underline-offset-4 hover:underline">Sign in</button></>
              ) : (
                <>Don't have an account?{" "}<button onClick={() => setIsSignUp(true)} className="text-accent underline-offset-4 hover:underline">Sign up</button></>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
