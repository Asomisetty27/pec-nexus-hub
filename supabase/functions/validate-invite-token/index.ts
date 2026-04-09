import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { token } = await req.json();

    if (!token || typeof token !== "string") {
      return new Response(JSON.stringify({ valid: false, error: "Invite token is required." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: invite, error: inviteError } = await supabase
      .from("invite_tokens")
      .select("id, email, expires_at, used_at")
      .eq("token", token.trim())
      .maybeSingle();

    if (inviteError) {
      throw inviteError;
    }

    if (!invite) {
      return new Response(JSON.stringify({ valid: false, error: "This invite does not exist." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (invite.used_at) {
      return new Response(JSON.stringify({ valid: false, error: "This invite has already been used." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (new Date(invite.expires_at) < new Date()) {
      return new Response(JSON.stringify({ valid: false, error: "This invite has expired." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roster, error: rosterError } = await supabase
      .from("cohort_roster")
      .select("full_name, cohort_name, role, matched_user_id")
      .eq("email", invite.email)
      .maybeSingle();

    if (rosterError) {
      throw rosterError;
    }

    if (roster?.matched_user_id) {
      return new Response(JSON.stringify({ valid: false, error: "This invite has already been accepted." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      valid: true,
      email: invite.email,
      fullName: roster?.full_name ?? "",
      cohortName: roster?.cohort_name ?? "",
      role: roster?.role ?? "",
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("validate-invite-token error:", error);
    return new Response(JSON.stringify({ valid: false, error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});