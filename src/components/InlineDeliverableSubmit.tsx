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
import { Upload, Link as LinkIcon, CheckCircle2, AlertCircle, Loader2, RefreshCw, Users } from "lucide-react";
import { toast } from "sonner";
import { logAuditAction } from "@/lib/audit";
import { FeedbackPrompt } from "@/components/FeedbackPrompt";
import { submitDeliverable } from "@/lib/reviewActions";

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
  owner_type?: "individual" | "group" | null;
  owning_group_id?: string | null;
  owner_id?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  deliverable: Deliverable | null;
  projectName: string;
  milestoneName?: string;
  /** When deliverable.owner_type === "group", display this name in the "on behalf of" copy. */
  groupName?: string | null;
  /** Whether the current user is eligible to submit this deliverable. Defaults to true. */
  eligible?: boolean;
  onSubmitted: () => void;
}

export default function InlineDeliverableSubmit({
  open, onOpenChange, deliverable, projectName, milestoneName, groupName, eligible = true, onSubmitted,
}: Props) {
  const { user } = useAuth();
  const [mode, setMode] = useState<"file" | "link">("link");
  const [file, setFile] = useState<File | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSubmitted, setJustSubmitted] = useState(false);

  if (!deliverable) return null;

  const isRevision = ["revision_requested", "rejected"].includes(deliverable.approval_status) || deliverable.version > 1;
  const nextVersion = isRevision ? deliverable.version + 1 : 1;
  const isGroupOwned = deliverable.owner_type === "group";

  const reset = () => {
    setFile(null); setLinkUrl(""); setNotes(""); setError(null); setMode("link"); setJustSubmitted(false);
  };

  const handleSubmit = async () => {
    setError(null);
    if (!eligible) { setError("You are not eligible to submit this deliverable."); return; }
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

      // Route through RPC: enforces eligibility, attributes submitter, logs review event.
      const res = await submitDeliverable(deliverable.id, fileUrl!, notes);
      if (res.ok === false) throw new Error(res.error);

      // Audit (non-blocking)
      logAuditAction(
        isRevision ? "deliverable.revised" : "deliverable.submitted",
        "deliverable",
        deliverable.id,
        {
          project_id: deliverable.project_id, version: nextVersion, mode,
          notes: notes || undefined,
          owner_type: deliverable.owner_type || "individual",
          owning_group_id: deliverable.owning_group_id || undefined,
        }
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
      setJustSubmitted(true);
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
            {isGroupOwned && (
              <Badge variant="outline" className="gap-1 text-[10px]"><Users className="h-3 w-3" /> Group</Badge>
            )}
          </div>
          <DrawerTitle className="text-left">{isRevision ? "Resubmit" : "Submit"}: {deliverable.title}</DrawerTitle>
          <DrawerDescription className="text-left text-xs">
            <span className="font-medium text-foreground">{projectName}</span>
            {milestoneName && <> · Stage: <span className="font-medium text-foreground">{milestoneName}</span></>}
            {deliverable.due_date && <> · Due {new Date(deliverable.due_date).toLocaleDateString()}</>}
          </DrawerDescription>
          {isGroupOwned && (
            <p className="text-left text-[11px] text-muted-foreground mt-1">
              <Users className="inline h-3 w-3 mr-1 -mt-0.5" />
              Submitting on behalf of <span className="font-medium text-foreground">{groupName || "your group"}</span>.
              You'll be credited as the submitter; the group remains the execution owner.
            </p>
          )}
          {!eligible && (
            <p className="text-left text-[11px] text-destructive mt-1">
              You are not eligible to submit this deliverable.
            </p>
          )}
        </DrawerHeader>

        <div className="px-4 pb-2 space-y-4">
          {justSubmitted ? (
            <div className="rounded-md border border-success/40 bg-success/5 p-4 text-sm space-y-3">
              <div className="flex items-center gap-2 text-success">
                <CheckCircle2 className="h-4 w-4" />
                <span className="font-medium">
                  {deliverable.approval_required ? "Sent for review" : "Marked complete"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {deliverable.approval_required
                  ? "Reviewers have been notified. You can close this drawer."
                  : "This deliverable is now marked complete."}
              </p>
              <FeedbackPrompt
                feature="deliverable_submit"
                prompt="Was submitting this easy?"
                contextType="deliverable"
                contextId={deliverable.id}
                options={[
                  { label: "Easy", rating: "positive" },
                  { label: "Okay", rating: "neutral" },
                  { label: "Confusing", rating: "negative" },
                ]}
              />
            </div>
          ) : (
          <>
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
          </>
          )}
        </div>

        <DrawerFooter className="flex-row gap-2">
          {justSubmitted ? (
            <Button className="flex-1" onClick={() => { reset(); onOpenChange(false); }}>Done</Button>
          ) : (
            <>
              <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
              <Button className="flex-1" onClick={handleSubmit} disabled={submitting}>
                {submitting ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Submitting…</> : <><CheckCircle2 className="h-3 w-3 mr-1" /> Confirm & Submit</>}
              </Button>
            </>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
