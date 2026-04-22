
-- 1. notify_event_change: handle UI scope values
CREATE OR REPLACE FUNCTION public.notify_event_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_user RECORD;
  v_cat text;
  v_title text;
  v_scope text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT NEW.notify_on_create THEN RETURN NEW; END IF;
    v_cat := 'event_created';
    v_title := 'New event: ' || NEW.title;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.cancelled AND NOT OLD.cancelled THEN
      v_cat := 'event_cancelled';
      v_title := 'Cancelled: ' || NEW.title;
    ELSIF (NEW.start_time <> OLD.start_time OR NEW.location IS DISTINCT FROM OLD.location) THEN
      v_cat := 'event_updated';
      v_title := 'Event updated: ' || NEW.title;
    ELSE
      RETURN NEW;
    END IF;
  END IF;

  v_scope := COALESCE(NEW.audience_scope, 'all_members');

  IF v_scope IN ('all', 'all_members', 'org') THEN
    FOR v_user IN SELECT DISTINCT user_id FROM public.user_roles WHERE role <> 'applicant' LOOP
      PERFORM public.create_notification(v_user.user_id, v_cat, v_title, NEW.description, '/app/events',
        v_actor, 'event', NEW.id, 'normal', v_cat || ':' || NEW.id::text, NULL);
    END LOOP;
  ELSIF v_scope = 'cohort' AND NEW.audience_target_id IS NOT NULL THEN
    FOR v_user IN SELECT user_id FROM public.cohort_memberships WHERE cohort_id = NEW.audience_target_id LOOP
      PERFORM public.create_notification(v_user.user_id, v_cat, v_title, NEW.description, '/app/events',
        v_actor, 'event', NEW.id, 'normal', v_cat || ':' || NEW.id::text, NULL);
    END LOOP;
  ELSIF v_scope = 'project' AND NEW.audience_target_id IS NOT NULL THEN
    FOR v_user IN SELECT user_id FROM public.project_memberships WHERE project_id = NEW.audience_target_id LOOP
      PERFORM public.create_notification(v_user.user_id, v_cat, v_title, NEW.description, '/app/events',
        v_actor, 'event', NEW.id, 'normal', v_cat || ':' || NEW.id::text, NULL);
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$;

-- 2. Fix compute_momentum_risk: project_stages has no project_id column
-- Stages are mock-only; for real projects, blocked-stage signal is always 0.
CREATE OR REPLACE FUNCTION public.compute_momentum_risk(_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_days_since_update int;
  v_overdue int;
  v_blocked int := 0;
  v_open_help int;
  v_pending_reviews int;
  v_score int := 0;
  v_level text;
  v_signals jsonb;
BEGIN
  SELECT COALESCE(EXTRACT(DAY FROM now() - GREATEST(
    COALESCE((SELECT MAX(created_at) FROM public.project_updates WHERE project_id = _project_id), 'epoch'::timestamptz),
    COALESCE((SELECT MAX(updated_at) FROM public.deliverables WHERE project_id = _project_id), 'epoch'::timestamptz)
  ))::int, 999) INTO v_days_since_update;

  SELECT COUNT(*) INTO v_overdue FROM public.deliverables
    WHERE project_id = _project_id AND due_date < CURRENT_DATE AND approval_status != 'approved';

  -- project_stages is keyed by mock_project_id; real projects don't have rows here.
  SELECT COUNT(*) INTO v_blocked
  FROM public.project_stages ps
  JOIN public.mock_projects mp ON mp.id = ps.mock_project_id
  JOIN public.projects p ON p.name = mp.title
  WHERE p.id = _project_id AND ps.status = 'blocked';

  SELECT COUNT(*) INTO v_open_help FROM public.help_requests hr
    WHERE hr.status = 'open'
      AND EXISTS (SELECT 1 FROM public.project_memberships pm
                  WHERE pm.project_id = _project_id AND pm.user_id = hr.requester_id);

  SELECT COUNT(*) INTO v_pending_reviews FROM public.deliverables
    WHERE project_id = _project_id AND approval_status = 'pending'
      AND approval_required = true AND updated_at < now() - interval '48 hours';

  v_score := LEAST(100,
    LEAST(v_days_since_update, 30) * 2
    + LEAST(v_overdue, 10) * 4
    + LEAST(v_blocked, 5) * 6
    + LEAST(v_open_help, 5) * 3
    + LEAST(v_pending_reviews, 5) * 4
  );

  v_level := CASE
    WHEN v_score >= 70 THEN 'stalled'
    WHEN v_score >= 45 THEN 'at_risk'
    WHEN v_score >= 20 THEN 'watch'
    ELSE 'healthy'
  END;

  v_signals := jsonb_build_object(
    'days_since_update', v_days_since_update,
    'overdue_deliverables', v_overdue,
    'blocked_stages', v_blocked,
    'open_help_requests', v_open_help,
    'stale_pending_reviews', v_pending_reviews
  );

  INSERT INTO public.momentum_signals (project_id, risk_score, risk_level, signals)
  VALUES (_project_id, v_score, v_level, v_signals);

  RETURN jsonb_build_object('score', v_score, 'level', v_level, 'signals', v_signals);
END;
$function$;

-- 3. Backfill deliverable owners
WITH lead_per_project AS (
  SELECT DISTINCT ON (project_id) project_id, user_id
  FROM public.project_memberships
  WHERE role_on_project = 'lead'
  ORDER BY project_id, user_id
),
fallback_admin AS (
  SELECT user_id FROM public.user_roles WHERE role = 'superadmin' LIMIT 1
)
UPDATE public.deliverables d
SET owner_id = COALESCE(
  (SELECT user_id FROM lead_per_project WHERE project_id = d.project_id),
  (SELECT user_id FROM fallback_admin)
)
WHERE d.owner_id IS NULL;

-- 4. Seed momentum signals
SELECT public.run_momentum_scan();
