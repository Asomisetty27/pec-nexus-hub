// Pretty-print deliverable_review_events.event_type values for UI surfaces.
// Single source of truth — never render raw event_type strings in the product.

import {
  CheckCircle2, RefreshCw, Ban, Upload, History, PlayCircle, ShieldCheck,
  ShieldAlert, Archive, ArchiveRestore, Sparkles, Layers,
} from "lucide-react";

export type ReviewEventType =
  | "submitted"
  | "revised"
  | "started"
  | "approved"
  | "revision_requested"
  | "rejected"
  | "reopened"
  | "tech_validated"
  | "tech_unvalidated"
  | "pm_override_approved"
  | "archived"
  | "unarchived"
  | "staged"
  | string;

interface EventMeta {
  label: string;
  icon: any;
  /** Tailwind text color token */
  tone: string;
}

const META: Record<string, EventMeta> = {
  submitted:            { label: "Submitted",                 icon: Upload,         tone: "text-muted-foreground" },
  revised:              { label: "Resubmitted",               icon: RefreshCw,      tone: "text-muted-foreground" },
  started:              { label: "Marked started",            icon: PlayCircle,     tone: "text-primary" },
  approved:             { label: "Approved",                  icon: CheckCircle2,   tone: "text-success" },
  revision_requested:   { label: "Revision requested",        icon: RefreshCw,      tone: "text-destructive" },
  rejected:             { label: "Rejected",                  icon: Ban,            tone: "text-destructive" },
  reopened:             { label: "Reopened",                  icon: History,        tone: "text-muted-foreground" },
  tech_validated:       { label: "Tech validated",            icon: ShieldCheck,    tone: "text-primary" },
  tech_unvalidated:     { label: "Tech validation removed",   icon: ShieldAlert,    tone: "text-warning" },
  pm_override_approved: { label: "Approved via PM override",  icon: Sparkles,       tone: "text-warning" },
  archived:             { label: "Archived",                  icon: Archive,        tone: "text-muted-foreground" },
  unarchived:           { label: "Restored from archive",     icon: ArchiveRestore, tone: "text-muted-foreground" },
  staged:               { label: "Stage set",                 icon: Layers,         tone: "text-muted-foreground" },
};

export function reviewEventMeta(eventType: string): EventMeta {
  return META[eventType] || {
    label: eventType.replace(/_/g, " ").replace(/^\w/, c => c.toUpperCase()),
    icon: History,
    tone: "text-muted-foreground",
  };
}

export function reviewEventLabel(eventType: string): string {
  return reviewEventMeta(eventType).label;
}