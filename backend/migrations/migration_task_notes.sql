-- Migration: Add notes field to tasks table
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS notes text;
