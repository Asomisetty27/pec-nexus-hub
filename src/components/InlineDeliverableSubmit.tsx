import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from "@/components/ui/drawer";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Upload, Link as LinkIcon, CheckCircle2, AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { logAuditAction } from "@/lib/audit";

interface Deliverable {
  id: string;
  title: string;
  project_id: string;
  milestone_id?: string | null;
  version: number;
  approval_status: string;
  approval_required: boolean;
  due_date?: string | null;
  engagement_type?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  deliverable: Deliverable | null;
  projectName: string;
  milestoneName?: string;
  onSubmitted: () => void;
}

export default function InlineDeliverableSubmit({ open, onOpenChange, deliverable, projectName, milestoneName, onSubmitted }: Props) {
  const { user } = useAuth();
  const [mode, setMode] = useState<"file" | "link">("link");
  const [file, setFile] = useState<File | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!deliverable) return null;

  const isRevision = ["revision_requested", "rejected"].includes(deliverable.approval_status) || deliverable.version > 1;
  const nextVersion = isRevision ? deliverable.version + 1 : 1;

  const reset = () => {
    setFile(null); setLinkUrl(""); setNotes(""); setError(null); setMode("link");
  };

  const handleSubmit = async () => {
    setError(null);
    if (mode === "file" && !file) { setError("Choose a file to upload."); return; }
    if (mode === "link" && !linkUrl.trim()) { setError("Paste a link to the artifact."); return; }
    if (mode === "link") {
      try { new URL(linkUrl); } catch { setError("That doesn't look like a valid URL."); return; }
    }

    setSubmitting(true);
    let fileUrl: string | null = null;

    try {
      if (mode === "file" && file) {
        const ext = file.name.split(".").pop() || "bin";
        const path = `${deliverable.project_id}/${deliverable.id}/v${nextVersion}-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("deliverables").upload(path, file, { upsert: false });
        if (upErr) throw new Error(`Upload failed: ${upErr.message}`);
        const { data: signed } = await supabase.storage.from("deliverables").createSignedUrl(path, 60 * 60 * 24 * 365);
        fileUrl = signed?.signedUrl || path;
      } else {
        fileUrl = linkUrl.trim();
      }

      const { error: updErr } = await supabase.from("deliverables").update({
        file_url: fileUrl,
        version: nextVersion,
        approval_status: deliverable.approval_required ? "pending" : "approved",
        approved: !deliverable.approval_required,
        approved_at: deliverable.approval_required ? null : new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", deliverable.id);

      if (updErr) throw new Error(`Save failed: ${updErr.message}`);

      // Record real review-history event (truthful submission log).
      // Failure here is non-fatal but surfaced quietly.
      const { error: evErr } = await supabase.from("deliverable_review_events").insert({
        deliverable_id: deliverable.id,
        project_id: deliverable.project_id,
        actor_id: user!.id,
        event_type: isRevision ? "revised" : "submitted",
        from_status: deliverable.approval_status,
        to_status: deliverable.approval_required ? "pending" : "approved",
        version: nextVersion,
        reason: notes.trim() || null,
        file_url: fileUrl,
      });
      if (evErr) console.warn("review event log failed", evErr.message);

      // Audit (non-blocking)
      logAuditAction(
        isRevision ? "deliverable.revised" : "deliverable.submitted",
        "deliverable",
        deliverable.id,
        { project_id: deliverable.project_id, version: nextVersion, mode, notes: notes || undefined }
      );

      // Optional: also create a project_update row to give visibility
      if (notes.trim() && user) {
        await supabase.from("project_updates").insert({
          project_id: deliverable.project_id,
          author_id: user.id,
          summary: `${isRevision ? "Revised" : "Submitted"}: ${deliverable.title} (v${nextVersion})${notes ? ` — ${notes}` : ""}`,
          health: "green",
        });
      }

      toast.success(deliverable.approval_required
        ? `${isRevision ? "Revision" : "Submission"} sent for review (v${nextVersion})`
        : `${deliverable.title} marked complete`);
      reset();
      onOpenChange(false);
      onSubmitted();
    } catch (e: any) {
      const msg = e?.message || "Submission failed — please retry.";
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={(v) => { if (!submitting) { onOpenChange(v); if (!v) reset(); } }}>
      <DrawerContent className="max-w-xl mx-auto">
        <DrawerHeader>
          <div className="flex items-center gap-2">
            {isRevision && <Badge variant="outline" className="gap-1 text-[10px]"><RefreshCw className="h-3 w-3" /> Revision</Badge>}
            <Badge variant="secondary" className="text-[10px]">v{nextVersion}</Badge>
            {deliverable.engagement_type && (
              <Badge variant="outline" className="text-[10px] capitalize">{deliverable.engagement_type}</Badge>
            )}
          </div>
          <DrawerTitle className="text-left">{isRevision ? "Resubmit" : "Submit"}: {deliverable.title}</DrawerTitle>
          <DrawerDescription className="text-left text-xs">
            <span className="font-medium text-foreground">{projectName}</span>
            {milestoneName && <> · Stage: <span className="font-medium text-foreground">{milestoneName}</span></>}
            {deliverable.due_date && <> · Due {new Date(deliverable.due_date).toLocaleDateString()}</>}
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-4 pb-2 space-y-4">
          <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="link"><LinkIcon className="h-3 w-3 mr-1" /> Link</TabsTrigger>
              <TabsTrigger value="file"><Upload className="h-3 w-3 mr-1" /> Upload</TabsTrigger>
            </TabsList>
            <TabsContent value="link" className="space-y-2 mt-3">
              <Label className="text-xs">Artifact URL</Label>
              <Input
                placeholder="https://docs.google.com/... or GitHub PR / Figma / Drive link"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                autoFocus
              />
              <p className="text-[10px] text-muted-foreground">Anything reviewers can open — Docs, Drive, GitHub, Figma, video.</p>
            </TabsContent>
            <TabsContent value="file" className="space-y-2 mt-3">
              <Label className="text-xs">File</Label>
              <Input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              {file && <p className="text-[10px] text-muted-foreground">{file.name} · {(file.size / 1024).toFixed(1)} KB</p>}
            </TabsContent>
          </Tabs>

          <div className="space-y-2">
            <Label className="text-xs">Note for reviewer (optional)</Label>
            <Textarea
              placeholder={isRevision ? "What changed since last review?" : "Anything reviewers should know?"}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="rounded-md border bg-muted/30 p-3 text-[11px] space-y-1">
            <p className="font-medium">What happens next:</p>
            <p className="text-muted-foreground">
              {deliverable.approval_required
                ? `Marked Awaiting Review. Project leads are notified to approve or request revisions.`
                : `Marked Complete immediately (no approval required).`}
            </p>
          </div>
        </div>

        <DrawerFooter className="flex-row gap-2">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button className="flex-1" onClick={handleSubmit} disabled={submitting}>
            {submitting ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Submitting…</> : <><CheckCircle2 className="h-3 w-3 mr-1" /> Confirm & Submit</>}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
