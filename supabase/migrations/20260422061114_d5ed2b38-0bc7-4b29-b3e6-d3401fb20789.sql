-- 1. Chapters table
CREATE TABLE IF NOT EXISTS public.chapters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  university text,
  city text,
  state text,
  founded_at date,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;

CREATE POLICY chapters_select ON public.chapters FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY chapters_admin_manage ON public.chapters FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- 2. Seed default chapter
INSERT INTO public.chapters (slug, name, university, city, state, founded_at)
VALUES ('pec-calpoly', 'PEC Cal Poly', 'California Polytechnic State University, San Luis Obispo', 'San Luis Obispo', 'CA', '2024-09-01')
ON CONFLICT (slug) DO NOTHING;

-- 3. Add chapter_id to cohorts/projects/profiles
ALTER TABLE public.cohorts   ADD COLUMN IF NOT EXISTS chapter_id uuid REFERENCES public.chapters(id);
ALTER TABLE public.projects  ADD COLUMN IF NOT EXISTS chapter_id uuid REFERENCES public.chapters(id);
ALTER TABLE public.profiles  ADD COLUMN IF NOT EXISTS chapter_id uuid REFERENCES public.chapters(id);

-- 4. Backfill existing rows to the default chapter
UPDATE public.cohorts  SET chapter_id = (SELECT id FROM public.chapters WHERE slug = 'pec-calpoly') WHERE chapter_id IS NULL;
UPDATE public.projects SET chapter_id = (SELECT id FROM public.chapters WHERE slug = 'pec-calpoly') WHERE chapter_id IS NULL;
UPDATE public.profiles SET chapter_id = (SELECT id FROM public.chapters WHERE slug = 'pec-calpoly') WHERE chapter_id IS NULL;

-- 5. Indexes for future scoped queries
CREATE INDEX IF NOT EXISTS idx_cohorts_chapter  ON public.cohorts(chapter_id);
CREATE INDEX IF NOT EXISTS idx_projects_chapter ON public.projects(chapter_id);
CREATE INDEX IF NOT EXISTS idx_profiles_chapter ON public.profiles(chapter_id);

-- 6. updated_at trigger for chapters
CREATE TRIGGER chapters_updated_at
BEFORE UPDATE ON public.chapters
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();