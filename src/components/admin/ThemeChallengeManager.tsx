import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, Sparkles, Trophy } from "lucide-react";
import { toast } from "sonner";

type Cohort = "software" | "hardware" | "mechanical" | "ops";
const COHORTS: Cohort[] = ["software", "hardware", "mechanical", "ops"];

/**
 * Admin surface for Theme Weeks + Challenges.
 * Both feed deterministic recommenders (recommend_theme_drills,
 * recommend_challenge_drills). Zero runtime AI cost — pure curation.
 */
export default function ThemeChallengeManager() {
  const [themes, setThemes] = useState<any[]>([]);
  const [challenges, setChallenges] = useState<any[]>([]);

  // Theme form
  const [tCohort, setTCohort] = useState<Cohort>("software");
  const [tName, setTName] = useState("");
  const [tDesc, setTDesc] = useState("");
  const [tCats, setTCats] = useState("");
  const [tStart, setTStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [tEnd, setTEnd] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });

  // Challenge form
  const [cCohort, setCCohort] = useState<Cohort>("software");
  const [cName, setCName] = useState("");
  const [cDesc, setCDesc] = useState("");
  const [cCats, setCCats] = useState("");
  const [cStart, setCStart] = useState(() => new Date().toISOString().slice(0, 16));
  const [cEnd, setCEnd] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().slice(0, 16);
  });
  const [cBonus, setCBonus] = useState("1.5");

  const load = async () => {
    const [tRes, cRes] = await Promise.all([
      supabase.from("training_themes").select("*").order("starts_on", { ascending: false }),
      supabase.from("training_challenges").select("*").order("starts_at", { ascending: false }),
    ]);
    setThemes((tRes.data as any[]) || []);
    setChallenges((cRes.data as any[]) || []);
  };
  useEffect(() => { void load(); }, []);

  const splitCats = (s: string) =>
    s.split(",").map((x) => x.trim()).filter(Boolean);

  const addTheme = async () => {
    if (!tName.trim()) return toast.error("Name is required");
    const { error } = await supabase.from("training_themes").insert({
      cohort: tCohort,
      name: tName.trim(),
      description: tDesc.trim() || null,
      category_filter: splitCats(tCats),
      starts_on: tStart,
      ends_on: tEnd,
    } as any);
    if (error) return toast.error(error.message);
    toast.success("Theme added");
    setTName(""); setTDesc(""); setTCats("");
    void load();
  };

  const addChallenge = async () => {
    if (!cName.trim()) return toast.error("Name is required");
    const bonus = Number(cBonus) || 1;
    const { error } = await supabase.from("training_challenges").insert({
      cohort: cCohort,
      name: cName.trim(),
      description: cDesc.trim() || null,
      category_filter: splitCats(cCats),
      starts_at: new Date(cStart).toISOString(),
      ends_at: new Date(cEnd).toISOString(),
      bonus_xp_multiplier: bonus,
    } as any);
    if (error) return toast.error(error.message);
    toast.success("Challenge added");
    setCName(""); setCDesc(""); setCCats("");
    void load();
  };

  const removeTheme = async (id: string) => {
    await supabase.from("training_themes").delete().eq("id", id);
    setThemes((prev) => prev.filter((t) => t.id !== id));
  };
  const removeChallenge = async (id: string) => {
    await supabase.from("training_challenges").delete().eq("id", id);
    setChallenges((prev) => prev.filter((c) => c.id !== id));
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Themes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent-foreground" /> Theme weeks
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Curate a focus area for a cohort. Members see a "This week: …" lane in Grind built from existing drills. Zero AI cost.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Cohort</Label>
              <Select value={tCohort} onValueChange={(v) => setTCohort(v as Cohort)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COHORTS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Theme name</Label>
              <Input value={tName} onChange={(e) => setTName(e.target.value)} placeholder="e.g. Embedded Debugging Week" />
            </div>
            <div className="md:col-span-2">
              <Label>Description (optional)</Label>
              <Textarea rows={2} value={tDesc} onChange={(e) => setTDesc(e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <Label>Category filter (comma-separated · empty = all categories in cohort)</Label>
              <Input value={tCats} onChange={(e) => setTCats(e.target.value)} placeholder="Debugging, Sensors, RTOS" />
            </div>
            <div>
              <Label>Starts</Label>
              <Input type="date" value={tStart} onChange={(e) => setTStart(e.target.value)} />
            </div>
            <div>
              <Label>Ends</Label>
              <Input type="date" value={tEnd} onChange={(e) => setTEnd(e.target.value)} />
            </div>
          </div>
          <Button onClick={addTheme} className="gap-2"><Plus className="h-4 w-4" /> Add theme</Button>

          {themes.length > 0 && (
            <div className="space-y-2 pt-2 border-t">
              {themes.map((t) => {
                const active = t.starts_on <= today && today <= t.ends_on;
                return (
                  <div key={t.id} className="flex items-center gap-3 rounded-md border p-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{t.name}</span>
                        <Badge variant="outline" className="text-[10px]">{t.cohort}</Badge>
                        {active && <Badge className="text-[10px]">Active</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t.starts_on} → {t.ends_on}
                        {t.category_filter?.length > 0 && ` · ${t.category_filter.join(", ")}`}
                      </p>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => removeTheme(t.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Challenges */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" /> Challenges
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Time-boxed bonus surfaces. Members get a high-priority lane with optional XP multiplier. Reuses existing drills.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Cohort</Label>
              <Select value={cCohort} onValueChange={(v) => setCCohort(v as Cohort)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COHORTS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Challenge name</Label>
              <Input value={cName} onChange={(e) => setCName(e.target.value)} placeholder="e.g. 72-hour Sensor Sprint" />
            </div>
            <div className="md:col-span-2">
              <Label>Description (optional)</Label>
              <Textarea rows={2} value={cDesc} onChange={(e) => setCDesc(e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <Label>Category filter (empty = all)</Label>
              <Input value={cCats} onChange={(e) => setCCats(e.target.value)} placeholder="Debugging, Sensors" />
            </div>
            <div>
              <Label>Starts</Label>
              <Input type="datetime-local" value={cStart} onChange={(e) => setCStart(e.target.value)} />
            </div>
            <div>
              <Label>Ends</Label>
              <Input type="datetime-local" value={cEnd} onChange={(e) => setCEnd(e.target.value)} />
            </div>
            <div>
              <Label>Bonus XP multiplier</Label>
              <Input type="number" step="0.5" min="1" max="5" value={cBonus} onChange={(e) => setCBonus(e.target.value)} />
            </div>
          </div>
          <Button onClick={addChallenge} className="gap-2"><Plus className="h-4 w-4" /> Add challenge</Button>

          {challenges.length > 0 && (
            <div className="space-y-2 pt-2 border-t">
              {challenges.map((c) => {
                const now = new Date();
                const active = new Date(c.starts_at) <= now && now <= new Date(c.ends_at);
                return (
                  <div key={c.id} className="flex items-center gap-3 rounded-md border p-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium truncate">{c.name}</span>
                        <Badge variant="outline" className="text-[10px]">{c.cohort}</Badge>
                        {Number(c.bonus_xp_multiplier) > 1 && (
                          <Badge className="text-[10px]">{c.bonus_xp_multiplier}× XP</Badge>
                        )}
                        {active && <Badge className="text-[10px]">Active</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(c.starts_at).toLocaleString()} → {new Date(c.ends_at).toLocaleString()}
                      </p>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => removeChallenge(c.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}