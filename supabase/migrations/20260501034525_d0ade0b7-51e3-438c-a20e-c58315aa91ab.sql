-- Migration A: CRM enums only. Must commit before Migration B.

-- Extend existing app_role enum with functional leadership roles
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'president';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'director_of_projects';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'outreach_lead';

-- CRM lifecycle status
DO $$ BEGIN
  CREATE TYPE public.crm_status AS ENUM (
    'not_started','researching','queued_for_outreach','contacted',
    'in_conversation','meeting_scheduled','proposal_sent',
    'won','lost','dormant','do_not_contact'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Warmth
DO $$ BEGIN
  CREATE TYPE public.crm_warmth AS ENUM ('cold','warm','hot');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tier priority (replaces any prior smallint usage)
DO $$ BEGIN
  CREATE TYPE public.crm_tier_priority AS ENUM ('tier_1','tier_2','tier_3');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Activity types
DO $$ BEGIN
  CREATE TYPE public.crm_activity_type AS ENUM (
    'email_sent','follow_up_sent','linkedin_message','phone_call','meeting',
    'research_note','internal_note','status_change','task_completed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Task status
DO $$ BEGIN
  CREATE TYPE public.crm_task_status AS ENUM ('open','in_progress','done','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Conversion types (strictly organizational; no internship)
DO $$ BEGIN
  CREATE TYPE public.crm_conversion_type AS ENUM (
    'project_inquiry','sponsor_interest','speaker_interest',
    'judge_interest','recruiting_relationship','not_a_fit'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;