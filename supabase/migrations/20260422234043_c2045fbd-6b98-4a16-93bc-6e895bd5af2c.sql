-- Recreate the 3 lane functions with explicit SET search_path = public
-- (the inline `SET search_path = public` in the function body wasn't being
-- parsed as the search_path GUC by the linter; use ALTER FUNCTION instead).

ALTER FUNCTION public.recommend_weak_skill_drills(public.drill_cohort, int)
  SET search_path = public;

ALTER FUNCTION public.recommend_theme_drills(public.drill_cohort, int)
  SET search_path = public;

ALTER FUNCTION public.recommend_challenge_drills(public.drill_cohort, int)
  SET search_path = public;

-- Drop the broad "Admins manage" ALL policies and replace with per-action.
DROP POLICY IF EXISTS "Admins manage themes" ON public.training_themes;
DROP POLICY IF EXISTS "Admins manage challenges" ON public.training_challenges;

CREATE POLICY "Admins insert themes"
  ON public.training_themes FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins update themes"
  ON public.training_themes FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins delete themes"
  ON public.training_themes FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins insert challenges"
  ON public.training_challenges FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins update challenges"
  ON public.training_challenges FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins delete challenges"
  ON public.training_challenges FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));