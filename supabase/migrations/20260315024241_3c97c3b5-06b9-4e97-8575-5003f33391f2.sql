
-- Project stages for mock project lifecycle enforcement
CREATE TABLE public.project_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mock_project_id uuid NOT NULL REFERENCES public.mock_projects(id) ON DELETE CASCADE,
  name text NOT NULL, -- kickoff, discovery, midpoint, final, retro
  order_index integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'locked', -- locked, active, completed
  due_date date,
  required_deliverables jsonb DEFAULT '[]'::jsonb,
  unlocked_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.project_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ps_select" ON public.project_stages FOR SELECT USING (
  EXISTS (SELECT 1 FROM cohort_memberships cm JOIN mock_projects mp ON mp.cohort_id = cm.cohort_id WHERE mp.id = project_stages.mock_project_id AND cm.user_id = auth.uid())
  OR is_admin(auth.uid())
);
CREATE POLICY "ps_manage" ON public.project_stages FOR ALL USING (
  EXISTS (SELECT 1 FROM cohort_memberships cm JOIN mock_projects mp ON mp.cohort_id = cm.cohort_id WHERE mp.id = project_stages.mock_project_id AND cm.user_id = auth.uid() AND cm.role IN ('pm','lead','integration_lead'))
  OR is_admin(auth.uid())
);

-- Help requests
CREATE TABLE public.help_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL,
  cohort_id uuid REFERENCES public.cohorts(id),
  step_id uuid REFERENCES public.lab_steps(id),
  subject text NOT NULL,
  body text DEFAULT '',
  status text NOT NULL DEFAULT 'open', -- open, assigned, resolved
  assigned_to uuid,
  resolution text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

ALTER TABLE public.help_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hr_select" ON public.help_requests FOR SELECT USING (
  auth.uid() = requester_id OR auth.uid() = assigned_to OR is_admin(auth.uid())
  OR EXISTS (SELECT 1 FROM cohort_memberships cm WHERE cm.cohort_id = help_requests.cohort_id AND cm.user_id = auth.uid() AND cm.role IN ('pm','lead','integration_lead'))
);
CREATE POLICY "hr_insert" ON public.help_requests FOR INSERT WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "hr_update" ON public.help_requests FOR UPDATE USING (
  auth.uid() = requester_id OR auth.uid() = assigned_to OR is_admin(auth.uid())
  OR EXISTS (SELECT 1 FROM cohort_memberships cm WHERE cm.cohort_id = help_requests.cohort_id AND cm.user_id = auth.uid() AND cm.role IN ('pm','lead','integration_lead'))
);

-- Knowledge cards (from resolved help requests)
CREATE TABLE public.knowledge_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  help_request_id uuid REFERENCES public.help_requests(id),
  cohort_id uuid REFERENCES public.cohorts(id),
  title text NOT NULL,
  solution text NOT NULL,
  tags text[] DEFAULT '{}',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.knowledge_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kc_select" ON public.knowledge_cards FOR SELECT USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid()) OR is_admin(auth.uid())
);
CREATE POLICY "kc_manage" ON public.knowledge_cards FOR ALL USING (
  auth.uid() = created_by OR is_admin(auth.uid())
);

-- Documents (internal editor docs)
CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text DEFAULT '',
  doc_type text NOT NULL DEFAULT 'general', -- charter, report, research, decision_log, risk_log
  project_id uuid REFERENCES public.projects(id),
  mock_project_id uuid REFERENCES public.mock_projects(id),
  cohort_id uuid REFERENCES public.cohorts(id),
  folder_id uuid,
  author_id uuid NOT NULL,
  version integer NOT NULL DEFAULT 1,
  visibility text NOT NULL DEFAULT 'internal', -- internal, client, public
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "doc_select" ON public.documents FOR SELECT USING (
  auth.uid() = author_id
  OR is_admin(auth.uid())
  OR (project_id IS NOT NULL AND is_project_member(auth.uid(), project_id))
  OR (cohort_id IS NOT NULL AND EXISTS (SELECT 1 FROM cohort_memberships cm WHERE cm.cohort_id = documents.cohort_id AND cm.user_id = auth.uid()))
);
CREATE POLICY "doc_insert" ON public.documents FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "doc_update" ON public.documents FOR UPDATE USING (auth.uid() = author_id OR is_admin(auth.uid()));

-- Folders
CREATE TABLE public.folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  parent_id uuid REFERENCES public.folders(id),
  project_id uuid REFERENCES public.projects(id),
  mock_project_id uuid REFERENCES public.mock_projects(id),
  cohort_id uuid REFERENCES public.cohorts(id),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "folder_select" ON public.folders FOR SELECT USING (
  is_admin(auth.uid())
  OR (project_id IS NOT NULL AND is_project_member(auth.uid(), project_id))
  OR (cohort_id IS NOT NULL AND EXISTS (SELECT 1 FROM cohort_memberships cm WHERE cm.cohort_id = folders.cohort_id AND cm.user_id = auth.uid()))
);
CREATE POLICY "folder_manage" ON public.folders FOR ALL USING (auth.uid() = created_by OR is_admin(auth.uid()));

-- Add foreign key for documents.folder_id
ALTER TABLE public.documents ADD CONSTRAINT documents_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES public.folders(id);

-- Seed default project stages for existing mock projects
INSERT INTO public.project_stages (mock_project_id, name, order_index, status)
SELECT mp.id, stage.name, stage.idx, CASE WHEN stage.idx = 0 THEN 'active' ELSE 'locked' END
FROM public.mock_projects mp
CROSS JOIN (VALUES ('Kickoff', 0), ('Discovery', 1), ('Midpoint', 2), ('Final', 3), ('Retro', 4)) AS stage(name, idx)
ON CONFLICT DO NOTHING;
