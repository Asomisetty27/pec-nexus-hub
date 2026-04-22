ALTER FUNCTION public.auto_resync_unmatched_users() SET search_path = public;
ALTER FUNCTION public.auto_backfill_project_memberships() SET search_path = public;
ALTER FUNCTION public.auto_join_missing_channels() SET search_path = public;
ALTER FUNCTION public.auto_close_stale_help_requests() SET search_path = public;
ALTER FUNCTION public.auto_flag_stale_reviews() SET search_path = public;
ALTER FUNCTION public.run_nexus_self_heal() SET search_path = public;