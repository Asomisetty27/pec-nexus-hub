## Phase 1 + 2 Migration Plan — Final (v3, awaiting approval)

Strictly organizational CRM. No internship logic anywhere. Two migration files, no execution until you approve.

---

### 1. Enums (Migration A — enum-only, must commit before Migration B)

```sql
-- Extend app_role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'president';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'director_of_projects';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'outreach_lead';

-- New CRM enums
CREATE TYPE public.crm_status AS ENUM (
  'not_started','researching','queued_for_outreach','contacted',
  'in_conversation','meeting_scheduled','proposal_sent',
  'won','lost','dormant','do_not_contact'
);

CREATE TYPE public.crm_warmth AS ENUM ('cold','warm','hot');

CREATE TYPE public.crm_tier_priority AS ENUM ('tier_1','tier_2','tier_3');

CREATE TYPE public.crm_activity_type AS ENUM (
  'email_sent','follow_up_sent','linkedin_message','phone_call','meeting',
  'research_note','internal_note','status_change','task_completed'
);

CREATE TYPE public.crm_task_status AS ENUM ('open','in_progress','done','cancelled');

CREATE TYPE public.crm_conversion_type AS ENUM (
  'project_inquiry','sponsor_interest','speaker_interest',
  'judge_interest','recruiting_relationship','not_a_fit'
);
```

Split required because Postgres cannot use a newly added enum value in the same transaction.

---

### 2. organizations — column additions (Migration B)

```sql
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS is_company_relation boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS crm_status public.crm_status NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS warmth_score public.crm_warmth NOT NULL DEFAULT 'cold',
  ADD COLUMN IF NOT EXISTS tier_priority public.crm_tier_priority,  -- replaces any prior smallint usage
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
  -- Strategic scores: integers 1..5
  ADD COLUMN IF NOT EXISTS project_fit_score smallint,
  ADD COLUMN IF NOT EXISTS sponsor_fit_score smallint,
  ADD COLUMN IF NOT EXISTS response_likelihood_score smallint,
  ADD COLUMN IF NOT EXISTS prestige_score smallint;

ALTER TABLE public.organizations
  ADD CONSTRAINT org_project_fit_1_5      CHECK (project_fit_score      IS NULL OR project_fit_score      BETWEEN 1 AND 5),
  ADD CONSTRAINT org_sponsor_fit_1_5      CHECK (sponsor_fit_score      IS NULL OR sponsor_fit_score      BETWEEN 1 AND 5),
  ADD CONSTRAINT org_response_likelihood_1_5 CHECK (response_likelihood_score IS NULL OR response_likelihood_score BETWEEN 1 AND 5),
  ADD CONSTRAINT org_prestige_1_5         CHECK (prestige_score         IS NULL OR prestige_score         BETWEEN 1 AND 5);
```

No internship columns. CRM UI filters on `is_company_relation = true`.

---

### 3. New tables

**company_contacts**
```
id uuid pk, organization_id uuid fk -> organizations(id) on delete cascade,
full_name text not null, title text, email text, phone text,
linkedin_url text, is_primary boolean not null default false,
notes text, created_at, updated_at
```

**company_activities**
```
id uuid pk, organization_id uuid fk -> organizations(id) on delete cascade,
contact_id uuid null fk -> company_contacts(id) on delete set null,
performed_by uuid not null fk -> profiles(user_id),
activity_type crm_activity_type not null,
subject text, body text, occurred_at timestamptz not null default now(),
created_at
```

**company_tasks**
```
id uuid pk, organization_id uuid fk -> organizations(id) on delete cascade,
title text not null, description text,
assigned_to uuid fk -> profiles(user_id) on delete set null,
created_by uuid not null fk -> profiles(user_id),
status crm_task_status not null default 'open',
due_at timestamptz, completed_at timestamptz,
created_at, updated_at
```

**company_conversions**
```
id uuid pk, organization_id uuid fk -> organizations(id) on delete cascade,
conversion_type crm_conversion_type not null,
converted_by uuid not null fk -> profiles(user_id),
converted_at timestamptz not null default now(),
target_ref text,           -- e.g. project_id, lead_id (free-form for now)
notes text, created_at
```

**org_settings** (generic key/value, scoped reads)
```
key text primary key, value jsonb not null,
updated_by uuid fk -> profiles(user_id), updated_at timestamptz default now()
```

Used by: `designated_ops_lead_user_id`.

---

### 4. Indexes

```sql
-- organizations
CREATE INDEX ON public.organizations (is_company_relation) WHERE is_company_relation = true;
CREATE INDEX ON public.organizations (crm_status);
CREATE INDEX ON public.organizations (owner_user_id);

-- company_activities
CREATE INDEX ON public.company_activities (organization_id, occurred_at DESC);
CREATE INDEX ON public.company_activities (performed_by, occurred_at DESC);

-- company_tasks
CREATE INDEX ON public.company_tasks (assigned_to, due_at);
CREATE INDEX ON public.company_tasks (organization_id, status);

-- company_contacts
CREATE INDEX ON public.company_contacts (organization_id, is_primary DESC);
CREATE UNIQUE INDEX company_contacts_email_per_org
  ON public.company_contacts (organization_id, lower(email))
  WHERE email IS NOT NULL;
CREATE UNIQUE INDEX company_contacts_one_primary_per_org
  ON public.company_contacts (organization_id)
  WHERE is_primary = true;

-- company_conversions
CREATE INDEX ON public.company_conversions (organization_id, converted_at DESC);
```

No global email uniqueness.

---

### 5. Helper functions (SECURITY DEFINER, search_path = public)

```sql
-- Leadership = admin/superadmin/president/director_of_projects
CREATE OR REPLACE FUNCTION public.is_crm_leadership(_uid uuid) RETURNS boolean ...
  -- exists in user_roles with role in (admin,superadmin,president,director_of_projects)

-- Ops CRM user = leadership OR outreach_lead OR member of Ops cohort
CREATE OR REPLACE FUNCTION public.is_ops_crm_user(_uid uuid) RETURNS boolean ...

-- Resolve designated ops lead
CREATE OR REPLACE FUNCTION public.resolve_designated_ops_lead() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT (value->>'user_id')::uuid FROM public.org_settings
       WHERE key = 'designated_ops_lead_user_id'),
    (SELECT ur.user_id FROM public.user_roles ur
       JOIN public.profiles p ON p.user_id = ur.user_id
       WHERE ur.role = 'outreach_lead' AND p.status = 'active'
       ORDER BY ur.created_at ASC LIMIT 1),
    NULL
  );
$$;
```

---

### 6. RLS policies

All five new tables (and `org_settings`): `ENABLE ROW LEVEL SECURITY`.

**organizations** (extend existing):
- Read: existing policies preserved. Add CRM-scoped read for `is_ops_crm_user(auth.uid())` to read all rows where `is_company_relation = true`.
- Write/CRM fields: leadership OR `owner_user_id = auth.uid()` OR `secondary_owner_user_id = auth.uid()` OR `overseeing_lead_user_id = auth.uid()`.

**company_contacts / company_activities / company_tasks / company_conversions** — split policies:

- SELECT: `is_ops_crm_user(auth.uid())`
- INSERT/UPDATE: allowed when ANY of:
  - `is_crm_leadership(auth.uid())`, OR
  - user is `owner_user_id` / `secondary_owner_user_id` / `overseeing_lead_user_id` of the parent organization, OR
  - user is in Ops cohort AND parent organization has no owners assigned AND `crm_status IN ('not_started','researching','queued_for_outreach','contacted')`
- DELETE: admin / superadmin / president only.

**org_settings**:
- SELECT: `is_ops_crm_user(auth.uid()) OR is_crm_leadership(auth.uid())`
- INSERT/UPDATE/DELETE: `is_crm_leadership(auth.uid())`

Existing `leads` and `sponsorship_packages` RLS untouched.

---

### 7. Triggers

**Activity → last_contacted_at** (narrow):
```sql
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

CREATE TRIGGER trg_bump_org_last_contacted
AFTER INSERT ON public.company_activities
FOR EACH ROW EXECUTE FUNCTION public.bump_org_last_contacted();
```

Does NOT fire for `research_note`, `internal_note`, `status_change`, `task_completed`.

Standard `updated_at` triggers added to `company_contacts`, `company_tasks`, `org_settings`.

---

### 8. Migration split

- **Migration A** (`..._crm_enums.sql`): enum additions/creations only. Must commit before B.
- **Migration B** (`..._crm_schema.sql`): columns, tables, indexes, helper functions, RLS, triggers.

---

### 9. Risks / explicit assumptions

1. `app_role` enum cannot be extended and used in the same migration — handled via split.
2. `tier_priority` is added as the new enum type. If a prior smallint column with the same name exists on `organizations`, the migration will need an explicit DROP+ADD; I will verify by reading the live schema before generating Migration B and call this out.
3. `profiles.user_id` is the FK target for owner columns (matches existing pattern in this codebase).
4. Ops cohort membership check uses the existing cohort/membership tables; exact predicate will be confirmed against current schema before generation.
5. No backfill: existing organizations get `is_company_relation = false` and won't appear in CRM until explicitly flagged.
6. Existing `leads` / `sponsorship_packages` / public intake flows remain fully intact.
7. App-side `src/integrations/supabase/types.ts` regenerates after each migration; UI work waits for that.

---

### 10. Next step

On your approval, I will:
1. Read the live `organizations` schema to confirm `tier_priority` handling and Ops cohort predicate.
2. Generate Migration A, then Migration B, and pause for you to approve each before it runs.

No migration will be generated or executed until you say go.
