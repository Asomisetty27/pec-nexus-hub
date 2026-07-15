// Brand Studio: the work queue for the Brand & Fundraising section of the
// Business & Marketing cohort. Posts, events, fundraisers, and assets move
// idea -> drafting -> ready -> published -> recapped. Every card is one work
// unit on the brand line; finish one, pull the next.
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
import { Megaphone, Plus, ChevronRight, ChevronLeft, Hand, CalendarDays, Link2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { SectionExplainer } from "@/components/ui/SectionExplainer";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const item = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.2 } } };

const STATUSES = ["idea", "drafting", "ready", "published", "recapped"] as const;
type Status = (typeof STATUSES)[number];

const STATUS_LABELS: Record<Status, string> = {
  idea: "Ideas",
  drafting: "Drafting",
  ready: "Ready",
  published: "Published",
  recapped: "Recapped",
};

const KINDS = [
  { value: "post", label: "Post" },
  { value: "event", label: "Event" },
  { value: "fundraiser", label: "Fundraiser" },
  { value: "asset", label: "Asset" },
];

const kindBadgeClass: Record<string, string> = {
  post: "bg-accent/10 text-accent-foreground border-accent/30",
  event: "bg-primary/10 text-primary border-primary/30",
  fundraiser: "bg-success/10 text-success border-success/30",
  asset: "bg-muted/50 text-muted-foreground border-border",
};

export default function BrandStudio() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [kind, setKind] = useState("post");
  const [loading, setLoading] = useState(true);

  const fetchItems = async () => {
    const { data } = await supabase
      .from("brand_items" as any)
      .select("*")
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });
    const rows = (data as any[]) || [];
    setItems(rows);
    const ids = [...new Set(rows.map((r) => r.owner_user_id).filter(Boolean))];
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("user_id, full_name").in("user_id", ids);
      const map: Record<string, string> = {};
      (profs || []).forEach((p: any) => { map[p.user_id] = p.full_name; });
      setProfiles(map);
    }
    setLoading(false);
  };

  useEffect(() => { fetchItems(); }, []);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const { error } = await supabase.from("brand_items" as any).insert({
      kind,
      title: f.get("title") as string,
      notes: (f.get("notes") as string) || null,
      due_date: (f.get("due_date") as string) || null,
      link: (f.get("link") as string) || null,
      created_by: user!.id,
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success("Added to the line");
    setDialogOpen(false);
    fetchItems();
  };

  const move = async (it: any, dir: 1 | -1) => {
    const idx = STATUSES.indexOf(it.status as Status);
    const next = STATUSES[idx + dir];
    if (!next) return;
    const { error } = await supabase.from("brand_items" as any)
      .update({ status: next, updated_at: new Date().toISOString() } as any)
      .eq("id", it.id);
    if (error) { toast.error(error.message); return; }
    fetchItems();
  };

  const claim = async (it: any) => {
    const mine = it.owner_user_id === user?.id;
    const { error } = await supabase.from("brand_items" as any)
      .update({ owner_user_id: mine ? null : user!.id, updated_at: new Date().toISOString() } as any)
      .eq("id", it.id);
    if (error) { toast.error(error.message); return; }
    toast.success(mine ? "Released" : "Claimed — it's yours");
    fetchItems();
  };

  if (loading) return <div className="space-y-4">{[1, 2].map(i => <Card key={i} className="h-40 animate-pulse bg-muted/30" />)}</div>;

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-5">
      <motion.div variants={item} className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Brand Studio</h1>
          <SectionExplainer text="The Brand & Fundraising line. Every card is one work unit: pull it, move it right, the queue feeds you the next." className="mt-0.5" />
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setDialogOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> New item
        </Button>
      </motion.div>

      <motion.div variants={item} className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
        {STATUSES.map((status) => {
          const col = items.filter((i) => i.status === status);
          return (
            <div key={status} className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <p className="text-[10px] font-mono uppercase tracking-wider font-semibold text-muted-foreground">
                  {STATUS_LABELS[status]}
                </p>
                <span className="text-[10px] font-mono text-muted-foreground">{col.length}</span>
              </div>
              {col.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-center">
                  <p className="text-[10px] text-muted-foreground">Empty</p>
                </div>
              ) : col.map((it) => (
                <Card key={it.id} className="card-hover">
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <Badge variant="outline" className={`text-[8px] font-mono uppercase shrink-0 ${kindBadgeClass[it.kind] || ""}`}>
                        {it.kind}
                      </Badge>
                      {it.due_date && (
                        <span className="text-[9px] font-mono text-muted-foreground flex items-center gap-1">
                          <CalendarDays className="h-2.5 w-2.5" />
                          {new Date(it.due_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-semibold leading-snug">{it.title}</p>
                    {it.notes && <p className="text-[10px] text-muted-foreground line-clamp-2">{it.notes}</p>}
                    {it.link && (
                      <a href={it.link} target="_blank" rel="noreferrer" className="text-[10px] text-accent-foreground flex items-center gap-1 hover:underline">
                        <Link2 className="h-2.5 w-2.5" /> link
                      </a>
                    )}
                    <div className="flex items-center justify-between pt-1 border-t">
                      <button
                        onClick={() => claim(it)}
                        className={`text-[9px] font-mono flex items-center gap-1 ${it.owner_user_id === user?.id ? "text-accent-foreground font-semibold" : "text-muted-foreground hover:text-foreground"}`}
                        title={it.owner_user_id ? (it.owner_user_id === user?.id ? "Release" : profiles[it.owner_user_id] || "Owned") : "Claim this"}
                      >
                        <Hand className="h-2.5 w-2.5" />
                        {it.owner_user_id ? (profiles[it.owner_user_id]?.split(" ")[0] || "Owned") : "Claim"}
                      </button>
                      <div className="flex items-center gap-0.5">
                        {STATUSES.indexOf(it.status as Status) > 0 && (
                          <button onClick={() => move(it, -1)} className="p-0.5 text-muted-foreground hover:text-foreground" title="Move back">
                            <ChevronLeft className="h-3 w-3" />
                          </button>
                        )}
                        {STATUSES.indexOf(it.status as Status) < STATUSES.length - 1 && (
                          <button onClick={() => move(it, 1)} className="p-0.5 text-muted-foreground hover:text-foreground" title="Advance">
                            <ChevronRight className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          );
        })}
      </motion.div>

      {items.length === 0 && (
        <motion.div variants={item}>
          <Card className="py-10 text-center">
            <Megaphone className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">The brand line is empty.</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Add the first post, event, or fundraiser to get the queue moving.</p>
          </Card>
        </motion.div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New brand item</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={kind} onValueChange={setKind}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {KINDS.map((k) => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Title</Label><Input name="title" required maxLength={200} placeholder="e.g. WOW week teaser reel" /></div>
            <div className="space-y-2"><Label>Notes</Label><Textarea name="notes" rows={2} maxLength={1000} placeholder="Angle, channel, who it's for" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Due date</Label><Input name="due_date" type="date" /></div>
              <div className="space-y-2"><Label>Link</Label><Input name="link" type="url" maxLength={500} placeholder="https://" /></div>
            </div>
            <Button type="submit" className="w-full">Add to the line</Button>
          </form>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
