-- Fix: profiles_select_members policy was indirectly blocked by user_roles RLS.
-- The EXISTS subqueries on user_roles only see the caller's own row, so the
-- check on the *target* user's roles always fails for non-admins.
-- Replace with SECURITY DEFINER helper that bypasses user_roles RLS.

CREATE OR REPLACE FUNCTION public.is_active_member(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role <> 'applicant'
  )
$$;

DROP POLICY IF EXISTS profiles_select_members ON public.profiles;

CREATE POLICY profiles_select_members
ON public.profiles
FOR SELECT
TO authenticated
USING (
  public.is_active_member(auth.uid())
  AND public.is_active_member(profiles.user_id)
);