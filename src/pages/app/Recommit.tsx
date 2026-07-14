import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

const CYCLE = "fall-2026";
const COMMITMENT_VERSION = "fall-2026-v1";

// The written commitment from the cold-start launch plan. Version any change.
const COMMITMENT_TERMS = [
  "5 hours per week through the engagement (Sep 21 to Dec 4)",
  "Attend sprint working sessions; two unexcused absences offers my seat to the waitlist",
  "Own a named artifact every sprint, and flag early if it is at risk",
  "Blockers get posted when they appear, not at the deadline",
];

const TEAMS = ["Hardware / Embedded", "Software / Systems", "Mechanical / Manufacturing", "Business / Ops"];

interface Row {
  id: string;
  user_id: string;
  choice: string;
  preferred_team: string | null;
  availability_hours: number | null;
  commitment_signed_at: string | null;
  note: string | null;
  created_at: string;
}

// Table is created by migration 20260714000000; the generated client types
// predate it, hence the untyped escape hatch. Regenerate types after apply.
const recommitments = () => (supabase as any).from("recommitments");

export default function Recommit() {
  const { user, isBoardOrAdmin } = useAuth();
  const [mine, setMine] = useState<Row | null>(null);
  const [all, setAll] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);

  const [choice, setChoice] = useState<"stay" | "alumni" | "leave" | null>(null);
  const [team, setTeam] = useState<string>("");
  const [hours, setHours] = useState<number>(5);
  const [signed, setSigned] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await recommitments()
        .select("*")
        .eq("cycle", CYCLE)
        .order("created_at", { ascending: false });
      if (error) {
        setTableMissing(true);
      } else {
        const rows = (data ?? []) as Row[];
        setAll(rows);
        setMine(rows.find((r) => r.user_id === user.id) ?? null);
      }
      setLoading(false);
    })();
  }, [user]);

  const counts = useMemo(() => {
    const c = { stay: 0, alumni: 0, leave: 0 };
    for (const r of all) c[r.choice as keyof typeof c] = (c[r.choice as keyof typeof c] ?? 0) + 1;
    return c;
  }, [all]);

  const submit = async () => {
    if (!user || !choice) return;
    if (choice === "stay" && !signed) {
      toast.error("The commitment contract is the seat. Check it to continue.");
      return;
    }
    setSubmitting(true);
    const payload = {
      user_id: user.id,
      cycle: CYCLE,
      choice,
      preferred_team: choice === "stay" ? team || null : null,
      availability_hours: choice === "stay" ? hours : null,
      commitment_signed_at: choice === "stay" ? new Date().toISOString() : null,
      commitment_version: choice === "stay" ? COMMITMENT_VERSION : null,
    };
    const { data, error } = await recommitments().upsert(payload, { onConflict: "user_id,cycle" }).select().single();
    if (error) {
      setSubmitting(false);
      toast.error("Could not save. Try again or ping ops.");
      return;
    }
    // The choice moves the member through the lifecycle: alumni get the
    // alumni Role HQ, leavers go inactive, stayers stay active.
    const nextStatus = choice === "alumni" ? "alumni" : choice === "leave" ? "inactive" : "active";
    await supabase.from("profiles").update({ member_status: nextStatus } as never).eq("user_id", user.id);
    setSubmitting(false);
    setMine(data as Row);
    toast.success(
      choice === "stay"
        ? "Seat confirmed. Your Role HQ updates when teams form."
        : choice === "alumni"
          ? "Welcome to the alumni network. The hub stays open to you."
          : "Recorded. Thank you for being straight with us.",
    );
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (tableMissing) {
    return (
      <div className="title-block mx-auto max-w-lg bg-card p-8 text-center">
        <span className="stamp text-warn">setup pending</span>
        <h1 className="mt-3 font-display text-3xl">Re-commitment opens soon</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The fall 2026 re-commitment window has not been opened by the board yet
          (migration 20260714000000 not applied). Check back shortly.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* header */}
      <div>
        <span className="label text-muted-foreground">fall 2026 · re-formation</span>
        <h1 className="mt-2 font-display text-4xl leading-tight md:text-5xl">
          The club is re-forming. <span className="text-accent">Claim your place.</span>
        </h1>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground">
          PEC relaunches this fall around one real client engagement and one hand-picked
          team. Tell us where you stand; every option is a good answer, and this takes
          under two minutes.
        </p>
      </div>

      {/* already answered */}
      {mine ? (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="title-block bg-card p-6">
          <span className="stamp text-success">recorded</span>
          <p className="mt-3 text-sm">
            Your answer for this cycle: <strong className="uppercase">{mine.choice}</strong>
            {mine.preferred_team && <> · preferred team: {mine.preferred_team}</>}
            {mine.commitment_signed_at && <> · commitment signed</>}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Changed your mind? Pick again below and resubmit; your latest answer counts until the window closes.
          </p>
        </motion.div>
      ) : null}

      {/* choices */}
      <div className="grid gap-3 sm:grid-cols-3">
        {(
          [
            ["stay", "Stay and build", "A seat on the fall team, with the commitment that comes with it."],
            ["alumni", "Move to alumni", "Stay connected, refer clients, mentor. Zero obligations."],
            ["leave", "Step away", "No hard feelings, and the door stays open."],
          ] as const
        ).map(([key, title, desc]) => (
          <button
            key={key}
            type="button"
            onClick={() => setChoice(key)}
            aria-pressed={choice === key}
            className={`title-block p-5 text-left transition-colors active:translate-y-px ${
              choice === key ? "bg-card ring-2 ring-accent" : "bg-background hover:bg-card"
            }`}
          >
            <div className="font-display text-2xl">{title}</div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{desc}</p>
          </button>
        ))}
      </div>

      {/* stay path: contract */}
      {choice === "stay" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="title-block bg-card p-6">
          <span className="label text-accent">the commitment contract · {COMMITMENT_VERSION}</span>
          <ul className="mt-4 space-y-2">
            {COMMITMENT_TERMS.map((t) => (
              <li key={t} className="flex items-start gap-2 text-sm">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                {t}
              </li>
            ))}
          </ul>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="label text-muted-foreground">preferred team</span>
              <select
                value={team}
                onChange={(e) => setTeam(e.target.value)}
                className="mt-1 w-full border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
              >
                <option value="">No preference</option>
                {TEAMS.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="label text-muted-foreground">realistic hours / week</span>
              <input
                type="number"
                min={3}
                max={20}
                value={hours}
                onChange={(e) => setHours(Number(e.target.value))}
                className="mt-1 w-full border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </label>
          </div>
          <label className="mt-5 flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={signed}
              onChange={(e) => setSigned(e.target.checked)}
              className="mt-1 h-4 w-4 accent-[hsl(var(--accent))]"
            />
            <span className="text-sm">
              I have read the terms and I am signing them. Five hours a week for eleven
              weeks is a real promise, and I am making it.
            </span>
          </label>
        </motion.div>
      )}

      {choice && (
        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className="label inline-flex items-center gap-3 bg-accent px-6 py-3.5 text-accent-foreground transition-colors hover:bg-primary hover:text-primary-foreground disabled:opacity-60"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {mine ? "Update my answer" : "Submit"}
        </button>
      )}

      {/* board view */}
      {isBoardOrAdmin && (
        <div className="title-block bg-card p-6">
          <span className="label text-muted-foreground">board view · live</span>
          <div className="mt-4 grid grid-cols-3 gap-px overflow-hidden border border-border bg-border text-center">
            {(["stay", "alumni", "leave"] as const).map((k) => (
              <div key={k} className="bg-background px-2 py-4">
                <div className="font-display text-4xl">{counts[k]}</div>
                <div className="label mt-1 text-muted-foreground">{k}</div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {all.length} response{all.length === 1 ? "" : "s"} so far. Non-responders convert
            to alumni at the deadline (recoverable). Full rows are in the database table
            `recommitments`.
          </p>
        </div>
      )}
    </div>
  );
}
