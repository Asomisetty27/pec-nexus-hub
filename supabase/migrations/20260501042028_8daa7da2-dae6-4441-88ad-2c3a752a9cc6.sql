-- Migration D: relationship_goal enum + organizations column
-- Phase 3 schema completion. Strictly additive. No data backfill.

-- 1. Create relationship_goal enum (canonical CRM values)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'relationship_goal') THEN
    CREATE TYPE public.relationship_goal AS ENUM (
      'project',
      'sponsorship',
      'speaker',
      'judge',
      'recruiting',
      'general_partnership'
    );
  END IF;
END$$;

-- 2. Add nullable column to organizations (no default; legacy rows stay NULL = "unset")
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS relationship_goal public.relationship_goal;

-- 3. Partial index for filtering CRM views by relationship goal
CREATE INDEX IF NOT EXISTS idx_organizations_relationship_goal
  ON public.organizations (relationship_goal)
  WHERE relationship_goal IS NOT NULL;