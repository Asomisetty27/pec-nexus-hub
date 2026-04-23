
-- Detect the dominant recurring meeting pattern for a cohort over the last 60 days.
-- Returns the (day_of_week, hour) with the most past meetings, plus a stability score.
CREATE OR REPLACE FUNCTION public.detect_cohort_meeting_pattern(p_cohort_id uuid)
RETURNS TABLE(
  day_of_week int,
  start_hour int,
  occurrences int,
  stability text  -- 'strong' | 'emerging' | 'none'
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_member boolean;
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;
  SELECT EXISTS(SELECT 1 FROM public.cohort_memberships WHERE cohort_id = p_cohort_id AND user_id = v_uid)
    OR public.is_admin(v_uid)
    INTO v_member;
  IF NOT v_member THEN RETURN; END IF;

  RETURN QUERY
  WITH past AS (
    -- Past cohort meetings from events table
    SELECT EXTRACT(DOW FROM e.start_time AT TIME ZONE 'UTC')::int AS dow,
           EXTRACT(HOUR FROM e.start_time AT TIME ZONE 'UTC')::int AS hr
    FROM public.events e
    WHERE e.event_type = 'meeting'
      AND e.cancelled = false
      AND e.start_time > now() - interval '60 days'
      AND e.start_time < now()
      AND (
        (e.audience_scope = 'cohort' AND e.audience_target_id = p_cohort_id)
        OR e.audience_scope IN ('all','all_members','org')
      )
    UNION ALL
    -- Accepted proposals (treated as committed cadence signal)
    SELECT EXTRACT(DOW FROM mp.candidate_time AT TIME ZONE 'UTC')::int,
           EXTRACT(HOUR FROM mp.candidate_time AT TIME ZONE 'UTC')::int
    FROM public.meeting_proposals mp
    WHERE mp.cohort_id = p_cohort_id
      AND mp.status IN ('accepted','scheduled')
      AND mp.candidate_time > now() - interval '60 days'
  ),
  agg AS (
    SELECT dow, hr, count(*)::int AS n
    FROM past GROUP BY dow, hr
    ORDER BY count(*) DESC, dow, hr
    LIMIT 1
  )
  SELECT a.dow, a.hr, a.n,
         CASE
           WHEN a.n >= 4 THEN 'strong'
           WHEN a.n >= 2 THEN 'emerging'
           ELSE 'none'
         END
  FROM agg a;
END;
$$;

GRANT EXECUTE ON FUNCTION public.detect_cohort_meeting_pattern(uuid) TO authenticated;


-- Generate small contextual hints for the calendar (passive-mode awareness).
-- Returns a list of typed hint rows. UI decides which to show.
CREATE OR REPLACE FUNCTION public.calendar_awareness_hints(p_cohort_id uuid)
RETURNS TABLE(
  hint_type text,    -- 'no_meeting_this_week' | 'usual_slot' | 'high_conflict' | 'pattern_open'
  message text,
  tone text,         -- 'neutral' | 'positive' | 'warning'
  metadata jsonb
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_member boolean;
  v_week_start timestamptz := date_trunc('week', now());
  v_week_end timestamptz := date_trunc('week', now()) + interval '7 days';
  v_meeting_count int;
  v_pattern RECORD;
  v_total_members int;
  v_active_today int;
  v_dow_names text[] := ARRAY['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;
  SELECT EXISTS(SELECT 1 FROM public.cohort_memberships WHERE cohort_id = p_cohort_id AND user_id = v_uid)
    OR public.is_admin(v_uid)
    INTO v_member;
  IF NOT v_member THEN RETURN; END IF;

  -- Hint 1: no cohort meeting scheduled this week
  SELECT count(*) INTO v_meeting_count
  FROM public.events e
  WHERE e.event_type = 'meeting'
    AND e.cancelled = false
    AND e.start_time >= v_week_start
    AND e.start_time < v_week_end
    AND (
      (e.audience_scope = 'cohort' AND e.audience_target_id = p_cohort_id)
      OR e.audience_scope IN ('all','all_members','org')
    );

  IF v_meeting_count = 0 THEN
    RETURN QUERY SELECT 'no_meeting_this_week'::text,
                        'No cohort meeting scheduled this week.'::text,
                        'warning'::text,
                        jsonb_build_object('week_start', v_week_start);
  END IF;

  -- Hint 2 & 4: usual recurring slot
  SELECT * INTO v_pattern FROM public.detect_cohort_meeting_pattern(p_cohort_id);
  IF v_pattern IS NOT NULL AND v_pattern.stability IN ('strong','emerging') THEN
    DECLARE
      v_label text;
      v_hour_label text;
    BEGIN
      v_hour_label := CASE
        WHEN v_pattern.start_hour = 0 THEN '12am'
        WHEN v_pattern.start_hour < 12 THEN v_pattern.start_hour || 'am'
        WHEN v_pattern.start_hour = 12 THEN '12pm'
        ELSE (v_pattern.start_hour - 12) || 'pm'
      END;
      v_label := v_dow_names[v_pattern.day_of_week + 1] || 's at ' || v_hour_label;

      RETURN QUERY SELECT 'usual_slot'::text,
                          ('You usually meet ' || v_label || '.')::text,
                          'neutral'::text,
                          jsonb_build_object(
                            'day_of_week', v_pattern.day_of_week,
                            'start_hour', v_pattern.start_hour,
                            'stability', v_pattern.stability,
                            'occurrences', v_pattern.occurrences
                          );
    END;
  END IF;

  -- Hint 3: conflict density vs baseline
  SELECT count(*) INTO v_total_members
  FROM public.cohort_memberships WHERE cohort_id = p_cohort_id;

  SELECT count(DISTINCT user_id) INTO v_active_today
  FROM public.availability_windows
  WHERE user_id IN (SELECT user_id FROM public.cohort_memberships WHERE cohort_id = p_cohort_id);

  IF v_total_members > 0 AND v_active_today < (v_total_members / 2) THEN
    RETURN QUERY SELECT 'high_conflict'::text,
                        ('Only ' || v_active_today || ' of ' || v_total_members || ' members have shared availability — recommendations will be limited.')::text,
                        'warning'::text,
                        jsonb_build_object('with_availability', v_active_today, 'total', v_total_members);
  END IF;

  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.calendar_awareness_hints(uuid) TO authenticated;
