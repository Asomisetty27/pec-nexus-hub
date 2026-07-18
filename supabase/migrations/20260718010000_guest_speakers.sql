-- Guest speakers + community-partnership programming.
-- A speaker is a person the club invites to talk (industry practitioner,
-- alumnus, or someone from a target client/partner org). The pipeline mirrors
-- the CRM's shape and, crucially, can link to an organization: inviting a
-- speaker from a company the club wants as a client is warm-intro relationship
-- building, so speaker outreach and client outreach share one graph.
--
-- Owned by Business & Marketing (Company Relations + Brand run it) and board,
-- readable by all members. Reuses the same access predicate as the CRM.

alter type public.event_type add value if not exists 'guest_speaker';

create table if not exists public.speakers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  affiliation text,                       -- company / role / "Cal Poly alum '22"
  topic text,
  status text not null default 'idea'
    check (status in ('idea','invited','confirmed','scheduled','spoke','declined')),
  organization_id uuid references public.organizations(id) on delete set null,
  event_id uuid references public.events(id) on delete set null,   -- the scheduled talk
  contact text,
  bio text,
  links jsonb not null default '{}'::jsonb,
  proposed_date date,
  owner_user_id uuid references auth.users(id),
  notes text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists speakers_status_idx on public.speakers (status, proposed_date);
create index if not exists speakers_org_idx on public.speakers (organization_id) where organization_id is not null;

alter table public.speakers enable row level security;

drop policy if exists speakers_select on public.speakers;
create policy speakers_select on public.speakers
  for select to authenticated using (true);

drop policy if exists speakers_write on public.speakers;
create policy speakers_write on public.speakers
  for all to authenticated
  using (public.is_board_or_admin(auth.uid()) or public.is_ops_crm_user(auth.uid()))
  with check (public.is_board_or_admin(auth.uid()) or public.is_ops_crm_user(auth.uid()));
