import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import CompanyCard from "@/components/crm/CompanyCard";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function CrmMyCompanies() {
  const { user } = useAuth();
  const [primary, setPrimary] = useState<any[]>([]);
  const [secondary, setSecondary] = useState<any[]>([]);
  const [overseeing, setOverseeing] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("organizations")
        .select("*")
        .eq("is_company_relation", true)
        .or(
          `owner_user_id.eq.${user.id},secondary_owner_user_id.eq.${user.id},overseeing_lead_user_id.eq.${user.id}`
        );
      const all = data || [];
      setPrimary(all.filter((c) => c.owner_user_id === user.id));
      setSecondary(all.filter((c) => c.secondary_owner_user_id === user.id && c.owner_user_id !== user.id));
      setOverseeing(all.filter((c) => c.overseeing_lead_user_id === user.id && c.owner_user_id !== user.id && c.secondary_owner_user_id !== user.id));
      setLoading(false);
    };
    load();
  }, [user]);

  if (loading) return <div className="h-64 animate-pulse rounded-lg bg-muted/30" />;

  const sections = [
    { label: "Primary owner", items: primary, hint: "You drive these." },
    { label: "Secondary owner", items: secondary, hint: "You assist." },
    { label: "Overseeing as lead", items: overseeing, hint: "You supervise." },
  ];

  const empty = primary.length + secondary.length + overseeing.length === 0;
  if (empty) {
    return (
      <Card className="p-8 text-center">
        <p className="text-sm font-medium mb-1">No companies assigned to you yet</p>
        <p className="text-[12px] text-muted-foreground">Companies you own or oversee will appear here.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {sections.map(
        (s) =>
          s.items.length > 0 && (
            <div key={s.label}>
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-sm font-semibold">{s.label}</h2>
                <Badge variant="outline" className="text-[9px] font-mono">
                  {s.items.length}
                </Badge>
                <span className="text-[10px] text-muted-foreground">· {s.hint}</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {s.items.map((c) => (
                  <CompanyCard key={c.id} company={c} />
                ))}
              </div>
            </div>
          )
      )}
    </div>
  );
}