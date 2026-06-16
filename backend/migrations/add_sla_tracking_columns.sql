-- Migration: Add SLA Tracking Columns for Dynamic Splitting

-- 1. Add 'worker_time_percentage' to template_tasks
ALTER TABLE public.template_tasks 
ADD COLUMN IF NOT EXISTS worker_time_percentage integer DEFAULT 70;

-- 2. Add SLA tracking columns to tasks
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS worker_time_percentage integer DEFAULT 70,
ADD COLUMN IF NOT EXISTS worker_allocated_minutes integer,
ADD COLUMN IF NOT EXISTS worker_used_minutes integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS overall_due_date timestamp with time zone;

-- 3. Add SLA tracking columns to task_approval_levels
ALTER TABLE public.task_approval_levels 
ADD COLUMN IF NOT EXISTS allocated_minutes integer,
ADD COLUMN IF NOT EXISTS used_minutes integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS due_date timestamp with time zone;
