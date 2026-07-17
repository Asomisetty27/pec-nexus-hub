// plan-season
//
// Materializes an entire semester's calendar into the events table in one
// click, so the president/VP never hand-build the schedule. The plan is
// deterministic date math grounded in the club's operating model (vault:
// "Fall 2026 cold-start launch plan" + "Engagement OS v2" + "How elite student
// consulting orgs operate"): recruiting runway, one 5-sprint engagement, weekly
// hands-on working sessions (generic meetings killed), a monthly 30-minute
// all-hands, sprint gate reviews, milestone socials, delivery, and retro.
//
// Idempotent: every generated event is tagged with plan_key; a re-run deletes
// the prior run for that key and re-inserts, so the calendar can be regenerated
// or tuned freely before the season starts. Admin only. No AI: the schedule is
// deterministic and fully testable offline. Once events exist, the daily
// auto-prep-meetings job generates each working session's deck + kit.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

export interface PlannedEvent {
  title: string;
  description: string;
  event_type: string;
  start_time: string;
  end_time: string | null;
  is_public: boolean;
  audience_scope: string;
}

// Pacific wall-clock -> ISO with the correct offset. US DST ends the first
// Sunday of November; for 2026 that is Nov 1, so dates before Nov 1 are PDT
// (-07:00) and Nov 1 onward are PST (-08:00). Good enough for a fall calendar.
function pt(dateYMD: string, hh: number, mm = 0): string {
  const offset = dateYMD < "2026-11-01" ? "-07:00" : "-08:00";
  const h = String(hh).padStart(2, "0");
  const m = String(mm).padStart(2, "0");
  return `${dateYMD}T${h}:${m}:00${offset}`;
}

function plus(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60000).toISOString();
}

// The Fall 2026 plan. Anchors are the dates from the cold-start launch plan.
export function buildFall2026Plan(): PlannedEvent[] {
  const ev: PlannedEvent[] = [];
  const push = (
    title: string,
    dateYMD: string,
    hh: number,
    mm: number,
    durationMin: number,
    event_type: string,
    description: string,
    opts: { is_public?: boolean; audience_scope?: string } = {}
  ) => {
    const start = pt(dateYMD, hh, mm);
    ev.push({
      title,
      description,
      event_type,
      start_time: new Date(start).toISOString(),
      end_time: durationMin ? plus(start, durationMin) : null,
      is_public: opts.is_public ?? false,
      audience_scope: opts.audience_scope ?? "all_members",
    });
  };

  // ---- Recruiting runway ---------------------------------------------------
  // Dates verified against the Cal Poly registrar (2026-07-17): WOW Aug 19-23
  // (move-in Aug 18-19), classes begin Aug 24, add/drop Sep 4, Labor Day Sep 7,
  // fall break Nov 23-29, last day of classes Dec 11, finals Dec 14-18.
  push("WOW club fair (recruiting front door)", "2026-08-19", 10, 0, 6 * 60, "presentation",
    "Table at the WOW club fair with the signed fall client project as the pitch: join and ship this, this semester. WOW runs Aug 19-23; front door for applications.",
    { is_public: true });
  push("WOW club fair (day 2)", "2026-08-20", 10, 0, 6 * 60, "presentation",
    "Second day of WOW tabling. Collect interest, point students to the application.",
    { is_public: true });
  push("First day of classes", "2026-08-24", 8, 0, 0, "other",
    "Cal Poly's first-ever semester begins. Applications open in Nexus the same day, reviewed as they arrive.",
    { is_public: true });
  push("Info session", "2026-08-26", 18, 0, 60, "presentation",
    "What PEC is, the real project on offer, the commitment (5 hrs/week, one artifact per sprint), and how to apply. Recruit for reliability over brilliance.",
    { is_public: true });
  push("Applications close", "2026-09-04", 23, 59, 0, "other",
    "Application window closes, aligned with the Cal Poly add/drop deadline. Ranked screening follows.",
    { is_public: true });
  push("Interview week opens (self-serve scheduling)", "2026-09-08", 9, 0, 0, "other",
    "Candidates book interview slots in Nexus. Starts Tuesday since Monday Sep 7 is Labor Day. Dual-screener rubric, small enough volume for same-day reads.");
  push("Decisions and offers", "2026-09-12", 12, 0, 0, "leadership_meeting",
    "Amogh and Sam finalize 6 to 8 seats plus a ranked waitlist. Offers sent with the written commitment contract.");

  // ---- Onboarding ----------------------------------------------------------
  push("Onboarding + charter signing", "2026-09-15", 18, 0, 90, "training_session",
    "New members complete the Role HQ onboarding checklist, sign the commitment contract, team channel goes live, and the client charter is signed. Every member leaves owning a named sprint-one artifact.");
  push("Kickoff social", "2026-09-18", 18, 30, 120, "social",
    "Low-key welcome for the new team before Sprint 1. Meet the people you will ship with.");

  // ---- Engagement: 5 sprints, Sep 21 -> Dec 4 ------------------------------
  // Weekly hands-on working sessions, Mondays 6:00pm, skipping Thanksgiving week.
  const workingMondays = [
    "2026-09-21", "2026-09-28", "2026-10-05", "2026-10-12", "2026-10-19",
    "2026-10-26", "2026-11-02", "2026-11-09", "2026-11-16", "2026-11-30",
  ]; // Nov 23 (Thanksgiving week) deliberately skipped as the buffer.
  workingMondays.forEach((d, i) => {
    push(`Sprint working session (week ${i + 1})`, d, 18, 0, 90, "project_meeting",
      "Hands-on delivery session. Nexus auto-generates the agenda deck and a hands-on kit from current project progress. Members do the real work; leadership just runs the room.");
  });

  // Sprint gate reviews at each 2-week boundary (Fridays), final one is delivery.
  const gates: [string, string][] = [
    ["2026-10-02", "Sprint 1 gate review"],
    ["2026-10-16", "Sprint 2 gate review"],
    ["2026-10-30", "Sprint 3 gate review (midpoint)"],
    ["2026-11-13", "Sprint 4 gate review"],
  ];
  gates.forEach(([d, title]) =>
    push(title, d, 17, 0, 60, "presentation",
      "Gate review: demo the sprint artifact against the quality bar, log the decision, reshape scope if needed. Midpoint gate also opens the promotion window.")
  );

  // Monthly 30-minute all-hands (the only non-project standing meeting).
  push("Monthly all-hands", "2026-09-25", 17, 30, 30, "all_hands",
    "30 minutes, whole club. Wins, one client-facing update, one ask. The only generic standing meeting; everything else is project work.");
  push("Monthly all-hands", "2026-10-23", 17, 30, 30, "all_hands",
    "30 minutes, whole club. Wins, one client-facing update, one ask.");
  push("Monthly all-hands", "2026-11-20", 17, 30, 30, "all_hands",
    "30 minutes, whole club. Wins, one client-facing update, one ask.");

  // Midpoint social after the midpoint gate.
  push("Midpoint social", "2026-10-30", 19, 0, 120, "social",
    "Halfway celebration after the midpoint gate. Reset and recommit for the delivery push.");

  // Academic anchors (no club events; visible so members plan around them).
  push("Fall break (no meetings)", "2026-11-23", 0, 0, 0, "other",
    "Cal Poly fall break, Nov 23-29. No working session this week; it is the engagement's built-in buffer before the delivery push.",
    { is_public: true });

  // ---- Delivery + close-out ------------------------------------------------
  push("Client delivery", "2026-12-04", 16, 0, 90, "presentation",
    "Final deliverable presentation to the client, one week before classes end (Dec 11). The engagement's definition of success: shipped artifact, written client quote, archive case study.");
  push("Delivery celebration", "2026-12-05", 19, 0, 150, "social",
    "Celebrate the first delivered engagement. This is the win the club was built to produce.");
  push("Engagement retro + archive", "2026-12-08", 18, 0, 90, "meeting",
    "Retro, pattern card, archive case-study entry, collect the client feedback and quote, and open the spring promotion window. Held before finals week (Dec 14-18).");
  push("Finals week (no club events)", "2026-12-14", 0, 0, 0, "other",
    "Cal Poly finals, Dec 14-18. No club events. Spring planning resumes after the break.",
    { is_public: true });

  // Built in thematic groups above; return in chronological order.
  ev.sort((a, b) => a.start_time.localeCompare(b.start_time));
  return ev;
}

const PLANS: Record<string, () => PlannedEvent[]> = {
  "fall-2026": buildFall2026Plan,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const userClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes } = await userClient.auth.getUser();
    const actorId = userRes?.user?.id;
    if (!actorId) return json({ error: "Unauthorized" }, 401);

    // Planning the whole season is a president/admin action.
    const { data: isAdmin } = await admin.rpc("is_admin", { _user_id: actorId });
    if (isAdmin !== true) return json({ error: "forbidden: admin role required" }, 403);

    const body = await req.json().catch(() => ({}));
    const seasonKey: string = body.seasonKey || "fall-2026";
    const dryRun: boolean = body.dryRun === true;

    const builder = PLANS[seasonKey];
    if (!builder) return json({ error: `unknown seasonKey: ${seasonKey}` }, 400);
    const planned = builder();

    if (dryRun) {
      return json({ seasonKey, dryRun: true, count: planned.length, events: planned });
    }

    // Idempotent replace: drop this season's prior generated events, re-insert.
    // Only events tagged with this plan_key are touched; hand-made events and
    // other seasons are untouched.
    const { error: delErr } = await admin.from("events").delete().eq("plan_key", seasonKey);
    if (delErr) return json({ error: `clear failed: ${delErr.message}` }, 500);

    const rows = planned.map((e) => ({
      ...e,
      created_by: actorId,
      plan_key: seasonKey,
      notify_on_create: false, // bulk seed; do not fire a notification per event
    }));

    const { data: inserted, error: insErr } = await admin
      .from("events")
      .insert(rows)
      .select("id, title, start_time, event_type");
    if (insErr) return json({ error: `insert failed: ${insErr.message}` }, 500);

    await admin.from("audit_logs").insert({
      user_id: actorId,
      action: "season_planned",
      target_type: "events",
      target_id: null,
      metadata: { season_key: seasonKey, count: inserted?.length ?? 0 },
    });

    return json({
      seasonKey,
      planned: inserted?.length ?? 0,
      first: inserted?.[0]?.start_time,
      last: inserted?.[inserted.length - 1]?.start_time,
      events: inserted,
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
