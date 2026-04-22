import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Bell, Save } from "lucide-react";
import { toast } from "sonner";

type Prefs = {
  preset: string;
  mentions: boolean;
  assignments: boolean;
  reviews: boolean;
  events: boolean;
  leadership_alerts: boolean;
  cohort_only: boolean;
  keywords: string[];
  digest_frequency: string;
  channel_in_app: boolean;
  channel_email: boolean;
  channel_teams: boolean;
};

const DEFAULTS: Prefs = {
  preset: "standard",
  mentions: true, assignments: true, reviews: true, events: true,
  leadership_alerts: true, cohort_only: false, keywords: [],
  digest_frequency: "daily", channel_in_app: true, channel_email: true, channel_teams: false,
};

const PRESETS: Record<string, Partial<Prefs>> = {
  minimal: { mentions: true, assignments: true, reviews: false, events: false, leadership_alerts: false, digest_frequency: "weekly" },
  standard: { mentions: true, assignments: true, reviews: true, events: true, leadership_alerts: true, digest_frequency: "daily" },
  high_alert: { mentions: true, assignments: true, reviews: true, events: true, leadership_alerts: true, digest_frequency: "instant" },
};

export function NotificationPreferences() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [keywordInput, setKeywordInput] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    supabase.from("notification_preferences").select("*").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => { if (data) setPrefs({ ...DEFAULTS, ...(data as any) }); });
  }, [user?.id]);

  const applyPreset = (preset: string) => {
    const p = PRESETS[preset] || {};
    setPrefs(prev => ({ ...prev, preset, ...p }));
  };

  const save = async () => {
    if (!user?.id) return;
    setSaving(true);
    const { error } = await supabase.from("notification_preferences").upsert({
      user_id: user.id, ...prefs, updated_at: new Date().toISOString(),
    });
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Notification preferences saved");
  };

  const addKeyword = () => {
    const k = keywordInput.trim().toLowerCase();
    if (!k || prefs.keywords.includes(k)) return;
    setPrefs(p => ({ ...p, keywords: [...p.keywords, k] }));
    setKeywordInput("");
  };

  const removeKeyword = (k: string) =>
    setPrefs(p => ({ ...p, keywords: p.keywords.filter(x => x !== k) }));

  const toggleField = (k: keyof Prefs) =>
    setPrefs(p => ({ ...p, [k]: !p[k] } as Prefs));

  return (
    <Card id="notifications">
      <CardHeader className="py-4 px-6">
        <CardTitle className="text-sm font-sans font-semibold flex items-center gap-2">
          <Bell className="h-3.5 w-3.5 text-accent-foreground" /> Notification Preferences
        </CardTitle>
      </CardHeader>
      <CardContent className="px-6 pb-6 space-y-5">
        {/* Preset */}
        <div className="grid gap-3 sm:grid-cols-3">
          {(["minimal","standard","high_alert"] as const).map(p => (
            <button
              key={p}
              type="button"
              onClick={() => applyPreset(p)}
              className={`rounded-md border p-3 text-left transition-colors ${
                prefs.preset === p ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
              }`}
            >
              <p className="text-xs font-semibold capitalize">{p.replace("_"," ")}</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                {p === "minimal" && "Mentions + assignments only"}
                {p === "standard" && "Balanced — daily digest"}
                {p === "high_alert" && "Everything, instant"}
              </p>
            </button>
          ))}
        </div>

        {/* Categories */}
        <div className="space-y-3">
          <p className="text-[10px] uppercase font-mono text-muted-foreground tracking-wide">Categories</p>
          {([
            ["mentions","Mentions"],
            ["assignments","Assignments"],
            ["reviews","Reviews & approvals"],
            ["events","Events"],
            ["leadership_alerts","PM / Lead announcements"],
            ["cohort_only","Restrict to my cohort"],
          ] as const).map(([k, label]) => (
            <div key={k} className="flex items-center justify-between">
              <Label htmlFor={`pref-${k}`} className="text-xs cursor-pointer">{label}</Label>
              <Switch id={`pref-${k}`} checked={prefs[k]} onCheckedChange={() => toggleField(k)} />
            </div>
          ))}
        </div>

        {/* Keywords */}
        <div className="space-y-2">
          <p className="text-[10px] uppercase font-mono text-muted-foreground tracking-wide">Keyword alerts</p>
          <div className="flex gap-2">
            <Input value={keywordInput} onChange={e => setKeywordInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addKeyword(); } }}
              placeholder="e.g. memvis" className="h-8 text-xs" />
            <Button type="button" size="sm" variant="outline" onClick={addKeyword}>Add</Button>
          </div>
          {prefs.keywords.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {prefs.keywords.map(k => (
                <button key={k} type="button" onClick={() => removeKeyword(k)}
                  className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-mono hover:bg-destructive/20">
                  {k} ×
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Digest + Channels */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase font-mono text-muted-foreground">Digest frequency</Label>
            <Select value={prefs.digest_frequency} onValueChange={v => setPrefs(p => ({ ...p, digest_frequency: v }))}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="off">Off</SelectItem>
                <SelectItem value="instant">Instant (high priority)</SelectItem>
                <SelectItem value="daily">Daily summary</SelectItem>
                <SelectItem value="weekly">Weekly summary</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] uppercase font-mono text-muted-foreground">Channels</Label>
            <div className="flex items-center justify-between"><span className="text-xs">In-app</span>
              <Switch checked={prefs.channel_in_app} onCheckedChange={() => toggleField("channel_in_app")} /></div>
            <div className="flex items-center justify-between"><span className="text-xs">Email</span>
              <Switch checked={prefs.channel_email} onCheckedChange={() => toggleField("channel_email")} /></div>
            <div className="flex items-center justify-between opacity-60">
              <span className="text-xs">Teams <span className="text-[10px] font-mono">(coming soon)</span></span>
              <Switch checked={false} disabled />
            </div>
          </div>
        </div>

        <Button onClick={save} disabled={saving} className="w-full sm:w-auto">
          <Save className="h-3.5 w-3.5 mr-1.5" />
          {saving ? "Saving…" : "Save preferences"}
        </Button>
      </CardContent>
    </Card>
  );
}
