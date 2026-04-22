
-- =====================================================
-- 1. EXTEND notifications TABLE
-- =====================================================
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS actor_id uuid,
  ADD COLUMN IF NOT EXISTS target_type text,
  ADD COLUMN IF NOT EXISTS target_id uuid,
  ADD COLUMN IF NOT EXISTS dedupe_key text,
  ADD COLUMN IF NOT EXISTS escalated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS metadata jsonb;

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id, read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_dedupe
  ON public.notifications (user_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;

-- =====================================================
-- 2. notification_preferences
-- =====================================================
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id uuid PRIMARY KEY,
  preset text NOT NULL DEFAULT 'standard', -- minimal | standard | high_alert
  mentions boolean NOT NULL DEFAULT true,
  assignments boolean NOT NULL DEFAULT true,
  reviews boolean NOT NULL DEFAULT true,
  events boolean NOT NULL DEFAULT true,
  leadership_alerts boolean NOT NULL DEFAULT true,
  cohort_only boolean NOT NULL DEFAULT false,
  keywords text[] NOT NULL DEFAULT '{}',
  digest_frequency text NOT NULL DEFAULT 'daily', -- off | instant | daily | weekly
  channel_in_app boolean NOT NULL DEFAULT true,
  channel_email boolean NOT NULL DEFAULT true,
  channel_teams boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_view_own_prefs"
  ON public.notification_preferences FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "users_upsert_own_prefs"
  ON public.notification_preferences FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users_update_own_prefs"
  ON public.notification_preferences FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- =====================================================
-- 3. notification_dispatch_log
-- =====================================================
CREATE TABLE IF NOT EXISTS public.notification_dispatch_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid,
  user_id uuid NOT NULL,
  channel text NOT NULL, -- email | teams | digest
  status text NOT NULL,  -- queued | sent | failed | skipped
  error_message text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_dispatch_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_view_own_dispatch"
  ON public.notification_dispatch_log FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

-- =====================================================
-- 4. recent_items
-- =====================================================
CREATE TABLE IF NOT EXISTS public.recent_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  item_type text NOT NULL,
  item_id text NOT NULL,
  label text NOT NULL,
  link text NOT NULL,
  metadata jsonb,
  visited_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_type, item_id)
);

CREATE INDEX IF NOT EXISTS idx_recent_user_visited
  ON public.recent_items (user_id, visited_at DESC);

ALTER TABLE public.recent_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_view_own_recent"
  ON public.recent_items FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "users_insert_own_recent"
  ON public.recent_items FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "users_update_own_recent"
  ON public.recent_items FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "users_delete_own_recent"
  ON public.recent_items FOR DELETE TO authenticated USING (user_id = auth.uid());

-- =====================================================
-- 5. pinned_items
-- =====================================================
CREATE TABLE IF NOT EXISTS public.pinned_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  item_type text NOT NULL,
  item_id text NOT NULL,
  label text NOT NULL,
  link text NOT NULL,
  pinned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_type, item_id)
);

ALTER TABLE public.pinned_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_view_own_pins"
  ON public.pinned_items FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "users_insert_own_pins"
  ON public.pinned_items FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "users_delete_own_pins"
  ON public.pinned_items FOR DELETE TO authenticated USING (user_id = auth.uid());

-- =====================================================
-- 6. escalation_events
-- =====================================================
CREATE TABLE IF NOT EXISTS public.escalation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule text NOT NULL,
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  age_hours numeric,
  notified_user_ids uuid[],
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rule, target_type, target_id)
);

ALTER TABLE public.escalation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leadership_view_escalations"
  ON public.escalation_events FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'project_lead'));

-- =====================================================
-- 7. CORE RPC: create_notification
-- =====================================================
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id uuid,
  p_category text,
  p_title text,
  p_body text DEFAULT NULL,
  p_link text DEFAULT NULL,
  p_actor_id uuid DEFAULT NULL,
  p_target_type text DEFAULT NULL,
  p_target_id uuid DEFAULT NULL,
  p_priority text DEFAULT 'normal',
  p_dedupe_key text DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_prefs RECORD;
  v_allow boolean := true;
BEGIN
  IF p_user_id IS NULL OR p_user_id = p_actor_id THEN
    RETURN NULL; -- never notify self about own action
  END IF;

  -- Load prefs (default = allow)
  SELECT * INTO v_prefs FROM public.notification_preferences WHERE user_id = p_user_id;

  IF v_prefs IS NOT NULL THEN
    v_allow := CASE p_category
      WHEN 'mention' THEN v_prefs.mentions
      WHEN 'assignment' THEN v_prefs.assignments
      WHEN 'review_requested' THEN v_prefs.reviews
      WHEN 'review_approved' THEN v_prefs.reviews
      WHEN 'revision_requested' THEN v_prefs.reviews
      WHEN 'review_rejected' THEN v_prefs.reviews
      WHEN 'event_created' THEN v_prefs.events
      WHEN 'event_updated' THEN v_prefs.events
      WHEN 'event_cancelled' THEN v_prefs.events
      WHEN 'announcement' THEN v_prefs.leadership_alerts
      WHEN 'escalation' THEN true
      ELSE true
    END;
  END IF;

  IF NOT v_allow THEN
    RETURN NULL;
  END IF;

  -- Dedupe within last 24h
  IF p_dedupe_key IS NOT NULL THEN
    SELECT id INTO v_id FROM public.notifications
     WHERE user_id = p_user_id
       AND dedupe_key = p_dedupe_key
       AND created_at > now() - interval '24 hours'
     LIMIT 1;
    IF v_id IS NOT NULL THEN
      RETURN v_id;
    END IF;
  END IF;

  INSERT INTO public.notifications
    (user_id, title, body, link, category, priority, actor_id,
     target_type, target_id, dedupe_key, metadata, read)
  VALUES
    (p_user_id, p_title, p_body, p_link, p_category, p_priority, p_actor_id,
     p_target_type, p_target_id, p_dedupe_key, p_metadata, false)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- =====================================================
-- 8. mark_notifications_read
-- =====================================================
CREATE OR REPLACE FUNCTION public.mark_notifications_read(p_ids uuid[] DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count int;
BEGIN
  IF p_ids IS NULL THEN
    UPDATE public.notifications SET read = true
     WHERE user_id = auth.uid() AND read = false;
  ELSE
    UPDATE public.notifications SET read = true
     WHERE user_id = auth.uid() AND id = ANY(p_ids);
  END IF;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- =====================================================
-- 9. recent_items helpers
-- =====================================================
CREATE OR REPLACE FUNCTION public.track_recent_item(
  p_item_type text, p_item_id text, p_label text, p_link text, p_metadata jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  INSERT INTO public.recent_items (user_id, item_type, item_id, label, link, metadata, visited_at)
  VALUES (auth.uid(), p_item_type, p_item_id, p_label, p_link, p_metadata, now())
  ON CONFLICT (user_id, item_type, item_id)
  DO UPDATE SET visited_at = now(), label = EXCLUDED.label, link = EXCLUDED.link, metadata = EXCLUDED.metadata;

  -- Trim to 30 most recent
  DELETE FROM public.recent_items
   WHERE user_id = auth.uid()
     AND id NOT IN (
       SELECT id FROM public.recent_items
        WHERE user_id = auth.uid()
        ORDER BY visited_at DESC LIMIT 30
     );
END;
$$;

-- =====================================================
-- 10. ASSIGNMENT BUNDLE RPC
-- =====================================================
CREATE OR REPLACE FUNCTION public.create_assignment_bundle(
  p_project_id uuid,
  p_owner_id uuid,
  p_title text,
  p_description text DEFAULT NULL,
  p_due_date date DEFAULT NULL,
  p_reviewer_id uuid DEFAULT NULL,
  p_milestone_id uuid DEFAULT NULL,
  p_priority text DEFAULT 'normal',
  p_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deliv_id uuid;
  v_caller uuid := auth.uid();
BEGIN
  IF NOT public.is_project_lead(v_caller, p_project_id) THEN
    RAISE EXCEPTION 'Only project leads or admins can create assignments';
  END IF;
  IF p_title IS NULL OR length(trim(p_title)) < 2 THEN
    RAISE EXCEPTION 'Title is required';
  END IF;

  INSERT INTO public.deliverables
    (project_id, milestone_id, owner_id, title, description, due_date,
     required, approval_required, approval_status, created_by)
  VALUES
    (p_project_id, p_milestone_id, p_owner_id, p_title, p_description, p_due_date,
     true, true, 'pending', v_caller)
  RETURNING id INTO v_deliv_id;

  -- Notify owner
  PERFORM public.create_notification(
    p_owner_id, 'assignment',
    'New assignment: ' || p_title,
    COALESCE(p_note, p_description),
    '/app/projects/' || p_project_id::text,
    v_caller, 'deliverable', v_deliv_id, p_priority,
    'assign:' || v_deliv_id::text, NULL
  );

  -- Notify reviewer (if provided & different)
  IF p_reviewer_id IS NOT NULL AND p_reviewer_id <> p_owner_id THEN
    PERFORM public.create_notification(
      p_reviewer_id, 'review_requested',
      'You will review: ' || p_title,
      'You are set as reviewer for this deliverable.',
      '/app/projects/' || p_project_id::text,
      v_caller, 'deliverable', v_deliv_id, p_priority,
      'reviewer:' || v_deliv_id::text, NULL
    );
  END IF;

  INSERT INTO public.audit_logs (user_id, action, target_type, target_id, metadata)
  VALUES (v_caller, 'assignment.bundle_created', 'deliverable', v_deliv_id,
          jsonb_build_object('owner_id', p_owner_id, 'reviewer_id', p_reviewer_id, 'priority', p_priority));

  RETURN v_deliv_id;
END;
$$;

-- =====================================================
-- 11. TRIGGERS
-- =====================================================

-- Deliverable status changes -> notify owner
CREATE OR REPLACE FUNCTION public.notify_deliverable_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_link text;
BEGIN
  IF NEW.owner_id IS NULL THEN RETURN NEW; END IF;
  IF OLD.approval_status = NEW.approval_status THEN RETURN NEW; END IF;

  v_link := '/app/projects/' || NEW.project_id::text;

  IF NEW.approval_status = 'approved' THEN
    PERFORM public.create_notification(
      NEW.owner_id, 'review_approved',
      'Approved: ' || NEW.title,
      'Your deliverable was approved.', v_link,
      v_actor, 'deliverable', NEW.id, 'normal',
      'approved:' || NEW.id::text || ':' || NEW.version::text, NULL);
  ELSIF NEW.approval_status = 'revision_requested' THEN
    PERFORM public.create_notification(
      NEW.owner_id, 'revision_requested',
      'Revision requested: ' || NEW.title,
      'Reviewer asked for revisions.', v_link,
      v_actor, 'deliverable', NEW.id, 'high',
      'revision:' || NEW.id::text || ':' || NEW.version::text, NULL);
  ELSIF NEW.approval_status = 'rejected' THEN
    PERFORM public.create_notification(
      NEW.owner_id, 'review_rejected',
      'Rejected: ' || NEW.title,
      'Your deliverable was rejected.', v_link,
      v_actor, 'deliverable', NEW.id, 'high',
      'rejected:' || NEW.id::text || ':' || NEW.version::text, NULL);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_deliverable_status ON public.deliverables;
CREATE TRIGGER trg_notify_deliverable_status
  AFTER UPDATE ON public.deliverables
  FOR EACH ROW EXECUTE FUNCTION public.notify_deliverable_status_change();

-- Deliverable submission (file_url newly populated) -> notify project leads for review
CREATE OR REPLACE FUNCTION public.notify_deliverable_submitted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_lead RECORD;
BEGIN
  IF NEW.file_url IS NULL THEN RETURN NEW; END IF;
  IF OLD.file_url IS NOT DISTINCT FROM NEW.file_url THEN RETURN NEW; END IF;
  IF NOT NEW.approval_required THEN RETURN NEW; END IF;

  FOR v_lead IN
    SELECT user_id FROM public.project_memberships
     WHERE project_id = NEW.project_id AND role_on_project = 'lead'
  LOOP
    PERFORM public.create_notification(
      v_lead.user_id, 'review_requested',
      'Review needed: ' || NEW.title,
      'A submission is awaiting your review.',
      '/app/projects/' || NEW.project_id::text,
      v_actor, 'deliverable', NEW.id, 'high',
      'submit:' || NEW.id::text || ':' || NEW.version::text, NULL);
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_deliverable_submitted ON public.deliverables;
CREATE TRIGGER trg_notify_deliverable_submitted
  AFTER UPDATE ON public.deliverables
  FOR EACH ROW EXECUTE FUNCTION public.notify_deliverable_submitted();

-- Help request assigned -> notify assignee
CREATE OR REPLACE FUNCTION public.notify_help_request_assigned()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_actor uuid := auth.uid();
BEGIN
  IF NEW.assigned_to IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.assigned_to IS NOT DISTINCT FROM NEW.assigned_to THEN
    RETURN NEW;
  END IF;
  PERFORM public.create_notification(
    NEW.assigned_to, 'assignment',
    'Help request: ' || NEW.subject,
    NEW.body, '/app/lead',
    v_actor, 'help_request', NEW.id, 'normal',
    'help:' || NEW.id::text, NULL);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_help_assigned ON public.help_requests;
CREATE TRIGGER trg_notify_help_assigned
  AFTER INSERT OR UPDATE ON public.help_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_help_request_assigned();

-- Mentions in messages
CREATE OR REPLACE FUNCTION public.notify_message_mentions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_uid uuid;
BEGIN
  IF NEW.mentions IS NULL OR array_length(NEW.mentions, 1) IS NULL THEN
    RETURN NEW;
  END IF;
  FOREACH v_uid IN ARRAY NEW.mentions LOOP
    PERFORM public.create_notification(
      v_uid, 'mention',
      'You were mentioned',
      left(NEW.content, 140), '/app/messages',
      NEW.author_id, 'message', NEW.id, 'normal',
      'mention:' || NEW.id::text, NULL);
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_message_mentions ON public.messages;
CREATE TRIGGER trg_notify_message_mentions
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_message_mentions();

-- Event create / cancel -> notify channel members based on audience_scope
CREATE OR REPLACE FUNCTION public.notify_event_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_user RECORD;
  v_cat text;
  v_title text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT NEW.notify_on_create THEN RETURN NEW; END IF;
    v_cat := 'event_created';
    v_title := 'New event: ' || NEW.title;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.cancelled AND NOT OLD.cancelled THEN
      v_cat := 'event_cancelled';
      v_title := 'Cancelled: ' || NEW.title;
    ELSIF (NEW.start_time <> OLD.start_time OR NEW.location IS DISTINCT FROM OLD.location) THEN
      v_cat := 'event_updated';
      v_title := 'Event updated: ' || NEW.title;
    ELSE
      RETURN NEW;
    END IF;
  END IF;

  -- Audience: org-wide if scope='all', cohort if scope='cohort', else creator only
  IF NEW.audience_scope = 'all' THEN
    FOR v_user IN
      SELECT DISTINCT user_id FROM public.user_roles WHERE role <> 'applicant'
    LOOP
      PERFORM public.create_notification(
        v_user.user_id, v_cat, v_title, NEW.description, '/app/events',
        v_actor, 'event', NEW.id, 'normal',
        v_cat || ':' || NEW.id::text, NULL);
    END LOOP;
  ELSIF NEW.audience_scope = 'cohort' AND NEW.audience_target_id IS NOT NULL THEN
    FOR v_user IN
      SELECT user_id FROM public.cohort_memberships WHERE cohort_id = NEW.audience_target_id
    LOOP
      PERFORM public.create_notification(
        v_user.user_id, v_cat, v_title, NEW.description, '/app/events',
        v_actor, 'event', NEW.id, 'normal',
        v_cat || ':' || NEW.id::text, NULL);
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_event_change ON public.events;
CREATE TRIGGER trg_notify_event_change
  AFTER INSERT OR UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.notify_event_change();

-- =====================================================
-- 12. ESCALATION SCAN (called by pg_cron)
-- =====================================================
CREATE OR REPLACE FUNCTION public.run_escalation_scan()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_d RECORD;
  v_lead RECORD;
  v_count_reviews int := 0;
  v_count_help int := 0;
  v_count_leads int := 0;
  v_count_opps int := 0;
  v_admin RECORD;
BEGIN
  -- Stale review submissions (>48h pending after submission)
  FOR v_d IN
    SELECT d.* FROM public.deliverables d
     WHERE d.file_url IS NOT NULL
       AND d.approval_required
       AND d.approval_status = 'pending'
       AND d.updated_at < now() - interval '48 hours'
       AND NOT EXISTS (SELECT 1 FROM public.escalation_events e
                       WHERE e.rule = 'stale_review' AND e.target_id = d.id)
  LOOP
    INSERT INTO public.escalation_events (rule, target_type, target_id, age_hours, metadata)
    VALUES ('stale_review', 'deliverable', v_d.id,
            EXTRACT(epoch FROM (now() - v_d.updated_at))/3600,
            jsonb_build_object('project_id', v_d.project_id, 'title', v_d.title))
    ON CONFLICT DO NOTHING;

    FOR v_lead IN
      SELECT user_id FROM public.project_memberships
       WHERE project_id = v_d.project_id AND role_on_project = 'lead'
    LOOP
      PERFORM public.create_notification(
        v_lead.user_id, 'escalation',
        'Stale review: ' || v_d.title,
        'This submission has been waiting >48h.', '/app/projects/' || v_d.project_id::text,
        NULL, 'deliverable', v_d.id, 'high',
        'esc_review:' || v_d.id::text, NULL);
    END LOOP;
    v_count_reviews := v_count_reviews + 1;
  END LOOP;

  -- Stale help requests (>72h open)
  FOR v_d IN
    SELECT * FROM public.help_requests
     WHERE status = 'open'
       AND created_at < now() - interval '72 hours'
       AND NOT EXISTS (SELECT 1 FROM public.escalation_events e
                       WHERE e.rule = 'stale_help' AND e.target_id = help_requests.id)
  LOOP
    INSERT INTO public.escalation_events (rule, target_type, target_id, age_hours, metadata)
    VALUES ('stale_help', 'help_request', v_d.id,
            EXTRACT(epoch FROM (now() - v_d.created_at))/3600,
            jsonb_build_object('subject', v_d.subject))
    ON CONFLICT DO NOTHING;

    FOR v_admin IN SELECT user_id FROM public.user_roles WHERE role IN ('admin','superadmin')
    LOOP
      PERFORM public.create_notification(
        v_admin.user_id, 'escalation',
        'Help request stuck: ' || v_d.subject,
        'Open >72h with no resolution.', '/app/lead',
        NULL, 'help_request', v_d.id, 'high',
        'esc_help:' || v_d.id::text, NULL);
    END LOOP;
    v_count_help := v_count_help + 1;
  END LOOP;

  -- Untouched leads (>5 days no update)
  FOR v_d IN
    SELECT * FROM public.leads
     WHERE stage NOT IN ('won', 'lost')
       AND updated_at < now() - interval '5 days'
       AND NOT EXISTS (SELECT 1 FROM public.escalation_events e
                       WHERE e.rule = 'stale_lead' AND e.target_id = leads.id
                       AND e.created_at > now() - interval '7 days')
  LOOP
    INSERT INTO public.escalation_events (rule, target_type, target_id, age_hours, metadata)
    VALUES ('stale_lead', 'lead', v_d.id,
            EXTRACT(epoch FROM (now() - v_d.updated_at))/3600,
            jsonb_build_object('contact_name', v_d.contact_name))
    ON CONFLICT DO NOTHING;

    IF v_d.assigned_to IS NOT NULL THEN
      PERFORM public.create_notification(
        v_d.assigned_to, 'escalation',
        'Lead going cold: ' || v_d.contact_name,
        'No update in 5+ days.', '/app/crm',
        NULL, 'lead', v_d.id, 'normal',
        'esc_lead:' || v_d.id::text || ':' || to_char(now(),'YYYYWW'), NULL);
    END IF;
    v_count_leads := v_count_leads + 1;
  END LOOP;

  -- Untriaged opportunities (>3 days in 'new')
  FOR v_d IN
    SELECT * FROM public.opportunities
     WHERE status = 'new'
       AND created_at < now() - interval '3 days'
       AND NOT EXISTS (SELECT 1 FROM public.escalation_events e
                       WHERE e.rule = 'untriaged_opp' AND e.target_id = opportunities.id)
  LOOP
    INSERT INTO public.escalation_events (rule, target_type, target_id, age_hours, metadata)
    VALUES ('untriaged_opp', 'opportunity', v_d.id,
            EXTRACT(epoch FROM (now() - v_d.created_at))/3600,
            jsonb_build_object('title', v_d.title))
    ON CONFLICT DO NOTHING;

    FOR v_admin IN SELECT user_id FROM public.user_roles WHERE role IN ('admin','superadmin')
    LOOP
      PERFORM public.create_notification(
        v_admin.user_id, 'escalation',
        'Opportunity needs triage: ' || v_d.title,
        'Untriaged for 3+ days.', '/app/opportunities',
        NULL, 'opportunity', v_d.id, 'normal',
        'esc_opp:' || v_d.id::text, NULL);
    END LOOP;
    v_count_opps := v_count_opps + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'reviews_escalated', v_count_reviews,
    'help_escalated', v_count_help,
    'leads_escalated', v_count_leads,
    'opportunities_escalated', v_count_opps,
    'ran_at', now()
  );
END;
$$;
