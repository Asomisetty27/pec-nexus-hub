-- Section lines v2.1: make the assembly lines runnable.
--
-- 1. cohort_onboarding_progress: per-member progress through their cohort's
--    onboarding track (Orient -> Learn -> Shadow -> First Unit -> Certified).
--    Members check off their own steps; the final Certified state is granted
--    by a leader/board only. This is what lets Nexus know who runs which line.
--
-- 2. brand_items: the work queue for the Brand & Fundraising section. The
--    other lines already have surfaces (CRM, Engagement OS); brand had none.
--    Kanban of posts / events / fundraisers / assets moving
--    idea -> drafting -> ready -> published -> recapped.

create table if not exists public.cohort_onboarding_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cohort_id uuid not null references public.cohorts(id) on delete cascade,
  completed_steps integer[] not null default '{}',
  certified_at timestamptz,
  certified_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  unique (user_id, cohort_id)
);

alter table public.cohort_onboarding_progress enable row level security;

-- Everyone signed in can see progress (social visibility is the accountability
-- mechanism per the reformation plan).
drop policy if exists cop_select on public.cohort_onboarding_progress;
create policy cop_select on public.cohort_onboarding_progress
  for select to authenticated using (true);

-- Members write their own step progress. certified_at/by are guarded by
-- trigger below, not by this policy.
drop policy if exists cop_upsert_own on public.cohort_onboarding_progress;
create policy cop_upsert_own on public.cohort_onboarding_progress
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists cop_update_own on public.cohort_onboarding_progress;
create policy cop_update_own on public.cohort_onboarding_progress
  for update to authenticated
  using (auth.uid() = user_id or public.is_board_or_admin(auth.uid()))
  with check (auth.uid() = user_id or public.is_board_or_admin(auth.uid()));

-- Only board/admin (or a cohort pm/lead) can set certification fields.
create or replace function public.guard_onboarding_certification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _is_leader boolean;
begin
  if (new.certified_at is distinct from old.certified_at)
     or (new.certified_by is distinct from old.certified_by) then
    select public.is_board_or_admin(auth.uid())
        or exists (
          select 1 from public.cohort_memberships cm
          where cm.user_id = auth.uid()
            and cm.cohort_id = new.cohort_id
            and cm.role in ('pm','lead','integration_lead'))
      into _is_leader;
    if not coalesce(_is_leader, false) then
      raise exception 'only a cohort leader or board can certify';
    end if;
    new.certified_by := auth.uid();
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_guard_onboarding_certification on public.cohort_onboarding_progress;
create trigger trg_guard_onboarding_certification
before update on public.cohort_onboarding_progress
for each row execute function public.guard_onboarding_certification();

-- ---------------------------------------------------------------------------

create table if not exists public.brand_items (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'post' check (kind in ('post','event','fundraiser','asset')),
  title text not null,
  notes text,
  status text not null default 'idea' check (status in ('idea','drafting','ready','published','recapped')),
  owner_user_id uuid references auth.users(id),
  due_date date,
  link text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists brand_items_status_idx on public.brand_items (status, due_date);

alter table public.brand_items enable row level security;

-- Brand queue is club-internal: any member can see it; Business & Marketing
-- cohort members and board manage it.
drop policy if exists bi_select on public.brand_items;
create policy bi_select on public.brand_items
  for select to authenticated using (true);

drop policy if exists bi_write on public.brand_items;
create policy bi_write on public.brand_items
  for all to authenticated
  using (
    public.is_board_or_admin(auth.uid())
    or exists (
      select 1 from public.cohort_memberships cm
      join public.cohorts c on c.id = cm.cohort_id
      where cm.user_id = auth.uid() and c.function_key = 'business_marketing')
  )
  with check (
    public.is_board_or_admin(auth.uid())
    or exists (
      select 1 from public.cohort_memberships cm
      join public.cohorts c on c.id = cm.cohort_id
      where cm.user_id = auth.uid() and c.function_key = 'business_marketing')
  );

-- Point the brand line's stages at the new surface.
update public.cohorts
set assembly_line = (
  select jsonb_agg(
    case when s->>'section' = 'brand_fundraising' and s->>'where' in ('/app/qr','social channels','/app/events','/app/admin?tab=metrics')
         then jsonb_set(s, '{where}', '"/app/brand"')
         else s end)
  from jsonb_array_elements(assembly_line) as s)
where function_key = 'business_marketing';
