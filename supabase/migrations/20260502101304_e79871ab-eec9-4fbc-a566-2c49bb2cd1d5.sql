-- =========================================================
-- Phase B2 — Pre-cycle intake gating + promotion
-- =========================================================

-- 1) Additive column to record re-submissions without duplicating rows.
ALTER TABLE public.applicants
  ADD COLUMN IF NOT EXISTS last_resubmitted_at timestamptz;

-- 2) Partial unique index: one live pool record per normalized email.
--    Excludes archived/withdrawn so a person can re-enter the pool later.
CREATE UNIQUE INDEX IF NOT EXISTS applicants_pre_cycle_pool_unique_email
  ON public.applicants (lower(email::text))
  WHERE current_stage = 'pre_cycle_pool'
    AND archived_at IS NULL;

-- 3) Index to make pool listing cheap.
CREATE INDEX IF NOT EXISTS applicants_pre_cycle_pool_created_idx
  ON public.applicants (created_at DESC)
  WHERE current_stage = 'pre_cycle_pool' AND archived_at IS NULL;

-- 4) Patch advance_applicant_stage:
--    Disallow ANY transition that targets pre_cycle_pool (intake-only),
--    and disallow normal reviewer paths from leaving it (the existing
--    NULL-ord rule already requires leadership + reason; we make the
--    error message explicit and require the dedicated promotion RPC).
CREATE OR REPLACE FUNCTION public.advance_applicant_stage(
  _applicant_id uuid,
  _to_stage public.applicant_stage,
  _reason text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_is_lead boolean;
  v_curr public.applicant_stage;
  v_curr_ord int;
  v_to_ord int;
  v_terminal boolean;
  v_decision public.applicant_decision;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  -- Hard guard: pre_cycle_pool is intake-only and unreachable from
  -- the normal stage machine. It is set only by the public submit
  -- function, and exited only by promote_pre_cycle_applicants().
  IF _to_stage = 'pre_cycle_pool' THEN
    RAISE EXCEPTION 'pre_cycle_pool is intake-only and cannot be set via stage advancement';
  END IF;

  v_is_lead := public.is_recruitment_lead(v_uid);
  IF NOT (v_is_lead OR public.can_review_applicant(v_uid, _applicant_id)) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT current_stage INTO v_curr FROM public.applicants WHERE id = _applicant_id FOR UPDATE;
  IF v_curr IS NULL THEN RAISE EXCEPTION 'applicant not found'; END IF;
  IF v_curr = _to_stage THEN RETURN; END IF;

  -- Leaving the pool requires the dedicated promotion RPC, never this one.
  IF v_curr = 'pre_cycle_pool' THEN
    RAISE EXCEPTION 'pre-cycle pool applicants must be promoted via promote_pre_cycle_applicants';
  END IF;

  v_terminal := _to_stage IN ('accepted','rejected','waitlisted','withdrawn');

  IF v_terminal THEN
    IF NOT v_is_lead THEN
      RAISE EXCEPTION 'only recruitment leadership can set a terminal stage';
    END IF;
    IF _reason IS NULL OR length(trim(_reason)) < 3 THEN
      RAISE EXCEPTION 'reason required for terminal stage';
    END IF;
  ELSE
    v_curr_ord := public.applicant_stage_order(v_curr);
    v_to_ord := public.applicant_stage_order(_to_stage);

    IF v_curr_ord IS NULL THEN
      IF NOT v_is_lead THEN RAISE EXCEPTION 'only leadership can move from a terminal stage'; END IF;
      IF _reason IS NULL OR length(trim(_reason)) < 3 THEN
        RAISE EXCEPTION 'reason required for backward / non-linear move';
      END IF;
    ELSE
      IF v_to_ord = v_curr_ord + 1 THEN
        NULL;
      ELSIF v_to_ord > v_curr_ord + 1 OR v_to_ord < v_curr_ord THEN
        IF NOT v_is_lead THEN
          RAISE EXCEPTION 'only leadership can skip stages or move backward';
        END IF;
        IF _reason IS NULL OR length(trim(_reason)) < 3 THEN
          RAISE EXCEPTION 'reason required for skip or backward move';
        END IF;
      END IF;
    END IF;
  END IF;

  v_decision := CASE _to_stage
    WHEN 'accepted' THEN 'accept'::public.applicant_decision
    WHEN 'rejected' THEN 'reject'::public.applicant_decision
    WHEN 'waitlisted' THEN 'waitlist'::public.applicant_decision
    ELSE NULL
  END;

  UPDATE public.applicants
  SET current_stage = _to_stage,
      final_decision = COALESCE(v_decision, final_decision),
      decision_at = CASE WHEN v_terminal AND _to_stage <> 'withdrawn' THEN now() ELSE decision_at END,
      decision_by_user_id = CASE WHEN v_terminal AND _to_stage <> 'withdrawn' THEN v_uid ELSE decision_by_user_id END,
      withdrawn_at = CASE WHEN _to_stage = 'withdrawn' THEN now() ELSE withdrawn_at END,
      updated_at = now()
  WHERE id = _applicant_id;

  IF _reason IS NOT NULL AND length(trim(_reason)) > 0 THEN
    UPDATE public.applicant_stage_history
    SET reason = _reason
    WHERE id = (
      SELECT id FROM public.applicant_stage_history
      WHERE applicant_id = _applicant_id
      ORDER BY created_at DESC
      LIMIT 1
    );
  END IF;
END;
$function$;

-- 5) Count helper for "Promote all eligible" confirmation UI.
CREATE OR REPLACE FUNCTION public.count_pre_cycle_pool_eligible()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT count(*)::int
  FROM public.applicants
  WHERE current_stage = 'pre_cycle_pool'
    AND archived_at IS NULL;
$$;

-- 6) Promotion RPC. Leadership-only. Idempotent. Returns a JSONB summary.
CREATE OR REPLACE FUNCTION public.promote_pre_cycle_applicants(
  _applicant_ids uuid[] DEFAULT NULL,  -- NULL = promote all eligible
  _cycle_id uuid DEFAULT NULL          -- NULL = use current active cycle
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
  v_summary jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT public.is_recruitment_lead(v_uid) THEN
    RAISE EXCEPTION 'only recruitment leadership can promote pre-cycle applicants';
  END IF;

  -- Resolve target cycle
  IF _cycle_id IS NULL THEN
    SELECT id, opens_at, closes_at, is_active
      INTO v_cycle
      FROM public.application_cycles
     WHERE is_active = true
       AND now() BETWEEN opens_at AND closes_at
     ORDER BY opens_at DESC
     LIMIT 1;
  ELSE
    SELECT id, opens_at, closes_at, is_active
      INTO v_cycle
      FROM public.application_cycles
     WHERE id = _cycle_id;
  END IF;

  IF v_cycle.id IS NULL THEN
    RAISE EXCEPTION 'no active application cycle to promote into';
  END IF;

  -- Iterate. Lock each applicant row to avoid concurrent promotion races.
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
    -- Idempotency: silently skip anything not in the pool anymore
    IF v_app.current_stage <> 'pre_cycle_pool' THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    -- Cohort routing from major
    v_routed_cohort := NULL;
    IF v_app.major IS NOT NULL AND length(trim(v_app.major)) > 0 THEN
      SELECT cohort_id
        INTO v_routed_cohort
        FROM public.major_cohort_routing
       WHERE lower(major) = lower(trim(v_app.major))
       LIMIT 1;
    END IF;

    IF v_routed_cohort IS NOT NULL THEN
      v_routed := v_routed + 1;
    ELSE
      v_routing_unresolved := v_routing_unresolved + 1;
    END IF;

    -- Pick lightest-loaded eligible reviewer in routed cohort
    v_reviewer := NULL;
    IF v_routed_cohort IS NOT NULL THEN
      SELECT cm.user_id
        INTO v_reviewer
        FROM public.cohort_memberships cm
        LEFT JOIN LATERAL (
          SELECT count(*) AS open_count
            FROM public.applicants ap
           WHERE ap.primary_reviewer_user_id = cm.user_id
             AND ap.current_stage NOT IN ('accepted','rejected','withdrawn','pre_cycle_pool')
        ) load ON true
       WHERE cm.cohort_id = v_routed_cohort
         AND cm.role IN ('lead','pm','integration_lead')
       ORDER BY load.open_count NULLS FIRST, cm.user_id
       LIMIT 1;

      IF v_reviewer IS NOT NULL THEN
        v_reviewer_assigned := v_reviewer_assigned + 1;
      END IF;
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

    -- Audit: one row per promotion
    INSERT INTO public.audit_logs (action, target_type, target_id, actor_user_id, metadata)
    VALUES (
      'applicant.promoted_from_pool',
      'applicant',
      v_app.id,
      v_uid,
      jsonb_build_object(
        'cycle_id', v_cycle.id,
        'routed_cohort_id', v_routed_cohort,
        'primary_reviewer_user_id', v_reviewer
      )
    );
  END LOOP;

  v_summary := jsonb_build_object(
    'cycle_id', v_cycle.id,
    'promoted_count', v_promoted,
    'skipped_duplicate_count', v_skipped,
    'routed_count', v_routed,
    'reviewer_assigned_count', v_reviewer_assigned,
    'routing_unresolved_count', v_routing_unresolved
  );

  RETURN v_summary;
END;
$function$;

REVOKE ALL ON FUNCTION public.promote_pre_cycle_applicants(uuid[], uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.promote_pre_cycle_applicants(uuid[], uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.count_pre_cycle_pool_eligible() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.count_pre_cycle_pool_eligible() TO authenticated;