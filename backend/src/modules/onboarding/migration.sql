-- ============================================================
-- FMS Self-Onboarding: Database Migration Script
-- Run this in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 1. ADD NEW COLUMNS TO companies TABLE
-- ============================================================
-- admin_id: references the primary admin user for this company
-- industry, team_size, purpose: populated from onboarding request on approval

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS admin_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS industry text NULL,
  ADD COLUMN IF NOT EXISTS team_size text NULL,
  ADD COLUMN IF NOT EXISTS purpose text NULL;

-- ============================================================
-- 2. CREATE onboarding_requests TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.onboarding_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),

  -- Step 1: Company Information
  company_name text NOT NULL,
  company_email text NOT NULL,
  company_phone text NOT NULL,
  company_website text NULL,
  company_address text NULL,

  -- Step 2: Contact Person (future Admin)
  contact_name text NOT NULL,
  contact_designation text NOT NULL,
  contact_email text NOT NULL,
  contact_phone text NOT NULL,

  -- Step 3: Team & Purpose
  purpose text NOT NULL,
  team_size text NOT NULL,
  industry text NULL,
  description text NULL,

  -- Status tracking
  status text NOT NULL DEFAULT 'pending',        -- pending | approved | rejected
  rejection_reason text NULL,
  reviewed_at timestamp with time zone NULL,

  -- Timestamps
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT onboarding_requests_pkey PRIMARY KEY (id),
  CONSTRAINT onboarding_requests_contact_email_key UNIQUE (contact_email),
  CONSTRAINT onboarding_requests_status_check CHECK (status IN ('pending', 'approved', 'rejected'))
) TABLESPACE pg_default;

-- Index for quick status filtering
CREATE INDEX IF NOT EXISTS idx_onboarding_requests_status ON public.onboarding_requests (status);
