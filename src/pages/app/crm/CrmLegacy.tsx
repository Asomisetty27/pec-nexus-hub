import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, Mail, Inbox } from "lucide-react";
import { toast } from "sonner";
import { useCrmAccess } from "@/hooks/useCrmAccess";

const stageLabels: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  scoping: "Scoping",
  proposed: "Proposed",
  signed: "Signed",
  active: "Active",
  completed: "Completed",
  lost: "Lost",
};

/**
 * Bridge to the legacy `leads` table fed by the public Intake form.
 * Read-only — leads should be promoted to Company Relations rather than managed here.
 */
export default function CrmLegacy() {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { canAccess } = useCrmAccess();

  const promote = async (orgId: string, leadId: string) => {
    const { error } = await supabase.rpc("promote_org_to_crm", { _org_id: orgId });
    if (error) { toast.error(error.message); return; }
    toast.success("Promoted to Company Relations");
    setLeads((prev) => prev.filter((l) => l.id !== leadId));
    navigate("/app/crm/queues");
  };

  useEffect(() => {
    supabase
      .from("leads")
      .select("*, organizations(name)")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setLeads(data || []);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="h-64 animate-pulse rounded-lg bg-muted/30" />;

  return (
    <div className="space-y-3">
      <Card className="border-warning/30 bg-warning/5">
        <CardContent className="p-3 flex items-center gap-2 text-[12px]">
          <Inbox className="h-4 w-4 text-warning shrink-0" />
          <p>
            Legacy inbound leads from the public intake form. Promote qualified leads into Company Relations rather than working them here.
          </p>
        </CardContent>
      </Card>

      {leads.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm font-medium mb-1">No legacy leads</p>
          <p className="text-[12px] text-muted-foreground">
            Inbound submissions from the intake form will appear here.
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {leads.map((l) => (
            <Card key={l.id}>
              <CardContent className="flex items-center gap-3 p-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium">{l.contact_name}</p>
                    {l.engagement_type && (
                      <Badge variant="outline" className="text-[9px] font-mono">
                        {l.engagement_type}
                      </Badge>
                    )}
                    {l.timeline === "urgent" && (
                      <Badge variant="destructive" className="text-[9px] font-mono">
                        Urgent
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground flex-wrap">
                    {l.contact_email && (
                      <span>
                        <Mail className="inline h-3 w-3 mr-1" />
                        {l.contact_email}
                      </span>
                    )}
                    {l.organizations?.name && (
                      <span>
                        <Building2 className="inline h-3 w-3 mr-1" />
                        {l.organizations.name}
                      </span>
                    )}
                    {l.contact_role && <span>· {l.contact_role}</span>}
                  </div>
                  {l.notes && (
                    <p className="mt-1.5 text-[10px] text-muted-foreground line-clamp-2 whitespace-pre-line">
                      {l.notes}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className="text-[9px] font-mono">
                    {stageLabels[l.stage] || l.stage}
                  </Badge>
                  {canAccess && l.org_id && (
                    <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => promote(l.org_id, l.id)}>Promote to CRM</Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}