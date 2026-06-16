-- =====================================================
-- Project Action Logs Table
-- =====================================================
-- This table stores comprehensive logs of all controller
-- actions performed at the project level for audit trail
-- and historical reference.
-- =====================================================

CREATE TABLE IF NOT EXISTS project_action_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    action_type VARCHAR(100) NOT NULL,
    -- Action types: 
    -- 'TASK_REASSIGNMENT', 'BULK_TASK_REASSIGNMENT',
    -- 'APPROVAL_LEVEL_CHANGE', 'BULK_APPROVAL_LEVEL_CHANGE',
    -- 'TASK_BYPASS', 'TASK_UNLOCK', 'SLA_EXTENSION',
    -- 'INSTANCE_PAUSE', 'INSTANCE_RESUME', 'INSTANCE_ABORT',
    -- 'CLIENT_REVISION_REOPEN', etc.
    
    performed_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    details JSONB NOT NULL DEFAULT '{}',
    -- JSONB structure can contain:
    -- {
    --   "primary_task_id": "uuid",
    --   "primary_task_title": "string",
    --   "from_user_id": "uuid",
    --   "to_user_id": "uuid",
    --   "reason": "string",
    --   "apply_to_all": boolean,
    --   "tasks_affected": [
    --     {
    --       "task_id": "uuid",
    --       "task_title": "string",
    --       "from_user_id": "uuid",
    --       "to_user_id": "uuid",
    --       "status": "string"
    --     }
    --   ],
    --   "total_tasks_updated": number,
    --   ... (flexible for different action types)
    -- }
    
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Indexes for performance
    CONSTRAINT project_action_logs_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    CONSTRAINT project_action_logs_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT project_action_logs_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_project_action_logs_project_id ON project_action_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_project_action_logs_performed_by ON project_action_logs(performed_by);
CREATE INDEX IF NOT EXISTS idx_project_action_logs_company_id ON project_action_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_project_action_logs_action_type ON project_action_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_project_action_logs_created_at ON project_action_logs(created_at DESC);

-- Create a composite index for common queries
CREATE INDEX IF NOT EXISTS idx_project_action_logs_project_company ON project_action_logs(project_id, company_id, created_at DESC);

-- Add RLS policies
ALTER TABLE project_action_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view logs from their own company
CREATE POLICY project_action_logs_select_policy ON project_action_logs
    FOR SELECT
    USING (company_id = (SELECT company_id FROM users WHERE id = auth.uid()));

-- Policy: Only controllers and admins can insert logs
CREATE POLICY project_action_logs_insert_policy ON project_action_logs
    FOR INSERT
    WITH CHECK (
        company_id = (SELECT company_id FROM users WHERE id = auth.uid())
        AND
        (SELECT platform_role FROM users WHERE id = auth.uid()) IN ('admin', 'controller')
    );

-- Add comment to table
COMMENT ON TABLE project_action_logs IS 'Comprehensive audit trail of all controller actions performed at project level across instances';
COMMENT ON COLUMN project_action_logs.action_type IS 'Type of action performed (e.g., BULK_TASK_REASSIGNMENT, APPROVAL_LEVEL_CHANGE)';
COMMENT ON COLUMN project_action_logs.details IS 'JSONB field containing flexible action-specific details including affected tasks, reasons, and metadata';
COMMENT ON COLUMN project_action_logs.performed_by IS 'User ID of the controller/admin who performed the action';
