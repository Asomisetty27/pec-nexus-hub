
-- Enums
CREATE TYPE public.opportunity_type AS ENUM ('competition', 'contract');
CREATE TYPE public.opportunity_status AS ENUM ('intake', 'evaluating', 'approved', 'active', 'declined', 'completed', 'deferred');
CREATE TYPE public.purpose_phase AS ENUM ('thesis', 'research', 'development', 'validation', 'knowledge_transfer', 'roadmap_update');

-- Purpose Tracks
CREATE TABLE public.purpose_tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id uuid NOT NULL REFERENCES public.cohorts(id) ON DELETE CASCADE,
  title text NOT NULL,
  mission_statement text DEFAULT '',
  field_thesis text DEFAULT '',
  long_term_objective text DEFAULT '',
  why_it_matters text DEFAULT '',
  current_phase purpose_phase NOT NULL DEFAULT 'thesis',
  status text NOT NULL DEFAULT 'active',
  research_themes text[] DEFAULT '{}',
  development_themes text[] DEFAULT '{}',
  open_problems text[] DEFAULT '{}',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(cohort_id, status) -- one active purpose per cohort enforced via trigger
);

ALTER TABLE public.purpose_tracks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pt_select" ON public.purpose_tracks FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.cohort_memberships WHERE cohort_id = purpose_tracks.cohort_id AND user_id = auth.uid())
  OR is_admin(auth.uid())
);
CREATE POLICY "pt_manage" ON public.purpose_tracks FOR ALL USING (
  is_admin(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.cohort_memberships
    WHERE cohort_id = purpose_tracks.cohort_id AND user_id = auth.uid()
    AND role IN ('pm', 'lead', 'integration_lead')
  )
);

CREATE TRIGGER update_purpose_tracks_updated_at BEFORE UPDATE ON public.purpose_tracks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Purpose Milestones
CREATE TABLE public.purpose_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purpose_track_id uuid NOT NULL REFERENCES public.purpose_tracks(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  status text NOT NULL DEFAULT 'upcoming',
  target_date date,
  completed_at timestamptz,
  order_index int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.purpose_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pm_select" ON public.purpose_milestones FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.purpose_tracks pt
    JOIN public.cohort_memberships cm ON cm.cohort_id = pt.cohort_id
    WHERE pt.id = purpose_milestones.purpose_track_id AND cm.user_id = auth.uid()
  ) OR is_admin(auth.uid())
);
CREATE POLICY "pm_manage" ON public.purpose_milestones FOR ALL USING (
  is_admin(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.purpose_tracks pt
    JOIN public.cohort_memberships cm ON cm.cohort_id = pt.cohort_id
    WHERE pt.id = purpose_milestones.purpose_track_id AND cm.user_id = auth.uid()
    AND cm.role IN ('pm', 'lead', 'integration_lead')
  )
);

CREATE TRIGGER update_purpose_milestones_updated_at BEFORE UPDATE ON public.purpose_milestones
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Purpose Artifacts
CREATE TABLE public.purpose_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purpose_track_id uuid NOT NULL REFERENCES public.purpose_tracks(id) ON DELETE CASCADE,
  milestone_id uuid REFERENCES public.purpose_milestones(id) ON DELETE SET NULL,
  title text NOT NULL,
  artifact_type text NOT NULL DEFAULT 'document',
  content text DEFAULT '',
  file_url text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.purpose_artifacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pa_select" ON public.purpose_artifacts FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.purpose_tracks pt
    JOIN public.cohort_memberships cm ON cm.cohort_id = pt.cohort_id
    WHERE pt.id = purpose_artifacts.purpose_track_id AND cm.user_id = auth.uid()
  ) OR is_admin(auth.uid())
);
CREATE POLICY "pa_insert" ON public.purpose_artifacts FOR INSERT WITH CHECK (
  auth.uid() = created_by AND EXISTS (
    SELECT 1 FROM public.purpose_tracks pt
    JOIN public.cohort_memberships cm ON cm.cohort_id = pt.cohort_id
    WHERE pt.id = purpose_artifacts.purpose_track_id AND cm.user_id = auth.uid()
  )
);
CREATE POLICY "pa_manage_lead" ON public.purpose_artifacts FOR ALL USING (
  is_admin(auth.uid()) OR auth.uid() = created_by
);

-- Opportunities
CREATE TABLE public.opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type opportunity_type NOT NULL,
  title text NOT NULL,
  summary text DEFAULT '',
  source text DEFAULT '',
  deadline timestamptz,
  strategic_value int DEFAULT 5,
  effort_estimate text DEFAULT 'medium',
  alignment_tags text[] DEFAULT '{}',
  skill_requirements text[] DEFAULT '{}',
  recommended_cohort_id uuid REFERENCES public.cohorts(id),
  assigned_cohort_id uuid REFERENCES public.cohorts(id),
  status opportunity_status NOT NULL DEFAULT 'intake',
  decision_rationale text DEFAULT '',
  engagement_project_id uuid REFERENCES public.projects(id),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "opp_select" ON public.opportunities FOR SELECT USING (
  is_admin(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.cohort_memberships cm
    WHERE cm.user_id = auth.uid() AND cm.role IN ('pm', 'lead', 'integration_lead')
  ) OR (status IN ('approved', 'active', 'completed') AND auth.uid() IS NOT NULL)
);
CREATE POLICY "opp_manage" ON public.opportunities FOR ALL USING (
  is_admin(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.cohort_memberships cm
    WHERE cm.user_id = auth.uid() AND cm.role IN ('pm', 'lead', 'integration_lead')
  )
);

CREATE TRIGGER update_opportunities_updated_at BEFORE UPDATE ON public.opportunities
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Capacity Allocations
CREATE TABLE public.capacity_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id uuid NOT NULL REFERENCES public.cohorts(id) ON DELETE CASCADE,
  purpose_pct int NOT NULL DEFAULT 100,
  competition_pct int NOT NULL DEFAULT 0,
  contract_pct int NOT NULL DEFAULT 0,
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  set_by uuid NOT NULL,
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pct_sum CHECK (purpose_pct + competition_pct + contract_pct = 100)
);

ALTER TABLE public.capacity_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ca_select" ON public.capacity_allocations FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.cohort_memberships WHERE cohort_id = capacity_allocations.cohort_id AND user_id = auth.uid())
  OR is_admin(auth.uid())
);
CREATE POLICY "ca_manage" ON public.capacity_allocations FOR ALL USING (
  is_admin(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.cohort_memberships
    WHERE cohort_id = capacity_allocations.cohort_id AND user_id = auth.uid()
    AND role IN ('pm', 'lead', 'integration_lead')
  )
);

-- Add engagement_type to deliverables
ALTER TABLE public.deliverables ADD COLUMN engagement_type text DEFAULT 'purpose';
