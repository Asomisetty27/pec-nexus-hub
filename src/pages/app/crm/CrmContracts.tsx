import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ExternalLink, Building2 } from "lucide-react";
import { useCrmAccess } from "@/hooks/useCrmAccess";
import { logAuditAction } from "@/lib/audit";

const CONFIDENCE_LABEL: Record<string, string> = {
  confirmed_awardee: "Confirmed awardee",
  likely_active_bidder: "Likely active bidder",
  closed_bid_unconfirmed: "Closed bid (unconfirmed)",
};

const CONFIDENCE_TONE: Record<string, string> = {
  confirmed_awardee: "bg-success/10 text-success border-success/30",
  likely_active_bidder: "bg-warning/10 text-warning border-warning/30",
  closed_bid_unconfirmed: "bg-muted/40 text-muted-foreground border-border",
};

export default function CrmContracts() {
  const navigate = useNavigate();
  const { isLeadership } = useCrmAccess();
  const [opps, setOpps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("public_contract_opportunities")
      .select("*, awardee:awardee_organization_id(id, name)")
      .eq("is_archived", false)
      .order("awarded_at", { ascending: false, nullsFirst: false })
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(200);
    setOpps(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const promote = async (opp: any) => {
    if (opp.awardee_organization_id) {
      navigate(`/app/crm/c/${opp.awardee_organization_id}`);
      return;
    }
    if (!isLeadership) {
      toast.error("Leadership creates new company records.");
      return;
    }
    const name = opp.solicitation_title?.split(/[—\-:]/)[0]?.trim() || opp.source_agency || "Untitled";
    const { data, error } = await supabase
      .from("organizations")
      .insert({
        name,
        type: "client",
        is_company_relation: true,
        crm_status: "researching" as any,
        warmth_score: "cold" as any,
        relationship_goal: "project" as any,
        procurement_vendor: true,
        contract_monitor_notes: `Promoted from contract: ${opp.solicitation_title || ""} (${opp.source_url || opp.source_agency})`,
      })
      .select()
      .single();
    if (error) { toast.error(error.message); return; }
    await supabase
      .from("public_contract_opportunities")
      .update({ awardee_organization_id: data.id })
      .eq("id", opp.id);
    logAuditAction("crm.contract_promoted", "organization", data.id, { contract_id: opp.id });
    toast.success("Promoted to CRM");
    navigate(`/app/crm/c/${data.id}`);
  };

  if (loading) return <div className="h-64 animate-pulse rounded-lg bg-muted/30" />;

  if (opps.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-sm font-medium mb-1">No public contract opportunities yet</p>
        <p className="text-[12px] text-muted-foreground">
          The contract monitor will populate this as runs complete.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-muted-foreground">
        Public solicitations and awards from the contract monitor. Promote a confirmed awardee into CRM to start a relationship.
      </p>
      {opps.map((o) => (
        <Card key={o.id} className="p-3">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-sm font-semibold truncate">{o.solicitation_title || "Untitled solicitation"}</p>
                {o.confidence_level && (
                  <Badge variant="outline" className={`text-[9px] font-mono ${CONFIDENCE_TONE[o.confidence_level] || ""}`}>
                    {CONFIDENCE_LABEL[o.confidence_level] || o.confidence_level}
                  </Badge>
                )}
                {o.category && <Badge variant="outline" className="text-[9px] font-mono">{o.category}</Badge>}
              </div>
              <div className="flex items-center gap-3 mt-1 text-[10px] font-mono text-muted-foreground flex-wrap">
                <span>{o.source_agency}</span>
                {o.published_at && <span>published {new Date(o.published_at).toLocaleDateString()}</span>}
                {o.awarded_at && <span>awarded {new Date(o.awarded_at).toLocaleDateString()}</span>}
                {o.awardee && (
                  <button
                    onClick={() => navigate(`/app/crm/c/${o.awardee.id}`)}
                    className="flex items-center gap-1 hover:text-foreground"
                  >
                    <Building2 className="h-3 w-3" />
                    {o.awardee.name}
                  </button>
                )}
                {o.source_url && (
                  <a
                    href={o.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 hover:text-foreground"
                  >
                    <ExternalLink className="h-3 w-3" /> Source
                  </a>
                )}
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => promote(o)}>
              {o.awardee_organization_id ? "Open" : "Promote"}
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
