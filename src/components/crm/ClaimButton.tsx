import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Hand } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { logAuditAction } from "@/lib/audit";

export function ClaimButton({
  organizationId,
  unowned,
  onClaimed,
  size = "sm",
  variant = "outline",
}: {
  organizationId: string;
  unowned: boolean;
  onClaimed?: () => void;
  size?: "sm" | "default";
  variant?: "outline" | "default" | "ghost";
}) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  if (!unowned || !user) return null;

  const claim = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setBusy(true);
    // Re-check ownership server-side to avoid race claims
    const { data: cur } = await supabase
      .from("organizations")
      .select("owner_user_id, secondary_owner_user_id, overseeing_lead_user_id")
      .eq("id", organizationId)
      .maybeSingle();
    if (cur && (cur.owner_user_id || cur.secondary_owner_user_id || cur.overseeing_lead_user_id)) {
      toast.error("Someone else just claimed this company.");
      setBusy(false);
      onClaimed?.();
      return;
    }
    const { error } = await supabase
      .from("organizations")
      .update({ owner_user_id: user.id })
      .eq("id", organizationId)
      .is("owner_user_id", null);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Claimed");
    logAuditAction("crm.claimed", "organization", organizationId, {});
    onClaimed?.();
  };

  return (
    <Button size={size} variant={variant} className="gap-1.5" onClick={claim} disabled={busy}>
      <Hand className="h-3 w-3" /> {busy ? "Claiming…" : "Claim"}
    </Button>
  );
}
