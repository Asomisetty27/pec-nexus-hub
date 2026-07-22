-- Block self-certification. guard_onboarding_certification let any cohort leader
-- (pm/lead/integration_lead) set certified_at, including on their OWN onboarding
-- row. Certification is the "staffable" gate and must be granted by someone else.
-- Board/admin may still certify anyone (needed to bootstrap the first leaders); a
-- cohort leader may certify their cohort members but not themselves.
CREATE OR REPLACE FUNCTION public.guard_onboarding_certification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  _is_admin boolean;
  _is_cohort_leader boolean;
begin
  if (new.certified_at is distinct from old.certified_at)
     or (new.certified_by is distinct from old.certified_by) then
    _is_admin := public.is_board_or_admin(auth.uid());
    _is_cohort_leader := exists (
      select 1 from public.cohort_memberships cm
      where cm.user_id = auth.uid()
        and cm.cohort_id = new.cohort_id
        and cm.role in ('pm','lead','integration_lead'));
    if not (_is_admin or (_is_cohort_leader and new.user_id <> auth.uid())) then
      raise exception 'certification must be granted by a cohort leader (not yourself) or board/admin';
    end if;
    new.certified_by := auth.uid();
  end if;
  new.updated_at := now();
  return new;
end;
$function$;
