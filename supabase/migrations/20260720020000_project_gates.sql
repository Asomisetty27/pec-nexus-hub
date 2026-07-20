-- Quality gates: the wk 3 / 6 / 11 review gates were marketing copy with no data
-- model. This makes them real. Every client/sponsor project gets three gates on
-- creation; a project lead runs each (ready -> passed/failed); the advisor signs
-- off on the two client-facing ones (midpoint, final). Closes the Tier-2 gap from
-- the 2026-07-20 lifecycle sim.

create table if not exists public.project_gates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  gate_key text not null check (gate_key in ('design_wk3','midpoint_wk6','final_wk11')),
  title text not null,
  status text not null default 'pending' check (status in ('pending','ready','passed','failed')),
  advisor_review_required boolean not null default false,
  advisor_signed_off boolean not null default false,
  advisor_signed_by uuid references auth.users(id),
  notes text,
  decided_by uuid references auth.users(id),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, gate_key)
);
create index if not exists project_gates_project_idx on public.project_gates (project_id);
create index if not exists project_gates_advisor_idx on public.project_gates (advisor_review_required, advisor_signed_off) where advisor_review_required;

-- Seed the three gates on every real (client/sponsor) project.
create or replace function public.seed_project_gates() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if NEW.project_mode in ('client_engagement','sponsor_deliverable') then
    insert into public.project_gates (project_id, gate_key, title, advisor_review_required) values
      (NEW.id, 'design_wk3',   'Week 3 — Design Direction Review (internal)', false),
      (NEW.id, 'midpoint_wk6', 'Week 6 — Midpoint Review (client + advisor)',  true),
      (NEW.id, 'final_wk11',   'Week 11 — Final Review (internal QA + advisor)', true)
    on conflict (project_id, gate_key) do nothing;
  end if;
  return NEW;
end;
$$;
drop trigger if exists trg_seed_project_gates on public.projects;
create trigger trg_seed_project_gates after insert on public.projects
  for each row execute function public.seed_project_gates();

-- RLS
alter table public.project_gates enable row level security;

drop policy if exists project_gates_select on public.project_gates;
create policy project_gates_select on public.project_gates
  for select to authenticated
  using (public.is_project_member(auth.uid(), project_id) or public.is_advisor(auth.uid()) or public.is_admin(auth.uid()));

drop policy if exists project_gates_manage on public.project_gates;
create policy project_gates_manage on public.project_gates
  for all to authenticated
  using (public.is_project_lead(auth.uid(), project_id))
  with check (public.is_project_lead(auth.uid(), project_id));

-- A lead decides a gate (ready -> passed/failed).
create or replace function public.decide_project_gate(_gate_id uuid, _status text, _notes text default null)
returns void language plpgsql security definer set search_path = public as $$
declare _g public.project_gates;
begin
  select * into _g from public.project_gates where id = _gate_id;
  if not found then raise exception 'gate not found'; end if;
  if not (public.is_project_lead(auth.uid(), _g.project_id)) then
    raise exception 'only the project lead may decide a gate';
  end if;
  if _status not in ('ready','passed','failed') then raise exception 'invalid status'; end if;
  update public.project_gates
    set status = _status, notes = coalesce(_notes, notes),
        decided_by = case when _status in ('passed','failed') then auth.uid() else decided_by end,
        decided_at = case when _status in ('passed','failed') then now() else decided_at end,
        updated_at = now()
    where id = _gate_id;
end;
$$;
grant execute on function public.decide_project_gate(uuid, text, text) to authenticated;

-- The advisor signs off on a gate flagged for advisor review.
create or replace function public.advisor_signoff_gate(_gate_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_advisor(auth.uid()) or public.is_admin(auth.uid())) then
    raise exception 'only the advisor may sign off';
  end if;
  update public.project_gates
    set advisor_signed_off = true, advisor_signed_by = auth.uid(), updated_at = now()
    where id = _gate_id and advisor_review_required;
end;
$$;
grant execute on function public.advisor_signoff_gate(uuid) to authenticated;
