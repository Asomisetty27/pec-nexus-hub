-- Add lane to project_memberships
ALTER TABLE public.project_memberships ADD COLUMN IF NOT EXISTS lane text DEFAULT NULL;

-- Mock project memberships (lane-aware)
CREATE TABLE IF NOT EXISTS public.mock_project_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mock_project_id uuid NOT NULL REFERENCES public.mock_projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role_on_project text NOT NULL DEFAULT 'member',
  lane text DEFAULT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(mock_project_id, user_id)
);

ALTER TABLE public.mock_project_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mpm_select" ON public.mock_project_memberships FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM mock_project_memberships m2
      WHERE m2.mock_project_id = mock_project_memberships.mock_project_id
        AND m2.user_id = auth.uid()
    )
    OR is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM mock_projects mp
      JOIN cohort_memberships cm ON cm.cohort_id = mp.cohort_id
      WHERE mp.id = mock_project_memberships.mock_project_id
        AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "mpm_manage" ON public.mock_project_memberships FOR ALL
  USING (
    is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM mock_projects mp
      JOIN cohort_memberships cm ON cm.cohort_id = mp.cohort_id
      WHERE mp.id = mock_project_memberships.mock_project_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('pm', 'lead', 'integration_lead')
    )
  );

-- Review rubrics
CREATE TABLE IF NOT EXISTS public.review_rubrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mock_project_id uuid REFERENCES public.mock_projects(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  category text NOT NULL,
  weight smallint NOT NULL DEFAULT 1,
  description text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.review_rubrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rr_select" ON public.review_rubrics FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "rr_manage" ON public.review_rubrics FOR ALL
  USING (is_admin(auth.uid()));
