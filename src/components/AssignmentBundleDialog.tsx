import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { displayName } from "@/lib/utils";

interface Member { user_id: string; full_name?: string | null; cal_poly_email?: string | null; }
interface Milestone { id: string; title: string; }

interface Props {
  projectId: string;
  members: Member[];
  milestones?: Milestone[];
  onCreated?: () => void;
}

export function AssignmentBundleDialog({ projectId, members, milestones = [], onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    owner_id: "", reviewer_id: "", title: "", description: "",
    due_date: "", priority: "normal", milestone_id: "", note: "",
  });

  const update = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.title.trim() || !form.owner_id) {
      toast.error("Title and owner are required");
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc("create_assignment_bundle", {
      p_project_id: projectId,
      p_owner_id: form.owner_id,
      p_title: form.title.trim(),
      p_description: form.description || null,
      p_due_date: form.due_date || null,
      p_reviewer_id: form.reviewer_id || null,
      p_milestone_id: form.milestone_id || null,
      p_priority: form.priority,
      p_note: form.note || null,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Assignment created and notified");
    setOpen(false);
    setForm({ owner_id: "", reviewer_id: "", title: "", description: "",
              due_date: "", priority: "normal", milestone_id: "", note: "" });
    onCreated?.();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Assign work
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Assign work</DialogTitle>
          <DialogDescription className="text-xs">
            Creates a deliverable, sets a reviewer, and notifies everyone in one step.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Title *</Label>
            <Input value={form.title} onChange={e => update("title", e.target.value)} placeholder="e.g. CAD review for upper bracket" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Textarea value={form.description} onChange={e => update("description", e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Owner *</Label>
              <Select value={form.owner_id} onValueChange={v => update("owner_id", v)}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select owner" /></SelectTrigger>
                <SelectContent>
                  {members.map(m => (
                    <SelectItem key={m.user_id} value={m.user_id}>{displayName(m)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Reviewer</Label>
              <Select value={form.reviewer_id} onValueChange={v => update("reviewer_id", v)}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>
                  {members.map(m => (
                    <SelectItem key={m.user_id} value={m.user_id}>{displayName(m)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Due date</Label>
              <Input type="date" value={form.due_date} onChange={e => update("due_date", e.target.value)} className="h-9 text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Priority</Label>
              <Select value={form.priority} onValueChange={v => update("priority", v)}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {milestones.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs">Milestone</Label>
                <Select value={form.milestone_id} onValueChange={v => update("milestone_id", v)}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    {milestones.map(m => <SelectItem key={m.id} value={m.id}>{m.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Note (sent in notification)</Label>
            <Textarea value={form.note} onChange={e => update("note", e.target.value)} rows={2}
              placeholder="Context, links, expectations…" />
          </div>
          <Button onClick={submit} disabled={busy} className="w-full">
            {busy ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Creating…</> : "Create assignment"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
