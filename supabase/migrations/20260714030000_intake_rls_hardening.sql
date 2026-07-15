-- Intake / recruitment RLS hardening (bug sweep 2026-07-14).
--
-- Supabase security advisors surfaced five tables whose INSERT policies were
-- WITH CHECK (true) — i.e. row-level security was effectively off for writes.
-- Every one of these is an abuse surface with no legitimate client that needs
-- it, because the real intake paths do NOT rely on these policies:
--
--   * applicants: the public apply form POSTs to the `submit-application` edge
--     function, which runs with the SERVICE ROLE (bypasses RLS) and enforces
--     the honeypot, per-IP/email rate limit, cycle gate, duplicate check, and
--     sets current_stage server-side. The anon/authenticated INSERT policies
--     let anyone with the public anon key skip that entire pipeline and inject
--     arbitrary applicant rows — including forged `current_stage='accepted'`
--     rows with fake decision metadata, polluting the review queue. Dropped.
--
--   * leads: the public intake form inserts as anon through the narrow
--     "public intake creates new leads" policy (source like 'intake_form%'
--     and stage='new'). The always-true `leads_insert_public` was already
--     dropped on production by hand on 2026-07-14 but was never captured as a
--     migration (so a rebuild would resurrect it) and still lived on staging.
--     This makes the drop durable and idempotent everywhere.
--
--   * competition_applications / recruiting_applications: no client code path
--     inserts into either (recruiting_applications is a dead table superseded
--     by `applicants`; competition_applications is read-only in the app).
--     Their always-true public INSERT policies are pure spam surface. Dropped.
--
-- Anything that legitimately writes these tables does so via the service role,
-- which bypasses RLS — so these drops break no real path. Verified against the
-- submit-application function and a repo-wide grep of client inserts.

drop policy if exists "applicants_anon_insert" on public.applicants;
drop policy if exists "applicants_auth_insert" on public.applicants;
drop policy if exists "leads_insert_public" on public.leads;
drop policy if exists "ca_insert" on public.competition_applications;
drop policy if exists "ra_insert" on public.recruiting_applications;

-- Pin the search_path on SECURITY DEFINER / role-mutable functions the advisor
-- flagged, closing the search_path-injection vector (a caller could otherwise
-- shadow `public` objects the function references).
alter function public.enqueue_email(queue_name text, payload jsonb) set search_path = public;
alter function public.read_email_batch(queue_name text, batch_size integer, vt integer) set search_path = public;
alter function public.delete_email(queue_name text, message_id bigint) set search_path = public;
alter function public.move_to_dlq(source_queue text, dlq_name text, message_id bigint, payload jsonb) set search_path = public;
alter function public.applicant_stage_order(_s applicant_stage) set search_path = public;
