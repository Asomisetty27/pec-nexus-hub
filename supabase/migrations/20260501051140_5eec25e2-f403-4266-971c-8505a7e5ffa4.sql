-- Phase 5 Migration F1: cadence event types
-- Additive enum values only. Must commit before F2 references them.
ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'leadership_meeting';
ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'training_session';