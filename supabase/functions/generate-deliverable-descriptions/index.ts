// Generates clean deliverable descriptions for a freshly-created project.
// Called ONCE at project creation. No runtime AI thereafter.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const { projectId } = await req.json();
    if (!projectId) return new Response(JSON.stringify({ error: "projectId required" }), { status: 400, headers: corsHeaders });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Authenticate + authorize: caller must be project lead or admin
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userRes } = await userClient.auth.getUser();
    const uid = userRes?.user?.id;
    if (!uid) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    const [{ data: isAdmin }, { data: isLead }] = await Promise.all([
      supabase.rpc("is_admin", { _user_id: uid }),
      supabase.rpc("is_project_lead", { _user_id: uid, _project_id: projectId }),
    ]);
    if (!isAdmin && !isLead) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
    }

    const { data: project } = await supabase.from("projects").select("name, description, project_mode").eq("id", projectId).single();
    if (!project) return new Response(JSON.stringify({ error: "project not found" }), { status: 404, headers: corsHeaders });

    const { data: deliverables } = await supabase
      .from("deliverables")
      .select("id, title, description, milestones(title)")
      .eq("project_id", projectId);

    const items = (deliverables || []).filter((d: any) => !d.description || d.description.length < 30);
    if (items.length === 0) return new Response(JSON.stringify({ updated: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const prompt = `You are writing concise, action-oriented deliverable descriptions for a student engineering consulting project.
Project: "${project.name}" — ${project.description || ""}
Mode: ${project.project_mode}

Return one description per deliverable in JSON. Each description must be 1-2 sentences, plain, no marketing copy, focused on what the team must produce and what 'done' looks like.

Deliverables:
${items.map((d: any, i: number) => `${i + 1}. [${(d.milestones as any)?.title || "stage"}] ${d.title}`).join("\n")}`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        tools: [{
          type: "function",
          function: {
            name: "set_descriptions",
            description: "Provide a description for each deliverable.",
            parameters: {
              type: "object",
              properties: {
                descriptions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: { index: { type: "integer" }, description: { type: "string" } },
                    required: ["index", "description"],
                  },
                },
              },
              required: ["descriptions"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "set_descriptions" } },
      }),
    });

    if (aiResp.status === 429) return new Response(JSON.stringify({ error: "Rate limited, try again later." }), { status: 429, headers: corsHeaders });
    if (aiResp.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: corsHeaders });
    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI error", aiResp.status, t);
      return new Response(JSON.stringify({ error: "AI generation failed" }), { status: 500, headers: corsHeaders });
    }

    const aiData = await aiResp.json();
    const args = aiData.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    const parsed = args ? JSON.parse(args) : { descriptions: [] };

    let updated = 0;
    for (const row of (parsed.descriptions || [])) {
      const item = items[row.index - 1];
      if (!item || !row.description) continue;
      const { error } = await supabase.from("deliverables").update({ description: row.description }).eq("id", item.id);
      if (!error) updated++;
    }

    return new Response(JSON.stringify({ updated, total: items.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("generate-deliverable-descriptions error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500, headers: corsHeaders });
  }
});