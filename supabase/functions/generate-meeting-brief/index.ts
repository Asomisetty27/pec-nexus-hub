import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes } = await userClient.auth.getUser();
    const user = userRes?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { eventId } = await req.json();
    if (!eventId) {
      return new Response(JSON.stringify({ error: "eventId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Load event
    const { data: event } = await admin
      .from("events")
      .select("*")
      .eq("id", eventId)
      .maybeSingle();
    if (!event) {
      return new Response(JSON.stringify({ error: "Event not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine "since last meeting" window — last brief or 14 days
    const { data: lastBrief } = await admin
      .from("meeting_briefs")
      .select("created_at")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const sinceDate = lastBrief?.created_at
      ? new Date(lastBrief.created_at)
      : new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const sinceIso = sinceDate.toISOString();

    // Audience scoping
    let projectFilter: string[] | null = null;
    let cohortFilter: string[] | null = null;
    if (event.audience_scope === "cohort" && event.audience_target_id) {
      cohortFilter = [event.audience_target_id];
      const { data: cohortProjects } = await admin
        .from("projects")
        .select("id")
        .eq("cohort_id", event.audience_target_id);
      projectFilter = (cohortProjects || []).map((p) => p.id);
    } else if (event.audience_scope === "project" && event.audience_target_id) {
      projectFilter = [event.audience_target_id];
    }

    // Pull source data
    const projQ = admin
      .from("projects")
      .select("id, name, status, cohort_id")
      .eq("status", "active");
    if (projectFilter) projQ.in("id", projectFilter);
    const { data: projects } = await projQ;
    const projectIds = (projects || []).map((p) => p.id);

    const [overdueRes, blockedRes, pendingRevRes, oppRes, momentumRes, recentDecRes] =
      await Promise.all([
        admin
          .from("deliverables")
          .select("id, title, due_date, project_id, projects:project_id(name)")
          .lt("due_date", new Date().toISOString().slice(0, 10))
          .neq("approval_status", "approved")
          .in("project_id", projectIds.length ? projectIds : ["00000000-0000-0000-0000-000000000000"])
          .limit(20),
        admin
          .from("project_stages")
          .select("id, name, project_id, projects:project_id(name)")
          .eq("status", "blocked")
          .in("project_id", projectIds.length ? projectIds : ["00000000-0000-0000-0000-000000000000"]),
        admin
          .from("deliverables")
          .select("id, title, project_id, projects:project_id(name), updated_at")
          .eq("approval_status", "pending")
          .eq("approval_required", true)
          .in("project_id", projectIds.length ? projectIds : ["00000000-0000-0000-0000-000000000000"])
          .order("updated_at", { ascending: true })
          .limit(15),
        admin
          .from("opportunities")
          .select("id, title, status, deadline")
          .in("status", ["intake", "evaluating"])
          .order("created_at", { ascending: false })
          .limit(8),
        admin
          .from("momentum_signals")
          .select("project_id, risk_level, risk_score, signals, computed_at, projects:project_id(name)")
          .in("project_id", projectIds.length ? projectIds : ["00000000-0000-0000-0000-000000000000"])
          .gte("computed_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .order("computed_at", { ascending: false }),
        admin
          .from("decisions")
          .select("id, title, decided_at, project_id, projects:project_id(name)")
          .gte("decided_at", sinceIso)
          .in("project_id", projectIds.length ? projectIds : ["00000000-0000-0000-0000-000000000000"])
          .order("decided_at", { ascending: false })
          .limit(10),
      ]);

    // Latest momentum per project
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
      overdue: (overdueRes.data || []).map((d: any) => ({
        title: d.title,
        project: d.projects?.name,
        due: d.due_date,
      })),
      blocked: (blockedRes.data || []).map((s: any) => ({
        stage: s.name,
        project: s.projects?.name,
      })),
      pendingReviews: (pendingRevRes.data || []).map((d: any) => ({
        title: d.title,
        project: d.projects?.name,
        waitingSince: d.updated_at,
      })),
      opportunities: (oppRes.data || []).map((o: any) => ({
        title: o.title,
        status: o.status,
        deadline: o.deadline,
      })),
      atRiskProjects: atRisk.map((m: any) => ({
        project: m.projects?.name,
        level: m.risk_level,
        signals: m.signals,
      })),
      recentDecisions: (recentDecRes.data || []).map((d: any) => ({
        title: d.title,
        project: d.projects?.name,
        decidedAt: d.decided_at,
      })),
    };

    // Build prompt
    const dataBlock = JSON.stringify(sourceData, null, 2);

    const systemPrompt = `You are the operations chief of staff for PEC (Poly-Engineering Consulting). You generate concise, scannable pre-meeting briefs for engineering leadership. You write in clean markdown with short bullet points, never long paragraphs. You are direct, neutral, and focused on what people need to act on. Do not invent facts — only use the data provided.`;

    const userPrompt = `Generate a pre-meeting brief for the following meeting.

Meeting: "${event.title}"
When: ${new Date(event.start_time).toLocaleString()}
Window covered: since ${fmtDate(sinceIso)}

Use this real system data:
\`\`\`json
${dataBlock}
\`\`\`

Format the brief in this exact markdown structure (omit a section if its data is empty):

## Pre-Meeting Brief

**Top 3 recommended agenda items**
1. ...
2. ...
3. ...

### What changed since last meeting
- ...

### Blockers & at-risk projects
- ...

### Overdue items
- ...

### Reviews awaiting action
- ...

### Pending decisions / opportunities to discuss
- ...

Keep each bullet to one line. Reference project names. Use bold for the highest-priority item in each section. If a section has no data, write "_None._"`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      if (aiRes.status === 429) {
        return new Response(
          JSON.stringify({ error: "AI rate limit reached — try again in a minute" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiRes.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Add funds in Workspace settings." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ error: `AI error: ${errText}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiJson = await aiRes.json();
    const briefMd = aiJson?.choices?.[0]?.message?.content?.trim() || "_AI returned no content._";

    // Persist
    const { data: stored, error: insErr } = await admin
      .from("meeting_briefs")
      .insert({
        event_id: eventId,
        generated_by: user.id,
        brief_markdown: briefMd,
        source_snapshot: sourceData,
      })
      .select()
      .single();

    if (insErr) {
      return new Response(JSON.stringify({ error: insErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ brief: stored }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});