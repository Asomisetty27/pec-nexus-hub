import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, AlertTriangle, RefreshCw, Eye, Circle, Ban } from "lucide-react";

interface Props {
  status: string;          // approval_status: pending | approved | rejected | revision_requested
  fileUrl?: string | null; // null => not started
  dueDate?: string | null;
  approvalRequired?: boolean;
  blockingStage?: boolean;
  className?: string;
}

export default function DeliverableStatusBadge({ status, fileUrl, dueDate, approvalRequired, blockingStage, className }: Props) {
  const isOverdue = dueDate && new Date(dueDate) < new Date() && status !== "approved";
  const notStarted = !fileUrl && status === "pending";

  let label: string, Icon = Circle, variant: "default" | "secondary" | "destructive" | "outline" = "outline", extra = "";

  if (status === "approved") { label = "Approved"; Icon = CheckCircle2; variant = "default"; extra = "bg-success text-success-foreground border-transparent"; }
  else if (status === "rejected") { label = "Rejected"; Icon = Ban; variant = "destructive"; }
  else if (status === "revision_requested") { label = "Revision needed"; Icon = RefreshCw; variant = "destructive"; }
  else if (notStarted && isOverdue) { label = "Overdue"; Icon = AlertTriangle; variant = "destructive"; }
  else if (notStarted) { label = "Not started"; Icon = Circle; variant = "outline"; }
  else if (approvalRequired) { label = "Awaiting review"; Icon = Eye; variant = "secondary"; }
  else { label = "Submitted"; Icon = Clock; variant = "secondary"; }

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
