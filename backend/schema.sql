-- ============================================================================
-- FMS (Flow Management System) — Full Database Schema
-- ----------------------------------------------------------------------------
-- This is the complete, dependency-safe schema for the FMS backend.
--
-- HOW TO USE:
--   1. Open the Supabase SQL Editor on a FRESH Supabase project.
--   2. Paste this entire file and run it once, top-to-bottom.
--   It is safe to run: all tables are created first (without inline foreign
--   keys), then every foreign key is added afterwards, so table-ordering can
--   never cause an error. CREATE statements use IF NOT EXISTS, so re-running
--   is non-destructive.
--
-- WHAT THIS CONTAINS:
--   - 27 tables in the `public` schema.
--   - One enum type (`platform_role`) used by `public.users`.
--   - All foreign keys (added via ALTER after every table exists).
--   - Defensive additive column migrations at the very end.
--
-- NOTE: This file intentionally contains NO GRANT / RLS / policy / owner
-- statements. Configure Row Level Security separately for your environment.
-- ============================================================================


-- ============================================================================
-- ENUM TYPES
-- ============================================================================

-- `public.users.platform_role` is a USER-DEFINED enum in production.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'platform_role') THEN
    CREATE TYPE public.platform_role AS ENUM ('superadmin', 'admin', 'controller', 'member');
  END IF;
END$$;


-- ============================================================================
-- TABLES
-- ----------------------------------------------------------------------------
-- All foreign-key constraints are intentionally omitted here and added in the
-- FOREIGN KEYS section below, so creation order is irrelevant.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ai_assistant_chats (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ai_assistant_chats_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.ai_generated_copies (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL,
  company_id uuid NOT NULL,
  prompt_context jsonb DEFAULT '{}'::jsonb,
  generated_content jsonb DEFAULT '{}'::jsonb,
  iteration_count integer DEFAULT 0,
  status text DEFAULT 'PENDING'::text CHECK (status = ANY (ARRAY['PENDING'::text, 'IN_REVIEW'::text, 'APPROVED'::text, 'REJECTED'::text])),
  is_template boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT ai_generated_copies_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.chat_channels (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  company_id uuid NOT NULL,
  type character varying NOT NULL CHECK (type::text = ANY (ARRAY['direct'::character varying, 'group'::character varying]::text[])),
  name character varying,
  project_id uuid,
  created_by uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT chat_channels_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  channel_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  parent_id uuid,
  content text NOT NULL,
  attachment_url text,
  attachment_type character varying,
  is_edited boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT chat_messages_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.chat_participants (
  channel_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role character varying DEFAULT 'member'::character varying CHECK (role::text = ANY (ARRAY['admin'::character varying, 'member'::character varying]::text[])),
  joined_at timestamp with time zone DEFAULT now(),
  last_read_at timestamp with time zone DEFAULT now(),
  CONSTRAINT chat_participants_pkey PRIMARY KEY (channel_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.clients (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  name text NOT NULL,
  email text,
  phone text,
  address text,
  website text,
  company_name text,
  location text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  status text,
  CONSTRAINT clients_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.companies (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  email text,
  phone text,
  address text,
  website text,
  description text,
  working_days jsonb DEFAULT '["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]'::jsonb,
  work_start_time time without time zone DEFAULT '09:00:00'::time without time zone,
  work_end_time time without time zone DEFAULT '18:00:00'::time without time zone,
  admin_id uuid,
  industry text,
  team_size text,
  purpose text,
  tier text DEFAULT 'starter'::text,
  subscription_start_date timestamp with time zone DEFAULT now(),
  subscription_end_date timestamp with time zone,
  CONSTRAINT companies_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.company_holidays (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  holiday_date date NOT NULL,
  name text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  description text,
  type text DEFAULT 'One-time'::text,
  CONSTRAINT company_holidays_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.controller_permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_id uuid,
  module text NOT NULL,
  can_read boolean NOT NULL DEFAULT true,
  can_write boolean NOT NULL DEFAULT false,
  can_delete boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT controller_permissions_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.instances (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  client_id uuid,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'ONGOING'::text CHECK (status = ANY (ARRAY['ONGOING'::text, 'COMPLETED'::text, 'CANCELLED'::text, 'SCHEDULED'::text, 'PAUSED'::text])),
  scheduled_at date,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  is_scheduled boolean NOT NULL DEFAULT false,
  company_id uuid NOT NULL,
  is_paused boolean,
  pause_reason text,
  paused_date date,
  CONSTRAINT instances_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  message text,
  task_id uuid,
  instance_id uuid,
  is_read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  sent_by uuid,
  company_id uuid,
  CONSTRAINT notifications_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.onboarding_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  company_email text NOT NULL,
  company_phone text NOT NULL,
  company_website text,
  company_address text,
  contact_name text NOT NULL,
  contact_designation text NOT NULL,
  contact_email text NOT NULL UNIQUE,
  contact_phone text NOT NULL,
  purpose text NOT NULL,
  team_size text NOT NULL,
  industry text,
  description text,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])),
  rejection_reason text,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT onboarding_requests_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.password_resets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  email text NOT NULL,
  otp text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT password_resets_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.projects (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid,
  name character varying NOT NULL,
  description text,
  client_id uuid,
  status character varying NOT NULL DEFAULT 'active'::character varying CHECK (status::text = ANY (ARRAY['active'::character varying::text, 'done'::character varying::text, 'cancelled'::character varying::text])),
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  type text,
  category text,
  CONSTRAINT projects_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.task_approval_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL,
  level_number integer NOT NULL,
  actor_id uuid,
  action text NOT NULL CHECK (action = ANY (ARRAY['APPROVED'::text, 'REJECTED'::text])),
  comment text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  company_id uuid,
  CONSTRAINT task_approval_history_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.task_approval_levels (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL,
  level_number integer NOT NULL,
  approver_id uuid,
  status text NOT NULL DEFAULT 'PENDING'::text CHECK (status = ANY (ARRAY['PENDING'::text, 'APPROVED'::text, 'REJECTED'::text])),
  comment text,
  acted_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  company_id uuid,
  CONSTRAINT task_approval_levels_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.task_bypass_logs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  task_id uuid NOT NULL,
  action text NOT NULL,
  from_step integer NOT NULL,
  to_step integer NOT NULL,
  from_user_id uuid NOT NULL,
  performed_by uuid NOT NULL,
  reason text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  company_id uuid,
  CONSTRAINT task_bypass_logs_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.task_checklist_progress (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL,
  item_text text NOT NULL,
  is_checked boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  company_id uuid,
  requires_input boolean NOT NULL DEFAULT false,
  input_label text,
  input_placeholder text,
  input_value text,
  status text,
  reviewer_comments jsonb DEFAULT '[]'::jsonb,
  CONSTRAINT task_checklist_progress_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.task_performance_logs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  task_id uuid UNIQUE,
  user_id uuid,
  company_id uuid,
  project_name text,
  instance_name text,
  task_title text,
  assigned_at timestamp with time zone,
  submitted_at timestamp with time zone,
  approved_at timestamp with time zone,
  estimated_minutes integer,
  actual_working_minutes integer,
  status text,
  approver_comments text,
  deliverable_links text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT task_performance_logs_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.task_reassignments (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  task_id uuid NOT NULL,
  from_user_id uuid NOT NULL,
  to_user_id uuid NOT NULL,
  reassigned_by uuid NOT NULL,
  reason text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  company_id uuid,
  CONSTRAINT task_reassignments_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.task_sla_extensions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  task_id uuid,
  old_deadline timestamp with time zone,
  new_deadline timestamp with time zone,
  reason text,
  requested_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  company_id uuid,
  CONSTRAINT task_sla_extensions_pkey PRIMARY KEY (id)
);

-- Additional table (from schema_sla_extension_requests.sql). Distinct from
-- task_sla_extensions above: this models the request/review workflow.
CREATE TABLE IF NOT EXISTS public.task_sla_extension_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL,
  requested_by uuid NOT NULL,
  requested_at timestamp with time zone NOT NULL DEFAULT now(),
  reason text NOT NULL,
  suggested_new_deadline timestamp with time zone,
  status text NOT NULL DEFAULT 'PENDING'::text CHECK (status = ANY (ARRAY['PENDING'::text, 'APPROVED'::text, 'REJECTED'::text])),
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  reviewer_comment text,
  final_new_deadline timestamp with time zone,
  company_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT task_sla_extension_requests_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id uuid,
  title text NOT NULL,
  description text,
  due_date timestamp with time zone,
  status text NOT NULL DEFAULT 'LOCKED'::text CHECK (status = ANY (ARRAY['LOCKED'::text, 'IN_PROGRESS'::text, 'PENDING_APPROVAL'::text, 'APPROVED'::text, 'COMPLETED'::text, 'REJECTED'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  instance_id uuid,
  approval_required boolean NOT NULL DEFAULT false,
  task_order integer NOT NULL DEFAULT 1,
  assigned_role text DEFAULT 'copywriter'::text,
  assigned_user_id uuid,
  approval_levels integer NOT NULL DEFAULT 1,
  current_level integer NOT NULL DEFAULT 1,
  last_rejection_comment text,
  last_rejected_by uuid,
  last_rejected_at timestamp with time zone,
  links text,
  assigned_at timestamp with time zone,
  submitted_at timestamp with time zone,
  approved_at timestamp with time zone,
  original_due_date timestamp with time zone,
  grace_period_minutes integer DEFAULT 0,
  total_working_minutes integer DEFAULT 0,
  estimated_minutes integer,
  turnaround_minutes integer,
  is_manual boolean DEFAULT false,
  priority text DEFAULT 'medium'::text CHECK (priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text])),
  company_id uuid,
  comments jsonb DEFAULT '[]'::jsonb,
  CONSTRAINT tasks_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.template_task_checklist_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  template_task_id uuid NOT NULL,
  item_text text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  company_id uuid,
  requires_input boolean NOT NULL DEFAULT false,
  input_label text,
  input_placeholder text,
  CONSTRAINT template_task_checklist_items_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.template_tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  step_order integer NOT NULL DEFAULT 1,
  estimated_minutes integer DEFAULT 0,
  approval_required boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  assigned_role text DEFAULT 'copywriter'::text,
  approval_levels integer NOT NULL DEFAULT 1,
  turnaround_minutes integer DEFAULT 0,
  company_id uuid,
  CONSTRAINT template_tasks_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.users (
  id uuid NOT NULL,
  company_id uuid NOT NULL,
  name text NOT NULL,
  platform_role public.platform_role NOT NULL DEFAULT 'member'::public.platform_role,
  workflow_role text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  email text,
  is_active boolean,
  password_changed_by_admin boolean DEFAULT false,
  force_password_reset boolean DEFAULT false,
  CONSTRAINT users_pkey PRIMARY KEY (id)
);

-- Additional table (from migrations/project_action_logs.sql). Audit trail of
-- controller actions performed at project level.
CREATE TABLE IF NOT EXISTS public.project_action_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  action_type character varying(100) NOT NULL,
  performed_by uuid NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  company_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT project_action_logs_pkey PRIMARY KEY (id)
);


-- ============================================================================
-- FOREIGN KEYS
-- ----------------------------------------------------------------------------
-- Added after all tables exist so creation order cannot cause errors.
-- ============================================================================

ALTER TABLE public.ai_assistant_chats ADD CONSTRAINT ai_assistant_chats_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);

ALTER TABLE public.ai_generated_copies ADD CONSTRAINT ai_generated_copies_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id);
ALTER TABLE public.ai_generated_copies ADD CONSTRAINT ai_generated_copies_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);

ALTER TABLE public.chat_channels ADD CONSTRAINT chat_channels_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);
ALTER TABLE public.chat_channels ADD CONSTRAINT chat_channels_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);
ALTER TABLE public.chat_channels ADD CONSTRAINT chat_channels_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

ALTER TABLE public.chat_messages ADD CONSTRAINT chat_messages_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.chat_channels(id);
ALTER TABLE public.chat_messages ADD CONSTRAINT chat_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id);
ALTER TABLE public.chat_messages ADD CONSTRAINT chat_messages_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.chat_messages(id);

ALTER TABLE public.chat_participants ADD CONSTRAINT chat_participants_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.chat_channels(id);
ALTER TABLE public.chat_participants ADD CONSTRAINT chat_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);

ALTER TABLE public.clients ADD CONSTRAINT fk_company FOREIGN KEY (company_id) REFERENCES public.companies(id);

ALTER TABLE public.companies ADD CONSTRAINT companies_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.users(id);

ALTER TABLE public.company_holidays ADD CONSTRAINT company_holidays_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);

ALTER TABLE public.controller_permissions ADD CONSTRAINT controller_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);
ALTER TABLE public.controller_permissions ADD CONSTRAINT controller_permissions_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);

ALTER TABLE public.instances ADD CONSTRAINT instances_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id);
ALTER TABLE public.instances ADD CONSTRAINT instances_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);
ALTER TABLE public.instances ADD CONSTRAINT instances_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);
ALTER TABLE public.instances ADD CONSTRAINT instances_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);

ALTER TABLE public.notifications ADD CONSTRAINT notifications_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id);
ALTER TABLE public.notifications ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);
ALTER TABLE public.notifications ADD CONSTRAINT notifications_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);
ALTER TABLE public.notifications ADD CONSTRAINT notifications_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES public.instances(id);
ALTER TABLE public.notifications ADD CONSTRAINT notifications_sent_by_fkey FOREIGN KEY (sent_by) REFERENCES public.users(id);

ALTER TABLE public.password_resets ADD CONSTRAINT password_resets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);

ALTER TABLE public.projects ADD CONSTRAINT projects_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id);
ALTER TABLE public.projects ADD CONSTRAINT projects_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);

ALTER TABLE public.task_approval_history ADD CONSTRAINT task_approval_history_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id);
ALTER TABLE public.task_approval_history ADD CONSTRAINT task_approval_history_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);
ALTER TABLE public.task_approval_history ADD CONSTRAINT task_approval_history_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id);

ALTER TABLE public.task_approval_levels ADD CONSTRAINT task_approval_levels_approver_id_fkey FOREIGN KEY (approver_id) REFERENCES public.users(id);
ALTER TABLE public.task_approval_levels ADD CONSTRAINT task_approval_levels_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);
ALTER TABLE public.task_approval_levels ADD CONSTRAINT task_approval_levels_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id);

ALTER TABLE public.task_bypass_logs ADD CONSTRAINT task_bypass_logs_from_user_id_fkey FOREIGN KEY (from_user_id) REFERENCES public.users(id);
ALTER TABLE public.task_bypass_logs ADD CONSTRAINT task_bypass_logs_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES public.users(id);
ALTER TABLE public.task_bypass_logs ADD CONSTRAINT task_bypass_logs_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id);
ALTER TABLE public.task_bypass_logs ADD CONSTRAINT task_bypass_logs_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);

ALTER TABLE public.task_checklist_progress ADD CONSTRAINT task_checklist_progress_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);
ALTER TABLE public.task_checklist_progress ADD CONSTRAINT task_checklist_progress_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id);

ALTER TABLE public.task_performance_logs ADD CONSTRAINT task_performance_logs_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);
ALTER TABLE public.task_performance_logs ADD CONSTRAINT task_performance_logs_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id);
ALTER TABLE public.task_performance_logs ADD CONSTRAINT task_performance_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);

ALTER TABLE public.task_reassignments ADD CONSTRAINT task_reassignments_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);
ALTER TABLE public.task_reassignments ADD CONSTRAINT task_reassignments_from_user_id_fkey FOREIGN KEY (from_user_id) REFERENCES public.users(id);
ALTER TABLE public.task_reassignments ADD CONSTRAINT task_reassignments_reassigned_by_fkey FOREIGN KEY (reassigned_by) REFERENCES public.users(id);
ALTER TABLE public.task_reassignments ADD CONSTRAINT task_reassignments_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id);
ALTER TABLE public.task_reassignments ADD CONSTRAINT task_reassignments_to_user_id_fkey FOREIGN KEY (to_user_id) REFERENCES public.users(id);

ALTER TABLE public.task_sla_extensions ADD CONSTRAINT task_sla_extensions_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);
ALTER TABLE public.task_sla_extensions ADD CONSTRAINT task_sla_extensions_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users(id);
ALTER TABLE public.task_sla_extensions ADD CONSTRAINT task_sla_extensions_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id);

ALTER TABLE public.task_sla_extension_requests ADD CONSTRAINT task_sla_extension_requests_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;
ALTER TABLE public.task_sla_extension_requests ADD CONSTRAINT task_sla_extension_requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.task_sla_extension_requests ADD CONSTRAINT task_sla_extension_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.task_sla_extension_requests ADD CONSTRAINT task_sla_extension_requests_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

ALTER TABLE public.tasks ADD CONSTRAINT tasks_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);
ALTER TABLE public.tasks ADD CONSTRAINT tasks_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);
ALTER TABLE public.tasks ADD CONSTRAINT tasks_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES public.instances(id);
ALTER TABLE public.tasks ADD CONSTRAINT tasks_last_rejected_by_fkey FOREIGN KEY (last_rejected_by) REFERENCES public.users(id);
ALTER TABLE public.tasks ADD CONSTRAINT tasks_assigned_user_id_fkey FOREIGN KEY (assigned_user_id) REFERENCES public.users(id);

ALTER TABLE public.template_task_checklist_items ADD CONSTRAINT template_task_checklist_items_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);
ALTER TABLE public.template_task_checklist_items ADD CONSTRAINT template_task_checklist_items_template_task_id_fkey FOREIGN KEY (template_task_id) REFERENCES public.template_tasks(id);

ALTER TABLE public.template_tasks ADD CONSTRAINT template_tasks_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);
ALTER TABLE public.template_tasks ADD CONSTRAINT template_tasks_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);

-- `public.users.id` references Supabase's built-in auth.users table.
ALTER TABLE public.users ADD CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id);

ALTER TABLE public.project_action_logs ADD CONSTRAINT project_action_logs_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;
ALTER TABLE public.project_action_logs ADD CONSTRAINT project_action_logs_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.project_action_logs ADD CONSTRAINT project_action_logs_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


-- ============================================================================
-- ADDITIVE COLUMN MIGRATIONS
-- ----------------------------------------------------------------------------
-- Defensive ALTER ... ADD COLUMN IF NOT EXISTS statements from later
-- migrations. Safe to run even if the columns already exist.
-- ============================================================================

-- From migrations/add_approver_turnaround_minutes.sql
ALTER TABLE public.template_tasks
  ADD COLUMN IF NOT EXISTS approver_turnaround_minutes integer DEFAULT 240;

-- From migrations/add_sla_tracking_columns.sql
ALTER TABLE public.template_tasks
  ADD COLUMN IF NOT EXISTS worker_time_percentage integer DEFAULT 70;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS worker_time_percentage integer DEFAULT 70,
  ADD COLUMN IF NOT EXISTS worker_allocated_minutes integer,
  ADD COLUMN IF NOT EXISTS worker_used_minutes integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overall_due_date timestamp with time zone;

ALTER TABLE public.task_approval_levels
  ADD COLUMN IF NOT EXISTS allocated_minutes integer,
  ADD COLUMN IF NOT EXISTS used_minutes integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS due_date timestamp with time zone;

-- Heartbeat, Push Notifications, Notification Settings, and Client Approvals migrations
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_online boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS login_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS push_notifications_enabled boolean DEFAULT false;

ALTER TABLE public.instances
  ADD COLUMN IF NOT EXISTS pending_client_approval boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS client_approval_task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT push_subscriptions_pkey PRIMARY KEY (user_id, endpoint)
);

CREATE TABLE IF NOT EXISTS public.company_notification_settings (
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  task_assigned boolean NOT NULL DEFAULT true,
  task_submitted boolean NOT NULL DEFAULT true,
  task_approved boolean NOT NULL DEFAULT false,
  task_rejected boolean NOT NULL DEFAULT true,
  task_completed boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT company_notification_settings_pkey PRIMARY KEY (company_id)
);

CREATE TABLE IF NOT EXISTS public.client_approvals (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'PENDING'::text CHECK (status = ANY (ARRAY['PENDING'::text, 'APPROVED'::text, 'REJECTED'::text])),
  client_comment text,
  decision_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  decision_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT client_approvals_pkey PRIMARY KEY (id)
);

