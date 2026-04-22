-- 1. Add ai_feedback_enabled flag to drills
ALTER TABLE public.drills
  ADD COLUMN IF NOT EXISTS ai_feedback_enabled boolean NOT NULL DEFAULT true;

-- 2. Singleton settings table for AI budget controls
CREATE TABLE IF NOT EXISTS public.training_ai_settings (
  id smallint PRIMARY KEY DEFAULT 1,
  monthly_call_cap integer NOT NULL DEFAULT 500,
  per_user_daily_cap integer NOT NULL DEFAULT 5,
  enabled_drill_types text[] NOT NULL DEFAULT ARRAY['short_answer','scenario_analysis','debugging_diagnosis','design_critique','mini_case'],
  current_month text NOT NULL DEFAULT to_char(now(), 'YYYY-MM'),
  current_month_calls integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT training_ai_settings_singleton CHECK (id = 1)
);

INSERT INTO public.training_ai_settings (id) VALUES (1)
  ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.training_ai_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone signed in can read training AI settings"
  ON public.training_ai_settings FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can update training AI settings"
  ON public.training_ai_settings FOR UPDATE
  TO authenticated USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- 3. Per-call usage log
CREATE TABLE IF NOT EXISTS public.training_ai_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  drill_id uuid REFERENCES public.drills(id) ON DELETE SET NULL,
  attempt_id uuid REFERENCES public.drill_attempts(id) ON DELETE SET NULL,
  cohort drill_cohort,
  drill_type drill_type,
  month text NOT NULL DEFAULT to_char(now(), 'YYYY-MM'),
  estimated_tokens integer,
  fallback_used boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_training_ai_usage_user_month
  ON public.training_ai_usage (user_id, month);
CREATE INDEX IF NOT EXISTS idx_training_ai_usage_month
  ON public.training_ai_usage (month);

ALTER TABLE public.training_ai_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own AI usage"
  ON public.training_ai_usage FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all AI usage"
  ON public.training_ai_usage FOR SELECT
  TO authenticated USING (public.is_admin(auth.uid()));

-- 4. Stored AI feedback per attempt
CREATE TABLE IF NOT EXISTS public.drill_ai_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES public.drill_attempts(id) ON DELETE CASCADE,
  drill_id uuid NOT NULL REFERENCES public.drills(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  score_band text NOT NULL,
  strengths text[] NOT NULL DEFAULT '{}',
  improvements text[] NOT NULL DEFAULT '{}',
  next_skill text,
  raw_response jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_drill_ai_feedback_user
  ON public.drill_ai_feedback (user_id);
CREATE INDEX IF NOT EXISTS idx_drill_ai_feedback_attempt
  ON public.drill_ai_feedback (attempt_id);

ALTER TABLE public.drill_ai_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own AI feedback"
  ON public.drill_ai_feedback FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all AI feedback"
  ON public.drill_ai_feedback FOR SELECT
  TO authenticated USING (public.is_admin(auth.uid()));

-- 5. Helper RPC: how many AI calls this user has made today
CREATE OR REPLACE FUNCTION public.training_ai_user_today_count(p_user uuid)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT count(*)::int FROM public.training_ai_usage
   WHERE user_id = p_user
     AND fallback_used = false
     AND created_at >= date_trunc('day', now());
$$;

-- 6. Admin usage summary view (callable by admins via RPC)
CREATE OR REPLACE FUNCTION public.training_ai_usage_summary()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_settings RECORD;
  v_month_calls int;
  v_today_calls int;
  v_by_cohort jsonb;
  v_by_type jsonb;
  v_pending_review int;
  v_published int;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  SELECT * INTO v_settings FROM public.training_ai_settings WHERE id = 1;

  SELECT count(*) INTO v_month_calls FROM public.training_ai_usage
   WHERE month = to_char(now(), 'YYYY-MM') AND fallback_used = false;

  SELECT count(*) INTO v_today_calls FROM public.training_ai_usage
   WHERE created_at >= date_trunc('day', now()) AND fallback_used = false;

  SELECT COALESCE(jsonb_object_agg(cohort, c), '{}'::jsonb) INTO v_by_cohort FROM (
    SELECT cohort::text AS cohort, count(*) AS c FROM public.training_ai_usage
     WHERE month = to_char(now(), 'YYYY-MM') AND fallback_used = false
     GROUP BY cohort
  ) s;

  SELECT COALESCE(jsonb_object_agg(drill_type, c), '{}'::jsonb) INTO v_by_type FROM (
    SELECT drill_type::text AS drill_type, count(*) AS c FROM public.training_ai_usage
     WHERE month = to_char(now(), 'YYYY-MM') AND fallback_used = false
     GROUP BY drill_type
  ) s;

  SELECT count(*) INTO v_pending_review FROM public.drills WHERE status = 'pending_review';
  SELECT count(*) INTO v_published FROM public.drills WHERE status = 'published';

  RETURN jsonb_build_object(
    'monthly_cap', v_settings.monthly_call_cap,
    'per_user_daily_cap', v_settings.per_user_daily_cap,
    'enabled_drill_types', v_settings.enabled_drill_types,
    'month', to_char(now(), 'YYYY-MM'),
    'month_calls', v_month_calls,
    'today_calls', v_today_calls,
    'by_cohort', v_by_cohort,
    'by_type', v_by_type,
    'cap_remaining', GREATEST(v_settings.monthly_call_cap - v_month_calls, 0),
    'cap_reached', v_month_calls >= v_settings.monthly_call_cap,
    'drills_pending_review', v_pending_review,
    'drills_published', v_published
  );
END;
$$;