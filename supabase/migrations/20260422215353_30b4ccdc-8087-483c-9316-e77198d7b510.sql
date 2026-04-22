-- =========================================================
-- Self-healing maintenance for PEC Nexus
-- All functions are SECURITY DEFINER, admin-only, idempotent.
-- =========================================================

-- 1) Auto-resync unmatched users (profile email matches roster, but no cohort membership)
CREATE OR REPLACE FUNCTION public.auto_resync_unmatched_users()
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user RECORD;
  v_count int := 0;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  FOR v_user IN
    SELECT p.user_id
    FROM public.profiles p
    JOIN public.cohort_roster r
      ON r.email IS NOT NULL
     AND lower(trim(r.email)) = lower(trim(p.cal_poly_email))
    LEFT JOIN public.cohort_memberships cm ON cm.user_id = p.user_id
    WHERE cm.id IS NULL
      AND p.cal_poly_email IS NOT NULL
    LIMIT 200
  LOOP
    BEGIN
      PERFORM public.resync_user_from_roster(v_user.user_id);
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      -- swallow per-user errors so one bad row doesn't halt the sweep
      NULL;
    END;
  END LOOP;

  RETURN v_count;
END;
$$;

-- 2) Auto-backfill project memberships from cohort
CREATE OR REPLACE FUNCTION public.auto_backfill_project_memberships()
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  WITH ins AS (
    INSERT INTO public.project_memberships (project_id, user_id, role_on_project)
    SELECT p.id, cm.user_id,
           CASE WHEN cm.role IN ('pm','lead','integration_lead') THEN 'lead' ELSE 'member' END
    FROM public.cohort_memberships cm
    JOIN public.cohorts c ON c.id = cm.cohort_id
    JOIN public.projects p ON p.status = 'active' AND (
        (c.name = 'Software / Systems'             AND p.name ILIKE 'memvis%') OR
        (c.name = 'Mechanical / Manufacturing'     AND p.name ILIKE 'Front Air Intake%') OR
        (c.name = 'Ops / PM'                       AND p.name ILIKE 'PEC Go-To-Market%') OR
        (c.name = 'Hardware / Systems / Embedded'  AND p.name ILIKE 'Smart Study Room%')
    )
    LEFT JOIN public.project_memberships pm
      ON pm.project_id = p.id AND pm.user_id = cm.user_id
    WHERE pm.id IS NULL
    ON CONFLICT (project_id, user_id) DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM ins;

  RETURN v_count;
END;
$$;

-- 3) Auto-join missing default channels
CREATE OR REPLACE FUNCTION public.auto_join_missing_channels()
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user RECORD;
  v_count int := 0;
  v_before int;
  v_after int;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  -- Anyone in user_roles other than applicant who is missing the org-wide channel
  -- OR (has a cohort but missing >=1 cohort channel) is repaired.
  FOR v_user IN
    SELECT DISTINCT p.user_id, c.name AS cohort_name, COALESCE(cm_role.role, 'member') AS roster_role
    FROM public.profiles p
    LEFT JOIN public.cohort_memberships cm_role ON cm_role.user_id = p.user_id
    LEFT JOIN public.cohorts c ON c.id = cm_role.cohort_id
    WHERE EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = p.user_id AND ur.role <> 'applicant'
    )
    LIMIT 500
  LOOP
    SELECT count(*) INTO v_before FROM public.channel_members WHERE user_id = v_user.user_id;
    BEGIN
      PERFORM public.join_user_to_default_channels(
        v_user.user_id,
        COALESCE(v_user.cohort_name, ''),
        COALESCE(v_user.roster_role, 'member')
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
    SELECT count(*) INTO v_after FROM public.channel_members WHERE user_id = v_user.user_id;
    IF v_after > v_before THEN
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;

-- 4) Auto-close stale help requests (open >14d with no recent activity).
CREATE OR REPLACE FUNCTION public.auto_close_stale_help_requests()
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_count int;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  WITH upd AS (
    UPDATE public.help_requests
       SET status = 'resolved',
           resolution = COALESCE(resolution, 'Auto-closed: no activity for 14 days'),
           resolved_at = now()
     WHERE status = 'open'
       AND created_at < now() - interval '14 days'
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM upd;

  RETURN v_count;
END;
$$;

-- 5) Flag stale pending reviews (>72h) to project leads (one notification per deliverable per day via dedupe key)
CREATE OR REPLACE FUNCTION public.auto_flag_stale_reviews()
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_d RECORD;
  v_lead RECORD;
  v_count int := 0;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  FOR v_d IN
    SELECT id, project_id, title, version
    FROM public.deliverables
    WHERE approval_required = true
      AND approval_status = 'pending'
      AND file_url IS NOT NULL
      AND updated_at < now() - interval '72 hours'
    LIMIT 200
  LOOP
    FOR v_lead IN
      SELECT user_id FROM public.project_memberships
       WHERE project_id = v_d.project_id AND role_on_project = 'lead'
    LOOP
      PERFORM public.create_notification(
        v_lead.user_id, 'review_requested',
        'Stale review: ' || v_d.title,
        'This submission has been awaiting review for 72+ hours.',
        '/app/lead',
        NULL, 'deliverable', v_d.id, 'high',
        'stale_review:' || v_d.id::text || ':' || to_char(now(),'YYYY-MM-DD'),
        NULL
      );
      v_count := v_count + 1;
    END LOOP;
  END LOOP;

  RETURN v_count;
END;
$$;

-- 6) Orchestrator
CREATE OR REPLACE FUNCTION public.run_nexus_self_heal()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_resync int := 0;
  v_proj   int := 0;
  v_chan   int := 0;
  v_help   int := 0;
  v_stale  int := 0;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  v_resync := public.auto_resync_unmatched_users();
  v_proj   := public.auto_backfill_project_memberships();
  v_chan   := public.auto_join_missing_channels();
  v_help   := public.auto_close_stale_help_requests();
  v_stale  := public.auto_flag_stale_reviews();

  INSERT INTO public.audit_logs (user_id, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'nexus.self_heal_run', 'system', NULL,
          jsonb_build_object(
            'users_resynced', v_resync,
            'project_memberships_added', v_proj,
            'channels_repaired', v_chan,
            'help_requests_closed', v_help,
            'stale_reviews_flagged', v_stale,
            'ran_at', now()
          ));

  RETURN jsonb_build_object(
    'users_resynced', v_resync,
    'project_memberships_added', v_proj,
    'channels_repaired', v_chan,
    'help_requests_closed', v_help,
    'stale_reviews_flagged', v_stale
  );
END;
$$;