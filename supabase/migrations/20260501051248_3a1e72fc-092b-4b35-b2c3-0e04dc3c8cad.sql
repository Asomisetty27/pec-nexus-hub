-- Phase 5 Migration F2: cadence enforcement engine RPCs

-- =========================================================================
-- Helper: is_cadence_leadership
-- =========================================================================
CREATE OR REPLACE FUNCTION public.is_cadence_leadership(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _uid
      AND role IN ('admin','superadmin','president','director_of_projects')
  );
$$;

-- =========================================================================
-- cadence_signals(p_scope, p_target_id)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.cadence_signals(
  p_scope    text,
  p_target_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid                   uuid := auth.uid();
  v_is_leadership         boolean := false;
  v_is_scope_lead         boolean := false;
  v_is_scope_member       boolean := false;
  v_viewer_role           text := 'member';

  v_week_start            timestamptz := date_trunc('week', now());
  v_prev_week_start       timestamptz := date_trunc('week', now()) - interval '7 days';

  v_meetings_this_week    int := 0;
  v_meetings_prev_week    int := 0;
  v_total_meetings        int := 0;
  v_total_attendance      int := 0;

  v_last_meeting_id       uuid;
  v_last_meeting_at       timestamptz;
  v_next_meeting_at       timestamptz;
  v_scope_started_at      timestamptz;

  v_last_meeting_att_rows int := 0;
  v_tech_lead_present     boolean;

  v_weeks_without         int := 0;
  v_warnings              jsonb := '[]'::jsonb;
  v_health                text := 'healthy';

  v_event_types           text[];
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error','not_authenticated');
  END IF;

  IF p_scope NOT IN ('cohort','project') THEN
    RETURN jsonb_build_object('error','invalid_scope');
  END IF;

  v_is_leadership := public.is_cadence_leadership(v_uid);

  IF p_scope = 'cohort' THEN
    v_event_types := ARRAY['cohort_meeting','leadership_meeting','training_session'];

    SELECT MIN(joined_at) INTO v_scope_started_at
      FROM public.cohort_memberships WHERE cohort_id = p_target_id;

    IF v_scope_started_at IS NULL THEN
      RETURN jsonb_build_object('error','scope_inactive_or_missing');
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.cohort_memberships
      WHERE cohort_id = p_target_id AND user_id = v_uid
    ) INTO v_is_scope_member;

    SELECT EXISTS (
      SELECT 1 FROM public.cohort_memberships
      WHERE cohort_id = p_target_id
        AND user_id = v_uid
        AND role IN ('lead','integration_lead')
    ) INTO v_is_scope_lead;

  ELSE
    v_event_types := ARRAY['project_meeting','meeting'];

    SELECT created_at INTO v_scope_started_at
      FROM public.projects
      WHERE id = p_target_id AND status = 'active';

    IF v_scope_started_at IS NULL THEN
      RETURN jsonb_build_object('error','scope_inactive_or_missing');
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.project_memberships
      WHERE project_id = p_target_id AND user_id = v_uid
    ) INTO v_is_scope_member;

    SELECT EXISTS (
      SELECT 1 FROM public.project_memberships
      WHERE project_id = p_target_id
        AND user_id = v_uid
        AND role_on_project IN ('lead','tech_lead')
    ) INTO v_is_scope_lead;
  END IF;

  IF NOT v_is_leadership AND NOT v_is_scope_member THEN
    RETURN jsonb_build_object('error','not_authorized');
  END IF;

  v_viewer_role := CASE
    WHEN v_is_leadership THEN 'admin'
    WHEN v_is_scope_lead THEN 'lead'
    ELSE 'member'
  END;

  SELECT
    COUNT(*) FILTER (WHERE start_time >= v_week_start),
    COUNT(*) FILTER (WHERE start_time >= v_prev_week_start AND start_time < v_week_start),
    COUNT(*)
  INTO v_meetings_this_week, v_meetings_prev_week, v_total_meetings
  FROM public.events
  WHERE audience_scope = p_scope
    AND audience_target_id = p_target_id
    AND event_type::text = ANY(v_event_types)
    AND cancelled = false
    AND start_time <= now();

  SELECT id, start_time INTO v_last_meeting_id, v_last_meeting_at
  FROM public.events
  WHERE audience_scope = p_scope
    AND audience_target_id = p_target_id
    AND event_type::text = ANY(v_event_types)
    AND cancelled = false
    AND start_time <= now()
  ORDER BY start_time DESC
  LIMIT 1;

  SELECT start_time INTO v_next_meeting_at
  FROM public.events
  WHERE audience_scope = p_scope
    AND audience_target_id = p_target_id
    AND event_type::text = ANY(v_event_types)
    AND cancelled = false
    AND start_time > now()
  ORDER BY start_time ASC
  LIMIT 1;

  SELECT COUNT(*) INTO v_total_attendance
  FROM public.event_attendance ea
  JOIN public.events e ON e.id = ea.event_id
  WHERE e.audience_scope = p_scope
    AND e.audience_target_id = p_target_id
    AND e.event_type::text = ANY(v_event_types)
    AND e.cancelled = false;

  v_tech_lead_present := NULL;
  IF v_last_meeting_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_last_meeting_att_rows
    FROM public.event_attendance
    WHERE event_id = v_last_meeting_id;

    IF v_last_meeting_att_rows > 0 THEN
      IF p_scope = 'cohort' THEN
        SELECT EXISTS (
          SELECT 1
          FROM public.event_attendance ea
          JOIN public.cohort_memberships cm
            ON cm.user_id = ea.user_id AND cm.cohort_id = p_target_id
          WHERE ea.event_id = v_last_meeting_id
            AND ea.status IN ('present','late')
            AND cm.role IN ('lead','integration_lead')
        ) INTO v_tech_lead_present;
      ELSE
        SELECT EXISTS (
          SELECT 1
          FROM public.event_attendance ea
          JOIN public.project_memberships pm
            ON pm.user_id = ea.user_id AND pm.project_id = p_target_id
          WHERE ea.event_id = v_last_meeting_id
            AND ea.status IN ('present','late')
            AND pm.role_on_project IN ('lead','tech_lead')
        ) INTO v_tech_lead_present;
      END IF;
    END IF;
  END IF;

  v_weeks_without := CASE
    WHEN v_meetings_this_week > 0 THEN 0
    WHEN v_meetings_prev_week > 0 THEN 1
    ELSE 2
  END;

  IF v_total_meetings = 0 AND v_scope_started_at <= now() - interval '7 days' THEN
    v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
      'code','no_meeting_recorded_yet',
      'severity','info',
      'message','No meeting recorded yet',
      'action','Schedule first cadence meeting'
    ));
  END IF;

  IF v_total_meetings > 0 THEN
    IF v_weeks_without = 1 THEN
      v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
        'code','no_meeting_this_week',
        'severity','warning',
        'message','No meeting recorded this week',
        'action','Schedule a meeting'
      ));
    ELSIF v_weeks_without >= 2 THEN
      v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
        'code','no_meetings_2_weeks',
        'severity','at_risk',
        'message','No meetings for 2+ weeks',
        'action','Restore weekly cadence'
      ));
    END IF;
  END IF;

  IF v_last_meeting_id IS NOT NULL THEN
    IF v_last_meeting_att_rows = 0 THEN
      v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
        'code','tech_lead_presence_unknown',
        'severity','info',
        'message','Tech Lead attendance not detected',
        'action','Mark attendance for last meeting'
      ));
    ELSIF v_tech_lead_present = false THEN
      v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
        'code','tech_lead_absent_last_meeting',
        'severity','warning',
        'message','Tech Lead absent from last meeting',
        'action','Confirm Tech Lead coverage next meeting'
      ));
    END IF;
  END IF;

  IF v_total_meetings > 0 AND v_total_attendance = 0 THEN
    v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
      'code','no_attendance_recorded',
      'severity','info',
      'message','No attendance recorded yet',
      'action','Start tracking attendance'
    ));
  END IF;

  IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_warnings) w WHERE w->>'severity' = 'at_risk') THEN
    v_health := 'at_risk';
  ELSIF EXISTS (SELECT 1 FROM jsonb_array_elements(v_warnings) w WHERE w->>'severity' = 'warning') THEN
    v_health := 'warning';
  ELSE
    v_health := 'healthy';
  END IF;

  IF v_viewer_role = 'member' THEN
    SELECT COALESCE(jsonb_agg(w), '[]'::jsonb)
    INTO v_warnings
    FROM jsonb_array_elements(v_warnings) w
    WHERE w->>'code' IN ('no_meeting_recorded_yet','no_meeting_this_week','no_meetings_2_weeks');

    RETURN jsonb_build_object(
      'scope', p_scope,
      'target_id', p_target_id,
      'health', v_health,
      'weeks_without_meeting', v_weeks_without,
      'last_meeting_at', v_last_meeting_at,
      'next_meeting_at', v_next_meeting_at,
      'warnings', v_warnings,
      'viewer_role', v_viewer_role
    );
  END IF;

  RETURN jsonb_build_object(
    'scope', p_scope,
    'target_id', p_target_id,
    'health', v_health,
    'weeks_without_meeting', v_weeks_without,
    'last_meeting_at', v_last_meeting_at,
    'next_meeting_at', v_next_meeting_at,
    'tech_lead_present_last_meeting', v_tech_lead_present,
    'warnings', v_warnings,
    'viewer_role', v_viewer_role
  );
END;
$$;

-- =========================================================================
-- cadence_overview() — leadership-only
-- =========================================================================
CREATE OR REPLACE FUNCTION public.cadence_overview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_cohorts   jsonb := '[]'::jsonb;
  v_projects  jsonb := '[]'::jsonb;
  r           record;
  v_signal    jsonb;
  v_top       jsonb;
BEGIN
  IF v_uid IS NULL OR NOT public.is_cadence_leadership(v_uid) THEN
    RETURN jsonb_build_object('error','not_authorized');
  END IF;

  FOR r IN
    SELECT c.id, c.name
    FROM public.cohorts c
    WHERE EXISTS (SELECT 1 FROM public.cohort_memberships cm WHERE cm.cohort_id = c.id)
    ORDER BY c.name
  LOOP
    v_signal := public.cadence_signals('cohort', r.id);
    v_top := (
      SELECT w FROM jsonb_array_elements(COALESCE(v_signal->'warnings','[]'::jsonb)) w
      ORDER BY CASE w->>'severity'
        WHEN 'at_risk' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END
      LIMIT 1
    );
    v_cohorts := v_cohorts || jsonb_build_array(jsonb_build_object(
      'id', r.id,
      'name', r.name,
      'health', COALESCE(v_signal->>'health','healthy'),
      'top_warning', v_top
    ));
  END LOOP;

  FOR r IN
    SELECT p.id, p.name FROM public.projects p
    WHERE p.status = 'active'
    ORDER BY p.name
  LOOP
    v_signal := public.cadence_signals('project', r.id);
    v_top := (
      SELECT w FROM jsonb_array_elements(COALESCE(v_signal->'warnings','[]'::jsonb)) w
      ORDER BY CASE w->>'severity'
        WHEN 'at_risk' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END
      LIMIT 1
    );
    v_projects := v_projects || jsonb_build_array(jsonb_build_object(
      'id', r.id,
      'name', r.name,
      'health', COALESCE(v_signal->>'health','healthy'),
      'top_warning', v_top
    ));
  END LOOP;

  RETURN jsonb_build_object(
    'cohorts', v_cohorts,
    'projects', v_projects,
    'generated_at', now()
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cadence_signals(text, uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.cadence_overview() FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.is_cadence_leadership(uuid) FROM public, anon;

GRANT EXECUTE ON FUNCTION public.cadence_signals(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cadence_overview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_cadence_leadership(uuid) TO authenticated;