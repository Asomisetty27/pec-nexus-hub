import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Sparkles, RefreshCw, Copy, Check } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface Brief {
  id: string;
  brief_markdown: string;
  created_at: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  eventTitle: string;
}

export function MeetingBriefDialog({ open, onOpenChange, eventId, eventTitle }: Props) {
  const [brief, setBrief] = useState<Brief | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open || !eventId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("meeting_briefs")
        .select("id, brief_markdown, created_at")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled) {
        setBrief(data);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, eventId]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-meeting-brief", {
        body: { eventId },
      });
      if (error) throw error;
      setBrief((data as any).brief);
      toast.success("Brief generated");
    } catch (e: any) {
      toast.error("Could not generate brief", { description: e.message });
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!brief) return;
    await navigator.clipboard.writeText(brief.brief_markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Pre-meeting brief
          </DialogTitle>
          <DialogDescription className="text-xs">
            {eventTitle} — auto-generated from real Nexus data (overdue items, blockers, reviews,
            momentum risk, recent decisions, opportunities).
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-3 -mr-3">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ) : brief ? (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown>{brief.brief_markdown}</ReactMarkdown>
              <p className="mt-4 text-[10px] text-muted-foreground border-t pt-2">
                Generated {new Date(brief.created_at).toLocaleString()}
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Sparkles className="h-8 w-8 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground mb-1">No brief yet</p>
              <p className="text-xs text-muted-foreground/70 max-w-sm">
                Generate a one-click summary of what changed, what's blocked, what needs review, and
                a suggested top-3 agenda.
              </p>
            </div>
          )}
        </ScrollArea>

        <div className="flex items-center justify-end gap-2 pt-2 border-t">
          {brief && (
            <Button variant="ghost" size="sm" onClick={handleCopy}>
              {copied ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          )}
          <Button size="sm" onClick={handleGenerate} disabled={generating}>
            {generating ? (
              <>
                <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                {brief ? "Regenerate" : "Generate brief"}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}