-- Public-facing metrics for homepage credibility (admin-editable, source-of-truth table)
CREATE TABLE public.public_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_key text NOT NULL UNIQUE,
  label text NOT NULL,
  value text NOT NULL,
  subtitle text DEFAULT '',
  display_order integer NOT NULL DEFAULT 0,
  visible boolean NOT NULL DEFAULT true,
  source text NOT NULL DEFAULT 'manual', -- 'manual' or 'computed'
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.public_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY pm_select_public ON public.public_metrics
  FOR SELECT USING (visible = true);

CREATE POLICY pm_select_admin ON public.public_metrics
  FOR SELECT USING (is_admin(auth.uid()));

CREATE POLICY pm_manage_admin ON public.public_metrics
  FOR ALL USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

CREATE TRIGGER pm_updated_at
  BEFORE UPDATE ON public.public_metrics
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Seed truthful initial metrics (small but real, per the honesty rule)
INSERT INTO public.public_metrics (metric_key, label, value, subtitle, display_order, visible, source) VALUES
  ('active_cohorts', 'Active Cohorts', '4', 'Hardware · Software · Mechanical · Ops', 1, true, 'computed'),
  ('active_projects', 'Active Projects', '4', 'Across all cohorts', 2, true, 'computed'),
  ('engineering_disciplines', 'Engineering Disciplines', '6+', 'Mechanical, Electrical, Software, Systems, Manufacturing, Ops', 3, true, 'manual'),
  ('founded_year', 'Founded', '2024', 'Cal Poly San Luis Obispo', 4, true, 'manual');

-- Add fields to leads for stronger triage
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS contact_role text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS engagement_type text,
  ADD COLUMN IF NOT EXISTS timeline text,
  ADD COLUMN IF NOT EXISTS budget_range text,
  ADD COLUMN IF NOT EXISTS urgency text DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS recommended_cohort_id uuid;