
-- 1. cohort_score_snapshots: restrict read to active members
DROP POLICY IF EXISTS score_snap_read_authenticated ON public.cohort_score_snapshots;
CREATE POLICY score_snap_read_active_members ON public.cohort_score_snapshots
  FOR SELECT TO authenticated
  USING (public.is_active_member(auth.uid()));

-- 2. events: scope member visibility by audience
DROP POLICY IF EXISTS events_members ON public.events;
CREATE POLICY events_members ON public.events
  FOR SELECT TO authenticated
  USING (
    is_admin(auth.uid())
    OR created_by = auth.uid()
    OR audience_scope = 'all_members'
    OR (
      audience_scope = 'cohort'
      AND audience_target_id IS NOT NULL
      AND (
        is_cohort_host(auth.uid(), audience_target_id)
        OR EXISTS (
          SELECT 1 FROM public.cohort_memberships cm
          WHERE cm.user_id = auth.uid() AND cm.cohort_id = events.audience_target_id
        )
      )
    )
    OR (
      audience_scope = 'project'
      AND audience_target_id IS NOT NULL
      AND (
        is_project_lead(auth.uid(), audience_target_id)
        OR is_project_member(auth.uid(), audience_target_id)
      )
    )
  );

-- 3. Revoke anon EXECUTE on all SECURITY DEFINER functions in public
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.prosecdef AND n.nspname = 'public'
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM anon, PUBLIC', r.nspname, r.proname, r.args);
  END LOOP;
END $$;
