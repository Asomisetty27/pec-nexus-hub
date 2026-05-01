import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Sparkles, Loader2, User, Users, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { displayName } from "@/lib/utils";
import { CANONICAL_STAGES, stageLabel } from "@/lib/deliverableStatus";

interface Member { user_id: string; full_name?: string | null; cal_poly_email?: string | null; }
interface Milestone { id: string; title: string; }
interface Group { id: string; name: string; member_count?: number | null; }

interface Props {
  projectId: string;
  members: Member[];
  milestones?: Milestone[];
  onCreated?: () => void;
}

export function AssignmentBundleDialog({ projectId, members, milestones = [], onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [form, setForm] = useState({
    owner_type: "individual" as "individual" | "group",
    owner_id: "", owning_group_id: "", reviewer_id: "", title: "", description: "",
    due_date: "", priority: "normal", milestone_id: "", note: "",
    canonical_stage: "" as "" | "kickoff" | "discovery" | "midpoint" | "final" | "retro",
    is_technical: false, tech_validation_required: false,
  });

  const update = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  // Load project groups when dialog opens (lightweight; only fetched on demand).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("project_groups").select("id, name").eq("project_id", projectId).eq("archived", false);
      if (cancelled) return;
      const ids = (data || []).map((g: any) => g.id);
      let counts: Record<string, number> = {};
      if (ids.length) {
        const { data: mems } = await supabase.from("project_group_members").select("group_id").in("group_id", ids);
        (mems || []).forEach((m: any) => { counts[m.group_id] = (counts[m.group_id] || 0) + 1; });
      }
      setGroups((data || []).map((g: any) => ({ id: g.id, name: g.name, member_count: counts[g.id] || 0 })));
    })();
    return () => { cancelled = true; };
  }, [open, projectId]);

  const submit = async () => {
    if (!form.title.trim()) { toast.error("Title is required"); return; }
    if (form.owner_type === "individual" && !form.owner_id) { toast.error("Pick an owner"); return; }
    if (form.owner_type === "group" && !form.owning_group_id) { toast.error("Pick a group"); return; }
    if (!form.canonical_stage) { toast.error("Stage is required for new deliverables"); return; }
    setBusy(true);
    // For group ownership, the legacy RPC needs an owner_id placeholder; we'll
    // null it in a follow-up update to keep ownership consistent with doctrine.
    const placeholderOwner = form.owner_type === "individual" ? form.owner_id : (members[0]?.user_id || form.reviewer_id);
    if (!placeholderOwner) {
      setBusy(false);
      toast.error("Need at least one project member to record the assignment.");
      return;
    }
    const { data: newId, error } = await supabase.rpc("create_assignment_bundle", {
      p_project_id: projectId,
      p_owner_id: placeholderOwner,
      p_title: form.title.trim(),
      p_description: form.description || null,
      p_due_date: form.due_date || null,
      p_reviewer_id: form.reviewer_id || null,
      p_milestone_id: form.milestone_id || null,
      p_priority: form.priority,
      p_note: form.note || null,
    });
    if (error || !newId) { setBusy(false); toast.error(error?.message || "Could not create assignment"); return; }

    // Apply Phase 4 doctrine fields. If group-owned, rewrite ownership and clear owner_id.
    const patch: any = {
      canonical_stage: form.canonical_stage,
      is_technical: form.is_technical,
      tech_validation_required: form.tech_validation_required,
    };
    if (form.owner_type === "group") {
      patch.owner_type = "group";
      patch.owning_group_id = form.owning_group_id;
      patch.owner_id = null;
    } else {
      patch.owner_type = "individual";
      patch.owning_group_id = null;
    }
    const { error: patchErr } = await supabase.from("deliverables").update(patch).eq("id", newId as string);
    setBusy(false);
    if (patchErr) { toast.error(`Created, but doctrine fields failed: ${patchErr.message}`); return; }

    toast.success("Assignment created and notified");
    setOpen(false);
    setForm({
      owner_type: "individual", owner_id: "", owning_group_id: "", reviewer_id: "",
      title: "", description: "", due_date: "", priority: "normal", milestone_id: "",
      note: "", canonical_stage: "", is_technical: false, tech_validation_required: false,
    });
    onCreated?.();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Assign work
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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

          {/* Owner type selector */}
          <div className="space-y-1.5">
            <Label className="text-xs">Ownership *</Label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => update("owner_type", "individual")}
                className={`flex items-center gap-2 rounded-md border p-2.5 text-left transition-colors ${form.owner_type === "individual" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
                <User className="h-3.5 w-3.5" />
                <div className="text-xs">
                  <p className="font-medium">Individual</p>
                  <p className="text-[10px] text-muted-foreground">Single owner submits</p>
                </div>
              </button>
              <button type="button" onClick={() => update("owner_type", "group")}
                className={`flex items-center gap-2 rounded-md border p-2.5 text-left transition-colors ${form.owner_type === "group" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
                <Users className="h-3.5 w-3.5" />
                <div className="text-xs">
                  <p className="font-medium">Group</p>
                  <p className="text-[10px] text-muted-foreground">Any member submits</p>
                </div>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {form.owner_type === "individual" ? (
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
            ) : (
              <div className="space-y-1.5">
                <Label className="text-xs">Group *</Label>
                <Select value={form.owning_group_id} onValueChange={v => update("owning_group_id", v)}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder={groups.length ? "Select group" : "No groups yet"} />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map(g => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name} {g.member_count != null && <span className="text-muted-foreground">· {g.member_count}</span>}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {groups.length === 0 && (
                  <p className="text-[10px] text-muted-foreground">Create groups in the Team tab first.</p>
                )}
              </div>
            )}
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

          {/* Canonical stage (required for new deliverables) */}
          <div className="space-y-1.5">
            <Label className="text-xs">Stage *</Label>
            <Select value={form.canonical_stage} onValueChange={v => update("canonical_stage", v)}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select stage" /></SelectTrigger>
              <SelectContent>
                {CANONICAL_STAGES.map(s => (
                  <SelectItem key={s} value={s}>{stageLabel(s)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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

          {/* Technical flags */}
          <div className="rounded-md border bg-muted/30 p-3 space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <Label className="text-xs flex items-center gap-1.5"><ShieldCheck className="h-3 w-3" /> Technical work</Label>
                <p className="text-[10px] text-muted-foreground">Mark if this deliverable is engineering-heavy.</p>
              </div>
              <Switch checked={form.is_technical} onCheckedChange={v => update("is_technical", v)} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <Label className="text-xs">Require tech validation</Label>
                <p className="text-[10px] text-muted-foreground">Tech Lead must validate before PM approves.</p>
              </div>
              <Switch checked={form.tech_validation_required} onCheckedChange={v => update("tech_validation_required", v)} />
            </div>
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
