
-- Cohort training schema
CREATE TABLE public.cohorts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  icon TEXT DEFAULT 'cpu',
  color TEXT DEFAULT 'primary',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cohorts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cohorts_select" ON public.cohorts FOR SELECT USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid()));
CREATE POLICY "cohorts_manage_admin" ON public.cohorts FOR ALL USING (is_admin(auth.uid()));

CREATE TABLE public.cohort_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id UUID NOT NULL REFERENCES public.cohorts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(cohort_id, user_id)
);
ALTER TABLE public.cohort_memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cm2_select" ON public.cohort_memberships FOR SELECT USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid()));
CREATE POLICY "cm2_manage_admin" ON public.cohort_memberships FOR ALL USING (is_admin(auth.uid()));

CREATE TABLE public.mock_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id UUID NOT NULL REFERENCES public.cohorts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  scenario TEXT DEFAULT '',
  objectives TEXT DEFAULT '',
  deliverables_desc TEXT DEFAULT '',
  rubric JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.mock_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mp_select" ON public.mock_projects FOR SELECT USING (
  EXISTS (SELECT 1 FROM cohort_memberships WHERE cohort_id = mock_projects.cohort_id AND user_id = auth.uid())
  OR is_admin(auth.uid())
);
CREATE POLICY "mp_manage" ON public.mock_projects FOR ALL USING (
  EXISTS (SELECT 1 FROM cohort_memberships WHERE cohort_id = mock_projects.cohort_id AND user_id = auth.uid() AND role IN ('pm','lead','integration_lead'))
  OR is_admin(auth.uid())
);

CREATE TABLE public.lab_manuals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id UUID NOT NULL REFERENCES public.cohorts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.lab_manuals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lm_select" ON public.lab_manuals FOR SELECT USING (
  EXISTS (SELECT 1 FROM cohort_memberships WHERE cohort_id = lab_manuals.cohort_id AND user_id = auth.uid())
  OR is_admin(auth.uid())
);
CREATE POLICY "lm_manage" ON public.lab_manuals FOR ALL USING (
  EXISTS (SELECT 1 FROM cohort_memberships WHERE cohort_id = lab_manuals.cohort_id AND user_id = auth.uid() AND role IN ('pm','lead','integration_lead'))
  OR is_admin(auth.uid())
);

CREATE TABLE public.lab_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manual_id UUID NOT NULL REFERENCES public.lab_manuals(id) ON DELETE CASCADE,
  order_index INT NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  content TEXT DEFAULT '',
  templates JSONB DEFAULT '[]'::jsonb,
  required_submission_type TEXT DEFAULT 'link',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.lab_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ls_select" ON public.lab_steps FOR SELECT USING (
  EXISTS (SELECT 1 FROM lab_manuals lm JOIN cohort_memberships cm ON cm.cohort_id = lm.cohort_id WHERE lm.id = lab_steps.manual_id AND cm.user_id = auth.uid())
  OR is_admin(auth.uid())
);
CREATE POLICY "ls_manage" ON public.lab_steps FOR ALL USING (
  EXISTS (SELECT 1 FROM lab_manuals lm JOIN cohort_memberships cm ON cm.cohort_id = lm.cohort_id WHERE lm.id = lab_steps.manual_id AND cm.user_id = auth.uid() AND cm.role IN ('pm','lead','integration_lead'))
  OR is_admin(auth.uid())
);

CREATE TABLE public.tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id UUID NOT NULL REFERENCES public.cohorts(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'beginner'
);
ALTER TABLE public.tracks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tracks_select" ON public.tracks FOR SELECT USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid()));
CREATE POLICY "tracks_manage" ON public.tracks FOR ALL USING (is_admin(auth.uid()));

CREATE TABLE public.track_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  track_id UUID NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, track_id)
);
ALTER TABLE public.track_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ta_select_own" ON public.track_assignments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ta_select_admin" ON public.track_assignments FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY "ta_manage" ON public.track_assignments FOR ALL USING (is_admin(auth.uid()));

CREATE TABLE public.submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id UUID NOT NULL REFERENCES public.lab_steps(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT DEFAULT '',
  file_url TEXT,
  link_url TEXT,
  status TEXT NOT NULL DEFAULT 'submitted',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sub_select_own" ON public.submissions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "sub_insert_own" ON public.submissions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sub_update_own" ON public.submissions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "sub_select_reviewer" ON public.submissions FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM lab_steps ls
    JOIN lab_manuals lm ON lm.id = ls.manual_id
    JOIN cohort_memberships cm ON cm.cohort_id = lm.cohort_id
    WHERE ls.id = submissions.step_id AND cm.user_id = auth.uid() AND cm.role IN ('pm','lead','integration_lead')
  )
);
CREATE POLICY "sub_select_admin" ON public.submissions FOR SELECT USING (is_admin(auth.uid()));

CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL,
  rubric_scores JSONB DEFAULT '{}'::jsonb,
  comments TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'reviewed',
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rev_select_own" ON public.reviews FOR SELECT USING (
  EXISTS (SELECT 1 FROM submissions WHERE id = reviews.submission_id AND user_id = auth.uid())
);
CREATE POLICY "rev_manage_reviewer" ON public.reviews FOR ALL USING (auth.uid() = reviewer_id);
CREATE POLICY "rev_select_admin" ON public.reviews FOR SELECT USING (is_admin(auth.uid()));

CREATE TABLE public.badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  icon TEXT DEFAULT 'award',
  criteria TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "badges_select" ON public.badges FOR SELECT USING (true);
CREATE POLICY "badges_manage" ON public.badges FOR ALL USING (is_admin(auth.uid()));

CREATE TABLE public.user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  badge_id UUID NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, badge_id)
);
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ub_select_own" ON public.user_badges FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ub_select_all" ON public.user_badges FOR SELECT USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid()));
CREATE POLICY "ub_manage" ON public.user_badges FOR ALL USING (is_admin(auth.uid()));
