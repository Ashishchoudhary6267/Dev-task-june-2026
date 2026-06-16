'use client';

import { create } from 'zustand';
import api from '@/lib/api';
import { MemberPerformanceSummary, MemberTask } from '@/lib/types/auth';

// ─── Types ───────────────────────────────────────────────────────────────────


interface PerformanceState {
    // Team list
    members: MemberPerformanceSummary[];
    teamLoading: boolean;
    teamError: string | null;

    // Member task detail (for modal)
    memberTasks: MemberTask[];
    memberTasksLoading: boolean;
    memberTasksError: string | null;

    // Active date range (ISO strings)
    dateFrom: string;
    dateTo: string;

    // Actions
    fetchTeamPerformance: (from?: string, to?: string) => Promise<void>;
    fetchMemberTasks: (userId: string, from?: string, to?: string) => Promise<void>;
    setDateRange: (from: string, to: string) => void;
    clearMemberTasks: () => void;
}

// ─── Default date range helpers ───────────────────────────────────────────────

function firstOfMonth(): string {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    return `${yyyy}-${mm}-01`;
}

function today(): string {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const usePerformanceStore = create<PerformanceState>((set, get) => ({
    members: [],
    teamLoading: false,
    teamError: null,

    memberTasks: [],
    memberTasksLoading: false,
    memberTasksError: null,

    dateFrom: firstOfMonth(),
    dateTo: today(),

    setDateRange: (from, to) => set({ dateFrom: from, dateTo: to }),

    clearMemberTasks: () => set({ memberTasks: [], memberTasksError: null }),

    fetchTeamPerformance: async (from, to) => {
        const fromDate = from ?? get().dateFrom;
        const toDate = to ?? get().dateTo;

        set({ teamLoading: true, teamError: null });
        try {
            const { data } = await api.get('/performance/team', {
                params: { from: fromDate, to: toDate },
            });
            set({ members: data.data ?? [], teamLoading: false });
        } catch (err: any) {
            set({
                teamError: err.response?.data?.message || 'Failed to fetch performance data',
                teamLoading: false,
            });
        }
    },

    fetchMemberTasks: async (userId, from, to) => {
        const fromDate = from ?? get().dateFrom;
        const toDate = to ?? get().dateTo;

        set({ memberTasksLoading: true, memberTasksError: null, memberTasks: [] });
        try {
            const { data } = await api.get(`/performance/member/${userId}`, {
                params: { from: fromDate, to: toDate },
            });
            set({ memberTasks: data.data ?? [], memberTasksLoading: false });
        } catch (err: any) {
            set({
                memberTasksError: err.response?.data?.message || 'Failed to fetch member tasks',
                memberTasksLoading: false,
            });
        }
    },
}));
