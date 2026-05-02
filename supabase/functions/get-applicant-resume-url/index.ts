import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

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

/**
 * Returns a short-lived signed URL for an applicant's resume.
 *
 * Authorization + audit logging is enforced by the SQL RPC
 * `get_resume_signed_url`, invoked under the *caller's* JWT. That RPC
 * returns the storage path; signing then happens here under service
 * role because the bucket blocks all authenticated SELECTs by policy.
 *
 * Bucket remains private. URL TTL: 300s.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method not allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return json(401, { error: "unauthorized" });
  }

  let body: { applicant_id?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "invalid json" });
  }
  const applicantId = body.applicant_id;
  if (!applicantId || typeof applicantId !== "string" || applicantId.length < 8) {
    return json(400, { error: "applicant_id required" });
  }

  // 1. Authorize + audit under the caller's JWT.
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: pathData, error: pathErr } = await userClient.rpc("get_resume_signed_url", {
    _applicant_id: applicantId,
    _expires_in_seconds: 300,
  });
  if (pathErr) return json(403, { error: pathErr.message });
  const path = typeof pathData === "string" ? pathData : null;
  if (!path) return json(404, { error: "resume not found" });

  // 2. Sign with service role (bucket is private; SELECT is blocked
  //    for authenticated role by policy).
  const admin = createClient(supabaseUrl, serviceKey);
  const { data: signed, error: signErr } = await admin.storage
    .from("applicant-resumes")
    .createSignedUrl(path, 300);
  if (signErr || !signed?.signedUrl) {
    return json(500, { error: signErr?.message ?? "could not sign url" });
  }

  return json(200, { url: signed.signedUrl, expires_in: 300 });
});