-- Project lifecycle sim (2026-07-20): the deliverable_review_events event_type
-- CHECK still omitted four types the review RPCs actually emit --
-- 'started' (mark-started), 'staged' (set-stage), and 'archived'/'unarchived'
-- (archive/unarchive deliverable). Each threw 23514 and rolled the RPC back, so
-- a member could not start a deliverable and a lead could not stage or archive
-- one. Complete the allow-list. (Extends 20260717050000, which fixed the first
-- three review types but missed these four.)
alter table public.deliverable_review_events
  drop constraint if exists deliverable_review_events_event_type_check;
alter table public.deliverable_review_events
  add constraint deliverable_review_events_event_type_check
  check (event_type = any (array[
    'submitted','revised','approved','revision_requested','rejected','reopened',
    'tech_validated','tech_unvalidated','pm_override_approved',
    'started','archived','unarchived','staged'
  ]));
