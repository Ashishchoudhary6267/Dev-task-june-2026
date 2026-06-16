'use client';

import { create } from 'zustand';
import api from '@/lib/api';
import { ManualTask } from '@/lib/types/auth';

interface CreateManualTaskPayload {
    title: string;
    description?: string;
    project_id?: string;
    assigned_user_id: string;
    priority: 'low' | 'medium' | 'high';
    estimated_minutes: number;
    turnaround_minutes?: number;
    due_date?: string;
    approval_required: boolean;
    approval_levels?: number;
    approvers?: { level: number; approver_id: string }[];
    company_id: string;
}

interface ManualTaskState {
    manualTasks: ManualTask[];
    loading: boolean;
    error: string | null;

    fetchManualTasks: (company_id: string) => Promise<void>;
    createManualTask: (payload: CreateManualTaskPayload) => Promise<boolean>;
    updateManualTask: (id: string, payload: Partial<Pick<ManualTask, 'title' | 'description' | 'project_id' | 'priority' | 'estimated_minutes' | 'turnaround_minutes' | 'due_date' | 'status'>>) => Promise<boolean>;
    deleteManualTask: (id: string) => Promise<boolean>;
}

export const useManualTaskStore = create<ManualTaskState>((set, get) => ({
    manualTasks: [],
    loading: false,
    error: null,

    fetchManualTasks: async (company_id) => {
        set({ loading: true, error: null });
        try {
            const { data } = await api.get('/tasks/manual', { params: { company_id } });
            set({ manualTasks: data.data || [], loading: false });
        } catch (err: any) {
            set({ error: err.response?.data?.message || 'Failed to fetch manual tasks', loading: false });
        }
    },

    createManualTask: async (payload) => {
        set({ loading: true, error: null });
        try {
            const { data } = await api.post('/tasks/manual', payload);
            set((state) => ({
                manualTasks: [data.task, ...state.manualTasks],
                loading: false,
            }));
            return true;
        } catch (err: any) {
            set({ error: err.response?.data?.message || 'Failed to create manual task', loading: false });
            return false;
        }
    },

    updateManualTask: async (id, payload) => {
        set({ loading: true, error: null });
        try {
            const { data } = await api.put(`/tasks/manual/${id}`, payload);
            set((state) => ({
                manualTasks: state.manualTasks.map((t) => (t.id === id ? { ...t, ...data.task } : t)),
                loading: false,
            }));
            return true;
        } catch (err: any) {
            set({ error: err.response?.data?.message || 'Failed to update manual task', loading: false });
            return false;
        }
    },

    deleteManualTask: async (id) => {
        set({ loading: true, error: null });
        try {
            await api.delete(`/tasks/manual/${id}`);
            set((state) => ({
                manualTasks: state.manualTasks.filter((t) => t.id !== id),
                loading: false,
            }));
            return true;
        } catch (err: any) {
            set({ error: err.response?.data?.message || 'Failed to delete manual task', loading: false });
            return false;
        }
    },
}));
