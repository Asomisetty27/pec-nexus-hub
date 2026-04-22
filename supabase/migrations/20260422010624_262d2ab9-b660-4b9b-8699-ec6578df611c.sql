
-- Re-declare with explicit SET search_path = public on every function we just added.
ALTER FUNCTION public.create_notification(uuid, text, text, text, text, uuid, text, uuid, text, text, jsonb) SET search_path = public;
ALTER FUNCTION public.mark_notifications_read(uuid[]) SET search_path = public;
ALTER FUNCTION public.track_recent_item(text, text, text, text, jsonb) SET search_path = public;
ALTER FUNCTION public.create_assignment_bundle(uuid, uuid, text, text, date, uuid, uuid, text, text) SET search_path = public;
ALTER FUNCTION public.run_escalation_scan() SET search_path = public;
ALTER FUNCTION public.notify_deliverable_status_change() SET search_path = public;
ALTER FUNCTION public.notify_deliverable_submitted() SET search_path = public;
ALTER FUNCTION public.notify_help_request_assigned() SET search_path = public;
ALTER FUNCTION public.notify_message_mentions() SET search_path = public;
ALTER FUNCTION public.notify_event_change() SET search_path = public;
