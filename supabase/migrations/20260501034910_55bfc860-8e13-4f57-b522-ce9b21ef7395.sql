-- ============================================================
-- Migration B: CRM schema, indexes, helpers, RLS, triggers
-- ============================================================

-- ---------- 1. organizations: column additions ----------
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS is_company_relation boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS crm_status public.crm_status NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS warmth_score public.crm_warmth NOT NULL DEFAULT 'cold',
  ADD COLUMN IF NOT EXISTS tier_priority public.crm_tier_priority,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS secondary_owner_user_id uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS overseeing_lead_user_id uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS industry text,
  ADD COLUMN IF NOT EXISTS hq_location text,
  ADD COLUMN IF NOT EXISTS website_url text,
  ADD COLUMN IF NOT EXISTS linkedin_url text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS last_contacted_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_action_at timestamptz,
  ADD COLUMN IF NOT EXISTS project_fit_score smallint,
  ADD COLUMN IF NOT EXISTS sponsor_fit_score smallint,
  ADD COLUMN IF NOT EXISTS response_likelihood_score smallint,
  ADD COLUMN IF NOT EXISTS prestige_score smallint;

DO $$ BEGIN
  ALTER TABLE public.organizations
    ADD CONSTRAINT org_project_fit_1_5 CHECK (project_fit_score IS NULL OR project_fit_score BETWEEN 1 AND 5);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.organizations
    ADD CONSTRAINT org_sponsor_fit_1_5 CHECK (sponsor_fit_score IS NULL OR sponsor_fit_score BETWEEN 1 AND 5);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.organizations
    ADD CONSTRAINT org_response_likelihood_1_5 CHECK (response_likelihood_score IS NULL OR response_likelihood_score BETWEEN 1 AND 5);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.organizations
    ADD CONSTRAINT org_prestige_1_5 CHECK (prestige_score IS NULL OR prestige_score BETWEEN 1 AND 5);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_orgs_is_company_relation ON public.organizations (is_company_relation) WHERE is_company_relation = true;
CREATE INDEX IF NOT EXISTS idx_orgs_crm_status ON public.organizations (crm_status);
CREATE INDEX IF NOT EXISTS idx_orgs_owner_user_id ON public.organizations (owner_user_id);

-- ---------- 2. New tables ----------
CREATE TABLE IF NOT EXISTS public.company_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  title text,
  email text,
  phone text,
  linkedin_url text,
  is_primary boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.company_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.company_contacts(id) ON DELETE SET NULL,
  performed_by uuid NOT NULL REFERENCES public.profiles(user_id),
  activity_type public.crm_activity_type NOT NULL,
  subject text,
  body text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.company_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  assigned_to uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES public.profiles(user_id),
  status public.crm_task_status NOT NULL DEFAULT 'open',
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.company_conversions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  conversion_type public.crm_conversion_type NOT NULL,
  converted_by uuid NOT NULL REFERENCES public.profiles(user_id),
  converted_at timestamptz NOT NULL DEFAULT now(),
  target_ref text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.org_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_by uuid REFERENCES public.profiles(user_id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------- 3. Indexes ----------
CREATE INDEX IF NOT EXISTS idx_company_activities_org_occurred ON public.company_activities (organization_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_company_activities_user_occurred ON public.company_activities (performed_by, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_company_tasks_assigned_due ON public.company_tasks (assigned_to, due_at);
CREATE INDEX IF NOT EXISTS idx_company_tasks_org_status ON public.company_tasks (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_company_contacts_org_primary ON public.company_contacts (organization_id, is_primary DESC);
CREATE UNIQUE INDEX IF NOT EXISTS company_contacts_email_per_org
  ON public.company_contacts (organization_id, lower(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS company_contacts_one_primary_per_org
  ON public.company_contacts (organization_id) WHERE is_primary = true;
CREATE INDEX IF NOT EXISTS idx_company_conversions_org_at ON public.company_conversions (organization_id, converted_at DESC);

-- ---------- 4. Helper functions ----------
CREATE OR REPLACE FUNCTION public.is_crm_leadership(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _uid
      AND role IN ('admin','superadmin','president','director_of_projects')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_ops_crm_user(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.is_crm_leadership(_uid)
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _uid AND role = 'outreach_lead')
    OR EXISTS (
      SELECT 1
      FROM public.cohort_memberships cm
      JOIN public.cohorts c ON c.id = cm.cohort_id
      WHERE cm.user_id = _uid AND c.name = 'Ops / PM'
    );
$$;

CREATE OR REPLACE FUNCTION public.resolve_designated_ops_lead()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT (value->>'user_id')::uuid FROM public.org_settings
       WHERE key = 'designated_ops_lead_user_id'),
    (SELECT ur.user_id
       FROM public.user_roles ur
       JOIN public.profiles p ON p.user_id = ur.user_id
      WHERE ur.role = 'outreach_lead'
        AND p.status = 'active'
      ORDER BY p.created_at ASC
      LIMIT 1),
    NULL
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_crm_leadership(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_ops_crm_user(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.resolve_designated_ops_lead() FROM anon;

-- ---------- 5. Triggers ----------
CREATE OR REPLACE FUNCTION public.bump_org_last_contacted()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.activity_type IN ('email_sent','follow_up_sent','linkedin_message','phone_call','meeting') THEN
    UPDATE public.organizations
       SET last_contacted_at = GREATEST(COALESCE(last_contacted_at, NEW.occurred_at), NEW.occurred_at)
     WHERE id = NEW.organization_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_bump_org_last_contacted ON public.company_activities;
CREATE TRIGGER trg_bump_org_last_contacted
AFTER INSERT ON public.company_activities
FOR EACH ROW EXECUTE FUNCTION public.bump_org_last_contacted();

DROP TRIGGER IF EXISTS trg_company_contacts_updated_at ON public.company_contacts;
CREATE TRIGGER trg_company_contacts_updated_at
BEFORE UPDATE ON public.company_contacts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trg_company_tasks_updated_at ON public.company_tasks;
CREATE TRIGGER trg_company_tasks_updated_at
BEFORE UPDATE ON public.company_tasks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trg_org_settings_updated_at ON public.org_settings;
CREATE TRIGGER trg_org_settings_updated_at
BEFORE UPDATE ON public.org_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---------- 6. RLS ----------
ALTER TABLE public.company_contacts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_activities  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_tasks       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_conversions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_settings        ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "CRM users can read company-relation orgs" ON public.organizations;
CREATE POLICY "CRM users can read company-relation orgs"
ON public.organizations FOR SELECT TO authenticated
USING (is_company_relation = true AND public.is_ops_crm_user(auth.uid()));

DROP POLICY IF EXISTS "CRM owners can update company-relation orgs" ON public.organizations;
CREATE POLICY "CRM owners can update company-relation orgs"
ON public.organizations FOR UPDATE TO authenticated
USING (
  is_company_relation = true AND (
    public.is_crm_leadership(auth.uid())
    OR owner_user_id = auth.uid()
    OR secondary_owner_user_id = auth.uid()
    OR overseeing_lead_user_id = auth.uid()
  )
)
WITH CHECK (
  is_company_relation = true AND (
    public.is_crm_leadership(auth.uid())
    OR owner_user_id = auth.uid()
    OR secondary_owner_user_id = auth.uid()
    OR overseeing_lead_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "CRM leadership can insert company-relation orgs" ON public.organizations;
CREATE POLICY "CRM leadership can insert company-relation orgs"
ON public.organizations FOR INSERT TO authenticated
WITH CHECK (is_company_relation = true AND public.is_ops_crm_user(auth.uid()));

-- company_contacts
CREATE POLICY "CRM users can read contacts" ON public.company_contacts FOR SELECT TO authenticated
USING (public.is_ops_crm_user(auth.uid()));

CREATE POLICY "CRM writers can insert contacts" ON public.company_contacts FOR INSERT TO authenticated
WITH CHECK (
  public.is_crm_leadership(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = organization_id AND (
      o.owner_user_id = auth.uid() OR o.secondary_owner_user_id = auth.uid() OR o.overseeing_lead_user_id = auth.uid()
      OR (
        o.owner_user_id IS NULL AND o.secondary_owner_user_id IS NULL AND o.overseeing_lead_user_id IS NULL
        AND o.crm_status IN ('not_started','researching','queued_for_outreach','contacted')
        AND EXISTS (SELECT 1 FROM public.cohort_memberships cm JOIN public.cohorts c ON c.id = cm.cohort_id
                    WHERE cm.user_id = auth.uid() AND c.name = 'Ops / PM')
      )
    )
  )
);

CREATE POLICY "CRM writers can update contacts" ON public.company_contacts FOR UPDATE TO authenticated
USING (
  public.is_crm_leadership(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = organization_id AND (
      o.owner_user_id = auth.uid() OR o.secondary_owner_user_id = auth.uid() OR o.overseeing_lead_user_id = auth.uid()
      OR (
        o.owner_user_id IS NULL AND o.secondary_owner_user_id IS NULL AND o.overseeing_lead_user_id IS NULL
        AND o.crm_status IN ('not_started','researching','queued_for_outreach','contacted')
        AND EXISTS (SELECT 1 FROM public.cohort_memberships cm JOIN public.cohorts c ON c.id = cm.cohort_id
                    WHERE cm.user_id = auth.uid() AND c.name = 'Ops / PM')
      )
    )
  )
);

CREATE POLICY "Admins can delete contacts" ON public.company_contacts FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin','superadmin','president')));

-- company_activities
CREATE POLICY "CRM users can read activities" ON public.company_activities FOR SELECT TO authenticated
USING (public.is_ops_crm_user(auth.uid()));

CREATE POLICY "CRM writers can insert activities" ON public.company_activities FOR INSERT TO authenticated
WITH CHECK (
  performed_by = auth.uid() AND (
    public.is_crm_leadership(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = organization_id AND (
        o.owner_user_id = auth.uid() OR o.secondary_owner_user_id = auth.uid() OR o.overseeing_lead_user_id = auth.uid()
        OR (
          o.owner_user_id IS NULL AND o.secondary_owner_user_id IS NULL AND o.overseeing_lead_user_id IS NULL
          AND o.crm_status IN ('not_started','researching','queued_for_outreach','contacted')
          AND EXISTS (SELECT 1 FROM public.cohort_memberships cm JOIN public.cohorts c ON c.id = cm.cohort_id
                      WHERE cm.user_id = auth.uid() AND c.name = 'Ops / PM')
        )
      )
    )
  )
);

CREATE POLICY "CRM writers can update own activities" ON public.company_activities FOR UPDATE TO authenticated
USING (performed_by = auth.uid() OR public.is_crm_leadership(auth.uid()));

CREATE POLICY "Admins can delete activities" ON public.company_activities FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin','superadmin','president')));

-- company_tasks
CREATE POLICY "CRM users can read tasks" ON public.company_tasks FOR SELECT TO authenticated
USING (public.is_ops_crm_user(auth.uid()));

CREATE POLICY "CRM writers can insert tasks" ON public.company_tasks FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid() AND (
    public.is_crm_leadership(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = organization_id AND (
        o.owner_user_id = auth.uid() OR o.secondary_owner_user_id = auth.uid() OR o.overseeing_lead_user_id = auth.uid()
        OR (
          o.owner_user_id IS NULL AND o.secondary_owner_user_id IS NULL AND o.overseeing_lead_user_id IS NULL
          AND o.crm_status IN ('not_started','researching','queued_for_outreach','contacted')
          AND EXISTS (SELECT 1 FROM public.cohort_memberships cm JOIN public.cohorts c ON c.id = cm.cohort_id
                      WHERE cm.user_id = auth.uid() AND c.name = 'Ops / PM')
        )
      )
    )
  )
);

CREATE POLICY "CRM writers can update tasks" ON public.company_tasks FOR UPDATE TO authenticated
USING (
  public.is_crm_leadership(auth.uid())
  OR assigned_to = auth.uid()
  OR created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = organization_id
      AND (o.owner_user_id = auth.uid() OR o.secondary_owner_user_id = auth.uid() OR o.overseeing_lead_user_id = auth.uid())
  )
);

CREATE POLICY "Admins can delete tasks" ON public.company_tasks FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin','superadmin','president')));

-- company_conversions
CREATE POLICY "CRM users can read conversions" ON public.company_conversions FOR SELECT TO authenticated
USING (public.is_ops_crm_user(auth.uid()));

CREATE POLICY "CRM writers can insert conversions" ON public.company_conversions FOR INSERT TO authenticated
WITH CHECK (
  converted_by = auth.uid() AND (
    public.is_crm_leadership(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = organization_id
        AND (o.owner_user_id = auth.uid() OR o.secondary_owner_user_id = auth.uid() OR o.overseeing_lead_user_id = auth.uid())
    )
  )
);

CREATE POLICY "Leadership can update conversions" ON public.company_conversions FOR UPDATE TO authenticated
USING (public.is_crm_leadership(auth.uid()));

CREATE POLICY "Admins can delete conversions" ON public.company_conversions FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin','superadmin','president')));

-- org_settings
CREATE POLICY "CRM users and leadership can read settings" ON public.org_settings FOR SELECT TO authenticated
USING (public.is_ops_crm_user(auth.uid()) OR public.is_crm_leadership(auth.uid()));

CREATE POLICY "Leadership can insert settings" ON public.org_settings FOR INSERT TO authenticated
WITH CHECK (public.is_crm_leadership(auth.uid()));

CREATE POLICY "Leadership can update settings" ON public.org_settings FOR UPDATE TO authenticated
USING (public.is_crm_leadership(auth.uid()));

CREATE POLICY "Leadership can delete settings" ON public.org_settings FOR DELETE TO authenticated
USING (public.is_crm_leadership(auth.uid()));