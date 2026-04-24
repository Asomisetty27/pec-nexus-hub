
-- 1. Add 'cohort_meeting' and 'all_hands' to event_type enum
ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'cohort_meeting';
ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'all_hands';
ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'project_meeting';
