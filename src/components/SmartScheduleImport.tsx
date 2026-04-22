import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScanLine, Upload, Loader2, AlertTriangle, Sparkles, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Block = {
  day_of_week: number;
  start_time: string;
  end_time: string;
  label?: string;
  keep: boolean;
};

export default function SmartScheduleImport({ onSaved }: { onSaved?: () => void }) {
  const { user } = useAuth();
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confidence, setConfidence] = useState<string | null>(null);
  const [notes, setNotes] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [error, setError] = useState<string | null>(null);

  const onFile = async (file: File) => {
    setError(null);
    setBlocks([]);
    setConfidence(null);
    setNotes(null);
    if (!/^image\/(png|jpe?g|webp|heic)$/i.test(file.type) && !file.type.startsWith("image/")) {
      setError("Unsupported file type. Upload a PNG, JPG, or WEBP screenshot.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Image too large (max 5 MB). Try compressing or screenshotting just the schedule grid.");
      return;
    }
    setParsing(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      const { data, error } = await supabase.functions.invoke("parse-schedule-image", { body: { image: dataUrl } });
      if (error) {
        // FunctionsHttpError exposes parsed body via .context.json() on newer SDKs; fall back to message.
        let msg = error.message || "Could not reach schedule parser.";
        try {
          const ctx: any = (error as any).context;
          if (ctx && typeof ctx.json === "function") {
            const j = await ctx.json();
            if (j?.message) msg = j.message;
          }
        } catch { /* ignore */ }
        setError(msg);
        return;
      }
      const d = data as any;
      if (d?.error) {
        setError(d.message || d.error);
        if (Array.isArray(d.blocks) && d.blocks.length > 0) {
          setBlocks(d.blocks.map((b: any) => ({ ...b, keep: true })));
          setConfidence(d.confidence || "low");
        }
      } else {
        setConfidence(d.confidence || null);
        setNotes(d.notes || null);
        setBlocks((d.blocks || []).map((b: any) => ({ ...b, keep: true })));
        if ((d.blocks || []).length === 0) setError("No recurring busy times detected. Try a clearer screenshot, or add busy times manually below.");
      }
    } catch (e: any) {
      setError(e?.message || "Failed to parse image. Try a different screenshot or add busy times manually.");
    } finally {
      setParsing(false);
    }
  };

  const update = (i: number, patch: Partial<Block>) =>
    setBlocks(prev => prev.map((b, idx) => idx === i ? { ...b, ...patch } : b));
  const remove = (i: number) => setBlocks(prev => prev.filter((_, idx) => idx !== i));
  const add = () => setBlocks(prev => [...prev, { day_of_week: 1, start_time: "09:00", end_time: "10:00", keep: true, label: "" }]);

  const save = async () => {
    if (!user) return;
    const keep = blocks.filter(b => b.keep && b.start_time < b.end_time);
    if (keep.length === 0) { toast.error("Nothing to save"); return; }
    setSaving(true);
    try {
      // Insert as hard conflicts (preference_weight = 1)
      const rows = keep.map(b => ({
        user_id: user.id,
        day_of_week: b.day_of_week,
        start_time: b.start_time,
        end_time: b.end_time,
        preference_weight: 1,
      }));
      const { error } = await supabase.from("availability_windows").insert(rows);
      if (error) throw error;
      toast.success(`Saved ${keep.length} busy window${keep.length === 1 ? "" : "s"}`);
      setBlocks([]);
      setConfidence(null);
      setNotes(null);
      onSaved?.();
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent" /> Smart schedule import
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Upload a screenshot of your class schedule or weekly calendar. Nexus extracts recurring busy times — review, edit, then save.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border bg-muted/30 px-4 py-6 text-sm hover:bg-muted/50">
          {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          <span>{parsing ? "Analyzing image…" : "Choose schedule screenshot"}</span>
          <input type="file" accept="image/*" className="hidden" disabled={parsing}
                 onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.currentTarget.value = ""; }} />
        </label>

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-2 text-xs text-warning">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" /> <span>{error}</span>
          </div>
        )}

        {(confidence || blocks.length > 0) && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs">
                <ScanLine className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Detected</span>
                {confidence && (
                  <Badge variant={confidence === "high" ? "default" : confidence === "medium" ? "secondary" : "outline"} className="text-[10px]">
                    {confidence} confidence
                  </Badge>
                )}
              </div>
              <Button size="sm" variant="ghost" onClick={add} className="h-7 gap-1 text-xs"><Plus className="h-3 w-3" />Add row</Button>
            </div>
            {notes && <p className="text-[11px] italic text-muted-foreground">{notes}</p>}

            <div className="space-y-1.5">
              {blocks.map((b, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2 rounded-md border border-border/60 bg-background p-2 text-xs">
                  <Checkbox checked={b.keep} onCheckedChange={(v) => update(i, { keep: !!v })} />
                  <select value={b.day_of_week} onChange={e => update(i, { day_of_week: Number(e.target.value) })}
                          className="rounded border border-input bg-background px-2 py-1">
                    {DAYS.map((d, idx) => <option key={d} value={idx}>{d}</option>)}
                  </select>
                  <Input type="time" value={b.start_time} onChange={e => update(i, { start_time: e.target.value })} className="h-7 w-24 text-xs" />
                  <span className="text-muted-foreground">→</span>
                  <Input type="time" value={b.end_time} onChange={e => update(i, { end_time: e.target.value })} className="h-7 w-24 text-xs" />
                  <Input value={b.label || ""} onChange={e => update(i, { label: e.target.value })} placeholder="Label (e.g. ME 212)" className="h-7 flex-1 min-w-[120px] text-xs" />
                  <Button variant="ghost" size="icon" onClick={() => remove(i)} className="h-7 w-7"><Trash2 className="h-3 w-3" /></Button>
                </div>
              ))}
            </div>

            {blocks.length > 0 && (
              <Button onClick={save} disabled={saving} className="w-full" size="sm">
                {saving ? "Saving…" : `Save ${blocks.filter(b => b.keep).length} busy window${blocks.filter(b => b.keep).length === 1 ? "" : "s"}`}
              </Button>
            )}
          </div>
        )}

        <p className="text-[10px] text-muted-foreground">
          Image parsing is best-effort. You always confirm before anything is saved. Manual chips and existing availability remain untouched.
        </p>
      </CardContent>
    </Card>
  );
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}