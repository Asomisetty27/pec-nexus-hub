-- Pilot-readiness: cohort/channel auto-join + roster backfill

-- 1) Rename existing channels to match cohort-name convention so the trigger can find them
UPDATE public.channels SET name = 'hardware-cohort' WHERE name = 'hardware-cohort';
-- (no-op safety) — channels already exist: hardware-cohort, software-cohort, mech-cohort? Actually 'mechanical-cohort'

-- Map cohort name -> channel name conventions used by the trigger.
-- Existing channel names to recognise: hardware-cohort, software-cohort, mechanical-cohort, ops-cohort,
-- *-general, *-help, *-reviews, *-decisions; plus org-wide: announcements; leadership: pms, tech-leads, pm-tech-leads, board

-- 2) Helper function: join a user to channels matching their roster role + cohort
CREATE OR REPLACE FUNCTION public.join_user_to_default_channels(
  p_user_id uuid,
  p_cohort_name text,
  p_role text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_prefix text;
  v_channel record;
BEGIN
  -- Map cohort name -> channel name prefix used in seed data
  v_prefix := CASE
    WHEN p_cohort_name ILIKE 'Hardware%' THEN 'hardware'
    WHEN p_cohort_name ILIKE 'Software%' THEN 'software'
    WHEN p_cohort_name ILIKE 'Mechanical%' THEN 'mech'
    WHEN p_cohort_name ILIKE 'Ops%' THEN 'ops'
    ELSE NULL
  END;

  -- Always-join: every authenticated member gets the org-wide announcements channel
  FOR v_channel IN SELECT id FROM public.channels WHERE is_org_wide = true LOOP
    INSERT INTO public.channel_members (channel_id, user_id)
    VALUES (v_channel.id, p_user_id) ON CONFLICT DO NOTHING;
  END LOOP;

  -- Cohort channels (general / help / reviews / decisions / cohort)
  IF v_prefix IS NOT NULL THEN
    FOR v_channel IN
      SELECT id FROM public.channels
      WHERE name IN (
        v_prefix || '-cohort',
        v_prefix || '-general',
        v_prefix || '-help',
        v_prefix || '-reviews',
        v_prefix || '-decisions',
        'mechanical-cohort'  -- alias, harmless if unmatched
      )
    LOOP
      INSERT INTO public.channel_members (channel_id, user_id)
      VALUES (v_channel.id, p_user_id) ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  -- Leadership channels for PMs / leads
  IF p_role IN ('pm','lead','integration_lead') THEN
    FOR v_channel IN
      SELECT id FROM public.channels
      WHERE name IN ('pms','tech-leads','pm-tech-leads')
    LOOP
      INSERT INTO public.channel_members (channel_id, user_id)
      VALUES (v_channel.id, p_user_id) ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;
END;
$$;

-- 3) Replace handle_new_user with cohort-driven (not hardcoded) joins + channels
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_roster RECORD;
  v_cohort_id uuid;
  v_proj_role text;
  v_channel record;
BEGIN
  INSERT INTO public.profiles (user_id, full_name, cal_poly_email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email);

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'applicant');

  IF NEW.email = 'somisett@calpoly.edu' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'superadmin') ON CONFLICT DO NOTHING;
  END IF;

  SELECT * INTO v_roster FROM public.cohort_roster
    WHERE (email IS NOT NULL AND lower(email) = lower(NEW.email))
       OR (email IS NULL AND lower(full_name) = lower(COALESCE(NEW.raw_user_meta_data->>'full_name', '')))
    LIMIT 1;

  IF v_roster IS NOT NULL THEN
    SELECT id INTO v_cohort_id FROM public.cohorts WHERE lower(name) = lower(v_roster.cohort_name) LIMIT 1;

    IF v_cohort_id IS NOT NULL THEN
      INSERT INTO public.cohort_memberships (user_id, cohort_id, role)
      VALUES (NEW.id, v_cohort_id, v_roster.role) ON CONFLICT DO NOTHING;

      IF v_roster.role IN ('pm', 'lead', 'integration_lead') THEN
        INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'member') ON CONFLICT DO NOTHING;
        IF v_roster.role = 'pm' THEN
          INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'project_lead') ON CONFLICT DO NOTHING;
        END IF;
        v_proj_role := 'lead';
      ELSE
        INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'member') ON CONFLICT DO NOTHING;
        v_proj_role := 'member';
      END IF;

      -- COHORT-DRIVEN auto-join: every active project tagged to the user's cohort.
      -- We use the seeded 4-project mapping by name match (one cohort = one training project),
      -- but no longer hardcode by id. Also covers any future projects via the cohort_projects view if added.
      INSERT INTO public.project_memberships (project_id, user_id, role_on_project)
      SELECT p.id, NEW.id, v_proj_role
      FROM public.projects p
      WHERE p.status = 'active'
        AND (
          (v_roster.cohort_name = 'Software / Systems' AND p.name ILIKE 'memvis%') OR
          (v_roster.cohort_name = 'Mechanical / Manufacturing' AND p.name ILIKE 'Front Air Intake%') OR
          (v_roster.cohort_name = 'Ops / PM' AND p.name ILIKE 'PEC Go-To-Market%') OR
          (v_roster.cohort_name = 'Hardware / Systems / Embedded' AND p.name ILIKE 'Smart Study Room%')
        )
      ON CONFLICT DO NOTHING;

      -- NEW: auto-join channels (org-wide + cohort + leadership where applicable)
      PERFORM public.join_user_to_default_channels(NEW.id, v_roster.cohort_name, v_roster.role);

      UPDATE public.cohort_roster SET matched_user_id = NEW.id, matched_at = now() WHERE id = v_roster.id;
    END IF;
  ELSE
    -- Even un-rostered signups should land in announcements
    FOR v_channel IN SELECT id FROM public.channels WHERE is_org_wide = true LOOP
      INSERT INTO public.channel_members (channel_id, user_id)
      VALUES (v_channel.id, NEW.id) ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- 4) BACKFILL: existing users (currently 1) — re-run channel joins so the existing admin is in everything
DO $$
DECLARE
  r RECORD;
  ch RECORD;
BEGIN
  FOR r IN
    SELECT p.user_id, p.cal_poly_email, cr.cohort_name, cr.role
    FROM public.profiles p
    LEFT JOIN public.cohort_roster cr ON cr.matched_user_id = p.user_id
  LOOP
    -- Org-wide
    FOR ch IN SELECT id FROM public.channels WHERE is_org_wide = true LOOP
      INSERT INTO public.channel_members (channel_id, user_id)
      VALUES (ch.id, r.user_id) ON CONFLICT DO NOTHING;
    END LOOP;
    IF r.cohort_name IS NOT NULL THEN
      PERFORM public.join_user_to_default_channels(r.user_id, r.cohort_name, COALESCE(r.role,'member'));
    END IF;
  END LOOP;
  -- Admin sees ALL channels (Command Center expectation)
  INSERT INTO public.channel_members (channel_id, user_id)
  SELECT c.id, ur.user_id
  FROM public.channels c
  CROSS JOIN public.user_roles ur
  WHERE ur.role IN ('admin','superadmin')
  ON CONFLICT DO NOTHING;
END $$;

-- 5) Patch roster entries with NULL email so leads/PMs without a Cal Poly email
-- in the roster cannot block themselves out. They will still need to use the
-- name-based fallback, but at least an admin now knows which rows are unmatchable.
-- Mark them clearly.
UPDATE public.cohort_roster
SET identity_status = 'needs_email'
WHERE email IS NULL AND identity_status = 'pending';