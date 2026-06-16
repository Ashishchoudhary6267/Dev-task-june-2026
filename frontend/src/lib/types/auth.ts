export interface User {
    id: string;
    name: string;
    company_id: string;
    platform_role: string;
    workflow_role: string;
    email?: string;
    login_count: number;
    permissions?: any[];
}

export interface Session {
    access_token: string;
    refresh_token: string;
    expires_at?: number;
}

export interface AuthResponse {
    user: User;
    session: Session;
}

export interface Company {
    id: string | " ";
    name: string | "";
    email: string | " ";
    phone: string | "";
    address: string | "";
    website: string | "";
    description: string | "";
    tier?: string;
    subscription_start_date?: string;
    subscription_end_date?: string;
    created_at: string;
}

export interface CompanyInfo {
    id: string | " ";
    name: string | "";
    email: string | " ";
    phone: string | "";
    address: string | "";
    website: string | "";
    description: string | "";
    team_size: string | "";
    industry: string | "";
    purpose: string | "";
    tier?: string;
    subscription_start_date?: string;
    subscription_end_date?: string;
    // updated_at?: string;
}

export interface Project {
    id: string;
    name: string;
    client_name: string;
    description: string;
    company_id: string;
    status: string;
    category: string;
    start_date: string;
    end_date: string;
    type: string;
}


export interface NavItem {
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
    href?: string;
}

export interface NavGroup {
    label: string;
    items: NavItem[];
}

export interface TaskRow {
    title: string;
    description: string;
    due_date: string;
}


export interface Client {
    id: string;
    name: string;
    email: string;
    phone: string;
    address: string;
    website: string;
    company_name: string;
    location: string;
    company_id: string;
    isActive: boolean;
    status: string;
    type?: 'CLIENT' | 'SERVICE';
}


export interface ApprovalLevel {
    id: string;
    level_number: number;
    approver_id: string;
    approver?: { id: string; name: string; email: string };
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    comment?: string;
    acted_at?: string;
    due_date?: string;
}

export interface ApprovalHistoryEntry {
    id: string;
    task_id: string;
    level_number: number;
    actor_id?: string;
    actor?: { id: string; name: string; email: string };
    action: 'APPROVED' | 'REJECTED';
    comment?: string;
    created_at: string;
}


export interface LiveTask {
    bottleneck: any;
    rejection_count: any;
    id: string;
    task_order: number;
    title: string;
    description?: string;
    assigned_role?: string;
    assigned_user_id?: string;
    assigned_user?: { id: string; name: string; email: string };
    approval_required: boolean;
    approval_levels: number;
    current_level: number;
    status: 'LOCKED' | 'IN_PROGRESS' | 'PENDING_APPROVAL' | 'COMPLETED' | 'REJECTED';
    due_date?: string;
    submitted_at?: string | null;
    assigned_at?: string | null;
    original_due_date?: string | null;
    estimated_minutes?: number;
    total_working_minutes?: number;
    turnaround_minutes?: number;
    task_approval_levels?: ApprovalLevel[];
    task_checklist_progress?: { id: string; item_text: string; is_checked: boolean; requires_input?: boolean; input_label?: string; input_placeholder?: string; input_value?: string; status?: string | null; reviewer_comments?: any[] }[];
    task_approval_history?: ApprovalHistoryEntry[];
    task_bypass_logs?: any[];
    task_reassignments?: any[];
    task_sla_extensions?: any[];
    comments?: TaskComment[];
}

export interface TaskComment {
    id: string;
    text: string;
    author_id: string;
    author_name: string;
    author_role: string;
    created_at: string;
}


export interface TaskDraft {
    id?: string;         // existing task id (for updates)
    title: string;
    description: string;
    step_order: number;
    estimated_minutes: number;
    turnaround_minutes: number;
    worker_time_percentage?: number;
    approver_turnaround_minutes?: number;
    turnaround_unit?: 'Minutes' | 'Hours' | 'Days';
    approval_required: boolean;
    approval_levels: number;
    assigned_role: string;
    checklist: boolean;
    checklist_items: ChecklistItemDraft[];
    isNew?: boolean;
}

export interface ChecklistItemDraft {
    item_text: string;
    requires_input: boolean;
    input_label: string;
    input_placeholder: string;
}


export interface ChecklistItem {
    id: string;
    task_id: string;
    item_text: string;
    is_checked: boolean;
    sort_order: number;
    requires_input?: boolean;
    input_label?: string;
    input_placeholder?: string;
    input_value?: string;
    status?: string | null;
    reviewer_comments?: any[];
}

export interface ApprovalLevel {
    id: string;
    task_id: string;
    level_number: number;
    approver_id: string;
    approver?: { id: string; name: string; email: string };
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    comment?: string;
    acted_at?: string;
}

export interface Client {
    id: string;
    name: string;
    email: string;
    phone: string;
    address: string;
    website: string;
    company_name: string;
    location: string;
    company_id: string;
    isActive: boolean;
    type?: 'CLIENT' | 'SERVICE';
}

export interface Task {
    days_overdue: null;
    is_manual: any;
    id: string;
    project_id: string;
    instance_id?: string;
    task_order: number;
    title: string;
    description?: string;
    assigned_role?: string;
    assigned_user_id?: string;
    approval_required: boolean;
    approval_levels: number;
    current_level: number;
    links?: string;
    status: 'LOCKED' | 'IN_PROGRESS' | 'PENDING_APPROVAL' | 'APPROVED' | 'COMPLETED' | 'REJECTED';
    due_date?: string | null;
    created_at?: string;
    project?: { id: string; name: string; client?: Client };
    instance?: { id: string; name: string; status?: string; client?: Client };
    assigned_user?: { id: string; name: string; email: string };
    task_approval_levels?: ApprovalLevel[];
    task_checklist_progress?: ChecklistItem[];
    last_rejection_comment?: string | null;
    last_rejected_by?: string | null;
    last_rejected_at?: string | null;
    last_rejector?: { id: string; name: string; email: string } | null;
    submitted_at?: string | null;
    assigned_at?: string | null;
    original_due_date?: string | null;
    estimated_minutes?: number;
    turnaround_minutes?: number;
    approver_turnaround_minutes?: number;
    total_working_minutes?: number;
    rejection_count?: number;
    comments?: TaskComment[];

    due_category?: 'OVERDUE' | 'DUE_TODAY' | 'DUE_TOMORROW' | 'ACTIVE';
}

export interface ManualTask {
    id: string;
    title: string;
    description?: string;
    project_id?: string;
    assigned_user_id: string;
    assigned_user?: { id: string; name: string; email: string };
    priority: 'low' | 'medium' | 'high';
    status: 'IN_PROGRESS' | 'PENDING_APPROVAL' | 'COMPLETED';
    estimated_minutes: number;
    turnaround_minutes?: number;
    due_date?: string | null;
    approval_required: boolean;
    approval_levels?: number;
    current_level?: number;
    task_approval_levels?: { id: string; level_number: number; approver_id: string; status: string; approver?: { id: string; name: string; email: string } }[];
    company_id?: string;
    created_by?: string;
    created_at?: string;
    is_manual: true;
}

export interface TaskRow {
    title: string;
    description: string;
    due_date: string;
}


export interface Thresholds {
    onTimePercent: number;
    taskEfficiencyPercent: number;
    overdueCount: number;
    showBadges: boolean;
}


export interface MemberPerformanceSummary {
    id: string;
    name: string;
    role: string;
    totalTasks: number;
    completed: number;
    inProgress: number;
    pending: number;
    late: number;
    overdue: number;
    onTimeDelivery: number;   // 0–100 %
    taskEfficiency: number;   // 0 to -100 % (negative metric)
    qualityScore: number | null; // null if no completed tasks yet
}


export interface MemberTask {
    id: string;
    taskName: string;
    instance: string;
    client: string;
    status: 'completed' | 'in_progress' | 'pending' | 'overdue';
    assigned: string;
    dueDate: string;
    completedDate: string | null;
    overdueDays: number | null;
    onTime: boolean | null;
}


export interface Holiday {
    id: string;
    company_id: string;
    holiday_date: string;
    name: string;
    description: string;
    type: string;
}



export interface ChecklistItem {
    id: string;
    template_task_id: string;
    item_text: string;
    sort_order: number;
}

export interface TemplateTask {
    id: string;
    project_id: string;
    title: string;
    description?: string;
    step_order: number;
    assigned_role: string;
    estimated_minutes: number;
    turnaround_minutes: number;
    approver_turnaround_minutes?: number;
    approval_required: boolean;
    approval_levels: number;
    created_at?: string;
    checklist_items?: ChecklistItem[];
    worker_time_percentage?: number;
}

export interface Instance {
    id: string;
    project_id: string;
    client_id?: string;
    name: string;
    status: 'ONGOING' | 'COMPLETED' | 'CANCELLED' | 'SCHEDULED' | 'PAUSED';
    is_scheduled?: boolean;
    scheduled_at?: string;
    created_by?: string;
    created_at?: string;
    project?: { id: string; name: string };
    client?: { id: string; name: string };
    creator?: { id: string; name: string };
    task_stats?: { total: number; completed: number };
    is_paused?: boolean;
}

export interface ApproverEntry {
    level: number;
    approver_id: string;
    allocated_minutes?: number;
}

export interface InstanceTaskAssignment {
    template_task_id: string;
    assigned_user_id: string;
    turnaround_minutes: number;
    approver_turnaround_minutes?: number;
    approvers: ApproverEntry[];
}



export interface AppNotification {
    id: string;
    user_id: string;
    type: 'task_assigned' | 'submitted_for_review' | 'task_approved' | 'task_rejected' | 'task_completed';
    title: string;
    message?: string | null;
    task_id?: string | null;
    instance_id?: string | null;
    sent_by?: string | null;
    is_read: boolean;
    created_at: string;
    // joined fields from GET /all
    recipient?: { id: string; name: string; email: string; workflow_role?: string } | null;
    sender?: { id: string; name: string; email: string } | null;
}


export interface ExternalUser {
    id: string;
    name: string;
    email: string;
    platform_role: string;
    workflow_role: string | null;
    is_active: boolean;
    created_at: string;
}

export interface OnboardingRequest {
    id: string;
    company_name: string;
    company_email: string;
    company_phone: string;
    company_website: string | null;
    company_address: string | null;
    contact_name: string;
    contact_designation: string;
    contact_email: string;
    contact_phone: string;
    purpose: string;
    team_size: string;
    industry: string | null;
    description: string | null;
    status: 'pending' | 'approved' | 'rejected';
    rejection_reason: string | null;
    created_at: string;
    reviewed_at: string | null;
}


// ─── AI Copy Types ─────────────────────────────────────────────────────────────

export interface CopyPromptData {
    product_name: string;
    brand_name?: string;
    target_audience?: string;
    tone: string;
    copy_type: string;
    additional_requirements?: string;
    image_links?: string[];
    previous_generation?: any;
}

export interface GeneratedCopyContent {
    subject_line: string;
    preview_text: string;
    headline: string;
    subheadline: string;
    cta_button_text: string;
    body: string;
    product_headline: string;
    closing_section: string;
    footer_text: string;
}

export interface AICopy {
    id: string;
    task_id: string;
    company_id: string;
    prompt_context: CopyPromptData;
    generated_content: GeneratedCopyContent;
    iteration_count: number;
    status: 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED';
    is_template: boolean;
    created_at: string;
    updated_at: string;
}


export type StatusFilter = 'all' | 'completed' | 'in_progress' | 'pending' | 'overdue' | 'late';
export type RoleFilter = 'all_roles' | 'worker' | 'reviewer';


export interface ControllerPerformanceData {
    id: string;
    name: string;
    role: string;
    totalTasks: number;
    completed: number;
    inProgress: number;
    pending: number;
    late: number;
    overdue: number;
    onTimeDelivery: number;
    taskEfficiency: number;
    qualityScore?: number;
    avgReviewTime?: number;
}
