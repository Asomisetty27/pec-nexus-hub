-- onboard_accepted_applicant referenced profiles.email, which does not exist
-- (profiles has cal_poly_email only) => the ENTIRE new-member onboarding path
-- crashed with 42703 on first use. Found by the lifecycle simulation
-- 2026-07-17; the function had never been executed end-to-end before.
-- Fix: match existing accounts by cal_poly_email only. Applied to staging
-- 2026-07-17; prod apply with this sim's fix batch.

create or replace function public.onboard_accepted_applicant(_applicant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  _caller uuid := auth.uid();
  _app record;
  _cohort_name text;
  _existing_user uuid;
  _token_id uuid;
  _token text;
  _existing_invite record;
begin
  if _caller is null then
    raise exception 'unauthenticated';
  end if;

  if not public.is_recruitment_lead(_caller) then
    raise exception 'forbidden: recruitment lead role required';
  end if;

  select * into _app from public.applicants where id = _applicant_id for update;
  if not found then
    raise exception 'applicant not found';
  end if;

  if _app.current_stage <> 'accepted'::applicant_stage then
    raise exception 'applicant is not accepted (stage=%)', _app.current_stage;
  end if;

  if _app.routed_cohort_id is null then
    raise exception 'applicant has no routed cohort';
  end if;

  if _app.onboarding_state = 'joined' then
    return jsonb_build_object(
      'state', 'joined',
      'already_member', true,
      'email', _app.email,
      'full_name', _app.full_name,
      'cohort_id', _app.routed_cohort_id,
      'converted_member_user_id', _app.converted_member_user_id
    );
  end if;

  select name into _cohort_name from public.cohorts where id = _app.routed_cohort_id;

  -- Match an existing account by cal_poly_email (profiles has no plain
  -- email column; the previous version referenced one and crashed).
  select user_id into _existing_user
  from public.profiles
  where lower(cal_poly_email) = lower(_app.email::text)
  limit 1;

  if _existing_user is not null then
    update public.applicants
       set onboarding_state = 'joined',
           converted_member_user_id = _existing_user,
           converted_at = coalesce(converted_at, now()),
           updated_at = now()
     where id = _applicant_id;

    insert into public.cohort_roster(full_name, email, cohort_name, role, matched_user_id, matched_at, identity_status)
    select _app.full_name, _app.email::text, _cohort_name, 'member', _existing_user, now(), 'matched'
    where not exists (
      select 1 from public.cohort_roster
      where lower(email) = lower(_app.email::text) and cohort_name = _cohort_name
    );

    insert into public.audit_logs(user_id, action, target_type, target_id, metadata)
    values (_caller, 'applicant_onboarded_existing', 'applicants', _applicant_id,
            jsonb_build_object('linked_user_id', _existing_user, 'email', _app.email));

    return jsonb_build_object(
      'state', 'joined',
      'already_member', true,
      'email', _app.email,
      'full_name', _app.full_name,
      'cohort_id', _app.routed_cohort_id,
      'converted_member_user_id', _existing_user
    );
  end if;

  if _app.onboarding_state = 'invite_sent' and _app.onboarding_invite_token_id is not null then
    select * into _existing_invite from public.invite_tokens
     where id = _app.onboarding_invite_token_id
       and used_at is null
       and expires_at > now();
    if found then
      return jsonb_build_object(
        'state', 'invite_sent',
        'already_member', false,
        'email', _app.email,
        'full_name', _app.full_name,
        'cohort_id', _app.routed_cohort_id,
        'invite_token_id', _existing_invite.id,
        'invite_token', _existing_invite.token,
        'reissued', false
      );
    end if;
  end if;

  insert into public.cohort_roster(full_name, email, cohort_name, role, identity_status)
  select _app.full_name, _app.email::text, _cohort_name, 'member', 'pending'
  where not exists (
    select 1 from public.cohort_roster
    where lower(email) = lower(_app.email::text) and cohort_name = _cohort_name
  );

  insert into public.invite_tokens(email, created_by, email_status)
  values (_app.email::text, _caller, 'pending_send')
  returning id, token into _token_id, _token;

  update public.applicants
     set onboarding_state = 'invite_sent',
         onboarding_invite_token_id = _token_id,
         onboarding_sent_at = now(),
         updated_at = now()
   where id = _applicant_id;

  insert into public.audit_logs(user_id, action, target_type, target_id, metadata)
  values (_caller, 'applicant_onboarded_invite', 'applicants', _applicant_id,
          jsonb_build_object('invite_token_id', _token_id, 'email', _app.email, 'cohort_id', _app.routed_cohort_id));

  return jsonb_build_object(
    'state', 'invite_sent',
    'already_member', false,
    'email', _app.email,
    'full_name', _app.full_name,
    'cohort_id', _app.routed_cohort_id,
    'invite_token_id', _token_id,
    'invite_token', _token,
    'reissued', true
  );
end;
$$;
