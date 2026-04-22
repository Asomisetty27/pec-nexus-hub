// Ultra-cheap AI feedback for written-response drills.
// Hard caps: monthly call cap + per-user daily cap + per-drill toggle.
// Always returns useful structured feedback OR a fallback payload — never fails the user.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

type Band = "weak" | "okay" | "strong";

interface FeedbackPayload {
  score_band: Band;
  strengths: string[];
  improvements: string[];
  next_skill: string;
}

const feedbackSchema = {
  type: "object",
  properties: {
    score_band: { type: "string", enum: ["weak", "okay", "strong"] },
    strengths: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 3 },
    improvements: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 3 },
    next_skill: { type: "string", description: "One short phrase, what to practice next." },
  },
  required: ["score_band", "strengths", "improvements", "next_skill"],
} as const;

function clip(s: string | null | undefined, n: number): string {
  if (!s) return "";
  return s.length > n ? s.slice(0, n) + "…" : s;
}

function fallbackPayload(reason: string): FeedbackPayload & { fallback_reason: string } {
  return {
    score_band: "okay",
    strengths: ["You attempted the drill — momentum matters."],
    improvements: [
      "Compare your answer against the model answer below.",
      "Use the rubric to self-score each criterion.",
    ],
    next_skill: "Practice another drill in this category.",
    fallback_reason: reason,
  };
}

async function callAI(
  drillTitle: string,
  promptSummary: string,
  rubricBullets: string,
  modelAnswerSummary: string,
  userResponse: string,
): Promise<FeedbackPayload> {
  // Tight, templated prompt. No history. No long context.
  const system =
    "You score short engineering practice answers. Be terse, concrete, and rubric-driven. " +
    "Return ONLY via the emit_feedback tool. Max 3 strengths, max 3 improvements, each ≤ 18 words. " +
    "score_band: weak (misses core), okay (partial), strong (covers rubric).";

  const user = `Drill: ${drillTitle}
Prompt: ${promptSummary}
Rubric:
${rubricBullets}
Model answer: ${modelAnswerSummary}

User answer:
${userResponse}`;

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-lite",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "emit_feedback",
            description: "Emit terse rubric-driven feedback.",
            parameters: feedbackSchema,
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "emit_feedback" } },
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
  const tc = data?.choices?.[0]?.message?.tool_calls?.[0];
  if (!tc) throw new Error("no_tool_call");
  const args = JSON.parse(tc.function.arguments);
  return {
    score_band: args.score_band as Band,
    strengths: (args.strengths || []).slice(0, 3),
    improvements: (args.improvements || []).slice(0, 3),
    next_skill: String(args.next_skill || "").slice(0, 120),
  };
}

async function logUsage(row: Record<string, unknown>) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/training_ai_usage`, {
      method: "POST",
      headers: {
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${SERVICE_ROLE}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(row),
    });
  } catch (e) {
    console.error("logUsage failed", e);
  }
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

    const body = await req.json();
    const drillId: string | undefined = body.drill_id;
    const attemptId: string | undefined = body.attempt_id;
    const userAnswer: string = String(body.response || "").trim();

    if (!drillId || !userAnswer) {
      return new Response(JSON.stringify({ error: "missing_params" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch drill
    const drillResp = await fetch(
      `${SUPABASE_URL}/rest/v1/drills?id=eq.${drillId}&select=id,title,prompt,scenario,rubric,model_answer,drill_type,cohort,ai_feedback_enabled,status`,
      { headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` } },
    );
    const drillRows = await drillResp.json();
    const drill = Array.isArray(drillRows) ? drillRows[0] : null;
    if (!drill || drill.status !== "published") {
      return new Response(JSON.stringify({ error: "drill_not_found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch settings
    const setResp = await fetch(
      `${SUPABASE_URL}/rest/v1/training_ai_settings?id=eq.1&select=*`,
      { headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` } },
    );
    const setRows = await setResp.json();
    const settings = Array.isArray(setRows) ? setRows[0] : null;
    if (!settings) {
      return new Response(JSON.stringify({ error: "no_settings" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const enabledTypes: string[] = settings.enabled_drill_types || [];
    const drillEnabled = drill.ai_feedback_enabled === true;
    const typeEnabled = enabledTypes.includes(drill.drill_type);

    // Pre-checks: do not call AI if disabled by config or drill flag
    if (!drillEnabled || !typeEnabled) {
      const fb = fallbackPayload(!drillEnabled ? "drill_disabled" : "type_disabled");
      await logUsage({
        user_id: userId,
        drill_id: drillId,
        attempt_id: attemptId ?? null,
        cohort: drill.cohort,
        drill_type: drill.drill_type,
        fallback_used: true,
      });
      return new Response(
        JSON.stringify({ ok: true, fallback: true, feedback: fb }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Monthly cap check
    const month = new Date().toISOString().slice(0, 7);
    const monthCallsResp = await fetch(
      `${SUPABASE_URL}/rest/v1/training_ai_usage?month=eq.${month}&fallback_used=eq.false&select=id`,
      {
        headers: {
          apikey: SERVICE_ROLE,
          Authorization: `Bearer ${SERVICE_ROLE}`,
          Prefer: "count=exact",
          Range: "0-0",
        },
      },
    );
    const monthRange = monthCallsResp.headers.get("content-range") || "0-0/0";
    const monthUsed = parseInt(monthRange.split("/")[1] || "0", 10);
    if (monthUsed >= settings.monthly_call_cap) {
      const fb = fallbackPayload("monthly_cap_reached");
      await logUsage({
        user_id: userId,
        drill_id: drillId,
        attempt_id: attemptId ?? null,
        cohort: drill.cohort,
        drill_type: drill.drill_type,
        fallback_used: true,
      });
      return new Response(
        JSON.stringify({ ok: true, fallback: true, feedback: fb, reason: "monthly_cap" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Per-user daily cap check
    const today = new Date().toISOString().slice(0, 10);
    const userTodayResp = await fetch(
      `${SUPABASE_URL}/rest/v1/training_ai_usage?user_id=eq.${userId}&fallback_used=eq.false&created_at=gte.${today}T00:00:00&select=id`,
      {
        headers: {
          apikey: SERVICE_ROLE,
          Authorization: `Bearer ${SERVICE_ROLE}`,
          Prefer: "count=exact",
          Range: "0-0",
        },
      },
    );
    const userRange = userTodayResp.headers.get("content-range") || "0-0/0";
    const userToday = parseInt(userRange.split("/")[1] || "0", 10);
    if (userToday >= settings.per_user_daily_cap) {
      const fb = fallbackPayload("user_daily_cap_reached");
      await logUsage({
        user_id: userId,
        drill_id: drillId,
        attempt_id: attemptId ?? null,
        cohort: drill.cohort,
        drill_type: drill.drill_type,
        fallback_used: true,
      });
      return new Response(
        JSON.stringify({ ok: true, fallback: true, feedback: fb, reason: "user_daily_cap" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Build tight prompt — clip everything aggressively
    const promptSummary = clip(drill.prompt, 400) + (drill.scenario ? "\nContext: " + clip(drill.scenario, 300) : "");
    const rubricBullets = clip(drill.rubric, 400) || "- relevance\n- depth\n- correctness\n- clarity";
    const modelAnswerSummary = clip(drill.model_answer, 400) || "(no canonical answer)";
    const trimmedUser = clip(userAnswer, 800);

    let feedback: FeedbackPayload;
    try {
      feedback = await callAI(
        clip(drill.title, 100),
        promptSummary,
        rubricBullets,
        modelAnswerSummary,
        trimmedUser,
      );
    } catch (e: any) {
      const msg = e?.message || "ai_failed";
      const fb = fallbackPayload(msg);
      await logUsage({
        user_id: userId,
        drill_id: drillId,
        attempt_id: attemptId ?? null,
        cohort: drill.cohort,
        drill_type: drill.drill_type,
        fallback_used: true,
      });
      return new Response(
        JSON.stringify({ ok: true, fallback: true, feedback: fb, reason: msg }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Rough token estimate: ~4 chars per token
    const estTokens = Math.round(
      (promptSummary.length + rubricBullets.length + modelAnswerSummary.length + trimmedUser.length + 400) / 4,
    );

    await logUsage({
      user_id: userId,
      drill_id: drillId,
      attempt_id: attemptId ?? null,
      cohort: drill.cohort,
      drill_type: drill.drill_type,
      estimated_tokens: estTokens,
      fallback_used: false,
    });

    // Persist feedback record (linked to attempt if provided)
    if (attemptId) {
      await fetch(`${SUPABASE_URL}/rest/v1/drill_ai_feedback`, {
        method: "POST",
        headers: {
          apikey: SERVICE_ROLE,
          Authorization: `Bearer ${SERVICE_ROLE}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          attempt_id: attemptId,
          drill_id: drillId,
          user_id: userId,
          score_band: feedback.score_band,
          strengths: feedback.strengths,
          improvements: feedback.improvements,
          next_skill: feedback.next_skill,
          raw_response: feedback,
        }),
      });
    }

    return new Response(
      JSON.stringify({ ok: true, fallback: false, feedback }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("score-written-drill error", e);
    return new Response(
      JSON.stringify({ error: "server_error", message: e?.message || "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});