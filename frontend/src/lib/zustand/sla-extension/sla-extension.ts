import { create } from 'zustand';
import api from '@/lib/api';

export interface SLAExtensionRequest {
    is_auto_generated: any;
    controller_deadline: any;
    id: string;
    task_id: string;
    requested_by: string;
    requested_at: string;
    reason: string;
    suggested_new_deadline?: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    reviewed_by?: string;
    reviewed_at?: string;
    reviewer_comment?: string;
    final_new_deadline?: string;
    company_id: string;
    tasks?: any;
    requested_by_user?: any;
    reviewed_by_user?: any;
}

interface SLAExtensionState {
    requests: SLAExtensionRequest[];
    requestsCount: number;
    currentPage: number;
    totalPages: number;
    loading: boolean;
    error: string | null;

    myRequests: SLAExtensionRequest[];
    myRequestsCount: number;
    myCurrentPage: number;
    myTotalPages: number;
    myLoading: boolean;
    myError: string | null;

    taskExtensionHistory: SLAExtensionRequest[];
    historyLoading: boolean;

    fetchRequests: (params?: { status?: string; page?: number; limit?: number; search?: string; member?: string; dateFrom?: string; dateTo?: string; overdue?: string; sortBy?: string; sortOrder?: string }) => Promise<void>;
    fetchMyRequests: (params?: { status?: string; page?: number; limit?: number; search?: string; dateFrom?: string; dateTo?: string; sortBy?: string; sortOrder?: string }) => Promise<void>;
    requestExtension: (taskId: string, reason: string, suggestedDeadline?: string) => Promise<boolean>;
    approveRequest: (requestId: string, newDeadline: string, reason?: string, comment?: string) => Promise<boolean>;
    rejectRequest: (requestId: string, comment: string) => Promise<boolean>;
    fetchTaskExtensionHistory: (taskId: string) => Promise<void>;
}

export const useSLAExtensionStore = create<SLAExtensionState>((set, get) => ({
    requests: [],
    requestsCount: 0,
    currentPage: 1,
    totalPages: 1,
    loading: false,
    error: null,

    myRequests: [],
    myRequestsCount: 0,
    myCurrentPage: 1,
    myTotalPages: 1,
    myLoading: false,
    myError: null,

    taskExtensionHistory: [],
    historyLoading: false,

    fetchRequests: async (params = {}) => {
        set({ loading: true, error: null });
        try {
            const { data } = await api.get('/sla-extension-requests', {
                params: {
                    status: params.status || 'PENDING',
                    page: params.page || 1,
                    limit: params.limit || 20,
                    search: params.search,
                    member: params.member,
                    dateFrom: params.dateFrom,
                    dateTo: params.dateTo,
                    overdue: params.overdue,
                    sortBy: params.sortBy,
                    sortOrder: params.sortOrder
                }
            });

            set({
                requests: data.data || [],
                requestsCount: data.count || 0,
                currentPage: data.page || 1,
                totalPages: data.totalPages || 1,
                loading: false
            });
        } catch (err: any) {
            set({
                error: err.response?.data?.message || 'Failed to fetch SLA extension requests',
                loading: false
            });
        }
    },

    fetchMyRequests: async (params = {}) => {
        set({ myLoading: true, myError: null });
        try {
            const { data } = await api.get('/sla-extension-requests/my', {
                params: {
                    status: params.status || 'ALL',
                    page: params.page || 1,
                    limit: params.limit || 20,
                    search: params.search,
                    dateFrom: params.dateFrom,
                    dateTo: params.dateTo,
                    sortBy: params.sortBy,
                    sortOrder: params.sortOrder
                }
            });

            set({
                myRequests: data.data || [],
                myRequestsCount: data.count || 0,
                myCurrentPage: data.page || 1,
                myTotalPages: data.totalPages || 1,
                myLoading: false
            });
        } catch (err: any) {
            set({
                myError: err.response?.data?.message || 'Failed to fetch your SLA extension requests',
                myLoading: false
            });
        }
    },


    requestExtension: async (taskId, reason, suggestedDeadline) => {
        set({ loading: true, error: null });
        try {
            await api.post(`/tasks/${taskId}/request-sla-extension`, {
                reason,
                suggested_new_deadline: suggestedDeadline
            });
            set({ loading: false });
            return true;
        } catch (err: any) {
            set({
                error: err.response?.data?.message || 'Failed to request SLA extension',
                loading: false
            });
            return false;
        }
    },

    approveRequest: async (requestId, newDeadline, reason, comment) => {
        set({ loading: true, error: null });
        try {
            await api.post(`/sla-extension-requests/${requestId}/approve`, {
                new_deadline: newDeadline,
                reason,
                comment
            });
            await get().fetchRequests({ status: 'PENDING' });
            set({ loading: false });
            return true;
        } catch (err: any) {
            set({
                error: err.response?.data?.message || 'Failed to approve request',
                loading: false
            });
            return false;
        }
    },

    rejectRequest: async (requestId, comment) => {
        set({ loading: true, error: null });
        try {
            await api.post(`/sla-extension-requests/${requestId}/reject`, {
                comment
            });
            await get().fetchRequests({ status: 'PENDING' });
            set({ loading: false });
            return true;
        } catch (err: any) {
            set({
                error: err.response?.data?.message || 'Failed to reject request',
                loading: false
            });
            return false;
        }
    },

    fetchTaskExtensionHistory: async (taskId) => {
        set({ historyLoading: true, error: null });
        try {
            const { data } = await api.get(`/tasks/${taskId}/sla-extension-requests`);
            set({
                taskExtensionHistory: data.data || [],
                historyLoading: false
            });
        } catch (err: any) {
            set({
                error: err.response?.data?.message || 'Failed to fetch extension history',
                historyLoading: false
            });
        }
    }
}));
