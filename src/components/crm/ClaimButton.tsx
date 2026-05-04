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
    if (busy) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("crm_claim_organization", { _org_id: organizationId });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const result = data as { ok: boolean; reason?: string } | null;
    if (!result?.ok) {
      const reason = result?.reason;
      toast.error(
        reason === "already_owned"
          ? "Someone else just claimed this company."
          : reason === "forbidden"
          ? "You don't have access to claim companies."
          : reason === "not_found"
          ? "Company not found."
          : "Could not claim."
      );
      onClaimed?.();
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
