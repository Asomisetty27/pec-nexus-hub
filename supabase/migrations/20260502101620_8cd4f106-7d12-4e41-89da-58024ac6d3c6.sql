CREATE OR REPLACE FUNCTION public.promote_pre_cycle_applicants(
  _applicant_ids uuid[] DEFAULT NULL,
  _cycle_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_cycle record;
  v_app record;
  v_routed_cohort uuid;
  v_reviewer uuid;
  v_promoted int := 0;
  v_skipped int := 0;
  v_routed int := 0;
  v_reviewer_assigned int := 0;
  v_routing_unresolved int := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT public.is_recruitment_lead(v_uid) THEN
    RAISE EXCEPTION 'only recruitment leadership can promote pre-cycle applicants';
  END IF;

  IF _cycle_id IS NULL THEN
    SELECT id INTO v_cycle
      FROM public.application_cycles
     WHERE is_active = true AND now() BETWEEN opens_at AND closes_at
     ORDER BY opens_at DESC LIMIT 1;
  ELSE
    SELECT id INTO v_cycle FROM public.application_cycles WHERE id = _cycle_id;
  END IF;

  IF v_cycle.id IS NULL THEN
    RAISE EXCEPTION 'no active application cycle to promote into';
  END IF;

  FOR v_app IN
    SELECT a.id, a.email, a.major, a.current_stage
      FROM public.applicants a
     WHERE a.archived_at IS NULL
       AND (
         (_applicant_ids IS NULL AND a.current_stage = 'pre_cycle_pool')
         OR (_applicant_ids IS NOT NULL AND a.id = ANY(_applicant_ids))
       )
     FOR UPDATE
  LOOP
    IF v_app.current_stage <> 'pre_cycle_pool' THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    v_routed_cohort := NULL;
    IF v_app.major IS NOT NULL AND length(trim(v_app.major)) > 0 THEN
      SELECT cohort_id INTO v_routed_cohort
        FROM public.major_cohort_routing
       WHERE lower(major) = lower(trim(v_app.major)) LIMIT 1;
    END IF;

    IF v_routed_cohort IS NOT NULL THEN v_routed := v_routed + 1;
    ELSE v_routing_unresolved := v_routing_unresolved + 1; END IF;

    v_reviewer := NULL;
    IF v_routed_cohort IS NOT NULL THEN
      SELECT cm.user_id INTO v_reviewer
        FROM public.cohort_memberships cm
        LEFT JOIN LATERAL (
          SELECT count(*) AS open_count
            FROM public.applicants ap
           WHERE ap.primary_reviewer_user_id = cm.user_id
             AND ap.current_stage NOT IN ('accepted','rejected','withdrawn','pre_cycle_pool')
        ) load ON true
       WHERE cm.cohort_id = v_routed_cohort
         AND cm.role IN ('lead','pm','integration_lead')
       ORDER BY load.open_count NULLS FIRST, cm.user_id LIMIT 1;
      IF v_reviewer IS NOT NULL THEN v_reviewer_assigned := v_reviewer_assigned + 1; END IF;
    END IF;

    UPDATE public.applicants
       SET current_stage = 'applied',
           cycle_id = v_cycle.id,
           routed_cohort_id = v_routed_cohort,
           routing_resolved = (v_routed_cohort IS NOT NULL),
           primary_reviewer_user_id = v_reviewer,
           submitted_at = COALESCE(submitted_at, now()),
           updated_at = now()
     WHERE id = v_app.id;

    v_promoted := v_promoted + 1;

    INSERT INTO public.audit_logs (action, target_type, target_id, user_id, metadata)
    VALUES (
      'applicant.promoted_from_pool', 'applicant', v_app.id, v_uid,
      jsonb_build_object(
        'cycle_id', v_cycle.id,
        'routed_cohort_id', v_routed_cohort,
        'primary_reviewer_user_id', v_reviewer
      )
    );
  END LOOP;

  RETURN jsonb_build_object(
    'cycle_id', v_cycle.id,
    'promoted_count', v_promoted,
    'skipped_duplicate_count', v_skipped,
    'routed_count', v_routed,
    'reviewer_assigned_count', v_reviewer_assigned,
    'routing_unresolved_count', v_routing_unresolved
  );
END;
$function$;