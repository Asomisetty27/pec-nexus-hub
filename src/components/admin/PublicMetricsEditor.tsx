import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Save, Plus, Trash2, BarChart3, RefreshCw } from "lucide-react";

interface Metric {
  id: string;
  metric_key: string;
  label: string;
  value: string;
  subtitle: string | null;
  display_order: number;
  visible: boolean;
  source: string;
}

export default function PublicMetricsEditor() {
  const [rows, setRows] = useState<Metric[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("public_metrics").select("*").order("display_order");
    setRows((data as Metric[]) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const recompute = async () => {
    // Pull authoritative counts
    const [cohortsRes, projectsRes] = await Promise.all([
      supabase.from("cohorts").select("id", { count: "exact", head: true }),
      supabase.from("projects").select("id", { count: "exact", head: true }).eq("status", "active"),
    ]);
    const updates: Array<{ key: string; value: string }> = [
      { key: "active_cohorts",  value: String(cohortsRes.count ?? 0) },
      { key: "active_projects", value: String(projectsRes.count ?? 0) },
    ];
    for (const u of updates) {
      await supabase.from("public_metrics").update({ value: u.value }).eq("metric_key", u.key);
    }
    toast.success("Computed metrics refreshed from live data");
    load();
  };

  const update = (id: string, patch: Partial<Metric>) =>
    setRows(rs => rs.map(r => r.id === id ? { ...r, ...patch } : r));

  const save = async (m: Metric) => {
    setSaving(m.id);
    const { error } = await supabase.from("public_metrics").update({
      label: m.label, value: m.value, subtitle: m.subtitle, display_order: m.display_order, visible: m.visible,
    }).eq("id", m.id);
    setSaving(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Saved");
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this metric?")) return;
    await supabase.from("public_metrics").delete().eq("id", id);
    load();
  };

  const add = async () => {
    const key = `metric_${Date.now()}`;
    const { error } = await supabase.from("public_metrics").insert({
      metric_key: key, label: "New metric", value: "0", subtitle: "",
      display_order: rows.length + 1, visible: false, source: "manual",
    });
    if (error) { toast.error(error.message); return; }
    load();
  };

  return (
    <Card>
      <CardHeader className="py-3 px-5 flex flex-row items-center justify-between">
        <CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="h-3.5 w-3.5" /> Homepage Public Metrics</CardTitle>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={recompute}>
            <RefreshCw className="h-3 w-3" /> Refresh computed
          </Button>
          <Button size="sm" className="h-7 gap-1.5 text-xs" onClick={add}><Plus className="h-3 w-3" /> Add metric</Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0 px-5 pb-4 space-y-3">
        <p className="text-[11px] text-muted-foreground">
          These appear on the public homepage. Values marked <em>computed</em> are refreshed from live data; <em>manual</em> values are admin-set. Toggle visibility to hide a metric without deleting it.
        </p>
        {loading ? <p className="text-xs text-muted-foreground">Loading…</p> : rows.map((m) => (
          <div key={m.id} className="rounded-lg border p-3 space-y-2 bg-muted/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant={m.source === "computed" ? "default" : "outline"} className="text-[9px] font-mono">{m.source}</Badge>
                <code className="text-[10px] text-muted-foreground">{m.metric_key}</code>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-[10px] text-muted-foreground">Visible</Label>
                <Switch checked={m.visible} onCheckedChange={(v) => update(m.id, { visible: v })} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="space-y-1"><Label className="text-[10px]">Value</Label><Input value={m.value} onChange={(e) => update(m.id, { value: e.target.value })} className="h-8 text-sm" /></div>
              <div className="space-y-1"><Label className="text-[10px]">Label</Label><Input value={m.label} onChange={(e) => update(m.id, { label: e.target.value })} className="h-8 text-sm" /></div>
              <div className="space-y-1"><Label className="text-[10px]">Order</Label><Input type="number" value={m.display_order} onChange={(e) => update(m.id, { display_order: parseInt(e.target.value || "0") })} className="h-8 text-sm" /></div>
            </div>
            <div className="space-y-1"><Label className="text-[10px]">Subtitle (optional)</Label><Input value={m.subtitle || ""} onChange={(e) => update(m.id, { subtitle: e.target.value })} className="h-8 text-sm" /></div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" className="h-7 text-destructive" onClick={() => remove(m.id)}><Trash2 className="h-3 w-3" /></Button>
              <Button size="sm" className="h-7 gap-1.5 text-xs" disabled={saving === m.id} onClick={() => save(m)}>
                <Save className="h-3 w-3" /> {saving === m.id ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
