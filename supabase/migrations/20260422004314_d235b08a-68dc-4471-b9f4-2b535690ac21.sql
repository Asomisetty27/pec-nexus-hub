-- Add FK relationships to profiles(user_id) so PostgREST embedded selects resolve.
-- These coexist with existing FKs to auth.users (different constraint names).

ALTER TABLE public.messages
  ADD CONSTRAINT messages_author_profile_fkey
  FOREIGN KEY (author_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_assignee_profile_fkey
  FOREIGN KEY (assignee_id) REFERENCES public.profiles(user_id) ON DELETE SET NULL;

ALTER TABLE public.project_memberships
  ADD CONSTRAINT project_memberships_user_profile_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE public.channel_members
  ADD CONSTRAINT channel_members_user_profile_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE public.cohort_memberships
  ADD CONSTRAINT cohort_memberships_user_profile_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE public.mock_project_memberships
  ADD CONSTRAINT mock_project_memberships_user_profile_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE public.ops_tasks
  ADD CONSTRAINT ops_tasks_assignee_profile_fkey
  FOREIGN KEY (assignee_id) REFERENCES public.profiles(user_id) ON DELETE SET NULL;

ALTER TABLE public.help_requests
  ADD CONSTRAINT help_requests_requester_profile_fkey
  FOREIGN KEY (requester_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE public.deliverables
  ADD CONSTRAINT deliverables_owner_profile_fkey
  FOREIGN KEY (owner_id) REFERENCES public.profiles(user_id) ON DELETE SET NULL;

ALTER TABLE public.role_requests
  ADD CONSTRAINT role_requests_user_profile_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE public.availability_windows
  ADD CONSTRAINT availability_windows_user_profile_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;