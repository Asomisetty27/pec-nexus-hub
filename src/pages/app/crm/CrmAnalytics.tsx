import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CRM_STATUS_BUCKET,
  CRM_STATUS_LABEL,
  RELATIONSHIP_GOAL_LABEL,
  type CrmStatus,
  type RelationshipGoal,
  statusBucketTone,
} from "@/lib/crmConstants";

export default function CrmAnalytics() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [conversions, setConversions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [orgs, convs] = await Promise.all([
        supabase.from("organizations").select("*").eq("is_company_relation", true),
        supabase
          .from("company_conversions")
          .select("*, organizations!inner(name, is_company_relation)")
          .eq("organizations.is_company_relation", true)
          .order("converted_at", { ascending: false })
          .limit(20),
      ]);
      setCompanies(orgs.data || []);
      setConversions(convs.data || []);
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <div className="h-64 animate-pulse rounded-lg bg-muted/30" />;

  const total = companies.length;
  const statusCounts = Object.entries(CRM_STATUS_LABEL)
    .map(([key, label]) => {
      const count = companies.filter((c) => c.crm_status === key).length;
      return { key: key as CrmStatus, label, count };
    })
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count);

  const goalCounts = Object.entries(RELATIONSHIP_GOAL_LABEL).map(([key, label]) => ({
    key: key as RelationshipGoal,
    label,
    count: companies.filter((c) => c.relationship_goal === key).length,
  }));
  const unsetGoal = companies.filter((c) => !c.relationship_goal).length;

  const warmthCounts = (["hot", "warm", "cold"] as const).map((w) => ({
    label: w,
    count: companies.filter((c) => c.warmth_score === w).length,
  }));

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="py-3 px-5">
          <CardTitle className="text-sm font-semibold">Pipeline distribution</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-4 space-y-1.5">
          {statusCounts.map((s) => {
            const bucket = CRM_STATUS_BUCKET[s.key];
            const pct = total > 0 ? (s.count / total) * 100 : 0;
            return (
              <div key={s.key} className="flex items-center gap-2 text-[12px]">
                <span className="w-44 truncate">{s.label}</span>
                <div className="flex-1 h-2 rounded bg-muted/40 overflow-hidden">
                  <div
                    className={`h-full ${statusBucketTone(bucket).split(" ")[0]}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-10 text-right font-mono text-[10px] text-muted-foreground">{s.count}</span>
              </div>
            );
          })}
          {statusCounts.length === 0 && (
            <p className="text-[11px] text-muted-foreground py-4 text-center">No data.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader className="py-3 px-5">
            <CardTitle className="text-sm font-semibold">By relationship goal</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4 space-y-1.5">
            {goalCounts.map((g) => (
              <div key={g.key} className="flex items-center justify-between text-[12px]">
                <span>{g.label}</span>
                <span className="font-mono text-[11px] text-muted-foreground">{g.count}</span>
              </div>
            ))}
            <div className="flex items-center justify-between text-[12px] pt-1.5 border-t border-border/40">
              <span className="text-muted-foreground">Unset</span>
              <span className="font-mono text-[11px] text-muted-foreground">{unsetGoal}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3 px-5">
            <CardTitle className="text-sm font-semibold">Warmth distribution</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4 space-y-1.5">
            {warmthCounts.map((w) => (
              <div key={w.label} className="flex items-center justify-between text-[12px]">
                <span className="capitalize">{w.label}</span>
                <span className="font-mono text-[11px] text-muted-foreground">{w.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="py-3 px-5">
          <CardTitle className="text-sm font-semibold">Recent conversions</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          {conversions.length === 0 ? (
            <p className="text-[11px] text-muted-foreground py-4 text-center">No conversions yet.</p>
          ) : (
            <div className="space-y-1.5">
              {conversions.map((c) => (
                <div key={c.id} className="flex items-center justify-between text-[12px]">
                  <span className="truncate flex-1">{c.organizations?.name}</span>
                  <Badge variant="outline" className="text-[9px] font-mono">{c.conversion_type}</Badge>
                  <span className="ml-2 text-[10px] font-mono text-muted-foreground">
                    {new Date(c.converted_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}