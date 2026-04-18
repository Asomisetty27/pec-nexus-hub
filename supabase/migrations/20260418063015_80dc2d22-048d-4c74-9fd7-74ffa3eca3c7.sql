-- Backfill stages for the 3 projects that have deliverables but no milestones
DO $$
DECLARE
  r RECORD;
  v_stage_id uuid;
  stage_names text[] := ARRAY['Kickoff', 'Discovery', 'Direction', 'Build', 'Final Delivery', 'Retro'];
  i int;
BEGIN
  FOR r IN
    SELECT p.id, p.created_by FROM projects p
    WHERE p.id::text LIKE 'aa000001%'
      AND NOT EXISTS (SELECT 1 FROM milestones m WHERE m.project_id = p.id)
  LOOP
    FOR i IN 1..array_length(stage_names, 1) LOOP
      INSERT INTO milestones (project_id, title, description, due_date, status, progress)
      VALUES (
        r.id, stage_names[i], '',
        CURRENT_DATE + (i * 14),
        CASE WHEN i = 1 THEN 'in_progress'::milestone_status ELSE 'not_started'::milestone_status END,
        0
      );
    END LOOP;
  END LOOP;
END $$;

-- Update the handle_new_user trigger to also auto-join active cohort projects
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_roster RECORD;
  v_cohort_id uuid;
  v_proj_role text;
BEGIN
  -- Create profile
  INSERT INTO public.profiles (user_id, full_name, cal_poly_email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email);

  -- Default applicant role
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'applicant');

  -- ADMIN BOOTSTRAP: auto-promote somisett@calpoly.edu
  IF NEW.email = 'somisett@calpoly.edu' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'superadmin') ON CONFLICT DO NOTHING;
  END IF;

  -- Match roster
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

      -- AUTO-JOIN active cohort projects (NEW behavior)
      INSERT INTO public.project_memberships (project_id, user_id, role_on_project)
      SELECT p.id, NEW.id, v_proj_role
      FROM public.projects p
      WHERE p.status = 'active' AND p.id::text LIKE 'aa000001%'
        AND (
          (v_roster.cohort_name = 'Software / Systems' AND p.id = 'aa000001-bbbb-cccc-dddd-eeeeeeeeee01') OR
          (v_roster.cohort_name = 'Mechanical / Manufacturing' AND p.id = 'aa000001-bbbb-cccc-dddd-eeeeeeeeee02') OR
          (v_roster.cohort_name = 'Ops / PM' AND p.id = 'aa000001-bbbb-cccc-dddd-eeeeeeeeee03') OR
          (v_roster.cohort_name = 'Hardware / Systems / Embedded' AND p.id = 'aa000001-bbbb-cccc-dddd-eeeeeeeeee04')
        )
      ON CONFLICT DO NOTHING;

      UPDATE public.cohort_roster SET matched_user_id = NEW.id, matched_at = now() WHERE id = v_roster.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;