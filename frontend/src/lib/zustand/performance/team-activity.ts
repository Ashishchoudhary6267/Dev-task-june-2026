'use client';

import { create } from 'zustand';
import api from '@/lib/api';

interface TeamStats {
    total: number;
    active: number;
    completed: number;
    overdue: number;
    slaPercent: number;
    onTime: number;
    late: number;
}

interface MemberStats {
    id: string;
    name: string;
    role: string;
    total: number;
    active: number;
    completed: number;
    onTime: number;
    late: number;
    overdue: number;
    performance: number;
}

interface TeamActivityState {
    stats: TeamStats;
    memberStats: MemberStats[];
    loading: boolean;
    error: string | null;

    fetchTeamActivity: (params: { dateRange: string; memberId: string; startDate?: string; endDate?: string }) => Promise<void>;
}

export const useTeamActivityStore = create<TeamActivityState>((set, get) => ({
    stats: {
        total: 0,
        active: 0,
        completed: 0,
        overdue: 0,
        slaPercent: 0,
        onTime: 0,
        late: 0
    },
    memberStats: [],
    loading: false,
    error: null,

    fetchTeamActivity: async ({ dateRange, memberId, startDate, endDate }) => {
        // Only set loading if we don't have data yet to prevent "black card" flickering
        const hasData = get().memberStats.length > 0;
        if (!hasData) set({ loading: true });

        set({ error: null });

        try {
            const { data } = await api.get('/dashboard/team-performance', {
                params: { dateRange, memberId, startDate, endDate }
            });

            set({
                stats: data.stats || get().stats,
                memberStats: data.memberStats || [],
                loading: false
            });
        } catch (err: any) {
            console.error('Failed to fetch team activity:', err);
            set({
                error: err.response?.data?.message || 'Failed to fetch team stats',
                loading: false
            });
        }
    }
}));
