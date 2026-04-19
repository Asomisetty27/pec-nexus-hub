
-- 1. Review event log
CREATE TABLE IF NOT EXISTS public.deliverable_review_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deliverable_id uuid NOT NULL,
  project_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('submitted','revised','approved','revision_requested','rejected','reopened')),
  from_status text,
  to_status text,
  version integer,
  reason text,
  file_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dre_deliverable ON public.deliverable_review_events(deliverable_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dre_project ON public.deliverable_review_events(project_id, created_at DESC);

ALTER TABLE public.deliverable_review_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dre_select ON public.deliverable_review_events;
CREATE POLICY dre_select ON public.deliverable_review_events
  FOR SELECT USING (is_project_member(auth.uid(), project_id) OR is_admin(auth.uid()));

DROP POLICY IF EXISTS dre_insert ON public.deliverable_review_events;
CREATE POLICY dre_insert ON public.deliverable_review_events
  FOR INSERT WITH CHECK (is_project_member(auth.uid(), project_id) OR is_admin(auth.uid()));

-- 2. Helper: is current user a lead on this project (or admin)
CREATE OR REPLACE FUNCTION public.is_project_lead(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT is_admin(_user_id) OR EXISTS (
    SELECT 1 FROM public.project_memberships
    WHERE user_id = _user_id AND project_id = _project_id AND role_on_project = 'lead'
  )
$$;

-- 3. Approve deliverable
CREATE OR REPLACE FUNCTION public.approve_deliverable(p_deliverable_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_d RECORD;
BEGIN
  SELECT * INTO v_d FROM deliverables WHERE id = p_deliverable_id;
  IF v_d IS NULL THEN RAISE EXCEPTION 'Deliverable not found'; END IF;
  IF NOT is_project_lead(auth.uid(), v_d.project_id) THEN
    RAISE EXCEPTION 'Only project leads or admins can approve deliverables';
  END IF;
  IF v_d.file_url IS NULL THEN
    RAISE EXCEPTION 'Cannot approve a deliverable that has no submission';
  END IF;

  UPDATE deliverables SET
    approval_status = 'approved',
    approved = true,
    approved_by = auth.uid(),
    approved_at = now(),
    updated_at = now()
  WHERE id = p_deliverable_id;

  INSERT INTO deliverable_review_events
    (deliverable_id, project_id, actor_id, event_type, from_status, to_status, version, file_url)
  VALUES
    (p_deliverable_id, v_d.project_id, auth.uid(), 'approved', v_d.approval_status::text, 'approved', v_d.version, v_d.file_url);
END;
$$;

-- 4. Request changes
CREATE OR REPLACE FUNCTION public.request_deliverable_changes(p_deliverable_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_d RECORD;
BEGIN
  IF p_reason IS NULL OR length(trim(p_reason)) < 3 THEN
    RAISE EXCEPTION 'A reason is required when requesting changes';
  END IF;
  SELECT * INTO v_d FROM deliverables WHERE id = p_deliverable_id;
  IF v_d IS NULL THEN RAISE EXCEPTION 'Deliverable not found'; END IF;
  IF NOT is_project_lead(auth.uid(), v_d.project_id) THEN
    RAISE EXCEPTION 'Only project leads or admins can request changes';
  END IF;

  UPDATE deliverables SET
    approval_status = 'revision_requested',
    approved = false,
    approved_by = NULL,
    approved_at = NULL,
    updated_at = now()
  WHERE id = p_deliverable_id;

  INSERT INTO deliverable_review_events
    (deliverable_id, project_id, actor_id, event_type, from_status, to_status, version, reason, file_url)
  VALUES
    (p_deliverable_id, v_d.project_id, auth.uid(), 'revision_requested', v_d.approval_status::text, 'revision_requested', v_d.version, p_reason, v_d.file_url);
END;
$$;

-- 5. Reject deliverable
CREATE OR REPLACE FUNCTION public.reject_deliverable(p_deliverable_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_d RECORD;
BEGIN
  IF p_reason IS NULL OR length(trim(p_reason)) < 3 THEN
    RAISE EXCEPTION 'A reason is required when rejecting';
  END IF;
  SELECT * INTO v_d FROM deliverables WHERE id = p_deliverable_id;
  IF v_d IS NULL THEN RAISE EXCEPTION 'Deliverable not found'; END IF;
  IF NOT is_project_lead(auth.uid(), v_d.project_id) THEN
    RAISE EXCEPTION 'Only project leads or admins can reject deliverables';
  END IF;

  UPDATE deliverables SET
    approval_status = 'rejected',
    approved = false,
    approved_by = NULL,
    approved_at = NULL,
    updated_at = now()
  WHERE id = p_deliverable_id;

  INSERT INTO deliverable_review_events
    (deliverable_id, project_id, actor_id, event_type, from_status, to_status, version, reason, file_url)
  VALUES
    (p_deliverable_id, v_d.project_id, auth.uid(), 'rejected', v_d.approval_status::text, 'rejected', v_d.version, p_reason, v_d.file_url);
END;
$$;

-- 6. Stage blockers helper: returns the deliverables preventing a milestone from being closed.
-- Rule: a required deliverable blocks if approval_required=true and approval_status<>'approved',
--       or approval_required=false and file_url IS NULL.
CREATE OR REPLACE FUNCTION public.get_milestone_blockers(p_milestone_id uuid)
RETURNS TABLE (
  id uuid, title text, approval_status text, approval_required boolean,
  file_url text, due_date date, owner_id uuid, version integer
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT d.id, d.title, d.approval_status::text, d.approval_required,
         d.file_url, d.due_date, d.owner_id, d.version
  FROM deliverables d
  WHERE d.milestone_id = p_milestone_id
    AND d.required = true
    AND (
      (d.approval_required = true AND d.approval_status <> 'approved')
      OR (d.approval_required = false AND d.file_url IS NULL)
    )
$$;
