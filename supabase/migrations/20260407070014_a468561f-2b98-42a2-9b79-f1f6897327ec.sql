-- Add new values to message_type enum
ALTER TYPE public.message_type ADD VALUE IF NOT EXISTS 'review_request';
ALTER TYPE public.message_type ADD VALUE IF NOT EXISTS 'help_request';
ALTER TYPE public.message_type ADD VALUE IF NOT EXISTS 'announcement';
ALTER TYPE public.message_type ADD VALUE IF NOT EXISTS 'fyi';