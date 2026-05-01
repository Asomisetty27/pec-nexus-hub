import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import CompanyCard from "@/components/crm/CompanyCard";
import { Card } from "@/components/ui/card";
import {
  CRM_STATUS_LABEL,
  PIPELINE_STAGES,
  type CrmStatus,
} from "@/lib/crmConstants";

export default function CrmPipeline() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("organizations")
      .select("*")
      .eq("is_company_relation", true)
      .order("updated_at", { ascending: false })
      .then(({ data }) => {
        setCompanies(data || []);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="h-64 animate-pulse rounded-lg bg-muted/30" />;

  const byStatus = (status: CrmStatus) =>
    companies.filter((c) => c.crm_status === status);

  return (
    <div className="overflow-x-auto -mx-1 pb-2">
      <div className="flex gap-3 px-1 min-w-max">
        {PIPELINE_STAGES.map((status) => {
          const items = byStatus(status);
          return (
            <div key={status} className="w-72 shrink-0">
              <div className="flex items-center justify-between mb-2 px-1">
                <h3 className="text-[11px] font-mono uppercase tracking-wider font-semibold text-foreground/80">
                  {CRM_STATUS_LABEL[status]}
                </h3>
                <span className="text-[10px] font-mono text-muted-foreground">{items.length}</span>
              </div>
              <div className="space-y-2 min-h-[60px]">
                {items.length === 0 ? (
                  <Card className="p-3 text-center text-[10px] text-muted-foreground bg-muted/20">
                    Empty
                  </Card>
                ) : (
                  items.map((c) => <CompanyCard key={c.id} company={c} compact />)
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}