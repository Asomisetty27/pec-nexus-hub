
-- ============================================================
-- Cohort Grind OS — full data model
-- ============================================================

-- Enums
CREATE TYPE public.drill_type AS ENUM (
  'multiple_choice',
  'short_answer',
  'scenario',
  'prioritization',
  'debugging',
  'design_critique',
  'mini_case'
);

CREATE TYPE public.drill_difficulty AS ENUM ('easy', 'medium', 'hard', 'expert');

CREATE TYPE public.drill_status AS ENUM ('draft', 'pending_review', 'published', 'archived');

CREATE TYPE public.drill_source AS ENUM ('seeded', 'ai_generated', 'admin_created');

CREATE TYPE public.drill_cohort AS ENUM ('software', 'hardware', 'mechanical', 'ops');

-- Drills table (canonical bank of training prompts)
CREATE TABLE public.drills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  cohort public.drill_cohort NOT NULL,
  category text NOT NULL,
  difficulty public.drill_difficulty NOT NULL DEFAULT 'medium',
  drill_type public.drill_type NOT NULL,
  tags text[] DEFAULT '{}',
  estimated_minutes int NOT NULL DEFAULT 10,
  prompt text NOT NULL,
  scenario text,
  options jsonb,                   -- for multiple_choice / prioritization
  correct_answer jsonb,            -- canonical answer (option key, ordered list, etc.)
  rubric text,                     -- short scoring rubric
  model_answer text,               -- exemplar answer / explanation
  why_it_matters text,             -- industry relevance
  source public.drill_source NOT NULL DEFAULT 'seeded',
  status public.drill_status NOT NULL DEFAULT 'published',
  xp_reward int NOT NULL DEFAULT 10,
  created_by uuid,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_drills_cohort_status ON public.drills(cohort, status);
CREATE INDEX idx_drills_difficulty ON public.drills(difficulty);
CREATE INDEX idx_drills_tags ON public.drills USING GIN(tags);

-- Attempts
CREATE TABLE public.drill_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drill_id uuid NOT NULL REFERENCES public.drills(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  response jsonb,                   -- user's submission
  is_correct boolean,               -- nullable for open-ended
  self_score int,                   -- 0-100 self-assessment after seeing rubric
  time_spent_seconds int,
  xp_earned int NOT NULL DEFAULT 0,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_drill_attempts_user ON public.drill_attempts(user_id, attempted_at DESC);
CREATE INDEX idx_drill_attempts_drill ON public.drill_attempts(drill_id);

-- User progress (XP, streak, level)
CREATE TABLE public.grind_progress (
  user_id uuid PRIMARY KEY,
  total_xp int NOT NULL DEFAULT 0,
  current_streak int NOT NULL DEFAULT 0,
  longest_streak int NOT NULL DEFAULT 0,
  last_attempt_date date,
  drills_completed int NOT NULL DEFAULT 0,
  drills_correct int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Per-cohort/category skill tracking (for leadership view)
CREATE TABLE public.grind_skill_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  cohort public.drill_cohort NOT NULL,
  category text NOT NULL,
  attempts int NOT NULL DEFAULT 0,
  correct int NOT NULL DEFAULT 0,
  total_xp int NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, cohort, category)
);

CREATE INDEX idx_grind_skill_progress_user ON public.grind_skill_progress(user_id);
CREATE INDEX idx_grind_skill_progress_cohort_cat ON public.grind_skill_progress(cohort, category);

-- AI generation jobs (admin-triggered batches)
CREATE TABLE public.drill_generation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by uuid NOT NULL,
  cohort public.drill_cohort NOT NULL,
  category text NOT NULL,
  difficulty public.drill_difficulty NOT NULL,
  drill_type public.drill_type NOT NULL,
  count_requested int NOT NULL DEFAULT 5,
  status text NOT NULL DEFAULT 'pending', -- pending, running, completed, failed
  error_message text,
  drafts_created int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.drills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drill_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grind_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grind_skill_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drill_generation_jobs ENABLE ROW LEVEL SECURITY;

-- Drills: published visible to all active members; drafts only to admins
CREATE POLICY "Members view published drills" ON public.drills
  FOR SELECT TO authenticated
  USING (status = 'published' AND public.is_active_member(auth.uid()));

CREATE POLICY "Admins view all drills" ON public.drills
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins insert drills" ON public.drills
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins update drills" ON public.drills
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins delete drills" ON public.drills
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- Attempts: users see/insert their own; admins/leads see all
CREATE POLICY "Users view own attempts" ON public.drill_attempts
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'project_lead'));

CREATE POLICY "Users insert own attempts" ON public.drill_attempts
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Progress: users see own, leadership sees all
CREATE POLICY "View own progress" ON public.grind_progress
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'project_lead') OR public.is_board_or_admin(auth.uid()));

CREATE POLICY "Insert own progress" ON public.grind_progress
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Update own progress" ON public.grind_progress
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- Skill progress: same visibility as progress
CREATE POLICY "View skill progress" ON public.grind_skill_progress
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'project_lead') OR public.is_board_or_admin(auth.uid()));

CREATE POLICY "Insert own skill progress" ON public.grind_skill_progress
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Update own skill progress" ON public.grind_skill_progress
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- Generation jobs: admin only
CREATE POLICY "Admins manage generation jobs" ON public.drill_generation_jobs
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ============================================================
-- Functions
-- ============================================================

-- Atomic submit: records attempt, awards XP, updates progress + streak + skill
CREATE OR REPLACE FUNCTION public.submit_drill_attempt(
  p_drill_id uuid,
  p_response jsonb,
  p_is_correct boolean,
  p_self_score int DEFAULT NULL,
  p_time_spent_seconds int DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_drill RECORD;
  v_xp int;
  v_attempt_id uuid;
  v_today date := CURRENT_DATE;
  v_prog RECORD;
  v_new_streak int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_drill FROM public.drills WHERE id = p_drill_id AND status = 'published';
  IF v_drill IS NULL THEN RAISE EXCEPTION 'Drill not available'; END IF;

  -- XP: full reward if correct or self_score>=70; half otherwise
  v_xp := CASE
    WHEN p_is_correct = true THEN v_drill.xp_reward
    WHEN COALESCE(p_self_score, 0) >= 70 THEN v_drill.xp_reward
    WHEN COALESCE(p_self_score, 0) >= 40 THEN GREATEST(1, v_drill.xp_reward / 2)
    ELSE GREATEST(1, v_drill.xp_reward / 4)
  END;

  INSERT INTO public.drill_attempts
    (drill_id, user_id, response, is_correct, self_score, time_spent_seconds, xp_earned)
  VALUES
    (p_drill_id, v_uid, p_response, p_is_correct, p_self_score, p_time_spent_seconds, v_xp)
  RETURNING id INTO v_attempt_id;

  -- Upsert progress / streak
  INSERT INTO public.grind_progress (user_id, total_xp, current_streak, longest_streak,
                                     last_attempt_date, drills_completed, drills_correct)
  VALUES (v_uid, v_xp, 1, 1, v_today, 1, CASE WHEN COALESCE(p_is_correct,false) THEN 1 ELSE 0 END)
  ON CONFLICT (user_id) DO UPDATE
  SET total_xp = grind_progress.total_xp + v_xp,
      current_streak = CASE
        WHEN grind_progress.last_attempt_date = v_today THEN grind_progress.current_streak
        WHEN grind_progress.last_attempt_date = v_today - 1 THEN grind_progress.current_streak + 1
        ELSE 1
      END,
      longest_streak = GREATEST(
        grind_progress.longest_streak,
        CASE
          WHEN grind_progress.last_attempt_date = v_today THEN grind_progress.current_streak
          WHEN grind_progress.last_attempt_date = v_today - 1 THEN grind_progress.current_streak + 1
          ELSE 1
        END
      ),
      last_attempt_date = v_today,
      drills_completed = grind_progress.drills_completed + 1,
      drills_correct = grind_progress.drills_correct + CASE WHEN COALESCE(p_is_correct,false) THEN 1 ELSE 0 END,
      updated_at = now();

  -- Skill progress
  INSERT INTO public.grind_skill_progress (user_id, cohort, category, attempts, correct, total_xp, last_attempt_at)
  VALUES (v_uid, v_drill.cohort, v_drill.category, 1,
          CASE WHEN COALESCE(p_is_correct,false) THEN 1 ELSE 0 END, v_xp, now())
  ON CONFLICT (user_id, cohort, category) DO UPDATE
  SET attempts = grind_skill_progress.attempts + 1,
      correct = grind_skill_progress.correct + CASE WHEN COALESCE(p_is_correct,false) THEN 1 ELSE 0 END,
      total_xp = grind_skill_progress.total_xp + v_xp,
      last_attempt_at = now(),
      updated_at = now();

  SELECT * INTO v_prog FROM public.grind_progress WHERE user_id = v_uid;

  RETURN jsonb_build_object(
    'attempt_id', v_attempt_id,
    'xp_earned', v_xp,
    'total_xp', v_prog.total_xp,
    'current_streak', v_prog.current_streak,
    'longest_streak', v_prog.longest_streak,
    'level', GREATEST(1, (v_prog.total_xp / 100) + 1)
  );
END;
$$;

-- Recommendations: weak categories first, then unattempted, then by difficulty progression
CREATE OR REPLACE FUNCTION public.recommend_drills(p_cohort public.drill_cohort DEFAULT NULL, p_limit int DEFAULT 6)
RETURNS TABLE(
  id uuid, title text, cohort public.drill_cohort, category text,
  difficulty public.drill_difficulty, drill_type public.drill_type,
  estimated_minutes int, xp_reward int, reason text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH user_cohort AS (
    SELECT COALESCE(p_cohort, (
      SELECT CASE
        WHEN c.name ILIKE 'Software%' THEN 'software'::drill_cohort
        WHEN c.name ILIKE 'Hardware%' THEN 'hardware'::drill_cohort
        WHEN c.name ILIKE 'Mechanical%' THEN 'mechanical'::drill_cohort
        WHEN c.name ILIKE 'Ops%' THEN 'ops'::drill_cohort
      END
      FROM cohort_memberships cm
      JOIN cohorts c ON c.id = cm.cohort_id
      WHERE cm.user_id = auth.uid()
      LIMIT 1
    )) AS cohort
  ),
  attempted AS (
    SELECT DISTINCT drill_id FROM drill_attempts WHERE user_id = auth.uid()
  )
  SELECT
    d.id, d.title, d.cohort, d.category, d.difficulty, d.drill_type,
    d.estimated_minutes, d.xp_reward,
    CASE
      WHEN d.id NOT IN (SELECT drill_id FROM attempted) THEN 'New for you'
      ELSE 'Practice again'
    END AS reason
  FROM drills d
  CROSS JOIN user_cohort uc
  WHERE d.status = 'published'
    AND (uc.cohort IS NULL OR d.cohort = uc.cohort)
  ORDER BY
    (d.id NOT IN (SELECT drill_id FROM attempted))::int DESC,
    CASE d.difficulty
      WHEN 'easy' THEN 1
      WHEN 'medium' THEN 2
      WHEN 'hard' THEN 3
      WHEN 'expert' THEN 4
    END,
    random()
  LIMIT p_limit;
$$;

-- Leaderboard
CREATE OR REPLACE FUNCTION public.grind_leaderboard(p_cohort public.drill_cohort DEFAULT NULL, p_limit int DEFAULT 25)
RETURNS TABLE(
  user_id uuid, full_name text, total_xp int, current_streak int,
  drills_completed int, accuracy numeric, rank int
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    gp.user_id,
    p.full_name,
    gp.total_xp,
    gp.current_streak,
    gp.drills_completed,
    CASE WHEN gp.drills_completed > 0
      THEN ROUND(100.0 * gp.drills_correct / gp.drills_completed, 1)
      ELSE 0 END AS accuracy,
    (ROW_NUMBER() OVER (ORDER BY gp.total_xp DESC))::int AS rank
  FROM grind_progress gp
  JOIN profiles p ON p.user_id = gp.user_id
  WHERE p_cohort IS NULL OR EXISTS (
    SELECT 1 FROM cohort_memberships cm
    JOIN cohorts c ON c.id = cm.cohort_id
    WHERE cm.user_id = gp.user_id
      AND CASE
        WHEN c.name ILIKE 'Software%' THEN 'software'::drill_cohort
        WHEN c.name ILIKE 'Hardware%' THEN 'hardware'::drill_cohort
        WHEN c.name ILIKE 'Mechanical%' THEN 'mechanical'::drill_cohort
        WHEN c.name ILIKE 'Ops%' THEN 'ops'::drill_cohort
      END = p_cohort
  )
  ORDER BY gp.total_xp DESC
  LIMIT p_limit;
$$;

-- Trigger: keep updated_at fresh on drills
CREATE TRIGGER drills_updated_at BEFORE UPDATE ON public.drills
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
