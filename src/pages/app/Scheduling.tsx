import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AvailabilityChips from "@/components/AvailabilityChips";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CalendarDays, Clock, Plus, Trash2, Users, Zap, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const item = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.2 } } };

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const HOURS = Array.from({ length: 14 }, (_, i) => i + 8); // 8am–9pm

interface AvailWindow {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  preference_weight: number;
}

export default function Scheduling() {
  const { user, profile } = useAuth();
  const [windows, setWindows] = useState<AvailWindow[]>([]);
  const [cohortWindows, setCohortWindows] = useState<any[]>([]);
  const [proposals, setProposals] = useState<any[]>([]);
  const [cohort, setCohort] = useState<any>(null);
  const [addDialog, setAddDialog] = useState(false);
  const [newDay, setNewDay] = useState(1);
  const [newStart, setNewStart] = useState("10:00");
  const [newEnd, setNewEnd] = useState("12:00");
  const [newWeight, setNewWeight] = useState(3);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [winRes, cohortRes] = await Promise.all([
        supabase.from("availability_windows").select("*").eq("user_id", user.id).order("day_of_week"),
        supabase.from("cohort_memberships").select("*, cohorts(*)").eq("user_id", user.id).limit(1).maybeSingle(),
      ]);
      setWindows((winRes.data as any[]) || []);
      setCohort(cohortRes.data);

      if (cohortRes.data?.cohort_id) {
        const [cwRes, propRes] = await Promise.all([
          supabase.from("availability_windows").select("*, profiles:user_id(full_name)").in(
            "user_id",
            (await supabase.from("cohort_memberships").select("user_id").eq("cohort_id", cohortRes.data.cohort_id)).data?.map((m: any) => m.user_id) || []
          ),
          supabase.from("meeting_proposals").select("*").eq("cohort_id", cohortRes.data.cohort_id).order("attendance_score", { ascending: false }),
        ]);
        setCohortWindows((cwRes.data as any[]) || []);
        setProposals((propRes.data as any[]) || []);
      }
    };
    load();
  }, [user]);

  const addWindow = async () => {
    const { error } = await supabase.from("availability_windows").insert({
      user_id: user!.id,
      day_of_week: newDay,
      start_time: newStart,
      end_time: newEnd,
      preference_weight: newWeight,
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success("Availability added");
    setAddDialog(false);
    const { data } = await supabase.from("availability_windows").select("*").eq("user_id", user!.id).order("day_of_week");
    setWindows((data as any[]) || []);
  };

  const removeWindow = async (id: string) => {
    await supabase.from("availability_windows").delete().eq("id", id);
    setWindows(w => w.filter(x => x.id !== id));
    toast.success("Removed");
  };

  // Compute heatmap from cohort windows
  const heatmap = DAYS.map((_, dayIdx) =>
    HOURS.map(hour => {
      const count = cohortWindows.filter(w =>
        w.day_of_week === dayIdx &&
        parseInt(w.start_time) <= hour &&
        parseInt(w.end_time) > hour
      ).length;
      return count;
    })
  );
  const maxCount = Math.max(1, ...heatmap.flat());

  // Generate recommendations
  const recommendations = DAYS.flatMap((dayName, dayIdx) =>
    HOURS.map(hour => {
      const available = cohortWindows.filter(w =>
        w.day_of_week === dayIdx &&
        parseInt(w.start_time) <= hour &&
        parseInt(w.end_time) > hour
      );
      const totalMembers = cohort ? new Set(cohortWindows.map(w => w.user_id)).size : 1;
      const score = totalMembers > 0 ? Math.round((available.length / totalMembers) * 100) : 0;
      const conflicts = totalMembers - available.length;
      return { dayIdx, dayName, hour, score, conflicts, available: available.length, totalMembers };
    })
  ).filter(r => r.score > 50).sort((a, b) => b.score - a.score).slice(0, 3);

  const isLeadOrPM = cohort?.role && ["pm", "lead", "integration_lead"].includes(cohort.role);

  const createProposal = async (rec: typeof recommendations[0]) => {
    const nextDate = getNextDate(rec.dayIdx, rec.hour);
    const { error } = await supabase.from("meeting_proposals").insert({
      proposed_by: user!.id,
      cohort_id: cohort!.cohort_id,
      candidate_time: nextDate.toISOString(),
      duration_minutes: 60,
      conflict_count: rec.conflicts,
      attendance_score: rec.score,
      explanation: `${rec.available}/${rec.totalMembers} members available. ${rec.dayName} ${rec.hour}:00 has ${rec.score}% attendance.`,
      status: "draft",
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success("Meeting proposal created");
  };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6 max-w-5xl">
      <motion.div variants={item} className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Scheduling</h1>
          <p className="text-xs text-muted-foreground font-mono">Set availability · Find optimal meeting times</p>
        </div>
        <Dialog open={addDialog} onOpenChange={setAddDialog}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2"><Plus className="h-3.5 w-3.5" />Add Availability</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Availability Window</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Day</Label>
                <Select value={String(newDay)} onValueChange={v => setNewDay(parseInt(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{DAYS.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Start</Label><Input type="time" value={newStart} onChange={e => setNewStart(e.target.value)} /></div>
                <div className="space-y-2"><Label>End</Label><Input type="time" value={newEnd} onChange={e => setNewEnd(e.target.value)} /></div>
              </div>
              <div className="space-y-2">
                <Label>Preference (1=avoid, 5=preferred)</Label>
                <Slider value={[newWeight]} onValueChange={v => setNewWeight(v[0])} min={1} max={5} step={1} />
                <p className="text-[10px] font-mono text-muted-foreground text-center">{newWeight}/5</p>
              </div>
              <Button onClick={addWindow} className="w-full">Save</Button>
            </div>
          </DialogContent>
        </Dialog>
      </motion.div>

      {/* My availability */}
      <motion.div variants={item}>
        <Card>
          <CardHeader className="py-3 px-5">
            <CardTitle className="text-sm font-sans font-semibold flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-accent-foreground" />My Availability
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 px-5 pb-4">
            {windows.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No availability set. Add your free windows above.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {windows.map(w => (
                  <div key={w.id} className="flex items-center gap-3 p-3 rounded-lg border group hover:border-accent/40 transition-colors">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{DAYS[w.day_of_week]}</p>
                      <p className="text-[11px] font-mono text-muted-foreground">{w.start_time.slice(0,5)} – {w.end_time.slice(0,5)}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: w.preference_weight }).map((_, i) => (
                        <div key={i} className="h-1.5 w-1.5 rounded-full bg-accent" />
                      ))}
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => removeWindow(w.id)}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Overlap heatmap */}
      {cohortWindows.length > 0 && (
        <motion.div variants={item}>
          <Card>
            <CardHeader className="py-3 px-5">
              <CardTitle className="text-sm font-sans font-semibold flex items-center gap-2">
                <Users className="h-3.5 w-3.5 text-accent-foreground" />Cohort Availability Heatmap
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 px-5 pb-4 overflow-x-auto">
              <div className="min-w-[600px]">
                <div className="grid gap-0.5" style={{ gridTemplateColumns: `80px repeat(${HOURS.length}, 1fr)` }}>
                  <div />
                  {HOURS.map(h => (
                    <div key={h} className="text-[9px] font-mono text-muted-foreground text-center">{h}:00</div>
                  ))}
                  {DAYS.map((day, dIdx) => (
                    <>
                      <div key={`label-${dIdx}`} className="text-[10px] font-mono text-muted-foreground flex items-center">{day.slice(0, 3)}</div>
                      {HOURS.map((_, hIdx) => {
                        const val = heatmap[dIdx][hIdx];
                        const intensity = val / maxCount;
                        return (
                          <div
                            key={`${dIdx}-${hIdx}`}
                            className="h-6 rounded-sm transition-colors"
                            style={{
                              backgroundColor: val > 0
                                ? `hsl(var(--success) / ${0.15 + intensity * 0.7})`
                                : `hsl(var(--muted) / 0.3)`,
                            }}
                            title={`${val} members available`}
                          />
                        );
                      })}
                    </>
                  ))}
                </div>
                <div className="flex items-center gap-4 mt-3">
                  <span className="text-[9px] font-mono text-muted-foreground">Less</span>
                  {[0.2, 0.4, 0.6, 0.8, 1].map((v, i) => (
                    <div key={i} className="h-3 w-6 rounded-sm" style={{ backgroundColor: `hsl(var(--success) / ${0.15 + v * 0.7})` }} />
                  ))}
                  <span className="text-[9px] font-mono text-muted-foreground">More</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <motion.div variants={item}>
          <Card className="border-accent/20">
            <CardHeader className="py-3 px-5">
              <CardTitle className="text-sm font-sans font-semibold flex items-center gap-2">
                <Zap className="h-3.5 w-3.5 text-accent-foreground" />Recommended Meeting Times
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 px-5 pb-4 space-y-2">
              {recommendations.map((rec, i) => (
                <div key={i} className="flex items-center gap-4 p-3 rounded-lg border hover:border-accent/40 transition-colors">
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold ${rec.score >= 80 ? "bg-success/10 text-success" : rec.score >= 60 ? "bg-warning/10 text-warning" : "bg-muted text-muted-foreground"}`}>
                    #{i + 1}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{rec.dayName} at {rec.hour}:00</p>
                    <p className="text-[10px] text-muted-foreground font-mono">
                      {rec.available}/{rec.totalMembers} available · {rec.conflicts} conflicts · {rec.score}% attendance
                    </p>
                  </div>
                  <Badge variant={rec.score >= 80 ? "default" : "secondary"} className="text-[9px] font-mono">
                    {rec.score}%
                  </Badge>
                  {isLeadOrPM && (
                    <Button size="sm" variant="outline" className="text-[10px] h-7" onClick={() => createProposal(rec)}>
                      Propose
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Active proposals */}
      {proposals.length > 0 && (
        <motion.div variants={item}>
          <Card>
            <CardHeader className="py-3 px-5">
              <CardTitle className="text-sm font-sans font-semibold flex items-center gap-2">
                <CalendarDays className="h-3.5 w-3.5 text-accent-foreground" />Meeting Proposals
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 px-5 pb-4 space-y-2">
              {proposals.map((p: any) => (
                <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg border">
                  <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{new Date(p.candidate_time).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">{p.explanation}</p>
                  </div>
                  <Badge variant="outline" className="text-[9px] font-mono capitalize">{p.status}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}

function getNextDate(dayOfWeek: number, hour: number): Date {
  const now = new Date();
  const currentDay = now.getDay();
  let daysUntil = dayOfWeek - currentDay;
  if (daysUntil <= 0) daysUntil += 7;
  const d = new Date(now);
  d.setDate(d.getDate() + daysUntil);
  d.setHours(hour, 0, 0, 0);
  return d;
}
