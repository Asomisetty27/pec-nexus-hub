-- Board re-application is open ONLY to last year's members (the returning roster),
-- not to new members who join through fall recruitment. A board_eligible flag on
-- profiles gates it; new signups default to false, so once fall recruits arrive
-- they cannot apply for board seats. Set the flag true for the returning roster
-- (data step, applied separately).

alter table public.profiles
  add column if not exists board_eligible boolean not null default false;

create or replace function public.is_board_eligible(_uid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.user_id = _uid and p.board_eligible
  );
$$;
grant execute on function public.is_board_eligible(uuid) to authenticated;

-- Tighten the board-application insert: returning (board-eligible) members only.
drop policy if exists board_apps_insert on public.board_applications;
create policy board_apps_insert on public.board_applications
  for insert to authenticated
  with check (
    applicant_user_id = auth.uid()
    and public.is_active_member(auth.uid())
    and public.is_board_eligible(auth.uid())
    and exists (select 1 from public.board_application_cycles c where c.id = cycle_id and c.is_active)
    and exists (select 1 from public.board_positions p where p.key = position_key and p.is_open)
  );
