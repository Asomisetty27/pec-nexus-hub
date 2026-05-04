-- Race-safe claim/release for Ops members on unowned company-relation orgs.
CREATE OR REPLACE FUNCTION public.crm_claim_organization(_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _row organizations%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
  END IF;
  IF NOT public.is_ops_crm_user(_uid) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  -- Atomic claim: only succeeds when org is fully unowned.
  UPDATE public.organizations
     SET owner_user_id = _uid,
         updated_at = now()
   WHERE id = _org_id
     AND is_company_relation = true
     AND owner_user_id IS NULL
     AND secondary_owner_user_id IS NULL
     AND overseeing_lead_user_id IS NULL
   RETURNING * INTO _row;

  IF NOT FOUND THEN
    SELECT * INTO _row FROM public.organizations WHERE id = _org_id;
    IF _row.id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
    END IF;
    RETURN jsonb_build_object('ok', false, 'reason', 'already_owned',
      'owner_user_id', _row.owner_user_id);
  END IF;

  RETURN jsonb_build_object('ok', true, 'owner_user_id', _uid);
END;
$$;

CREATE OR REPLACE FUNCTION public.crm_release_organization(_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
  END IF;

  UPDATE public.organizations
     SET owner_user_id = NULL,
         updated_at = now()
   WHERE id = _org_id
     AND is_company_relation = true
     AND owner_user_id = _uid;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_owner');
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.crm_claim_organization(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.crm_release_organization(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.crm_claim_organization(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crm_release_organization(uuid) TO authenticated;