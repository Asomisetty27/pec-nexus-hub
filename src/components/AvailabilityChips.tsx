import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Calendar, XCircle } from "lucide-react";
import { toast } from "sonner";

const QUICK_WINDOWS = [
  { label: "Mon evening", day: 1, start: "18:00", end: "21:00" },
  { label: "Mon afternoon", day: 1, start: "14:00", end: "17:00" },
  { label: "Tue after 5", day: 2, start: "17:00", end: "21:00" },
  { label: "Tue evening", day: 2, start: "18:00", end: "21:00" },
  { label: "Wed 7–9pm", day: 3, start: "19:00", end: "21:00" },
  { label: "Wed afternoon", day: 3, start: "14:00", end: "17:00" },
  { label: "Thu after 5", day: 4, start: "17:00", end: "21:00" },
  { label: "Thu evening", day: 4, start: "18:00", end: "21:00" },
  { label: "Fri afternoon", day: 5, start: "14:00", end: "17:00" },
  { label: "Fri evening", day: 5, start: "18:00", end: "20:00" },
  { label: "Sat morning", day: 6, start: "10:00", end: "13:00" },
  { label: "Sat afternoon", day: 6, start: "14:00", end: "17:00" },
  { label: "Sun afternoon", day: 0, start: "14:00", end: "17:00" },
  { label: "Sun evening", day: 0, start: "18:00", end: "21:00" },
];

type ChipState = "none" | "available" | "preferred" | "conflict";

export default function AvailabilityChips() {
  const { user } = useAuth();
  const [states, setStates] = useState<Record<string, ChipState>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("availability_windows").select("*").eq("user_id", user.id).then(({ data }) => {
      if (!data) return;
      const s: Record<string, ChipState> = {};
      data.forEach(w => {
        const match = QUICK_WINDOWS.find(q => q.day === w.day_of_week && q.start === w.start_time && q.end === w.end_time);
        if (match) {
          if (w.preference_weight <= 1) s[match.label] = "conflict";
          else if (w.preference_weight >= 4) s[match.label] = "preferred";
          else s[match.label] = "available";
        }
      });
      setStates(s);
    });
  }, [user]);

  const cycleState = (label: string) => {
    setStates(prev => {
      const current = prev[label] || "none";
      // Cycle: none → available → preferred → conflict → none
      const next: ChipState =
        current === "none" ? "available" :
        current === "available" ? "preferred" :
        current === "preferred" ? "conflict" :
        "none";
      return { ...prev, [label]: next };
    });
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    await supabase.from("availability_windows").delete().eq("user_id", user.id);
    const rows = QUICK_WINDOWS
      .filter(w => states[w.label] && states[w.label] !== "none")
      .map(w => ({
        user_id: user.id,
        day_of_week: w.day,
        start_time: w.start,
        end_time: w.end,
        preference_weight: states[w.label] === "preferred" ? 5 : states[w.label] === "conflict" ? 1 : 3,
      }));
    if (rows.length > 0) {
      await supabase.from("availability_windows").insert(rows);
    }
    const availCount = rows.filter(r => r.preference_weight > 1).length;
    const conflictCount = rows.filter(r => r.preference_weight === 1).length;
    toast.success(`Saved: ${availCount} available, ${conflictCount} conflicts`);
    setSaving(false);
  };

  const chipStyle: Record<ChipState, string> = {
    none: "bg-muted/30 border-border/50 text-muted-foreground hover:bg-muted/50",
    available: "bg-primary/10 border-primary/30 text-primary",
    preferred: "bg-accent/20 border-accent/50 text-accent-foreground shadow-sm",
    conflict: "bg-destructive/10 border-destructive/30 text-destructive line-through",
  };

  const chipPrefix: Record<ChipState, string> = {
    none: "",
    available: "✓ ",
    preferred: "★ ",
    conflict: "✕ ",
  };

  const selectedCount = Object.values(states).filter(s => s === "available" || s === "preferred").length;
  const conflictCount = Object.values(states).filter(s => s === "conflict").length;

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Calendar className="h-4 w-4 text-accent" /> Your Availability
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Tap to cycle: <span className="text-primary">Available</span> → <span className="text-accent-foreground font-medium">Preferred ★</span> → <span className="text-destructive">Conflict ✕</span> → Clear
        </p>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        <div className="flex flex-wrap gap-1.5">
          {QUICK_WINDOWS.map(w => {
            const state = states[w.label] || "none";
            return (
              <button key={w.label}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${chipStyle[state]}`}
                onClick={() => cycleState(w.label)}>
                {chipPrefix[state]}{w.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary/30" /> Available</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-accent/50" /> Preferred</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-destructive/30" /> Hard conflict</span>
        </div>
        <Button size="sm" className="w-full" disabled={saving} onClick={handleSave}>
          <CheckCircle2 className="h-3 w-3 mr-1" /> Save ({selectedCount} available, {conflictCount} conflicts)
        </Button>
      </CardContent>
    </Card>
  );
}
