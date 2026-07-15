-- Fix: get_club_stage counted archived projects as delivered. The ghost-data
-- reconciliation archived last year's 4 never-delivered projects as founding
-- history, which flipped the club to "growing" with delivered_projects=4 — a
-- fabricated-track-record claim. Delivered means status='completed' only;
-- archived is shelved history and must not count.
-- Applied to prod and staging 2026-07-15.

create or replace function public.get_club_stage()
returns jsonb language sql stable security definer set search_path = public as $$
  with c as (
    select
      (select count(*) from public.profiles where member_status = 'active') as active_members,
      (select count(*) from public.cohorts) as cohorts,
      (select count(*) from public.projects where status = 'active') as active_projects,
      -- Delivered means completed. Archived is shelved history (e.g. the
      -- founding-era projects that never delivered) and must not count.
      (select count(*) from public.projects where status = 'completed') as delivered_projects,
      (select count(*) from public.organizations where type = 'client') as clients)
  select jsonb_build_object(
    'active_members', active_members, 'cohorts', cohorts, 'active_projects', active_projects,
    'delivered_projects', delivered_projects, 'clients', clients,
    'stage', case
      when active_members >= 30 and delivered_projects >= 2 then 'established'
      when active_members >= 10 or delivered_projects >= 1 then 'growing'
      else 'launch' end) from c;
$$;
