-- ============================================================
-- FMS — Flow Management System
-- Schema Migration: Modular Controller Permissions
-- ============================================================

-- 1. Create permissions table
CREATE TABLE IF NOT EXISTS public.controller_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    
    -- Module Name (e.g., 'clients', 'projects', 'tasks', 'templates')
    module TEXT NOT NULL,
    
    -- Capabilities
    can_read BOOLEAN NOT NULL DEFAULT true,
    can_write BOOLEAN NOT NULL DEFAULT false,
    can_delete BOOLEAN NOT NULL DEFAULT false,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Ensure one configuration per module per user
    UNIQUE (user_id, module)
);

-- 2. Enable RLS
ALTER TABLE public.controller_permissions ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
-- Allow service role full access (Backend)
CREATE POLICY "Allow service role full access on controller_permissions"
    ON public.controller_permissions FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Allow authenticated users to view their own permissions
CREATE POLICY "Users can view their own permissions"
    ON public.controller_permissions FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_cp_user_id ON public.controller_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_cp_company_id ON public.controller_permissions(company_id);
CREATE INDEX IF NOT EXISTS idx_cp_module ON public.controller_permissions(module);

-- 5. Auto-update updated_at
CREATE TRIGGER set_updated_at_permissions
    BEFORE UPDATE ON public.controller_permissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 6. Initial Modules Setup (Optional reference for later)
-- Typical modules: 'dashboard', 'clients', 'projects', 'tasks', 'templates', 'reports'
