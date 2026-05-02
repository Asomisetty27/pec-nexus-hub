-- Phase B1: extend applicant_stage enum with pre_cycle_pool.
-- Must be committed BEFORE any code/migration references this value.
ALTER TYPE public.applicant_stage ADD VALUE IF NOT EXISTS 'pre_cycle_pool' BEFORE 'applied';