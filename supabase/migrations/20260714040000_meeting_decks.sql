-- meeting_decks: themed presentation decks generated from live progress
-- context by the generate-meeting-deck edge function. Sibling to
-- meeting_briefs, but decks are leadership presentation material, so reads are
-- scoped to board/admin/advisor only (not every signed-in member).
--
-- The edge function writes with the service role (bypasses RLS); these policies
-- govern client access. INSERT policy is defensive only.

create table if not exists public.meeting_decks (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  generated_by uuid not null references auth.users(id),
  theme_note text,
  slides jsonb not null default '[]'::jsonb,
  deck_html text not null,
  source_snapshot jsonb,
  created_at timestamptz not null default now()
);

create index if not exists meeting_decks_event_idx
  on public.meeting_decks (event_id, created_at desc);

alter table public.meeting_decks enable row level security;

drop policy if exists md_select on public.meeting_decks;
create policy md_select on public.meeting_decks
  for select to authenticated
  using (
    public.is_board_or_admin(auth.uid())
    or public.is_advisor(auth.uid())
    or public.is_recruitment_lead(auth.uid())
  );

drop policy if exists md_insert on public.meeting_decks;
create policy md_insert on public.meeting_decks
  for insert to authenticated
  with check (auth.uid() = generated_by and public.is_board_or_admin(auth.uid()));
