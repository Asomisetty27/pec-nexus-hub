import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ThumbsUp, ThumbsDown, Minus, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";

type Rating = "positive" | "neutral" | "negative";

export interface FeedbackOption {
  label: string;
  rating: Rating;
}

interface Props {
  /** Stable feature key, e.g. "schedule_import", "ask_nexus", "deliverable_submit". */
  feature: string;
  /** Question shown to the user. Keep it specific, not generic. */
  prompt: string;
  /** 2–4 short option chips. Defaults to thumbs up / kind of / thumbs down. */
  options?: FeedbackOption[];
  /** Optional context (project_id, event_id, etc.). Stored verbatim. */
  contextType?: string;
  contextId?: string;
  /** When false the prompt won't render. Use for conditional triggers. */
  show?: boolean;
  /** Optional CSS classes. */
  className?: string;
  /** Called after submit or dismiss so the host can hide. */
  onClose?: () => void;
}

const DEFAULT_OPTIONS: FeedbackOption[] = [
  { label: "Yes", rating: "positive" },
  { label: "Kind of", rating: "neutral" },
  { label: "No", rating: "negative" },
];

/**
 * Subtle, dismissible micro-feedback chip.
 * - 1-click rating, optional comment for neutral/negative.
 * - Dedupes per browser session via sessionStorage so a user only sees a given
 *   feature prompt once per session, regardless of mount/unmount.
 * - Never blocks workflow — failures are silent.
 */
export function FeedbackPrompt({
  feature,
  prompt,
  options = DEFAULT_OPTIONS,
  contextType,
  contextId,
  show = true,
  className,
  onClose,
}: Props) {
  const { user } = useAuth();
  const sessionKey = `nexus.fb.${feature}`;
  const [hidden, setHidden] = useState<boolean>(() => {
    try {
      return typeof window !== "undefined" && !!sessionStorage.getItem(sessionKey);
    } catch {
      return false;
    }
  });
  const [submitted, setSubmitted] = useState<Rating | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [comment, setComment] = useState("");
  const [savingComment, setSavingComment] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  // Auto-collapse positive after a short beat.
  useEffect(() => {
    if (submitted === "positive") {
      const t = setTimeout(() => {
        setHidden(true);
        onClose?.();
      }, 1400);
      return () => clearTimeout(t);
    }
  }, [submitted, onClose]);

  if (!show || hidden || !user) return null;

  const markSeen = () => {
    try {
      sessionStorage.setItem(sessionKey, "1");
    } catch {
      /* noop */
    }
  };

  const submit = async (opt: FeedbackOption) => {
    setSubmitted(opt.rating);
    markSeen();
    if (opt.rating !== "positive") setExpanded(true);
    try {
      const { data, error } = await supabase
        .from("feedback_events")
        .insert({
          user_id: user.id,
          feature,
          context_type: contextType || null,
          context_id: contextId || null,
          rating: opt.rating,
          tag: opt.label,
        })
        .select("id")
        .single();
      if (!error && data) setSubmittedId(data.id);
    } catch {
      /* silent — never block the user */
    }
  };

  const saveComment = async () => {
    if (!submittedId || !comment.trim()) {
      setExpanded(false);
      setHidden(true);
      onClose?.();
      return;
    }
    setSavingComment(true);
    try {
      await supabase
        .from("feedback_events")
        .update({ comment: comment.trim().slice(0, 500) })
        .eq("id", submittedId);
    } catch {
      /* silent */
    } finally {
      setSavingComment(false);
      setHidden(true);
      onClose?.();
    }
  };

  const dismiss = () => {
    markSeen();
    setHidden(true);
    onClose?.();
  };

  return (
    <div
      className={cn(
        "rounded-md border bg-muted/30 px-3 py-2 text-xs flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-1",
        className,
      )}
      role="region"
      aria-label="Quick feedback"
    >
      {submitted === null ? (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <span className="text-muted-foreground">{prompt}</span>
          <div className="flex items-center gap-1">
            {options.map((opt) => (
              <Button
                key={opt.label}
                size="sm"
                variant="outline"
                className="h-7 px-2 text-[11px] gap-1"
                onClick={() => submit(opt)}
              >
                {opt.rating === "positive" && <ThumbsUp className="h-3 w-3" />}
                {opt.rating === "neutral" && <Minus className="h-3 w-3" />}
                {opt.rating === "negative" && <ThumbsDown className="h-3 w-3" />}
                {opt.label}
              </Button>
            ))}
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-muted-foreground"
              onClick={dismiss}
              aria-label="Dismiss feedback prompt"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      ) : !expanded ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Check className="h-3 w-3 text-primary" /> Thanks — noted.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">What felt off? (optional)</span>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 text-muted-foreground"
              onClick={() => {
                setExpanded(false);
                setHidden(true);
                onClose?.();
              }}
              aria-label="Skip detail"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, 500))}
            placeholder="One line is fine."
            rows={2}
            className="text-xs"
          />
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-[11px]"
              onClick={() => {
                setExpanded(false);
                setHidden(true);
                onClose?.();
              }}
            >
              Skip
            </Button>
            <Button
              size="sm"
              className="h-7 text-[11px]"
              onClick={saveComment}
              disabled={savingComment}
            >
              {savingComment ? "Saving…" : "Send"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default FeedbackPrompt;