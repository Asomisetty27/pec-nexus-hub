-- G3: Public-readable active cycle accessor
CREATE OR REPLACE FUNCTION public.get_active_application_cycle()
RETURNS TABLE (
  id uuid,
  season public.application_cycle_season,
  year integer,
  opens_at timestamptz,
  closes_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.season, c.year, c.opens_at, c.closes_at
  FROM public.application_cycles c
  WHERE c.is_active = true
    AND c.opens_at <= now()
    AND c.closes_at >= now()
  ORDER BY c.opens_at DESC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_active_application_cycle() TO anon, authenticated;

-- Seed a default inactive Fall 2026 cycle if nothing exists yet (idempotent)
INSERT INTO public.application_cycles (season, year, opens_at, closes_at, is_active, notes)
SELECT 'fall'::public.application_cycle_season, 2026,
       '2026-09-15 00:00:00+00'::timestamptz,
       '2026-10-15 23:59:59+00'::timestamptz,
       false,
       'Seeded default cycle. Activate when ready.'
WHERE NOT EXISTS (SELECT 1 FROM public.application_cycles);