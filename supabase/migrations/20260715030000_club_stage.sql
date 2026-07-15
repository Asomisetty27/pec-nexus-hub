-- get_club_stage(): one source of truth for how big the club actually is, so
-- the UI can tier its surface to the club's real size (progressive disclosure).
-- A 2-person launch sees a lean surface; features reveal as the club grows.
-- Returns counts plus a computed stage: 'launch' | 'growing' | 'established'.
--
-- Not sensitive (aggregate counts only), callable by any authenticated user.

create or replace function public.get_club_stage()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with c as (
    select
      (select count(*) from public.profiles where member_status = 'active') as active_members,
      (select count(*) from public.cohorts) as cohorts,
      (select count(*) from public.projects where status = 'active') as active_projects,
      (select count(*) from public.projects where status in ('completed','archived')) as delivered_projects,
      (select count(*) from public.organizations where type = 'client') as clients
  )
  select jsonb_build_object(
    'active_members', active_members,
    'cohorts', cohorts,
    'active_projects', active_projects,
    'delivered_projects', delivered_projects,
    'clients', clients,
    -- Stage tracks real scale (people who show up + work delivered), not config
    -- artifacts like empty cohort rows. A club with 0 delivered projects is
    -- never "established" no matter how many cohorts someone created.
    'stage', case
      when active_members >= 30 and delivered_projects >= 2 then 'established'
      when active_members >= 10 or delivered_projects >= 1 then 'growing'
      else 'launch'
    end
  )
  from c;
$$;

grant execute on function public.get_club_stage() to authenticated;
