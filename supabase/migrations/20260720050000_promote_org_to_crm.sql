-- Intake -> CRM: an intake submission creates an organization with
-- is_company_relation=false, and the CRM board/queues only show
-- is_company_relation=true, so intake orgs were invisible with no way to promote
-- them (CrmLegacy told leadership to "promote qualified leads" but had no button,
-- and the org-update RLS is scoped to already-in-CRM rows). This RPC flips a
-- qualified intake org into the Company Relations pipeline. Closes the sim gap.
create or replace function public.promote_org_to_crm(_org_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_crm_leadership(auth.uid()) or public.is_ops_crm_user(auth.uid()) or public.is_admin(auth.uid())) then
    raise exception 'not authorized to promote organizations';
  end if;
  update public.organizations
    set is_company_relation = true,
        crm_status = 'researching'
    where id = _org_id and is_company_relation = false;
end;
$$;
grant execute on function public.promote_org_to_crm(uuid) to authenticated;
