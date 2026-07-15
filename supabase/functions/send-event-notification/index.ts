import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Body {
  eventId: string
  kind: 'created' | 'updated' | 'cancelled'
  changesSummary?: string
  cancellationReason?: string
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
  } catch { return iso }
}
function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  } catch { return '' }
}

function audienceLabelFor(scope: string) {
  switch (scope) {
    case 'all_members': return 'All PEC members'
    case 'cohort': return 'Cohort members'
    case 'project': return 'Project team'
    case 'pms': return 'Project Managers'
    case 'tech_leads': return 'Tech Leads'
    case 'leadership': return 'Leadership (PMs + Tech Leads)'
    default: return 'Selected members'
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const url = Deno.env.get('SUPABASE_URL')!
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(url, key)

  let body: Body
  try { body = await req.json() } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
  if (!body.eventId || !body.kind) {
    return new Response(JSON.stringify({ error: 'missing_fields' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  // Auth: identify caller from JWT (verify_jwt = true on this function)
  const authHeader = req.headers.get('Authorization') ?? ''
  const callerJwt = authHeader.replace(/^Bearer\s+/i, '')
  const { data: callerData } = await supabase.auth.getUser(callerJwt)
  const callerId = callerData?.user?.id ?? null
  if (!callerId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const { data: ev, error: evErr } = await supabase.from('events').select('*').eq('id', body.eventId).maybeSingle()
  if (evErr || !ev) {
    return new Response(JSON.stringify({ error: 'event_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  // Server-side authorization: only admins, event creator, or a cohort PM/lead
  // (for cohort/leadership-scoped events) can trigger mass notifications.
  const { data: isAdmin } = await supabase.rpc('is_admin', { _user_id: callerId })
  const isCreator = ev.created_by === callerId
  let isLeadForScope = false
  if (!isAdmin && !isCreator) {
    const cohortId = ['cohort'].includes(ev.audience_scope) ? ev.audience_target_id : null
    if (cohortId) {
      const { data: leadRow } = await supabase
        .from('cohort_memberships')
        .select('role')
        .eq('cohort_id', cohortId)
        .eq('user_id', callerId)
        .in('role', ['pm', 'lead', 'integration_lead'])
        .maybeSingle()
      isLeadForScope = !!leadRow
    } else if (['all_members', 'pms', 'tech_leads', 'leadership'].includes(ev.audience_scope)) {
      // Org-wide sends require admin/creator only
      isLeadForScope = false
    } else if (ev.audience_scope === 'project' && ev.audience_target_id) {
      const { data: memberRow } = await supabase
        .from('project_memberships')
        .select('role_on_project')
        .eq('project_id', ev.audience_target_id)
        .eq('user_id', callerId)
        .eq('role_on_project', 'lead')
        .maybeSingle()
      isLeadForScope = !!memberRow
    }
  }
  if (!isAdmin && !isCreator && !isLeadForScope) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  // Resolve recipients
  const recipients = await resolveRecipients(supabase, ev)
  const audienceLabel = audienceLabelFor(ev.audience_scope)

  // Host name
  let hostName: string | null = null
  if (ev.created_by) {
    const { data: hostProfile } = await supabase.from('profiles').select('full_name').eq('user_id', ev.created_by).maybeSingle()
    hostName = hostProfile?.full_name ?? null
  }

  // Insert notification audit row
  const { data: notifRow } = await supabase.from('event_notifications').insert({
    event_id: ev.id,
    kind: body.kind,
    triggered_by: callerId,
    recipient_count: recipients.length,
    status: recipients.length === 0 ? 'sent' : 'pending',
    audience_scope: ev.audience_scope,
    metadata: { changesSummary: body.changesSummary ?? null, cancellationReason: body.cancellationReason ?? null },
  }).select('id').maybeSingle()

  if (recipients.length === 0) {
    return new Response(JSON.stringify({ ok: true, recipientCount: 0, sent: 0, failed: 0 }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  // Send via send-transactional-email per recipient
  let sent = 0
  let failed = 0
  const errors: string[] = []

  for (const r of recipients) {
    try {
      const idempotencyKey = `event-${ev.id}-${body.kind}-${r.user_id}`
      const resp = await fetch(`${url}/functions/v1/send-transactional-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          templateName: 'event-notification',
          recipientEmail: r.email,
          idempotencyKey,
          templateData: {
            kind: body.kind,
            title: ev.title,
            date: fmtDate(ev.start_time),
            time: ev.end_time ? `${fmtTime(ev.start_time)}–${fmtTime(ev.end_time)}` : fmtTime(ev.start_time),
            location: ev.location,
            link: ev.meeting_link || ev.teams_link,
            description: ev.description,
            hostName,
            audienceLabel,
            recipientName: r.full_name,
            changesSummary: body.changesSummary ?? null,
            cancellationReason: body.cancellationReason ?? null,
            eventUrl: 'https://pecnexus.com/app/events',
          },
        }),
      })
      if (resp.ok) sent++
      else { failed++; errors.push(`${r.email}: HTTP ${resp.status}`) }
    } catch (e) {
      failed++
      errors.push(`${r.email}: ${(e as Error).message}`)
    }
  }

  const status = failed === 0 ? 'sent' : (sent === 0 ? 'failed' : 'partial')
  if (notifRow?.id) {
    await supabase.from('event_notifications').update({
      succeeded_count: sent,
      failed_count: failed,
      status,
      error_message: errors.slice(0, 5).join('; ') || null,
    }).eq('id', notifRow.id)
  }

  return new Response(JSON.stringify({ ok: failed === 0, recipientCount: recipients.length, sent, failed, status }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})

async function resolveRecipients(supabase: any, ev: any): Promise<Array<{ user_id: string; email: string; full_name: string | null }>> {
  const scope = ev.audience_scope as string
  let userIds: string[] = []

  if (scope === 'all_members') {
    const { data } = await supabase.from('profiles').select('user_id')
    userIds = (data || []).map((p: any) => p.user_id)
  } else if (scope === 'cohort' && ev.audience_target_id) {
    const { data } = await supabase.from('cohort_memberships').select('user_id').eq('cohort_id', ev.audience_target_id)
    userIds = (data || []).map((p: any) => p.user_id)
  } else if (scope === 'project' && ev.audience_target_id) {
    const { data } = await supabase.from('project_memberships').select('user_id').eq('project_id', ev.audience_target_id)
    userIds = (data || []).map((p: any) => p.user_id)
  } else if (scope === 'pms') {
    const { data } = await supabase.from('cohort_memberships').select('user_id').eq('role', 'pm')
    userIds = (data || []).map((p: any) => p.user_id)
  } else if (scope === 'tech_leads') {
    const { data } = await supabase.from('cohort_memberships').select('user_id').in('role', ['lead','integration_lead'])
    userIds = (data || []).map((p: any) => p.user_id)
  } else if (scope === 'leadership') {
    const { data } = await supabase.from('cohort_memberships').select('user_id').in('role', ['pm','lead','integration_lead'])
    userIds = (data || []).map((p: any) => p.user_id)
  }

  userIds = Array.from(new Set(userIds.filter(Boolean)))
  if (userIds.length === 0) return []

  const { data: profs } = await supabase.from('profiles').select('user_id, full_name, cal_poly_email').in('user_id', userIds)
  return (profs || [])
    .filter((p: any) => !!p.cal_poly_email)
    .map((p: any) => ({ user_id: p.user_id, email: p.cal_poly_email, full_name: p.full_name }))
}