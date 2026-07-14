-- Fall 2026 re-formation: every existing member declares stay / alumni /
-- leave, and "stay" carries the signed commitment contract. One row per
-- user per cycle. Board reads everything; members read and write only
-- their own row until the cycle closes.

create table if not exists public.recommitments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  cycle text not null default 'fall-2026',
  choice text not null check (choice in ('stay', 'alumni', 'leave')),
  preferred_team text,
  availability_hours integer check (availability_hours between 0 and 40),
  commitment_signed_at timestamptz,
  commitment_version text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, cycle)
);

alter table public.recommitments enable row level security;

create policy "members insert own recommitment"
  on public.recommitments for insert
  with check (auth.uid() = user_id);

create policy "members read own recommitment"
  on public.recommitments for select
  using (auth.uid() = user_id or public.is_board_or_admin(auth.uid()));

create policy "members update own recommitment"
  on public.recommitments for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists recommitments_cycle_idx on public.recommitments (cycle, choice);
