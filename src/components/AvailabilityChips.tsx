import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Calendar, Clock } from "lucide-react";
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

export default function AvailabilityChips() {
  const { user } = useAuth();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [preferred, setPreferred] = useState<Set<string>>(new Set());
  const [conflicts, setConflicts] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("availability_windows").select("*").eq("user_id", user.id).then(({ data }) => {
      if (!data) return;
      setSaved(data);
      const sel = new Set<string>();
      const pref = new Set<string>();
      data.forEach(w => {
        const match = QUICK_WINDOWS.find(q => q.day === w.day_of_week && q.start === w.start_time && q.end === w.end_time);
        if (match) {
          sel.add(match.label);
          if (w.preference_weight >= 4) pref.add(match.label);
        }
      });
      setSelected(sel);
      setPreferred(pref);
    });
  }, [user]);

  const toggle = (label: string) => {
    const next = new Set(selected);
    if (next.has(label)) {
      next.delete(label);
      const p = new Set(preferred); p.delete(label); setPreferred(p);
      const c = new Set(conflicts); c.delete(label); setConflicts(c);
    } else {
      next.add(label);
    }
    setSelected(next);
  };

  const togglePreferred = (label: string) => {
    if (!selected.has(label)) return;
    const p = new Set(preferred);
    p.has(label) ? p.delete(label) : p.add(label);
    setPreferred(p);
  };

  const toggleConflict = (label: string) => {
    const c = new Set(conflicts);
    c.has(label) ? c.delete(label) : c.add(label);
    setConflicts(c);
    const s = new Set(selected); s.delete(label); setSelected(s);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    // Delete existing windows
    await supabase.from("availability_windows").delete().eq("user_id", user.id);
    // Insert selected
    const rows = QUICK_WINDOWS.filter(w => selected.has(w.label)).map(w => ({
      user_id: user.id,
      day_of_week: w.day,
      start_time: w.start,
      end_time: w.end,
      preference_weight: preferred.has(w.label) ? 5 : 3,
    }));
    if (rows.length > 0) {
      await supabase.from("availability_windows").insert(rows);
    }
    toast.success(`${rows.length} availability windows saved`);
    setSaving(false);
  };

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Calendar className="h-4 w-4 text-accent" /> Your Availability
        </CardTitle>
        <p className="text-xs text-muted-foreground">Tap to select available windows. Tap again to mark as preferred (★).</p>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        <div className="flex flex-wrap gap-1.5">
          {QUICK_WINDOWS.map(w => {
            const isSelected = selected.has(w.label);
            const isPref = preferred.has(w.label);
            const isConflict = conflicts.has(w.label);
            return (
              <button key={w.label}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  isConflict ? "bg-destructive/10 border-destructive/30 text-destructive line-through" :
                  isPref ? "bg-accent/20 border-accent/50 text-accent shadow-sm" :
                  isSelected ? "bg-primary/10 border-primary/30 text-primary" :
                  "bg-muted/30 border-border/50 text-muted-foreground hover:bg-muted/50"
                }`}
                onClick={() => isSelected ? togglePreferred(w.label) : toggle(w.label)}
                onContextMenu={e => { e.preventDefault(); toggleConflict(w.label); }}>
                {isPref && "★ "}{w.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary/30" /> Available</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-accent/50" /> Preferred</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-destructive/30" /> Hard conflict (right-click)</span>
        </div>
        <Button size="sm" className="w-full" disabled={saving} onClick={handleSave}>
          <CheckCircle2 className="h-3 w-3 mr-1" /> Save Availability ({selected.size} windows)
        </Button>
      </CardContent>
    </Card>
  );
}
