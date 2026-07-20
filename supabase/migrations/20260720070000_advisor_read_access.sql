-- Advisor review access: the advisor's job is to review gate materials, but
-- projects and deliverables were member/admin-only to read (proj_select,
-- del_select), so an advisor could see a gate and sign off without being able to
-- open the project or read the deliverables they were signing. Grant advisors
-- read access to projects and deliverables (oversight role). Additive permissive
-- policies -- member/admin access is unchanged.

drop policy if exists proj_select_advisor on public.projects;
create policy proj_select_advisor on public.projects
  for select to authenticated
  using (public.is_advisor(auth.uid()));

drop policy if exists del_select_advisor on public.deliverables;
create policy del_select_advisor on public.deliverables
  for select to authenticated
  using (public.is_advisor(auth.uid()));
