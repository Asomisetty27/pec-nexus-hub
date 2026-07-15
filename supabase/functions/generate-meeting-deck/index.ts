// generate-meeting-deck
//
// Turns the same live progress context that powers generate-meeting-brief into
// a presentable, themed slide deck the president/VP can project during a
// hands-on meeting with zero prep. The AI structures the content as slides;
// this function owns the fixed, house-styled HTML template so the look is
// deterministic and on-brand ("engineering document come alive": drafting
// paper, ink, safety orange, title-block frames).
//
// Auth: any signed-in board/lead can generate. Context assembly runs with the
// service role. Output is a self-contained HTML string (no external requests)
// stored on meeting_decks and returned to the caller to open/present/print.

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

// HTML-escape everything the AI produces before it lands in the template.
function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface Slide {
  kind?: string;
  title?: string;
  subtitle?: string;
  bullets?: string[];
  footnote?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes } = await userClient.auth.getUser();
    const user = userRes?.user;
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { eventId } = await req.json();
    if (!eventId) return json({ error: "eventId required" }, 400);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: event } = await admin.from("events").select("*").eq("id", eventId).maybeSingle();
    if (!event) return json({ error: "Event not found" }, 404);

    // Only board/leads should generate a leadership deck.
    const { data: allowed } = await admin.rpc("is_board_or_admin", { _user_id: user.id });
    if (allowed !== true) {
      const { data: lead } = await admin.rpc("is_recruitment_lead", { _uid: user.id });
      if (lead !== true) return json({ error: "forbidden: leadership role required" }, 403);
    }

    // Window: since last deck for this event, else 14 days.
    const { data: lastDeck } = await admin
      .from("meeting_decks")
      .select("created_at")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const sinceIso = (lastDeck?.created_at
      ? new Date(lastDeck.created_at)
      : new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
    ).toISOString();

    // Audience scoping (mirrors generate-meeting-brief).
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

    const [overdueRes, blockedRes, pendingRevRes, oppRes, momentumRes, recentDecRes] =
      await Promise.all([
        admin.from("deliverables")
          .select("title, due_date, project_id, projects:project_id(name)")
          .lt("due_date", new Date().toISOString().slice(0, 10))
          .neq("approval_status", "approved").in("project_id", scopeIds).limit(20),
        admin.from("project_stages")
          .select("name, project_id, projects:project_id(name)")
          .eq("status", "blocked").in("project_id", scopeIds),
        admin.from("deliverables")
          .select("title, project_id, projects:project_id(name), updated_at")
          .eq("approval_status", "pending").eq("approval_required", true)
          .in("project_id", scopeIds).order("updated_at", { ascending: true }).limit(15),
        admin.from("opportunities")
          .select("title, status, deadline").in("status", ["intake", "evaluating"])
          .order("created_at", { ascending: false }).limit(8),
        admin.from("momentum_signals")
          .select("project_id, risk_level, signals, computed_at, projects:project_id(name)")
          .in("project_id", scopeIds)
          .gte("computed_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .order("computed_at", { ascending: false }),
        admin.from("decisions")
          .select("title, decided_at, project_id, projects:project_id(name)")
          .gte("decided_at", sinceIso).in("project_id", scopeIds)
          .order("decided_at", { ascending: false }).limit(10),
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
      sinceDate: sinceIso,
      activeProjects: (projects || []).map((p: any) => p.name),
      overdue: (overdueRes.data || []).map((d: any) => ({ title: d.title, project: d.projects?.name, due: d.due_date })),
      blocked: (blockedRes.data || []).map((s: any) => ({ stage: s.name, project: s.projects?.name })),
      pendingReviews: (pendingRevRes.data || []).map((d: any) => ({ title: d.title, project: d.projects?.name })),
      opportunities: (oppRes.data || []).map((o: any) => ({ title: o.title, status: o.status, deadline: o.deadline })),
      atRiskProjects: atRisk.map((m: any) => ({ project: m.projects?.name, level: m.risk_level, signals: m.signals })),
      recentDecisions: (recentDecRes.data || []).map((d: any) => ({ title: d.title, project: d.projects?.name })),
    };

    const systemPrompt = `You are the operations chief of staff for PEC (Poly-Engineering Consulting), a Cal Poly student engineering consulting club. You turn real progress data into a tight, presentable slide deck for a hands-on leadership meeting. The president and VP will project these slides and run the meeting straight off them, so every slide must be self-explanatory and action-oriented. Never invent facts; use only the data provided. If a section has no data, skip that slide rather than padding. Never use em dashes; use periods, commas, or colons instead.`;

    const userPrompt = `Build a slide deck for this meeting.

Meeting: "${event.title}"
When: ${new Date(event.start_time).toLocaleString()}
Window covered: since ${fmtDate(sinceIso)}

Real system data:
\`\`\`json
${JSON.stringify(sourceData, null, 2)}
\`\`\`

Return ONLY valid JSON (no markdown fence) shaped exactly:
{
  "theme_note": "one short phrase naming the through-line of this meeting, e.g. 'Unblock and ship'",
  "slides": [
    { "kind": "title", "title": "...", "subtitle": "..." },
    { "kind": "agenda", "title": "Agenda", "bullets": ["...","...","..."] },
    { "kind": "content", "title": "...", "bullets": ["...","..."], "footnote": "optional one-liner" },
    { "kind": "closing", "title": "This week's asks", "bullets": ["owner: action","..."] }
  ]
}

Rules:
- 6 to 9 slides total. First slide kind "title", second "agenda", last "closing".
- Content slides cover, in priority order and only if the data supports them: blockers & at-risk projects, overdue items, reviews awaiting a decision, decisions since last meeting, opportunities to weigh. One theme per slide.
- Each bullet is one line, concrete, names the project. The closing slide's bullets each name an owner and a single next action, formatted "Owner: action".
- Agenda bullets are the meeting's actual talking points derived from the data, not generic.`;

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
    let parsed: { theme_note?: string; slides?: Slide[] };
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Some models still wrap in a fence despite json_object; strip and retry.
      const stripped = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
      parsed = JSON.parse(stripped);
    }
    const slides = Array.isArray(parsed.slides) ? parsed.slides : [];
    if (slides.length === 0) return json({ error: "AI returned no slides" }, 500);

    const deckHtml = renderDeck({
      slides,
      themeNote: parsed.theme_note || "",
      eventTitle: event.title,
      eventTime: event.start_time,
      sinceIso,
    });

    const { data: stored, error: insErr } = await admin
      .from("meeting_decks")
      .insert({
        event_id: eventId,
        generated_by: user.id,
        theme_note: parsed.theme_note || null,
        slides,
        deck_html: deckHtml,
        source_snapshot: sourceData,
      })
      .select("id, created_at, theme_note")
      .single();

    if (insErr) return json({ error: insErr.message }, 500);

    return json({ deck: { ...stored, deck_html: deckHtml, slides } });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

// ---- Themed, self-contained deck renderer ----------------------------------

function renderSlide(s: Slide, i: number, total: number): string {
  const kind = esc(s.kind || "content");
  const bullets = (s.bullets || [])
    .map((b) => `<li>${esc(b)}</li>`)
    .join("");
  const footnote = s.footnote ? `<p class="foot mono">${esc(s.footnote)}</p>` : "";
  const stampNo = String(i + 1).padStart(2, "0");

  if (kind === "title") {
    return `<section class="slide title" data-i="${i}">
      <div class="reg tl"></div><div class="reg tr"></div><div class="reg bl"></div><div class="reg br"></div>
      <div class="stamp mono">PEC · OPS BRIEF</div>
      <h1 class="display">${esc(s.title)}</h1>
      ${s.subtitle ? `<p class="sub">${esc(s.subtitle)}</p>` : ""}
      <div class="rule"></div>
      <p class="mono meta">${stampNo} / ${String(total).padStart(2, "0")}</p>
    </section>`;
  }

  return `<section class="slide" data-i="${i}">
    <div class="titleblock">
      <span class="mono no">${stampNo}</span>
      <h2 class="display">${esc(s.title)}</h2>
    </div>
    ${s.subtitle ? `<p class="sub">${esc(s.subtitle)}</p>` : ""}
    ${bullets ? `<ul class="${kind}">${bullets}</ul>` : ""}
    ${footnote}
    <div class="corner mono">${esc(kind).toUpperCase()}</div>
  </section>`;
}

function renderDeck(o: {
  slides: Slide[];
  themeNote: string;
  eventTitle: string;
  eventTime: string;
  sinceIso: string;
}): string {
  const total = o.slides.length;
  const slidesHtml = o.slides.map((s, i) => renderSlide(s, i, total)).join("\n");
  const genLine = `${esc(o.eventTitle)} · generated ${new Date().toLocaleString("en-US")}`;

  // Light "drafting paper" theme, tokens copied from src/index.css so the deck
  // reads as part of the same product. Self-contained: no external requests.
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(o.eventTitle)} — Meeting Deck</title>
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
  html,body{height:100%}
  body{background:var(--ink);color:var(--ink);font-family:var(--sans);
    display:flex;align-items:center;justify-content:center;overflow:hidden}
  .display{font-family:var(--serif);font-weight:400;letter-spacing:-.01em;line-height:1.02}
  .mono{font-family:var(--mono);font-size:.72rem;letter-spacing:.08em;text-transform:uppercase}
  .deck{width:100vw;height:100vh;position:relative}
  .slide{position:absolute;inset:0;background:
      linear-gradient(var(--line) 1px,transparent 1px) 0 0/100% 44px,
      linear-gradient(90deg,var(--line) 1px,transparent 1px) 0 0/44px 100%,
      var(--paper);
    background-blend-mode:soft-light,soft-light,normal;
    padding:8vh 9vw;display:none;flex-direction:column;justify-content:center;gap:2.2vh}
  .slide.on{display:flex}
  /* title slide */
  .slide.title{align-items:flex-start;justify-content:center}
  .slide.title h1{font-size:clamp(2.6rem,7vw,6rem);max-width:16ch}
  .slide.title .sub{font-size:clamp(1rem,2.1vw,1.6rem);color:var(--ink2);margin-top:1.5vh;max-width:44ch}
  .slide.title .stamp{color:var(--accent);border:1.5px solid var(--accent);
    padding:.4em .7em;align-self:flex-start;margin-bottom:3vh;border-radius:2px}
  .slide.title .rule{height:3px;width:120px;background:var(--accent);margin-top:4vh}
  .slide.title .meta{color:var(--ink2);margin-top:1.4vh}
  .reg{position:absolute;width:26px;height:26px;opacity:.5}
  .reg::before,.reg::after{content:"";position:absolute;background:var(--ink2)}
  .reg::before{left:12px;top:0;width:1px;height:26px}
  .reg::after{top:12px;left:0;height:1px;width:26px}
  .reg.tl{left:34px;top:34px}.reg.tr{right:34px;top:34px}
  .reg.bl{left:34px;bottom:34px}.reg.br{right:34px;bottom:34px}
  /* content slides */
  .titleblock{display:flex;align-items:baseline;gap:1rem;border-bottom:2px solid var(--ink);
    padding-bottom:1.6vh}
  .titleblock .no{color:var(--accent);font-size:.9rem}
  .titleblock h2{font-size:clamp(1.9rem,4.4vw,3.4rem)}
  .sub{color:var(--ink2);font-size:clamp(1rem,1.8vw,1.35rem)}
  ul{list-style:none;display:flex;flex-direction:column;gap:1.5vh}
  li{position:relative;padding-left:1.7em;font-size:clamp(1.05rem,2.1vw,1.7rem);
    line-height:1.3;color:var(--ink);max-width:52ch}
  li::before{content:"";position:absolute;left:0;top:.55em;width:.7em;height:.7em;
    background:var(--accent);transform:rotate(45deg)}
  ul.agenda li::before{background:none;border:2px solid var(--green);border-radius:50%;transform:none}
  ul.closing li{font-family:var(--mono);font-size:clamp(.95rem,1.7vw,1.3rem);text-transform:none}
  ul.closing li::before{background:var(--green);transform:none}
  .foot{color:var(--ink2);margin-top:1.5vh}
  .corner{position:absolute;right:9vw;bottom:6vh;color:var(--line)}
  /* chrome */
  .bar{position:fixed;left:0;right:0;bottom:0;height:34px;background:var(--ink);
    color:var(--paper);display:flex;align-items:center;justify-content:space-between;
    padding:0 16px;font-family:var(--mono);font-size:.66rem;letter-spacing:.08em;
    text-transform:uppercase;z-index:5}
  .bar .prog{height:2px;background:var(--accent);position:absolute;left:0;top:0;transition:width .2s}
  .hint{opacity:.6}
  @media print{
    body{background:#fff;display:block}
    .deck,.slide{width:100%;height:auto}
    .slide{display:flex !important;position:relative;page-break-after:always;min-height:100vh;
      border-bottom:1px solid var(--line)}
    .bar{display:none}
  }
</style>
</head>
<body>
<div class="deck" id="deck">
${slidesHtml}
</div>
<div class="bar">
  <span class="prog" id="prog"></span>
  <span id="pos">01 / ${String(total).padStart(2, "0")}</span>
  <span>${o.themeNote ? esc(o.themeNote) + " · " : ""}${genLine}</span>
  <span class="hint">← → navigate · P print</span>
</div>
<script>
  var slides=[].slice.call(document.querySelectorAll('.slide'));
  var i=0, n=slides.length;
  function show(k){
    i=Math.max(0,Math.min(n-1,k));
    slides.forEach(function(s,x){s.classList.toggle('on',x===i)});
    document.getElementById('pos').textContent=String(i+1).padStart(2,'0')+' / '+String(n).padStart(2,'0');
    document.getElementById('prog').style.width=((i+1)/n*100)+'%';
  }
  document.addEventListener('keydown',function(e){
    if(e.key==='ArrowRight'||e.key===' '||e.key==='PageDown'){e.preventDefault();show(i+1)}
    else if(e.key==='ArrowLeft'||e.key==='PageUp'){e.preventDefault();show(i-1)}
    else if(e.key==='Home'){show(0)} else if(e.key==='End'){show(n-1)}
    else if(e.key==='p'||e.key==='P'){window.print()}
  });
  document.getElementById('deck').addEventListener('click',function(e){
    var w=window.innerWidth; show(e.clientX < w*0.35 ? i-1 : i+1);
  });
  show(0);
</script>
</body>
</html>`;
}
