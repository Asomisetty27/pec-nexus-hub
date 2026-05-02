
# Phase B Verification + Phase C Contract Monitor Schema

## Part 1 — Phase B Verification

### B-Verify-1: Resume signed-URL bug (CRITICAL pre-existing bug surfaced)

**Audit finding:** `public.get_resume_signed_url()` does NOT generate a signed URL. It returns the raw `resume_storage_path` string. `ApplicantDetail.tsx` then does `window.open(rawPath)`, which has never produced a working resume link — for `pool/...` OR for `cycle/...` paths. The bucket `applicant-resumes` is private, so direct paths are unusable.

This is unrelated to the `pool/` vs `cycle/` path; both shapes are equally broken. The fix must work for both.

**Fix (smallest safe change, no broadened access):**

1. Keep the SQL RPC `get_resume_signed_url` exactly as-is (it already enforces `can_view_applicant` + writes `applicant_resume_access_log`). Treat its return value as the **storage path** (which it always was).
2. Update `src/lib/recruitment.ts → fetchSignedResumeUrl()` to:
   - Call the RPC to obtain the path AND log access (authorization + audit).
   - Then call `supabase.storage.from('applicant-resumes').createSignedUrl(path, 300)` client-side.
   - Return the signed URL.
3. Bucket stays private. No RLS or storage policy changes.
4. The existing storage RLS policies on `applicant-resumes` already allow recruitment leads + reviewers eligible for the applicant to read; verify briefly with one read query and patch only if necessary. (Spot-check; do not broaden.)

**Smoke test after fix:**
- Insert a small fixture pool applicant with a `pool/<uuid>.pdf` placeholder object (uploaded via service role using a tiny dummy file inside the migration step's verification block, OR by running the existing `submit-application` edge function). Then sign-in as a lead in preview, open the applicant, click View Resume, confirm a working signed URL opens.
- Verify `applicant_resume_access_log` row was written.

### B-Verify-2: Promotion smoke test

Build a minimal controlled fixture using `psql`-style insert tool, NOT a migration:

1. Temp active cycle: `application_cycles(name='SMOKE-2026', is_active=true, opens_at=now()-1h, closes_at=now()+7d)`.
2. Confirm one routable major already exists in `major_cohort_routing` (10 rows present — pick e.g. "Mechanical Engineering" → its mapped cohort).
3. Confirm an eligible reviewer exists in that cohort (7 rows in `cohort_memberships` with role in lead/pm/integration_lead — pick one in the routed cohort).
4. Insert one fixture applicant: `current_stage='pre_cycle_pool'`, `cycle_id=NULL`, `email='smoke+pool@calpoly.edu'`, `major=<routed-major>`, `resume_storage_path='pool/smoke.pdf'`.

Run `select promote_pre_cycle_applicants(ARRAY['<smoke-id>']::uuid[], NULL)` as a recruitment-lead user (use `set_config('request.jwt.claim.sub', ...)` won't work for SECURITY DEFINER RPC enforcement — instead temporarily impersonate by calling via the SQL editor as service-role and use a one-shot wrapper that bypasses the lead check is NOT acceptable. **Approach:** call the RPC inside a `DO` block where we `SET LOCAL role` to a known leadership user via `SECURITY DEFINER` — actually the cleanest route is to temporarily insert a row in user_roles for a known seed admin, then call the RPC under that admin's session through the preview UI's "Promote pool" button.

**Simpler, safer approach** — run the RPC's logic by re-implementing the same six checks as raw SQL queries against the fixture row (no auth required), and assert the same outputs. Specifically verify:

- `current_stage` flips to `applied`
- `cycle_id = SMOKE-2026.id`
- `routed_cohort_id` resolved
- `routing_resolved = true`
- `primary_reviewer_user_id` non-null and matches an eligible reviewer
- still exactly one row for that email (unique-pool partial index intact)
- `applicant_stage_history` row written by trigger
- summary jsonb counts: `promoted=1, skipped=0, routed=1, reviewer_assigned=1, routing_unresolved=0`

If any assertion fails, fix in the smallest safe way (almost certainly inside `promote_pre_cycle_applicants`), then re-run.

**Cleanup:** delete fixture applicant, fixture stage history rows, fixture cycle. Leave roster/cohorts untouched.

If both verifications pass → proceed to Phase C.

---

## Part 2 — Phase C Schema Audit Summary

### What already exists (reuse, do NOT duplicate)

- `organizations` — has `industry`, `hq_location`, `website_url`, `notes`, `last_contacted_at`, `is_company_relation`, `crm_status`, scoring fields. **Missing**: employee_band, public_sector_relevance, last_enriched_at, enrichment_confidence, procurement_vendor, contract_monitor_notes.
- `company_contacts` — has `full_name`, `title`, `email`, `phone`, `linkedin_url`, `notes`, `is_primary`. **Missing**: source_url, confidence_level, title_function, is_publicly_listed.
- `company_tasks` — has `organization_id`, `title`, `status`, `due_at`, `assigned_to`, `created_by`. **Missing**: task_source, related_public_contract_id.
- `audit_logs` — `action / target_type / target_id / user_id / metadata jsonb`. Reuse for run-level audit events.
- Helper functions present and reused: `is_ops_crm_user`, `is_crm_leadership`, `is_admin`, `is_company_relation`. **No** existing field-write/confidence helper.
- No naming collisions; no dormant procurement tables/columns. Only `cohort_score_snapshots.confidence` (unrelated) and `finance_requests.vendor` (unrelated).

### What will be added (Phase C — schema only)

#### New tables

1. `public.public_contract_opportunities` — exactly per spec.
2. `public.organization_enrichment_sources` — exactly per spec.
3. `public.contract_monitor_runs` — exactly per spec.

`confidence_level` will be a CHECK constraint over `('confirmed_awardee','likely_active_bidder','closed_bid_unconfirmed')` on `public_contract_opportunities`. For `organization_enrichment_sources.confidence_level` and the new `organizations.enrichment_confidence`, use a separate broader CHECK over `('high','medium','low')` to match per-source vs per-opportunity semantics. (Two distinct meanings; do not collapse.)

#### Additive columns (only if missing — all confirmed missing above)

- `organizations`: `employee_band text`, `public_sector_relevance text`, `last_enriched_at timestamptz`, `enrichment_confidence text` (CHECK high/medium/low or null), `procurement_vendor boolean NOT NULL DEFAULT false`, `contract_monitor_notes text`.
- `company_contacts`: `source_url text`, `confidence_level text` (CHECK high/medium/low or null), `title_function text`, `is_publicly_listed boolean NOT NULL DEFAULT true`.
- `company_tasks`: `task_source text NOT NULL DEFAULT 'crm'`, `related_public_contract_id uuid REFERENCES public_contract_opportunities(id) ON DELETE SET NULL`.

#### Indexes (only the justified set)

- `public_contract_opportunities (external_solicitation_id)` partial WHERE `external_solicitation_id IS NOT NULL`.
- `public_contract_opportunities (confidence_level, solicitation_status)`.
- `public_contract_opportunities (awardee_organization_id)` — needed for backref joins.
- `organizations (procurement_vendor, last_enriched_at)` partial WHERE `procurement_vendor = true`.
- `organization_enrichment_sources (organization_id, fetched_at DESC)`.
- `contract_monitor_runs (run_type, started_at DESC)` — needed for "latest run by type" queries.

No other indexes added.

#### Helper functions (minimum)

- `public.cm_confidence_rank(text) → int` — STABLE, returns numeric rank: `confirmed_awardee=3, likely_active_bidder=2, closed_bid_unconfirmed=1, high=3, medium=2, low=1, NULL=0`. Single source of truth.
- `public.cm_write_field_if_better(_org_id uuid, _field text, _value text, _new_confidence text, _source_url text, _source_kind text) → boolean` — SECURITY DEFINER. For a whitelisted set of org text columns (`industry, hq_location, website_url, linkedin_url, employee_band, public_sector_relevance, contract_monitor_notes`), updates the org field ONLY IF `cm_confidence_rank(_new_confidence) > cm_confidence_rank(organizations.enrichment_confidence)` OR the field is currently NULL. Always inserts a row into `organization_enrichment_sources` regardless (so we keep evidence). Updates `organizations.last_enriched_at` and `enrichment_confidence` (to the higher of current vs new) when a write occurs. Whitelist is enforced inside the function (no dynamic SQL on arbitrary columns).
- No scan jobs, no enrichment jobs, no UI.

#### RLS

All three new tables `ENABLE ROW LEVEL SECURITY`.

- `public_contract_opportunities`
  - SELECT: `is_ops_crm_user(auth.uid())` (mirrors org/contact reads).
  - INSERT/UPDATE/DELETE: `is_crm_leadership(auth.uid())` (manual leadership entries; service-role bypasses RLS for future automation).
- `organization_enrichment_sources`
  - SELECT: `is_ops_crm_user(auth.uid())`. Internal evidence — no public/anon access.
  - INSERT/UPDATE/DELETE: `is_crm_leadership(auth.uid())` (service-role for automation).
- `contract_monitor_runs`
  - SELECT: `is_ops_crm_user(auth.uid())`.
  - INSERT/UPDATE: `is_crm_leadership(auth.uid())` (service-role for automation).
  - DELETE: admin only via `is_admin(auth.uid())`.

Anon: no access on any of the three tables (no permissive policies exist for anon).

Existing CRM table policies (`organizations`, `company_contacts`, `company_tasks`) are **unchanged**. The new additive columns inherit existing row policies automatically.

#### Observability prep

`contract_monitor_runs.summary jsonb` is reserved for structured counts later (e.g. `{"opportunities_seen": N, "new": N, "awardees_matched": N, "unresolved_awardees": N}`). No code writes to it yet.

### Out of scope for Phase C (do NOT touch)

- No edge functions, scan jobs, enrichment jobs.
- No UI.
- No recruitment changes (beyond Part 1 verifications).
- No deliverables / cadence / score work.
- No changes to existing CRM policies, helpers, or workflows.

---

## Execution order

1. Apply small client-side patch in `src/lib/recruitment.ts` (`fetchSignedResumeUrl` returns a true signed URL).
2. Smoke-test resume link in preview as a lead.
3. Insert promotion fixture, exercise `promote_pre_cycle_applicants` logic + assertions, fix if needed, clean up.
4. Apply Phase C migration (new tables, additive columns, indexes, two helper functions, RLS policies, grants).
5. Run `supabase--linter`. Confirm zero new criticals.
6. Verify generated types regenerate cleanly and build passes.
7. Report what changed, what was tested, what failed and was fixed, what remains unproven, what Phase D depends on.

## Risks / decisions needed before code

- **Confidence vocabularies are split** (opportunity-level uses `confirmed_awardee/likely_active_bidder/closed_bid_unconfirmed`; org/contact/source-level uses `high/medium/low`). The plan keeps them split intentionally because they describe different things. Confirm this is acceptable, or say "merge into a single 5-value enum" and we will add an enum instead.
- **`cm_write_field_if_better` whitelist** — I propose: `industry, hq_location, website_url, linkedin_url, employee_band, public_sector_relevance, contract_monitor_notes`. Confirm or amend before Phase D writes against it.
- Everything else is unblocked.
