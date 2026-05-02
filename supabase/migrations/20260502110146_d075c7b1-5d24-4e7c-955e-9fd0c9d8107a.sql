
-- =========================================================================
-- Phase C: Public Contract Monitor — schema only
-- =========================================================================

-- ---------- 1. public_contract_opportunities ----------
CREATE TABLE public.public_contract_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_agency text NOT NULL DEFAULT 'City of San Luis Obispo',
  source_type text NOT NULL DEFAULT 'public_procurement',
  external_solicitation_id text,
  solicitation_title text NOT NULL,
  solicitation_status text NOT NULL,
  published_at timestamptz,
  closed_at timestamptz,
  awarded_at timestamptz,
  awardee_organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  confidence_level text NOT NULL CHECK (confidence_level IN ('confirmed_awardee','likely_active_bidder','closed_bid_unconfirmed')),
  source_url text,
  source_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  category text,
  routed_mode text DEFAULT 'contract',
  city text DEFAULT 'San Luis Obispo',
  state text DEFAULT 'CA',
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pco_external_solicitation_id
  ON public.public_contract_opportunities (external_solicitation_id)
  WHERE external_solicitation_id IS NOT NULL;
CREATE INDEX idx_pco_confidence_status
  ON public.public_contract_opportunities (confidence_level, solicitation_status);
CREATE INDEX idx_pco_awardee_org
  ON public.public_contract_opportunities (awardee_organization_id)
  WHERE awardee_organization_id IS NOT NULL;

CREATE TRIGGER trg_pco_updated_at
  BEFORE UPDATE ON public.public_contract_opportunities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---------- 2. organization_enrichment_sources ----------
CREATE TABLE public.organization_enrichment_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  source_kind text NOT NULL,
  source_url text NOT NULL,
  source_domain text,
  extracted_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence_level text NOT NULL CHECK (confidence_level IN ('high','medium','low')),
  fetched_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_oes_org_fetched
  ON public.organization_enrichment_sources (organization_id, fetched_at DESC);

-- ---------- 3. contract_monitor_runs ----------
CREATE TABLE public.contract_monitor_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_type text NOT NULL CHECK (run_type IN ('weekly_scan','manual_scan','enrichment_refresh')),
  status text NOT NULL CHECK (status IN ('running','succeeded','failed','partial')),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_log text,
  created_by uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL
);

CREATE INDEX idx_cmr_type_started
  ON public.contract_monitor_runs (run_type, started_at DESC);

-- ---------- 4. Additive columns on organizations ----------
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS employee_band text,
  ADD COLUMN IF NOT EXISTS public_sector_relevance text,
  ADD COLUMN IF NOT EXISTS last_enriched_at timestamptz,
  ADD COLUMN IF NOT EXISTS enrichment_confidence text
    CHECK (enrichment_confidence IS NULL OR enrichment_confidence IN ('high','medium','low')),
  ADD COLUMN IF NOT EXISTS procurement_vendor boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS contract_monitor_notes text;

CREATE INDEX IF NOT EXISTS idx_orgs_procurement_enriched
  ON public.organizations (procurement_vendor, last_enriched_at)
  WHERE procurement_vendor = true;

-- ---------- 5. Additive columns on company_contacts ----------
ALTER TABLE public.company_contacts
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS confidence_level text
    CHECK (confidence_level IS NULL OR confidence_level IN ('high','medium','low')),
  ADD COLUMN IF NOT EXISTS title_function text,
  ADD COLUMN IF NOT EXISTS is_publicly_listed boolean NOT NULL DEFAULT true;

-- ---------- 6. Additive columns on company_tasks ----------
ALTER TABLE public.company_tasks
  ADD COLUMN IF NOT EXISTS task_source text NOT NULL DEFAULT 'crm',
  ADD COLUMN IF NOT EXISTS related_public_contract_id uuid
    REFERENCES public.public_contract_opportunities(id) ON DELETE SET NULL;

-- ---------- 7. Helper functions ----------
CREATE OR REPLACE FUNCTION public.cm_confidence_rank(_c text)
RETURNS int
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE _c
    WHEN 'confirmed_awardee' THEN 3
    WHEN 'likely_active_bidder' THEN 2
    WHEN 'closed_bid_unconfirmed' THEN 1
    WHEN 'high' THEN 3
    WHEN 'medium' THEN 2
    WHEN 'low' THEN 1
    ELSE 0
  END;
$$;

CREATE OR REPLACE FUNCTION public.cm_write_field_if_better(
  _org_id uuid,
  _field text,
  _value text,
  _new_confidence text,
  _source_url text,
  _source_kind text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_conf text;
  v_existing_value text;
  v_did_write boolean := false;
BEGIN
  IF _org_id IS NULL OR _field IS NULL OR _new_confidence IS NULL THEN
    RAISE EXCEPTION 'org_id, field, and new_confidence are required';
  END IF;
  IF _new_confidence NOT IN ('high','medium','low') THEN
    RAISE EXCEPTION 'invalid confidence: %', _new_confidence;
  END IF;
  IF _field NOT IN (
    'industry','hq_location','website_url','linkedin_url',
    'employee_band','public_sector_relevance','contract_monitor_notes'
  ) THEN
    RAISE EXCEPTION 'field % is not enrichable via cm_write_field_if_better', _field;
  END IF;

  -- Always record evidence first.
  INSERT INTO public.organization_enrichment_sources
    (organization_id, source_kind, source_url, source_domain, extracted_payload, confidence_level)
  VALUES (
    _org_id,
    COALESCE(_source_kind, 'manual'),
    COALESCE(_source_url, ''),
    NULLIF(regexp_replace(COALESCE(_source_url,''), '^https?://([^/]+).*$', '\1'), ''),
    jsonb_build_object('field', _field, 'value', _value),
    _new_confidence
  );

  SELECT enrichment_confidence INTO v_existing_conf FROM public.organizations WHERE id = _org_id;

  EXECUTE format('SELECT %I::text FROM public.organizations WHERE id = $1', _field)
    INTO v_existing_value USING _org_id;

  IF v_existing_value IS NULL
     OR public.cm_confidence_rank(_new_confidence) > public.cm_confidence_rank(v_existing_conf) THEN
    EXECUTE format(
      'UPDATE public.organizations SET %I = $1, last_enriched_at = now(), '
      || 'enrichment_confidence = CASE WHEN public.cm_confidence_rank($2) > public.cm_confidence_rank(enrichment_confidence) '
      || 'THEN $2 ELSE enrichment_confidence END, updated_at = now() WHERE id = $3', _field
    ) USING _value, _new_confidence, _org_id;
    v_did_write := true;
  END IF;

  RETURN v_did_write;
END;
$$;

REVOKE ALL ON FUNCTION public.cm_write_field_if_better(uuid, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cm_write_field_if_better(uuid, text, text, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cm_confidence_rank(text) TO authenticated, service_role, anon;

-- ---------- 8. RLS ----------
ALTER TABLE public.public_contract_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_enrichment_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_monitor_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pco_select_crm" ON public.public_contract_opportunities
  FOR SELECT TO authenticated USING (public.is_ops_crm_user(auth.uid()));
CREATE POLICY "pco_insert_leadership" ON public.public_contract_opportunities
  FOR INSERT TO authenticated WITH CHECK (public.is_crm_leadership(auth.uid()));
CREATE POLICY "pco_update_leadership" ON public.public_contract_opportunities
  FOR UPDATE TO authenticated
  USING (public.is_crm_leadership(auth.uid()))
  WITH CHECK (public.is_crm_leadership(auth.uid()));
CREATE POLICY "pco_delete_leadership" ON public.public_contract_opportunities
  FOR DELETE TO authenticated USING (public.is_crm_leadership(auth.uid()));

CREATE POLICY "oes_select_crm" ON public.organization_enrichment_sources
  FOR SELECT TO authenticated USING (public.is_ops_crm_user(auth.uid()));
CREATE POLICY "oes_insert_leadership" ON public.organization_enrichment_sources
  FOR INSERT TO authenticated WITH CHECK (public.is_crm_leadership(auth.uid()));
CREATE POLICY "oes_update_leadership" ON public.organization_enrichment_sources
  FOR UPDATE TO authenticated
  USING (public.is_crm_leadership(auth.uid()))
  WITH CHECK (public.is_crm_leadership(auth.uid()));
CREATE POLICY "oes_delete_leadership" ON public.organization_enrichment_sources
  FOR DELETE TO authenticated USING (public.is_crm_leadership(auth.uid()));

CREATE POLICY "cmr_select_crm" ON public.contract_monitor_runs
  FOR SELECT TO authenticated USING (public.is_ops_crm_user(auth.uid()));
CREATE POLICY "cmr_insert_leadership" ON public.contract_monitor_runs
  FOR INSERT TO authenticated WITH CHECK (public.is_crm_leadership(auth.uid()));
CREATE POLICY "cmr_update_leadership" ON public.contract_monitor_runs
  FOR UPDATE TO authenticated
  USING (public.is_crm_leadership(auth.uid()))
  WITH CHECK (public.is_crm_leadership(auth.uid()));
CREATE POLICY "cmr_delete_admin" ON public.contract_monitor_runs
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));
