-- Lifecycle sim finding (2026-07-17): the deliverable_review_events event_type
-- CHECK omitted the three event types the review RPCs actually emit
-- (tech_validated, tech_unvalidated, pm_override_approved). Effect: the
-- mandatory two-step review (tech-validate then approve) and the PM override
-- both threw 23514 on their own audit-event insert, making the entire
-- gated-review path unusable. Found end-to-end because no deliverable had ever
-- been tech-validated on real data. Applied to staging 2026-07-17; prod apply
-- with this sim's fix batch.
alter table public.deliverable_review_events
  drop constraint if exists deliverable_review_events_event_type_check;
alter table public.deliverable_review_events
  add constraint deliverable_review_events_event_type_check
  check (event_type = any (array[
    'submitted','revised','approved','revision_requested','rejected','reopened',
    'tech_validated','tech_unvalidated','pm_override_approved'
  ]));
