import { create } from 'zustand';
import api from '@/lib/api';
import { ChecklistItem, ApprovalLevel, Task, TaskRow } from '@/lib/types/auth';
// ─── Types ────────────────────────────────────────────────────────────────────

export interface TabData {
    tasks: Task[];
    count: number;
    page: number;
    totalPages: number;
    loading: boolean;
}

interface TaskState {
    tasks: Task[];
    allTasks: Task[];
    workerTasks: Task[];
    approvalTasks: Task[];
    pendingApprovalTasks: Task[];
    upcomingTasks: Task[];
    completedTasks: Task[];
    reviewedTasks: any[];  // ApprovalHistoryEntry[] with nested task details
    upcomingReviews: Task[];  // tasks assigned for review but not yet submitted
    tasksCount: number;
    allTasksCount: number;
    allTasksPage: number;
    allTasksTotalPages: number;
    loading: boolean;
    error: string | null;
    myTabTasks: Task[];

    activeTab: TabData;
    pendingTab: TabData;
    completedTab: TabData;

    myTasksCounts: {
        all: number;
        workerTasks: number;
        approvalTasks: number;
        pendingApprovalTasks: number;
        upcomingTasks: number;
        completedTasks: number;
        reviewedTasks: number;
        upcomingReviews: number;
        overdue: number;
    };
    myTasksPagination: {
        page: number;
        limit: number;
        totalCount: number;
        totalPages: number;
    };

    fetchTasksByProject: (project_id: string) => Promise<void>;
    fetchAllTasks: (params?: { page?: number; limit?: number; status?: string; project_id?: string; search?: string; assigned_user_id?: string; date_range?: string; company_id?: string; startDate?: string; endDate?: string }) => Promise<void>;
    fetchTabTasks: (tabName: 'active' | 'pending' | 'completed', params?: { page?: number; limit?: number; status?: string; project_id?: string; search?: string; company_id?: string }) => Promise<void>;
    fetchMyTasks: (params?: { tab?: string; page?: number; limit?: number; search?: string; type?: string; client_id?: string; project_id?: string; date_range?: string; sort_by?: string; client_side?: boolean, start_date?: string; end_date?: string }) => Promise<void>;
    submitTask: (task_id: string, links?: string) => Promise<boolean>;
    approveTask: (task_id: string, comment?: string, clientApprovalNeeded?: boolean) => Promise<boolean>;
    rejectTask: (task_id: string, comment?: string) => Promise<boolean>;
    toggleChecklistItem: (task_id: string, item_id: string, is_checked: boolean, input_value?: string, status?: string | null, reviewer_comments?: any[]) => Promise<boolean>;
    fetchTaskForUserDeletion: (user_id: string) => Promise<void>;
    fetchTaskDetails: (task_id: string) => Promise<any>;
    reassignApprover: (taskId: string, oldApproverId: string, newApproverId: string, reason?: string) => Promise<boolean>;
    updateTaskNote: (taskId: string, notes: string) => Promise<boolean>;
}

export const useTaskStore = create<TaskState>((set, get) => ({
    tasks: [],
    allTasks: [],
    workerTasks: [],
    approvalTasks: [],
    pendingApprovalTasks: [],
    upcomingTasks: [],
    completedTasks: [],
    reviewedTasks: [],
    upcomingReviews: [],
    tasksCount: 0,
    allTasksCount: 0,
    allTasksPage: 1,
    allTasksTotalPages: 1,
    loading: false,
    error: null,
    myTabTasks: [],

    activeTab: { tasks: [], count: 0, page: 1, totalPages: 1, loading: false },
    pendingTab: { tasks: [], count: 0, page: 1, totalPages: 1, loading: false },
    completedTab: { tasks: [], count: 0, page: 1, totalPages: 1, loading: false },

    myTasksCounts: {
        all: 0,
        workerTasks: 0,
        approvalTasks: 0,
        pendingApprovalTasks: 0,
        upcomingTasks: 0,
        completedTasks: 0,
        reviewedTasks: 0,
        upcomingReviews: 0,
        overdue: 0,
    },
    data: [],
    myTasksPagination: {
        page: 1,
        limit: 10,
        totalCount: 0,
        totalPages: 1,
    },

    fetchTasksByProject: async (project_id) => {
        set({ loading: true, error: null });
        try {
            const { data } = await api.get('/tasks', { params: { project_id } });
            set({ tasks: data.data, tasksCount: data.count, loading: false });
        } catch (err: any) {
            set({ error: err.response?.data?.message || 'Failed to fetch tasks', loading: false });
        }
    },

    fetchAllTasks: async (params = {}) => {
        set({ loading: true, error: null });
        try {
            const { data } = await api.get('/tasks', {
                params: {
                    page: params.page || 1,
                    limit: params.limit || 10,
                    status: params.status,
                    project_id: params.project_id === 'all' ? undefined : params.project_id,
                    search: params.search,
                    assigned_user_id: params.assigned_user_id,
                    date_range: params.date_range,
                    startDate: params.startDate,
                    endDate: params.endDate,
                    company_id: params.company_id
                }
            });
            set({
                allTasks: data.data,
                allTasksCount: data.count,
                allTasksPage: data.page,
                allTasksTotalPages: data.totalPages,
                loading: false
            });
        } catch (err: any) {
            set({ error: err.response?.data?.message || 'Failed to fetch all tasks', loading: false });
        }
    },

    fetchTabTasks: async (tabName, params = {}) => {
        const tabKey = `${tabName}Tab` as 'activeTab' | 'pendingTab' | 'completedTab';
        set((state) => ({
            [tabKey]: { ...state[tabKey], loading: true },
            error: null
        }));
        try {
            const { data } = await api.get('/tasks', {
                params: {
                    page: params.page || 1,
                    limit: params.limit || 10,
                    status: params.status,
                    project_id: params.project_id === 'all' ? undefined : params.project_id,
                    search: params.search,
                    company_id: params.company_id
                }
            });
            set((state) => ({
                [tabKey]: {
                    tasks: data.data,
                    count: data.count,
                    page: data.page,
                    totalPages: data.totalPages,
                    loading: false
                }
            }));
        } catch (err: any) {
            set((state) => ({
                [tabKey]: { ...state[tabKey], loading: false },
                error: err.response?.data?.message || `Failed to fetch ${tabName} tasks`
            }));
        }
    },

    fetchMyTasks: async (params: any = {}) => {
        set({ loading: true, error: null });
        try {
            const { data: res } = await api.get('/tasks/my-tasks', { params });
            const tab = params.tab || 'workerTasks';

            if (params.client_side) {
                const { workerTasks, pendingApprovalTasks, upcomingTasks, completedTasks, approvalTasks, reviewedTasks, upcomingReviews } = res.data;
                const all = [
                    ...(workerTasks || []),
                    ...(approvalTasks || []),
                    ...(pendingApprovalTasks || []),
                    ...(upcomingTasks || []),
                    ...(completedTasks || [])
                ];

                // Deduplicate "all" just in case a task is in both worker and approval (though logically backend splits them now, or we just want unique)
                const uniqueAllMap = new Map();
                all.forEach((t: any) => uniqueAllMap.set(t.id, t));
                const uniqueAll = Array.from(uniqueAllMap.values()) as Task[];

                // Get current user ID from auth store
                const authState = JSON.parse(localStorage.getItem('auth-storage') || '{}');
                const currentUserId = authState?.state?.user?.id;
                
                const now = new Date();
                const overdueCount = uniqueAll.filter(task => {
                    if (task.status === 'COMPLETED') return false;
                    
                    // For worker tasks (IN_PROGRESS): check task.due_date
                    if (task.status === 'IN_PROGRESS' && task.assigned_user?.id === currentUserId) {
                        return task.due_date && new Date(task.due_date) < now;
                    }
                    
                    // For approval tasks (PENDING_APPROVAL): check approval level due_date
                    if (task.status === 'PENDING_APPROVAL' && task.task_approval_levels) {
                        const myPendingLevel = task.task_approval_levels.find(
                            (level: any) => level.approver_id === currentUserId && level.status === 'PENDING'
                        );
                        return myPendingLevel?.due_date && new Date(myPendingLevel.due_date) < now;
                    }
                    
                    return false;
                }).length;

                set({
                    workerTasks: workerTasks || [],
                    approvalTasks: approvalTasks || [],
                    pendingApprovalTasks: pendingApprovalTasks || [],
                    upcomingTasks: upcomingTasks || [],
                    completedTasks: completedTasks || [],
                    reviewedTasks: reviewedTasks || [],
                    upcomingReviews: upcomingReviews || [],
                    allTasks: uniqueAll,
                    myTasksCounts: {
                        all: uniqueAll.length,
                        workerTasks: workerTasks?.length || 0,
                        approvalTasks: approvalTasks?.length || 0,
                        pendingApprovalTasks: pendingApprovalTasks?.length || 0,
                        upcomingTasks: upcomingTasks?.length || 0,
                        completedTasks: completedTasks?.length || 0,
                        reviewedTasks: reviewedTasks?.length || 0,
                        upcomingReviews: upcomingReviews?.length || 0,
                        overdue: overdueCount,
                    },
                    loading: false,
                });
            } else {
                set({
                    [tab]: res.data,
                    myTabTasks: res.data,
                    myTasksCounts: res.counts,
                    myTasksPagination: res.pagination,
                    loading: false,
                });
            }
        } catch (err: any) {
            set({ error: err.response?.data?.message || 'Failed to fetch tasks', loading: false });
        }
    },

    fetchTaskForUserDeletion: async (user_id: string) => {
        set({ loading: true, error: null });
        try {
            const { data: res } = await api.get(`/tasks/user-tasks/${user_id}`);
            // const tab = 'workerTasks';

            set({
                // [tab]: res.data,
                myTabTasks: res.data,
                myTasksCounts: res.counts,
                myTasksPagination: res.pagination,
                loading: false,
            });
        } catch (err: any) {
            set({ error: err.response?.data?.message || 'Failed to fetch tasks', loading: false });
        }
    },

    fetchTaskDetails: async (task_id: string) => {
        set({ loading: true, error: null });
        try {
            const { data: res } = await api.get(`/tasks/detail/${task_id}`);
            set({ loading: false });
            return res.data;
        } catch (err: any) {
            set({ error: err.response?.data?.message || 'Failed to fetch task details', loading: false });
            return null;
        }
    },

    submitTask: async (task_id, links) => {
        set({ loading: true, error: null });
        try {
            await api.post(`/tasks/${task_id}/submit`, { links });
            set({ loading: false });
            // await get().fetchMyTasks({ client_side: true });
            return true;
        } catch (err: any) {
            set({ error: err.response?.data?.message || 'Failed to submit task', loading: false });
            return false;
        }
    },

    approveTask: async (task_id, comment, clientApprovalNeeded) => {
        set({ loading: true, error: null });
        try {
            await api.post(`/tasks/${task_id}/approve`, { 
                comment,
                requiresClientApproval: clientApprovalNeeded
            });
            await get().fetchMyTasks({ client_side: true });
            set({ loading: false });
            return true;
        } catch (err: any) {
            set({ error: err.response?.data?.message || 'Failed to approve task', loading: false });
            return false;
        }
    },

    rejectTask: async (task_id, comment) => {
        set({ loading: true, error: null });
        try {
            await api.post(`/tasks/${task_id}/reject`, { comment });
            await get().fetchMyTasks({ client_side: true });
            set({ loading: false });
            return true;
        } catch (err: any) {
            set({ error: err.response?.data?.message || 'Failed to reject task', loading: false });
            return false;
        }
    },

    toggleChecklistItem: async (task_id, item_id, is_checked, input_value, status, reviewer_comments) => {
        // Optimistic update across all lists
        const updateList = (list: Task[]) =>
            list.map(t =>
                t.id !== task_id ? t : {
                    ...t,
                    task_checklist_progress: (t.task_checklist_progress || []).map(item =>
                        item.id !== item_id ? item : { ...item, is_checked, ...(input_value !== undefined ? { input_value } : {}), ...(status !== undefined ? { status } : {}), ...(reviewer_comments !== undefined ? { reviewer_comments } : {}) }
                    ),
                }
            );

        set(state => ({
            workerTasks: updateList(state.workerTasks),
            approvalTasks: updateList(state.approvalTasks),
            pendingApprovalTasks: updateList(state.pendingApprovalTasks),
            upcomingTasks: updateList(state.upcomingTasks),
            completedTasks: updateList(state.completedTasks),
            allTasks: updateList(state.allTasks),
            tasks: updateList(state.tasks),
        }));
        try {
            const payload: any = { is_checked };
            if (input_value !== undefined) payload.input_value = input_value;
            if (status !== undefined) payload.status = status;
            if (reviewer_comments !== undefined) payload.reviewer_comments = reviewer_comments;
            await api.patch(`/tasks/${task_id}/checklist/${item_id}`, payload);
            return true;
        } catch {
            // Revert on failure
            await get().fetchMyTasks({ client_side: true });
            return false;
        }
    },
    reassignApprover: async (taskId: string, oldApproverId: string, newApproverId: string, reason?: string) => {
        try {
            await api.post(`/tasks/${taskId}/reassign-approver`, {
                old_approver_id: oldApproverId,
                new_approver_id: newApproverId,
                reason
            });
            return true;
        } catch (error: any) {
            console.error("Reassign Approver Error:", error);
            return false;
        }
    },
    updateTaskNote: async (taskId: string, notes: string) => {
        set({ loading: true, error: null });
        try {
            await api.put(`/tasks/${taskId}/notes`, { notes });
            set({ loading: false });
            return true;
        } catch (err: any) {
            set({ error: err.response?.data?.message || 'Failed to update task notes', loading: false });
            return false;
        }
    }
}));
