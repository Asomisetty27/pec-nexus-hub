import { Badge } from "@/components/ui/badge";
import { STAGE_LABEL, STAGE_TONE, type ApplicantStage } from "@/lib/recruitment";
import { cn } from "@/lib/utils";

export function StageBadge({ stage, className }: { stage: ApplicantStage; className?: string }) {
  return (
    <Badge variant="outline" className={cn("border-transparent", STAGE_TONE[stage], className)}>
      {STAGE_LABEL[stage]}
    </Badge>
  );
}