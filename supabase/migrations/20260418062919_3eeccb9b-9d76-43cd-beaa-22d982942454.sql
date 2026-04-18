-- ============================================================
-- PART 1: TEMPLATES SCHEMA
-- ============================================================

CREATE TABLE IF NOT EXISTS public.project_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  engagement_type text NOT NULL DEFAULT 'purpose', -- purpose, competition, contract, training_mock
  project_mode project_mode NOT NULL DEFAULT 'training_mock',
  cohort_scope text NOT NULL DEFAULT 'any', -- any, hardware, software, mechanical, ops
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.template_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.project_templates(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text DEFAULT '',
  order_index int NOT NULL DEFAULT 0,
  default_duration_days int NOT NULL DEFAULT 14,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.template_deliverables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.project_templates(id) ON DELETE CASCADE,
  stage_order_index int NOT NULL DEFAULT 0,
  title text NOT NULL,
  description text DEFAULT '',
  required boolean NOT NULL DEFAULT true,
  approval_required boolean NOT NULL DEFAULT true,
  default_owner_role text DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_template_stages_template ON public.template_stages(template_id, order_index);
CREATE INDEX IF NOT EXISTS idx_template_deliverables_template ON public.template_deliverables(template_id, stage_order_index);

ALTER TABLE public.project_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_deliverables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "templates_select_members" ON public.project_templates FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "templates_admin" ON public.project_templates FOR ALL USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "template_stages_select_members" ON public.template_stages FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "template_stages_admin" ON public.template_stages FOR ALL USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "template_deliverables_select_members" ON public.template_deliverables FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "template_deliverables_admin" ON public.template_deliverables FOR ALL USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- Add milestones table reference for deliverable->stage mapping (deliverables.stage_id already exists but referenced milestones; we use it directly)
-- Add stages table for "real" projects (projects table currently has no stages of its own; use milestones as stages)
-- We'll model stages using the existing milestones table to avoid schema explosion.

-- ============================================================
-- PART 2: SEED 4 BASE TEMPLATES
-- ============================================================

INSERT INTO public.project_templates (id, name, description, engagement_type, project_mode, cohort_scope) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Mock Training Project', 'Standard 6-stage training engagement for cohort onboarding.', 'purpose', 'training_mock', 'any'),
  ('22222222-2222-2222-2222-222222222222', 'Competition Engagement', 'External competition lifecycle: scoping, build, submission, retro.', 'competition', 'competition', 'any'),
  ('33333333-3333-3333-3333-333333333333', 'Client Contract', 'Paid client engagement: intake, scope, delivery, review, close.', 'contract', 'client_engagement', 'any'),
  ('44444444-4444-4444-4444-444444444444', 'Purpose Track Initiative', 'Internal R&D initiative tied to a cohort purpose track.', 'purpose', 'internal_initiative', 'any')
ON CONFLICT (id) DO NOTHING;

-- Mock Training stages (matches existing structure)
INSERT INTO public.template_stages (template_id, name, description, order_index, default_duration_days) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Kickoff', 'Align on goals, roles, and scope.', 0, 7),
  ('11111111-1111-1111-1111-111111111111', 'Discovery', 'Research, requirements, constraints.', 1, 14),
  ('11111111-1111-1111-1111-111111111111', 'Direction', 'Concept selection and approach.', 2, 14),
  ('11111111-1111-1111-1111-111111111111', 'Build', 'Detailed design and implementation.', 3, 21),
  ('11111111-1111-1111-1111-111111111111', 'Final Delivery', 'Demo, documentation, handoff.', 4, 14),
  ('11111111-1111-1111-1111-111111111111', 'Retro', 'Lessons learned and knowledge capture.', 5, 7);

-- Mock Training deliverables (generic, work for any cohort)
INSERT INTO public.template_deliverables (template_id, stage_order_index, title, description, required, approval_required, default_owner_role) VALUES
  ('11111111-1111-1111-1111-111111111111', 0, 'Kickoff Doc', 'Goals, scope, team, success metrics.', true, true, 'lead'),
  ('11111111-1111-1111-1111-111111111111', 0, 'Roles & Responsibilities', 'Who owns what.', true, true, 'lead'),
  ('11111111-1111-1111-1111-111111111111', 1, 'Research Brief', 'Background research and findings.', true, true, 'member'),
  ('11111111-1111-1111-1111-111111111111', 1, 'Requirements Doc', 'Functional and constraint requirements.', true, true, 'member'),
  ('11111111-1111-1111-1111-111111111111', 2, 'Concept Selection', 'Chosen direction with rationale.', true, true, 'lead'),
  ('11111111-1111-1111-1111-111111111111', 2, 'Decision Log', 'Key decisions and trade-offs.', true, false, 'lead'),
  ('11111111-1111-1111-1111-111111111111', 3, 'Detailed Design', 'Full design artifact (CAD, code, plan).', true, true, 'member'),
  ('11111111-1111-1111-1111-111111111111', 3, 'Build Progress Update', 'Mid-build status check.', true, true, 'member'),
  ('11111111-1111-1111-1111-111111111111', 4, 'Final Demo', 'Working demo or final artifact.', true, true, 'member'),
  ('11111111-1111-1111-1111-111111111111', 4, 'Final Documentation', 'User-facing docs and handoff materials.', true, true, 'member'),
  ('11111111-1111-1111-1111-111111111111', 5, 'Retro Report', 'What worked, what did not, lessons.', true, false, 'lead');

-- Competition template (lighter)
INSERT INTO public.template_stages (template_id, name, description, order_index, default_duration_days) VALUES
  ('22222222-2222-2222-2222-222222222222', 'Scoping', 'Read brief, decide to compete.', 0, 5),
  ('22222222-2222-2222-2222-222222222222', 'Build', 'Develop the entry.', 1, 21),
  ('22222222-2222-2222-2222-222222222222', 'Submission', 'Final entry submitted.', 2, 3),
  ('22222222-2222-2222-2222-222222222222', 'Retro', 'Post-results debrief.', 3, 7);

INSERT INTO public.template_deliverables (template_id, stage_order_index, title, description, required, approval_required, default_owner_role) VALUES
  ('22222222-2222-2222-2222-222222222222', 0, 'Competition Brief Summary', 'What we are competing on.', true, true, 'lead'),
  ('22222222-2222-2222-2222-222222222222', 1, 'Working Prototype', 'Functional entry artifact.', true, true, 'member'),
  ('22222222-2222-2222-2222-222222222222', 2, 'Final Submission', 'Submitted entry with all required materials.', true, true, 'lead'),
  ('22222222-2222-2222-2222-222222222222', 3, 'Retro Report', 'Lessons learned.', true, false, 'lead');

-- Contract template
INSERT INTO public.template_stages (template_id, name, description, order_index, default_duration_days) VALUES
  ('33333333-3333-3333-3333-333333333333', 'Intake', 'Client kickoff and goal alignment.', 0, 7),
  ('33333333-3333-3333-3333-333333333333', 'Scope', 'Statement of work signed.', 1, 7),
  ('33333333-3333-3333-3333-333333333333', 'Delivery', 'Build and deliver work.', 2, 28),
  ('33333333-3333-3333-3333-333333333333', 'Review', 'Client review and revisions.', 3, 14),
  ('33333333-3333-3333-3333-333333333333', 'Close', 'Handoff and contract close.', 4, 7);

INSERT INTO public.template_deliverables (template_id, stage_order_index, title, description, required, approval_required, default_owner_role) VALUES
  ('33333333-3333-3333-3333-333333333333', 0, 'Intake Notes', 'Client goals and constraints.', true, true, 'lead'),
  ('33333333-3333-3333-3333-333333333333', 1, 'Statement of Work', 'Signed SOW.', true, true, 'lead'),
  ('33333333-3333-3333-3333-333333333333', 2, 'Mid-Project Update', 'Client-facing status.', true, true, 'member'),
  ('33333333-3333-3333-3333-333333333333', 2, 'Final Deliverable', 'Primary contract output.', true, true, 'member'),
  ('33333333-3333-3333-3333-333333333333', 3, 'Client Review Notes', 'Feedback captured.', true, false, 'lead'),
  ('33333333-3333-3333-3333-333333333333', 4, 'Close-Out Report', 'Final handoff and learnings.', true, true, 'lead');

-- Purpose Track template
INSERT INTO public.template_stages (template_id, name, description, order_index, default_duration_days) VALUES
  ('44444444-4444-4444-4444-444444444444', 'Thesis', 'Define the problem and hypothesis.', 0, 14),
  ('44444444-4444-4444-4444-444444444444', 'Research', 'Literature, prior art, baseline.', 1, 21),
  ('44444444-4444-4444-4444-444444444444', 'Development', 'Build the work.', 2, 30),
  ('44444444-4444-4444-4444-444444444444', 'Validation', 'Test and verify.', 3, 14),
  ('44444444-4444-4444-4444-444444444444', 'Knowledge Transfer', 'Document and share.', 4, 14);

INSERT INTO public.template_deliverables (template_id, stage_order_index, title, description, required, approval_required, default_owner_role) VALUES
  ('44444444-4444-4444-4444-444444444444', 0, 'Thesis Statement', 'Problem and approach.', true, true, 'lead'),
  ('44444444-4444-4444-4444-444444444444', 1, 'Research Brief', 'Findings summary.', true, true, 'member'),
  ('44444444-4444-4444-4444-444444444444', 2, 'Development Artifact', 'Primary work product.', true, true, 'member'),
  ('44444444-4444-4444-4444-444444444444', 3, 'Validation Report', 'Test results.', true, true, 'member'),
  ('44444444-4444-4444-4444-444444444444', 4, 'Knowledge Card', 'Shareable lessons.', true, false, 'lead');

-- ============================================================
-- PART 3: DB FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_project_from_template(
  p_template_id uuid,
  p_name text,
  p_cohort_id uuid DEFAULT NULL,
  p_description text DEFAULT ''
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_id uuid;
  v_template RECORD;
  v_stage RECORD;
  v_deliv RECORD;
  v_milestone_id uuid;
  v_start_date date := CURRENT_DATE;
  v_running_date date := CURRENT_DATE;
BEGIN
  IF NOT (is_admin(auth.uid()) OR EXISTS (
    SELECT 1 FROM cohort_memberships
    WHERE user_id = auth.uid() AND role IN ('pm','lead','integration_lead')
  )) THEN
    RAISE EXCEPTION 'Only admins, PMs, or leads can create projects from templates';
  END IF;

  SELECT * INTO v_template FROM project_templates WHERE id = p_template_id;
  IF v_template IS NULL THEN
    RAISE EXCEPTION 'Template not found';
  END IF;

  INSERT INTO projects (name, description, status, project_mode, created_by, start_date)
  VALUES (p_name, p_description, 'active', v_template.project_mode, auth.uid(), v_start_date)
  RETURNING id INTO v_project_id;

  -- Create milestones (stages) and deliverables
  FOR v_stage IN
    SELECT * FROM template_stages WHERE template_id = p_template_id ORDER BY order_index
  LOOP
    v_running_date := v_running_date + v_stage.default_duration_days;
    INSERT INTO milestones (project_id, title, description, due_date, status, progress)
    VALUES (v_project_id, v_stage.name, v_stage.description, v_running_date,
            CASE WHEN v_stage.order_index = 0 THEN 'in_progress' ELSE 'not_started' END, 0)
    RETURNING id INTO v_milestone_id;

    FOR v_deliv IN
      SELECT * FROM template_deliverables
      WHERE template_id = p_template_id AND stage_order_index = v_stage.order_index
    LOOP
      INSERT INTO deliverables (
        project_id, milestone_id, title, description, required, approval_required,
        approval_status, created_by, due_date, engagement_type
      ) VALUES (
        v_project_id, v_milestone_id, v_deliv.title, v_deliv.description,
        v_deliv.required, v_deliv.approval_required, 'pending', auth.uid(), v_running_date,
        v_template.engagement_type
      );
    END LOOP;
  END LOOP;

  -- Add creator as lead
  INSERT INTO project_memberships (project_id, user_id, role_on_project)
  VALUES (v_project_id, auth.uid(), 'lead')
  ON CONFLICT DO NOTHING;

  -- Auto-seed cohort members if cohort provided
  IF p_cohort_id IS NOT NULL THEN
    INSERT INTO project_memberships (project_id, user_id, role_on_project)
    SELECT v_project_id, cm.user_id,
           CASE WHEN cm.role IN ('pm','lead','integration_lead') THEN 'lead' ELSE 'member' END
    FROM cohort_memberships cm
    WHERE cm.cohort_id = p_cohort_id AND cm.user_id != auth.uid()
    ON CONFLICT DO NOTHING;
  END IF;

  -- Audit
  INSERT INTO audit_logs (user_id, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'project.created_from_template', 'project', v_project_id,
          jsonb_build_object('template_id', p_template_id, 'template_name', v_template.name));

  RETURN v_project_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_project_from_template(uuid, text, uuid, text) TO authenticated;

-- Backfill function: assign cohort roster members to an existing project
CREATE OR REPLACE FUNCTION public.seed_project_memberships_from_cohort(
  p_project_id uuid,
  p_cohort_id uuid
) RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count int;
BEGIN
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;
  WITH inserted AS (
    INSERT INTO project_memberships (project_id, user_id, role_on_project)
    SELECT p_project_id, cm.user_id,
           CASE WHEN cm.role IN ('pm','lead','integration_lead') THEN 'lead' ELSE 'member' END
    FROM cohort_memberships cm
    WHERE cm.cohort_id = p_cohort_id
    ON CONFLICT DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM inserted;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.seed_project_memberships_from_cohort(uuid, uuid) TO authenticated;

-- ============================================================
-- PART 4: BACKFILL HARDWARE PROJECT (the only missing one in projects table)
-- ============================================================

-- Hardware project did not exist in projects table. Create it.
INSERT INTO projects (id, name, description, status, project_mode, created_by, start_date)
SELECT
  'aa000001-bbbb-cccc-dddd-eeeeeeeeee04'::uuid,
  'Smart Study Room Monitor & Booking Display',
  'Hardware/embedded training project: occupancy sensing, booking display, and integration.',
  'active',
  'training_mock'::project_mode,
  (SELECT user_id FROM user_roles WHERE role = 'superadmin' LIMIT 1),
  CURRENT_DATE
WHERE NOT EXISTS (SELECT 1 FROM projects WHERE id = 'aa000001-bbbb-cccc-dddd-eeeeeeeeee04'::uuid)
  AND EXISTS (SELECT 1 FROM user_roles WHERE role = 'superadmin');

-- Hardware milestones (stages) — 6 to match other cohorts
INSERT INTO milestones (project_id, title, description, due_date, status, progress)
SELECT 'aa000001-bbbb-cccc-dddd-eeeeeeeeee04'::uuid, name, description, due, status, 0
FROM (VALUES
  ('Kickoff', 'Align on system goals, sensors, display, and integration plan.', CURRENT_DATE + 7, 'in_progress'::milestone_status),
  ('Discovery', 'Sensor research, occupancy detection approaches, display options.', CURRENT_DATE + 21, 'not_started'::milestone_status),
  ('System Design', 'Architecture, BOM, schematic, firmware plan.', CURRENT_DATE + 35, 'not_started'::milestone_status),
  ('Integration Build', 'Hardware bring-up, firmware, display UI, calibration.', CURRENT_DATE + 56, 'not_started'::milestone_status),
  ('Final System', 'End-to-end demo with booking integration.', CURRENT_DATE + 70, 'not_started'::milestone_status),
  ('Retro', 'Reliability review, lessons, knowledge transfer.', CURRENT_DATE + 77, 'not_started'::milestone_status)
) AS t(name, description, due, status)
WHERE EXISTS (SELECT 1 FROM projects WHERE id = 'aa000001-bbbb-cccc-dddd-eeeeeeeeee04'::uuid)
  AND NOT EXISTS (SELECT 1 FROM milestones WHERE project_id = 'aa000001-bbbb-cccc-dddd-eeeeeeeeee04'::uuid);

-- Hardware deliverables (~20)
DO $$
DECLARE
  v_proj uuid := 'aa000001-bbbb-cccc-dddd-eeeeeeeeee04'::uuid;
  v_creator uuid;
  v_kickoff uuid; v_disc uuid; v_design uuid; v_build uuid; v_final uuid; v_retro uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM projects WHERE id = v_proj) THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM deliverables WHERE project_id = v_proj) THEN RETURN; END IF;

  SELECT created_by INTO v_creator FROM projects WHERE id = v_proj;
  SELECT id INTO v_kickoff FROM milestones WHERE project_id = v_proj AND title = 'Kickoff';
  SELECT id INTO v_disc FROM milestones WHERE project_id = v_proj AND title = 'Discovery';
  SELECT id INTO v_design FROM milestones WHERE project_id = v_proj AND title = 'System Design';
  SELECT id INTO v_build FROM milestones WHERE project_id = v_proj AND title = 'Integration Build';
  SELECT id INTO v_final FROM milestones WHERE project_id = v_proj AND title = 'Final System';
  SELECT id INTO v_retro FROM milestones WHERE project_id = v_proj AND title = 'Retro';

  INSERT INTO deliverables (project_id, milestone_id, title, description, required, approval_required, approval_status, created_by, due_date, engagement_type) VALUES
    (v_proj, v_kickoff, 'Kickoff Doc', 'Goals, scope, sensors-vs-display split.', true, true, 'pending', v_creator, CURRENT_DATE + 7, 'purpose'),
    (v_proj, v_kickoff, 'Roles & Workstreams', 'Who owns sensors, who owns display, who owns integration.', true, true, 'pending', v_creator, CURRENT_DATE + 7, 'purpose'),
    (v_proj, v_kickoff, 'Risk Register v0', 'Initial known risks (PIR false positives, display refresh, etc.).', false, false, 'pending', v_creator, CURRENT_DATE + 7, 'purpose'),

    (v_proj, v_disc, 'Sensor Comparison Brief', 'PIR vs mmWave vs ToF — pros/cons and chosen approach.', true, true, 'pending', v_creator, CURRENT_DATE + 18, 'purpose'),
    (v_proj, v_disc, 'Display Technology Brief', 'E-ink vs OLED vs LCD trade study.', true, true, 'pending', v_creator, CURRENT_DATE + 18, 'purpose'),
    (v_proj, v_disc, 'Booking Integration Research', 'How to read room-booking data (calendar API or local).', true, true, 'pending', v_creator, CURRENT_DATE + 21, 'purpose'),

    (v_proj, v_design, 'System Architecture Diagram', 'Block diagram with sensors, MCU, display, network.', true, true, 'pending', v_creator, CURRENT_DATE + 28, 'purpose'),
    (v_proj, v_design, 'Bill of Materials v1', 'All components with sources and cost.', true, true, 'pending', v_creator, CURRENT_DATE + 30, 'purpose'),
    (v_proj, v_design, 'Schematic v1', 'Initial schematic for MCU + sensors + display.', true, true, 'pending', v_creator, CURRENT_DATE + 33, 'purpose'),
    (v_proj, v_design, 'Firmware Architecture Doc', 'Tasks, ISRs, state machines.', true, true, 'pending', v_creator, CURRENT_DATE + 35, 'purpose'),

    (v_proj, v_build, 'Hardware Bring-Up Report', 'Power, MCU, comms verified.', true, true, 'pending', v_creator, CURRENT_DATE + 42, 'purpose'),
    (v_proj, v_build, 'Sensor Calibration Notes', 'Occupancy threshold tuning, false-positive analysis.', true, true, 'pending', v_creator, CURRENT_DATE + 49, 'purpose'),
    (v_proj, v_build, 'Display UI Implementation', 'Working display showing occupancy + next booking.', true, true, 'pending', v_creator, CURRENT_DATE + 53, 'purpose'),
    (v_proj, v_build, 'Integration Test Results', 'End-to-end: sensor change → display update.', true, true, 'pending', v_creator, CURRENT_DATE + 56, 'purpose'),

    (v_proj, v_final, 'Final Demo Video', 'Working system in real room, 2 min walkthrough.', true, true, 'pending', v_creator, CURRENT_DATE + 65, 'purpose'),
    (v_proj, v_final, 'Final Documentation', 'User guide + maintainer guide.', true, true, 'pending', v_creator, CURRENT_DATE + 68, 'purpose'),
    (v_proj, v_final, 'Reliability Test Log', '24+ hour soak test results.', true, true, 'pending', v_creator, CURRENT_DATE + 70, 'purpose'),

    (v_proj, v_retro, 'Retro Report', 'What worked, what failed, lessons.', true, false, 'pending', v_creator, CURRENT_DATE + 77, 'purpose'),
    (v_proj, v_retro, 'Knowledge Cards', 'At least 3 reusable lessons captured.', true, false, 'pending', v_creator, CURRENT_DATE + 77, 'purpose');
END $$;

-- ============================================================
-- PART 5: AUTO-SEED MEMBERSHIPS FOR ALL 4 COHORT PROJECTS
-- ============================================================

DO $$
DECLARE
  r RECORD;
  v_cohort_id uuid;
BEGIN
  -- Map of project_id → cohort name
  FOR r IN
    SELECT * FROM (VALUES
      ('aa000001-bbbb-cccc-dddd-eeeeeeeeee01'::uuid, 'Software / Systems'),
      ('aa000001-bbbb-cccc-dddd-eeeeeeeeee02'::uuid, 'Mechanical / Manufacturing'),
      ('aa000001-bbbb-cccc-dddd-eeeeeeeeee03'::uuid, 'Ops / PM'),
      ('aa000001-bbbb-cccc-dddd-eeeeeeeeee04'::uuid, 'Hardware / Systems / Embedded')
    ) AS t(project_id, cohort_name)
  LOOP
    SELECT id INTO v_cohort_id FROM cohorts WHERE name = r.cohort_name LIMIT 1;
    IF v_cohort_id IS NULL THEN CONTINUE; END IF;
    IF NOT EXISTS (SELECT 1 FROM projects WHERE id = r.project_id) THEN CONTINUE; END IF;

    INSERT INTO project_memberships (project_id, user_id, role_on_project)
    SELECT r.project_id, cm.user_id,
           CASE WHEN cm.role IN ('pm','lead','integration_lead') THEN 'lead' ELSE 'member' END
    FROM cohort_memberships cm
    WHERE cm.cohort_id = v_cohort_id
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- updated_at trigger for templates
CREATE TRIGGER project_templates_updated_at BEFORE UPDATE ON public.project_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();