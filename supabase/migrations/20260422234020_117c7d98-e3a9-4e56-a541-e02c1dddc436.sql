-- ============================================================
-- Training freshness: themes + challenges + lane recommenders
-- ============================================================

-- Theme weeks: admin curates a rotating focus area for a cohort
CREATE TABLE IF NOT EXISTS public.training_themes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort public.drill_cohort NOT NULL,
  name text NOT NULL,
  description text,
  category_filter text[] NOT NULL DEFAULT '{}',
  starts_on date NOT NULL DEFAULT CURRENT_DATE,
  ends_on date NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_training_themes_cohort_dates
  ON public.training_themes (cohort, starts_on, ends_on);

ALTER TABLE public.training_themes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Themes readable by members"
  ON public.training_themes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage themes"
  ON public.training_themes FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Challenges: time-boxed bonus surfaces
CREATE TABLE IF NOT EXISTS public.training_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort public.drill_cohort NOT NULL,
  name text NOT NULL,
  description text,
  category_filter text[] NOT NULL DEFAULT '{}',
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  bonus_xp_multiplier numeric NOT NULL DEFAULT 1.0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_training_challenges_cohort_window
  ON public.training_challenges (cohort, starts_at, ends_at);

ALTER TABLE public.training_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Challenges readable by members"
  ON public.training_challenges FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage challenges"
  ON public.training_challenges FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ============================================================
-- Lane recommenders (all deterministic, zero AI)
-- ============================================================

-- Weak skills lane: low-accuracy categories + AI-flagged weak categories.
CREATE OR REPLACE FUNCTION public.recommend_weak_skill_drills(
  p_cohort public.drill_cohort DEFAULT NULL,
  p_limit int DEFAULT 4
) RETURNS TABLE(
  id uuid, title text, cohort public.drill_cohort, category text,
  difficulty public.drill_difficulty, drill_type public.drill_type,
  estimated_minutes int, xp_reward int, reason text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH user_cohort AS (
    SELECT COALESCE(p_cohort, (
      SELECT CASE
        WHEN c.name ILIKE 'Software%'   THEN 'software'::drill_cohort
        WHEN c.name ILIKE 'Hardware%'   THEN 'hardware'::drill_cohort
        WHEN c.name ILIKE 'Mechanical%' THEN 'mechanical'::drill_cohort
        WHEN c.name ILIKE 'Ops%'        THEN 'ops'::drill_cohort
      END
      FROM cohort_memberships cm
      JOIN cohorts c ON c.id = cm.cohort_id
      WHERE cm.user_id = auth.uid() LIMIT 1
    )) AS cohort
  ),
  weak_cats AS (
    SELECT category, 'low_accuracy'::text AS source
    FROM grind_skill_progress
    WHERE user_id = auth.uid()
      AND attempts >= 2
      AND (correct::numeric / NULLIF(attempts,0)) < 0.6
    UNION
    SELECT DISTINCT d.category, 'ai_weak'::text
    FROM drill_ai_feedback f
    JOIN drills d ON d.id = f.drill_id
    WHERE f.user_id = auth.uid()
      AND f.score_band = 'weak'
      AND f.created_at > now() - interval '30 days'
  )
  SELECT d.id, d.title, d.cohort, d.category, d.difficulty, d.drill_type,
         d.estimated_minutes, d.xp_reward,
         'Strengthens a weak skill' AS reason
  FROM drills d
  CROSS JOIN user_cohort uc
  WHERE d.status = 'published'
    AND (uc.cohort IS NULL OR d.cohort = uc.cohort)
    AND d.category IN (SELECT category FROM weak_cats)
  ORDER BY random()
  LIMIT p_limit;
$$;

-- Theme lane: drills matching the cohort's currently active theme.
CREATE OR REPLACE FUNCTION public.recommend_theme_drills(
  p_cohort public.drill_cohort DEFAULT NULL,
  p_limit int DEFAULT 4
) RETURNS TABLE(
  id uuid, title text, cohort public.drill_cohort, category text,
  difficulty public.drill_difficulty, drill_type public.drill_type,
  estimated_minutes int, xp_reward int, reason text,
  theme_name text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH user_cohort AS (
    SELECT COALESCE(p_cohort, (
      SELECT CASE
        WHEN c.name ILIKE 'Software%'   THEN 'software'::drill_cohort
        WHEN c.name ILIKE 'Hardware%'   THEN 'hardware'::drill_cohort
        WHEN c.name ILIKE 'Mechanical%' THEN 'mechanical'::drill_cohort
        WHEN c.name ILIKE 'Ops%'        THEN 'ops'::drill_cohort
      END
      FROM cohort_memberships cm
      JOIN cohorts c ON c.id = cm.cohort_id
      WHERE cm.user_id = auth.uid() LIMIT 1
    )) AS cohort
  ),
  active_theme AS (
    SELECT t.* FROM training_themes t, user_cohort uc
    WHERE (uc.cohort IS NULL OR t.cohort = uc.cohort)
      AND CURRENT_DATE BETWEEN t.starts_on AND t.ends_on
    ORDER BY t.starts_on DESC LIMIT 1
  )
  SELECT d.id, d.title, d.cohort, d.category, d.difficulty, d.drill_type,
         d.estimated_minutes, d.xp_reward,
         ('Part of: ' || at.name) AS reason,
         at.name AS theme_name
  FROM drills d
  CROSS JOIN active_theme at
  WHERE d.status = 'published'
    AND d.cohort = at.cohort
    AND (
      cardinality(at.category_filter) = 0
      OR d.category = ANY(at.category_filter)
    )
  ORDER BY random()
  LIMIT p_limit;
$$;

-- Challenge lane: drills inside an active challenge window.
CREATE OR REPLACE FUNCTION public.recommend_challenge_drills(
  p_cohort public.drill_cohort DEFAULT NULL,
  p_limit int DEFAULT 4
) RETURNS TABLE(
  id uuid, title text, cohort public.drill_cohort, category text,
  difficulty public.drill_difficulty, drill_type public.drill_type,
  estimated_minutes int, xp_reward int, reason text,
  challenge_name text, ends_at timestamptz, bonus_xp_multiplier numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH user_cohort AS (
    SELECT COALESCE(p_cohort, (
      SELECT CASE
        WHEN c.name ILIKE 'Software%'   THEN 'software'::drill_cohort
        WHEN c.name ILIKE 'Hardware%'   THEN 'hardware'::drill_cohort
        WHEN c.name ILIKE 'Mechanical%' THEN 'mechanical'::drill_cohort
        WHEN c.name ILIKE 'Ops%'        THEN 'ops'::drill_cohort
      END
      FROM cohort_memberships cm
      JOIN cohorts c ON c.id = cm.cohort_id
      WHERE cm.user_id = auth.uid() LIMIT 1
    )) AS cohort
  ),
  active_challenge AS (
    SELECT t.* FROM training_challenges t, user_cohort uc
    WHERE (uc.cohort IS NULL OR t.cohort = uc.cohort)
      AND now() BETWEEN t.starts_at AND t.ends_at
    ORDER BY t.starts_at DESC LIMIT 1
  )
  SELECT d.id, d.title, d.cohort, d.category, d.difficulty, d.drill_type,
         d.estimated_minutes, d.xp_reward,
         ('Challenge: ' || ac.name) AS reason,
         ac.name AS challenge_name,
         ac.ends_at,
         ac.bonus_xp_multiplier
  FROM drills d
  CROSS JOIN active_challenge ac
  WHERE d.status = 'published'
    AND d.cohort = ac.cohort
    AND (
      cardinality(ac.category_filter) = 0
      OR d.category = ANY(ac.category_filter)
    )
  ORDER BY random()
  LIMIT p_limit;
$$;