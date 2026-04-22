import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

type State = "loading" | "valid" | "already" | "invalid" | "done" | "error";

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [state, setState] = useState<State>("loading");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) { setState("invalid"); return; }
    (async () => {
      try {
        const r = await fetch(`${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`, {
          headers: { apikey: SUPABASE_ANON },
        });
        const j = await r.json();
        if (j.valid === true) setState("valid");
        else if (j.reason === "already_unsubscribed") setState("already");
        else setState("invalid");
      } catch {
        setState("error");
      }
    })();
  }, [token]);

  const confirm = async () => {
    if (!token) return;
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", { body: { token } });
    setSubmitting(false);
    if (error) { setState("error"); return; }
    if ((data as any)?.success) setState("done");
    else if ((data as any)?.reason === "already_unsubscribed") setState("already");
    else setState("error");
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-16">
      <Card className="w-full max-w-md">
        <CardContent className="p-8 text-center space-y-4">
          {state === "loading" && (
            <><Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" /><p className="text-sm text-muted-foreground">Checking your link…</p></>
          )}
          {state === "valid" && (
            <>
              <h1 className="font-display text-xl font-semibold">Unsubscribe from PEC Nexus emails</h1>
              <p className="text-sm text-muted-foreground">You'll stop receiving non-essential notifications. You can re-enable in your Nexus settings later.</p>
              <Button onClick={confirm} disabled={submitting} className="w-full">{submitting ? "Working…" : "Confirm unsubscribe"}</Button>
            </>
          )}
          {state === "done" && (
            <><CheckCircle2 className="mx-auto h-10 w-10 text-success" /><h1 className="font-display text-xl font-semibold">You're unsubscribed</h1><p className="text-sm text-muted-foreground">We won't send you further notifications.</p></>
          )}
          {state === "already" && (
            <><CheckCircle2 className="mx-auto h-10 w-10 text-success" /><h1 className="font-display text-xl font-semibold">Already unsubscribed</h1><p className="text-sm text-muted-foreground">This address is already opted out.</p></>
          )}
          {state === "invalid" && (
            <><AlertTriangle className="mx-auto h-10 w-10 text-warning" /><h1 className="font-display text-xl font-semibold">Invalid or expired link</h1><p className="text-sm text-muted-foreground">Please use the most recent email we sent you.</p></>
          )}
          {state === "error" && (
            <><AlertTriangle className="mx-auto h-10 w-10 text-destructive" /><h1 className="font-display text-xl font-semibold">Something went wrong</h1><p className="text-sm text-muted-foreground">Please try again in a moment.</p></>
          )}
        </CardContent>
      </Card>
    </div>
  );
}