// Run-logging helpers for contract_monitor_runs.
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export type RunType = "weekly_scan" | "manual_scan" | "enrichment_refresh";
export type RunStatus = "running" | "succeeded" | "failed" | "partial";

export interface RunSummary {
  scanned_count?: number;
  relevant_count?: number;
  inserted_count?: number;
  updated_count?: number;
  duplicate_skipped_count?: number;
  confirmed_awardee_count?: number;
  likely_bidder_count?: number;
  unconfirmed_count?: number;
  enrichment_success_count?: number;
  enrichment_failure_count?: number;
  errors?: Array<{ stage: string; message: string; context?: unknown }>;
  notes?: string[];
  [k: string]: unknown;
}

export function adminClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

export async function startRun(
  client: SupabaseClient,
  runType: RunType,
  createdBy: string | null,
): Promise<string> {
  const { data, error } = await client
    .from("contract_monitor_runs")
    .insert({ run_type: runType, status: "running", created_by: createdBy, summary: {} })
    .select("id")
    .single();
  if (error) throw new Error(`startRun failed: ${error.message}`);
  return data.id as string;
}

export async function finishRun(
  client: SupabaseClient,
  runId: string,
  status: RunStatus,
  summary: RunSummary,
  errorLog?: string,
): Promise<void> {
  await client
    .from("contract_monitor_runs")
    .update({
      status,
      summary,
      error_log: errorLog ?? null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", runId);
}

// Verify caller is CRM leadership using the user's JWT. Returns user_id or null.
export async function requireLeadership(req: Request): Promise<{ userId: string | null; error?: string }> {
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return { userId: null, error: "missing bearer token" };
  // Service-role token (used by Inngest scheduler / cross-function fanout) bypasses the user check.
  const token = auth.slice("Bearer ".length).trim();
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (serviceKey && token === serviceKey) return { userId: null };
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: auth } } },
  );
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  const uid = userData?.user?.id ?? null;
  if (!uid) return { userId: null, error: userErr?.message ?? "invalid token" };
  const admin = adminClient();
  const { data, error } = await admin.rpc("is_crm_leadership", { _uid: uid });
  if (error) return { userId: uid, error: error.message };
  if (!data) return { userId: uid, error: "not_leadership" };
  return { userId: uid };
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
