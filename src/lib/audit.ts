import { supabase } from "@/integrations/supabase/client";

export async function logAuditAction(
  action: string,
  targetType: string,
  targetId?: string,
  metadata?: Record<string, any>
) {
  try {
    await supabase.from("audit_logs").insert({
      action,
      target_type: targetType,
      target_id: targetId || null,
      metadata: metadata || {},
    });
  } catch {
    // Silent fail — audit logging should never break the app
  }
}
