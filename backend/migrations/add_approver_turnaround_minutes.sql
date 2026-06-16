-- Migration: Add Approver Turnaround Minutes for Template Tasks
ALTER TABLE public.template_tasks 
ADD COLUMN IF NOT EXISTS approver_turnaround_minutes integer DEFAULT 240;

-- Optionally, drop the worker_time_percentage if no longer needed
-- ALTER TABLE public.template_tasks DROP COLUMN IF NOT EXISTS worker_time_percentage;
-- ALTER TABLE public.tasks DROP COLUMN IF NOT EXISTS worker_time_percentage;
