import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Plus } from "lucide-react";

const TYPES = [
  { v: "email_sent", l: "Email sent" },
  { v: "follow_up_sent", l: "Follow-up sent" },
  { v: "linkedin_message", l: "LinkedIn message" },
  { v: "phone_call", l: "Phone call" },
  { v: "meeting", l: "Meeting" },
  { v: "research_note", l: "Research note" },
  { v: "internal_note", l: "Internal note" },
] as const;

export function LogActivityDialog({
  organizationId,
  onLogged,
  triggerLabel = "Log activity",
}: {
  organizationId: string;
  onLogged?: () => void;
  triggerLabel?: string;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [type, setType] = useState<string>("email_sent");

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    const f = new FormData(e.currentTarget);
    const subject = (f.get("subject") as string)?.trim() || null;
    const body = (f.get("body") as string)?.trim() || null;
    const isOutreach = ["email_sent", "follow_up_sent", "linkedin_message", "phone_call", "meeting"].includes(type);

    const { error } = await supabase.from("company_activities").insert({
      organization_id: organizationId,
      performed_by: user.id,
      activity_type: type as any,
      subject,
      body,
      occurred_at: new Date().toISOString(),
    });
    if (error) {
      toast.error(error.message);
      setBusy(false);
      return;
    }
    if (isOutreach) {
      await supabase
        .from("organizations")
        .update({ last_contacted_at: new Date().toISOString() })
        .eq("id", organizationId);
    }
    setBusy(false);
    setOpen(false);
    toast.success("Activity logged");
    onLogged?.();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Plus className="h-3 w-3" /> {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Log activity</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-[10px] font-mono uppercase tracking-wider">Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => (
                  <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-mono uppercase tracking-wider">Subject</Label>
            <Input name="subject" placeholder="One-line summary" className="h-8 text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-mono uppercase tracking-wider">Notes</Label>
            <Textarea name="body" rows={4} placeholder="Optional details" />
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" size="sm" disabled={busy}>{busy ? "Logging…" : "Log activity"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
