CREATE OR REPLACE FUNCTION public.recommend_drills(
  p_cohort public.drill_cohort DEFAULT NULL,
  p_limit int DEFAULT 6
)
RETURNS TABLE(
  id uuid, title text, cohort public.drill_cohort, category text,
  difficulty public.drill_difficulty, drill_type public.drill_type,
  estimated_minutes int, xp_reward int, reason text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
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
      WHERE cm.user_id = auth.uid()
      LIMIT 1
    )) AS cohort
  ),
  attempted AS (
    SELECT DISTINCT drill_id FROM drill_attempts WHERE user_id = auth.uid()
  ),
  -- Categories the user is weak in: low accuracy with at least 2 attempts.
  weak_skill_cats AS (
    SELECT category
    FROM grind_skill_progress
    WHERE user_id = auth.uid()
      AND attempts >= 2
      AND (correct::numeric / NULLIF(attempts,0)) < 0.6
  ),
  -- Categories the user is strong in: high accuracy with at least 3 attempts.
  strong_skill_cats AS (
    SELECT category
    FROM grind_skill_progress
    WHERE user_id = auth.uid()
      AND attempts >= 3
      AND (correct::numeric / NULLIF(attempts,0)) >= 0.85
  ),
  -- Categories of drills where AI scored the user "weak" recently.
  ai_weak_cats AS (
    SELECT DISTINCT d.category
    FROM drill_ai_feedback f
    JOIN drills d ON d.id = f.drill_id
    WHERE f.user_id = auth.uid()
      AND f.score_band = 'weak'
      AND f.created_at > now() - interval '30 days'
  ),
  -- Free-text "next_skill" hints from recent AI feedback.
  next_skill_hints AS (
    SELECT DISTINCT lower(trim(next_skill)) AS hint
    FROM drill_ai_feedback
    WHERE user_id = auth.uid()
      AND next_skill IS NOT NULL
      AND length(trim(next_skill)) > 0
      AND created_at > now() - interval '30 days'
    LIMIT 20
  )
  SELECT
    d.id, d.title, d.cohort, d.category, d.difficulty, d.drill_type,
    d.estimated_minutes, d.xp_reward,
    CASE
      WHEN d.category IN (SELECT category FROM ai_weak_cats)
        THEN 'Targets a recent weak spot'
      WHEN d.category IN (SELECT category FROM weak_skill_cats)
        THEN 'Strengthens a weaker skill'
      WHEN EXISTS (
        SELECT 1 FROM next_skill_hints h
        WHERE lower(d.category) LIKE '%' || h || '%'
           OR lower(d.title)    LIKE '%' || h || '%'
           OR EXISTS (SELECT 1 FROM unnest(COALESCE(d.tags,'{}'::text[])) t WHERE lower(t) LIKE '%' || h || '%')
      ) THEN 'Matches your suggested next skill'
      WHEN d.id NOT IN (SELECT drill_id FROM attempted) THEN 'New for you'
      ELSE 'Practice again'
    END AS reason
  FROM drills d
  CROSS JOIN user_cohort uc
  WHERE d.status = 'published'
    AND (uc.cohort IS NULL OR d.cohort = uc.cohort)
  ORDER BY
    -- 1) Recent AI "weak" categories first
    (d.category IN (SELECT category FROM ai_weak_cats))::int DESC,
    -- 2) Low-accuracy categories next
    (d.category IN (SELECT category FROM weak_skill_cats))::int DESC,
    -- 3) Next-skill text hints
    (EXISTS (
      SELECT 1 FROM next_skill_hints h
      WHERE lower(d.category) LIKE '%' || h || '%'
         OR lower(d.title)    LIKE '%' || h || '%'
         OR EXISTS (SELECT 1 FROM unnest(COALESCE(d.tags,'{}'::text[])) t WHERE lower(t) LIKE '%' || h || '%')
    ))::int DESC,
    -- 4) Deprioritize already-strong categories
    (d.category IN (SELECT category FROM strong_skill_cats))::int ASC,
    -- 5) Prefer unattempted within each band
    (d.id NOT IN (SELECT drill_id FROM attempted))::int DESC,
    -- 6) Easier first to keep flow
    CASE d.difficulty
      WHEN 'easy' THEN 1 WHEN 'medium' THEN 2 WHEN 'hard' THEN 3 WHEN 'expert' THEN 4
    END,
    random()
  LIMIT p_limit;
$$;