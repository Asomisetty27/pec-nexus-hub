
-- 1. opportunity_sources registry
CREATE TABLE IF NOT EXISTS public.opportunity_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  agency text,
  source_type text NOT NULL DEFAULT 'public_procurement',
  root_url text,
  listing_url text NOT NULL,
  evidence_url_pattern text,
  crawl_method text NOT NULL DEFAULT 'firecrawl_markdown',
  category_tags text[] NOT NULL DEFAULT '{}',
  scan_cadence_hours integer NOT NULL DEFAULT 168,
  trust_level text NOT NULL DEFAULT 'official',
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  last_scanned_at timestamptz,
  created_by uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT opportunity_sources_trust_check CHECK (trust_level IN ('official','curated','exploratory')),
  CONSTRAINT opportunity_sources_method_check CHECK (crawl_method IN ('firecrawl_markdown','firecrawl_html','firecrawl_search')),
  CONSTRAINT opportunity_sources_listing_url_unique UNIQUE (listing_url)
);

CREATE INDEX IF NOT EXISTS idx_opp_sources_active_due
  ON public.opportunity_sources (is_active, last_scanned_at NULLS FIRST);

ALTER TABLE public.opportunity_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "opp_sources_select_crm" ON public.opportunity_sources;
CREATE POLICY "opp_sources_select_crm" ON public.opportunity_sources
  FOR SELECT TO authenticated
  USING (public.is_ops_crm_user(auth.uid()));

DROP POLICY IF EXISTS "opp_sources_write_leadership" ON public.opportunity_sources;
CREATE POLICY "opp_sources_write_leadership" ON public.opportunity_sources
  FOR ALL TO authenticated
  USING (public.is_crm_leadership(auth.uid()))
  WITH CHECK (public.is_crm_leadership(auth.uid()));

CREATE TRIGGER trg_opp_sources_updated_at
  BEFORE UPDATE ON public.opportunity_sources
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 2. Additive PCO columns
ALTER TABLE public.public_contract_opportunities
  ADD COLUMN IF NOT EXISTS monitor_evidence_url text,
  ADD COLUMN IF NOT EXISTS awardee_evidence_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS listing_hash text,
  ADD COLUMN IF NOT EXISTS source_id uuid REFERENCES public.opportunity_sources(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pco_source_id ON public.public_contract_opportunities (source_id) WHERE source_id IS NOT NULL;

-- 3. Expand contract_monitor_runs run_type check
ALTER TABLE public.contract_monitor_runs DROP CONSTRAINT IF EXISTS contract_monitor_runs_run_type_check;
ALTER TABLE public.contract_monitor_runs ADD CONSTRAINT contract_monitor_runs_run_type_check
  CHECK (run_type IN ('weekly_scan','manual_scan','enrichment_refresh','awardee_identification','route_to_crm','scheduled_fanout'));

-- 4. cm_create_followup_task RPC (SECURITY DEFINER, idempotent)
CREATE OR REPLACE FUNCTION public.cm_create_followup_task(
  _org_id uuid,
  _kind text,
  _title text,
  _description text,
  _due_in_days integer,
  _related_pco_id uuid,
  _assignee uuid DEFAULT NULL,
  _created_by uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _existing uuid;
  _new_id uuid;
  _creator uuid;
BEGIN
  IF _org_id IS NULL OR _kind IS NULL OR _title IS NULL THEN
    RAISE EXCEPTION 'cm_create_followup_task: org_id, kind, title required';
  END IF;

  -- Idempotency: open task with same kind/title for the same org (and same PCO if given) wins.
  SELECT id INTO _existing
  FROM public.company_tasks
  WHERE organization_id = _org_id
    AND status = 'open'
    AND title = _title
    AND COALESCE(related_public_contract_id, '00000000-0000-0000-0000-000000000000'::uuid)
        = COALESCE(_related_pco_id, '00000000-0000-0000-0000-000000000000'::uuid)
  LIMIT 1;

  IF _existing IS NOT NULL THEN
    RETURN _existing;
  END IF;

  _creator := COALESCE(
    _created_by,
    (SELECT overseeing_lead_user_id FROM public.organizations WHERE id = _org_id),
    (SELECT owner_user_id FROM public.organizations WHERE id = _org_id)
  );

  -- Fall back to any CRM leadership user so we never violate the NOT NULL constraint.
  IF _creator IS NULL THEN
    SELECT user_id INTO _creator
    FROM public.user_roles
    WHERE role IN ('admin','superadmin','president')
    ORDER BY user_id
    LIMIT 1;
  END IF;

  IF _creator IS NULL THEN
    RAISE EXCEPTION 'cm_create_followup_task: no eligible creator found';
  END IF;

  INSERT INTO public.company_tasks (
    organization_id, title, description, assigned_to, created_by,
    status, due_at, task_source, related_public_contract_id
  ) VALUES (
    _org_id, _title, _description,
    COALESCE(_assignee,
      (SELECT owner_user_id FROM public.organizations WHERE id = _org_id),
      (SELECT secondary_owner_user_id FROM public.organizations WHERE id = _org_id)),
    _creator,
    'open',
    CASE WHEN _due_in_days IS NULL THEN NULL ELSE now() + make_interval(days => _due_in_days) END,
    _kind,
    _related_pco_id
  )
  RETURNING id INTO _new_id;

  RETURN _new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.cm_create_followup_task(uuid,text,text,text,integer,uuid,uuid,uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.cm_create_followup_task(uuid,text,text,text,integer,uuid,uuid,uuid) TO authenticated, service_role;

-- 5. Seed the two existing SLO sources
INSERT INTO public.opportunity_sources (name, agency, source_type, root_url, listing_url, crawl_method, category_tags, scan_cadence_hours, trust_level, is_active, notes)
VALUES
  ('SLO City — BidNetDirect', 'City of San Luis Obispo', 'public_procurement',
   'https://www.bidnetdirect.com/california/cityofsanluisobispo',
   'https://www.bidnetdirect.com/california/cityofsanluisobispo',
   'firecrawl_markdown',
   ARRAY['infrastructure','utilities','engineering']::text[],
   168, 'official', true,
   'Aggregator listing for City of SLO procurement.'),
  ('SLO City — Bids/RFPs', 'City of San Luis Obispo', 'public_procurement',
   'https://www.slocity.org',
   'https://www.slocity.org/government/department-directory/finance-it/purchasing-contracting/bids-rfps',
   'firecrawl_markdown',
   ARRAY['infrastructure','utilities','engineering']::text[],
   168, 'official', true,
   'Official SLO city bids and RFPs page.')
ON CONFLICT (listing_url) DO NOTHING;
