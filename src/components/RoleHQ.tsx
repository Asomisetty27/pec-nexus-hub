import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowUpRight, Check, ChevronDown, Scale } from "lucide-react";

import { useAuth } from "@/lib/auth";
import { selectPlaybook, weekKey } from "@/lib/roleHQ";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

/**
 * Role HQ: the first thing every signed-in person sees. States their mission,
 * derives this week's duties, spells out decision rights, and links the tabs
 * allocated to their role. Weekly check-off persists per ISO week.
 */
export function RoleHQ() {
  const { profile, highestRole, isAdmin, isCohortLead } = useAuth();
  const playbook = useMemo(
    () =>
      selectPlaybook({
        highestRole,
        isAdmin,
        isCohortLead,
        memberStatus: (profile as { member_status?: string } | null)?.member_status,
      }),
    [highestRole, isAdmin, isCohortLead, profile],
  );

  const storageKey = `hq-${playbook.key}-${weekKey()}`;
  const [done, setDone] = useState<number[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) ?? "[]");
    } catch {
      return [];
    }
  });
  const [rightsOpen, setRightsOpen] = useState(false);

  const toggle = (i: number) => {
    const next = done.includes(i) ? done.filter((d) => d !== i) : [...done, i];
    setDone(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
  };

  const progress = playbook.weekly.length
    ? Math.round((done.length / playbook.weekly.length) * 100)
    : 0;

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      aria-label="Your role headquarters"
      className="title-block mb-6 bg-card"
    >
      {/* Header strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="stamp text-accent">{playbook.title}</span>
            <span className="label text-muted-foreground">your hq · resets monday</span>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-foreground">{playbook.mission}</p>
        </div>
        <div className="text-right">
          <div className="font-display text-4xl leading-none">{progress}%</div>
          <div className="label mt-1 text-muted-foreground">week complete</div>
        </div>
      </div>

      <div className="grid gap-0 md:grid-cols-[1.2fr_1fr] md:divide-x md:divide-border">
        {/* This week */}
        <div className="px-5 py-4">
          <div className="label mb-3 text-muted-foreground">this week, in order</div>
          <ul className="space-y-1.5">
            {playbook.weekly.map((task, i) => {
              const checked = done.includes(i);
              return (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => toggle(i)}
                    aria-pressed={checked}
                    className="group flex w-full items-start gap-3 rounded-sm px-2 py-1.5 text-left transition-colors hover:bg-muted/60 active:translate-y-px"
                  >
                    <span
                      className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center border transition-colors ${
                        checked
                          ? "border-success bg-success text-success-foreground"
                          : "border-muted-foreground/50 group-hover:border-accent"
                      }`}
                    >
                      {checked && <Check className="h-3 w-3" />}
                    </span>
                    <span
                      className={`text-sm leading-snug transition-colors ${
                        checked ? "text-muted-foreground line-through" : ""
                      }`}
                    >
                      {task}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Resources + decision rights */}
        <div className="border-t border-border px-5 py-4 md:border-t-0">
          <div className="label mb-3 text-muted-foreground">your rooms</div>
          <div className="grid gap-1.5">
            {playbook.resources.map((r) => (
              <Link
                key={r.url}
                to={r.url}
                className="group flex items-center justify-between gap-2 rounded-sm border border-border bg-background px-3 py-2 transition-colors hover:border-accent active:translate-y-px"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium">{r.title}</div>
                  <div className="truncate text-xs text-muted-foreground">{r.desc}</div>
                </div>
                <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-accent" />
              </Link>
            ))}
          </div>

          <Collapsible open={rightsOpen} onOpenChange={setRightsOpen} className="mt-4">
            <CollapsibleTrigger className="label flex w-full items-center justify-between rounded-sm border border-border px-3 py-2 text-muted-foreground transition-colors hover:border-accent hover:text-foreground">
              <span className="flex items-center gap-2">
                <Scale className="h-3.5 w-3.5" /> decision rights
              </span>
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${rightsOpen ? "rotate-180" : ""}`} />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-3 rounded-sm border border-border bg-background p-3">
              <div>
                <div className="label mb-1 text-success">you decide alone</div>
                <ul className="list-inside list-disc space-y-0.5 text-xs text-muted-foreground">
                  {playbook.canDecide.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </div>
              {playbook.mustEscalate.length > 0 && (
                <div>
                  <div className="label mb-1 text-accent">must escalate</div>
                  <ul className="list-inside list-disc space-y-0.5 text-xs text-muted-foreground">
                    {playbook.mustEscalate.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="label text-muted-foreground">
                escalation route → <span className="text-foreground">{playbook.escalateTo}</span>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>
    </motion.section>
  );
}
