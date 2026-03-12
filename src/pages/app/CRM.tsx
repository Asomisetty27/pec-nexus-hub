import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, ArrowRight, DollarSign, Phone, Mail } from "lucide-react";
import { toast } from "sonner";

const stageLabels: Record<string, string> = {
  new: "New", contacted: "Contacted", scoping: "Scoping", proposed: "Proposed",
  signed: "Signed", active: "Active", completed: "Completed", lost: "Lost",
};
const stageColors: Record<string, string> = {
  new: "secondary", contacted: "outline", scoping: "default", proposed: "default",
  signed: "default", active: "default", completed: "default", lost: "destructive",
};

export default function CRM() {
  const { isAdmin } = useAuth();
  const [leads, setLeads] = useState<any[]>([]);
  const [orgs, setOrgs] = useState<any[]>([]);
  const [packages, setPackages] = useState<any[]>([]);

  const fetchAll = async () => {
    const [lRes, oRes, pRes] = await Promise.all([
      supabase.from("leads").select("*, organizations(name)").order("created_at", { ascending: false }),
      supabase.from("organizations").select("*").order("name"),
      supabase.from("sponsorship_packages").select("*, organizations(name)").order("created_at", { ascending: false }),
    ]);
    setLeads(lRes.data || []);
    setOrgs(oRes.data || []);
    setPackages(pRes.data || []);
  };

  useEffect(() => { fetchAll(); }, []);

  const updateLeadStage = async (leadId: string, stage: string) => {
    await supabase.from("leads").update({ stage }).eq("id", leadId);
    fetchAll();
    toast.success("Lead updated");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Sponsors & CRM</h1>
        <p className="text-sm text-muted-foreground">Manage leads, sponsors, and partnerships</p>
      </div>

      <Tabs defaultValue="pipeline">
        <TabsList>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="organizations">Organizations</TabsTrigger>
          <TabsTrigger value="sponsorships">Sponsorships</TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline" className="space-y-4 mt-4">
          {leads.length === 0 ? (
            <Card className="py-12 text-center"><p className="text-muted-foreground">No leads yet. Leads come from the intake form.</p></Card>
          ) : (
            <div className="space-y-2">
              {leads.map(l => (
                <Card key={l.id}>
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{l.contact_name}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        {l.contact_email && <span><Mail className="inline h-3 w-3 mr-1" />{l.contact_email}</span>}
                        {l.organizations?.name && <span><Building2 className="inline h-3 w-3 mr-1" />{l.organizations.name}</span>}
                      </div>
                    </div>
                    <Select value={l.stage} onValueChange={(v) => updateLeadStage(l.id, v)}>
                      <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(stageLabels).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="organizations" className="space-y-4 mt-4">
          {orgs.length === 0 ? (
            <Card className="py-12 text-center"><p className="text-muted-foreground">No organizations yet.</p></Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {orgs.map(o => (
                <Card key={o.id}>
                  <CardContent className="p-4">
                    <p className="font-medium">{o.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-[10px]">{o.type}</Badge>
                      {o.tier && <Badge className="text-[10px]">{o.tier}</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">{o.description || "No description"}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="sponsorships" className="space-y-4 mt-4">
          {packages.length === 0 ? (
            <Card className="py-12 text-center"><p className="text-muted-foreground">No sponsorship packages yet.</p></Card>
          ) : (
            <div className="space-y-2">
              {packages.map(p => (
                <Card key={p.id}>
                  <CardContent className="flex items-center gap-4 p-4">
                    <DollarSign className="h-5 w-5 text-accent shrink-0" />
                    <div className="flex-1">
                      <p className="font-medium text-sm">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.organizations?.name} · {p.tier}</p>
                    </div>
                    {p.amount && <span className="font-medium">${Number(p.amount).toLocaleString()}</span>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
