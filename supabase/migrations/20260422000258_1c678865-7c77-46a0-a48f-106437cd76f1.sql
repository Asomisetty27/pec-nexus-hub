
-- Extend events table for full lifecycle + integrations
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_by uuid,
  ADD COLUMN IF NOT EXISTS cancelled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS audience_scope text NOT NULL DEFAULT 'all_members',
  ADD COLUMN IF NOT EXISTS audience_target_id uuid,
  ADD COLUMN IF NOT EXISTS notify_on_create boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS meeting_link text,
  ADD COLUMN IF NOT EXISTS teams_link text;

-- Trigger to keep updated_at fresh
DROP TRIGGER IF EXISTS trg_events_updated_at ON public.events;
CREATE TRIGGER trg_events_updated_at
BEFORE UPDATE ON public.events
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Notification audit table
CREATE TABLE IF NOT EXISTS public.event_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('created','updated','cancelled')),
  triggered_by uuid,
  recipient_count int NOT NULL DEFAULT 0,
  succeeded_count int NOT NULL DEFAULT 0,
  failed_count int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','partial','failed')),
  error_message text,
  audience_scope text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.event_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_notifications read" ON public.event_notifications;
CREATE POLICY "event_notifications read" ON public.event_notifications
FOR SELECT TO authenticated
USING (
  public.is_admin(auth.uid())
  OR triggered_by = auth.uid()
  OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.created_by = auth.uid())
);

DROP POLICY IF EXISTS "event_notifications insert" ON public.event_notifications;
CREATE POLICY "event_notifications insert" ON public.event_notifications
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = triggered_by OR public.is_admin(auth.uid()));

-- Tighten event policies to allow update/delete by creator or admin
DROP POLICY IF EXISTS "events_update_creator_or_admin" ON public.events;
CREATE POLICY "events_update_creator_or_admin" ON public.events
FOR UPDATE TO authenticated
USING (created_by = auth.uid() OR public.is_admin(auth.uid()))
WITH CHECK (created_by = auth.uid() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "events_delete_creator_or_admin" ON public.events;
CREATE POLICY "events_delete_creator_or_admin" ON public.events
FOR DELETE TO authenticated
USING (created_by = auth.uid() OR public.is_admin(auth.uid()));
