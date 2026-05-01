import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StageBadge } from "./StageBadge";
import { Clock, MapPin, UserCheck } from "lucide-react";
import type { ApplicantStage } from "@/lib/recruitment";

export type ApplicantCardData = {
  id: string;
  full_name: string;
  email: string;
  major: string | null;
  current_stage: ApplicantStage;
  routing_resolved: boolean;
  primary_reviewer_user_id: string | null;
  routed_cohort_id: string | null;
  submitted_at: string | null;
  created_at: string;
};

export function ApplicantCard({
  applicant,
  cohortName,
  reviewerName,
  highlight,
}: {
  applicant: ApplicantCardData;
  cohortName?: string;
  reviewerName?: string;
  highlight?: boolean;
}) {
  return (
    <Link to={`/app/recruitment/c/${applicant.id}`} className="block">
      <Card className={highlight ? "border-primary/40 bg-primary/[0.02] transition-colors hover:bg-primary/[0.04]" : "transition-colors hover:bg-muted/30"}>
        <CardContent className="p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{applicant.full_name}</div>
              <div className="truncate text-xs text-muted-foreground">{applicant.email}</div>
            </div>
            <StageBadge stage={applicant.current_stage} className="shrink-0 text-[10px]" />
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            {applicant.major && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {applicant.major}
              </span>
            )}
            {!applicant.routing_resolved && (
              <Badge variant="outline" className="h-4 border-amber-500/40 px-1 text-[10px] text-amber-600">
                Needs routing
              </Badge>
            )}
            {cohortName && applicant.routing_resolved && (
              <Badge variant="secondary" className="h-4 px-1 text-[10px]">{cohortName}</Badge>
            )}
            {reviewerName && (
              <span className="inline-flex items-center gap-1">
                <UserCheck className="h-3 w-3" /> {reviewerName}
              </span>
            )}
            {applicant.submitted_at && (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" /> {new Date(applicant.submitted_at).toLocaleDateString()}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}