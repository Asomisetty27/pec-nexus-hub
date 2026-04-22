CREATE TABLE IF NOT EXISTS public.feedback_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  feature text NOT NULL,
  context_type text,
  context_id text,
  rating text NOT NULL CHECK (rating IN ('positive','neutral','negative')),
  tag text,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedback_events_feature_created
  ON public.feedback_events (feature, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_feedback_events_user_feature_created
  ON public.feedback_events (user_id, feature, created_at DESC);

ALTER TABLE public.feedback_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users insert own feedback"
ON public.feedback_events FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users read own feedback"
ON public.feedback_events FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "admins read all feedback"
ON public.feedback_events FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.feedback_summary(p_days integer DEFAULT 30)
RETURNS TABLE (
  feature text,
  total bigint,
  positive bigint,
  neutral bigint,
  negative bigint,
  positive_pct numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    feature,
    COUNT(*)::bigint AS total,
    COUNT(*) FILTER (WHERE rating = 'positive')::bigint AS positive,
    COUNT(*) FILTER (WHERE rating = 'neutral')::bigint  AS neutral,
    COUNT(*) FILTER (WHERE rating = 'negative')::bigint AS negative,
    ROUND(100.0 * COUNT(*) FILTER (WHERE rating = 'positive') / NULLIF(COUNT(*),0), 1) AS positive_pct
  FROM public.feedback_events
  WHERE created_at > now() - make_interval(days => p_days)
    AND public.is_admin(auth.uid())
  GROUP BY feature
  ORDER BY total DESC;
$$;