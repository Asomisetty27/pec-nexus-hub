
-- Allow system-seeded channels with no creator
ALTER TABLE public.channels ALTER COLUMN created_by DROP NOT NULL;
