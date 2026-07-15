// generate-meeting-kit
//
// The companion to generate-meeting-deck. The deck answers "what's the status,
// what do we discuss"; the kit answers "what do we actually DO in the room".
// It turns the same live progress context into a hands-on facilitation packet:
// a concrete activity anchored to the real active projects and blockers, plus
// run notes for the president/VP, a reference sheet, and discussion prompts.
//
// PEC-specific intent: last year the club stalled because meetings produced no
// real work. So the activity must move actual project state (unblock a stage,
// review a deliverable, scope an early project), never generic team-building.
//
// Auth: board/admin/recruitment lead. Context assembly runs as service role.
// Output is a self-contained, printable themed HTML document.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface Kit {
  theme_note?: string;
  activity?: {
    title?: string;
    objective?: string;
    timebox_min?: number;
    format?: string;
    materials?: string[];
    steps?: string[];
    ties_to?: string[];
  };
  facilitation?: {
    run_notes?: string[];
    what_good_looks_like?: string[];
    pitfalls?: string[];
  };
  reference?: { title?: string; items?: { term?: string; note?: string }[] };
  prompts?: string[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json().catch(() => ({}));
    const eventId = body.eventId;
    if (!eventId) return json({ error: "eventId required" }, 400);

    // Two callers: an interactive leader (default), or the system (cron
    // auto-prep) presenting the service-role key plus the user to attribute to.
    const isSystem = authHeader === `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`;
    let actorId: string | undefined;
    if (isSystem) {
      actorId = body.actorUserId;
      if (!actorId) return json({ error: "actorUserId required for system calls" }, 400);
    } else {
      if (!authHeader) return json({ error: "Unauthorized" }, 401);
      const userClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userRes } = await userClient.auth.getUser();
      actorId = userRes?.user?.id;
      if (!actorId) return json({ error: "Unauthorized" }, 401);
      const { data: allowed } = await admin.rpc("is_board_or_admin", { _user_id: actorId });
      if (allowed !== true) {
        const { data: lead } = await admin.rpc("is_recruitment_lead", { _uid: actorId });
        if (lead !== true) return json({ error: "forbidden: leadership role required" }, 403);
      }
    }

    const { data: event } = await admin.from("events").select("*").eq("id", eventId).maybeSingle();
    if (!event) return json({ error: "Event not found" }, 404);

    const { data: lastKit } = await admin
      .from("meeting_kits")
      .select("created_at")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const sinceIso = (lastKit?.created_at
      ? new Date(lastKit.created_at)
      : new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
    ).toISOString();

    // Audience scoping (mirrors generate-meeting-deck / -brief).
    let projectFilter: string[] | null = null;
    if (event.audience_scope === "cohort" && event.audience_target_id) {
      const { data: cohortProjects } = await admin
        .from("projects")
        .select("id")
        .eq("cohort_id", event.audience_target_id);
      projectFilter = (cohortProjects || []).map((p: any) => p.id);
    } else if (event.audience_scope === "project" && event.audience_target_id) {
      projectFilter = [event.audience_target_id];
    }

    const projQ = admin.from("projects").select("id, name, status, cohort_id").eq("status", "active");
    if (projectFilter) projQ.in("id", projectFilter);
    const { data: projects } = await projQ;
    const projectIds = (projects || []).map((p: any) => p.id);
    const scopeIds = projectIds.length ? projectIds : ["00000000-0000-0000-0000-000000000000"];

    const [overdueRes, blockedRes, pendingRevRes, momentumRes] = await Promise.all([
      admin.from("deliverables")
        .select("title, due_date, project_id, projects:project_id(name)")
        .lt("due_date", new Date().toISOString().slice(0, 10))
        .neq("approval_status", "approved").in("project_id", scopeIds).limit(20),
      admin.from("project_stages")
        .select("name, project_id, projects:project_id(name)")
        .eq("status", "blocked").in("project_id", scopeIds),
      admin.from("deliverables")
        .select("title, project_id, projects:project_id(name)")
        .eq("approval_status", "pending").eq("approval_required", true)
        .in("project_id", scopeIds).limit(15),
      admin.from("momentum_signals")
        .select("project_id, risk_level, signals, computed_at, projects:project_id(name)")
        .in("project_id", scopeIds)
        .gte("computed_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order("computed_at", { ascending: false }),
    ]);

    const latestMomentum: Record<string, any> = {};
    for (const m of momentumRes.data || []) {
      if (!latestMomentum[m.project_id]) latestMomentum[m.project_id] = m;
    }
    const atRisk = Object.values(latestMomentum).filter(
      (m: any) => m.risk_level === "stalled" || m.risk_level === "at_risk"
    );

    const sourceData = {
      eventTitle: event.title,
      eventTime: event.start_time,
      audienceScope: event.audience_scope,
      activeProjects: (projects || []).map((p: any) => p.name),
      overdue: (overdueRes.data || []).map((d: any) => ({ title: d.title, project: d.projects?.name, due: d.due_date })),
      blocked: (blockedRes.data || []).map((s: any) => ({ stage: s.name, project: s.projects?.name })),
      pendingReviews: (pendingRevRes.data || []).map((d: any) => ({ title: d.title, project: d.projects?.name })),
      atRiskProjects: atRisk.map((m: any) => ({ project: m.projects?.name, level: m.risk_level, signals: m.signals })),
    };

    const hasProjects = (projects || []).length > 0;

    const systemPrompt = `You are the operations chief of staff for PEC (Poly-Engineering Consulting), a Cal Poly student engineering consulting club. You design the hands-on portion of a leadership-run meeting: a concrete activity the members actually DO in the room. This club stalled in the past because meetings produced no real work, so every activity you design must move real project state forward, unblock a stage, pressure-test a deliverable, or scope an early project, and must be doable in the room in one sitting. Never propose generic ice-breakers or team-building. Use only the provided data; do not invent projects. Never use em dashes; use periods, commas, or colons.`;

    const userPrompt = `Design the hands-on kit for this meeting.

Meeting: "${event.title}"
When: ${new Date(event.start_time).toLocaleString()}
Window: since ${fmtDate(sinceIso)}
${hasProjects
        ? "Anchor the activity to the real active projects and their blockers below."
        : "There are no active projects yet (early in the season). Design a scoping/kickoff activity that turns member interest into a concrete first project charter."}

Real system data:
\`\`\`json
${JSON.stringify(sourceData, null, 2)}
\`\`\`

Return ONLY valid JSON (no markdown fence) shaped exactly:
{
  "theme_note": "short phrase naming the point of this session",
  "activity": {
    "title": "...",
    "objective": "one sentence: the concrete outcome members leave with",
    "timebox_min": 45,
    "format": "e.g. 'small teams by project' or 'full group'",
    "materials": ["what's needed: whiteboard, laptops, the deliverable draft, ..."],
    "steps": ["numbered, timed steps a first-time facilitator can run verbatim"],
    "ties_to": ["which real project/blocker each part advances, by name"]
  },
  "facilitation": {
    "run_notes": ["how the president/VP runs it, moment to moment"],
    "what_good_looks_like": ["observable signs the activity worked"],
    "pitfalls": ["common ways it goes wrong and the quick correction"]
  },
  "reference": {
    "title": "one-page reference the members can use during the activity",
    "items": [{ "term": "concept/method", "note": "tight, usable explanation" }]
  },
  "prompts": ["3 to 5 discussion prompts that surface real blockers, not opinions"]
}

Rules:
- The activity must produce a real artifact (an unblock plan, a reviewed deliverable, a project charter), not a discussion for its own sake.
- Steps are timed and add up to timebox_min. Each step is one line.
- Name real projects from the data wherever the activity touches them.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      if (aiRes.status === 429) return json({ error: "AI rate limit reached — try again in a minute" }, 429);
      if (aiRes.status === 402) return json({ error: "AI credits exhausted. Add funds in Workspace settings." }, 402);
      return json({ error: `AI error: ${await aiRes.text()}` }, 500);
    }

    const aiJson = await aiRes.json();
    const raw = aiJson?.choices?.[0]?.message?.content?.trim() || "{}";
    let kit: Kit;
    try {
      kit = JSON.parse(raw);
    } catch {
      const stripped = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
      kit = JSON.parse(stripped);
    }
    if (!kit.activity || !kit.activity.title) return json({ error: "AI returned no activity" }, 500);

    const kitHtml = renderKit({
      kit,
      eventTitle: event.title,
      eventTime: event.start_time,
      sinceIso,
    });

    const { data: stored, error: insErr } = await admin
      .from("meeting_kits")
      .insert({
        event_id: eventId,
        generated_by: actorId,
        theme_note: kit.theme_note || null,
        kit,
        kit_html: kitHtml,
        source_snapshot: sourceData,
      })
      .select("id, created_at, theme_note")
      .single();

    if (insErr) return json({ error: insErr.message }, 500);

    return json({ kit: { ...stored, kit_html: kitHtml, data: kit } });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

// ---- Themed, printable kit renderer ----------------------------------------

function ul(items: unknown[] | undefined, cls = ""): string {
  if (!items || items.length === 0) return "";
  return `<ul class="${cls}">${items.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;
}

function ol(items: unknown[] | undefined): string {
  if (!items || items.length === 0) return "";
  return `<ol>${items.map((x) => `<li>${esc(x)}</li>`).join("")}</ol>`;
}

function section(no: string, title: string, inner: string): string {
  if (!inner.trim()) return "";
  return `<section class="block">
    <div class="titleblock"><span class="mono no">${no}</span><h2 class="display">${esc(title)}</h2></div>
    ${inner}
  </section>`;
}

function renderKit(o: { kit: Kit; eventTitle: string; eventTime: string; sinceIso: string }): string {
  const k = o.kit;
  const a = k.activity || {};
  const f = k.facilitation || {};
  const r = k.reference || {};
  const meta: string[] = [];
  if (a.timebox_min) meta.push(`${esc(a.timebox_min)} min`);
  if (a.format) meta.push(esc(a.format));

  const activityInner = `
    ${a.objective ? `<p class="lead">${esc(a.objective)}</p>` : ""}
    ${meta.length ? `<p class="mono tags">${meta.join(" · ")}</p>` : ""}
    ${a.materials?.length ? `<h3 class="sub">Materials</h3>${ul(a.materials, "tick")}` : ""}
    ${a.steps?.length ? `<h3 class="sub">Run sheet</h3>${ol(a.steps)}` : ""}
    ${a.ties_to?.length ? `<h3 class="sub">Moves these forward</h3>${ul(a.ties_to, "tie")}` : ""}
  `;

  const facInner = `
    ${f.run_notes?.length ? `<h3 class="sub">Run notes</h3>${ul(f.run_notes)}` : ""}
    ${f.what_good_looks_like?.length ? `<h3 class="sub">What good looks like</h3>${ul(f.what_good_looks_like, "good")}` : ""}
    ${f.pitfalls?.length ? `<h3 class="sub">Pitfalls</h3>${ul(f.pitfalls, "warn")}` : ""}
  `;

  const refItems = (r.items || [])
    .map((i) => `<div class="refrow"><span class="term mono">${esc(i.term)}</span><span class="def">${esc(i.note)}</span></div>`)
    .join("");
  const refInner = refItems ? `<div class="reftable">${refItems}</div>` : "";

  const genLine = `${esc(o.eventTitle)} · generated ${new Date().toLocaleString("en-US")}`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(o.eventTitle)} — Meeting Kit</title>
<style>
  :root{
    --paper:hsl(44 35% 94%); --paper2:hsl(43 47% 97%); --ink:hsl(150 8% 9%);
    --ink2:hsl(150 5% 31%); --accent:hsl(16 100% 45%); --green:hsl(156 44% 20%);
    --line:hsl(45 20% 81%);
    --serif:'Instrument Serif',Georgia,'Times New Roman',serif;
    --sans:'Inter Variable',Inter,system-ui,-apple-system,sans-serif;
    --mono:'IBM Plex Mono',ui-monospace,'SFMono-Regular',Menlo,monospace;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:var(--ink);color:var(--ink);font-family:var(--sans);line-height:1.5;
    padding:40px 16px 80px}
  .sheet{max-width:820px;margin:0 auto;background:
      linear-gradient(var(--line) 1px,transparent 1px) 0 0/100% 32px,
      linear-gradient(90deg,var(--line) 1px,transparent 1px) 0 0/32px 100%,
      var(--paper);
    background-blend-mode:soft-light,soft-light,normal;
    border:1px solid var(--line);padding:56px 60px 64px;position:relative;
    box-shadow:0 20px 60px rgba(0,0,0,.35)}
  .display{font-family:var(--serif);font-weight:400;letter-spacing:-.01em;line-height:1.05}
  .mono{font-family:var(--mono);font-size:.72rem;letter-spacing:.06em}
  .stamp{color:var(--accent);border:1.5px solid var(--accent);border-radius:2px;
    padding:.35em .6em;text-transform:uppercase;display:inline-block}
  header{border-bottom:2px solid var(--ink);padding-bottom:18px;margin-bottom:8px}
  header h1{font-size:clamp(2rem,5vw,3.2rem);margin:14px 0 6px;max-width:20ch}
  header .theme{color:var(--ink2);font-size:1.05rem}
  .block{padding:26px 0;border-bottom:1px solid var(--line)}
  .block:last-of-type{border-bottom:none}
  .titleblock{display:flex;align-items:baseline;gap:.8rem;margin-bottom:12px}
  .titleblock .no{color:var(--accent)}
  .titleblock h2{font-size:1.7rem}
  .lead{font-size:1.15rem;color:var(--ink);margin-bottom:10px}
  .sub{font-family:var(--sans);font-weight:600;font-size:.8rem;text-transform:uppercase;
    letter-spacing:.06em;color:var(--ink2);margin:16px 0 6px}
  .tags{color:var(--green);text-transform:uppercase;margin-bottom:4px}
  ul,ol{margin:0 0 4px 0;padding-left:0;list-style:none}
  ol{counter-reset:s}
  ol li{counter-increment:s;position:relative;padding:4px 0 4px 2.4em}
  ol li::before{content:counter(s,decimal-leading-zero);position:absolute;left:0;top:4px;
    font-family:var(--mono);font-size:.75rem;color:var(--accent)}
  ul li{position:relative;padding:4px 0 4px 1.5em}
  ul li::before{content:"";position:absolute;left:0;top:.7em;width:.55em;height:.55em;
    background:var(--accent);transform:rotate(45deg)}
  ul.tick li::before,ul.good li::before{background:var(--green);transform:none;border-radius:50%}
  ul.warn li::before{background:none;color:var(--accent);content:"!";font-family:var(--mono);
    font-weight:700;top:.15em;transform:none;width:auto;height:auto}
  ul.tie li::before{background:var(--green)}
  .reftable{border:1px solid var(--line);border-radius:3px;overflow:hidden}
  .refrow{display:grid;grid-template-columns:minmax(120px,30%) 1fr;border-bottom:1px solid var(--line)}
  .refrow:last-child{border-bottom:none}
  .refrow .term{padding:10px 12px;background:var(--paper2);color:var(--green);
    text-transform:uppercase;border-right:1px solid var(--line)}
  .refrow .def{padding:10px 14px}
  footer{margin-top:22px;color:var(--ink2);font-family:var(--mono);font-size:.66rem;
    letter-spacing:.06em;text-transform:uppercase;display:flex;justify-content:space-between;gap:12px}
  @media print{
    body{background:#fff;padding:0}
    .sheet{box-shadow:none;border:none;max-width:none;padding:0.6in}
    .block{break-inside:avoid}
  }
</style>
</head>
<body>
<div class="sheet">
  <header>
    <span class="stamp mono">PEC · HANDS-ON KIT</span>
    <h1 class="display">${esc(a.title || o.eventTitle)}</h1>
    ${k.theme_note ? `<p class="theme">${esc(k.theme_note)}</p>` : ""}
  </header>
  ${section("01", "The activity", activityInner)}
  ${section("02", "Facilitation", facInner)}
  ${section("03", r.title || "Reference", refInner)}
  ${k.prompts?.length ? section("04", "Discussion prompts", ol(k.prompts)) : ""}
  <footer>
    <span>${genLine}</span>
    <span>Press P to print</span>
  </footer>
</div>
<script>
  document.addEventListener('keydown',function(e){ if(e.key==='p'||e.key==='P'){window.print()} });
</script>
</body>
</html>`;
}
