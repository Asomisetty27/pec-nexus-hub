import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Flame, Snowflake, Sun } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  CRM_BUCKET_LABEL,
  TIER_LABEL,
  WARMTH_LABEL,
  fitScoreTone,
  relationshipGoalLabel,
  statusBucket,
  statusBucketTone,
  statusLabel,
} from "@/lib/crmConstants";

interface Company {
  id: string;
  name: string;
  industry?: string | null;
  hq_location?: string | null;
  crm_status: string;
  warmth_score: string;
  tier_priority?: string | null;
  relationship_goal?: string | null;
  project_fit_score?: number | null;
  sponsor_fit_score?: number | null;
  last_contacted_at?: string | null;
  next_action_at?: string | null;
}

function warmthIcon(w: string) {
  if (w === "hot") return Flame;
  if (w === "warm") return Sun;
  return Snowflake;
}

function fmtRelative(date?: string | null): string {
  if (!date) return "Never";
  const diff = Date.now() - new Date(date).getTime();
  const days = Math.round(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.round(days / 30)}mo ago`;
  return `${Math.round(days / 365)}y ago`;
}

export default function CompanyCard({ company, compact }: { company: Company; compact?: boolean }) {
  const navigate = useNavigate();
  const bucket = statusBucket(company.crm_status);
  const Warmth = warmthIcon(company.warmth_score);
  const fit =
    company.relationship_goal === "sponsorship"
      ? company.sponsor_fit_score
      : company.project_fit_score;

  return (
    <Card
      onClick={() => navigate(`/app/crm/c/${company.id}`)}
      className="cursor-pointer p-3 hover:bg-muted/30 transition-colors"
    >
      <div className="flex items-start gap-2.5">
        <div className="h-8 w-8 shrink-0 rounded-md bg-secondary flex items-center justify-center">
          <Building2 className="h-4 w-4 text-secondary-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold truncate leading-tight">{company.name}</p>
            <Warmth className="h-3 w-3 shrink-0 text-muted-foreground" aria-label={WARMTH_LABEL[company.warmth_score as "cold" | "warm" | "hot"]} />
          </div>
          {!compact && (
            <p className="text-[11px] text-muted-foreground truncate mt-0.5">
              {[company.industry, company.hq_location].filter(Boolean).join(" · ") || "—"}
            </p>
          )}
          <div className="flex items-center gap-1 mt-1.5 flex-wrap">
            {bucket && (
              <Badge variant="outline" className={`text-[9px] font-mono ${statusBucketTone(bucket)}`}>
                {CRM_BUCKET_LABEL[bucket]}
              </Badge>
            )}
            <Badge variant="outline" className="text-[9px] font-mono">
              {relationshipGoalLabel(company.relationship_goal)}
            </Badge>
            {company.tier_priority && (
              <Badge variant="outline" className="text-[9px] font-mono">
                {TIER_LABEL[company.tier_priority as "tier_1" | "tier_2" | "tier_3"]}
              </Badge>
            )}
            {fit != null && (
              <span className={`text-[9px] font-mono font-semibold ${fitScoreTone(fit)}`}>
                Fit {fit}
              </span>
            )}
          </div>
          {!compact && (
            <div className="flex items-center gap-3 mt-1.5 text-[10px] font-mono text-muted-foreground">
              <span>Last: {fmtRelative(company.last_contacted_at)}</span>
              <span>Next: {company.next_action_at ? fmtRelative(company.next_action_at) : "—"}</span>
            </div>
          )}
          {compact && (
            <p className="text-[9px] font-mono text-muted-foreground mt-1">
              {statusLabel(company.crm_status)}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}