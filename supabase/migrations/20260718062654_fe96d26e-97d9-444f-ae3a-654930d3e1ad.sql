
-- 1) Revoke EXECUTE from anon on all SECURITY DEFINER functions in public schema
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM anon', r.nspname, r.proname, r.args);
  END LOOP;
END $$;

-- 2) Tighten deliverables storage read policy: mirror the write policy's membership check
DROP POLICY IF EXISTS deliverables_read ON storage.objects;

CREATE POLICY deliverables_read
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'deliverables'
  AND auth.uid() IS NOT NULL
  AND (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.project_memberships pm
      WHERE pm.user_id = auth.uid()
        AND pm.project_id::text = split_part(storage.objects.name, '/', 1)
    )
  )
);
