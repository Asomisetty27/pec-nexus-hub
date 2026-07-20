-- Close-out: the back of the pipeline was unreachable -- nothing wrote
-- projects.status so 'archived' could never happen, and there was no case study
-- (the portfolio asset the whole strategy depends on). This adds a lead-callable
-- close action and a case_studies record. Closes Tier-3 close/archive from the
-- 2026-07-20 lifecycle sim.

-- A lead closes their project (projects update is otherwise admin-only).
create or replace function public.close_project(_project_id uuid, _status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_project_lead(auth.uid(), _project_id) then
    raise exception 'only the project lead or an admin may change project status';
  end if;
  if _status not in ('active','completed','archived','on_hold') then
    raise exception 'invalid project status';
  end if;
  update public.projects set status = _status::public.project_status, updated_at = now()
    where id = _project_id;
end;
$$;
grant execute on function public.close_project(uuid, text) to authenticated;

-- Case study: one per project, the portfolio + client-quote asset.
create table if not exists public.case_studies (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  summary text not null default '',
  problem text not null default '',
  approach text not null default '',
  outcome text not null default '',
  client_quote text,
  is_public boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id)
);
create index if not exists case_studies_public_idx on public.case_studies (is_public) where is_public;

alter table public.case_studies enable row level security;

-- Public case studies are world-readable (portfolio site); otherwise members/admin.
drop policy if exists case_studies_select on public.case_studies;
create policy case_studies_select on public.case_studies
  for select using (is_public or public.is_active_member(auth.uid()) or public.is_admin(auth.uid()));

drop policy if exists case_studies_manage on public.case_studies;
create policy case_studies_manage on public.case_studies
  for all to authenticated
  using (public.is_project_lead(auth.uid(), project_id))
  with check (public.is_project_lead(auth.uid(), project_id));
