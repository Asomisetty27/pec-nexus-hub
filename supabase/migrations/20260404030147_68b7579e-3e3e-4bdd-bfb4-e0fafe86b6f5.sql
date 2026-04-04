
-- 1. Project mode enum and columns
DO $$ BEGIN
  CREATE TYPE public.project_mode AS ENUM ('training_mock','internal_initiative','competition','client_engagement','sponsor_deliverable');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.visibility_scope AS ENUM ('internal_only','client_visible','mixed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS project_mode public.project_mode NOT NULL DEFAULT 'training_mock',
  ADD COLUMN IF NOT EXISTS visibility_scope public.visibility_scope NOT NULL DEFAULT 'internal_only',
  ADD COLUMN IF NOT EXISTS requires_client_gate boolean NOT NULL DEFAULT false;

-- 2. Deliverables enhancements
DO $$ BEGIN
  CREATE TYPE public.approval_status AS ENUM ('pending','approved','rejected','revision_requested');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.deliverables
  ADD COLUMN IF NOT EXISTS owner_id uuid,
  ADD COLUMN IF NOT EXISTS stage_id uuid REFERENCES public.project_stages(id),
  ADD COLUMN IF NOT EXISTS required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS approval_required boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS approval_status public.approval_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS due_date date;

-- 3. Availability windows
CREATE TABLE IF NOT EXISTS public.availability_windows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  preference_weight smallint NOT NULL DEFAULT 3 CHECK (preference_weight BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

ALTER TABLE public.availability_windows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "aw_own" ON public.availability_windows FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "aw_admin" ON public.availability_windows FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "aw_cohort_lead" ON public.availability_windows FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.cohort_memberships cm1
    JOIN public.cohort_memberships cm2 ON cm1.cohort_id = cm2.cohort_id
    WHERE cm1.user_id = auth.uid()
      AND cm1.role IN ('pm','lead','integration_lead')
      AND cm2.user_id = availability_windows.user_id
  ));

-- 4. Meeting proposals
CREATE TABLE IF NOT EXISTS public.meeting_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposed_by uuid NOT NULL,
  cohort_id uuid REFERENCES public.cohorts(id),
  project_id uuid REFERENCES public.projects(id),
  candidate_time timestamptz NOT NULL,
  duration_minutes smallint NOT NULL DEFAULT 60,
  conflict_count smallint NOT NULL DEFAULT 0,
  attendance_score numeric NOT NULL DEFAULT 0,
  explanation text DEFAULT '',
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.meeting_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mp_manage" ON public.meeting_proposals FOR ALL
  USING (
    auth.uid() = proposed_by
    OR public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.cohort_memberships cm
      WHERE cm.cohort_id = meeting_proposals.cohort_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('pm','lead','integration_lead')
    )
  );

CREATE POLICY "mp_select" ON public.meeting_proposals FOR SELECT
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.cohort_memberships cm
      WHERE cm.cohort_id = meeting_proposals.cohort_id
        AND cm.user_id = auth.uid()
    )
  );

-- 5. Ops tasks
CREATE TABLE IF NOT EXISTS public.ops_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignee_id uuid,
  cohort_id uuid REFERENCES public.cohorts(id),
  title text NOT NULL,
  description text DEFAULT '',
  category text NOT NULL DEFAULT 'planning',
  status text NOT NULL DEFAULT 'todo',
  due_date date,
  priority text NOT NULL DEFAULT 'medium',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ops_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ot_manage" ON public.ops_tasks FOR ALL
  USING (
    public.is_admin(auth.uid())
    OR auth.uid() = created_by
    OR auth.uid() = assignee_id
    OR EXISTS (
      SELECT 1 FROM public.cohort_memberships cm
      WHERE cm.cohort_id = ops_tasks.cohort_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('pm','lead')
    )
  );

CREATE POLICY "ot_select" ON public.ops_tasks FOR SELECT
  USING (
    public.is_admin(auth.uid())
    OR auth.uid() = assignee_id
    OR auth.uid() = created_by
    OR EXISTS (
      SELECT 1 FROM public.cohort_memberships cm
      WHERE cm.cohort_id = ops_tasks.cohort_id
        AND cm.user_id = auth.uid()
    )
  );

-- 6. Client contacts
CREATE TABLE IF NOT EXISTS public.client_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id),
  org_id uuid REFERENCES public.organizations(id),
  name text NOT NULL,
  email text,
  phone text,
  role_title text DEFAULT '',
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cc_select" ON public.client_contacts FOR SELECT
  USING (
    public.is_project_member(auth.uid(), project_id)
    OR public.is_admin(auth.uid())
  );

CREATE POLICY "cc_manage" ON public.client_contacts FOR ALL
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.project_memberships pm
      WHERE pm.project_id = client_contacts.project_id
        AND pm.user_id = auth.uid()
        AND pm.role_on_project = 'lead'
    )
  );

-- 7. Cohort roster identity_status
ALTER TABLE public.cohort_roster
  ADD COLUMN IF NOT EXISTS identity_status text NOT NULL DEFAULT 'pending';

-- 8. Audit logs INSERT policy for authenticated users
CREATE POLICY "al_insert_auth" ON public.audit_logs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- 9. Indexes
CREATE INDEX IF NOT EXISTS idx_availability_user ON public.availability_windows(user_id);
CREATE INDEX IF NOT EXISTS idx_meeting_proposals_cohort ON public.meeting_proposals(cohort_id);
CREATE INDEX IF NOT EXISTS idx_ops_tasks_assignee ON public.ops_tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_ops_tasks_status ON public.ops_tasks(status);
CREATE INDEX IF NOT EXISTS idx_client_contacts_project ON public.client_contacts(project_id);
CREATE INDEX IF NOT EXISTS idx_deliverables_stage ON public.deliverables(stage_id);
CREATE INDEX IF NOT EXISTS idx_deliverables_owner ON public.deliverables(owner_id);
