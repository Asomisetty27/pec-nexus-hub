-- Lifecycle sim finding (2026-07-17): is_ops_crm_user still matched the dead
-- pre-rename cohort name 'Ops / PM'. Since the operating-model migration
-- renamed it to 'Business & Marketing' (function_key business_marketing),
-- every business-cohort member was locked out of the CRM (could not read or
-- create company-relation orgs) -- the company-relations line could not run
-- for the people whose whole job it is. Match by function_key (rename-proof),
-- consistent with src/lib/cohorts.ts isBusinessCohort. Applied to staging
-- 2026-07-17; prod apply with this sim's fix batch.
create or replace function public.is_ops_crm_user(_uid uuid)
returns boolean
language sql stable security definer set search_path to 'public'
as $$
  select
    public.is_crm_leadership(_uid)
    or exists (select 1 from public.user_roles where user_id = _uid and role = 'outreach_lead')
    or exists (
      select 1
      from public.cohort_memberships cm
      join public.cohorts c on c.id = cm.cohort_id
      where cm.user_id = _uid and c.function_key = 'business_marketing'
    );
$$;
