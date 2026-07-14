-- The member lifecycle needs a home: applicant -> member (onboarding) ->
-- lead/VP (promotion window) -> alumni (re-commitment or graduation).
-- The member_status enum existed but no table carried it; Role HQ's alumni
-- playbook keys off this column. Applied to production 2026-07-14 via
-- Lovable (repo migrations do not auto-apply).

alter table public.profiles
  add column if not exists member_status public.member_status not null default 'active';
