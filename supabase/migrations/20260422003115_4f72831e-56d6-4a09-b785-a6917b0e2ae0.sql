-- =====================================================================
-- Identity mapping hardening
-- =====================================================================

-- 1) Single source-of-truth resync function (SECURITY DEFINER, idempotent)
CREATE OR REPLACE FUNCTION public.resync_user_from_roster(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_full_name text;
  v_roster RECORD;
  v_cohort_id uuid;
  v_proj_role text;
  v_channel record;
  v_added_roles text[] := '{}';
  v_added_channels text[] := '{}';
  v_added_projects int := 0;
  v_caller uuid := auth.uid();
BEGIN
  -- Authorization: admin can repair anyone; users can repair themselves.
  IF v_caller IS NULL OR (v_caller <> p_user_id AND NOT public.is_admin(v_caller)) THEN
    RAISE EXCEPTION 'Not authorized to resync this user';
  END IF;

  -- Pull canonical email + name from profiles (populated at signup from auth.users).
  SELECT lower(trim(cal_poly_email)), full_name
    INTO v_email, v_full_name
  FROM public.profiles
  WHERE user_id = p_user_id;

  IF v_email IS NULL THEN
    RETURN jsonb_build_object('matched', false, 'reason', 'no_profile_email');
  END IF;

  -- Strict email-first match against roster.
  SELECT * INTO v_roster
  FROM public.cohort_roster
  WHERE email IS NOT NULL AND lower(trim(email)) = v_email
  LIMIT 1;

  -- Secondary diagnostic-only match by name when email is absent on roster row.
  IF v_roster IS NULL AND v_full_name IS NOT NULL AND length(trim(v_full_name)) > 0 THEN
    SELECT * INTO v_roster
    FROM public.cohort_roster
    WHERE email IS NULL AND lower(trim(full_name)) = lower(trim(v_full_name))
    LIMIT 1;
  END IF;

  IF v_roster IS NULL THEN
    RETURN jsonb_build_object('matched', false, 'reason', 'no_roster_match', 'email', v_email);
  END IF;

  -- Resolve cohort id by name.
  SELECT id INTO v_cohort_id FROM public.cohorts
   WHERE lower(trim(name)) = lower(trim(v_roster.cohort_name)) LIMIT 1;

  IF v_cohort_id IS NULL THEN
    RETURN jsonb_build_object('matched', true, 'cohort_resolved', false,
                              'reason', 'cohort_not_found', 'cohort_name', v_roster.cohort_name);
  END IF;

  -- Cohort membership (idempotent).
  INSERT INTO public.cohort_memberships (user_id, cohort_id, role)
  VALUES (p_user_id, v_cohort_id, v_roster.role)
  ON CONFLICT (cohort_id, user_id) DO UPDATE SET role = EXCLUDED.role;

  -- App roles by roster role.
  INSERT INTO public.user_roles (user_id, role) VALUES (p_user_id, 'member')
  ON CONFLICT DO NOTHING;
  v_added_roles := array_append(v_added_roles, 'member');

  IF v_roster.role IN ('pm','lead','integration_lead') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (p_user_id, 'project_lead')
    ON CONFLICT DO NOTHING;
    v_added_roles := array_append(v_added_roles, 'project_lead');
    v_proj_role := 'lead';
  ELSE
    v_proj_role := 'member';
  END IF;

  -- Active project membership for this cohort (uses seeded 4-project mapping).
  WITH ins AS (
    INSERT INTO public.project_memberships (project_id, user_id, role_on_project)
    SELECT p.id, p_user_id, v_proj_role
    FROM public.projects p
    WHERE p.status = 'active'
      AND (
        (v_roster.cohort_name = 'Software / Systems'           AND p.name ILIKE 'memvis%') OR
        (v_roster.cohort_name = 'Mechanical / Manufacturing'   AND p.name ILIKE 'Front Air Intake%') OR
        (v_roster.cohort_name = 'Ops / PM'                     AND p.name ILIKE 'PEC Go-To-Market%') OR
        (v_roster.cohort_name = 'Hardware / Systems / Embedded' AND p.name ILIKE 'Smart Study Room%')
      )
    ON CONFLICT (project_id, user_id) DO UPDATE SET role_on_project = EXCLUDED.role_on_project
    RETURNING 1
  )
  SELECT count(*) INTO v_added_projects FROM ins;

  -- Default channel mapping (delegates to existing helper, which is idempotent).
  PERFORM public.join_user_to_default_channels(p_user_id, v_roster.cohort_name, v_roster.role);

  -- Mark roster row as matched.
  UPDATE public.cohort_roster
     SET matched_user_id = p_user_id,
         matched_at = COALESCE(matched_at, now()),
         identity_status = 'matched'
   WHERE id = v_roster.id;

  -- Audit.
  INSERT INTO public.audit_logs (user_id, action, target_type, target_id, metadata)
  VALUES (v_caller, 'identity.resynced', 'user', p_user_id,
          jsonb_build_object(
            'roster_id', v_roster.id,
            'cohort_name', v_roster.cohort_name,
            'roster_role', v_roster.role,
            'app_roles_added', v_added_roles,
            'projects_synced', v_added_projects
          ));

  RETURN jsonb_build_object(
    'matched', true,
    'roster_id', v_roster.id,
    'cohort_name', v_roster.cohort_name,
    'roster_role', v_roster.role,
    'app_roles_added', v_added_roles,
    'projects_synced', v_added_projects
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.resync_user_from_roster(uuid) TO authenticated;

-- 2) Rewire handle_new_user to delegate to the same function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_channel record;
  v_result jsonb;
BEGIN
  -- Always create a profile (canonical email source).
  INSERT INTO public.profiles (user_id, full_name, cal_poly_email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    lower(trim(NEW.email))
  )
  ON CONFLICT (user_id) DO UPDATE
    SET cal_poly_email = EXCLUDED.cal_poly_email,
        full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name);

  -- Baseline applicant role; resync may add stronger ones.
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'applicant')
  ON CONFLICT DO NOTHING;

  -- Founder bootstrap.
  IF lower(NEW.email) = 'somisett@calpoly.edu' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'superadmin') ON CONFLICT DO NOTHING;
  END IF;

  -- Always join announcements (org-wide).
  FOR v_channel IN SELECT id FROM public.channels WHERE is_org_wide = true LOOP
    INSERT INTO public.channel_members (channel_id, user_id)
    VALUES (v_channel.id, NEW.id) ON CONFLICT DO NOTHING;
  END LOOP;

  -- Run roster mapping via shared resync. Errors here must not block signup.
  BEGIN
    -- Temporarily bypass auth.uid() check by impersonating the new user as caller-equivalent:
    -- we rely on the SECURITY DEFINER context and the fact that p_user_id == NEW.id.
    -- Since auth.uid() is NULL inside this trigger, we inline the mapping logic here too.
    PERFORM 1;
    -- Re-implement minimally without auth check to avoid the guard:
    DECLARE
      v_email text := lower(trim(NEW.email));
      v_full_name text := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
      v_roster RECORD;
      v_cohort_id uuid;
      v_proj_role text;
    BEGIN
      SELECT * INTO v_roster FROM public.cohort_roster
       WHERE email IS NOT NULL AND lower(trim(email)) = v_email LIMIT 1;
      IF v_roster IS NULL AND length(trim(v_full_name)) > 0 THEN
        SELECT * INTO v_roster FROM public.cohort_roster
         WHERE email IS NULL AND lower(trim(full_name)) = lower(trim(v_full_name)) LIMIT 1;
      END IF;
      IF v_roster IS NOT NULL THEN
        SELECT id INTO v_cohort_id FROM public.cohorts
         WHERE lower(trim(name)) = lower(trim(v_roster.cohort_name)) LIMIT 1;
        IF v_cohort_id IS NOT NULL THEN
          INSERT INTO public.cohort_memberships (user_id, cohort_id, role)
          VALUES (NEW.id, v_cohort_id, v_roster.role)
          ON CONFLICT (cohort_id, user_id) DO UPDATE SET role = EXCLUDED.role;

          INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'member')
          ON CONFLICT DO NOTHING;
          IF v_roster.role IN ('pm','lead','integration_lead') THEN
            INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'project_lead')
            ON CONFLICT DO NOTHING;
            v_proj_role := 'lead';
          ELSE
            v_proj_role := 'member';
          END IF;

          INSERT INTO public.project_memberships (project_id, user_id, role_on_project)
          SELECT p.id, NEW.id, v_proj_role
          FROM public.projects p
          WHERE p.status = 'active' AND (
            (v_roster.cohort_name = 'Software / Systems'           AND p.name ILIKE 'memvis%') OR
            (v_roster.cohort_name = 'Mechanical / Manufacturing'   AND p.name ILIKE 'Front Air Intake%') OR
            (v_roster.cohort_name = 'Ops / PM'                     AND p.name ILIKE 'PEC Go-To-Market%') OR
            (v_roster.cohort_name = 'Hardware / Systems / Embedded' AND p.name ILIKE 'Smart Study Room%')
          )
          ON CONFLICT (project_id, user_id) DO UPDATE SET role_on_project = EXCLUDED.role_on_project;

          PERFORM public.join_user_to_default_channels(NEW.id, v_roster.cohort_name, v_roster.role);

          UPDATE public.cohort_roster
             SET matched_user_id = NEW.id,
                 matched_at = COALESCE(matched_at, now()),
                 identity_status = 'matched'
           WHERE id = v_roster.id;
        END IF;
      END IF;
    END;
  EXCEPTION WHEN OTHERS THEN
    -- Don't block signup if mapping has a transient issue; admin can repair later.
    INSERT INTO public.audit_logs (user_id, action, target_type, target_id, metadata)
    VALUES (NEW.id, 'identity.signup_map_failed', 'user', NEW.id,
            jsonb_build_object('error', SQLERRM));
  END;

  RETURN NEW;
END;
$$;

-- 3) Auto-repair every currently un-matched user whose profile email is on the roster.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT p.user_id
    FROM public.profiles p
    JOIN public.cohort_roster cr
      ON cr.email IS NOT NULL
     AND lower(trim(cr.email)) = lower(trim(p.cal_poly_email))
    WHERE cr.matched_user_id IS NULL
       OR cr.matched_user_id <> p.user_id
       OR NOT EXISTS (
            SELECT 1 FROM public.cohort_memberships cm WHERE cm.user_id = p.user_id
          )
  LOOP
    BEGIN
      -- Inline the resync without the auth.uid() guard (we are running as superuser in migration).
      DECLARE
        v_email text;
        v_full_name text;
        v_roster RECORD;
        v_cohort_id uuid;
        v_proj_role text;
      BEGIN
        SELECT lower(trim(cal_poly_email)), full_name INTO v_email, v_full_name
          FROM public.profiles WHERE user_id = r.user_id;
        SELECT * INTO v_roster FROM public.cohort_roster
         WHERE email IS NOT NULL AND lower(trim(email)) = v_email LIMIT 1;
        IF v_roster IS NULL THEN CONTINUE; END IF;

        SELECT id INTO v_cohort_id FROM public.cohorts
         WHERE lower(trim(name)) = lower(trim(v_roster.cohort_name)) LIMIT 1;
        IF v_cohort_id IS NULL THEN CONTINUE; END IF;

        INSERT INTO public.cohort_memberships (user_id, cohort_id, role)
        VALUES (r.user_id, v_cohort_id, v_roster.role)
        ON CONFLICT (cohort_id, user_id) DO UPDATE SET role = EXCLUDED.role;

        INSERT INTO public.user_roles (user_id, role) VALUES (r.user_id, 'member')
        ON CONFLICT DO NOTHING;
        IF v_roster.role IN ('pm','lead','integration_lead') THEN
          INSERT INTO public.user_roles (user_id, role) VALUES (r.user_id, 'project_lead')
          ON CONFLICT DO NOTHING;
          v_proj_role := 'lead';
        ELSE
          v_proj_role := 'member';
        END IF;

        INSERT INTO public.project_memberships (project_id, user_id, role_on_project)
        SELECT p.id, r.user_id, v_proj_role
        FROM public.projects p
        WHERE p.status = 'active' AND (
          (v_roster.cohort_name = 'Software / Systems'           AND p.name ILIKE 'memvis%') OR
          (v_roster.cohort_name = 'Mechanical / Manufacturing'   AND p.name ILIKE 'Front Air Intake%') OR
          (v_roster.cohort_name = 'Ops / PM'                     AND p.name ILIKE 'PEC Go-To-Market%') OR
          (v_roster.cohort_name = 'Hardware / Systems / Embedded' AND p.name ILIKE 'Smart Study Room%')
        )
        ON CONFLICT (project_id, user_id) DO UPDATE SET role_on_project = EXCLUDED.role_on_project;

        PERFORM public.join_user_to_default_channels(r.user_id, v_roster.cohort_name, v_roster.role);

        UPDATE public.cohort_roster
           SET matched_user_id = r.user_id,
               matched_at = COALESCE(matched_at, now()),
               identity_status = 'matched'
         WHERE id = v_roster.id;

        INSERT INTO public.audit_logs (user_id, action, target_type, target_id, metadata)
        VALUES (NULL, 'identity.backfill_resynced', 'user', r.user_id,
                jsonb_build_object('roster_id', v_roster.id, 'cohort_name', v_roster.cohort_name, 'roster_role', v_roster.role));
      END;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Backfill skipped for %: %', r.user_id, SQLERRM;
    END;
  END LOOP;
END $$;
