// Admin AI drill generator — uses Lovable AI Gateway with structured tool calling.
// Generates drafts in `pending_review` for the admin review queue.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

type Cohort = "software" | "hardware" | "mechanical" | "ops";
type Difficulty = "easy" | "medium" | "hard" | "expert";
type DrillType =
  | "multiple_choice"
  | "short_answer"
  | "scenario_analysis"
  | "prioritization"
  | "debugging_diagnosis"
  | "design_critique"
  | "mini_case";

const COHORT_CONTEXT: Record<Cohort, string> = {
  software:
    "Software & AI delivery engineering at a student consulting org. Focus on real industry skills: debugging, distributed systems, API design, code reasoning, technical communication. Drills should feel like senior-engineer interview prompts, not textbook quizzes.",
  hardware:
    "Hardware & Embedded delivery engineering. Focus on sensor integration, GPIO/I2C/SPI debugging, timing & state-machine logic, signal interpretation, hardware/software tradeoffs, reliability scenarios.",
  mechanical:
    "Mechanical & Manufacturing delivery engineering. Focus on CAD interpretation, tolerance/fit/packaging, DFM/DFA, design tradeoffs, brackets/fixtures/mounting, drawing/documentation quality, concept comparison.",
  ops:
    "Business & Marketing at a student engineering consulting org. Two lines: Company Relations (prospect research, first-touch outreach emails, discovery-call qualification, scope one-pagers, proposals, client care) and Brand & Fundraising (content calendars, social posts, campus events, fundraiser planning and recaps). Drills should feel like real work units from those lines, not textbook marketing quizzes.",
};

const TYPE_GUIDE: Record<DrillType, string> = {
  multiple_choice:
    "Use `options` as an array of 3-5 short strings. `correct_answer` is the index (0-based) of the correct option. Provide a clear `model_answer` explaining why.",
  short_answer:
    "Open-ended. `options` should be null. `correct_answer` should be null. `model_answer` is the canonical answer the user is graded against. `rubric` lists 3-4 scoring criteria.",
  scenario_analysis:
    "Real-world scenario in `scenario`. Ask the user to analyze. `model_answer` is the strong analysis; `rubric` lists what a great answer covers.",
  prioritization:
    "Use `options` as an array of 3-5 short items to rank. `correct_answer` is an array of indices in the correct priority order. Explain trade-offs in `model_answer`.",
  debugging_diagnosis:
    "Provide a buggy snippet, log, or symptom in `scenario`. `model_answer` explains the root cause and fix. `rubric` covers diagnosis, fix, prevention.",
  design_critique:
    "Provide a design in `scenario`. `model_answer` is the strong critique. `rubric` covers tradeoffs, risks, alternatives.",
  mini_case:
    "Short business/engineering case in `scenario`. `model_answer` is the recommended approach. `rubric` covers structure, prioritization, communication.",
};

function buildSystemPrompt(cohort: Cohort, type: DrillType, difficulty: Difficulty) {
  return `You are a senior engineer designing high-signal practice drills for a student consulting org.

Cohort context:
${COHORT_CONTEXT[cohort]}

Drill type: ${type}
${TYPE_GUIDE[type]}

Difficulty: ${difficulty}
- easy: foundational reasoning, ~3-5 min
- medium: applied reasoning, ~5-10 min
- hard: senior-level tradeoffs, ~10-15 min
- expert: principal-level depth, ~15-25 min

Quality bar:
- Every drill must feel relevant to a real job, not a textbook.
- "why_it_matters" must explain the industry context in 1-2 sentences.
- Avoid generic "what is X" questions. Force reasoning.
- No duplicates. Each drill must be distinct in scenario and skill tested.
- Tags should be short, lowercase, hyphen-free where possible.`;
}

const drillSchema = {
  type: "object",
  properties: {
    drills: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string", description: "Concise, specific drill title (≤80 chars)." },
          prompt: { type: "string", description: "The question or task statement shown to the user." },
          scenario: { type: "string", description: "Optional scenario, snippet, or context. Empty string if N/A." },
          options: {
            type: "array",
            items: { type: "string" },
            description: "Choices for multiple_choice or prioritization. Empty array if N/A.",
          },
          correct_answer_index: {
            type: "number",
            description: "0-based index for multiple_choice. -1 if N/A.",
          },
          correct_answer_order: {
            type: "array",
            items: { type: "number" },
            description: "Indices in correct priority order for prioritization. Empty if N/A.",
          },
          model_answer: { type: "string", description: "The canonical strong answer or explanation." },
          rubric: { type: "string", description: "Scoring criteria, one per line." },
          why_it_matters: { type: "string", description: "Industry relevance, 1-2 sentences." },
          tags: { type: "array", items: { type: "string" } },
          estimated_minutes: { type: "number" },
          xp_reward: { type: "number" },
        },
        required: [
          "title",
          "prompt",
          "model_answer",
          "why_it_matters",
          "tags",
          "estimated_minutes",
          "xp_reward",
        ],
      },
    },
  },
  required: ["drills"],
} as const;

async function callAI(systemPrompt: string, userPrompt: string) {
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
      tools: [
        {
          type: "function",
          function: {
            name: "emit_drills",
            description: "Emit the generated drills as structured data.",
            parameters: drillSchema,
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "emit_drills" } },
    }),
  });

  if (resp.status === 429) throw new Error("rate_limited");
  if (resp.status === 402) throw new Error("payment_required");
  if (!resp.ok) {
    const t = await resp.text();
    console.error("AI gateway error", resp.status, t);
    throw new Error("ai_gateway_error");
  }
  const data = await resp.json();
  const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) throw new Error("no_tool_call");
  const args = JSON.parse(toolCall.function.arguments);
  return args.drills as any[];
}

function normalizeTitle(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "missing_auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller is an admin via service-role + JWT user lookup.
    const userResp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: authHeader, apikey: SERVICE_ROLE },
    });
    if (!userResp.ok) {
      return new Response(JSON.stringify({ error: "invalid_token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { id: userId } = await userResp.json();

    const rolesResp = await fetch(
      `${SUPABASE_URL}/rest/v1/user_roles?user_id=eq.${userId}&select=role`,
      { headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` } },
    );
    const rolesData = await rolesResp.json();
    const isAdmin = Array.isArray(rolesData) && rolesData.some((r: any) =>
      ["admin", "superadmin"].includes(r.role)
    );
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "admin_only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const cohort = body.cohort as Cohort;
    const category = String(body.category || "").trim();
    const difficulty = body.difficulty as Difficulty;
    const drillType = body.drill_type as DrillType;
    const count = Math.min(Math.max(Number(body.count) || 5, 1), 10);

    if (!cohort || !category || !difficulty || !drillType) {
      return new Response(JSON.stringify({ error: "missing_params" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create job row
    const jobResp = await fetch(`${SUPABASE_URL}/rest/v1/drill_generation_jobs`, {
      method: "POST",
      headers: {
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${SERVICE_ROLE}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        cohort,
        category,
        difficulty,
        drill_type: drillType,
        count_requested: count,
        requested_by: userId,
        status: "running",
      }),
    });
    const jobRows = await jobResp.json();
    const jobId = jobRows?.[0]?.id;

    // Fetch existing titles for duplicate avoidance
    const existingResp = await fetch(
      `${SUPABASE_URL}/rest/v1/drills?cohort=eq.${cohort}&category=eq.${encodeURIComponent(category)}&select=title`,
      { headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` } },
    );
    const existing = (await existingResp.json()) as { title: string }[];
    const existingNorm = new Set(existing.map((d) => normalizeTitle(d.title)));

    const systemPrompt = buildSystemPrompt(cohort, drillType, difficulty);
    const userPrompt = `Generate ${count} distinct ${difficulty} ${drillType} drills for the "${category}" category.

Avoid duplicating these existing titles:
${existing.slice(0, 30).map((d) => `- ${d.title}`).join("\n") || "(none yet)"}

Return them via the emit_drills tool. Each must feel like a real industry-grade prompt.`;

    let drills: any[];
    try {
      drills = await callAI(systemPrompt, userPrompt);
    } catch (e: any) {
      const msg = e?.message || "ai_failed";
      if (jobId) {
        await fetch(`${SUPABASE_URL}/rest/v1/drill_generation_jobs?id=eq.${jobId}`, {
          method: "PATCH",
          headers: {
            apikey: SERVICE_ROLE,
            Authorization: `Bearer ${SERVICE_ROLE}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: "failed",
            error_message: msg,
            completed_at: new Date().toISOString(),
          }),
        });
      }
      const status = msg === "rate_limited" ? 429 : msg === "payment_required" ? 402 : 500;
      return new Response(
        JSON.stringify({
          error: msg,
          message:
            msg === "rate_limited"
              ? "AI gateway rate-limited. Try again in a moment."
              : msg === "payment_required"
                ? "AI workspace credits exhausted."
                : "AI generation failed.",
        }),
        { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Filter dupes & build inserts
    const inserts: any[] = [];
    const seenThisBatch = new Set<string>();
    for (const d of drills) {
      const norm = normalizeTitle(d.title || "");
      if (!norm) continue;
      if (existingNorm.has(norm) || seenThisBatch.has(norm)) continue;
      seenThisBatch.add(norm);

      let correctAnswer: any = null;
      if (drillType === "multiple_choice" && typeof d.correct_answer_index === "number" && d.correct_answer_index >= 0) {
        correctAnswer = d.correct_answer_index;
      } else if (drillType === "prioritization" && Array.isArray(d.correct_answer_order) && d.correct_answer_order.length) {
        correctAnswer = d.correct_answer_order;
      }

      const options = Array.isArray(d.options) && d.options.length ? d.options : null;

      inserts.push({
        title: String(d.title).slice(0, 160),
        cohort,
        category,
        difficulty,
        drill_type: drillType,
        prompt: d.prompt || "",
        scenario: d.scenario && String(d.scenario).trim().length ? d.scenario : null,
        options,
        correct_answer: correctAnswer,
        model_answer: d.model_answer || null,
        rubric: d.rubric || null,
        why_it_matters: d.why_it_matters || null,
        tags: Array.isArray(d.tags) ? d.tags.slice(0, 8) : [],
        estimated_minutes: Math.max(1, Math.min(60, Number(d.estimated_minutes) || 5)),
        xp_reward: Math.max(1, Math.min(200, Number(d.xp_reward) || 10)),
        source: "ai_generated",
        status: "pending_review",
        created_by: userId,
      });
    }

    if (inserts.length) {
      const insResp = await fetch(`${SUPABASE_URL}/rest/v1/drills`, {
        method: "POST",
        headers: {
          apikey: SERVICE_ROLE,
          Authorization: `Bearer ${SERVICE_ROLE}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(inserts),
      });
      if (!insResp.ok) {
        const t = await insResp.text();
        console.error("Insert failed", insResp.status, t);
      }
    }

    if (jobId) {
      await fetch(`${SUPABASE_URL}/rest/v1/drill_generation_jobs?id=eq.${jobId}`, {
        method: "PATCH",
        headers: {
          apikey: SERVICE_ROLE,
          Authorization: `Bearer ${SERVICE_ROLE}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: "completed",
          drafts_created: inserts.length,
          completed_at: new Date().toISOString(),
        }),
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        drafts_created: inserts.length,
        proposed: drills.length,
        duplicates_skipped: drills.length - inserts.length,
        job_id: jobId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("generate-drills error", e);
    return new Response(
      JSON.stringify({ error: "server_error", message: e?.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});