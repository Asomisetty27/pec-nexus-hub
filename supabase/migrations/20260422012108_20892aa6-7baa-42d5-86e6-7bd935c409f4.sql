-- =====================================================
-- DECISION MEMORY
-- =====================================================
ALTER TABLE public.decisions
  ADD COLUMN IF NOT EXISTS alternatives_considered text DEFAULT '',
  ADD COLUMN IF NOT EXISTS affects text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_decisions_category ON public.decisions(category);
CREATE INDEX IF NOT EXISTS idx_decisions_tags ON public.decisions USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_decisions_affects ON public.decisions USING GIN(affects);

DROP POLICY IF EXISTS dec_update ON public.decisions;
CREATE POLICY dec_update ON public.decisions
  FOR UPDATE TO public
  USING (auth.uid() = decided_by OR is_admin(auth.uid()))
  WITH CHECK (auth.uid() = decided_by OR is_admin(auth.uid()));

-- Helper: count overlapping tag elements
CREATE OR REPLACE FUNCTION public.array_overlap_count(a text[], b text[])
RETURNS int
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT COALESCE(cardinality(ARRAY(SELECT unnest(a) INTERSECT SELECT unnest(b))), 0);
$$;

CREATE OR REPLACE FUNCTION public.find_related_decisions(
  _project_id uuid,
  _tags text[] DEFAULT NULL,
  _category text DEFAULT NULL,
  _limit int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  project_id uuid,
  title text,
  rationale text,
  category text,
  tags text[],
  decided_at timestamptz,
  relevance int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    d.id,
    d.project_id,
    d.title,
    d.rationale,
    d.category,
    d.tags,
    d.decided_at,
    (
      CASE WHEN _tags IS NOT NULL THEN public.array_overlap_count(d.tags, _tags) * 3 ELSE 0 END
      + CASE WHEN _category IS NOT NULL AND d.category = _category THEN 2 ELSE 0 END
    )::int AS relevance
  FROM public.decisions d
  WHERE
    (_project_id IS NULL OR d.project_id != _project_id)
    AND d.status = 'active'
    AND (
      (_tags IS NOT NULL AND d.tags && _tags)
      OR (_category IS NOT NULL AND d.category = _category)
    )
  ORDER BY relevance DESC, d.decided_at DESC
  LIMIT _limit;
$$;

-- =====================================================
-- AUTO-BRIEFS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.meeting_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  generated_by uuid NOT NULL,
  brief_markdown text NOT NULL,
  source_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  model text DEFAULT 'google/gemini-2.5-flash',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meeting_briefs_event ON public.meeting_briefs(event_id, created_at DESC);

ALTER TABLE public.meeting_briefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY mb_select ON public.meeting_briefs
  FOR SELECT TO authenticated
  USING (
    is_admin(auth.uid())
    OR is_advisor(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = meeting_briefs.event_id
        AND (e.created_by = auth.uid() OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()))
    )
  );

CREATE POLICY mb_insert ON public.meeting_briefs
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = generated_by);

-- =====================================================
-- MOMENTUM RISK
-- =====================================================
CREATE TABLE IF NOT EXISTS public.momentum_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  risk_score int NOT NULL DEFAULT 0,
  risk_level text NOT NULL DEFAULT 'healthy',
  signals jsonb NOT NULL DEFAULT '{}'::jsonb,
  computed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_momentum_project ON public.momentum_signals(project_id, computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_momentum_risk ON public.momentum_signals(risk_level, computed_at DESC);

ALTER TABLE public.momentum_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY ms_select ON public.momentum_signals
  FOR SELECT TO authenticated
  USING (
    is_admin(auth.uid())
    OR is_advisor(auth.uid())
    OR has_role(auth.uid(), 'project_lead'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.project_memberships pm
      WHERE pm.project_id = momentum_signals.project_id
        AND pm.user_id = auth.uid()
        AND pm.role_on_project IN ('lead', 'pm')
    )
  );

CREATE OR REPLACE FUNCTION public.compute_momentum_risk(_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_days_since_update int;
  v_overdue int;
  v_blocked int;
  v_open_help int;
  v_pending_reviews int;
  v_score int := 0;
  v_level text;
  v_signals jsonb;
BEGIN
  SELECT COALESCE(EXTRACT(DAY FROM now() - GREATEST(
    COALESCE((SELECT MAX(created_at) FROM public.project_updates WHERE project_id = _project_id), 'epoch'::timestamptz),
    COALESCE((SELECT MAX(updated_at) FROM public.deliverables WHERE project_id = _project_id), 'epoch'::timestamptz)
  ))::int, 999) INTO v_days_since_update;

  SELECT COUNT(*) INTO v_overdue FROM public.deliverables
    WHERE project_id = _project_id AND due_date < CURRENT_DATE AND approval_status != 'approved';

  SELECT COUNT(*) INTO v_blocked FROM public.project_stages
    WHERE project_id = _project_id AND status = 'blocked';

  SELECT COUNT(*) INTO v_open_help FROM public.help_requests hr
    WHERE hr.status = 'open'
      AND EXISTS (
        SELECT 1 FROM public.project_memberships pm
        WHERE pm.project_id = _project_id AND pm.user_id = hr.requester_id
      );

  SELECT COUNT(*) INTO v_pending_reviews FROM public.deliverables
    WHERE project_id = _project_id
      AND approval_status = 'pending'
      AND approval_required = true
      AND updated_at < now() - interval '48 hours';

  v_score := LEAST(100,
    LEAST(v_days_since_update, 30) * 2
    + LEAST(v_overdue, 10) * 4
    + LEAST(v_blocked, 5) * 6
    + LEAST(v_open_help, 5) * 3
    + LEAST(v_pending_reviews, 5) * 4
  );

  v_level := CASE
    WHEN v_score >= 70 THEN 'stalled'
    WHEN v_score >= 45 THEN 'at_risk'
    WHEN v_score >= 20 THEN 'watch'
    ELSE 'healthy'
  END;

  v_signals := jsonb_build_object(
    'days_since_update', v_days_since_update,
    'overdue_deliverables', v_overdue,
    'blocked_stages', v_blocked,
    'open_help_requests', v_open_help,
    'stale_pending_reviews', v_pending_reviews
  );

  INSERT INTO public.momentum_signals (project_id, risk_score, risk_level, signals)
  VALUES (_project_id, v_score, v_level, v_signals);

  RETURN jsonb_build_object('score', v_score, 'level', v_level, 'signals', v_signals);
END;
$$;

CREATE OR REPLACE FUNCTION public.run_momentum_scan()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project record;
  v_count int := 0;
  v_at_risk int := 0;
BEGIN
  DELETE FROM public.momentum_signals WHERE computed_at < now() - interval '30 days';

  FOR v_project IN SELECT id FROM public.projects WHERE status = 'active' LOOP
    PERFORM public.compute_momentum_risk(v_project.id);
    v_count := v_count + 1;
  END LOOP;

  SELECT COUNT(*) INTO v_at_risk
  FROM (
    SELECT DISTINCT ON (project_id) project_id, risk_level
    FROM public.momentum_signals
    ORDER BY project_id, computed_at DESC
  ) latest
  WHERE risk_level IN ('at_risk', 'stalled');

  INSERT INTO public.notifications (user_id, category, priority, title, body, link, target_type, target_id, dedupe_key)
  SELECT
    ur.user_id,
    'leadership_alert',
    'high',
    'Project at risk: ' || p.name,
    'Momentum scan flagged this project as ' || latest.risk_level,
    '/app/projects/' || p.id,
    'project',
    p.id,
    'momentum:' || p.id::text || ':' || latest.risk_level || ':' || to_char(now(), 'YYYY-MM-DD')
  FROM (
    SELECT DISTINCT ON (project_id) project_id, risk_level, computed_at
    FROM public.momentum_signals
    WHERE computed_at > now() - interval '20 minutes'
    ORDER BY project_id, computed_at DESC
  ) latest
  JOIN public.projects p ON p.id = latest.project_id
  CROSS JOIN public.user_roles ur
  WHERE latest.risk_level = 'stalled'
    AND ur.role IN ('admin', 'superadmin', 'project_lead')
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object('scanned', v_count, 'at_risk_or_stalled', v_at_risk);
END;
$$;

-- =====================================================
-- ASK NEXUS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.ask_nexus_query_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  query_key text NOT NULL,
  result_count int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ask_log_user ON public.ask_nexus_query_log(user_id, created_at DESC);

ALTER TABLE public.ask_nexus_query_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY anq_insert_self ON public.ask_nexus_query_log
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY anq_select_admin ON public.ask_nexus_query_log
  FOR SELECT TO authenticated
  USING (is_admin(auth.uid()) OR auth.uid() = user_id);

-- =====================================================
-- Schedule momentum scan every 30 minutes
-- =====================================================
DO $$ BEGIN
  PERFORM cron.unschedule('momentum-scan-30m');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'momentum-scan-30m',
  '*/30 * * * *',
  $$ SELECT public.run_momentum_scan(); $$
);