import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";
const APP_URL = "https://pec-nexus-hub.lovable.app";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY not configured", code: "CONFIG_ERROR" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY not configured", code: "CONFIG_ERROR" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized", code: "AUTH_ERROR" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized", code: "AUTH_ERROR" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isAdmin } = await supabaseUser.rpc("is_admin", { _user_id: user.id });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin access required", code: "AUTH_ERROR" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { email, token, fullName, tokenId } = body;

    if (!email || !token) {
      return new Response(JSON.stringify({ error: "email and token required", code: "VALIDATION_ERROR" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const inviteLink = `${APP_URL}/invite/${token}`;

    const emailHtml = `
      <div style="font-family: 'Inter', Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 24px; background: #0a0a0f; color: #e4e4e7;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="font-size: 20px; font-weight: 700; color: #ffffff; margin: 0;">PEC Nexus</h1>
          <p style="font-size: 11px; letter-spacing: 2px; color: #71717a; margin-top: 4px; text-transform: uppercase;">Poly-Engineering Consulting</p>
        </div>
        <div style="background: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 32px 24px;">
          <h2 style="font-size: 18px; font-weight: 600; color: #ffffff; margin: 0 0 16px;">You're Invited</h2>
          <p style="font-size: 14px; line-height: 1.6; color: #a1a1aa; margin: 0 0 8px;">
            ${fullName ? `Hi ${fullName},` : "Hi,"}
          </p>
          <p style="font-size: 14px; line-height: 1.6; color: #a1a1aa; margin: 0 0 24px;">
            You've been invited to join PEC Nexus — the operating system for Poly-Engineering Consulting at Cal Poly SLO.
          </p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${inviteLink}" style="display: inline-block; background: #6d28d9; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-size: 14px; font-weight: 600;">
              Accept Invitation
            </a>
          </div>
          <p style="font-size: 12px; color: #71717a; margin: 24px 0 0; padding-top: 16px; border-top: 1px solid #27272a;">
            Use your <strong style="color: #a1a1aa;">Cal Poly email (@calpoly.edu)</strong> when signing up to ensure your account is properly matched.
          </p>
          <p style="font-size: 11px; color: #52525b; margin: 12px 0 0;">
            This invite expires in 7 days. If you didn't expect this, you can safely ignore it.
          </p>
        </div>
        <p style="font-size: 10px; color: #3f3f46; text-align: center; margin-top: 24px;">
          PEC Nexus · Cal Poly San Luis Obispo
        </p>
      </div>
    `;

    console.log(`[send-invite-email] Attempting send to: ${email}, token: ${token.substring(0, 8)}...`);

    let providerStatus: number | null = null;
    let providerMessageId: string | null = null;
    let providerError: string | null = null;

    try {
      const response = await fetch(`${GATEWAY_URL}/emails`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": RESEND_API_KEY,
        },
        body: JSON.stringify({
          from: "PEC Nexus <invites@blinn.pro>",
          to: [email],
          subject: "You're invited to PEC Nexus",
          html: emailHtml,
        }),
      });

      providerStatus = response.status;
      const result = await response.json();

      if (!response.ok) {
        providerError = JSON.stringify(result);
        console.error(`[send-invite-email] Resend API error: ${providerStatus}`, providerError);

        // Update invite token status to failed
        if (tokenId) {
          await supabaseAdmin.from("invite_tokens").update({
            email_status: "failed",
            email_error: providerError,
            email_sent_at: new Date().toISOString(),
          }).eq("id", tokenId);
        }

        return new Response(
          JSON.stringify({
            error: "Email delivery failed",
            code: "PROVIDER_ERROR",
            providerStatus,
            providerError: result,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      providerMessageId = result.id || null;
      console.log(`[send-invite-email] Success: ${email}, messageId: ${providerMessageId}`);

      // Update invite token status to sent
      if (tokenId) {
        await supabaseAdmin.from("invite_tokens").update({
          email_status: "sent",
          email_provider_id: providerMessageId,
          email_sent_at: new Date().toISOString(),
          email_error: null,
        }).eq("id", tokenId);
      }

      return new Response(
        JSON.stringify({ success: true, messageId: providerMessageId }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } catch (fetchErr) {
      providerError = fetchErr instanceof Error ? fetchErr.message : "Network error";
      console.error(`[send-invite-email] Fetch error:`, providerError);

      if (tokenId) {
        await supabaseAdmin.from("invite_tokens").update({
          email_status: "failed",
          email_error: providerError,
          email_sent_at: new Date().toISOString(),
        }).eq("id", tokenId);
      }

      return new Response(
        JSON.stringify({ error: providerError, code: "NETWORK_ERROR" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (err) {
    console.error("[send-invite-email] Unhandled error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error", code: "INTERNAL_ERROR" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
