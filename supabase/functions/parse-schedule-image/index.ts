import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Uses Lovable AI Gateway (no extra API key needed) with a vision-capable model.
// Returns proposed busy windows the user can review before saving.

interface BusyBlock {
  day_of_week: number   // 0=Sun..6=Sat
  start_time: string    // HH:MM (24h)
  end_time: string      // HH:MM (24h)
  label?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
  if (!LOVABLE_API_KEY) {
    return new Response(JSON.stringify({ error: 'AI gateway not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  let imageDataUrl: string
  try {
    const body = await req.json()
    imageDataUrl = body.image
    if (!imageDataUrl?.startsWith('data:image/')) throw new Error('image must be a data URL')
  } catch (e) {
    return new Response(JSON.stringify({ error: 'invalid_request', details: (e as Error).message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const systemPrompt = `You analyze a screenshot of a weekly class schedule or calendar.
Extract recurring busy/occupied time blocks. Return STRICT JSON only with shape:
{
  "confidence": "low" | "medium" | "high",
  "notes": "short text if anything is ambiguous",
  "blocks": [{ "day_of_week": 0-6 (0=Sun, 1=Mon ... 6=Sat), "start_time": "HH:MM" 24h, "end_time": "HH:MM" 24h, "label": "optional class/event name" }]
}
Rules:
- Only include time blocks that look like recurring weekly commitments (classes, labs, standing meetings).
- Combine adjacent identical blocks; ignore one-off events if a calendar shows them.
- If you cannot confidently identify any blocks, return blocks: [] with confidence "low".
- Times must be 24h "HH:MM". day_of_week MUST be an integer 0-6.
- Output JSON only, no markdown, no commentary.`

  const aiResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${LOVABLE_API_KEY}` },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: [
          { type: 'text', text: 'Extract recurring busy times from this schedule image.' },
          { type: 'image_url', image_url: { url: imageDataUrl } },
        ] },
      ],
    }),
  })

  if (!aiResp.ok) {
    const txt = await aiResp.text()
    if (aiResp.status === 429) {
      return new Response(JSON.stringify({ error: 'rate_limited', message: 'AI gateway rate limit reached. Try again shortly.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    if (aiResp.status === 402) {
      return new Response(JSON.stringify({ error: 'payment_required', message: 'AI credits exhausted on your workspace. Add credits to enable schedule parsing.' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    return new Response(JSON.stringify({ error: 'ai_failed', details: txt.slice(0, 400) }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const data = await aiResp.json()
  const content: string = data?.choices?.[0]?.message?.content ?? ''

  // Strip code fences if model returned them despite instructions
  const cleaned = content.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()

  let parsed: { confidence?: string; notes?: string; blocks?: BusyBlock[] }
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    return new Response(JSON.stringify({ error: 'parse_failed', confidence: 'low', blocks: [], notes: 'Could not interpret schedule image. Try a clearer screenshot or add busy times manually.' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  // Validate / sanitize
  const blocks = Array.isArray(parsed.blocks) ? parsed.blocks.filter(isValidBlock) : []
  return new Response(JSON.stringify({
    confidence: parsed.confidence ?? (blocks.length ? 'medium' : 'low'),
    notes: parsed.notes ?? null,
    blocks,
  }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})

function isValidBlock(b: any): b is BusyBlock {
  return b
    && Number.isInteger(b.day_of_week) && b.day_of_week >= 0 && b.day_of_week <= 6
    && /^\d{2}:\d{2}$/.test(b.start_time)
    && /^\d{2}:\d{2}$/.test(b.end_time)
    && b.start_time < b.end_time
}