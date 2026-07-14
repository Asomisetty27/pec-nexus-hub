-- Public intake fix (applied to production 2026-07-14 via Lovable; repo
-- migrations do not auto-apply). Stress test found the intake form fully
-- broken for anonymous visitors: RLS denied their inserts, so every real
-- company got an error, and no notification mechanism existed despite the
-- success message claiming one.
--
-- Anon gets narrow INSERT-only access (reads verified blocked); the form
-- generates ids client-side and inserts with no returning clause, because
-- returning requires SELECT rights anon must never have.

create policy "public intake creates client orgs"
  on public.organizations for insert
  to anon
  with check (type = 'client' and created_by is null and owner_user_id is null);

create policy "public intake creates new leads"
  on public.leads for insert
  to anon
  with check (source like 'intake_form%' and stage = 'new');

-- Every new intake lead notifies all board/admin accounts in-app,
-- making the form's "leadership has been notified" message true.
create or replace function public.notify_board_on_intake()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  board_user record;
begin
  if new.source like 'intake_form%' then
    for board_user in
      select distinct ur.user_id from public.user_roles ur
      where ur.role in ('board_member', 'admin', 'superadmin')
    loop
      perform public.create_notification(
        board_user.user_id,
        'crm',
        'New client inquiry: ' || coalesce(new.contact_name, 'Unknown'),
        coalesce(left(new.notes, 200), 'Intake form submission'),
        '/app/crm',
        null,
        'lead',
        new.id,
        'high',
        'intake-' || new.id::text,
        jsonb_build_object('source', new.source)
      );
    end loop;
  end if;
  return new;
end;
$$;

create trigger trg_leads_intake_notify
after insert on public.leads
for each row execute function public.notify_board_on_intake();
