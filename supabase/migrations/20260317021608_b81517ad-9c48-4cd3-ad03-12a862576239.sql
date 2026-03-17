
-- Add invite_state to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS invite_state text NOT NULL DEFAULT 'none';

-- Add invite tokens table
CREATE TABLE IF NOT EXISTS public.invite_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  used_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.invite_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invite_admin" ON public.invite_tokens FOR ALL USING (is_admin(auth.uid()));
CREATE POLICY "invite_select_own" ON public.invite_tokens FOR SELECT USING (lower(email) = lower((SELECT cal_poly_email FROM profiles WHERE user_id = auth.uid() LIMIT 1)));

-- Add auto-channel seeding function
CREATE OR REPLACE FUNCTION public.get_user_cohort_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cohort_id FROM cohort_memberships WHERE user_id = _user_id LIMIT 1
$$;

-- Allow channel insert for PMs/leads/admin
DROP POLICY IF EXISTS "ch_insert_pm" ON public.channels;
CREATE POLICY "ch_insert_pm" ON public.channels FOR INSERT WITH CHECK (
  is_admin(auth.uid()) OR EXISTS (
    SELECT 1 FROM cohort_memberships cm
    WHERE cm.user_id = auth.uid() AND cm.role IN ('pm','lead','integration_lead')
  )
);

-- Allow channel_members insert for admin and self-join org-wide
DROP POLICY IF EXISTS "cm_insert" ON public.channel_members;
CREATE POLICY "cm_insert" ON public.channel_members FOR INSERT WITH CHECK (
  is_admin(auth.uid()) OR (
    auth.uid() = user_id AND EXISTS (
      SELECT 1 FROM channels c WHERE c.id = channel_id AND c.is_org_wide = true
    )
  )
);
