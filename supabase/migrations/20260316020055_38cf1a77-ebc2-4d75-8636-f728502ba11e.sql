
-- Roster mapping table for auto-assigning cohort + role on signup
CREATE TABLE IF NOT EXISTS public.cohort_roster (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text,
  cohort_name text NOT NULL,
  role text NOT NULL DEFAULT 'member',
  title text,
  matched_user_id uuid,
  matched_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cohort_roster ENABLE ROW LEVEL SECURITY;

CREATE POLICY "roster_admin" ON public.cohort_roster FOR ALL USING (is_admin(auth.uid()));
CREATE POLICY "roster_select" ON public.cohort_roster FOR SELECT USING (auth.uid() IS NOT NULL);

-- Function to auto-assign admin bootstrap + cohort membership on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_roster RECORD;
  v_cohort_id uuid;
  v_role_to_assign app_role;
BEGIN
  -- Create profile
  INSERT INTO public.profiles (user_id, full_name, cal_poly_email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email);
  
  -- Default applicant role
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'applicant');
  
  -- ADMIN BOOTSTRAP: auto-promote somisett@calpoly.edu
  IF NEW.email = 'somisett@calpoly.edu' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
      ON CONFLICT (user_id, role) DO NOTHING;
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'superadmin')
      ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  
  -- Try to match roster by email first, then by name
  SELECT * INTO v_roster FROM public.cohort_roster
    WHERE (email IS NOT NULL AND lower(email) = lower(NEW.email))
       OR (email IS NULL AND lower(full_name) = lower(COALESCE(NEW.raw_user_meta_data->>'full_name', '')))
    LIMIT 1;
  
  IF v_roster IS NOT NULL THEN
    -- Find cohort by name
    SELECT id INTO v_cohort_id FROM public.cohorts WHERE lower(name) = lower(v_roster.cohort_name) LIMIT 1;
    
    IF v_cohort_id IS NOT NULL THEN
      -- Create cohort membership
      INSERT INTO public.cohort_memberships (user_id, cohort_id, role)
      VALUES (NEW.id, v_cohort_id, v_roster.role)
      ON CONFLICT DO NOTHING;
      
      -- If PM role, also grant 'member' app_role
      IF v_roster.role IN ('pm', 'lead', 'integration_lead') THEN
        INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'member')
          ON CONFLICT (user_id, role) DO NOTHING;
        IF v_roster.role = 'pm' THEN
          INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'project_lead')
            ON CONFLICT (user_id, role) DO NOTHING;
        END IF;
      ELSE
        INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'member')
          ON CONFLICT (user_id, role) DO NOTHING;
      END IF;
      
      -- Mark as matched
      UPDATE public.cohort_roster SET matched_user_id = NEW.id, matched_at = now() WHERE id = v_roster.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;
