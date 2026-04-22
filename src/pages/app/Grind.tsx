import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Flame, Trophy, Zap, Target, Clock, ChevronRight } from "lucide-react";
import { toast } from "sonner";

type Cohort = "software" | "hardware" | "mechanical" | "ops";

interface Drill {
  id: string;
  title: string;
  cohort: Cohort;
  category: string;
  difficulty: "easy" | "medium" | "hard" | "expert";
  drill_type: string;
  estimated_minutes: number;
  xp_reward: number;
  prompt: string;
  scenario: string | null;
  options: any;
  correct_answer: any;
  rubric: string | null;
  model_answer: string | null;
  why_it_matters: string | null;
  tags: string[];
}

interface Progress {
  total_xp: number;
  current_streak: number;
  longest_streak: number;
  drills_completed: number;
  drills_correct: number;
}

interface LeaderboardRow {
  user_id: string;
  full_name: string;
  total_xp: number;
  current_streak: number;
  drills_completed: number;
  accuracy: number;
  rank: number;
}

const COHORT_LABELS: Record<Cohort, string> = {
  software: "Software / Systems",
  hardware: "Hardware / Embedded",
  mechanical: "Mechanical / Mfg",
  ops: "Ops / Business",
};

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
  medium: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
  hard: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20",
  expert: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20",
};

export default function Grind() {
  const { user } = useAuth();
  const [recommended, setRecommended] = useState<any[]>([]);
  const [allDrills, setAllDrills] = useState<Drill[]>([]);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [cohortFilter, setCohortFilter] = useState<Cohort | "all">("all");
  const [activeDrill, setActiveDrill] = useState<Drill | null>(null);

  useEffect(() => {
    if (!user) return;
    void loadAll();
  }, [user, cohortFilter]);

  async function loadAll() {
    const cohortArg = cohortFilter === "all" ? null : cohortFilter;
    const [recRes, drillsRes, progRes, lbRes] = await Promise.all([
      supabase.rpc("recommend_drills", { p_cohort: cohortArg as any, p_limit: 6 }),
      supabase.from("drills").select("*").eq("status", "published").order("created_at", { ascending: false }),
      supabase.from("grind_progress").select("*").eq("user_id", user!.id).maybeSingle(),
      supabase.rpc("grind_leaderboard", { p_cohort: cohortArg as any, p_limit: 10 }),
    ]);
    if (recRes.data) setRecommended(recRes.data);
    if (drillsRes.data) setAllDrills(drillsRes.data as Drill[]);
    if (progRes.data) setProgress(progRes.data as Progress);
    if (lbRes.data) setLeaderboard(lbRes.data as LeaderboardRow[]);
  }

  const filteredDrills = useMemo(() => {
    if (cohortFilter === "all") return allDrills;
    return allDrills.filter((d) => d.cohort === cohortFilter);
  }, [allDrills, cohortFilter]);

  const level = progress ? Math.max(1, Math.floor(progress.total_xp / 100) + 1) : 1;
  const xpInLevel = progress ? progress.total_xp % 100 : 0;
  const accuracy = progress && progress.drills_completed > 0
    ? Math.round((progress.drills_correct / progress.drills_completed) * 100)
    : 0;

  return (
    <div className="container mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Grind</h1>
          <p className="text-sm text-muted-foreground">Cohort-specific training drills. Build skill, build streak.</p>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard icon={<Zap className="h-4 w-4" />} label="Level" value={String(level)} sub={`${xpInLevel}/100 XP`} />
        <StatCard icon={<Trophy className="h-4 w-4" />} label="Total XP" value={String(progress?.total_xp ?? 0)} sub={`${progress?.drills_completed ?? 0} drills`} />
        <StatCard icon={<Flame className="h-4 w-4" />} label="Streak" value={String(progress?.current_streak ?? 0)} sub={`Best ${progress?.longest_streak ?? 0}`} />
        <StatCard icon={<Target className="h-4 w-4" />} label="Accuracy" value={`${accuracy}%`} sub={`${progress?.drills_correct ?? 0} correct`} />
      </div>

      {/* Cohort filter */}
      <Tabs value={cohortFilter} onValueChange={(v) => setCohortFilter(v as any)}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="software">Software</TabsTrigger>
          <TabsTrigger value="hardware">Hardware</TabsTrigger>
          <TabsTrigger value="mechanical">Mechanical</TabsTrigger>
          <TabsTrigger value="ops">Ops</TabsTrigger>
        </TabsList>

        <TabsContent value={cohortFilter} className="space-y-6 mt-6">
          {/* Recommended */}
          {recommended.length > 0 && (
            <section>
              <h2 className="mb-3 font-display text-lg font-semibold">Recommended for you</h2>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {recommended.map((r) => (
                  <RecCard key={r.id} drill={r} onStart={() => {
                    const full = allDrills.find((d) => d.id === r.id);
                    if (full) setActiveDrill(full);
                  }} />
                ))}
              </div>
            </section>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Drill list */}
            <section className="lg:col-span-2">
              <h2 className="mb-3 font-display text-lg font-semibold">All drills ({filteredDrills.length})</h2>
              <div className="space-y-2">
                {filteredDrills.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setActiveDrill(d)}
                    className="w-full rounded-lg border bg-card p-4 text-left transition-colors hover:bg-accent/50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{d.title}</span>
                          <Badge variant="outline" className={DIFFICULTY_COLORS[d.difficulty]}>{d.difficulty}</Badge>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span>{COHORT_LABELS[d.cohort]}</span>
                          <span>·</span>
                          <span>{d.category.replace(/_/g, " ")}</span>
                          <span>·</span>
                          <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{d.estimated_minutes} min</span>
                          <span>·</span>
                          <span className="text-amber-600 dark:text-amber-400">+{d.xp_reward} XP</span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </div>
                  </button>
                ))}
              </div>
            </section>

            {/* Leaderboard */}
            <section>
              <h2 className="mb-3 font-display text-lg font-semibold">Leaderboard</h2>
              <Card>
                <CardContent className="p-0">
                  {leaderboard.length === 0 ? (
                    <p className="p-4 text-sm text-muted-foreground">Be the first to ship a drill.</p>
                  ) : (
                    <div className="divide-y">
                      {leaderboard.map((row) => (
                        <div key={row.user_id} className="flex items-center justify-between p-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="font-mono text-xs text-muted-foreground w-6">#{row.rank}</span>
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium">{row.full_name}</div>
                              <div className="text-xs text-muted-foreground">{row.drills_completed} drills · {row.accuracy}%</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-bold">{row.total_xp} XP</div>
                            {row.current_streak > 0 && (
                              <div className="text-xs text-orange-500 inline-flex items-center gap-1">
                                <Flame className="h-3 w-3" />{row.current_streak}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>
          </div>
        </TabsContent>
      </Tabs>

      {activeDrill && (
        <DrillPlayer
          drill={activeDrill}
          onClose={() => setActiveDrill(null)}
          onSubmitted={() => { setActiveDrill(null); void loadAll(); }}
        />
      )}
    </div>
  );
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
        <div className="mt-1 font-display text-2xl font-bold">{value}</div>
        <div className="text-xs text-muted-foreground">{sub}</div>
      </CardContent>
    </Card>
  );
}

function RecCard({ drill, onStart }: { drill: any; onStart: () => void }) {
  return (
    <Card className="cursor-pointer transition-all hover:shadow-md" onClick={onStart}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <Badge variant="outline" className={DIFFICULTY_COLORS[drill.difficulty]}>{drill.difficulty}</Badge>
          <span className="text-xs text-amber-600 dark:text-amber-400">+{drill.xp_reward} XP</span>
        </div>
        <CardTitle className="text-base mt-2">{drill.title}</CardTitle>
        <CardDescription className="text-xs">{drill.reason} · {drill.estimated_minutes} min</CardDescription>
      </CardHeader>
    </Card>
  );
}

function DrillPlayer({ drill, onClose, onSubmitted }: { drill: Drill; onClose: () => void; onSubmitted: () => void }) {
  const [response, setResponse] = useState<any>(null);
  const [shortText, setShortText] = useState("");
  const [phase, setPhase] = useState<"answering" | "reviewing">("answering");
  const [selfScore, setSelfScore] = useState<number>(70);
  const [startedAt] = useState(Date.now());
  const [submitting, setSubmitting] = useState(false);

  const isMC = drill.drill_type === "multiple_choice";
  const isPrioritization = drill.drill_type === "prioritization";
  const options: any[] = Array.isArray(drill.options) ? drill.options : [];

  function checkCorrect(): boolean | null {
    if (isMC) return response === drill.correct_answer;
    if (isPrioritization) return JSON.stringify(response) === JSON.stringify(drill.correct_answer);
    return null;
  }

  async function handleReveal() {
    if (isMC && !response) return toast.error("Select an answer first");
    if (!isMC && !isPrioritization && !shortText.trim()) return toast.error("Write your answer first");
    setPhase("reviewing");
  }

  async function handleSubmit() {
    setSubmitting(true);
    const isCorrect = checkCorrect();
    const finalResponse = isMC || isPrioritization ? response : { text: shortText };
    const elapsed = Math.round((Date.now() - startedAt) / 1000);
    const { data, error } = await supabase.rpc("submit_drill_attempt", {
      p_drill_id: drill.id,
      p_response: finalResponse,
      p_is_correct: isCorrect,
      p_self_score: isMC || isPrioritization ? null : selfScore,
      p_time_spent_seconds: elapsed,
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    const result = data as any;
    toast.success(`+${result.xp_earned} XP · Streak ${result.current_streak} 🔥`);
    onSubmitted();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={DIFFICULTY_COLORS[drill.difficulty]}>{drill.difficulty}</Badge>
            <Badge variant="secondary">{drill.category.replace(/_/g, " ")}</Badge>
            <span className="text-xs text-muted-foreground">+{drill.xp_reward} XP</span>
          </div>
          <DialogTitle className="mt-2">{drill.title}</DialogTitle>
          {drill.scenario && <DialogDescription className="italic">{drill.scenario}</DialogDescription>}
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg bg-muted/50 p-4 text-sm whitespace-pre-wrap">{drill.prompt}</div>

          {phase === "answering" && (
            <>
              {isMC && (
                <RadioGroup value={response ?? ""} onValueChange={(v) => setResponse(v)}>
                  {options.map((opt: any) => (
                    <div key={opt.key} className="flex items-start gap-2 rounded-md border p-3 hover:bg-accent/30">
                      <RadioGroupItem value={opt.key} id={opt.key} className="mt-0.5" />
                      <Label htmlFor={opt.key} className="cursor-pointer text-sm">{opt.label}</Label>
                    </div>
                  ))}
                </RadioGroup>
              )}

              {isPrioritization && (
                <PrioritizationInput options={options} value={response} onChange={setResponse} />
              )}

              {!isMC && !isPrioritization && (
                <Textarea
                  placeholder="Write your answer..."
                  rows={6}
                  value={shortText}
                  onChange={(e) => setShortText(e.target.value)}
                />
              )}

              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={onClose}>Cancel</Button>
                <Button onClick={handleReveal}>Reveal answer</Button>
              </div>
            </>
          )}

          {phase === "reviewing" && (
            <div className="space-y-4">
              {(isMC || isPrioritization) && (
                <div className={`rounded-md p-3 text-sm font-medium ${checkCorrect() ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-rose-500/10 text-rose-700 dark:text-rose-400"}`}>
                  {checkCorrect() ? "✓ Correct" : "✗ Not quite"}
                </div>
              )}
              {drill.rubric && (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Rubric</div>
                  <div className="mt-1 rounded-md bg-muted/50 p-3 text-sm">{drill.rubric}</div>
                </div>
              )}
              {drill.model_answer && (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Model answer</div>
                  <div className="mt-1 rounded-md bg-muted/50 p-3 text-sm whitespace-pre-wrap">{drill.model_answer}</div>
                </div>
              )}
              {drill.why_it_matters && (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Why this matters</div>
                  <div className="mt-1 rounded-md border-l-2 border-primary bg-primary/5 p-3 text-sm">{drill.why_it_matters}</div>
                </div>
              )}
              {!isMC && !isPrioritization && (
                <div>
                  <Label className="text-xs uppercase tracking-wide">Self-score (0–100)</Label>
                  <input
                    type="range" min={0} max={100} step={5}
                    value={selfScore}
                    onChange={(e) => setSelfScore(parseInt(e.target.value))}
                    className="mt-2 w-full"
                  />
                  <div className="text-sm font-bold text-center">{selfScore}</div>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={onClose}>Close</Button>
                <Button onClick={handleSubmit} disabled={submitting}>
                  {submitting ? "Saving..." : "Log attempt"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PrioritizationInput({ options, value, onChange }: { options: any[]; value: any; onChange: (v: any) => void }) {
  const order: string[] = Array.isArray(value) ? value : [];
  const remaining = options.filter((o: any) => !order.includes(o.key));

  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground">Click items in priority order (1st = highest):</div>
      {order.length > 0 && (
        <ol className="space-y-1">
          {order.map((k, i) => {
            const opt = options.find((o: any) => o.key === k);
            return (
              <li key={k} className="flex items-center justify-between rounded-md border bg-accent/30 p-2 text-sm">
                <span><span className="font-bold mr-2">{i + 1}.</span>{opt?.label}</span>
                <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => onChange(order.filter((x) => x !== k))}>remove</button>
              </li>
            );
          })}
        </ol>
      )}
      {remaining.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {remaining.map((o: any) => (
            <button key={o.key} type="button" onClick={() => onChange([...order, o.key])} className="rounded-md border px-3 py-1 text-sm hover:bg-accent/50">
              + {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
