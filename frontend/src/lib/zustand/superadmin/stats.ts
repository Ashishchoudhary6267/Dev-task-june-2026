'use client';

import { create } from 'zustand';
import api from '@/lib/api';

interface SuperAdminStats {
    total_companies: number;
    pending_requests: number;
    total_users: number;
    total_templates: number;
    total_instances: number;
    total_tasks: number;

    last_updated: string;
}

interface SuperAdminStatsState {
    stats: SuperAdminStats | null;
    loading: boolean;
    error: string | null;

    fetchStats: () => Promise<void>;
}

export const useSuperAdminStatsStore = create<SuperAdminStatsState>((set) => ({
    stats: null,
    loading: false,
    error: null,

    fetchStats: async () => {
        set({ loading: true, error: null });
        try {
            const res = await api.get('/superadmin/stats');
            set({ stats: res.data, loading: false });
        } catch (err: any) {
            set({
                error: err.response?.data?.message || 'Failed to fetch Super Admin stats',
                loading: false
            });
        }
    },
}));
