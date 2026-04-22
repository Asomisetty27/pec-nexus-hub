CREATE OR REPLACE FUNCTION public.training_ai_user_today_count(p_user uuid)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::int FROM public.training_ai_usage
   WHERE user_id = p_user
     AND fallback_used = false
     AND created_at >= date_trunc('day', now());
$$;