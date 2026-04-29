
-- =====================================================================
-- PEC Operating System Rules v1
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. PROJECT GROUPS + GROUP CHANNELS
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.project_groups (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name         text NOT NULL,
  lead_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  archived     boolean NOT NULL DEFAULT false,
  archived_at  timestamptz,
  created_by   uuid NOT NULL REFERENCES auth.users(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_groups_project ON public.project_groups(project_id);

ALTER TABLE public.project_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pg_select_members" ON public.project_groups
  FOR SELECT USING (public.is_project_member(auth.uid(), project_id) OR public.is_admin(auth.uid()));

CREATE POLICY "pg_manage_leads" ON public.project_groups
  FOR ALL USING (public.is_project_lead(auth.uid(), project_id))
  WITH CHECK (public.is_project_lead(auth.uid(), project_id));

CREATE TRIGGER trg_project_groups_updated
  BEFORE UPDATE ON public.project_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE IF NOT EXISTS public.project_group_members (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    uuid NOT NULL REFERENCES public.project_groups(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_pgm_group ON public.project_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_pgm_user  ON public.project_group_members(user_id);

ALTER TABLE public.project_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pgm_select_members" ON public.project_group_members
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.project_groups g WHERE g.id = group_id AND
      (public.is_project_member(auth.uid(), g.project_id) OR public.is_admin(auth.uid())))
  );

CREATE POLICY "pgm_manage_leads" ON public.project_group_members
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.project_groups g WHERE g.id = group_id AND
      public.is_project_lead(auth.uid(), g.project_id))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.project_groups g WHERE g.id = group_id AND
      public.is_project_lead(auth.uid(), g.project_id))
  );

-- ---------------------------------------------------------------------
-- 2. CHANNEL EXTENSIONS + CLEANUP
-- ---------------------------------------------------------------------

ALTER TABLE public.channels
  ADD COLUMN IF NOT EXISTS channel_kind text NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS project_group_id uuid REFERENCES public.project_groups(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_channels_group ON public.channels(project_group_id);

-- Tag existing channels by kind for clean targeting
UPDATE public.channels SET channel_kind = 'announcements' WHERE is_org_wide = true;
UPDATE public.channels SET channel_kind = 'project'       WHERE project_id IS NOT NULL;
UPDATE public.channels SET channel_kind = 'help'          WHERE name LIKE '%-help';
UPDATE public.channels SET channel_kind = 'general'       WHERE name LIKE '%-general';

-- Hard delete redundant channels: -reviews, -decisions, *-cohort, leadership, board.
-- ON DELETE CASCADE on channel_members + manual delete on messages.
DELETE FROM public.messages
WHERE channel_id IN (
  SELECT id FROM public.channels
  WHERE name LIKE '%-reviews'
     OR name LIKE '%-decisions'
     OR name LIKE '%-cohort'
     OR name IN ('pms','tech-leads','pm-tech-leads','board')
);
DELETE FROM public.channel_members
WHERE channel_id IN (
  SELECT id FROM public.channels
  WHERE name LIKE '%-reviews'
     OR name LIKE '%-decisions'
     OR name LIKE '%-cohort'
     OR name IN ('pms','tech-leads','pm-tech-leads','board')
);
DELETE FROM public.channels
WHERE name LIKE '%-reviews'
   OR name LIKE '%-decisions'
   OR name LIKE '%-cohort'
   OR name IN ('pms','tech-leads','pm-tech-leads','board');

-- Replace channel-join helper: only general + help per cohort + announcements.
CREATE OR REPLACE FUNCTION public.join_user_to_default_channels(p_user_id uuid, p_cohort_name text, p_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_prefix text;
  v_channel record;
BEGIN
  v_prefix := CASE
    WHEN p_cohort_name ILIKE 'Hardware%'   THEN 'hardware'
    WHEN p_cohort_name ILIKE 'Software%'   THEN 'software'
    WHEN p_cohort_name ILIKE 'Mechanical%' THEN 'mech'
    WHEN p_cohort_name ILIKE 'Ops%'        THEN 'ops'
    ELSE NULL
  END;

  FOR v_channel IN SELECT id FROM public.channels WHERE is_org_wide = true LOOP
    INSERT INTO public.channel_members (channel_id, user_id)
    VALUES (v_channel.id, p_user_id) ON CONFLICT DO NOTHING;
  END LOOP;

  IF v_prefix IS NOT NULL THEN
    FOR v_channel IN
      SELECT id FROM public.channels
      WHERE name IN (v_prefix || '-general', v_prefix || '-help')
    LOOP
      INSERT INTO public.channel_members (channel_id, user_id)
      VALUES (v_channel.id, p_user_id) ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------
-- 3. AUTO-CREATE GROUP CHANNELS
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_channel_for_group()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_project_name text;
  v_channel_id uuid;
  v_channel_name text;
BEGIN
  SELECT name INTO v_project_name FROM public.projects WHERE id = NEW.project_id;
  v_channel_name := lower(regexp_replace(coalesce(v_project_name, 'project') || '-' || NEW.name, '[^a-zA-Z0-9]+', '-', 'g'));
  v_channel_name := substring(v_channel_name from 1 for 60);

  INSERT INTO public.channels (name, description, is_org_wide, project_id, project_group_id, channel_kind)
  VALUES (v_channel_name, coalesce(v_project_name,'') || ' – ' || NEW.name, false, NEW.project_id, NEW.id, 'group')
  RETURNING id INTO v_channel_id;

  -- Seed lead + project leads as members; group members get joined when added.
  INSERT INTO public.channel_members (channel_id, user_id)
  SELECT v_channel_id, pm.user_id
  FROM public.project_memberships pm
  WHERE pm.project_id = NEW.project_id AND pm.role_on_project = 'lead'
  ON CONFLICT DO NOTHING;

  IF NEW.lead_user_id IS NOT NULL THEN
    INSERT INTO public.channel_members (channel_id, user_id)
    VALUES (v_channel_id, NEW.lead_user_id) ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_channel_for_group ON public.project_groups;
CREATE TRIGGER trg_create_channel_for_group
  AFTER INSERT ON public.project_groups
  FOR EACH ROW EXECUTE FUNCTION public.create_channel_for_group();

CREATE OR REPLACE FUNCTION public.add_group_member_to_channel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_channel_id uuid;
BEGIN
  SELECT id INTO v_channel_id FROM public.channels WHERE project_group_id = NEW.group_id LIMIT 1;
  IF v_channel_id IS NOT NULL THEN
    INSERT INTO public.channel_members (channel_id, user_id)
    VALUES (v_channel_id, NEW.user_id) ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_add_group_member_to_channel ON public.project_group_members;
CREATE TRIGGER trg_add_group_member_to_channel
  AFTER INSERT ON public.project_group_members
  FOR EACH ROW EXECUTE FUNCTION public.add_group_member_to_channel();

-- Archive group → archive channel (rename, keep history).
CREATE OR REPLACE FUNCTION public.handle_group_archive()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.archived = true AND OLD.archived = false THEN
    UPDATE public.channels
       SET name = '[archived] ' || substring(name from 1 for 50)
     WHERE project_group_id = NEW.id AND name NOT LIKE '[archived]%';
    NEW.archived_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_handle_group_archive ON public.project_groups;
CREATE TRIGGER trg_handle_group_archive
  BEFORE UPDATE ON public.project_groups
  FOR EACH ROW EXECUTE FUNCTION public.handle_group_archive();

-- ---------------------------------------------------------------------
-- 4. DELIVERABLE GROUP ASSIGNMENT
-- ---------------------------------------------------------------------

ALTER TABLE public.deliverables
  ADD COLUMN IF NOT EXISTS submitter_group_id uuid REFERENCES public.project_groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_deliverables_group ON public.deliverables(submitter_group_id);

-- ---------------------------------------------------------------------
-- 5. STANDARDIZED STAGE TEMPLATE (Kickoff/Discovery/Midpoint/Final/Retro)
-- ---------------------------------------------------------------------

DO $$
DECLARE
  v_template uuid := '11111111-1111-1111-1111-111111111111'; -- Mock Training Project
BEGIN
  -- Rename Direction → Midpoint, merge Build into Final, drop the now-extra row.
  UPDATE public.template_stages
     SET name = 'Midpoint', description = 'Mid-project review: progress, blockers, course corrections.'
   WHERE template_id = v_template AND order_index = 2;

  UPDATE public.template_stages
     SET name = 'Final', description = 'Final deliverables, demo, documentation, and handoff.', order_index = 3, default_duration_days = 28
   WHERE template_id = v_template AND order_index = 4 AND name = 'Final Delivery';

  -- Move template_deliverables that pointed at the old Build (3) into Final (3).
  UPDATE public.template_deliverables
     SET stage_order_index = 3
   WHERE template_id = v_template AND stage_order_index = 3;

  -- Remove the old "Build" stage row at index 3 (now duplicated by Final).
  DELETE FROM public.template_stages
   WHERE template_id = v_template AND name = 'Build';

  UPDATE public.template_stages
     SET order_index = 4
   WHERE template_id = v_template AND name = 'Retro';
END $$;

-- ---------------------------------------------------------------------
-- 6. AVAILABILITY ONBOARDING FLAG
-- ---------------------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS availability_set_at timestamptz;

CREATE OR REPLACE FUNCTION public.stamp_availability_set()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.profiles
     SET availability_set_at = COALESCE(availability_set_at, now())
   WHERE user_id = NEW.user_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stamp_availability_set ON public.availability_windows;
CREATE TRIGGER trg_stamp_availability_set
  AFTER INSERT ON public.availability_windows
  FOR EACH ROW EXECUTE FUNCTION public.stamp_availability_set();

-- Backfill for users who already have windows.
UPDATE public.profiles p
   SET availability_set_at = sub.first_at
  FROM (
    SELECT user_id, min(created_at) AS first_at
      FROM public.availability_windows
     GROUP BY user_id
  ) sub
 WHERE sub.user_id = p.user_id AND p.availability_set_at IS NULL;

-- ---------------------------------------------------------------------
-- 7. SOFT-WARNING HELPERS
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.cohort_meeting_status(p_cohort_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_has_meeting boolean;
  v_lead_attending boolean;
  v_next_event timestamptz;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.events
    WHERE cancelled = false
      AND event_type IN ('cohort_meeting','all_hands')
      AND (
        (audience_scope = 'cohort' AND audience_target_id = p_cohort_id)
        OR audience_scope IN ('all','all_members','org')
      )
      AND start_time >= date_trunc('week', now())
      AND start_time <  date_trunc('week', now()) + interval '7 days'
  ) INTO v_has_meeting;

  SELECT min(start_time) INTO v_next_event
    FROM public.events
   WHERE cancelled = false
     AND event_type IN ('cohort_meeting','all_hands')
     AND audience_scope = 'cohort'
     AND audience_target_id = p_cohort_id
     AND start_time >= now();

  -- Tech-lead attending = at least one PM/Lead in the cohort RSVPed for the next event.
  IF v_next_event IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.event_rsvps r
      JOIN public.events e ON e.id = r.event_id
      JOIN public.cohort_memberships cm ON cm.user_id = r.user_id
      WHERE e.start_time = v_next_event
        AND cm.cohort_id = p_cohort_id
        AND cm.role IN ('pm','lead','integration_lead')
    ) INTO v_lead_attending;
  ELSE
    v_lead_attending := false;
  END IF;

  RETURN jsonb_build_object(
    'has_meeting_this_week', v_has_meeting,
    'lead_attending_next',   v_lead_attending,
    'next_event_at',         v_next_event
  );
END;
$$;

-- ---------------------------------------------------------------------
-- 8. COHORT PERFORMANCE SCORE
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.cohort_performance(p_cohort_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total_members int;
  v_attendance_pct int := 0;
  v_deliverable_pct int := 0;
  v_training_pct int := 0;
  v_score int := 0;
BEGIN
  SELECT count(*) INTO v_total_members
    FROM public.cohort_memberships WHERE cohort_id = p_cohort_id;

  IF v_total_members = 0 THEN
    RETURN jsonb_build_object('score',0,'attendance_pct',0,'deliverable_pct',0,'training_pct',0,'members',0);
  END IF;

  -- Attendance: present+late vs total marked over the past 8 weeks for cohort meetings.
  WITH att AS (
    SELECT a.status
      FROM public.event_attendance a
      JOIN public.events e ON e.id = a.event_id
     WHERE e.event_type IN ('cohort_meeting','all_hands')
       AND e.start_time > now() - interval '8 weeks'
       AND e.cancelled = false
       AND (
         (e.audience_scope = 'cohort' AND e.audience_target_id = p_cohort_id)
         OR e.audience_scope IN ('all','all_members','org')
       )
       AND a.user_id IN (SELECT user_id FROM public.cohort_memberships WHERE cohort_id = p_cohort_id)
       AND a.status <> 'unmarked'
  )
  SELECT COALESCE(round(100.0 * count(*) FILTER (WHERE status IN ('present','late')) / NULLIF(count(*),0))::int, 0)
    INTO v_attendance_pct FROM att;

  -- Deliverable completion: approved vs required, last 60 days, on the cohort's active project(s).
  WITH d AS (
    SELECT del.approval_status, del.required
      FROM public.deliverables del
      JOIN public.projects p ON p.id = del.project_id AND p.status = 'active'
     WHERE del.required = true
       AND del.created_at > now() - interval '60 days'
       AND del.project_id IN (
         SELECT pm.project_id FROM public.project_memberships pm
         WHERE pm.user_id IN (SELECT user_id FROM public.cohort_memberships WHERE cohort_id = p_cohort_id)
       )
  )
  SELECT COALESCE(round(100.0 * count(*) FILTER (WHERE approval_status = 'approved') / NULLIF(count(*),0))::int, 0)
    INTO v_deliverable_pct FROM d;

  -- Training: % of cohort members with at least one drill attempt in last 30 days.
  SELECT COALESCE(round(100.0 * count(DISTINCT a.user_id) / NULLIF(v_total_members,0))::int, 0)
    INTO v_training_pct
    FROM public.drill_attempts a
   WHERE a.user_id IN (SELECT user_id FROM public.cohort_memberships WHERE cohort_id = p_cohort_id)
     AND a.created_at > now() - interval '30 days';

  v_score := round((v_attendance_pct + v_deliverable_pct + v_training_pct) / 3.0)::int;

  RETURN jsonb_build_object(
    'score', v_score,
    'attendance_pct', v_attendance_pct,
    'deliverable_pct', v_deliverable_pct,
    'training_pct', v_training_pct,
    'members', v_total_members
  );
END;
$$;

-- ---------------------------------------------------------------------
-- 9. CHANNEL RLS REFRESH FOR project_group_id
-- (channels already have member-based RLS; group channels piggyback on
--  channel_members, so no additional policy is needed.)
-- ---------------------------------------------------------------------
