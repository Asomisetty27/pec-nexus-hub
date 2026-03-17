import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HelpCircle } from "lucide-react";
import { toast } from "sonner";

interface HelpRequestButtonProps {
  cohortId?: string;
  stepId?: string;
  className?: string;
}

export function HelpRequestButton({ cohortId, stepId, className }: HelpRequestButtonProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const f = new FormData(e.currentTarget);
    const { error } = await supabase.from("help_requests").insert({
      requester_id: user.id,
      subject: f.get("subject") as string,
      body: f.get("body") as string,
      cohort_id: cohortId || null,
      step_id: stepId || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Help request submitted! Your lead will be notified.");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className={`gap-1.5 ${className || ""}`}>
          <HelpCircle className="h-3.5 w-3.5" /> Request Help
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request Help</DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Your request will be routed to your Tech Lead first.
          </p>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Subject</Label>
            <Input name="subject" required placeholder="Brief description of the issue" />
          </div>
          <div className="space-y-2">
            <Label>Details</Label>
            <Textarea name="body" rows={4} placeholder="Describe what you need help with, what you've tried, etc." />
          </div>
          <Button type="submit" className="w-full gap-2">
            <HelpCircle className="h-3.5 w-3.5" /> Submit Request
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
