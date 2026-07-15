// auto-prep-meetings
//
// The autonomy layer: a cron-invoked job that, each morning, finds meetings
// happening soon and generates their deck + hands-on kit from live context,
// then notifies the organizer. This is what lets the president/VP click
// nothing: they walk in and the materials already exist.
//
// Auth: this endpoint is not user-facing. It requires the shared CRON_SECRET
// (set as an edge-function secret and passed by the pg_cron job via pg_net).
// It then calls generate-meeting-deck / -kit with the service-role key and the
// event's organizer as the actor (their system-auth path).
//
// Idempotent: skips any event that already has a deck AND kit generated within
// the freshness window, so re-runs (or a meeting several days out) don't pile
// up duplicates.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET") || "";

const LOOKAHEAD_HOURS = 26; // a morning run catches meetings later today + early tomorrow
const FRESH_HOURS = 20; // consider an event already prepped if materials are this recent

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function callGenerator(fn: string, eventId: string, actorUserId: string) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ eventId, actorUserId }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${fn} ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json().catch(() => ({}));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Constant-time-ish secret gate. Not user-facing; only the cron job knows it.
    const provided = req.headers.get("x-cron-secret") || "";
    if (!CRON_SECRET || provided !== CRON_SECRET) {
      return json({ error: "forbidden" }, 401);
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json().catch(() => ({}));
    const lookahead = Number(body.lookaheadHours) || LOOKAHEAD_HOURS;
    const now = new Date();
    const windowEnd = new Date(now.getTime() + lookahead * 60 * 60 * 1000);
    const freshCutoff = new Date(now.getTime() - FRESH_HOURS * 60 * 60 * 1000).toISOString();

    // Upcoming meetings with a known organizer to attribute + notify.
    const { data: events, error: evErr } = await admin
      .from("events")
      .select("id, title, start_time, created_by")
      .gte("start_time", now.toISOString())
      .lte("start_time", windowEnd.toISOString())
      .not("created_by", "is", null)
      .order("start_time", { ascending: true });
    if (evErr) return json({ error: evErr.message }, 500);

    const results: Array<Record<string, unknown>> = [];
    let prepared = 0;
    let skipped = 0;

    for (const ev of events || []) {
      // Idempotency: skip if both a deck and a kit already exist recently.
      const [{ data: deck }, { data: kit }] = await Promise.all([
        admin.from("meeting_decks").select("id").eq("event_id", ev.id)
          .gte("created_at", freshCutoff).limit(1).maybeSingle(),
        admin.from("meeting_kits").select("id").eq("event_id", ev.id)
          .gte("created_at", freshCutoff).limit(1).maybeSingle(),
      ]);
      if (deck && kit) {
        skipped++;
        results.push({ event: ev.title, status: "skipped_fresh" });
        continue;
      }

      try {
        if (!deck) await callGenerator("generate-meeting-deck", ev.id, ev.created_by);
        if (!kit) await callGenerator("generate-meeting-kit", ev.id, ev.created_by);

        // Tell the organizer their materials are ready. Deduped per event/day.
        const dayKey = now.toISOString().slice(0, 10);
        await admin.rpc("create_notification", {
          p_user_id: ev.created_by,
          p_category: "meeting",
          p_title: `Meeting materials ready: ${ev.title}`,
          p_body: "Your slide deck and hands-on kit were auto-generated from current project progress. Open the meeting to present or print them.",
          p_link: "/app/events",
          p_actor_id: null,
          p_target_type: "event",
          p_target_id: ev.id,
          p_priority: "normal",
          p_dedupe_key: `meeting-prep-${ev.id}-${dayKey}`,
          p_metadata: { auto: true },
        });

        prepared++;
        results.push({ event: ev.title, status: "prepared" });
      } catch (e) {
        results.push({ event: ev.title, status: "error", detail: (e as Error).message });
      }
    }

    return json({
      ran_at: now.toISOString(),
      window_hours: lookahead,
      checked: (events || []).length,
      prepared,
      skipped,
      results,
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
