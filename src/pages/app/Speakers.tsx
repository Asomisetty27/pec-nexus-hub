// Speakers: the guest-speaker pipeline for the Business & Marketing line.
// A speaker moves idea -> invited -> confirmed -> scheduled -> spoke. Each can
// link to a CRM org, so inviting someone from a target company is tracked as
// the same relationship as pursuing that company for client work.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mic, Plus, ChevronRight, ChevronLeft, Building2, CalendarDays, Hand } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { SectionExplainer } from "@/components/ui/SectionExplainer";
import { useCrmAccess } from "@/hooks/useCrmAccess";

const STAGES = ["idea", "invited", "confirmed", "scheduled", "spoke"] as const;
type Stage = (typeof STAGES)[number];
const LABELS: Record<Stage, string> = {
  idea: "Ideas", invited: "Invited", confirmed: "Confirmed", scheduled: "Scheduled", spoke: "Spoke",
};

export default function Speakers() {
  const { user } = useAuth();
  const { canAccess, isLeadership } = useCrmAccess();
  const [rows, setRows] = useState<any[]>([]);
  const [orgs, setOrgs] = useState<any[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false);
  const [orgId, setOrgId] = useState<string>("none");
  const [loading, setLoading] = useState(true);

  const canWrite = canAccess; // business cohort or leadership per useCrmAccess

  const fetchAll = async () => {
    const [{ data: sp }, { data: og }] = await Promise.all([
      supabase.from("speakers" as any).select("*")
        .neq("status", "declined").order("proposed_date", { ascending: true, nullsFirst: false }),
      supabase.from("organizations").select("id, name").order("name"),
    ]);
    const r = (sp as any[]) || [];
    setRows(r);
    setOrgs((og as any[]) || []);
    const ids = [...new Set(r.map((x) => x.owner_user_id).filter(Boolean))];
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("user_id, full_name").in("user_id", ids);
      const m: Record<string, string> = {};
      (profs || []).forEach((p: any) => { m[p.user_id] = p.full_name; });
      setNames(m);
    }
    setLoading(false);
  };
  useEffect(() => { fetchAll(); }, []);

  const create = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const { error } = await supabase.from("speakers" as any).insert({
      name: f.get("name") as string,
      affiliation: (f.get("affiliation") as string) || null,
      topic: (f.get("topic") as string) || null,
      contact: (f.get("contact") as string) || null,
      proposed_date: (f.get("proposed_date") as string) || null,
      organization_id: orgId === "none" ? null : orgId,
      created_by: user!.id,
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success("Speaker added");
    setOpen(false); setOrgId("none"); fetchAll();
  };

  const move = async (row: any, dir: 1 | -1) => {
    const i = STAGES.indexOf(row.status as Stage);
    const next = STAGES[i + dir];
    if (!next) return;
    const { error } = await supabase.from("speakers" as any)
      .update({ status: next, updated_at: new Date().toISOString() } as any).eq("id", row.id);
    if (error) { toast.error(error.message); return; }
    fetchAll();
  };
  const claim = async (row: any) => {
    const mine = row.owner_user_id === user?.id;
    const { error } = await supabase.from("speakers" as any)
      .update({ owner_user_id: mine ? null : user!.id, updated_at: new Date().toISOString() } as any).eq("id", row.id);
    if (error) { toast.error(error.message); return; }
    fetchAll();
  };
  const decline = async (row: any) => {
    if (!confirm(`Mark ${row.name} declined? Removes them from the board.`)) return;
    await supabase.from("speakers" as any).update({ status: "declined" } as any).eq("id", row.id);
    fetchAll();
  };

  if (loading) return <div className="space-y-4">{[1, 2].map((i) => <Card key={i} className="h-40 animate-pulse bg-muted/30" />)}</div>;
  if (!canAccess) return (
    <Card className="p-8 text-center">
      <Mic className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
      <h2 className="font-display text-lg font-semibold mb-1">Speakers</h2>
      <p className="text-sm text-muted-foreground">The speaker pipeline is run by the Business &amp; Marketing cohort.</p>
    </Card>
  );

  const orgName = (id: string) => orgs.find((o) => o.id === id)?.name;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Speakers</h1>
          <SectionExplainer text="Guest-speaker pipeline. Inviting someone from a target company is warm client outreach: link the speaker to their org." className="mt-0.5" />
        </div>
        {canWrite && <Button size="sm" className="gap-1.5" onClick={() => setOpen(true)}><Plus className="h-3.5 w-3.5" /> Add speaker</Button>}
      </div>

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
        {STAGES.map((stage) => {
          const col = rows.filter((r) => r.status === stage);
          return (
            <div key={stage} className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <p className="text-[10px] font-mono uppercase tracking-wider font-semibold text-muted-foreground">{LABELS[stage]}</p>
                <span className="text-[10px] font-mono text-muted-foreground">{col.length}</span>
              </div>
              {col.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-center"><p className="text-[10px] text-muted-foreground">Empty</p></div>
              ) : col.map((r) => (
                <Card key={r.id} className="card-hover">
                  <CardContent className="p-3 space-y-1.5">
                    <p className="text-xs font-semibold leading-snug">{r.name}</p>
                    {r.affiliation && <p className="text-[10px] text-muted-foreground">{r.affiliation}</p>}
                    {r.topic && <p className="text-[11px] leading-snug">{r.topic}</p>}
                    <div className="flex flex-wrap gap-1">
                      {r.organization_id && orgName(r.organization_id) && (
                        <Badge variant="outline" className="text-[8px] font-mono gap-1"><Building2 className="h-2.5 w-2.5" />{orgName(r.organization_id)}</Badge>
                      )}
                      {r.proposed_date && (
                        <span className="text-[9px] font-mono text-muted-foreground flex items-center gap-1">
                          <CalendarDays className="h-2.5 w-2.5" />{new Date(r.proposed_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      )}
                    </div>
                    {canWrite && (
                      <div className="flex items-center justify-between pt-1 border-t">
                        <button onClick={() => claim(r)} title={r.owner_user_id ? (r.owner_user_id === user?.id ? "Release" : names[r.owner_user_id]) : "Claim"}
                          className={`text-[9px] font-mono flex items-center gap-1 ${r.owner_user_id === user?.id ? "text-accent-foreground font-semibold" : "text-muted-foreground hover:text-foreground"}`}>
                          <Hand className="h-2.5 w-2.5" />{r.owner_user_id ? (names[r.owner_user_id]?.split(" ")[0] || "Owned") : "Claim"}
                        </button>
                        <div className="flex items-center gap-0.5">
                          {STAGES.indexOf(r.status as Stage) > 0 && <button onClick={() => move(r, -1)} className="p-0.5 text-muted-foreground hover:text-foreground" title="Back"><ChevronLeft className="h-3 w-3" /></button>}
                          {STAGES.indexOf(r.status as Stage) < STAGES.length - 1 && <button onClick={() => move(r, 1)} className="p-0.5 text-muted-foreground hover:text-foreground" title="Advance"><ChevronRight className="h-3 w-3" /></button>}
                          {isLeadership && <button onClick={() => decline(r)} className="p-0.5 text-[9px] text-muted-foreground hover:text-destructive ml-0.5" title="Declined">✕</button>}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          );
        })}
      </div>

      {rows.length === 0 && (
        <Card className="py-10 text-center">
          <Mic className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No speakers yet.</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Add an industry practitioner, an alum, or someone from a company you want as a client.</p>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add a speaker</DialogTitle></DialogHeader>
          <form onSubmit={create} className="space-y-4">
            <div className="space-y-2"><Label>Name</Label><Input name="name" required maxLength={120} /></div>
            <div className="space-y-2"><Label>Affiliation</Label><Input name="affiliation" maxLength={160} placeholder="e.g. Rantec, or Cal Poly alum '22" /></div>
            <div className="space-y-2"><Label>Topic</Label><Input name="topic" maxLength={200} placeholder="What would they talk about?" /></div>
            <div className="space-y-2">
              <Label>Link to a company (optional)</Label>
              <Select value={orgId} onValueChange={setOrgId}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {orgs.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Contact</Label><Input name="contact" maxLength={200} placeholder="email / LinkedIn" /></div>
              <div className="space-y-2"><Label>Target date</Label><Input name="proposed_date" type="date" /></div>
            </div>
            <Button type="submit" className="w-full">Add to pipeline</Button>
          </form>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
