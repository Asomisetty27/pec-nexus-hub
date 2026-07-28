-- PolyInnovate interest list: the demand-gauge instrument for the Apr 10, 2027
-- festival (see vault: PolyInnovate logistics plan, "demand gates"). Public
-- teaser page at /polyinnovate collects signups; ?src= QR tags make each
-- surface attributable, mirroring the intake_form convention.
create table if not exists public.polyinnovate_interest (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text,
  school text not null default 'calpoly',
  tracks text[] not null default '{}',
  wants_exhibit boolean not null default false,
  source text,
  created_at timestamptz not null default now()
);

-- One row per person; the page treats a duplicate as a friendly success.
create unique index if not exists polyinnovate_interest_email_key
  on public.polyinnovate_interest (lower(email));

alter table public.polyinnovate_interest enable row level security;

-- Public insert (same posture as the intake form): anyone may sign up, with a
-- minimal shape check. No public read/update/delete.
drop policy if exists pi_interest_insert on public.polyinnovate_interest;
create policy pi_interest_insert on public.polyinnovate_interest
  for insert to anon, authenticated
  with check (
    char_length(email) between 5 and 255
    and position('@' in email) > 1
    and char_length(coalesce(name, '')) <= 120
    and char_length(coalesce(source, '')) <= 60
  );

-- Board/admin read the list (counts, export for the Dec demand gate).
drop policy if exists pi_interest_select on public.polyinnovate_interest;
create policy pi_interest_select on public.polyinnovate_interest
  for select to authenticated
  using (public.is_board_or_admin(auth.uid()));
