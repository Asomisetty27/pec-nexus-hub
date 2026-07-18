// send-sms: the SMS transport. A dumb, internal-only sender that other functions
// (ping dispatch, cohort messages, reminders) call, mirroring how
// send-event-notification fans out to send-transactional-email. It reads the
// Twilio credentials from secrets and never contains them.
//
// Secrets required (set via the Lovable agent, NOT in code or the repo):
//   TWILIO_ACCOUNT_SID
//   TWILIO_AUTH_TOKEN
//   TWILIO_MESSAGING_SERVICE_SID   (preferred)  OR  TWILIO_FROM (an E.164 number)
//
// Auth: internal only. Callers must present the service role key as a Bearer
// token (every edge function and the cron already have it); public callers do not.
//
// Body: { "to": "+18055551234", "body": "text", "statusCallback"?: "https://..." }

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// E.164: a leading + and 8-15 digits. We only send to verified numbers, but this
// guards against obviously malformed input reaching Twilio.
const E164 = /^\+[1-9]\d{7,14}$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const auth = req.headers.get("Authorization") || "";
  if (!serviceKey || auth !== `Bearer ${serviceKey}`) {
    return json(401, { error: "unauthorized" });
  }

  const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const token = Deno.env.get("TWILIO_AUTH_TOKEN");
  const messagingServiceSid = Deno.env.get("TWILIO_MESSAGING_SERVICE_SID");
  const from = Deno.env.get("TWILIO_FROM");
  if (!sid || !token || (!messagingServiceSid && !from)) {
    return json(500, { error: "twilio_not_configured" });
  }

  let payload: { to?: string; body?: string; statusCallback?: string };
  try {
    payload = await req.json();
  } catch {
    return json(400, { error: "invalid_json" });
  }

  const to = (payload.to || "").trim();
  const body = (payload.body || "").trim();
  if (!E164.test(to)) return json(400, { error: "invalid_to", detail: "expected E.164, e.g. +18055551234" });
  if (!body) return json(400, { error: "empty_body" });
  // Keep a single message sane; long bodies fan out into billed segments.
  const text = body.slice(0, 1600);

  const form = new URLSearchParams();
  form.set("To", to);
  form.set("Body", text);
  if (messagingServiceSid) form.set("MessagingServiceSid", messagingServiceSid);
  else form.set("From", from!);
  if (payload.statusCallback) form.set("StatusCallback", payload.statusCallback);

  const resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    // Twilio returns { code, message, more_info }; surface it for debugging.
    return json(resp.status, { error: "twilio_error", code: data?.code, message: data?.message });
  }
  return json(200, { ok: true, sid: data?.sid, status: data?.status });
});
