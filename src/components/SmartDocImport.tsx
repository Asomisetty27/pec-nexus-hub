import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Upload, Link as LinkIcon, CheckCircle2, Sparkles } from "lucide-react";
import { toast } from "sonner";

const DOC_INTENTS = [
  { value: "deliverable", label: "Submit Deliverable", icon: "📄" },
  { value: "artifact", label: "Add Supporting Artifact", icon: "📎" },
  { value: "revision", label: "Upload Revision", icon: "🔄" },
  { value: "external", label: "Link External Doc", icon: "🔗" },
  { value: "meeting", label: "Add Meeting Notes", icon: "📝" },
  { value: "evidence", label: "Attach Decision Evidence", icon: "⚖️" },
];

function inferDocType(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("charter") || n.includes("scope")) return "charter";
  if (n.includes("risk")) return "risk_log";
  if (n.includes("decision")) return "decision_log";
  if (n.includes("deck") || n.includes("presentation")) return "presentation";
  if (n.includes("demo")) return "demo";
  if (n.includes("report")) return "report";
  if (n.includes("retro")) return "retro";
  if (n.includes("architecture") || n.includes("walkthrough")) return "technical";
  if (n.includes("review") || n.includes("critique")) return "review";
  if (n.includes("timeline") || n.includes("plan")) return "planning";
  return "general";
}

function inferStage(name: string, stages: any[]): any {
  const n = name.toLowerCase();
  const stageKeywords: Record<string, string[]> = {
    Kickoff: ["charter", "scope", "role", "timeline", "setup", "familiarization"],
    Discovery: ["discovery", "research", "analysis", "walkthrough", "critique", "assumption", "constraint"],
    "Direction / Concept Selection": ["concept", "direction", "tradeoff", "selection", "criteria"],
    "Build / Detailed Design": ["build", "detailed design", "cad", "prototype", "implementation", "debug"],
    "Strategy Direction": ["strategy", "positioning", "targeting", "segmentation", "channel"],
    "Execution Design": ["execution", "outreach", "campaign", "operations", "pipeline", "playbook"],
    "System Design": ["system design", "architecture", "state", "logic", "flow", "decision rules"],
    "Integration Build": ["integration", "sensor", "display", "logging", "stability", "bring-up"],
    "Final Delivery": ["final", "delivery", "handoff", "presentation", "demo", "launch"],
    "Final System": ["final system", "stable runtime", "integrated", "demo", "final"],
    Retro: ["retro", "lesson", "recommendation", "knowledge"],
  };
  for (const stage of stages) {
    const keywords = stageKeywords[stage.name] || [];
    if (keywords.some(k => n.includes(k))) return stage;
  }
  return stages.find((s: any) => s.status === "active") || stages[0];
}

interface SmartDocImportProps {
  projectId: string;
  projectTitle: string;
  stages: any[];
  folders: any[];
  activeStage?: any;
  onComplete: () => void;
}

export default function SmartDocImport({ projectId, projectTitle, stages, folders, activeStage, onComplete }: SmartDocImportProps) {
  const { user } = useAuth();
  const [step, setStep] = useState<"intent" | "details" | "confirm">("intent");
  const [intent, setIntent] = useState("");
  const [title, setTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [folderId, setFolderId] = useState("");
  const [saving, setSaving] = useState(false);

  const inferred = useMemo(() => {
    if (!title) return { docType: "general", stage: activeStage, folder: folders[0] };
    const docType = inferDocType(title);
    const stage = inferStage(title, stages);
    const folderMatch = folders.find(f => {
      const fn = f.name.toLowerCase();
      const tn = title.toLowerCase();
      return tn.includes(fn) || fn.includes(docType);
    });
    return { docType, stage, folder: folderMatch || folders[0] };
  }, [title, stages, folders, activeStage]);

  const handleSave = async () => {
    if (!title.trim()) { toast.error("Title required"); return; }
    setSaving(true);
    const { data, error } = await supabase.from("documents").insert({
      title: title.trim(),
      author_id: user!.id,
      mock_project_id: projectId,
      doc_type: inferred.docType,
      folder_id: folderId || inferred.folder?.id || null,
      content: linkUrl ? `[External Link](${linkUrl})` : "",
      visibility: "internal",
    }).select("id").single();
    if (error || !data) { toast.error(`Save failed: ${error?.message ?? "Unknown error"}`); setSaving(false); return; }
    toast.success("Document imported");
    setSaving(false);
    onComplete();
  };

  if (step === "intent") {
    return (
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground mb-3">What are you adding?</p>
        {DOC_INTENTS.map(di => (
          <Button key={di.value} variant="outline" className="w-full justify-start text-sm h-9"
            onClick={() => { setIntent(di.value); setStep("details"); }}>
            <span className="mr-2">{di.icon}</span> {di.label}
          </Button>
        ))}
      </div>
    );
  }

  if (step === "details") {
    return (
      <div className="space-y-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Document Title</label>
          <Input placeholder="e.g. Midpoint Deck, Architecture Breakdown..."
            value={title} onChange={e => setTitle(e.target.value)} className="mt-1" />
        </div>
        {(intent === "external" || intent === "artifact") && (
          <div>
            <label className="text-xs font-medium text-muted-foreground">Link URL</label>
            <Input placeholder="https://docs.google.com/..." value={linkUrl}
              onChange={e => setLinkUrl(e.target.value)} className="mt-1" />
          </div>
        )}
        <Button className="w-full" size="sm" disabled={!title.trim()}
          onClick={() => setStep("confirm")}>
          Continue
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="p-3 rounded-lg bg-accent/5 border border-accent/20 space-y-2">
        <div className="flex items-center gap-2 text-xs">
          <Sparkles className="h-3.5 w-3.5 text-accent" />
          <span className="font-medium text-accent">Smart Inference</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-muted-foreground">Type:</span>
            <Badge variant="outline" className="ml-1 text-[10px]">{inferred.docType}</Badge>
          </div>
          <div>
            <span className="text-muted-foreground">Stage:</span>
            <Badge variant="outline" className="ml-1 text-[10px]">{inferred.stage?.name || "—"}</Badge>
          </div>
          <div>
            <span className="text-muted-foreground">Project:</span>
            <span className="ml-1 font-medium">{projectTitle}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Folder:</span>
            <Select value={folderId || inferred.folder?.id || ""} onValueChange={setFolderId}>
              <SelectTrigger className="h-6 text-[10px] w-28 inline-flex">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {folders.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="p-3 rounded-lg border space-y-1">
        <p className="text-sm font-medium">{title}</p>
        {linkUrl && <p className="text-xs text-muted-foreground truncate">{linkUrl}</p>}
      </div>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1" onClick={() => setStep("details")}>Back</Button>
        <Button size="sm" className="flex-1" disabled={saving} onClick={handleSave}>
          <CheckCircle2 className="h-3 w-3 mr-1" /> Confirm & Save
        </Button>
      </div>
    </div>
  );
}
