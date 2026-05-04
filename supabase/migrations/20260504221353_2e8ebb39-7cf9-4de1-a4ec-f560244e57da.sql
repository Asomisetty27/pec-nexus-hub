
-- Idempotent dedup keys for contract-monitor scans
CREATE UNIQUE INDEX IF NOT EXISTS uq_pco_agency_external_id
  ON public.public_contract_opportunities (source_agency, external_solicitation_id)
  WHERE external_solicitation_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_pco_agency_source_url
  ON public.public_contract_opportunities (source_agency, source_url)
  WHERE external_solicitation_id IS NULL AND source_url IS NOT NULL;

-- Speed up case-insensitive org-name resolution
CREATE INDEX IF NOT EXISTS idx_orgs_lower_name
  ON public.organizations (lower(name));
