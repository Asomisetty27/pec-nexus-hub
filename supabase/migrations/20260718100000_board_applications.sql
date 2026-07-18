-- Board applications: leadership seats are competitively applied for, not
-- grandfathered. Only President (Amogh) and VP Delivery (Sam) are guaranteed;
-- every other seat (VPs, Cohort Leads) is an open position that current members
-- and last year's board apply for. Reviewed by the guaranteed board (admins);
-- acceptance grants the role via decide_board_application().
--
-- Design: positions are data-driven (board_positions) so seats can change
-- without code. A VP grant = board_member (the existing VP role) + the specific
-- portfolio recorded as the position_key; a Cohort Lead grant = the cohort's
-- membership role set to 'lead' (scoped, matching is_cohort_reviewer).

-- 1. Position catalog
create table if not exists public.board_positions (
  key text primary key,
  title text not null,
  description text not null default '',
  kind text not null check (kind in ('president','vp','cohort_lead')),
  cohort_function_key text,             -- for cohort_lead: which cohort
  seats int not null default 1,
  is_open boolean not null default true, -- guaranteed seats are is_open = false
  filled_note text,                      -- for guaranteed / already-filled seats
  sort_order int not null default 0
);

-- 2. Application cycle (one active at a time)
create table if not exists public.board_application_cycles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  opens_at timestamptz,
  closes_at timestamptz,
  is_active boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);
create unique index if not exists board_cycle_one_active
  on public.board_application_cycles (is_active) where is_active = true;

-- 3. Status enum
do $$ begin
  create type public.board_application_status as enum
    ('submitted','under_review','accepted','declined','withdrawn');
exception when duplicate_object then null; end $$;

-- 4. Applications
create table if not exists public.board_applications (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.board_application_cycles(id) on delete cascade,
  applicant_user_id uuid not null references auth.users(id) on delete cascade,
  position_key text not null references public.board_positions(key),
  preference_rank int not null default 1,
  why_you text not null default '',
  vision text not null default '',
  relevant_experience text not null default '',
  status public.board_application_status not null default 'submitted',
  decided_by uuid references auth.users(id),
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cycle_id, applicant_user_id, position_key)
);
create index if not exists board_apps_position_idx on public.board_applications (position_key, status);
create index if not exists board_apps_applicant_idx on public.board_applications (applicant_user_id);

-- RLS ---------------------------------------------------------------
alter table public.board_positions enable row level security;
alter table public.board_application_cycles enable row level security;
alter table public.board_applications enable row level security;

-- Positions + cycles: any authenticated user reads; only admins (the
-- guaranteed board) write.
drop policy if exists board_positions_select on public.board_positions;
create policy board_positions_select on public.board_positions
  for select to authenticated using (true);
drop policy if exists board_positions_write on public.board_positions;
create policy board_positions_write on public.board_positions
  for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy if exists board_cycles_select on public.board_application_cycles;
create policy board_cycles_select on public.board_application_cycles
  for select to authenticated using (true);
drop policy if exists board_cycles_write on public.board_application_cycles;
create policy board_cycles_write on public.board_application_cycles
  for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- Applications: an applicant manages their own (while open); admins see and
-- decide all. A self-update can only keep the row submitted or withdraw it,
-- never set accepted/declined (that path is the admin-only RPC below).
drop policy if exists board_apps_select on public.board_applications;
create policy board_apps_select on public.board_applications
  for select to authenticated
  using (applicant_user_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists board_apps_insert on public.board_applications;
create policy board_apps_insert on public.board_applications
  for insert to authenticated
  with check (
    applicant_user_id = auth.uid()
    and public.is_active_member(auth.uid())
    and exists (select 1 from public.board_application_cycles c where c.id = cycle_id and c.is_active)
    and exists (select 1 from public.board_positions p where p.key = position_key and p.is_open)
  );

drop policy if exists board_apps_update_own on public.board_applications;
create policy board_apps_update_own on public.board_applications
  for update to authenticated
  using (applicant_user_id = auth.uid() and status in ('submitted','under_review'))
  with check (applicant_user_id = auth.uid() and status in ('submitted','withdrawn'));

drop policy if exists board_apps_admin_write on public.board_applications;
create policy board_apps_admin_write on public.board_applications
  for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- Decision RPC: admin-only; on accept, grants the seat's role -----------
create or replace function public.decide_board_application(
  _app_id uuid, _decision text, _note text default null
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  _app public.board_applications;
  _pos public.board_positions;
  _cohort_id uuid;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'only the guaranteed board (admins) may decide board applications';
  end if;
  if _decision not in ('accepted','declined') then
    raise exception 'decision must be accepted or declined';
  end if;

  select * into _app from public.board_applications where id = _app_id;
  if not found then raise exception 'application not found'; end if;

  update public.board_applications
    set status = _decision::public.board_application_status,
        decided_by = auth.uid(), decided_at = now(), decision_note = _note, updated_at = now()
    where id = _app_id;

  if _decision = 'accepted' then
    select * into _pos from public.board_positions where key = _app.position_key;
    if _pos.kind = 'vp' then
      insert into public.user_roles (user_id, role, granted_by)
        values (_app.applicant_user_id, 'board_member', auth.uid())
        on conflict (user_id, role) do nothing;
    elsif _pos.kind = 'cohort_lead' then
      select id into _cohort_id from public.cohorts
        where function_key = _pos.cohort_function_key limit 1;
      if _cohort_id is not null then
        insert into public.cohort_memberships (cohort_id, user_id, role)
          values (_cohort_id, _app.applicant_user_id, 'lead')
          on conflict (cohort_id, user_id) do update set role = 'lead';
      end if;
    end if;
  end if;
end;
$$;

grant execute on function public.decide_board_application(uuid, text, text) to authenticated;

-- Seed the full-matrix board (2026-07-18 decision) ----------------------
insert into public.board_positions (key, title, description, kind, cohort_function_key, is_open, filled_note, sort_order) values
  ('president', 'President', 'External credibility, final client approvals, high-risk calls, disputes.', 'president', null, false, 'Amogh Somisetty (guaranteed)', 0),
  ('vp_delivery', 'VP Delivery', 'Pipeline health, staffing, standards, delivery consistency across pods.', 'vp', null, false, 'Sam (guaranteed)', 1),
  ('vp_business', 'VP Business & Marketing', 'Owns the Sell loop: CRM, business development, brand, and fundraising.', 'vp', null, true, null, 2),
  ('vp_members', 'VP Members', 'Owns recruiting, cohort training, certification, progression, and community.', 'vp', null, true, null, 3),
  ('cohort_lead_business', 'Cohort Lead: Business & Marketing', 'Runs the Business & Marketing cohort as a craft home.', 'cohort_lead', 'business_marketing', true, null, 4),
  ('cohort_lead_software', 'Cohort Lead: Software & AI', 'Runs the Software & AI Delivery cohort.', 'cohort_lead', 'software_ai', true, null, 5),
  ('cohort_lead_hardware', 'Cohort Lead: Hardware & Embedded', 'Runs the Hardware & Embedded Delivery cohort.', 'cohort_lead', 'hardware_embedded', true, null, 6),
  ('cohort_lead_mech', 'Cohort Lead: Mechanical & Manufacturing', 'Runs the Mechanical & Manufacturing Delivery cohort.', 'cohort_lead', 'mech_manufacturing', true, null, 7)
on conflict (key) do nothing;
