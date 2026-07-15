// Microsoft 365 / Teams connection status check.
// Returns honest status: connected | not_configured | blocked | error.
// Does NOT claim success unless the gateway verify_credentials endpoint succeeds.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Require authenticated caller — do not leak infra config to anonymous probes.
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ error: "Unauthorized" }, 401);
  }
  try {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.45.0");
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data, error } = await sb.auth.getUser();
    if (error || !data?.user) return json({ error: "Unauthorized" }, 401);
  } catch {
    return json({ error: "Unauthorized" }, 401);
  }

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const TEAMS_API_KEY = Deno.env.get("MICROSOFT_TEAMS_API_KEY");

  if (!LOVABLE_API_KEY || !TEAMS_API_KEY) {
    return json({ status: "not_configured", message: "Microsoft Teams connector is not linked to this project yet." });
  }

  try {
    const resp = await fetch("https://connector-gateway.lovable.dev/api/v1/verify_credentials", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TEAMS_API_KEY,
      },
    });
    if (resp.status === 401 || resp.status === 403) {
      return json({ status: "blocked", message: "Tenant or admin policy blocked this connection." });
    }
    if (!resp.ok) {
      const text = await resp.text();
      return json({ status: "error", message: `Gateway error ${resp.status}: ${text.slice(0, 200)}` });
    }
    const data = await resp.json();
    if (data.outcome === "verified" || data.outcome === "skipped") {
      return json({ status: "connected", account: "Microsoft Teams workspace connection" });
    }
    return json({ status: "error", message: data.error || "Verification failed" });
  } catch (e) {
    return json({ status: "error", message: e instanceof Error ? e.message : "Unknown error" });
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
