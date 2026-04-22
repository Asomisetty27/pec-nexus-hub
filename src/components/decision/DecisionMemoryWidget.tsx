import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { BookMarked, Plus, Sparkles, ChevronRight, Tag } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const CATEGORIES = ["technical", "scope", "process", "vendor", "design", "client", "general"] as const;

type Decision = {
  id: string;
  project_id: string;
  title: string;
  rationale: string | null;
  alternatives_considered: string | null;
  affects: string[] | null;
  category: string;
  tags: string[] | null;
  decided_at: string;
};

type Related = {
  id: string;
  project_id: string;
  title: string;
  rationale: string | null;
  category: string;
  tags: string[] | null;
  decided_at: string;
  relevance: number;
};

export function DecisionMemoryWidget({
  projectId,
  onSaved,
}: {
  projectId: string;
  onSaved?: () => void;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [related, setRelated] = useState<Related[]>([]);
  const [relatedNames, setRelatedNames] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // form state
  const [title, setTitle] = useState("");
  const [rationale, setRationale] = useState("");
  const [alternatives, setAlternatives] = useState("");
  const [category, setCategory] = useState<string>("general");
  const [tagsInput, setTagsInput] = useState("");
  const [affectsInput, setAffectsInput] = useState("");

  const load = async () => {
    const { data: ds } = await supabase
      .from("decisions")
      .select("*")
      .eq("project_id", projectId)
      .order("decided_at", { ascending: false })
      .limit(20);
    setDecisions((ds as any) || []);

    // Build seed tags/category from most recent decision
    const seed = (ds || [])[0] as any;
    const { data: rel } = await supabase.rpc("find_related_decisions", {
      _project_id: projectId,
      _tags: seed?.tags || null,
      _category: seed?.category || null,
      _limit: 5,
    });
    const relRows = (rel as any[]) || [];
    setRelated(relRows);

    // Resolve project names for the related decisions (cross-project relevance)
    const otherProjIds = Array.from(new Set(relRows.map(r => r.project_id).filter(p => p !== projectId)));
    if (otherProjIds.length > 0) {
      const { data: projs } = await supabase.from("projects").select("id, name").in("id", otherProjIds);
      const map: Record<string, string> = {};
      for (const p of projs || []) map[(p as any).id] = (p as any).name;
      setRelatedNames(map);
    } else {
      setRelatedNames({});
    }
  };

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [projectId]);

  const reset = () => {
    setTitle(""); setRationale(""); setAlternatives("");
    setCategory("general"); setTagsInput(""); setAffectsInput("");
  };

  const save = async () => {
    if (!title.trim() || !user) { toast.error("Decision title is required"); return; }
    setSaving(true);
    const tags = tagsInput.split(",").map(t => t.trim()).filter(Boolean);
    const affects = affectsInput.split(",").map(t => t.trim()).filter(Boolean);
    const { error } = await supabase.from("decisions").insert({
      project_id: projectId,
      decided_by: user.id,
      title: title.trim(),
      rationale: rationale.trim() || null,
      alternatives_considered: alternatives.trim() || null,
      category,
      tags,
      affects,
    });
    setSaving(false);
    if (error) { toast.error(`Save failed: ${error.message}`); return; }
    toast.success("Decision logged");
    setOpen(false);
    reset();
    await load();
    onSaved?.();
  };

  const crossProject = related.filter(r => r.project_id !== projectId);
  const sameProject = related.filter(r => r.project_id === projectId && !decisions.slice(0, 3).find(d => d.id === r.id));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <BookMarked className="h-4 w-4 text-accent-foreground" />
          Decision Memory
          {decisions.length > 0 && <Badge variant="outline" className="text-[9px] font-mono">{decisions.length}</Badge>}
        </CardTitle>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="h-7 gap-1 text-[10px]">
              <Plus className="h-3 w-3" /> Log decision
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Log a decision</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">What was decided</Label>
                <Input placeholder="e.g. Use STM32H7 over RP2040 for the controller" value={title} onChange={e => setTitle(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Why</Label>
                <Textarea rows={3} placeholder="Reasoning, constraints, expected impact…" value={rationale} onChange={e => setRationale(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Alternatives considered</Label>
                <Textarea rows={2} placeholder="What else was on the table and why it was rejected" value={alternatives} onChange={e => setAlternatives(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Tags (comma-separated)</Label>
                  <Input placeholder="firmware, power, mcu" value={tagsInput} onChange={e => setTagsInput(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">What it affects (comma-separated)</Label>
                <Input placeholder="firmware, BOM, schedule" value={affectsInput} onChange={e => setAffectsInput(e.target.value)} />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
                <Button size="sm" onClick={save} disabled={saving || !title.trim()}>
                  {saving ? "Saving…" : "Log decision"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Recent decisions on this project */}
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">Recent on this project</p>
          {decisions.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">No decisions logged yet.</p>
          ) : decisions.slice(0, 3).map(d => (
            <div key={d.id} className="rounded-md border p-2.5">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-xs font-medium">{d.title}</p>
                <Badge variant="outline" className="text-[9px] font-mono">{d.category}</Badge>
              </div>
              {d.rationale && <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{d.rationale}</p>}
              {(d.tags && d.tags.length > 0) && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {d.tags.slice(0, 4).map(t => (
                    <span key={t} className="text-[9px] font-mono text-muted-foreground inline-flex items-center gap-0.5">
                      <Tag className="h-2.5 w-2.5" />{t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Related across projects */}
        {(crossProject.length > 0 || sameProject.length > 0) && (
          <div className="space-y-2 pt-2 border-t">
            <p className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-accent-foreground" /> Related decisions
            </p>
            {crossProject.map(r => (
              <button
                key={r.id}
                onClick={() => navigate(`/app/projects/${r.project_id}`)}
                className="w-full text-left rounded-md border p-2.5 hover:border-accent/40 hover:bg-muted/40 transition-all"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs font-medium truncate flex-1">{r.title}</p>
                  <Badge className="text-[9px] font-mono bg-accent/10 text-accent-foreground border-accent/30">
                    {relatedNames[r.project_id] || "other project"}
                  </Badge>
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                </div>
                {r.rationale && <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{r.rationale}</p>}
                <p className="text-[9px] text-muted-foreground/70 mt-0.5 font-mono">
                  {r.category} · relevance {r.relevance}
                </p>
              </button>
            ))}
            {sameProject.slice(0, 2).map(r => (
              <div key={r.id} className="rounded-md border border-dashed p-2.5 opacity-80">
                <p className="text-xs font-medium">{r.title}</p>
                <p className="text-[9px] text-muted-foreground font-mono">also on this project · relevance {r.relevance}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default DecisionMemoryWidget;