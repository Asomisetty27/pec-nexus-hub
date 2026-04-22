
ALTER FUNCTION public.submit_drill_attempt(uuid, jsonb, boolean, int, int) SET search_path = public;
ALTER FUNCTION public.recommend_drills(public.drill_cohort, int) SET search_path = public;
ALTER FUNCTION public.grind_leaderboard(public.drill_cohort, int) SET search_path = public;
