
-- 1. Roster: restrict SELECT to admins and members of the same cohort (matched by cohort name)
DROP POLICY IF EXISTS roster_select ON public.cohort_roster;
CREATE POLICY roster_select ON public.cohort_roster
FOR SELECT TO authenticated
USING (
  public.is_admin(auth.uid())
  OR public.is_board_or_admin(auth.uid())
  OR matched_user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.cohort_memberships cm
    JOIN public.cohorts c ON c.id = cm.cohort_id
    WHERE cm.user_id = auth.uid() AND c.name = cohort_roster.cohort_name
  )
);

-- 2. Projects: fix broken proj_update_lead correlation
DROP POLICY IF EXISTS proj_update_lead ON public.projects;
CREATE POLICY proj_update_lead ON public.projects
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.project_memberships pm
    WHERE pm.project_id = projects.id
      AND pm.user_id = auth.uid()
      AND pm.role_on_project = 'lead'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.project_memberships pm
    WHERE pm.project_id = projects.id
      AND pm.user_id = auth.uid()
      AND pm.role_on_project = 'lead'
  )
);

-- 3. Storage: deliverables_write must be project member (path = {project_id}/{deliverable_id}/...)
DROP POLICY IF EXISTS deliverables_write ON storage.objects;
CREATE POLICY deliverables_write ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'deliverables'
  AND auth.uid() IS NOT NULL
  AND (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.project_memberships pm
      WHERE pm.user_id = auth.uid()
        AND pm.project_id::text = split_part(name, '/', 1)
    )
  )
);

-- 4. Storage: resumes_upload must be scoped to auth.uid()
DROP POLICY IF EXISTS resumes_upload ON storage.objects;
CREATE POLICY resumes_upload ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'resumes'
  AND auth.uid() IS NOT NULL
  AND (
    public.is_admin(auth.uid())
    OR split_part(name, '/', 1) = auth.uid()::text
  )
);

-- 5. Storage: pub_assets_write restricted to admins/board
DROP POLICY IF EXISTS pub_assets_write ON storage.objects;
CREATE POLICY pub_assets_write ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'public_assets'
  AND public.is_board_or_admin(auth.uid())
);

-- 6. Remove broad listing SELECT on public_assets (public URLs still work via CDN)
DROP POLICY IF EXISTS pub_assets_read ON storage.objects;

-- 7. create_notification: prevent spoofing + revoke public execute
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id uuid,
  p_category text,
  p_title text,
  p_body text DEFAULT NULL,
  p_link text DEFAULT NULL,
  p_actor_id uuid DEFAULT NULL,
  p_target_type text DEFAULT NULL,
  p_target_id uuid DEFAULT NULL,
  p_priority text DEFAULT 'normal',
  p_dedupe_key text DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_id uuid;
  v_prefs RECORD;
  v_allow boolean := true;
  v_caller uuid := auth.uid();
  v_is_service boolean := (current_setting('request.jwt.claim.role', true) = 'service_role');
BEGIN
  IF NOT v_is_service AND NOT public.is_admin(v_caller) THEN
    IF p_actor_id IS NOT NULL AND p_actor_id <> v_caller THEN
      RAISE EXCEPTION 'not authorized to spoof actor_id';
    END IF;
    IF p_user_id <> v_caller THEN
      RAISE EXCEPTION 'not authorized to notify other users';
    END IF;
  END IF;

  SELECT * INTO v_prefs FROM public.notification_preferences WHERE user_id = p_user_id;
  IF FOUND THEN
    IF v_prefs.muted_categories IS NOT NULL AND p_category = ANY(v_prefs.muted_categories) THEN
      v_allow := false;
    END IF;
  END IF;

  IF NOT v_allow THEN RETURN NULL; END IF;

  INSERT INTO public.notifications
    (user_id, category, title, body, link, actor_id, target_type, target_id, priority, dedupe_key, metadata)
  VALUES
    (p_user_id, p_category, p_title, p_body, p_link, p_actor_id, p_target_type, p_target_id, p_priority, p_dedupe_key, p_metadata)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_notification(uuid, text, text, text, text, uuid, text, uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_notification(uuid, text, text, text, text, uuid, text, uuid, text, text, jsonb) TO service_role;

-- 8. Revoke trigger-returning definer functions from PUBLIC/anon/authenticated
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)) AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prosecdef AND p.prorettype='trigger'::regtype
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated;', r.sig);
  END LOOP;
END $$;

-- 9. Revoke anon EXECUTE on ALL public SECURITY DEFINER functions (safe blanket)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)) AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon;', r.sig);
  END LOOP;
END $$;

-- 10. Revoke authenticated EXECUTE on internal/queue/system functions
DO $$
DECLARE r RECORD;
  internal_fns text[] := ARRAY[
    'email_queue_wake','email_queue_dispatch','enqueue_email','delete_email','read_email_batch','move_to_dlq',
    'handle_new_user','create_channel_for_group','join_user_to_default_channels','auto_join_missing_channels',
    'auto_backfill_project_memberships','auto_close_stale_help_requests','auto_flag_stale_reviews',
    'auto_resync_unmatched_users','onboard_accepted_applicant','resync_user_from_roster',
    'seed_project_memberships_from_cohort','run_escalation_scan','run_momentum_scan','run_nexus_self_heal',
    'snapshot_score','_compute_score_window','promote_pre_cycle_applicants','resolve_designated_ops_lead',
    'cm_create_followup_task','cm_write_field_if_better','assign_primary_reviewer'
  ];
BEGIN
  FOR r IN
    SELECT format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)) AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prosecdef AND p.proname = ANY(internal_fns)
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated;', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role;', r.sig);
  END LOOP;
END $$;
