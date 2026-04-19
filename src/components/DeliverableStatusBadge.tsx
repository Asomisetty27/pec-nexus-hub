import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, AlertTriangle, RefreshCw, Eye, Circle, Ban } from "lucide-react";
import { getUnifiedStatus, STATUS_LABELS, type UnifiedStatus } from "@/lib/deliverableStatus";

interface Props {
  status: string;          // approval_status: pending | approved | rejected | revision_requested
  fileUrl?: string | null; // null => not started
  dueDate?: string | null;
  approvalRequired?: boolean;
  blockingStage?: boolean;
  className?: string;
}

const ICON: Record<UnifiedStatus, any> = {
  approved: CheckCircle2,
  rejected: Ban,
  revision_requested: RefreshCw,
  overdue: AlertTriangle,
  awaiting_review: Eye,
  submitted: Clock,
  not_started: Circle,
};

export default function DeliverableStatusBadge({ status, fileUrl, dueDate, approvalRequired, blockingStage, className }: Props) {
  const unified = getUnifiedStatus({
    approval_status: status,
    approval_required: approvalRequired ?? true,
    file_url: fileUrl ?? null,
    due_date: dueDate ?? null,
  });
  const Icon = ICON[unified];
  const label = STATUS_LABELS[unified];
  let variant: "default" | "secondary" | "destructive" | "outline" = "outline";
  let extra = "";
  if (unified === "approved") { variant = "default"; extra = "bg-success text-success-foreground border-transparent"; }
  else if (unified === "rejected" || unified === "revision_requested" || unified === "overdue") variant = "destructive";
  else if (unified === "awaiting_review" || unified === "submitted") variant = "secondary";

  return (
    <div className={`inline-flex items-center gap-1.5 ${className || ""}`}>
      <Badge variant={variant} className={`gap-1 text-[10px] ${extra}`}>
        <Icon className="h-2.5 w-2.5" />
        {label}
      </Badge>
      {blockingStage && status !== "approved" && (
        <Badge variant="destructive" className="gap-1 text-[10px]">
          <AlertTriangle className="h-2.5 w-2.5" /> Blocks stage
        </Badge>
      )}
    </div>
  );
}
