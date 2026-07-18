-- The VP (board_member) was omitted from is_crm_leadership, which locked the
-- VP out of the entire CRM (view + manage company-relation orgs). This
-- contradicts the year-one president+VP split (both run the club) and matters
-- acutely when the president is away and the VP covers solo. board_member is
-- leadership. Also flows into is_ops_crm_user (which calls this), so it grants
-- the VP CRM + speaker-pipeline access. Applied to staging + prod 2026-07-18.
create or replace function public.is_crm_leadership(_uid uuid)
returns boolean language sql stable security definer set search_path to 'public'
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _uid
      and role in ('admin','superadmin','president','director_of_projects','board_member')
  );
$$;
