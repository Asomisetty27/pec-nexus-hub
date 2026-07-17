-- Corrective follow-up to 20260717030000_fix_signup_provisioning.sql, which
-- shipped with `WHERE p.status = 'active' AND p.cohort_id = v_cohort_id` --
-- but projects has no cohort_id column. The CREATE succeeds (plpgsql bodies
-- are not column-validated at creation), so the migration applies cleanly,
-- but the function then crashes at runtime on the first real signup. Found on
-- staging during the lifecycle sim (2026-07-17) and fixed there and on prod
-- the same day. This migration makes the repo history replayable and matches
-- the deployed prod/staging definition: the cohort-driven project auto-join
-- is removed entirely (project membership is assigned by the president at
-- project formation, not implied by cohort).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_roster record;
  v_matched boolean := false;
  v_cohort_id uuid;
  v_channel record;
begin
  insert into public.profiles (user_id, full_name, cal_poly_email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''), new.email);
  insert into public.user_roles (user_id, role) values (new.id, 'applicant');
  if new.email = 'somisett@calpoly.edu' then
    insert into public.user_roles (user_id, role) values (new.id, 'admin') on conflict do nothing;
    insert into public.user_roles (user_id, role) values (new.id, 'superadmin') on conflict do nothing;
  end if;
  select * into v_roster from public.cohort_roster
    where (email is not null and lower(email) = lower(new.email))
       or (email is null and lower(full_name) = lower(coalesce(new.raw_user_meta_data->>'full_name','')))
    limit 1;
  v_matched := found;
  if v_matched then
    select id into v_cohort_id from public.cohorts where lower(name) = lower(v_roster.cohort_name) limit 1;
    if v_cohort_id is not null then
      insert into public.cohort_memberships (user_id, cohort_id, role)
      values (new.id, v_cohort_id, v_roster.role) on conflict do nothing;
      if v_roster.role in ('pm','lead','integration_lead') then
        insert into public.user_roles (user_id, role) values (new.id, 'member') on conflict do nothing;
        if v_roster.role = 'pm' then
          insert into public.user_roles (user_id, role) values (new.id, 'project_lead') on conflict do nothing;
        end if;
      else
        insert into public.user_roles (user_id, role) values (new.id, 'member') on conflict do nothing;
      end if;
      perform public.join_user_to_default_channels(new.id, v_roster.cohort_name, v_roster.role);
      update public.cohort_roster set matched_user_id = new.id, matched_at = now(), identity_status = 'matched'
      where id = v_roster.id;
    end if;
  else
    for v_channel in select id from public.channels where is_org_wide = true loop
      insert into public.channel_members (channel_id, user_id) values (v_channel.id, new.id) on conflict do nothing;
    end loop;
  end if;
  return new;
end;
$$;
