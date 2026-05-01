import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import CompanyCard from "@/components/crm/CompanyCard";
import { Card } from "@/components/ui/card";
import { QUALIFIED_STATUSES } from "@/lib/crmConstants";

export default function CrmQualified() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("organizations")
      .select("*")
      .eq("is_company_relation", true)
      .in("crm_status", QUALIFIED_STATUSES)
      .order("warmth_score", { ascending: false })
      .order("updated_at", { ascending: false })
      .then(({ data }) => {
        setCompanies(data || []);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="h-64 animate-pulse rounded-lg bg-muted/30" />;

  if (companies.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-sm font-medium mb-1">No qualified opportunities yet</p>
        <p className="text-[12px] text-muted-foreground">
          Companies in conversation, with meetings scheduled, or in proposal will appear here.
        </p>
      </Card>
    );
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {companies.map((c) => (
        <CompanyCard key={c.id} company={c} />
      ))}
    </div>
  );
}