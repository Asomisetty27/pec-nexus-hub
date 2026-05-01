import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PlayCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { markDeliverableStarted } from "@/lib/reviewActions";

interface Props {
  deliverableId: string;
  size?: "sm" | "default";
  variant?: "default" | "outline" | "ghost";
  className?: string;
  onStarted?: () => void;
  label?: string;
}

/** Lightweight one-tap action. Caller is responsible for permission gating. */
export function MarkStartedButton({
  deliverableId, size = "sm", variant = "outline", className, onStarted, label = "Mark Started",
}: Props) {
  const [busy, setBusy] = useState(false);
  const handle = async () => {
    setBusy(true);
    const res = await markDeliverableStarted(deliverableId);
    setBusy(false);
    if (res.ok === false) { toast.error(res.error); return; }
    toast.success("Marked started");
    onStarted?.();
  };
  return (
    <Button size={size} variant={variant} className={`gap-1 ${className || ""}`} disabled={busy} onClick={handle}>
      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <PlayCircle className="h-3 w-3" />}
      {label}
    </Button>
  );
}