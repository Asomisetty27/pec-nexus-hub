-- Lifecycle sim finding (2026-07-17): the VP (board_member) was locked out of
-- the entire recruitment pipeline: could not view applicants, review, move
-- stages, or onboard. Contradicts the year-one split (president+VP both run
-- interviews, per the cold-start plan) and the leadership-oversight policy
-- (board sits in no cohort, so the cohort-reviewer path can never apply).
-- Fix: board_member joins is_recruitment_lead. Applied to staging 2026-07-17;
-- prod apply with this sim's fix batch.
create or replace function public.is_recruitment_lead(_uid uuid)
returns boolean
language sql stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _uid
      and role in ('admin','superadmin','president','director_of_projects','board_member')
  );
$$;
