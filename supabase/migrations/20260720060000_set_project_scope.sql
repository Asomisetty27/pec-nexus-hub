-- Scope authoring: projects.scope existed but was display-only and never written
-- (projects update is admin-only). Let the project lead author/edit the scope so
-- the engagement has a real, agreed scope of record. Closes the sim's scope gap.
create or replace function public.set_project_scope(_project_id uuid, _scope text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_project_lead(auth.uid(), _project_id) then
    raise exception 'only the project lead may edit the scope';
  end if;
  update public.projects set scope = _scope, updated_at = now() where id = _project_id;
end;
$$;
grant execute on function public.set_project_scope(uuid, text) to authenticated;
