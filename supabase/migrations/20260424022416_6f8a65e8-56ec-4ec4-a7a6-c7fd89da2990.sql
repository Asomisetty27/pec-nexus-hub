
-- ============================================================
-- 1. Helper: is_cohort_host(user, cohort)
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_cohort_host(_user_id uuid, _cohort_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin(_user_id) OR EXISTS (
    SELECT 1 FROM public.cohort_memberships
    WHERE user_id = _user_id
      AND cohort_id = _cohort_id
      AND role IN ('pm','lead','integration_lead')
  )
$$;

-- ============================================================
-- 2. Helper: can the user host THIS event (used by RLS + UI)
-- ============================================================
CREATE OR REPLACE FUNCTION public.can_host_event(_user_id uuid, _event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = _event_id
      AND (
        public.is_admin(_user_id)
        OR e.created_by = _user_id
        OR (
          e.audience_scope = 'cohort'
          AND e.audience_target_id IS NOT NULL
          AND public.is_cohort_host(_user_id, e.audience_target_id)
        )
        OR (
          e.audience_scope = 'project'
          AND e.audience_target_id IS NOT NULL
          AND public.is_project_lead(_user_id, e.audience_target_id)
        )
      )
  )
$$;

-- ============================================================
-- 3. event_attendance table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.event_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'unmarked'
    CHECK (status IN ('present','absent','excused','late','unmarked')),
  note text,
  marked_by uuid,
  marked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_event_attendance_event ON public.event_attendance(event_id);
CREATE INDEX IF NOT EXISTS idx_event_attendance_user  ON public.event_attendance(user_id);

ALTER TABLE public.event_attendance ENABLE ROW LEVEL SECURITY;

-- Users can view their own attendance rows
CREATE POLICY "att: user can view own"
  ON public.event_attendance FOR SELECT
  USING (auth.uid() = user_id);

-- Hosts (admin / creator / cohort lead / project lead) can view all rows for the event
CREATE POLICY "att: host can view"
  ON public.event_attendance FOR SELECT
  USING (public.can_host_event(auth.uid(), event_id));

-- Hosts can insert/update/delete attendance rows
CREATE POLICY "att: host can insert"
  ON public.event_attendance FOR INSERT
  WITH CHECK (public.can_host_event(auth.uid(), event_id));

CREATE POLICY "att: host can update"
  ON public.event_attendance FOR UPDATE
  USING (public.can_host_event(auth.uid(), event_id))
  WITH CHECK (public.can_host_event(auth.uid(), event_id));

CREATE POLICY "att: host can delete"
  ON public.event_attendance FOR DELETE
  USING (public.can_host_event(auth.uid(), event_id));

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_event_attendance_updated ON public.event_attendance;
CREATE TRIGGER trg_event_attendance_updated
  BEFORE UPDATE ON public.event_attendance
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- 4. Expected attendees resolver
-- ============================================================
CREATE OR REPLACE FUNCTION public.event_expected_attendees(p_event_id uuid)
RETURNS TABLE(user_id uuid, full_name text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event RECORD;
BEGIN
  SELECT * INTO v_event FROM public.events WHERE id = p_event_id;
  IF v_event IS NULL THEN RETURN; END IF;

  IF v_event.audience_scope = 'cohort' AND v_event.audience_target_id IS NOT NULL THEN
    RETURN QUERY
      SELECT cm.user_id, p.full_name
      FROM public.cohort_memberships cm
      LEFT JOIN public.profiles p ON p.user_id = cm.user_id
      WHERE cm.cohort_id = v_event.audience_target_id;
  ELSIF v_event.audience_scope = 'project' AND v_event.audience_target_id IS NOT NULL THEN
    RETURN QUERY
      SELECT pm.user_id, p.full_name
      FROM public.project_memberships pm
      LEFT JOIN public.profiles p ON p.user_id = pm.user_id
      WHERE pm.project_id = v_event.audience_target_id;
  ELSIF v_event.audience_scope IN ('all_members','all','org') THEN
    RETURN QUERY
      SELECT DISTINCT ur.user_id, p.full_name
      FROM public.user_roles ur
      LEFT JOIN public.profiles p ON p.user_id = ur.user_id
      WHERE ur.role <> 'applicant';
  ELSE
    -- Fall back to RSVPs for custom / leadership / pm-only audiences
    RETURN QUERY
      SELECT r.user_id, p.full_name
      FROM public.event_rsvps r
      LEFT JOIN public.profiles p ON p.user_id = r.user_id
      WHERE r.event_id = p_event_id;
  END IF;
END;
$$;

-- ============================================================
-- 5. Events RLS update so cohort PMs/Leads can manage cohort meetings
-- ============================================================
DO $$
BEGIN
  -- INSERT: allow cohort hosts to create cohort meetings, project leads to create project meetings
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='events' AND policyname='events: cohort host can insert'
  ) THEN
    CREATE POLICY "events: cohort host can insert"
      ON public.events FOR INSERT
      WITH CHECK (
        auth.uid() = created_by AND (
          public.is_admin(auth.uid())
          OR (audience_scope = 'cohort'  AND audience_target_id IS NOT NULL AND public.is_cohort_host(auth.uid(), audience_target_id))
          OR (audience_scope = 'project' AND audience_target_id IS NOT NULL AND public.is_project_lead(auth.uid(), audience_target_id))
        )
      );
  END IF;

  -- UPDATE: cohort hosts can edit cohort meetings (besides creators/admins)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='events' AND policyname='events: cohort host can update'
  ) THEN
    CREATE POLICY "events: cohort host can update"
      ON public.events FOR UPDATE
      USING (
        public.is_admin(auth.uid())
        OR created_by = auth.uid()
        OR (audience_scope = 'cohort'  AND audience_target_id IS NOT NULL AND public.is_cohort_host(auth.uid(), audience_target_id))
        OR (audience_scope = 'project' AND audience_target_id IS NOT NULL AND public.is_project_lead(auth.uid(), audience_target_id))
      );
  END IF;
END$$;
