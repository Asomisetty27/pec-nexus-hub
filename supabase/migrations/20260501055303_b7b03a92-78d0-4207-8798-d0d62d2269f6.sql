-- Migration H: Recruitment review workflow

-- 1. applicant_notes
CREATE TABLE IF NOT EXISTS public.applicant_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id uuid NOT NULL REFERENCES public.applicants(id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL,
  body text NOT NULL CHECK (length(body) > 0 AND length(body) <= 4000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS applicant_notes_applicant_idx ON public.applicant_notes (applicant_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_applicant_notes_updated_at ON public.applicant_notes;
CREATE TRIGGER trg_applicant_notes_updated_at BEFORE UPDATE ON public.applicant_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.applicant_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "applicant_notes_view" ON public.applicant_notes;
CREATE POLICY "applicant_notes_view" ON public.applicant_notes FOR SELECT TO authenticated
  USING (public.can_view_applicant(auth.uid(), applicant_id));

DROP POLICY IF EXISTS "applicant_notes_insert" ON public.applicant_notes;
CREATE POLICY "applicant_notes_insert" ON public.applicant_notes FOR INSERT TO authenticated
  WITH CHECK (
    author_user_id = auth.uid()
    AND public.can_view_applicant(auth.uid(), applicant_id)
  );

DROP POLICY IF EXISTS "applicant_notes_update_own" ON public.applicant_notes;
CREATE POLICY "applicant_notes_update_own" ON public.applicant_notes FOR UPDATE TO authenticated
  USING (author_user_id = auth.uid())
  WITH CHECK (author_user_id = auth.uid());

DROP POLICY IF EXISTS "applicant_notes_delete" ON public.applicant_notes;
CREATE POLICY "applicant_notes_delete" ON public.applicant_notes FOR DELETE TO authenticated
  USING (author_user_id = auth.uid() OR public.is_recruitment_lead(auth.uid()));

-- 2. unique reviewer-per-applicant
CREATE UNIQUE INDEX IF NOT EXISTS applicant_reviews_unique_reviewer
  ON public.applicant_reviews (applicant_id, reviewer_user_id);

-- 3. Helper: can_review_applicant (eligible to leave a review / move stage forward)
CREATE OR REPLACE FUNCTION public.can_review_applicant(_uid uuid, _applicant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.applicants a
    WHERE a.id = _applicant_id
      AND (
        public.is_recruitment_lead(_uid)
        OR a.primary_reviewer_user_id = _uid
        OR (a.routed_cohort_id IS NOT NULL AND public.is_cohort_reviewer(_uid, a.routed_cohort_id))
      )
  );
$$;

-- 4. Stage order helper (returns ordinal; non-terminal lifecycle only)
CREATE OR REPLACE FUNCTION public.applicant_stage_order(_s public.applicant_stage)
RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE _s
    WHEN 'applied' THEN 1
    WHEN 'under_review' THEN 2
    WHEN 'resume_screen' THEN 3
    WHEN 'interview' THEN 4
    WHEN 'decision_pending' THEN 5
    ELSE NULL
  END;
$$;

-- 5. submit_applicant_review
CREATE OR REPLACE FUNCTION public.submit_applicant_review(
  _applicant_id uuid,
  _recommendation public.applicant_decision,
  _rating int DEFAULT NULL,
  _notes text DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT public.can_review_applicant(v_uid, _applicant_id) THEN
    RAISE EXCEPTION 'not authorized to review this applicant';
  END IF;
  IF _rating IS NOT NULL AND (_rating < 1 OR _rating > 5) THEN
    RAISE EXCEPTION 'rating must be between 1 and 5';
  END IF;

  INSERT INTO public.applicant_reviews (applicant_id, reviewer_user_id, recommendation, rating, notes)
  VALUES (_applicant_id, v_uid, _recommendation, _rating, _notes)
  ON CONFLICT (applicant_id, reviewer_user_id)
  DO UPDATE SET
    recommendation = EXCLUDED.recommendation,
    rating = EXCLUDED.rating,
    notes = EXCLUDED.notes,
    updated_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- 6. advance_applicant_stage
CREATE OR REPLACE FUNCTION public.advance_applicant_stage(
  _applicant_id uuid,
  _to_stage public.applicant_stage,
  _reason text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

  v_is_lead := public.is_recruitment_lead(v_uid);
  IF NOT (v_is_lead OR public.can_review_applicant(v_uid, _applicant_id)) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT current_stage INTO v_curr FROM public.applicants WHERE id = _applicant_id FOR UPDATE;
  IF v_curr IS NULL THEN RAISE EXCEPTION 'applicant not found'; END IF;
  IF v_curr = _to_stage THEN RETURN; END IF;

  v_terminal := _to_stage IN ('accepted','rejected','waitlisted','withdrawn');

  -- Terminal transitions: leadership + reason required
  IF v_terminal THEN
    IF NOT v_is_lead THEN
      RAISE EXCEPTION 'only recruitment leadership can set a terminal stage';
    END IF;
    IF _reason IS NULL OR length(trim(_reason)) < 3 THEN
      RAISE EXCEPTION 'reason required for terminal stage';
    END IF;
  ELSE
    -- Non-terminal forward / backward / skip rules
    v_curr_ord := public.applicant_stage_order(v_curr);
    v_to_ord := public.applicant_stage_order(_to_stage);

    -- If current is terminal, only lead may move out (with reason)
    IF v_curr_ord IS NULL THEN
      IF NOT v_is_lead THEN RAISE EXCEPTION 'only leadership can move from a terminal stage'; END IF;
      IF _reason IS NULL OR length(trim(_reason)) < 3 THEN
        RAISE EXCEPTION 'reason required for backward / non-linear move';
      END IF;
    ELSE
      IF v_to_ord = v_curr_ord + 1 THEN
        -- forward by one: any eligible reviewer
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

  -- Compute final_decision for terminal landings
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

  -- Stage history is logged by the existing trigger on applicants.
  -- But we need to capture the reason for non-default moves.
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
$$;

-- 7. assign_primary_reviewer
CREATE OR REPLACE FUNCTION public.assign_primary_reviewer(
  _applicant_id uuid,
  _user_id uuid
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_routed uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT public.is_recruitment_lead(v_uid) THEN
    RAISE EXCEPTION 'only recruitment leadership can assign reviewers';
  END IF;

  SELECT routed_cohort_id INTO v_routed FROM public.applicants WHERE id = _applicant_id;
  IF v_routed IS NULL THEN RAISE EXCEPTION 'applicant has no routed cohort'; END IF;

  IF _user_id IS NOT NULL AND NOT public.is_cohort_reviewer(_user_id, v_routed) THEN
    RAISE EXCEPTION 'user is not an eligible reviewer for the routed cohort';
  END IF;

  UPDATE public.applicants
  SET primary_reviewer_user_id = _user_id, updated_at = now()
  WHERE id = _applicant_id;

  INSERT INTO public.audit_logs (action, target_type, target_id, user_id, metadata)
  VALUES ('applicant.reviewer_assigned', 'applicant', _applicant_id, v_uid,
          jsonb_build_object('user_id', _user_id, 'cohort_id', v_routed));
END;
$$;

-- 8. reroute_applicant
CREATE OR REPLACE FUNCTION public.reroute_applicant(
  _applicant_id uuid,
  _cohort_id uuid,
  _reason text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_old uuid;
  v_curr_reviewer uuid;
  v_keep boolean := false;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT public.is_recruitment_lead(v_uid) THEN
    RAISE EXCEPTION 'only recruitment leadership can reroute applicants';
  END IF;
  IF _reason IS NULL OR length(trim(_reason)) < 3 THEN
    RAISE EXCEPTION 'reason required for reroute';
  END IF;
  IF _cohort_id IS NULL THEN RAISE EXCEPTION 'cohort_id required'; END IF;

  SELECT routed_cohort_id, primary_reviewer_user_id
    INTO v_old, v_curr_reviewer
    FROM public.applicants WHERE id = _applicant_id;

  IF v_curr_reviewer IS NOT NULL THEN
    v_keep := public.is_cohort_reviewer(v_curr_reviewer, _cohort_id);
  END IF;

  UPDATE public.applicants
  SET routed_cohort_id = _cohort_id,
      routing_resolved = true,
      primary_reviewer_user_id = CASE WHEN v_keep THEN v_curr_reviewer ELSE NULL END,
      updated_at = now()
  WHERE id = _applicant_id;

  INSERT INTO public.audit_logs (action, target_type, target_id, user_id, metadata)
  VALUES ('applicant.rerouted', 'applicant', _applicant_id, v_uid,
          jsonb_build_object('from', v_old, 'to', _cohort_id, 'reason', _reason, 'reviewer_kept', v_keep));
END;
$$;

-- 9. Grants
REVOKE ALL ON FUNCTION public.submit_applicant_review(uuid, public.applicant_decision, int, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_applicant_review(uuid, public.applicant_decision, int, text) TO authenticated;

REVOKE ALL ON FUNCTION public.advance_applicant_stage(uuid, public.applicant_stage, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.advance_applicant_stage(uuid, public.applicant_stage, text) TO authenticated;

REVOKE ALL ON FUNCTION public.assign_primary_reviewer(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_primary_reviewer(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.reroute_applicant(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reroute_applicant(uuid, uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.can_review_applicant(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_review_applicant(uuid, uuid) TO authenticated;