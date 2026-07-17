-- Lifecycle sim findings (2026-07-17), signup provisioning was broken 3 ways:
-- 1. handle_new_user guarded roster provisioning with `IF v_roster IS NOT
--    NULL` on a RECORD, which is true only when EVERY field is non-null;
--    pending roster rows always carry NULL matched_user_id/matched_at, so
--    provisioning silently skipped for every onboarded signup (proven live:
--    4/4 new members landed as bare applicants with no cohort or member role).
-- 2. The project auto-join hardcoded the pre-rename cohort names, dead since
--    the operating-model migration; replaced with data-driven cohort_id match.
-- 3. join_user_to_default_channels' prefix map had no case for
--    'Business & Marketing' (old 'Ops%'), so business members joined no
--    cohort channels.
-- Applied to staging 2026-07-17; prod apply with this sim's fix batch.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_roster RECORD;
  v_matched boolean := false;
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
  v_matched := FOUND;

  IF v_matched THEN
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

      -- Cohort-driven auto-join: every active project belonging to the
      -- member's cohort (data-driven; the old version hardcoded pre-rename
      -- cohort names and matched nothing after the restructure).
      INSERT INTO public.project_memberships (project_id, user_id, role_on_project)
      SELECT p.id, NEW.id, v_proj_role
      FROM public.projects p
      WHERE p.status = 'active' AND p.cohort_id = v_cohort_id
      ON CONFLICT DO NOTHING;

      PERFORM public.join_user_to_default_channels(NEW.id, v_roster.cohort_name, v_roster.role);

      UPDATE public.cohort_roster SET matched_user_id = NEW.id, matched_at = now(), identity_status = 'matched'
      WHERE id = v_roster.id;
    END IF;
  ELSE
    FOR v_channel IN SELECT id FROM public.channels WHERE is_org_wide = true LOOP
      INSERT INTO public.channel_members (channel_id, user_id)
      VALUES (v_channel.id, NEW.id) ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.join_user_to_default_channels(p_user_id uuid, p_cohort_name text, p_role text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_prefix text;
  v_channel record;
BEGIN
  v_prefix := CASE
    WHEN p_cohort_name ILIKE 'Hardware%'   THEN 'hardware'
    WHEN p_cohort_name ILIKE 'Software%'   THEN 'software'
    WHEN p_cohort_name ILIKE 'Mechanical%' THEN 'mech'
    WHEN p_cohort_name ILIKE 'Business%'   THEN 'ops'
    WHEN p_cohort_name ILIKE 'Ops%'        THEN 'ops'
    ELSE NULL
  END;

  FOR v_channel IN SELECT id FROM public.channels WHERE is_org_wide = true LOOP
    INSERT INTO public.channel_members (channel_id, user_id)
    VALUES (v_channel.id, p_user_id) ON CONFLICT DO NOTHING;
  END LOOP;

  IF v_prefix IS NOT NULL THEN
    FOR v_channel IN
      SELECT id FROM public.channels
      WHERE name IN (v_prefix || '-general', v_prefix || '-help')
    LOOP
      INSERT INTO public.channel_members (channel_id, user_id)
      VALUES (v_channel.id, p_user_id) ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;
END;
$$;
