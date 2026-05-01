-- Phase 6C: Onboarding automation for accepted applicants

-- 1. Onboarding state enum
DO $$ BEGIN
  CREATE TYPE public.applicant_onboarding_state AS ENUM ('not_started', 'invite_sent', 'joined');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Columns on applicants
ALTER TABLE public.applicants
  ADD COLUMN IF NOT EXISTS onboarding_state public.applicant_onboarding_state NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS onboarding_invite_token_id uuid REFERENCES public.invite_tokens(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS onboarding_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS converted_member_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS converted_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS applicants_onboarding_state_idx ON public.applicants(onboarding_state);

-- 3. RPC: onboard_accepted_applicant
-- Returns json: { state, invite_token_id, invite_token, email, full_name, cohort_id, already_member }
CREATE OR REPLACE FUNCTION public.onboard_accepted_applicant(_applicant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller uuid := auth.uid();
  _app RECORD;
  _cohort_name text;
  _existing_user uuid;
  _token_id uuid;
  _token text;
  _existing_invite RECORD;
BEGIN
  IF _caller IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  IF NOT public.is_recruitment_lead(_caller) THEN
    RAISE EXCEPTION 'forbidden: recruitment lead role required';
  END IF;

  SELECT * INTO _app FROM public.applicants WHERE id = _applicant_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'applicant not found';
  END IF;

  IF _app.current_stage <> 'accepted'::applicant_stage THEN
    RAISE EXCEPTION 'applicant is not accepted (stage=%)', _app.current_stage;
  END IF;

  IF _app.routed_cohort_id IS NULL THEN
    RAISE EXCEPTION 'applicant has no routed cohort';
  END IF;

  -- Already joined? Return current state idempotently.
  IF _app.onboarding_state = 'joined' THEN
    RETURN jsonb_build_object(
      'state', 'joined',
      'already_member', true,
      'email', _app.email,
      'full_name', _app.full_name,
      'cohort_id', _app.routed_cohort_id,
      'converted_member_user_id', _app.converted_member_user_id
    );
  END IF;

  SELECT name INTO _cohort_name FROM public.cohorts WHERE id = _app.routed_cohort_id;

  -- Check for an existing matching profile by email (case-insensitive).
  SELECT user_id INTO _existing_user
  FROM public.profiles
  WHERE lower(cal_poly_email) = lower(_app.email::text)
     OR lower(email) = lower(_app.email::text)
  LIMIT 1;

  IF _existing_user IS NOT NULL THEN
    -- Link existing user instead of issuing an invite.
    UPDATE public.applicants
       SET onboarding_state = 'joined',
           converted_member_user_id = _existing_user,
           converted_at = COALESCE(converted_at, now()),
           updated_at = now()
     WHERE id = _applicant_id;

    -- Ensure cohort_roster has them mapped (best-effort, idempotent).
    INSERT INTO public.cohort_roster(full_name, email, cohort_name, role, matched_user_id, matched_at, identity_status)
    SELECT _app.full_name, _app.email::text, _cohort_name, 'member', _existing_user, now(), 'matched'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.cohort_roster
      WHERE lower(email) = lower(_app.email::text) AND cohort_name = _cohort_name
    );

    INSERT INTO public.audit_logs(user_id, action, target_type, target_id, metadata)
    VALUES (_caller, 'applicant_onboarded_existing', 'applicants', _applicant_id,
            jsonb_build_object('linked_user_id', _existing_user, 'email', _app.email));

    RETURN jsonb_build_object(
      'state', 'joined',
      'already_member', true,
      'email', _app.email,
      'full_name', _app.full_name,
      'cohort_id', _app.routed_cohort_id,
      'converted_member_user_id', _existing_user
    );
  END IF;

  -- If already invite_sent and token still valid+unused, return it idempotently.
  IF _app.onboarding_state = 'invite_sent' AND _app.onboarding_invite_token_id IS NOT NULL THEN
    SELECT * INTO _existing_invite FROM public.invite_tokens
     WHERE id = _app.onboarding_invite_token_id
       AND used_at IS NULL
       AND expires_at > now();
    IF FOUND THEN
      RETURN jsonb_build_object(
        'state', 'invite_sent',
        'already_member', false,
        'email', _app.email,
        'full_name', _app.full_name,
        'cohort_id', _app.routed_cohort_id,
        'invite_token_id', _existing_invite.id,
        'invite_token', _existing_invite.token,
        'reissued', false
      );
    END IF;
  END IF;

  -- Seed cohort_roster (idempotent on email + cohort_name)
  INSERT INTO public.cohort_roster(full_name, email, cohort_name, role, identity_status)
  SELECT _app.full_name, _app.email::text, _cohort_name, 'member', 'pending'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.cohort_roster
    WHERE lower(email) = lower(_app.email::text) AND cohort_name = _cohort_name
  );

  -- Create invite token
  INSERT INTO public.invite_tokens(email, created_by, email_status)
  VALUES (_app.email::text, _caller, 'pending_send')
  RETURNING id, token INTO _token_id, _token;

  UPDATE public.applicants
     SET onboarding_state = 'invite_sent',
         onboarding_invite_token_id = _token_id,
         onboarding_sent_at = now(),
         updated_at = now()
   WHERE id = _applicant_id;

  INSERT INTO public.audit_logs(user_id, action, target_type, target_id, metadata)
  VALUES (_caller, 'applicant_onboarded_invite', 'applicants', _applicant_id,
          jsonb_build_object('invite_token_id', _token_id, 'email', _app.email, 'cohort_id', _app.routed_cohort_id));

  RETURN jsonb_build_object(
    'state', 'invite_sent',
    'already_member', false,
    'email', _app.email,
    'full_name', _app.full_name,
    'cohort_id', _app.routed_cohort_id,
    'invite_token_id', _token_id,
    'invite_token', _token,
    'reissued', true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.onboard_accepted_applicant(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.onboard_accepted_applicant(uuid) TO authenticated;

-- 4. Trigger: when invite_tokens.used_at is set, mark linked applicant as joined
CREATE OR REPLACE FUNCTION public.applicant_link_on_invite_used()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _matched_user uuid;
BEGIN
  IF NEW.used_at IS NOT NULL AND (OLD.used_at IS NULL OR OLD.used_at IS DISTINCT FROM NEW.used_at) THEN
    -- Find a profile that matches this invite email
    SELECT user_id INTO _matched_user
      FROM public.profiles
     WHERE lower(cal_poly_email) = lower(NEW.email)
        OR lower(email) = lower(NEW.email)
     LIMIT 1;

    UPDATE public.applicants
       SET onboarding_state = 'joined',
           converted_member_user_id = COALESCE(converted_member_user_id, _matched_user),
           converted_at = COALESCE(converted_at, now()),
           updated_at = now()
     WHERE onboarding_invite_token_id = NEW.id
       AND onboarding_state <> 'joined';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS applicant_link_on_invite_used_trg ON public.invite_tokens;
CREATE TRIGGER applicant_link_on_invite_used_trg
AFTER UPDATE OF used_at ON public.invite_tokens
FOR EACH ROW
EXECUTE FUNCTION public.applicant_link_on_invite_used();

-- 5. Allow leads to update onboarding fields on applicants (already covered by lead update policy).
-- 6. Add `tags` column for lightweight talent CRM tagging.
ALTER TABLE public.applicants
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS applicants_tags_gin_idx ON public.applicants USING GIN(tags);