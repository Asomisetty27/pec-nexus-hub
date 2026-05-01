-- Migration E: Phase 4 deliverable doctrine alignment
-- Strictly additive. No data migration. RLS unchanged.

-- 1. Enums
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='deliverable_owner_type') THEN
    CREATE TYPE public.deliverable_owner_type AS ENUM ('individual','group');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='deliverable_stage') THEN
    CREATE TYPE public.deliverable_stage AS ENUM ('kickoff','discovery','midpoint','final','retro');
  END IF;
END $$;

-- 2. Columns
ALTER TABLE public.deliverables
  ADD COLUMN IF NOT EXISTS owner_type public.deliverable_owner_type NOT NULL DEFAULT 'individual',
  ADD COLUMN IF NOT EXISTS owning_group_id uuid REFERENCES public.project_groups(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS canonical_stage public.deliverable_stage,
  ADD COLUMN IF NOT EXISTS is_technical boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tech_validation_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tech_validated_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS tech_validated_at timestamptz,
  ADD COLUMN IF NOT EXISTS pm_override_reason text,
  ADD COLUMN IF NOT EXISTS pm_override_at timestamptz,
  ADD COLUMN IF NOT EXISTS pm_override_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS started_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES auth.users(id);

-- 3. Owner-shape integrity
ALTER TABLE public.deliverables
  DROP CONSTRAINT IF EXISTS deliverables_owner_shape_chk;
ALTER TABLE public.deliverables
  ADD CONSTRAINT deliverables_owner_shape_chk CHECK (
    (owner_type='individual' AND owning_group_id IS NULL)
    OR (owner_type='group' AND owning_group_id IS NOT NULL)
  );

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_deliverables_owning_group
  ON public.deliverables(owning_group_id) WHERE owning_group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deliverables_canonical_stage
  ON public.deliverables(canonical_stage);
CREATE INDEX IF NOT EXISTS idx_deliverables_unstaged
  ON public.deliverables(project_id) WHERE canonical_stage IS NULL AND archived=false;
CREATE INDEX IF NOT EXISTS idx_deliverables_tech_pending
  ON public.deliverables(project_id)
  WHERE tech_validation_required=true AND tech_validated_at IS NULL
    AND approval_status='pending' AND archived=false;
CREATE INDEX IF NOT EXISTS idx_deliverables_active_in_progress
  ON public.deliverables(project_id, started_at)
  WHERE started_at IS NOT NULL AND approval_status='pending' AND archived=false;

-- 5. Tech Lead helper
CREATE OR REPLACE FUNCTION public.is_project_tech_lead(_user_id uuid, _project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT public.is_admin(_user_id) OR EXISTS (
    SELECT 1 FROM public.project_memberships
    WHERE user_id=_user_id AND project_id=_project_id
      AND role_on_project IN ('tech_lead','lead')
  )
$$;

-- 6. Submission eligibility helper
CREATE OR REPLACE FUNCTION public.can_submit_deliverable(_user_id uuid, _deliverable_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.deliverables d
    WHERE d.id=_deliverable_id AND d.archived=false AND (
      (d.owner_type='individual' AND d.owner_id=_user_id)
      OR (d.owner_type='group' AND EXISTS (
        SELECT 1 FROM public.project_group_members m
        WHERE m.group_id=d.owning_group_id AND m.user_id=_user_id
      ))
      OR public.is_project_lead(_user_id, d.project_id)
    )
  )
$$;

-- 7. Mark Started
CREATE OR REPLACE FUNCTION public.mark_deliverable_started(p_deliverable_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_d RECORD;
BEGIN
  SELECT * INTO v_d FROM public.deliverables WHERE id=p_deliverable_id;
  IF v_d IS NULL THEN RAISE EXCEPTION 'Deliverable not found'; END IF;
  IF v_d.archived THEN RAISE EXCEPTION 'Cannot start an archived deliverable'; END IF;
  IF NOT public.can_submit_deliverable(auth.uid(), p_deliverable_id) THEN
    RAISE EXCEPTION 'Only the assignee or a group member can start this';
  END IF;
  IF v_d.file_url IS NOT NULL THEN RAISE EXCEPTION 'Already submitted'; END IF;
  IF v_d.started_at IS NOT NULL THEN RETURN; END IF;
  UPDATE public.deliverables SET started_at=now(), started_by=auth.uid(), updated_at=now()
    WHERE id=p_deliverable_id;
  INSERT INTO public.deliverable_review_events (deliverable_id, project_id, actor_id, event_type, version)
  VALUES (p_deliverable_id, v_d.project_id, auth.uid(), 'started', v_d.version);
END $$;

-- 8. Submit deliverable
CREATE OR REPLACE FUNCTION public.submit_deliverable(
  p_deliverable_id uuid, p_file_url text, p_notes text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_d RECORD; v_next int; v_is_revision boolean;
BEGIN
  SELECT * INTO v_d FROM public.deliverables WHERE id=p_deliverable_id;
  IF v_d IS NULL THEN RAISE EXCEPTION 'Deliverable not found'; END IF;
  IF v_d.archived THEN RAISE EXCEPTION 'Cannot submit an archived deliverable'; END IF;
  IF p_file_url IS NULL OR length(trim(p_file_url))=0 THEN
    RAISE EXCEPTION 'A file URL is required';
  END IF;
  IF NOT public.can_submit_deliverable(auth.uid(), p_deliverable_id) THEN
    RAISE EXCEPTION 'You are not eligible to submit this deliverable';
  END IF;
  v_is_revision := v_d.approval_status IN ('revision_requested','rejected') OR v_d.file_url IS NOT NULL;
  v_next := CASE WHEN v_is_revision THEN v_d.version + 1 ELSE 1 END;

  UPDATE public.deliverables SET
    file_url=p_file_url,
    version=v_next,
    approval_status = CASE WHEN v_d.approval_required THEN 'pending'::approval_status ELSE 'approved'::approval_status END,
    approved = NOT v_d.approval_required,
    approved_at = CASE WHEN v_d.approval_required THEN NULL ELSE now() END,
    tech_validated_by = NULL,
    tech_validated_at = NULL,
    updated_at = now()
  WHERE id=p_deliverable_id;

  INSERT INTO public.deliverable_review_events
    (deliverable_id, project_id, actor_id, event_type, from_status, to_status, version, reason, file_url)
  VALUES
    (p_deliverable_id, v_d.project_id, auth.uid(),
     CASE WHEN v_is_revision THEN 'revised' ELSE 'submitted' END,
     v_d.approval_status::text,
     (CASE WHEN v_d.approval_required THEN 'pending' ELSE 'approved' END),
     v_next, p_notes, p_file_url);
END $$;

-- 9. Tech Lead validation RPCs
CREATE OR REPLACE FUNCTION public.validate_deliverable_technical(p_deliverable_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_d RECORD;
BEGIN
  SELECT * INTO v_d FROM public.deliverables WHERE id=p_deliverable_id;
  IF v_d IS NULL THEN RAISE EXCEPTION 'Deliverable not found'; END IF;
  IF NOT public.is_project_tech_lead(auth.uid(), v_d.project_id) THEN
    RAISE EXCEPTION 'Only Tech Leads (or project leads/admins) can validate';
  END IF;
  IF v_d.file_url IS NULL THEN RAISE EXCEPTION 'Cannot validate before submission'; END IF;
  UPDATE public.deliverables SET tech_validated_by=auth.uid(), tech_validated_at=now(), updated_at=now()
    WHERE id=p_deliverable_id;
  INSERT INTO public.deliverable_review_events (deliverable_id, project_id, actor_id, event_type, version)
  VALUES (p_deliverable_id, v_d.project_id, auth.uid(), 'tech_validated', v_d.version);
END $$;

CREATE OR REPLACE FUNCTION public.unvalidate_deliverable_technical(p_deliverable_id uuid, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_d RECORD;
BEGIN
  IF p_reason IS NULL OR length(trim(p_reason))<3 THEN RAISE EXCEPTION 'Reason required'; END IF;
  SELECT * INTO v_d FROM public.deliverables WHERE id=p_deliverable_id;
  IF v_d IS NULL THEN RAISE EXCEPTION 'Deliverable not found'; END IF;
  IF NOT public.is_project_tech_lead(auth.uid(), v_d.project_id) THEN
    RAISE EXCEPTION 'Only Tech Leads can unvalidate';
  END IF;
  UPDATE public.deliverables SET tech_validated_by=NULL, tech_validated_at=NULL, updated_at=now()
    WHERE id=p_deliverable_id;
  INSERT INTO public.deliverable_review_events (deliverable_id, project_id, actor_id, event_type, version, reason)
  VALUES (p_deliverable_id, v_d.project_id, auth.uid(), 'tech_unvalidated', v_d.version, p_reason);
END $$;

-- 10. Approve (with tech-validation gate) + override variant
CREATE OR REPLACE FUNCTION public.approve_deliverable(p_deliverable_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_d RECORD;
BEGIN
  SELECT * INTO v_d FROM public.deliverables WHERE id=p_deliverable_id;
  IF v_d IS NULL THEN RAISE EXCEPTION 'Deliverable not found'; END IF;
  IF NOT public.is_project_lead(auth.uid(), v_d.project_id) THEN
    RAISE EXCEPTION 'Only project leads or admins can approve';
  END IF;
  IF v_d.file_url IS NULL THEN RAISE EXCEPTION 'No submission to approve'; END IF;
  IF v_d.tech_validation_required AND v_d.tech_validated_at IS NULL THEN
    RAISE EXCEPTION 'Tech Lead validation required. Use approve_deliverable_with_override to bypass.';
  END IF;
  UPDATE public.deliverables SET
    approval_status='approved', approved=true, approved_by=auth.uid(),
    approved_at=now(), updated_at=now()
  WHERE id=p_deliverable_id;
  INSERT INTO public.deliverable_review_events
    (deliverable_id, project_id, actor_id, event_type, from_status, to_status, version, file_url)
  VALUES
    (p_deliverable_id, v_d.project_id, auth.uid(), 'approved', v_d.approval_status::text, 'approved', v_d.version, v_d.file_url);
END $$;

CREATE OR REPLACE FUNCTION public.approve_deliverable_with_override(p_deliverable_id uuid, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_d RECORD;
BEGIN
  IF p_reason IS NULL OR length(trim(p_reason))<10 THEN
    RAISE EXCEPTION 'Override requires a reason of at least 10 characters';
  END IF;
  SELECT * INTO v_d FROM public.deliverables WHERE id=p_deliverable_id;
  IF v_d IS NULL THEN RAISE EXCEPTION 'Deliverable not found'; END IF;
  IF NOT public.is_project_lead(auth.uid(), v_d.project_id) THEN
    RAISE EXCEPTION 'Only project leads or admins can approve';
  END IF;
  IF v_d.file_url IS NULL THEN RAISE EXCEPTION 'No submission to approve'; END IF;
  IF NOT v_d.tech_validation_required OR v_d.tech_validated_at IS NOT NULL THEN
    RAISE EXCEPTION 'Override not applicable; use approve_deliverable';
  END IF;
  UPDATE public.deliverables SET
    approval_status='approved', approved=true, approved_by=auth.uid(), approved_at=now(),
    pm_override_reason=p_reason, pm_override_by=auth.uid(), pm_override_at=now(),
    updated_at=now()
  WHERE id=p_deliverable_id;
  INSERT INTO public.deliverable_review_events
    (deliverable_id, project_id, actor_id, event_type, from_status, to_status, version, reason, file_url)
  VALUES
    (p_deliverable_id, v_d.project_id, auth.uid(), 'pm_override_approved', v_d.approval_status::text, 'approved', v_d.version, p_reason, v_d.file_url);
  BEGIN
    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    VALUES (auth.uid(), 'deliverable.pm_override_approved', 'deliverable', p_deliverable_id,
            jsonb_build_object('project_id', v_d.project_id, 'reason', p_reason, 'version', v_d.version));
  EXCEPTION WHEN undefined_table THEN NULL; END;
END $$;

-- 11. Archive RPCs
CREATE OR REPLACE FUNCTION public.archive_deliverable(p_deliverable_id uuid, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_d RECORD;
BEGIN
  IF p_reason IS NULL OR length(trim(p_reason))<3 THEN RAISE EXCEPTION 'Reason required'; END IF;
  SELECT * INTO v_d FROM public.deliverables WHERE id=p_deliverable_id;
  IF v_d IS NULL THEN RAISE EXCEPTION 'Deliverable not found'; END IF;
  IF NOT public.is_project_lead(auth.uid(), v_d.project_id) THEN
    RAISE EXCEPTION 'Only project leads or admins can archive';
  END IF;
  UPDATE public.deliverables SET archived=true, archived_at=now(), archived_by=auth.uid(), updated_at=now()
    WHERE id=p_deliverable_id;
  INSERT INTO public.deliverable_review_events (deliverable_id, project_id, actor_id, event_type, version, reason)
  VALUES (p_deliverable_id, v_d.project_id, auth.uid(), 'archived', v_d.version, p_reason);
END $$;

CREATE OR REPLACE FUNCTION public.unarchive_deliverable(p_deliverable_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_d RECORD;
BEGIN
  SELECT * INTO v_d FROM public.deliverables WHERE id=p_deliverable_id;
  IF v_d IS NULL THEN RAISE EXCEPTION 'Deliverable not found'; END IF;
  IF NOT public.is_project_lead(auth.uid(), v_d.project_id) THEN
    RAISE EXCEPTION 'Only project leads or admins can unarchive';
  END IF;
  UPDATE public.deliverables SET archived=false, archived_at=NULL, archived_by=NULL, updated_at=now()
    WHERE id=p_deliverable_id;
  INSERT INTO public.deliverable_review_events (deliverable_id, project_id, actor_id, event_type, version)
  VALUES (p_deliverable_id, v_d.project_id, auth.uid(), 'unarchived', v_d.version);
END $$;

-- 12. Stage classification RPC
CREATE OR REPLACE FUNCTION public.set_deliverable_stage(p_deliverable_id uuid, p_stage public.deliverable_stage)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_d RECORD;
BEGIN
  SELECT * INTO v_d FROM public.deliverables WHERE id=p_deliverable_id;
  IF v_d IS NULL THEN RAISE EXCEPTION 'Deliverable not found'; END IF;
  IF NOT public.is_project_lead(auth.uid(), v_d.project_id) THEN
    RAISE EXCEPTION 'Only project leads or admins can stage';
  END IF;
  UPDATE public.deliverables SET canonical_stage=p_stage, updated_at=now() WHERE id=p_deliverable_id;
  INSERT INTO public.deliverable_review_events (deliverable_id, project_id, actor_id, event_type, version, reason)
  VALUES (p_deliverable_id, v_d.project_id, auth.uid(), 'staged', v_d.version, p_stage::text);
END $$;