import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sparkles, Check, X, Pencil, Loader2, Shield, ListChecks, DollarSign } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

type Cohort = "software" | "hardware" | "mechanical" | "ops";
type Difficulty = "easy" | "medium" | "hard" | "expert";
type DrillType =
  | "multiple_choice" | "short_answer" | "scenario_analysis"
  | "prioritization" | "debugging_diagnosis" | "design_critique" | "mini_case";

const COHORT_LABELS: Record<Cohort, string> = {
  software: "Software / Systems",
  hardware: "Hardware / Embedded",
  mechanical: "Mechanical / Mfg",
  ops: "Ops / Business",
};

const TYPE_LABELS: Record<DrillType, string> = {
  multiple_choice: "Multiple Choice",
  short_answer: "Short Answer",
  scenario_analysis: "Scenario Analysis",
  prioritization: "Prioritization",
  debugging_diagnosis: "Debugging Diagnosis",
  design_critique: "Design Critique",
  mini_case: "Mini Case",
};

const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  easy: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  medium: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  hard: "bg-orange-500/10 text-orange-600 border-orange-500/30",
  expert: "bg-red-500/10 text-red-600 border-red-500/30",
};

export default function GrindAdmin() {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState("generate");

  // Generator state
  const [cohort, setCohort] = useState<Cohort>("software");
  const [category, setCategory] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [drillType, setDrillType] = useState<DrillType>("scenario_analysis");
  const [count, setCount] = useState(5);
  const [generating, setGenerating] = useState(false);

  // Review queue state
  const [pending, setPending] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [loadingQueue, setLoadingQueue] = useState(false);

  // Training cost dashboard state
  const [usage, setUsage] = useState<any | null>(null);
  const [settings, setSettings] = useState<any | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  const fetchUsage = async () => {
    const [usageRes, setRes] = await Promise.all([
      supabase.rpc("training_ai_usage_summary"),
      supabase.from("training_ai_settings").select("*").eq("id", 1).maybeSingle(),
    ]);
    if (usageRes.data) setUsage(usageRes.data);
    if (setRes.data) setSettings(setRes.data);
  };

  useEffect(() => {
    if (isAdmin) fetchUsage();
  }, [isAdmin]);

  const saveSettings = async (patch: Partial<{ monthly_call_cap: number; per_user_daily_cap: number; enabled_drill_types: string[] }>) => {
    setSavingSettings(true);
    const { error } = await supabase.from("training_ai_settings").update(patch).eq("id", 1);
    setSavingSettings(false);
    if (error) return toast.error(error.message);
    toast.success("Settings saved");
    fetchUsage();
  };

  const fetchPending = async () => {
    setLoadingQueue(true);
    const { data } = await supabase
      .from("drills")
      .select("*")
      .eq("status", "pending_review")
      .order("created_at", { ascending: false });
    setPending(data || []);
    setLoadingQueue(false);
  };

  useEffect(() => {
    if (isAdmin) fetchPending();
  }, [isAdmin]);

  const handleGenerate = async () => {
    if (!category.trim()) {
      toast.error("Category is required (e.g. 'Debugging', 'GTM', 'CAD').");
      return;
    }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-drills", {
        body: {
          cohort, category: category.trim(),
          difficulty, drill_type: drillType, count,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).message || (data as any).error);
      const created = (data as any)?.drafts_created ?? 0;
      const dupes = (data as any)?.duplicates_skipped ?? 0;
      toast.success(`Generated ${created} draft drill${created === 1 ? "" : "s"}`, {
        description: dupes > 0 ? `${dupes} duplicate${dupes === 1 ? "" : "s"} skipped` : undefined,
      });
      setTab("review");
      fetchPending();
    } catch (e: any) {
      toast.error("Generation failed", { description: e?.message || "Try again." });
    } finally {
      setGenerating(false);
    }
  };

  const handleApprove = async (id: string) => {
    const { error } = await supabase.from("drills").update({ status: "published" }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Published");
    fetchPending();
  };

  const handleReject = async (id: string) => {
    const { error } = await supabase.from("drills").update({ status: "archived" }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Rejected");
    fetchPending();
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    const { id, title, prompt, scenario, model_answer, rubric, why_it_matters, estimated_minutes, xp_reward } = editing;
    const { error } = await supabase.from("drills").update({
      title, prompt, scenario, model_answer, rubric, why_it_matters,
      estimated_minutes, xp_reward,
    }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Saved");
    setEditing(null);
    fetchPending();
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center py-20 text-muted-foreground">
        <Shield className="h-12 w-12 mb-3 opacity-30" />
        <p className="text-sm">Admin access required.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="font-display text-2xl font-bold flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          Grind Admin
        </h1>
        <p className="text-xs text-muted-foreground font-mono">
          Generate and publish AI-drafted training drills
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="generate" className="gap-2">
            <Sparkles className="h-4 w-4" /> Generate
          </TabsTrigger>
          <TabsTrigger value="review" className="gap-2">
            <ListChecks className="h-4 w-4" />
            Review Queue {pending.length > 0 && <Badge variant="secondary" className="ml-1">{pending.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="generate" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">AI Drill Generator</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Cohort</Label>
                  <Select value={cohort} onValueChange={(v) => setCohort(v as Cohort)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(COHORT_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Category</Label>
                  <Input
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="e.g. Debugging, GTM, CAD, Sensor Integration"
                  />
                </div>
                <div>
                  <Label>Difficulty</Label>
                  <Select value={difficulty} onValueChange={(v) => setDifficulty(v as Difficulty)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                      <SelectItem value="expert">Expert</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Drill Type</Label>
                  <Select value={drillType} onValueChange={(v) => setDrillType(v as DrillType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(TYPE_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Number to Generate (1–10)</Label>
                  <Input
                    type="number" min={1} max={10}
                    value={count}
                    onChange={(e) => setCount(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between pt-2">
                <p className="text-xs text-muted-foreground">
                  Drafts go to the review queue. Nothing is published automatically.
                </p>
                <Button onClick={handleGenerate} disabled={generating} className="gap-2">
                  {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {generating ? "Generating…" : "Generate Drafts"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="review" className="mt-6 space-y-4">
          {loadingQueue ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : pending.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
              No drills awaiting review. Generate some to get started.
            </CardContent></Card>
          ) : (
            pending.map((d) => (
              <Card key={d.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <CardTitle className="text-base">{d.title}</CardTitle>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <Badge variant="outline">{COHORT_LABELS[d.cohort as Cohort]}</Badge>
                        <Badge variant="outline">{d.category}</Badge>
                        <Badge variant="outline" className={DIFFICULTY_COLORS[d.difficulty as Difficulty]}>
                          {d.difficulty}
                        </Badge>
                        <Badge variant="outline">{TYPE_LABELS[d.drill_type as DrillType]}</Badge>
                        <Badge variant="outline">{d.estimated_minutes}m · {d.xp_reward} XP</Badge>
                      </div>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <Button size="sm" variant="outline" onClick={() => setEditing({ ...d })}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleReject(d.id)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" onClick={() => handleApprove(d.id)} className="gap-1">
                        <Check className="h-3.5 w-3.5" /> Publish
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div>
                    <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide mb-1">Prompt</p>
                    <p className="whitespace-pre-wrap">{d.prompt}</p>
                  </div>
                  {d.scenario && (
                    <div>
                      <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide mb-1">Scenario</p>
                      <p className="whitespace-pre-wrap text-muted-foreground">{d.scenario}</p>
                    </div>
                  )}
                  {d.options && (
                    <div>
                      <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide mb-1">Options</p>
                      <ol className="list-decimal list-inside space-y-0.5 text-muted-foreground">
                        {(d.options as string[]).map((o, i) => <li key={i}>{o}</li>)}
                      </ol>
                      {d.correct_answer !== null && (
                        <p className="text-xs text-emerald-600 mt-1">
                          Correct: {Array.isArray(d.correct_answer) ? d.correct_answer.join(" → ") : String(Number(d.correct_answer) + 1)}
                        </p>
                      )}
                    </div>
                  )}
                  {d.model_answer && (
                    <div>
                      <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide mb-1">Model Answer</p>
                      <p className="whitespace-pre-wrap text-muted-foreground">{d.model_answer}</p>
                    </div>
                  )}
                  {d.why_it_matters && (
                    <div className="rounded-md bg-muted/40 p-3">
                      <p className="font-medium text-xs uppercase tracking-wide mb-1">Why this matters</p>
                      <p className="text-muted-foreground">{d.why_it_matters}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Drill</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label>Title</Label>
                <Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
              </div>
              <div>
                <Label>Prompt</Label>
                <Textarea rows={3} value={editing.prompt || ""} onChange={(e) => setEditing({ ...editing, prompt: e.target.value })} />
              </div>
              <div>
                <Label>Scenario</Label>
                <Textarea rows={4} value={editing.scenario || ""} onChange={(e) => setEditing({ ...editing, scenario: e.target.value })} />
              </div>
              <div>
                <Label>Model Answer</Label>
                <Textarea rows={4} value={editing.model_answer || ""} onChange={(e) => setEditing({ ...editing, model_answer: e.target.value })} />
              </div>
              <div>
                <Label>Rubric</Label>
                <Textarea rows={3} value={editing.rubric || ""} onChange={(e) => setEditing({ ...editing, rubric: e.target.value })} />
              </div>
              <div>
                <Label>Why It Matters</Label>
                <Textarea rows={2} value={editing.why_it_matters || ""} onChange={(e) => setEditing({ ...editing, why_it_matters: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Est. Minutes</Label>
                  <Input type="number" value={editing.estimated_minutes} onChange={(e) => setEditing({ ...editing, estimated_minutes: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>XP Reward</Label>
                  <Input type="number" value={editing.xp_reward} onChange={(e) => setEditing({ ...editing, xp_reward: Number(e.target.value) })} />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={handleSaveEdit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}