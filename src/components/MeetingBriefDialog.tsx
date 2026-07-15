import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Sparkles, RefreshCw, Copy, Check, Presentation, ClipboardList } from "lucide-react";

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
import { FeedbackPrompt } from "@/components/FeedbackPrompt";

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
  const [justGenerated, setJustGenerated] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [buildingKit, setBuildingKit] = useState(false);

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
      setJustGenerated(true);
      toast.success("Brief generated");
    } catch (e: any) {
      toast.error("Could not generate brief", { description: e.message });
    } finally {
      setGenerating(false);
    }
  };

  // Generate a themed artifact (slide deck or hands-on kit) from the same live
  // context and open it in a new tab. Opens the tab synchronously first so the
  // popup blocker treats it as user-initiated, then streams the HTML in when
  // ready. Deck: arrow keys advance, P prints. Kit: scrollable, P prints.
  const openGenerated = async (opts: {
    fn: string;
    pick: (data: any) => string | undefined;
    building: string;
    ok: string;
    fail: string;
    setBusy: (b: boolean) => void;
  }) => {
    opts.setBusy(true);
    const tab = window.open("", "_blank");
    if (tab) {
      tab.document.write(
        "<!doctype html><meta charset='utf-8'><title>" + opts.building + "</title>" +
          "<body style='font-family:system-ui;display:grid;place-items:center;height:100vh;margin:0;color:#555'>" +
          opts.building + "</body>"
      );
    }
    try {
      const { data, error } = await supabase.functions.invoke(opts.fn, { body: { eventId } });
      if (error) throw error;
      const html = opts.pick(data);
      if (!html) throw new Error("Came back empty");
      if (tab) {
        tab.document.open();
        tab.document.write(html);
        tab.document.close();
      } else {
        // Popup blocked: fall back to a blob URL.
        const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
        window.open(url, "_blank");
      }
      toast.success(opts.ok);
    } catch (e: any) {
      if (tab) tab.close();
      toast.error(opts.fail, { description: e.message });
    } finally {
      opts.setBusy(false);
    }
  };

  const handlePresentDeck = () =>
    openGenerated({
      fn: "generate-meeting-deck",
      pick: (d) => d?.deck?.deck_html,
      building: "Building your meeting deck…",
      ok: "Deck ready",
      fail: "Could not build deck",
      setBusy: setPresenting,
    });

  const handleMeetingKit = () =>
    openGenerated({
      fn: "generate-meeting-kit",
      pick: (d) => d?.kit?.kit_html,
      building: "Building your hands-on kit…",
      ok: "Kit ready",
      fail: "Could not build kit",
      setBusy: setBuildingKit,
    });

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

        {justGenerated && brief && (
          <FeedbackPrompt
            feature="meeting_brief"
            prompt="Was this brief useful?"
            contextType="event"
            contextId={eventId}
            options={[
              { label: "Yes", rating: "positive" },
              { label: "Partly", rating: "neutral" },
              { label: "No", rating: "negative" },
            ]}
            className="mt-2"
            onClose={() => setJustGenerated(false)}
          />
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t">
          {brief && (
            <Button variant="ghost" size="sm" onClick={handleCopy}>
              {copied ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleMeetingKit} disabled={buildingKit}>
            {buildingKit ? (
              <><RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Building…</>
            ) : (
              <><ClipboardList className="mr-1.5 h-3.5 w-3.5" /> Meeting kit</>
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={handlePresentDeck} disabled={presenting}>
            {presenting ? (
              <><RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Building…</>
            ) : (
              <><Presentation className="mr-1.5 h-3.5 w-3.5" /> Present deck</>
            )}
          </Button>
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