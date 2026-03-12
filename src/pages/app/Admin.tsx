import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, Users, FolderKanban, ScrollText, Check, X } from "lucide-react";
import { toast } from "sonner";

export default function Admin() {
  const { user, isAdmin } = useAuth();
  const [roleRequests, setRoleRequests] = useState<any[]>([]);
  const [allProfiles, setAllProfiles] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  const fetchAll = async () => {
    const [rrRes, profRes, alRes] = await Promise.all([
      supabase.from("role_requests").select("*, profiles:user_id(full_name, cal_poly_email)").eq("status", "pending").order("created_at"),
      supabase.from("profiles").select("*, user_roles(role)").order("full_name"),
      supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    setRoleRequests(rrRes.data || []);
    setAllProfiles(profRes.data || []);
    setAuditLogs(alRes.data || []);
  };

  useEffect(() => { if (isAdmin) fetchAll(); }, [isAdmin]);

  const handleRoleRequest = async (id: string, status: "approved" | "rejected", userId: string, role: string) => {
    await supabase.from("role_requests").update({ status, reviewer_id: user!.id, reviewed_at: new Date().toISOString() }).eq("id", id);
    if (status === "approved") {
      await supabase.from("user_roles").insert([{ user_id: userId, role: role as any, granted_by: user!.id }]);
    }
    toast.success(`Request ${status}`);
    fetchAll();
  };

  if (!isAdmin) return <div className="text-center py-12"><p className="text-muted-foreground">Admin access required.</p></div>;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">Admin Console</h1>
      <Tabs defaultValue="approvals">
        <TabsList>
          <TabsTrigger value="approvals">Approvals ({roleRequests.length})</TabsTrigger>
          <TabsTrigger value="users">Users ({allProfiles.length})</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        <TabsContent value="approvals" className="mt-4 space-y-2">
          {roleRequests.length === 0 ? (
            <Card className="py-8 text-center"><p className="text-muted-foreground">No pending approvals.</p></Card>
          ) : roleRequests.map(rr => (
            <Card key={rr.id}>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex-1">
                  <p className="font-medium text-sm">{(rr.profiles as any)?.full_name}</p>
                  <p className="text-xs text-muted-foreground">{(rr.profiles as any)?.cal_poly_email}</p>
                  <Badge variant="outline" className="mt-1 text-[10px]">Requesting: {rr.requested_role}</Badge>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleRoleRequest(rr.id, "approved", rr.user_id, rr.requested_role)}><Check className="mr-1 h-3 w-3" /> Approve</Button>
                  <Button size="sm" variant="destructive" onClick={() => handleRoleRequest(rr.id, "rejected", rr.user_id, rr.requested_role)}><X className="mr-1 h-3 w-3" /> Reject</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="users" className="mt-4 space-y-2">
          {allProfiles.map(p => (
            <Card key={p.id}>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">{p.full_name?.charAt(0) || "?"}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{p.full_name || "—"}</p>
                  <p className="text-xs text-muted-foreground">{p.cal_poly_email}</p>
                </div>
                <div className="flex gap-1 flex-wrap">
                  {(p.user_roles || []).map((r: any, i: number) => (
                    <Badge key={i} variant="outline" className="text-[10px]">{r.role}</Badge>
                  ))}
                </div>
                <Badge variant={p.status === "active" ? "default" : "secondary"} className="text-[10px]">{p.status}</Badge>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="audit" className="mt-4 space-y-2">
          {auditLogs.length === 0 ? (
            <Card className="py-8 text-center"><p className="text-muted-foreground">No audit logs yet.</p></Card>
          ) : auditLogs.map(log => (
            <Card key={log.id}>
              <CardContent className="flex items-center gap-4 p-3 text-sm">
                <ScrollText className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="font-medium">{log.action}</span>
                  <span className="text-muted-foreground ml-2">on {log.target_type}</span>
                </div>
                <span className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString()}</span>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
