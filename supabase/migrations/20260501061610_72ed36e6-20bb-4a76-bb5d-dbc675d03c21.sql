-- Phase 6D: Cohort & Project Score Engine

-- 1. Snapshot table for historical trend (used opportunistically)
CREATE TABLE IF NOT EXISTS public.cohort_score_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL CHECK (scope IN ('cohort','project')),
  target_id uuid NOT NULL,
  window_start timestamptz NOT NULL,
  window_end timestamptz NOT NULL,
  window_days int NOT NULL,
  score int NOT NULL,
  confidence text NOT NULL CHECK (confidence IN ('high','medium','low','insufficient')),
  components jsonb NOT NULL DEFAULT '{}'::jsonb,
  computed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cohort_score_snapshots_scope_target_idx ON public.cohort_score_snapshots(scope, target_id, window_end DESC);

ALTER TABLE public.cohort_score_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "score_snap_read_authenticated" ON public.cohort_score_snapshots;
CREATE POLICY "score_snap_read_authenticated" ON public.cohort_score_snapshots
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "score_snap_write_admin" ON public.cohort_score_snapshots;
CREATE POLICY "score_snap_write_admin" ON public.cohort_score_snapshots
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- 2. Helper: compute a single score window (internal)
-- Returns jsonb with all components.
CREATE OR REPLACE FUNCTION public._compute_score_window(
  _scope text,
  _target_id uuid,
  _window_start timestamptz,
  _window_end timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- Member set
  _member_ids uuid[];
  _project_ids uuid[];
  _total_members int := 0;

  -- Attendance
  _att_marked int := 0;
  _att_present int := 0;
  _att_pct numeric := NULL;

  -- Deliverables on-time
  _del_due_in_window int := 0;
  _del_completed_on_time int := 0;
  _del_ontime_pct numeric := NULL;

  -- Approval rate
  _del_reviewed int := 0;
  _del_approved int := 0;
  _approval_pct numeric := NULL;

  -- Training participation
  _training_active int := 0;
  _training_pct numeric := NULL;

  -- Blocker resolution
  _hr_total int := 0;
  _hr_resolved int := 0;
  _hr_avg_hours numeric := NULL;
  _blocker_pct numeric := NULL;
BEGIN
  -- Resolve member + project sets per scope.
  IF _scope = 'cohort' THEN
    SELECT array_agg(user_id), count(*)
      INTO _member_ids, _total_members
      FROM public.cohort_memberships
     WHERE cohort_id = _target_id;

    IF _member_ids IS NOT NULL THEN
      SELECT array_agg(DISTINCT pm.project_id)
        INTO _project_ids
        FROM public.project_memberships pm
       WHERE pm.user_id = ANY(_member_ids);
    END IF;

  ELSIF _scope = 'project' THEN
    SELECT array_agg(user_id), count(*)
      INTO _member_ids, _total_members
      FROM public.project_memberships
     WHERE project_id = _target_id;
    _project_ids := ARRAY[_target_id];
  ELSE
    RAISE EXCEPTION 'invalid scope: %', _scope;
  END IF;

  _member_ids := COALESCE(_member_ids, ARRAY[]::uuid[]);
  _project_ids := COALESCE(_project_ids, ARRAY[]::uuid[]);

  -- ============ ATTENDANCE (30) ============
  -- count present + late vs total marked (not unmarked / excused / absent? absent counts as opportunity, excused does not)
  -- Spec: count present and late as presence; do not count absent, excused, or unmarked.
  -- Denominator: present+late+absent (excluding excused & unmarked).
  IF array_length(_member_ids,1) IS NOT NULL THEN
    SELECT
      COUNT(*) FILTER (WHERE a.status IN ('present','late','absent')),
      COUNT(*) FILTER (WHERE a.status IN ('present','late'))
      INTO _att_marked, _att_present
      FROM public.event_attendance a
      JOIN public.events e ON e.id = a.event_id
     WHERE e.start_time >= _window_start
       AND e.start_time <  _window_end
       AND COALESCE(e.cancelled,false) = false
       AND a.user_id = ANY(_member_ids)
       AND (
         (_scope = 'cohort' AND e.event_type IN ('cohort_meeting','leadership_meeting','training_session')
            AND ((e.audience_scope = 'cohort' AND e.audience_target_id = _target_id) OR e.audience_scope IN ('all','all_members','org')))
         OR
         (_scope = 'project' AND e.event_type IN ('project_meeting','cohort_meeting','leadership_meeting'))
       );

    IF _att_marked > 0 THEN
      _att_pct := round(100.0 * _att_present / _att_marked, 1);
    END IF;
  END IF;

  -- ============ ON-TIME DELIVERABLES (25) ============
  -- A deliverable counts if its due_date falls in the window AND it has either an approval_status moved past pending OR a file submitted.
  -- "On time" = approved_at <= due_date (end of day) OR (file_url present AND updated_at::date <= due_date).
  IF array_length(_project_ids,1) IS NOT NULL THEN
    SELECT
      COUNT(*),
      COUNT(*) FILTER (WHERE
        (d.approved_at IS NOT NULL AND d.approved_at::date <= d.due_date)
        OR (d.approval_status::text = 'approved' AND COALESCE(d.approved_at, d.updated_at)::date <= d.due_date)
        OR (d.file_url IS NOT NULL AND d.updated_at::date <= d.due_date)
      )
      INTO _del_due_in_window, _del_completed_on_time
      FROM public.deliverables d
     WHERE d.project_id = ANY(_project_ids)
       AND d.archived = false
       AND d.due_date IS NOT NULL
       AND d.due_date >= _window_start::date
       AND d.due_date <  _window_end::date;

    IF _del_due_in_window > 0 THEN
      _del_ontime_pct := round(100.0 * _del_completed_on_time / _del_due_in_window, 1);
    END IF;
  END IF;

  -- ============ APPROVAL RATE (20) ============
  -- of deliverables reviewed (approved / changes_requested / rejected) in window, % approved.
  IF array_length(_project_ids,1) IS NOT NULL THEN
    SELECT
      COUNT(*) FILTER (WHERE d.approval_status::text IN ('approved','changes_requested','rejected')),
      COUNT(*) FILTER (WHERE d.approval_status::text = 'approved')
      INTO _del_reviewed, _del_approved
      FROM public.deliverables d
     WHERE d.project_id = ANY(_project_ids)
       AND d.archived = false
       AND d.updated_at >= _window_start
       AND d.updated_at <  _window_end;

    IF _del_reviewed > 0 THEN
      _approval_pct := round(100.0 * _del_approved / _del_reviewed, 1);
    END IF;
  END IF;

  -- ============ TRAINING PARTICIPATION (10) ============
  -- % of members with grind activity (last_attempt_date) inside window.
  IF _total_members > 0 THEN
    SELECT COUNT(DISTINCT gp.user_id)
      INTO _training_active
      FROM public.grind_progress gp
     WHERE gp.user_id = ANY(_member_ids)
       AND gp.last_attempt_date IS NOT NULL
       AND gp.last_attempt_date >= _window_start::date
       AND gp.last_attempt_date <  _window_end::date;
    _training_pct := round(100.0 * _training_active / _total_members, 1);
  END IF;

  -- ============ BLOCKER RESOLUTION (5) ============
  -- For cohort scope: % of help_requests opened in window that are resolved; also avg hours.
  IF _scope = 'cohort' THEN
    SELECT
      COUNT(*),
      COUNT(*) FILTER (WHERE resolved_at IS NOT NULL),
      AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/3600.0) FILTER (WHERE resolved_at IS NOT NULL)
      INTO _hr_total, _hr_resolved, _hr_avg_hours
      FROM public.help_requests
     WHERE cohort_id = _target_id
       AND created_at >= _window_start
       AND created_at <  _window_end;

    IF _hr_total > 0 THEN
      _blocker_pct := round(100.0 * _hr_resolved / _hr_total, 1);
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'total_members', _total_members,
    'project_count', COALESCE(array_length(_project_ids,1),0),
    'attendance', jsonb_build_object(
      'marked', _att_marked, 'present', _att_present, 'pct', _att_pct,
      'sufficient', (_att_marked >= 3)
    ),
    'on_time_delivery', jsonb_build_object(
      'due', _del_due_in_window, 'on_time', _del_completed_on_time, 'pct', _del_ontime_pct,
      'sufficient', (_del_due_in_window >= 3)
    ),
    'approval_rate', jsonb_build_object(
      'reviewed', _del_reviewed, 'approved', _del_approved, 'pct', _approval_pct,
      'sufficient', (_del_reviewed >= 3)
    ),
    'training', jsonb_build_object(
      'active_members', _training_active, 'total_members', _total_members, 'pct', _training_pct,
      'sufficient', (_total_members >= 3)
    ),
    'responsiveness', jsonb_build_object(
      'pct', NULL, 'sufficient', false, 'note', 'No reliable response-latency signal yet'
    ),
    'blocker_resolution', jsonb_build_object(
      'total', _hr_total, 'resolved', _hr_resolved, 'pct', _blocker_pct,
      'avg_resolution_hours', _hr_avg_hours, 'sufficient', (_hr_total >= 3)
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public._compute_score_window(text, uuid, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._compute_score_window(text, uuid, timestamptz, timestamptz) TO authenticated;

-- 3. Public RPC: compute_score
-- Returns score (0-100), confidence, components, drivers, trend, recommendation.
CREATE OR REPLACE FUNCTION public.compute_score(
  p_scope text,
  p_target_id uuid,
  p_window_days int DEFAULT 14
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _now timestamptz := now();
  _curr_start timestamptz;
  _prior_start timestamptz;
  _curr jsonb;
  _prior jsonb;

  -- Locked weights
  _W_ATT  numeric := 30;
  _W_DEL  numeric := 25;
  _W_APP  numeric := 20;
  _W_TRN  numeric := 10;
  _W_RSP  numeric := 10;
  _W_BLK  numeric := 5;

  _w_total numeric := 0;
  _weighted numeric := 0;
  _score int := 0;

  _trend_score int := 0;
  _trend_delta int := 0;

  _present_components int := 0;
  _sufficient_components int := 0;

  _confidence text := 'low';

  _components jsonb;
  _drivers jsonb;
  _top_pos jsonb := NULL;
  _top_neg jsonb := NULL;
  _recommendation text := 'Keep going — no urgent intervention.';

  _att_pct numeric;
  _del_pct numeric;
  _app_pct numeric;
  _trn_pct numeric;
  _blk_pct numeric;
  _att_ok boolean; _del_ok boolean; _app_ok boolean; _trn_ok boolean; _blk_ok boolean;

  _arr jsonb := '[]'::jsonb;
BEGIN
  IF p_scope NOT IN ('cohort','project') THEN
    RAISE EXCEPTION 'invalid scope: %', p_scope;
  END IF;

  _curr_start  := _now - (p_window_days || ' days')::interval;
  _prior_start := _now - ((p_window_days * 2) || ' days')::interval;

  _curr  := public._compute_score_window(p_scope, p_target_id, _curr_start, _now);
  _prior := public._compute_score_window(p_scope, p_target_id, _prior_start, _curr_start);

  -- Pull values
  _att_pct := NULLIF((_curr->'attendance'->>'pct'),'')::numeric;
  _del_pct := NULLIF((_curr->'on_time_delivery'->>'pct'),'')::numeric;
  _app_pct := NULLIF((_curr->'approval_rate'->>'pct'),'')::numeric;
  _trn_pct := NULLIF((_curr->'training'->>'pct'),'')::numeric;
  _blk_pct := NULLIF((_curr->'blocker_resolution'->>'pct'),'')::numeric;

  _att_ok := (_curr->'attendance'->>'sufficient')::boolean;
  _del_ok := (_curr->'on_time_delivery'->>'sufficient')::boolean;
  _app_ok := (_curr->'approval_rate'->>'sufficient')::boolean;
  _trn_ok := (_curr->'training'->>'sufficient')::boolean;
  _blk_ok := (_curr->'blocker_resolution'->>'sufficient')::boolean;

  -- Build weighted score: only include components that have a value AND sufficient sample.
  IF _att_pct IS NOT NULL AND _att_ok THEN _weighted := _weighted + _att_pct * _W_ATT; _w_total := _w_total + _W_ATT; _sufficient_components := _sufficient_components + 1; END IF;
  IF _del_pct IS NOT NULL AND _del_ok THEN _weighted := _weighted + _del_pct * _W_DEL; _w_total := _w_total + _W_DEL; _sufficient_components := _sufficient_components + 1; END IF;
  IF _app_pct IS NOT NULL AND _app_ok THEN _weighted := _weighted + _app_pct * _W_APP; _w_total := _w_total + _W_APP; _sufficient_components := _sufficient_components + 1; END IF;
  IF _trn_pct IS NOT NULL AND _trn_ok THEN _weighted := _weighted + _trn_pct * _W_TRN; _w_total := _w_total + _W_TRN; _sufficient_components := _sufficient_components + 1; END IF;
  -- Responsiveness intentionally skipped (insufficient signal in current schema)
  IF _blk_pct IS NOT NULL AND _blk_ok THEN _weighted := _weighted + _blk_pct * _W_BLK; _w_total := _w_total + _W_BLK; _sufficient_components := _sufficient_components + 1; END IF;

  IF _w_total > 0 THEN
    _score := round(_weighted / _w_total)::int;
  END IF;

  -- Confidence: based on sample-sufficient component count + total weight covered
  IF _w_total >= 70 AND _sufficient_components >= 3 THEN
    _confidence := 'high';
  ELSIF _w_total >= 40 AND _sufficient_components >= 2 THEN
    _confidence := 'medium';
  ELSIF _w_total > 0 THEN
    _confidence := 'low';
  ELSE
    _confidence := 'insufficient';
  END IF;

  -- Trend: recompute prior window with same logic (inline to avoid recursion overhead).
  DECLARE
    p_att numeric := NULLIF((_prior->'attendance'->>'pct'),'')::numeric;
    p_del numeric := NULLIF((_prior->'on_time_delivery'->>'pct'),'')::numeric;
    p_app numeric := NULLIF((_prior->'approval_rate'->>'pct'),'')::numeric;
    p_trn numeric := NULLIF((_prior->'training'->>'pct'),'')::numeric;
    p_blk numeric := NULLIF((_prior->'blocker_resolution'->>'pct'),'')::numeric;
    p_att_ok boolean := (_prior->'attendance'->>'sufficient')::boolean;
    p_del_ok boolean := (_prior->'on_time_delivery'->>'sufficient')::boolean;
    p_app_ok boolean := (_prior->'approval_rate'->>'sufficient')::boolean;
    p_trn_ok boolean := (_prior->'training'->>'sufficient')::boolean;
    p_blk_ok boolean := (_prior->'blocker_resolution'->>'sufficient')::boolean;
    p_w numeric := 0;
    p_v numeric := 0;
  BEGIN
    IF p_att IS NOT NULL AND p_att_ok THEN p_v := p_v + p_att * _W_ATT; p_w := p_w + _W_ATT; END IF;
    IF p_del IS NOT NULL AND p_del_ok THEN p_v := p_v + p_del * _W_DEL; p_w := p_w + _W_DEL; END IF;
    IF p_app IS NOT NULL AND p_app_ok THEN p_v := p_v + p_app * _W_APP; p_w := p_w + _W_APP; END IF;
    IF p_trn IS NOT NULL AND p_trn_ok THEN p_v := p_v + p_trn * _W_TRN; p_w := p_w + _W_TRN; END IF;
    IF p_blk IS NOT NULL AND p_blk_ok THEN p_v := p_v + p_blk * _W_BLK; p_w := p_w + _W_BLK; END IF;
    IF p_w > 0 THEN _trend_score := round(p_v / p_w)::int; ELSE _trend_score := NULL; END IF;
    IF _trend_score IS NOT NULL AND _w_total > 0 THEN
      _trend_delta := _score - _trend_score;
    ELSE
      _trend_delta := 0;
    END IF;
  END;

  -- Build a components array with weight, value, weighted impact, and a polarity flag.
  _arr := jsonb_build_array(
    jsonb_build_object('key','attendance','label','Attendance','weight',_W_ATT,
      'pct',_att_pct,'sufficient',_att_ok,'detail',_curr->'attendance'),
    jsonb_build_object('key','on_time_delivery','label','On-time delivery','weight',_W_DEL,
      'pct',_del_pct,'sufficient',_del_ok,'detail',_curr->'on_time_delivery'),
    jsonb_build_object('key','approval_rate','label','Approval rate','weight',_W_APP,
      'pct',_app_pct,'sufficient',_app_ok,'detail',_curr->'approval_rate'),
    jsonb_build_object('key','training','label','Training participation','weight',_W_TRN,
      'pct',_trn_pct,'sufficient',_trn_ok,'detail',_curr->'training'),
    jsonb_build_object('key','responsiveness','label','Responsiveness','weight',_W_RSP,
      'pct',NULL,'sufficient',false,'detail',_curr->'responsiveness'),
    jsonb_build_object('key','blocker_resolution','label','Blocker resolution','weight',_W_BLK,
      'pct',_blk_pct,'sufficient',_blk_ok,'detail',_curr->'blocker_resolution')
  );

  -- Drivers: pick top positive (highest pct among sufficient & weight>=10) and top negative (lowest).
  WITH e AS (
    SELECT
      (elem->>'key') AS k,
      (elem->>'label') AS lbl,
      (elem->>'weight')::numeric AS w,
      NULLIF(elem->>'pct','')::numeric AS pct,
      (elem->>'sufficient')::boolean AS ok
    FROM jsonb_array_elements(_arr) elem
  ),
  scored AS (
    SELECT k,lbl,w,pct,ok,(pct * w) AS impact FROM e WHERE pct IS NOT NULL AND ok = true
  )
  SELECT
    (SELECT to_jsonb(s) FROM scored s ORDER BY pct DESC NULLS LAST, w DESC LIMIT 1),
    (SELECT to_jsonb(s) FROM scored s ORDER BY pct ASC NULLS LAST, w DESC LIMIT 1)
  INTO _top_pos, _top_neg;

  -- Recommended action: weakest meaningful component (sufficient, lowest pct) drives copy.
  -- Fall back: highest-weight component that is INSUFFICIENT (we need more data there).
  IF _top_neg IS NOT NULL AND (_top_neg->>'pct')::numeric < 80 THEN
    _recommendation := CASE _top_neg->>'k'
      WHEN 'attendance'         THEN 'Schedule a cohort meeting and record attendance.'
      WHEN 'on_time_delivery'   THEN 'Reassign or unblock overdue deliverables before next due date.'
      WHEN 'approval_rate'      THEN 'Clear pending approvals and address recurring change-requests.'
      WHEN 'training'           THEN 'Push training participation this week — most members are inactive.'
      WHEN 'blocker_resolution' THEN 'Triage open help requests and assign owners.'
      ELSE 'Review the lowest-scoring component and act on it this week.'
    END;
  ELSE
    -- No clear weakness — point at the highest-weight insufficient component.
    DECLARE _weak_key text; _weak_w numeric := 0;
    BEGIN
      FOR _weak_key, _weak_w IN
        SELECT (e->>'key') AS k, (e->>'weight')::numeric
          FROM jsonb_array_elements(_arr) e
         WHERE (e->>'sufficient')::boolean = false
           AND (e->>'key') <> 'responsiveness'
         ORDER BY (e->>'weight')::numeric DESC
      LOOP
        _recommendation := CASE _weak_key
          WHEN 'attendance'         THEN 'Schedule and record at least one cohort meeting to establish an attendance signal.'
          WHEN 'on_time_delivery'   THEN 'Set due dates on active deliverables so on-time signal can be measured.'
          WHEN 'approval_rate'      THEN 'Move some deliverables through review so approval signal can be measured.'
          WHEN 'training'           THEN 'Have at least 3 members log a training drill this week.'
          WHEN 'blocker_resolution' THEN 'Capture blockers as help requests and resolve them — no signal yet.'
          ELSE _recommendation
        END;
        EXIT;
      END LOOP;
    END;
  END IF;

  RETURN jsonb_build_object(
    'scope', p_scope,
    'target_id', p_target_id,
    'window_days', p_window_days,
    'window_start', _curr_start,
    'window_end', _now,
    'score', _score,
    'trend_score', _trend_score,
    'trend_delta', _trend_delta,
    'confidence', _confidence,
    'components', _arr,
    'top_positive_driver', _top_pos,
    'top_negative_driver', _top_neg,
    'recommended_action', _recommendation,
    'sufficient_components', _sufficient_components,
    'weight_covered', _w_total
  );
END;
$$;

REVOKE ALL ON FUNCTION public.compute_score(text, uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compute_score(text, uuid, int) TO authenticated;

-- 4. Optional snapshot insert RPC — leadership-only, no cron yet.
CREATE OR REPLACE FUNCTION public.snapshot_score(
  p_scope text,
  p_target_id uuid,
  p_window_days int DEFAULT 14
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _payload jsonb;
  _id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  _payload := public.compute_score(p_scope, p_target_id, p_window_days);
  INSERT INTO public.cohort_score_snapshots(scope, target_id, window_start, window_end, window_days, score, confidence, components)
  VALUES (
    p_scope, p_target_id,
    (_payload->>'window_start')::timestamptz,
    (_payload->>'window_end')::timestamptz,
    p_window_days,
    (_payload->>'score')::int,
    _payload->>'confidence',
    _payload->'components'
  )
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

REVOKE ALL ON FUNCTION public.snapshot_score(text, uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.snapshot_score(text, uuid, int) TO authenticated;