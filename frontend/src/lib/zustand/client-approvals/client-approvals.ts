import { create } from 'zustand';
import api from '@/lib/api';

export interface ClientApprovalTask {
    id: string;
    title: string;
    assigned_user_id: string | null;
    assigned_user: { id: string; name: string; email: string } | null;
}

export interface ClientApprovalInstance {
    id: string;
    name: string;
    client: { id: string; name: string } | null;
}

export interface ClientApproval {
    id: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN';
    instance_id: string;
    task_id: string;
    company_id: string;
    client_comment: string | null;
    decision_by: string | null;
    decision_at: string | null;
    follow_up_count: number;
    last_follow_up_at: string | null;
    created_at: string;
    updated_at: string;
    instance: ClientApprovalInstance | null;
    task: ClientApprovalTask | null;
    decided_by: { id: string; name: string } | null;
}

interface ClientApprovalState {
    approvals: ClientApproval[];
    count: number;
    loading: boolean;
    error: string | null;
    resolving: string | null; // ID of the approval currently being resolved
    fetchApprovals: (status?: string) => Promise<void>;
    resolveApproval: (id: string, action: 'APPROVED' | 'REJECTED', comment?: string) => Promise<void>;
}

export const useClientApprovalStore = create<ClientApprovalState>((set, get) => ({
    approvals: [],
    count: 0,
    loading: false,
    error: null,
    resolving: null,

    fetchApprovals: async (status = 'PENDING') => {
        set({ loading: true, error: null });
        try {
            const { data } = await api.get('/client-approvals', { params: { status, limit: 50 } });
            set({
                approvals: data.data || [],
                count: data.count || 0,
                loading: false,
            });
        } catch (err: any) {
            set({
                error: err.response?.data?.message || 'Failed to fetch client approvals',
                loading: false,
            });
        }
    },

    resolveApproval: async (id, action, comment) => {
        set({ resolving: id });
        try {
            await api.post(`/client-approvals/${id}/resolve`, { action, comment });
            // Remove resolved approval from the list and update count
            set((state) => ({
                approvals: state.approvals.filter((a) => a.id !== id),
                count: Math.max(0, state.count - 1),
                resolving: null,
            }));
        } catch (err: any) {
            set({ resolving: null });
            throw err;
        }
    },
}));
