-- 1. Track last dashboard visit for "What changed" since last visit
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_dashboard_visit_at timestamptz;

-- 2. RPC: changes since a given timestamp, scoped to user's projects/cohort
CREATE OR REPLACE FUNCTION public.dashboard_changes_since(p_since timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_since timestamptz := COALESCE(p_since, now() - interval '7 days');
  v_project_ids uuid[];
  v_new_submissions int;
  v_approvals int;
  v_revisions int;
  v_new_decisions int;
  v_new_events int;
  v_new_announcements int;
BEGIN
  IF v_uid IS NULL THEN RETURN '{}'::jsonb; END IF;

  SELECT COALESCE(array_agg(project_id), ARRAY[]::uuid[]) INTO v_project_ids
  FROM public.project_memberships WHERE user_id = v_uid;

  SELECT count(*) INTO v_new_submissions
  FROM public.deliverable_review_events e
  WHERE e.created_at > v_since
    AND e.event_type = 'submitted'
    AND e.project_id = ANY(v_project_ids)
    AND e.actor_id <> v_uid;

  SELECT count(*) INTO v_approvals
  FROM public.deliverable_review_events e
  WHERE e.created_at > v_since
    AND e.event_type = 'approved'
    AND e.project_id = ANY(v_project_ids);

  SELECT count(*) INTO v_revisions
  FROM public.deliverable_review_events e
  WHERE e.created_at > v_since
    AND e.event_type IN ('revision_requested','rejected')
    AND e.project_id = ANY(v_project_ids);

  SELECT count(*) INTO v_new_decisions
  FROM public.decisions d
  WHERE d.decided_at > v_since
    AND d.project_id = ANY(v_project_ids);

  SELECT count(*) INTO v_new_events
  FROM public.events ev
  WHERE ev.created_at > v_since
    AND ev.cancelled = false
    AND ev.start_time > now();

  SELECT count(*) INTO v_new_announcements
  FROM public.announcements a
  WHERE a.created_at > v_since;

  RETURN jsonb_build_object(
    'since', v_since,
    'new_submissions', v_new_submissions,
    'approvals', v_approvals,
    'revisions', v_revisions,
    'new_decisions', v_new_decisions,
    'new_events', v_new_events,
    'new_announcements', v_new_announcements,
    'total', v_new_submissions + v_approvals + v_revisions + v_new_decisions + v_new_events + v_new_announcements
  );
END;
$$;

-- 3. RPC: read-then-update last visit (returns prior timestamp so client can compute diffs)
CREATE OR REPLACE FUNCTION public.touch_dashboard_visit()
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_prev timestamptz;
BEGIN
  IF v_uid IS NULL THEN RETURN NULL; END IF;
  SELECT last_dashboard_visit_at INTO v_prev FROM public.profiles WHERE user_id = v_uid;
  UPDATE public.profiles SET last_dashboard_visit_at = now() WHERE user_id = v_uid;
  RETURN v_prev;
END;
$$;

-- 4. Multi-factor meeting slot recommender v2
-- Returns ranked candidate slots with availability, conflicts, lead coverage, recurrence quality
CREATE OR REPLACE FUNCTION public.recommend_meeting_slots(
  p_cohort_id uuid,
  p_duration_min int DEFAULT 60,
  p_attendee_ids uuid[] DEFAULT NULL,
  p_limit int DEFAULT 6
)
RETURNS TABLE(
  day_of_week int,
  start_hour int,
  end_hour int,
  duration_min int,
  available_count int,
  total_count int,
  conflict_count int,
  lead_count int,
  available_user_ids uuid[],
  missing_user_ids uuid[],
  attendance_pct int,
  rank_label text,
  score numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attendees uuid[];
  v_total int;
  v_lead_ids uuid[];
BEGIN
  -- Resolve attendee pool: explicit list, else cohort members.
  IF p_attendee_ids IS NOT NULL AND array_length(p_attendee_ids, 1) > 0 THEN
    v_attendees := p_attendee_ids;
  ELSE
    SELECT COALESCE(array_agg(user_id), ARRAY[]::uuid[]) INTO v_attendees
    FROM public.cohort_memberships WHERE cohort_id = p_cohort_id;
  END IF;
  v_total := COALESCE(array_length(v_attendees, 1), 0);
  IF v_total = 0 THEN RETURN; END IF;

  -- Identify leads/PMs in attendee pool — they get extra weight.
  SELECT COALESCE(array_agg(user_id), ARRAY[]::uuid[]) INTO v_lead_ids
  FROM public.cohort_memberships
  WHERE cohort_id = p_cohort_id
    AND role IN ('pm','lead','integration_lead')
    AND user_id = ANY(v_attendees);

  RETURN QUERY
  WITH slots AS (
    -- Generate every (day, start_hour) candidate covering the requested duration.
    -- Day 0=Sun..6=Sat, hours 8..21
    SELECT d AS day_of_week, h AS start_hour,
           h + GREATEST(1, CEIL(p_duration_min / 60.0))::int AS end_hour
    FROM generate_series(0, 6) d
    CROSS JOIN generate_series(8, 21) h
    WHERE h + GREATEST(1, CEIL(p_duration_min / 60.0))::int <= 22
  ),
  per_user_coverage AS (
    -- A user covers a slot if they have a window spanning the entire [start_hour, end_hour) range.
    SELECT s.day_of_week, s.start_hour, s.end_hour, w.user_id,
           AVG(w.preference_weight)::numeric AS pref
    FROM slots s
    JOIN public.availability_windows w
      ON w.day_of_week = s.day_of_week
     AND EXTRACT(HOUR FROM w.start_time)::int <= s.start_hour
     AND EXTRACT(HOUR FROM w.end_time)::int >= s.end_hour
    WHERE w.user_id = ANY(v_attendees)
    GROUP BY s.day_of_week, s.start_hour, s.end_hour, w.user_id
  ),
  agg AS (
    SELECT
      s.day_of_week, s.start_hour, s.end_hour,
      COALESCE(array_agg(c.user_id) FILTER (WHERE c.user_id IS NOT NULL), ARRAY[]::uuid[]) AS available_ids,
      COUNT(c.user_id)::int AS available_count,
      COUNT(c.user_id) FILTER (WHERE c.user_id = ANY(v_lead_ids))::int AS lead_count,
      COALESCE(AVG(c.pref), 0)::numeric AS avg_pref
    FROM slots s
    LEFT JOIN per_user_coverage c
      ON c.day_of_week = s.day_of_week AND c.start_hour = s.start_hour AND c.end_hour = s.end_hour
    GROUP BY s.day_of_week, s.start_hour, s.end_hour
  ),
  scored AS (
    SELECT a.*,
           v_total - a.available_count AS conflict_cnt,
           ROUND(100.0 * a.available_count / NULLIF(v_total, 0))::int AS pct,
           -- Multi-factor score:
           --   60% attendance, 25% lead coverage, 15% preference weight (normalized to 5)
           ROUND(
             0.60 * (100.0 * a.available_count / NULLIF(v_total, 0)) +
             0.25 * (100.0 * a.lead_count / NULLIF(GREATEST(array_length(v_lead_ids,1),1), 0)) +
             0.15 * (a.avg_pref * 20)
           , 1) AS score
    FROM agg a
    WHERE a.available_count > 0
  )
  SELECT
    s.day_of_week, s.start_hour, s.end_hour, p_duration_min,
    s.available_count, v_total, s.conflict_cnt, s.lead_count,
    s.available_ids,
    ARRAY(SELECT u FROM unnest(v_attendees) u WHERE u <> ALL(s.available_ids)) AS missing_ids,
    s.pct,
    -- Rank label assigned post-sort in the client; here we expose the raw score.
    ''::text AS rank_label,
    s.score
  FROM scored s
  ORDER BY s.score DESC, s.conflict_cnt ASC, s.day_of_week, s.start_hour
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dashboard_changes_since(timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.touch_dashboard_visit() TO authenticated;
GRANT EXECUTE ON FUNCTION public.recommend_meeting_slots(uuid, int, uuid[], int) TO authenticated;