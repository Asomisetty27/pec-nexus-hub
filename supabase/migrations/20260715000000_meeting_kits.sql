-- meeting_kits: hands-on facilitation packets generated from live progress
-- context. Where meeting_decks is the "what's the status / what do we discuss"
-- slideshow, a kit is the "what do we actually DO in the room" working
-- document: a concrete activity tied to the real active projects and blockers,
-- plus facilitation notes, a reference sheet, and discussion prompts.
--
-- Written by the generate-meeting-kit edge function (service role, bypasses
-- RLS). Leadership-scoped reads, mirroring meeting_decks.

create table if not exists public.meeting_kits (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  generated_by uuid not null references auth.users(id),
  theme_note text,
  kit jsonb not null default '{}'::jsonb,
  kit_html text not null,
  source_snapshot jsonb,
  created_at timestamptz not null default now()
);

create index if not exists meeting_kits_event_idx
  on public.meeting_kits (event_id, created_at desc);

alter table public.meeting_kits enable row level security;

drop policy if exists mk_select on public.meeting_kits;
create policy mk_select on public.meeting_kits
  for select to authenticated
  using (
    public.is_board_or_admin(auth.uid())
    or public.is_advisor(auth.uid())
    or public.is_recruitment_lead(auth.uid())
  );

drop policy if exists mk_insert on public.meeting_kits;
create policy mk_insert on public.meeting_kits
  for insert to authenticated
  with check (auth.uid() = generated_by and public.is_board_or_admin(auth.uid()));
