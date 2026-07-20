-- Pod staffing: let a project lead manage their own pod's membership (the new
-- Team-tab staffing UI), in addition to admins. Before this, project_memberships
-- was admin-only (pm_manage_admin), so a PM could not add or remove members or
-- assign tech_lead / consultant roles, and pods were unstaffable past creation.
-- is_project_lead(uid, project) is admin OR role_on_project='lead' on that project,
-- so the first lead is seeded by an admin at formation and then staffs the rest.

drop policy if exists pm_manage_lead on public.project_memberships;
create policy pm_manage_lead on public.project_memberships
  for all to authenticated
  using (public.is_project_lead(auth.uid(), project_id))
  with check (public.is_project_lead(auth.uid(), project_id));
