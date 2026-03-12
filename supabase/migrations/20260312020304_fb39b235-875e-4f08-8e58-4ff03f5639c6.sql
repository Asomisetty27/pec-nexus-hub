
-- PEC NEXUS v1.0 SCHEMA — ALL IN ONE

-- ENUMS
CREATE TYPE public.app_role AS ENUM ('applicant','member','project_consultant','project_lead','board_member','admin','superadmin');
CREATE TYPE public.project_status AS ENUM ('draft','active','on_hold','completed','archived');
CREATE TYPE public.task_status AS ENUM ('todo','in_progress','review','done');
CREATE TYPE public.task_priority AS ENUM ('low','medium','high','urgent');
CREATE TYPE public.milestone_status AS ENUM ('not_started','in_progress','completed','overdue');
CREATE TYPE public.lead_stage AS ENUM ('new','contacted','scoping','proposed','signed','active','completed','lost');
CREATE TYPE public.role_request_status AS ENUM ('pending','approved','rejected');
CREATE TYPE public.event_type AS ENUM ('workshop','meeting','competition','social','presentation','other');
CREATE TYPE public.message_type AS ENUM ('message','update','blocker','decision','action');
CREATE TYPE public.doc_visibility AS ENUM ('public','members','board','admin');
CREATE TYPE public.member_status AS ENUM ('active','inactive','suspended','alumni');

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  bio TEXT DEFAULT '',
  skills TEXT[] DEFAULT '{}',
  cal_poly_email TEXT,
  phone TEXT,
  major TEXT,
  graduation_year INT,
  linkedin_url TEXT,
  status public.member_status NOT NULL DEFAULT 'active',
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- USER ROLES
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- ROLE REQUESTS
CREATE TABLE public.role_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  requested_role public.app_role NOT NULL,
  status public.role_request_status NOT NULL DEFAULT 'pending',
  reason TEXT DEFAULT '',
  reviewer_id UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ORGANIZATIONS
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'client',
  website TEXT,
  logo_url TEXT,
  description TEXT DEFAULT '',
  tier TEXT,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- PROJECTS
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  status public.project_status NOT NULL DEFAULT 'draft',
  client_org_id UUID REFERENCES public.organizations(id),
  start_date DATE,
  end_date DATE,
  scope TEXT DEFAULT '',
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- PROJECT MEMBERSHIPS
CREATE TABLE public.project_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role_on_project TEXT NOT NULL DEFAULT 'consultant',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id)
);

-- TASKS
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  status public.task_status NOT NULL DEFAULT 'todo',
  priority public.task_priority NOT NULL DEFAULT 'medium',
  assignee_id UUID REFERENCES auth.users(id),
  due_date DATE,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  source_message_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- MILESTONES
CREATE TABLE public.milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  due_date DATE,
  status public.milestone_status NOT NULL DEFAULT 'not_started',
  progress INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- DELIVERABLES
CREATE TABLE public.deliverables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  milestone_id UUID REFERENCES public.milestones(id),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  file_url TEXT,
  version INT NOT NULL DEFAULT 1,
  client_visible BOOLEAN NOT NULL DEFAULT false,
  approved BOOLEAN NOT NULL DEFAULT false,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- DECISIONS
CREATE TABLE public.decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  rationale TEXT DEFAULT '',
  reference_links TEXT DEFAULT '',
  decided_by UUID REFERENCES auth.users(id) NOT NULL,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RISKS
CREATE TABLE public.risks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  severity TEXT NOT NULL DEFAULT 'medium',
  owner_id UUID REFERENCES auth.users(id),
  mitigation TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- MEETING NOTES
CREATE TABLE public.meeting_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  content TEXT DEFAULT '',
  action_items JSONB DEFAULT '[]',
  attendees UUID[] DEFAULT '{}',
  external_visible BOOLEAN NOT NULL DEFAULT false,
  author_id UUID REFERENCES auth.users(id) NOT NULL,
  meeting_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- PROJECT UPDATES
CREATE TABLE public.project_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  author_id UUID REFERENCES auth.users(id) NOT NULL,
  summary TEXT NOT NULL,
  blockers TEXT DEFAULT '',
  next_steps TEXT DEFAULT '',
  health TEXT NOT NULL DEFAULT 'green',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- CHANNELS
CREATE TABLE public.channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  is_org_wide BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- CHANNEL MEMBERS
CREATE TABLE public.channel_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID REFERENCES public.channels(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (channel_id, user_id)
);

-- MESSAGES
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID REFERENCES public.channels(id) ON DELETE CASCADE NOT NULL,
  author_id UUID REFERENCES auth.users(id) NOT NULL,
  content TEXT NOT NULL,
  message_type public.message_type NOT NULL DEFAULT 'message',
  parent_id UUID REFERENCES public.messages(id),
  reactions JSONB DEFAULT '{}',
  mentions UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- LEADS
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organizations(id),
  contact_name TEXT NOT NULL,
  contact_email TEXT,
  contact_phone TEXT,
  source TEXT DEFAULT 'intake_form',
  stage public.lead_stage NOT NULL DEFAULT 'new',
  notes TEXT DEFAULT '',
  assigned_to UUID REFERENCES auth.users(id),
  value NUMERIC(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- SPONSORSHIP PACKAGES
CREATE TABLE public.sponsorship_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'silver',
  benefits JSONB DEFAULT '[]',
  amount NUMERIC(10,2),
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- EVENTS
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  event_type public.event_type NOT NULL DEFAULT 'other',
  location TEXT DEFAULT '',
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  capacity INT,
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- EVENT RSVPS
CREATE TABLE public.event_rsvps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  checked_in BOOLEAN NOT NULL DEFAULT false,
  checked_in_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

-- COMPETITIONS
CREATE TABLE public.competitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  application_deadline TIMESTAMPTZ,
  judging_start TIMESTAMPTZ,
  judging_end TIMESTAMPTZ,
  results_published BOOLEAN NOT NULL DEFAULT false,
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- COMPETITION APPLICATIONS
CREATE TABLE public.competition_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id UUID REFERENCES public.competitions(id) ON DELETE CASCADE NOT NULL,
  applicant_name TEXT NOT NULL,
  applicant_email TEXT NOT NULL,
  submission_url TEXT,
  submission_notes TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'submitted',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- JUDGE ASSIGNMENTS
CREATE TABLE public.judge_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id UUID REFERENCES public.competitions(id) ON DELETE CASCADE NOT NULL,
  judge_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  UNIQUE (competition_id, judge_user_id)
);

-- JUDGE SCORES
CREATE TABLE public.judge_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES public.competition_applications(id) ON DELETE CASCADE NOT NULL,
  judge_id UUID REFERENCES auth.users(id) NOT NULL,
  score NUMERIC(5,2) NOT NULL,
  feedback TEXT DEFAULT '',
  scored_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (application_id, judge_id)
);

-- RECRUITING
CREATE TABLE public.recruiting_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  applicant_name TEXT NOT NULL,
  applicant_email TEXT NOT NULL,
  resume_url TEXT,
  cover_letter TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'submitted',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- REVIEWER SCORES
CREATE TABLE public.reviewer_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES public.recruiting_applications(id) ON DELETE CASCADE NOT NULL,
  reviewer_id UUID REFERENCES auth.users(id) NOT NULL,
  score NUMERIC(5,2) NOT NULL,
  rubric JSONB DEFAULT '{}',
  notes TEXT DEFAULT '',
  scored_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (application_id, reviewer_id)
);

-- COURSES
CREATE TABLE public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  is_required BOOLEAN NOT NULL DEFAULT false,
  required_for_roles public.app_role[] DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- LESSONS
CREATE TABLE public.lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  content TEXT DEFAULT '',
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- QUIZZES
CREATE TABLE public.quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID REFERENCES public.lessons(id) ON DELETE CASCADE NOT NULL,
  questions JSONB NOT NULL DEFAULT '[]',
  passing_score INT NOT NULL DEFAULT 70,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- COURSE PROGRESS
CREATE TABLE public.course_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
  completed_lessons UUID[] DEFAULT '{}',
  quiz_scores JSONB DEFAULT '{}',
  completed BOOLEAN NOT NULL DEFAULT false,
  certified_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, course_id)
);

-- GOVERNANCE DOCS
CREATE TABLE public.governance_docs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT DEFAULT '',
  category TEXT NOT NULL DEFAULT 'general',
  visibility public.doc_visibility NOT NULL DEFAULT 'members',
  version INT NOT NULL DEFAULT 1,
  tags TEXT[] DEFAULT '{}',
  author_id UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ANNOUNCEMENTS
CREATE TABLE public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  author_id UUID REFERENCES auth.users(id) NOT NULL,
  pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- AUDIT LOGS
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- NOTIFICATIONS
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  body TEXT DEFAULT '',
  link TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- FEATURE FLAGS
CREATE TABLE public.feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  description TEXT DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- FEEDBACK TICKETS
CREATE TABLE public.feedback_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  org_id UUID REFERENCES public.organizations(id),
  author_id UUID REFERENCES auth.users(id) NOT NULL,
  subject TEXT NOT NULL,
  body TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- PEER EVALUATIONS
CREATE TABLE public.peer_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  evaluator_id UUID REFERENCES auth.users(id) NOT NULL,
  evaluatee_id UUID REFERENCES auth.users(id) NOT NULL,
  score NUMERIC(5,2),
  contribution_notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, evaluator_id, evaluatee_id)
);

-- INDEXES
CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_tasks_project_id ON public.tasks(project_id);
CREATE INDEX idx_tasks_assignee ON public.tasks(assignee_id);
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_messages_channel ON public.messages(channel_id);
CREATE INDEX idx_messages_created ON public.messages(created_at);
CREATE INDEX idx_leads_stage ON public.leads(stage);
CREATE INDEX idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_created ON public.audit_logs(created_at);
CREATE INDEX idx_notifications_user ON public.notifications(user_id);
CREATE INDEX idx_project_memberships_user ON public.project_memberships(user_id);
CREATE INDEX idx_project_memberships_project ON public.project_memberships(project_id);
CREATE INDEX idx_deliverables_project ON public.deliverables(project_id);
CREATE INDEX idx_event_rsvps_event ON public.event_rsvps(event_id);

-- SECURITY DEFINER FUNCTIONS
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','superadmin')) $$;

CREATE OR REPLACE FUNCTION public.is_board_or_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('board_member','admin','superadmin')) $$;

CREATE OR REPLACE FUNCTION public.is_project_member(_user_id UUID, _project_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.project_memberships WHERE user_id = _user_id AND project_id = _project_id) $$;

CREATE OR REPLACE FUNCTION public.is_channel_member(_user_id UUID, _channel_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.channel_members WHERE user_id = _user_id AND channel_id = _channel_id) $$;

-- AUTO-CREATE PROFILE ON SIGNUP
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, cal_poly_email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'applicant');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- UPDATED_AT TRIGGER
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_projects_updated BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_tasks_updated BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_milestones_updated BEFORE UPDATE ON public.milestones FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_deliverables_updated BEFORE UPDATE ON public.deliverables FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_organizations_updated BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_leads_updated BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_risks_updated BEFORE UPDATE ON public.risks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_messages_updated BEFORE UPDATE ON public.messages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_recruiting_updated BEFORE UPDATE ON public.recruiting_applications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_governance_updated BEFORE UPDATE ON public.governance_docs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_feedback_updated BEFORE UPDATE ON public.feedback_tickets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- REALTIME
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;

-- RLS: PROFILES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "profiles_select_admin" ON public.profiles FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "profiles_select_members" ON public.profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role NOT IN ('applicant'))
  AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = profiles.user_id AND role NOT IN ('applicant'))
);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS: USER ROLES
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roles_select_own" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "roles_select_admin" ON public.user_roles FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "roles_manage_admin" ON public.user_roles FOR ALL USING (public.is_admin(auth.uid()));

-- RLS: ROLE REQUESTS
ALTER TABLE public.role_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rr_select_own" ON public.role_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "rr_insert_own" ON public.role_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "rr_manage_admin" ON public.role_requests FOR ALL USING (public.is_admin(auth.uid()));

-- RLS: ORGANIZATIONS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orgs_select_members" ON public.organizations FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role NOT IN ('applicant'))
);
CREATE POLICY "orgs_manage_admin" ON public.organizations FOR ALL USING (public.is_admin(auth.uid()));

-- RLS: PROJECTS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "proj_select" ON public.projects FOR SELECT USING (
  public.is_project_member(auth.uid(), id) OR public.is_admin(auth.uid()) OR public.is_board_or_admin(auth.uid())
);
CREATE POLICY "proj_manage_admin" ON public.projects FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "proj_update_lead" ON public.projects FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.project_memberships WHERE project_id = id AND user_id = auth.uid() AND role_on_project = 'lead')
);

-- RLS: PROJECT MEMBERSHIPS
ALTER TABLE public.project_memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pm_select" ON public.project_memberships FOR SELECT USING (
  public.is_project_member(auth.uid(), project_id) OR public.is_admin(auth.uid())
);
CREATE POLICY "pm_manage_admin" ON public.project_memberships FOR ALL USING (public.is_admin(auth.uid()));

-- RLS: TASKS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tasks_select" ON public.tasks FOR SELECT USING (public.is_project_member(auth.uid(), project_id) OR public.is_admin(auth.uid()));
CREATE POLICY "tasks_insert" ON public.tasks FOR INSERT WITH CHECK (public.is_project_member(auth.uid(), project_id));
CREATE POLICY "tasks_update" ON public.tasks FOR UPDATE USING (public.is_project_member(auth.uid(), project_id));
CREATE POLICY "tasks_manage_admin" ON public.tasks FOR ALL USING (public.is_admin(auth.uid()));

-- RLS: MILESTONES
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ms_select" ON public.milestones FOR SELECT USING (public.is_project_member(auth.uid(), project_id) OR public.is_admin(auth.uid()));
CREATE POLICY "ms_insert" ON public.milestones FOR INSERT WITH CHECK (public.is_project_member(auth.uid(), project_id));
CREATE POLICY "ms_update" ON public.milestones FOR UPDATE USING (public.is_project_member(auth.uid(), project_id));
CREATE POLICY "ms_manage_admin" ON public.milestones FOR ALL USING (public.is_admin(auth.uid()));

-- RLS: DELIVERABLES
ALTER TABLE public.deliverables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "del_select" ON public.deliverables FOR SELECT USING (public.is_project_member(auth.uid(), project_id) OR public.is_admin(auth.uid()));
CREATE POLICY "del_insert" ON public.deliverables FOR INSERT WITH CHECK (public.is_project_member(auth.uid(), project_id));
CREATE POLICY "del_update" ON public.deliverables FOR UPDATE USING (public.is_project_member(auth.uid(), project_id));

-- RLS: DECISIONS
ALTER TABLE public.decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dec_select" ON public.decisions FOR SELECT USING (public.is_project_member(auth.uid(), project_id) OR public.is_admin(auth.uid()));
CREATE POLICY "dec_insert" ON public.decisions FOR INSERT WITH CHECK (public.is_project_member(auth.uid(), project_id));

-- RLS: RISKS
ALTER TABLE public.risks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "risk_select" ON public.risks FOR SELECT USING (public.is_project_member(auth.uid(), project_id) OR public.is_admin(auth.uid()));
CREATE POLICY "risk_insert" ON public.risks FOR INSERT WITH CHECK (public.is_project_member(auth.uid(), project_id));
CREATE POLICY "risk_update" ON public.risks FOR UPDATE USING (public.is_project_member(auth.uid(), project_id));

-- RLS: MEETING NOTES
ALTER TABLE public.meeting_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mn_select" ON public.meeting_notes FOR SELECT USING (public.is_project_member(auth.uid(), project_id) OR public.is_admin(auth.uid()));
CREATE POLICY "mn_insert" ON public.meeting_notes FOR INSERT WITH CHECK (public.is_project_member(auth.uid(), project_id));

-- RLS: PROJECT UPDATES
ALTER TABLE public.project_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pu_select" ON public.project_updates FOR SELECT USING (public.is_project_member(auth.uid(), project_id) OR public.is_admin(auth.uid()));
CREATE POLICY "pu_insert" ON public.project_updates FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.project_memberships WHERE project_id = project_updates.project_id AND user_id = auth.uid() AND role_on_project = 'lead')
  OR public.is_admin(auth.uid())
);

-- RLS: CHANNELS
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ch_select" ON public.channels FOR SELECT USING (public.is_channel_member(auth.uid(), id) OR is_org_wide OR public.is_admin(auth.uid()));
CREATE POLICY "ch_manage_admin" ON public.channels FOR ALL USING (public.is_admin(auth.uid()));

-- RLS: CHANNEL MEMBERS
ALTER TABLE public.channel_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cm_select" ON public.channel_members FOR SELECT USING (public.is_channel_member(auth.uid(), channel_id) OR public.is_admin(auth.uid()));
CREATE POLICY "cm_manage_admin" ON public.channel_members FOR ALL USING (public.is_admin(auth.uid()));

-- RLS: MESSAGES
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "msg_select" ON public.messages FOR SELECT USING (public.is_channel_member(auth.uid(), channel_id) OR public.is_admin(auth.uid()));
CREATE POLICY "msg_insert" ON public.messages FOR INSERT WITH CHECK (public.is_channel_member(auth.uid(), channel_id) AND auth.uid() = author_id);
CREATE POLICY "msg_update" ON public.messages FOR UPDATE USING (auth.uid() = author_id);

-- RLS: LEADS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leads_select" ON public.leads FOR SELECT USING (public.is_board_or_admin(auth.uid()));
CREATE POLICY "leads_manage_admin" ON public.leads FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "leads_insert_public" ON public.leads FOR INSERT WITH CHECK (true);

-- RLS: SPONSORSHIP PACKAGES
ALTER TABLE public.sponsorship_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sp_select" ON public.sponsorship_packages FOR SELECT USING (public.is_board_or_admin(auth.uid()));
CREATE POLICY "sp_manage_admin" ON public.sponsorship_packages FOR ALL USING (public.is_admin(auth.uid()));

-- RLS: EVENTS
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "events_public" ON public.events FOR SELECT USING (is_public);
CREATE POLICY "events_members" ON public.events FOR SELECT USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()));
CREATE POLICY "events_manage_admin" ON public.events FOR ALL USING (public.is_admin(auth.uid()));

-- RLS: EVENT RSVPS
ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rsvp_select_own" ON public.event_rsvps FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "rsvp_insert" ON public.event_rsvps FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "rsvp_select_admin" ON public.event_rsvps FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "rsvp_manage_admin" ON public.event_rsvps FOR ALL USING (public.is_admin(auth.uid()));

-- RLS: COMPETITIONS
ALTER TABLE public.competitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comp_public" ON public.competitions FOR SELECT USING (is_public);
CREATE POLICY "comp_members" ON public.competitions FOR SELECT USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()));
CREATE POLICY "comp_manage_admin" ON public.competitions FOR ALL USING (public.is_admin(auth.uid()));

-- RLS: COMPETITION APPLICATIONS
ALTER TABLE public.competition_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ca_admin" ON public.competition_applications FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "ca_insert" ON public.competition_applications FOR INSERT WITH CHECK (true);
CREATE POLICY "ca_judges" ON public.competition_applications FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.judge_assignments WHERE competition_id = competition_applications.competition_id AND judge_user_id = auth.uid())
);

-- RLS: JUDGE ASSIGNMENTS
ALTER TABLE public.judge_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ja_own" ON public.judge_assignments FOR SELECT USING (auth.uid() = judge_user_id);
CREATE POLICY "ja_manage_admin" ON public.judge_assignments FOR ALL USING (public.is_admin(auth.uid()));

-- RLS: JUDGE SCORES
ALTER TABLE public.judge_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "js_own" ON public.judge_scores FOR ALL USING (auth.uid() = judge_id);
CREATE POLICY "js_admin" ON public.judge_scores FOR SELECT USING (public.is_admin(auth.uid()));

-- RLS: RECRUITING
ALTER TABLE public.recruiting_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ra_manage_admin" ON public.recruiting_applications FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "ra_insert" ON public.recruiting_applications FOR INSERT WITH CHECK (true);
CREATE POLICY "ra_select_own" ON public.recruiting_applications FOR SELECT USING (auth.uid() = user_id);

-- RLS: REVIEWER SCORES
ALTER TABLE public.reviewer_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rs_own" ON public.reviewer_scores FOR ALL USING (auth.uid() = reviewer_id);
CREATE POLICY "rs_admin" ON public.reviewer_scores FOR SELECT USING (public.is_admin(auth.uid()));

-- RLS: COURSES
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "courses_select" ON public.courses FOR SELECT USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()));
CREATE POLICY "courses_manage_admin" ON public.courses FOR ALL USING (public.is_admin(auth.uid()));

-- RLS: LESSONS
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lessons_select" ON public.lessons FOR SELECT USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()));
CREATE POLICY "lessons_manage_admin" ON public.lessons FOR ALL USING (public.is_admin(auth.uid()));

-- RLS: QUIZZES
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quizzes_select" ON public.quizzes FOR SELECT USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()));
CREATE POLICY "quizzes_manage_admin" ON public.quizzes FOR ALL USING (public.is_admin(auth.uid()));

-- RLS: COURSE PROGRESS
ALTER TABLE public.course_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cp_select_own" ON public.course_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "cp_insert_own" ON public.course_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cp_update_own" ON public.course_progress FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "cp_admin" ON public.course_progress FOR SELECT USING (public.is_admin(auth.uid()));

-- RLS: GOVERNANCE DOCS
ALTER TABLE public.governance_docs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gd_select" ON public.governance_docs FOR SELECT USING (
  visibility = 'public' OR
  (visibility = 'members' AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role NOT IN ('applicant'))) OR
  (visibility = 'board' AND public.is_board_or_admin(auth.uid())) OR
  (visibility = 'admin' AND public.is_admin(auth.uid()))
);
CREATE POLICY "gd_manage_admin" ON public.governance_docs FOR ALL USING (public.is_admin(auth.uid()));

-- RLS: ANNOUNCEMENTS
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ann_select" ON public.announcements FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "ann_manage_admin" ON public.announcements FOR ALL USING (public.is_admin(auth.uid()));

-- RLS: AUDIT LOGS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "al_select" ON public.audit_logs FOR SELECT USING (public.is_board_or_admin(auth.uid()));

-- RLS: NOTIFICATIONS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif_select_own" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notif_update_own" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

-- RLS: FEATURE FLAGS
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ff_select" ON public.feature_flags FOR SELECT USING (true);
CREATE POLICY "ff_manage_admin" ON public.feature_flags FOR ALL USING (public.is_admin(auth.uid()));

-- RLS: FEEDBACK TICKETS
ALTER TABLE public.feedback_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ft_select_own" ON public.feedback_tickets FOR SELECT USING (auth.uid() = author_id);
CREATE POLICY "ft_select_pm" ON public.feedback_tickets FOR SELECT USING (public.is_project_member(auth.uid(), project_id) OR public.is_admin(auth.uid()));
CREATE POLICY "ft_insert" ON public.feedback_tickets FOR INSERT WITH CHECK (auth.uid() = author_id);

-- RLS: PEER EVALUATIONS
ALTER TABLE public.peer_evaluations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pe_own" ON public.peer_evaluations FOR ALL USING (auth.uid() = evaluator_id);
CREATE POLICY "pe_admin" ON public.peer_evaluations FOR SELECT USING (public.is_admin(auth.uid()));

-- STORAGE
INSERT INTO storage.buckets (id, name, public) VALUES ('public_assets', 'public_assets', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('resumes', 'resumes', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('deliverables', 'deliverables', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('governance_docs', 'governance_docs', false);

CREATE POLICY "pub_assets_read" ON storage.objects FOR SELECT USING (bucket_id = 'public_assets');
CREATE POLICY "pub_assets_write" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'public_assets' AND auth.uid() IS NOT NULL);
CREATE POLICY "resumes_admin" ON storage.objects FOR ALL USING (bucket_id = 'resumes' AND public.is_admin(auth.uid()));
CREATE POLICY "resumes_upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'resumes' AND auth.uid() IS NOT NULL);
CREATE POLICY "deliverables_read" ON storage.objects FOR SELECT USING (bucket_id = 'deliverables' AND auth.uid() IS NOT NULL);
CREATE POLICY "deliverables_write" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'deliverables' AND auth.uid() IS NOT NULL);
CREATE POLICY "gov_docs_read" ON storage.objects FOR SELECT USING (bucket_id = 'governance_docs' AND public.is_board_or_admin(auth.uid()));
CREATE POLICY "gov_docs_admin" ON storage.objects FOR ALL USING (bucket_id = 'governance_docs' AND public.is_admin(auth.uid()));
