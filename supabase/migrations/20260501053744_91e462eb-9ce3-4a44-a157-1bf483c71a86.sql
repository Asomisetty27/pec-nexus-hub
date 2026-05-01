-- Migration G2 (retry): Recruitment pipeline core
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE IF NOT EXISTS public.application_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season public.application_cycle_season NOT NULL,
  year int NOT NULL,
  opens_at timestamptz NOT NULL,
  closes_at timestamptz NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (season, year),
  CHECK (closes_at > opens_at)
);
CREATE UNIQUE INDEX IF NOT EXISTS application_cycles_one_active_idx
  ON public.application_cycles ((is_active)) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS public.major_cohort_routing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  major text NOT NULL UNIQUE,
  cohort_id uuid NOT NULL REFERENCES public.cohorts(id) ON DELETE RESTRICT,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.applicants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id uuid REFERENCES public.application_cycles(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  email citext NOT NULL,
  phone text,
  pronouns text,
  major text,
  graduation_year int,
  gpa numeric(3,2),
  preferred_cohort_id uuid REFERENCES public.cohorts(id) ON DELETE SET NULL,
  routed_cohort_id uuid REFERENCES public.cohorts(id) ON DELETE SET NULL,
  routing_resolved boolean NOT NULL DEFAULT false,
  why_join text,
  experience text,
  links jsonb NOT NULL DEFAULT '{}'::jsonb,
  source public.applicant_source,
  source_detail text,
  resume_storage_path text NOT NULL,
  resume_uploaded_at timestamptz,
  current_stage public.applicant_stage NOT NULL DEFAULT 'applied',
  primary_reviewer_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  final_decision public.applicant_decision,  -- terminal-only by convention: accept/reject/waitlist
  decision_at timestamptz,
  decision_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  submitted_at timestamptz,
  submission_ip inet,
  submission_user_agent text,
  withdrawn_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS applicants_cycle_idx ON public.applicants (cycle_id);
CREATE INDEX IF NOT EXISTS applicants_routed_cohort_idx ON public.applicants (routed_cohort_id);
CREATE INDEX IF NOT EXISTS applicants_stage_idx ON public.applicants (current_stage);
CREATE INDEX IF NOT EXISTS applicants_email_idx ON public.applicants (email);
CREATE INDEX IF NOT EXISTS applicants_primary_reviewer_idx ON public.applicants (primary_reviewer_user_id);

CREATE TABLE IF NOT EXISTS public.applicant_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id uuid NOT NULL REFERENCES public.applicants(id) ON DELETE CASCADE,
  reviewer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recommendation public.applicant_decision NOT NULL,
  rating int CHECK (rating IS NULL OR (rating BETWEEN 1 AND 5)),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS applicant_reviews_applicant_idx ON public.applicant_reviews (applicant_id);
CREATE INDEX IF NOT EXISTS applicant_reviews_reviewer_idx ON public.applicant_reviews (reviewer_user_id);

CREATE TABLE IF NOT EXISTS public.applicant_stage_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id uuid NOT NULL REFERENCES public.applicants(id) ON DELETE CASCADE,
  from_stage public.applicant_stage,
  to_stage public.applicant_stage NOT NULL,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS applicant_stage_history_applicant_idx ON public.applicant_stage_history (applicant_id, created_at);

CREATE TABLE IF NOT EXISTS public.applicant_resume_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id uuid NOT NULL REFERENCES public.applicants(id) ON DELETE CASCADE,
  accessed_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  accessed_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS applicant_resume_access_log_applicant_idx
  ON public.applicant_resume_access_log (applicant_id, accessed_at);

-- Lightweight intake throttling for public /apply edge function (IP + email + window)
CREATE TABLE IF NOT EXISTS public.submission_rate_limit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip inet,
  email citext,
  window_start timestamptz NOT NULL DEFAULT now(),
  attempts int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS submission_rate_limit_ip_idx ON public.submission_rate_limit (ip, window_start);
CREATE INDEX IF NOT EXISTS submission_rate_limit_email_idx ON public.submission_rate_limit (email, window_start);

-- updated_at triggers (project uses public.update_updated_at)
DROP TRIGGER IF EXISTS trg_application_cycles_updated_at ON public.application_cycles;
CREATE TRIGGER trg_application_cycles_updated_at BEFORE UPDATE ON public.application_cycles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS trg_major_cohort_routing_updated_at ON public.major_cohort_routing;
CREATE TRIGGER trg_major_cohort_routing_updated_at BEFORE UPDATE ON public.major_cohort_routing
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS trg_applicants_updated_at ON public.applicants;
CREATE TRIGGER trg_applicants_updated_at BEFORE UPDATE ON public.applicants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS trg_applicant_reviews_updated_at ON public.applicant_reviews;
CREATE TRIGGER trg_applicant_reviews_updated_at BEFORE UPDATE ON public.applicant_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS trg_submission_rate_limit_updated_at ON public.submission_rate_limit;
CREATE TRIGGER trg_submission_rate_limit_updated_at BEFORE UPDATE ON public.submission_rate_limit
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Helpers
CREATE OR REPLACE FUNCTION public.is_recruitment_lead(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _uid AND role IN ('admin','superadmin','president','director_of_projects')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_cohort_reviewer(_uid uuid, _cohort_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.cohort_memberships
    WHERE user_id = _uid AND cohort_id = _cohort_id AND role IN ('lead','pm','integration_lead')
  );
$$;

CREATE OR REPLACE FUNCTION public.can_view_applicant(_uid uuid, _applicant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.applicants a
    WHERE a.id = _applicant_id AND (
      public.is_recruitment_lead(_uid)
      OR a.primary_reviewer_user_id = _uid
      OR (a.routed_cohort_id IS NOT NULL AND public.is_cohort_reviewer(_uid, a.routed_cohort_id))
    )
  );
$$;

-- Stage history trigger: initial insert => system event (changed_by=NULL, reason='initial submission')
CREATE OR REPLACE FUNCTION public.applicant_stage_history_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.applicant_stage_history (applicant_id, from_stage, to_stage, changed_by, reason)
    VALUES (NEW.id, NULL, NEW.current_stage, NULL, 'initial submission');
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' AND NEW.current_stage IS DISTINCT FROM OLD.current_stage THEN
    INSERT INTO public.applicant_stage_history (applicant_id, from_stage, to_stage, changed_by, reason)
    VALUES (NEW.id, OLD.current_stage, NEW.current_stage, auth.uid(), NULL);
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_applicants_stage_history ON public.applicants;
CREATE TRIGGER trg_applicants_stage_history
  AFTER INSERT OR UPDATE OF current_stage ON public.applicants
  FOR EACH ROW EXECUTE FUNCTION public.applicant_stage_history_trigger();

CREATE OR REPLACE FUNCTION public.applicant_set_submitted_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.submitted_at IS NULL THEN NEW.submitted_at := now(); END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_applicants_set_submitted_at ON public.applicants;
CREATE TRIGGER trg_applicants_set_submitted_at
  BEFORE INSERT ON public.applicants
  FOR EACH ROW EXECUTE FUNCTION public.applicant_set_submitted_at();

-- RLS
ALTER TABLE public.application_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.major_cohort_routing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applicants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applicant_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applicant_stage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applicant_resume_access_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_rate_limit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cycles_lead_all" ON public.application_cycles;
CREATE POLICY "cycles_lead_all" ON public.application_cycles FOR ALL TO authenticated
  USING (public.is_recruitment_lead(auth.uid())) WITH CHECK (public.is_recruitment_lead(auth.uid()));
DROP POLICY IF EXISTS "cycles_member_read" ON public.application_cycles;
CREATE POLICY "cycles_member_read" ON public.application_cycles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "routing_lead_all" ON public.major_cohort_routing;
CREATE POLICY "routing_lead_all" ON public.major_cohort_routing FOR ALL TO authenticated
  USING (public.is_recruitment_lead(auth.uid())) WITH CHECK (public.is_recruitment_lead(auth.uid()));
DROP POLICY IF EXISTS "routing_member_read" ON public.major_cohort_routing;
CREATE POLICY "routing_member_read" ON public.major_cohort_routing FOR SELECT TO authenticated USING (true);

-- Anonymous public submission allowed (insert only). Reads gated by can_view_applicant.
DROP POLICY IF EXISTS "applicants_anon_insert" ON public.applicants;
CREATE POLICY "applicants_anon_insert" ON public.applicants FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "applicants_auth_insert" ON public.applicants;
CREATE POLICY "applicants_auth_insert" ON public.applicants FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "applicants_view" ON public.applicants;
CREATE POLICY "applicants_view" ON public.applicants FOR SELECT TO authenticated
  USING (public.can_view_applicant(auth.uid(), id));
-- Update narrowed: only recruitment leads can mutate applicant core via plain UPDATE.
-- Stage transitions are reserved for the upcoming 6B RPC path.
DROP POLICY IF EXISTS "applicants_lead_update" ON public.applicants;
CREATE POLICY "applicants_lead_update" ON public.applicants FOR UPDATE TO authenticated
  USING (public.is_recruitment_lead(auth.uid())) WITH CHECK (public.is_recruitment_lead(auth.uid()));
DROP POLICY IF EXISTS "applicants_lead_delete" ON public.applicants;
CREATE POLICY "applicants_lead_delete" ON public.applicants FOR DELETE TO authenticated
  USING (public.is_recruitment_lead(auth.uid()));

DROP POLICY IF EXISTS "reviews_view" ON public.applicant_reviews;
CREATE POLICY "reviews_view" ON public.applicant_reviews FOR SELECT TO authenticated
  USING (public.can_view_applicant(auth.uid(), applicant_id));
DROP POLICY IF EXISTS "reviews_self_insert" ON public.applicant_reviews;
CREATE POLICY "reviews_self_insert" ON public.applicant_reviews FOR INSERT TO authenticated
  WITH CHECK (reviewer_user_id = auth.uid() AND public.can_view_applicant(auth.uid(), applicant_id));
DROP POLICY IF EXISTS "reviews_self_update" ON public.applicant_reviews;
CREATE POLICY "reviews_self_update" ON public.applicant_reviews FOR UPDATE TO authenticated
  USING (reviewer_user_id = auth.uid()) WITH CHECK (reviewer_user_id = auth.uid());
DROP POLICY IF EXISTS "reviews_self_or_lead_delete" ON public.applicant_reviews;
CREATE POLICY "reviews_self_or_lead_delete" ON public.applicant_reviews FOR DELETE TO authenticated
  USING (public.is_recruitment_lead(auth.uid()) OR reviewer_user_id = auth.uid());

DROP POLICY IF EXISTS "stage_history_view" ON public.applicant_stage_history;
CREATE POLICY "stage_history_view" ON public.applicant_stage_history FOR SELECT TO authenticated
  USING (public.can_view_applicant(auth.uid(), applicant_id));

DROP POLICY IF EXISTS "resume_access_log_lead_view" ON public.applicant_resume_access_log;
CREATE POLICY "resume_access_log_lead_view" ON public.applicant_resume_access_log FOR SELECT TO authenticated
  USING (public.is_recruitment_lead(auth.uid()));

-- submission_rate_limit: no policies. Service role only (bypasses RLS).

-- Gated signed-URL helper. Returns the storage path; callers create the signed URL via
-- the storage client. Access is audited regardless.
CREATE OR REPLACE FUNCTION public.get_resume_signed_url(_applicant_id uuid, _expires_in_seconds int DEFAULT 300)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_path text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF NOT public.can_view_applicant(v_uid, _applicant_id) THEN
    RAISE EXCEPTION 'not authorized to view this applicant';
  END IF;
  SELECT resume_storage_path INTO v_path FROM public.applicants WHERE id = _applicant_id;
  IF v_path IS NULL THEN RAISE EXCEPTION 'resume not found'; END IF;
  INSERT INTO public.applicant_resume_access_log (applicant_id, accessed_by, expires_at)
  VALUES (_applicant_id, v_uid, now() + make_interval(secs => _expires_in_seconds));
  RETURN v_path;
END;
$$;
REVOKE ALL ON FUNCTION public.get_resume_signed_url(uuid, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_resume_signed_url(uuid, int) TO authenticated;

-- Storage bucket: private. Tightly scoped deny for authenticated direct access ONLY to this bucket.
-- Service role bypasses RLS so service-role uploads/downloads still work, and other buckets are unaffected.
INSERT INTO storage.buckets (id, name, public)
VALUES ('applicant-resumes', 'applicant-resumes', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "applicant_resumes_block_authenticated_select" ON storage.objects;
CREATE POLICY "applicant_resumes_block_authenticated_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id <> 'applicant-resumes');
DROP POLICY IF EXISTS "applicant_resumes_block_authenticated_insert" ON storage.objects;
CREATE POLICY "applicant_resumes_block_authenticated_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id <> 'applicant-resumes');
DROP POLICY IF EXISTS "applicant_resumes_block_authenticated_update" ON storage.objects;
CREATE POLICY "applicant_resumes_block_authenticated_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id <> 'applicant-resumes') WITH CHECK (bucket_id <> 'applicant-resumes');
DROP POLICY IF EXISTS "applicant_resumes_block_authenticated_delete" ON storage.objects;
CREATE POLICY "applicant_resumes_block_authenticated_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id <> 'applicant-resumes');

-- Major routing seeds. Fail loudly if cohorts not found.
DO $$
DECLARE hw uuid; sw uuid; me uuid; ops uuid;
BEGIN
  SELECT id INTO hw FROM public.cohorts WHERE name = 'Hardware / Systems / Embedded';
  SELECT id INTO sw FROM public.cohorts WHERE name = 'Software / Systems';
  SELECT id INTO me FROM public.cohorts WHERE name = 'Mechanical / Manufacturing';
  SELECT id INTO ops FROM public.cohorts WHERE name = 'Ops / PM';
  IF hw IS NULL OR sw IS NULL OR me IS NULL OR ops IS NULL THEN
    RAISE EXCEPTION 'major_cohort_routing seed failed: missing cohort (HW=%, SW=%, ME=%, OPS=%)', hw, sw, me, ops;
  END IF;
  INSERT INTO public.major_cohort_routing (major, cohort_id) VALUES
    ('Computer Engineering', hw),
    ('Electrical Engineering', hw),
    ('Computer Science', sw),
    ('Software Engineering', sw),
    ('Mechanical Engineering', me),
    ('Manufacturing Engineering', me),
    ('Industrial Engineering', me),
    ('Industrial Technology and Packaging', ops),
    ('Business Administration', ops),
    ('Economics', ops)
  ON CONFLICT (major) DO NOTHING;
END $$;