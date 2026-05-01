-- Migration G1: Recruitment pipeline enums (additive only)
-- Split from G2 because Postgres requires enum values to be committed before being referenced.

DO $$ BEGIN
  CREATE TYPE public.application_cycle_season AS ENUM ('fall', 'spring');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.applicant_stage AS ENUM (
    'applied',
    'under_review',
    'resume_screen',
    'interview',
    'decision_pending',
    'accepted',
    'rejected',
    'waitlisted',
    'withdrawn'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.applicant_decision AS ENUM (
    'advance',
    'hold',
    'reject',
    'accept',
    'waitlist',
    'request_more_info'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.applicant_source AS ENUM (
    'website',
    'flyer',
    'referral',
    'event',
    'info_session',
    'social_media',
    'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;