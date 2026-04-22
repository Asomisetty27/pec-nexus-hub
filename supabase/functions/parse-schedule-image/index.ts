import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const MAX_IMAGE_BYTES = 6 * 1024 * 1024

interface BusyBlock {
  day_of_week: number
  start_time: string
  end_time: string
  label?: string
}

function jsonResp(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function isValidBlock(b: any): b is BusyBlock {
  return b
    && Number.isInteger(b.day_of_week) && b.day_of_week >= 0 && b.day_of_week <= 6
    && /^\d{2}:\d{2}$/.test(b.start_time)
    && /^\d{2}:\d{2}$/.test(b.end_time)
    && b.start_time < b.end_time
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
  if (!LOVABLE_API_KEY) {
    return jsonResp(500, { error: 'config_error', message: 'AI gateway is not configured. Contact an admin.' })
  }

  // In-code auth (config has verify_jwt = false to bypass legacy ES256-incompatible verifier).
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return jsonResp(401, { error: 'unauthorized', message: 'Sign in to use schedule import.' })
  }
  try {
    const userClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userRes } = await userClient.auth.getUser()
    if (!userRes?.user) {
      return jsonResp(401, { error: 'unauthorized', message: 'Your session expired. Please sign in again.' })
    }
  } catch {
    return jsonResp(401, { error: 'unauthorized', message: 'Could not verify your session. Please sign in again.' })
  }

  let imageDataUrl = ''
  try {
    const body = await req.json()
    imageDataUrl = body?.image
    if (!imageDataUrl || typeof imageDataUrl !== 'string') throw new Error('Missing image')
    if (!imageDataUrl.startsWith('data:image/')) throw new Error('Image must be a PNG, JPG, or WEBP screenshot')
    if (imageDataUrl.length > MAX_IMAGE_BYTES * 1.4) {
      return jsonResp(413, { error: 'image_too_large', message: 'Image is too large. Try a screenshot under 5 MB.' })
    }
  } catch (e) {
    return jsonResp(400, { error: 'invalid_request', message: (e as Error).message || 'Invalid image upload.' })
  }

  const systemPrompt = [
    'You analyze a screenshot of a weekly class schedule or calendar.',
    'Extract recurring busy/occupied time blocks. Return STRICT JSON only with shape:',
    '{ "confidence": "low"|"medium"|"high", "notes": "short text if anything is ambiguous", "blocks": [{ "day_of_week": 0-6 (0=Sun..6=Sat), "start_time": "HH:MM" 24h, "end_time": "HH:MM" 24h, "label": "optional class/event name" }] }',
    'Rules: only recurring weekly commitments; combine adjacent identical blocks; skip one-off events; HH:MM 24h; day_of_week integer 0-6; if unsure return blocks: [] with confidence "low". Output JSON only, no markdown, no commentary.',
  ].join('\n')

  let aiResp: Response
  try {
    aiResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Extract recurring busy times from this schedule image.' },
              { type: 'image_url', image_url: { url: imageDataUrl } },
            ],
          },
        ],
      }),
    })
  } catch {
    return jsonResp(502, { error: 'provider_unreachable', message: 'Could not reach the AI provider. Check your connection and retry.' })
  }

  if (!aiResp.ok) {
    const txt = await aiResp.text().catch(() => '')
    if (aiResp.status === 429) return jsonResp(429, { error: 'rate_limited', message: 'AI is busy right now. Try again in a minute.' })
    if (aiResp.status === 402) return jsonResp(402, { error: 'payment_required', message: 'AI credits are exhausted. Add credits in workspace settings to use schedule import.' })
    if (aiResp.status === 413) return jsonResp(413, { error: 'image_too_large', message: 'The provider rejected the image as too large. Try a smaller screenshot.' })
    return jsonResp(502, { error: 'ai_failed', message: 'AI provider error. Try a clearer screenshot or add busy times manually.', details: txt.slice(0, 200) })
  }

  const data = await aiResp.json().catch(() => null) as any
  const content: string = data?.choices?.[0]?.message?.content ?? ''
  if (!content) {
    return jsonResp(200, { error: 'empty_response', confidence: 'low', blocks: [], notes: 'AI returned an empty response. Try another screenshot.' })
  }

  const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
  let parsed: { confidence?: string; notes?: string; blocks?: BusyBlock[] }
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    return jsonResp(200, { error: 'parse_failed', confidence: 'low', blocks: [], notes: 'Could not interpret the screenshot. Try a clearer image or add busy times manually.' })
  }

  const blocks = Array.isArray(parsed.blocks) ? parsed.blocks.filter(isValidBlock) : []
  return jsonResp(200, {
    confidence: parsed.confidence ?? (blocks.length ? 'medium' : 'low'),
    notes: parsed.notes ?? null,
    blocks,
  })
})