import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Building2, Flame, AlertTriangle, ChevronRight, Plus } from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  CRM_STATUS_BUCKET,
  INACTIVE_STATUSES,
  QUALIFIED_STATUSES,
  relationshipGoalLabel,
  statusBucketTone,
  statusLabel,
} from "@/lib/crmConstants";

const STALE_DAYS = 14;

function isStale(c: any): boolean {
  if (INACTIVE_STATUSES.includes(c.crm_status)) return false;
  if (!c.last_contacted_at) return c.crm_status !== "not_started";
  return Date.now() - new Date(c.last_contacted_at).getTime() > STALE_DAYS * 86400000;
}

export default function CrmDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("organizations")
        .select("*")
        .eq("is_company_relation", true)
        .order("updated_at", { ascending: false });
      setCompanies(data || []);
      setLoading(false);
    };
    load();
  }, []);

  if (loading) {
    return <div className="h-64 animate-pulse rounded-lg bg-muted/30" />;
  }

  const total = companies.length;
  const active = companies.filter((c) => !INACTIVE_STATUSES.includes(c.crm_status)).length;
  const qualified = companies.filter((c) => QUALIFIED_STATUSES.includes(c.crm_status)).length;
  const converted = companies.filter((c) => c.crm_status === "won").length;
  const hot = companies.filter((c) => c.warmth_score === "hot").length;

  const myCompanies = companies.filter(
    (c) => c.owner_user_id === user?.id || c.secondary_owner_user_id === user?.id
  );
  const stale = companies.filter(isStale).slice(0, 6);
  const dueSoon = companies
    .filter((c) => c.next_action_at && new Date(c.next_action_at).getTime() < Date.now() + 7 * 86400000)
    .filter((c) => !INACTIVE_STATUSES.includes(c.crm_status))
    .sort(
      (a, b) =>
        new Date(a.next_action_at).getTime() - new Date(b.next_action_at).getTime()
    )
    .slice(0, 6);

  const unclassified = companies.filter((c) => !c.relationship_goal).length;

  const stats = [
    { label: "Active", value: active, hint: `${total} total` },
    { label: "Qualified", value: qualified, hint: "in conversation+" },
    { label: "Converted", value: converted, hint: "won engagements" },
    { label: "Hot", value: hot, hint: "high warmth" },
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-display font-bold mt-1">{s.value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{s.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {unclassified > 0 && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium">{unclassified} companies have no relationship goal</p>
              <p className="text-[11px] text-muted-foreground">Classify them to keep the pipeline accurate.</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => navigate("/app/crm/table?filter=unclassified")}>
              Review
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader className="py-3 px-5 flex-row items-center justify-between">
            <CardTitle className="text-sm font-sans font-semibold flex items-center gap-2">
              <Flame className="h-3.5 w-3.5 text-accent-foreground" /> Due this week
            </CardTitle>
            <Button size="sm" variant="ghost" className="text-[10px]" onClick={() => navigate("/app/crm/table")}>
              All <ChevronRight className="h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent className="pt-0 px-5 pb-4 space-y-1.5">
            {dueSoon.length === 0 ? (
              <p className="text-[11px] text-muted-foreground py-4 text-center">No actions due this week.</p>
            ) : (
              dueSoon.map((c) => (
                <CompactRow key={c.id} c={c} dateField="next_action_at" navigate={navigate} />
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3 px-5 flex-row items-center justify-between">
            <CardTitle className="text-sm font-sans font-semibold flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-warning" /> Going stale
            </CardTitle>
            <Button size="sm" variant="ghost" className="text-[10px]" onClick={() => navigate("/app/crm/table?filter=stale")}>
              All <ChevronRight className="h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent className="pt-0 px-5 pb-4 space-y-1.5">
            {stale.length === 0 ? (
              <p className="text-[11px] text-muted-foreground py-4 text-center">Nothing stale. Nice.</p>
            ) : (
              stale.map((c) => (
                <CompactRow key={c.id} c={c} dateField="last_contacted_at" navigate={navigate} stalePrefix />
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="py-3 px-5 flex-row items-center justify-between">
          <CardTitle className="text-sm font-sans font-semibold flex items-center gap-2">
            <Building2 className="h-3.5 w-3.5 text-accent-foreground" /> Your companies
          </CardTitle>
          <Button size="sm" variant="ghost" className="text-[10px]" onClick={() => navigate("/app/crm/my")}>
            View mine <ChevronRight className="h-3 w-3" />
          </Button>
        </CardHeader>
        <CardContent className="pt-0 px-5 pb-4">
          {myCompanies.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-[11px] text-muted-foreground mb-3">You don&apos;t own any companies yet.</p>
              <Button size="sm" variant="outline" onClick={() => navigate("/app/crm/table")} className="gap-1.5">
                <Plus className="h-3 w-3" /> Browse all
              </Button>
            </div>
          ) : (
            <div className="space-y-1.5">
              {myCompanies.slice(0, 5).map((c) => (
                <CompactRow key={c.id} c={c} dateField="last_contacted_at" navigate={navigate} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CompactRow({
  c,
  dateField,
  navigate,
  stalePrefix,
}: {
  c: any;
  dateField: "last_contacted_at" | "next_action_at";
  navigate: (path: string) => void;
  stalePrefix?: boolean;
}) {
  const bucket = CRM_STATUS_BUCKET[c.crm_status as keyof typeof CRM_STATUS_BUCKET];
  const date = c[dateField];
  let dateStr = "—";
  if (date) {
    const d = new Date(date);
    const days = Math.round((Date.now() - d.getTime()) / 86400000);
    if (dateField === "next_action_at") {
      dateStr = days <= 0 ? `in ${Math.abs(days)}d` : `${days}d ago`;
      if (days === 0) dateStr = "today";
    } else {
      dateStr = days === 0 ? "today" : `${days}d`;
    }
  }
  return (
    <button
      onClick={() => navigate(`/app/crm/c/${c.id}`)}
      className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/40 text-left"
    >
      <span className="text-sm font-medium truncate flex-1">{c.name}</span>
      <Badge variant="outline" className="text-[9px] font-mono">
        {relationshipGoalLabel(c.relationship_goal)}
      </Badge>
      {bucket && (
        <Badge variant="outline" className={`text-[9px] font-mono ${statusBucketTone(bucket)}`}>
          {statusLabel(c.crm_status)}
        </Badge>
      )}
      <span className="text-[10px] font-mono text-muted-foreground shrink-0">
        {stalePrefix ? "stale " : ""}{dateStr}
      </span>
    </button>
  );
}