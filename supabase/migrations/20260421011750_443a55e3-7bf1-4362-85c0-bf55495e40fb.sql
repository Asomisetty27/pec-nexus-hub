-- Helper
CREATE OR REPLACE FUNCTION public.is_advisor(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'advisor') $$;

-- Deliverable flag
ALTER TABLE public.deliverables
  ADD COLUMN IF NOT EXISTS advisor_review_required boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_deliverables_advisor_review
  ON public.deliverables(advisor_review_required) WHERE advisor_review_required = true;

-- finance_requests
CREATE TABLE IF NOT EXISTS public.finance_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL,
  request_type text NOT NULL DEFAULT 'purchase',
  title text NOT NULL,
  description text DEFAULT '',
  amount_cents integer DEFAULT 0,
  vendor text DEFAULT '',
  needed_by date,
  status text NOT NULL DEFAULT 'pending',
  advisor_note text DEFAULT '',
  reviewed_by uuid,
  reviewed_at timestamptz,
  external_link text,
  project_id uuid,
  cohort_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.finance_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fr_select" ON public.finance_requests FOR SELECT
  USING (is_advisor(auth.uid()) OR is_admin(auth.uid()) OR auth.uid() = requester_id);
CREATE POLICY "fr_insert" ON public.finance_requests FOR INSERT
  WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "fr_update" ON public.finance_requests FOR UPDATE
  USING (is_advisor(auth.uid()) OR is_admin(auth.uid()))
  WITH CHECK (is_advisor(auth.uid()) OR is_admin(auth.uid()));
CREATE TRIGGER trg_fr_updated BEFORE UPDATE ON public.finance_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- event_requests
CREATE TABLE IF NOT EXISTS public.event_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL,
  title text NOT NULL,
  description text DEFAULT '',
  event_date timestamptz,
  location text DEFAULT '',
  expected_attendance integer,
  involves_food boolean NOT NULL DEFAULT false,
  involves_travel boolean NOT NULL DEFAULT false,
  involves_minors boolean NOT NULL DEFAULT false,
  risk_notes text DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  advisor_note text DEFAULT '',
  reviewed_by uuid,
  reviewed_at timestamptz,
  external_link text,
  linked_event_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.event_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "er_select" ON public.event_requests FOR SELECT
  USING (is_advisor(auth.uid()) OR is_admin(auth.uid()) OR auth.uid() = requester_id);
CREATE POLICY "er_insert" ON public.event_requests FOR INSERT
  WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "er_update" ON public.event_requests FOR UPDATE
  USING (is_advisor(auth.uid()) OR is_admin(auth.uid()))
  WITH CHECK (is_advisor(auth.uid()) OR is_admin(auth.uid()));
CREATE TRIGGER trg_er_updated BEFORE UPDATE ON public.event_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- advisor_notes
CREATE TABLE IF NOT EXISTS public.advisor_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL,
  subject text NOT NULL,
  body text DEFAULT '',
  pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.advisor_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "an_select" ON public.advisor_notes FOR SELECT
  USING (is_advisor(auth.uid()) OR is_admin(auth.uid()));
CREATE POLICY "an_insert" ON public.advisor_notes FOR INSERT
  WITH CHECK ((is_advisor(auth.uid()) OR is_admin(auth.uid())) AND auth.uid() = author_id);
CREATE POLICY "an_update" ON public.advisor_notes FOR UPDATE
  USING (auth.uid() = author_id OR is_admin(auth.uid()))
  WITH CHECK (auth.uid() = author_id OR is_admin(auth.uid()));
CREATE POLICY "an_delete" ON public.advisor_notes FOR DELETE
  USING (auth.uid() = author_id OR is_admin(auth.uid()));
CREATE TRIGGER trg_an_updated BEFORE UPDATE ON public.advisor_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- advisor_resources
CREATE TABLE IF NOT EXISTS public.advisor_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  title text NOT NULL,
  description text DEFAULT '',
  url text,
  contact_email text,
  contact_phone text,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.advisor_resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ar_select" ON public.advisor_resources FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "ar_manage" ON public.advisor_resources FOR ALL
  USING (is_advisor(auth.uid()) OR is_admin(auth.uid()))
  WITH CHECK (is_advisor(auth.uid()) OR is_admin(auth.uid()));
CREATE TRIGGER trg_ar_updated BEFORE UPDATE ON public.advisor_resources
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Seed resources
INSERT INTO public.advisor_resources (category, title, description, url, display_order) VALUES
  ('club_support', 'Cal Poly Clubs & Organizations', 'Official hub for student club registration, recognition, and management resources.', 'https://www.asi.calpoly.edu/clubs/', 1),
  ('club_support', 'ASI Club Services', 'Primary support office for student organization operations and finance.', 'https://www.asi.calpoly.edu/clubs/club-services/', 2),
  ('events', 'Event Planning Guide (ASI)', 'Guidance for student organization event planning, reservations, and approvals.', 'https://www.asi.calpoly.edu/clubs/event-planning/', 1),
  ('events', 'Cal Poly Now / Campus Reservations', 'Official campus space reservation and event registration system.', 'https://now.calpoly.edu/', 2),
  ('finance', 'Club Finance Guide', 'ASI finance procedures, purchase requests, and reimbursements.', 'https://www.asi.calpoly.edu/clubs/club-services/finance/', 1),
  ('finance', 'Funding Opportunities', 'Information on club funding, grants, and ASI allocations.', 'https://www.asi.calpoly.edu/clubs/funding/', 2),
  ('club_management', 'Officer Transition Resources', 'Guidance for officer elections, transitions, and continuity.', 'https://www.asi.calpoly.edu/clubs/officer-resources/', 1),
  ('advisor_guidance', 'Faculty/Staff Advisor Resources', 'Advisor handbook, training, and expectations for student org advisors.', 'https://www.asi.calpoly.edu/clubs/advisor-resources/', 1),
  ('reporting_safety', 'Equal Opportunity & Title IX', 'Reporting discrimination, harassment, or Title IX concerns at Cal Poly.', 'https://equalopportunity.calpoly.edu/', 1),
  ('reporting_safety', 'Campus Safety & Emergency', 'University Police, emergency contacts, and safety reporting.', 'https://afd.calpoly.edu/police/', 2),
  ('reporting_safety', 'Clery Act / CSA Reporting', 'Campus Security Authority reporting obligations and process.', 'https://afd.calpoly.edu/police/clery/', 3)
ON CONFLICT DO NOTHING;