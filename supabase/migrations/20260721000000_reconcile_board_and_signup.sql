-- Reconcile the board catalog and the signup trigger with what is actually LIVE
-- on prod. During the 2026-07-20 restructure these were changed via direct SQL,
-- so the repo drifted: 20260718100000_board_applications.sql still seeds the
-- deprecated VP-matrix, and the hardened handle_new_user was never captured as a
-- migration. This migration makes a fresh apply (or staging rebuild) converge to
-- the current model. It is idempotent and safe to run on prod (prod already
-- matches this state, so it is a no-op there).

-- 1. Board positions ---------------------------------------------------------
-- Current board: President / Vice President / Treasurer are guaranteed (closed);
-- the four Cohort Leads are the only applied-for open seats. PMs and Tech Leads
-- are staffed per project pod, not elected. Remove the stale VP-matrix seats.
delete from public.board_positions where key in ('vp_business','vp_members','vp_delivery');

insert into public.board_positions (key, title, description, kind, cohort_function_key, is_open, filled_note, sort_order) values
  ('president','President','External credibility, final client approvals, high-risk calls, disputes.','president',null,false,'Amogh Somisetty (guaranteed)',0),
  ('vice_president','Vice President','Assists the President; oversees internal operations and delivery across pods.','vp',null,false,'Sam (guaranteed)',1),
  ('treasurer','Treasurer','Owns club finances, dues, budget, and the ASI account.','vp',null,false,'Krithik (guaranteed)',2),
  ('cohort_lead_business','Cohort Lead: Business & Marketing','Runs the Business & Marketing cohort as a craft home.','cohort_lead','business_marketing',true,null,4),
  ('cohort_lead_software','Cohort Lead: Software & AI','Runs the Software & AI Delivery cohort.','cohort_lead','software_ai',true,null,5),
  ('cohort_lead_hardware','Cohort Lead: Hardware & Embedded','Runs the Hardware & Embedded Delivery cohort.','cohort_lead','hardware_embedded',true,null,6),
  ('cohort_lead_mech','Cohort Lead: Mechanical & Manufacturing','Runs the Mechanical & Manufacturing Delivery cohort.','cohort_lead','mech_manufacturing',true,null,7)
on conflict (key) do update set
  title = excluded.title, description = excluded.description, kind = excluded.kind,
  cohort_function_key = excluded.cohort_function_key, is_open = excluded.is_open,
  filled_note = excluded.filled_note, sort_order = excluded.sort_order;

-- 2. Signup trigger ----------------------------------------------------------
-- Captures the hardened handle_new_user live on prod: a roster-matched returning
-- member becomes board-eligible during an open cycle AND always gets the member
-- role even if the cohort label cannot be resolved, so they are never stranded
-- as an applicant. Cohort membership + channels are added only when the cohort
-- name resolves.
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare
  v_roster record; v_matched boolean := false; v_cohort_id uuid; v_channel record;
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
  if v_matched and exists (select 1 from public.board_application_cycles where is_active) then
    update public.profiles set board_eligible = true where user_id = new.id;
  end if;
  if v_matched then
    -- Returning member: always grant member (and project_lead for a PM), even if the
    -- cohort label cannot be resolved -- never strand a roster member as an applicant.
    insert into public.user_roles (user_id, role) values (new.id, 'member') on conflict do nothing;
    if v_roster.role = 'pm' then
      insert into public.user_roles (user_id, role) values (new.id, 'project_lead') on conflict do nothing;
    end if;
    select id into v_cohort_id from public.cohorts where lower(name) = lower(v_roster.cohort_name) limit 1;
    if v_cohort_id is not null then
      insert into public.cohort_memberships (user_id, cohort_id, role)
      values (new.id, v_cohort_id, v_roster.role) on conflict do nothing;
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
$function$;
