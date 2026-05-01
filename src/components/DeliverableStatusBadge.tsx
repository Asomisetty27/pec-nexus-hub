import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, AlertTriangle, RefreshCw, Circle, Archive, PlayCircle, Ban, ShieldCheck, ShieldAlert } from "lucide-react";
import {
  getUnifiedStatus, STATUS_LABELS, type UnifiedStatus,
  isOverdue, wasRejected, type DeliverableLike, getValidationState,
} from "@/lib/deliverableStatus";

interface Props {
  /** Pass the full deliverable when possible so we can derive doctrine state. */
  deliverable?: DeliverableLike;
  /** Legacy positional props — kept so existing callers compile. */
  status?: string;
  fileUrl?: string | null;
  dueDate?: string | null;
  approvalRequired?: boolean;
  blockingStage?: boolean;
  /** Show Tech Validated / Awaiting PM sub-pill when relevant. */
  showValidation?: boolean;
  /** Show "Unstaged" sub-pill when canonical_stage is null. */
  showStage?: boolean;
  className?: string;
}

const ICON: Record<UnifiedStatus, any> = {
  drafted: Circle,
  assigned: Circle,
  in_progress: PlayCircle,
  submitted: Clock,
  needs_revision: RefreshCw,
  approved: CheckCircle2,
  archived: Archive,
};

export default function DeliverableStatusBadge({
  deliverable, status, fileUrl, dueDate, approvalRequired, blockingStage,
  showValidation, showStage, className,
}: Props) {
  const d: DeliverableLike = deliverable ?? {
    approval_status: status ?? "pending",
    approval_required: approvalRequired ?? true,
    file_url: fileUrl ?? null,
    due_date: dueDate ?? null,
  };
  const unified = getUnifiedStatus(d);
  const Icon = ICON[unified];
  const label = STATUS_LABELS[unified];
  const overdue = isOverdue(d);
  const rejected = wasRejected(d);
  const validation = getValidationState(d);

  let variant: "default" | "secondary" | "destructive" | "outline" = "outline";
  let extra = "";
  if (unified === "approved") { variant = "default"; extra = "bg-success text-success-foreground border-transparent"; }
  else if (unified === "needs_revision") variant = "destructive";
  else if (unified === "submitted" || unified === "in_progress") variant = "secondary";
  else if (unified === "archived") { variant = "outline"; extra = "text-muted-foreground bg-muted/40"; }

  return (
    <div className={`inline-flex items-center gap-1.5 flex-wrap ${className || ""}`}>
      <Badge variant={variant} className={`gap-1 text-[10px] ${extra}`}>
        <Icon className="h-2.5 w-2.5" />
        {label}
      </Badge>
      {rejected && (
        <Badge variant="outline" className="gap-1 text-[10px] text-destructive border-destructive/30">
          <Ban className="h-2.5 w-2.5" /> Rejected
        </Badge>
      )}
      {overdue && unified !== "archived" && (
        <Badge variant="destructive" className="gap-1 text-[10px]">
          <AlertTriangle className="h-2.5 w-2.5" /> Overdue
        </Badge>
      )}
      {showValidation && validation === "awaiting_tech_validation" && (
        <Badge variant="outline" className="gap-1 text-[10px] border-warning/40 text-warning">
          <ShieldAlert className="h-2.5 w-2.5" /> Tech validation needed
        </Badge>
      )}
      {showValidation && validation === "awaiting_pm_approval" && (
        <Badge variant="outline" className="gap-1 text-[10px] border-primary/40 text-primary">
          <ShieldCheck className="h-2.5 w-2.5" /> Tech validated · awaiting PM
        </Badge>
      )}
      {showValidation && validation === "approved_via_override" && (
        <Badge variant="outline" className="gap-1 text-[10px] border-warning/40 text-warning">
          <ShieldAlert className="h-2.5 w-2.5" /> PM override
        </Badge>
      )}
      {showStage && d.canonical_stage == null && unified !== "archived" && (
        <Badge variant="outline" className="gap-1 text-[10px] text-muted-foreground">
          Unstaged
        </Badge>
      )}
      {blockingStage && unified !== "approved" && unified !== "archived" && (
        <Badge variant="destructive" className="gap-1 text-[10px]">
          <AlertTriangle className="h-2.5 w-2.5" /> Blocks stage
        </Badge>
      )}
    </div>
  );
}
