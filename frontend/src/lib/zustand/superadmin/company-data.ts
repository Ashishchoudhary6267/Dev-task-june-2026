'use client';

import { create } from 'zustand';
import api from '@/lib/api';

interface SACompanyDataState {
    currentCompanyId: string | null;

    // Users
    users: any[];
    usersLoading: boolean;

    // Projects / Templates
    projects: any[];
    projectsCount: number;
    projectsPage: number;
    projectsTotalPages: number;
    projectsLoading: boolean;

    // Clients
    clients: any[];
    clientsCount: number;
    clientsPagination: { page: number; limit: number; totalCount: number; totalPages: number };
    clientsLoading: boolean;

    // Tasks
    tasks: any[];
    tasksCount: number;
    tasksPage: number;
    tasksTotalPages: number;
    tasksLoading: boolean;

    // Actions
    fetchSAUsers: (companyId: string) => Promise<void>;
    fetchSAProjects: (companyId: string, params?: {
        page?: number; limit?: number; search?: string;
        type?: string; status?: string; category?: string; sortBy?: string;
    }) => Promise<void>;
    fetchSAClients: (companyId: string, page?: number, limit?: number, search?: string) => Promise<void>;
    fetchSATasks: (companyId: string, page?: number, limit?: number) => Promise<void>;
    clearSAData: () => void;
}

const defaultState = {
    currentCompanyId: null,
    users: [],
    usersLoading: false,
    projects: [],
    projectsCount: 0,
    projectsPage: 1,
    projectsTotalPages: 1,
    projectsLoading: false,
    clients: [],
    clientsCount: 0,
    clientsPagination: { page: 1, limit: 10, totalCount: 0, totalPages: 1 },
    clientsLoading: false,
    tasks: [],
    tasksCount: 0,
    tasksPage: 1,
    tasksTotalPages: 1,
    tasksLoading: false,
};

export const useSACompanyDataStore = create<SACompanyDataState>((set) => ({
    ...defaultState,

    fetchSAUsers: async (companyId: string) => {
        // Always reset to prevent cross-company stale data
        set({ users: [], usersLoading: true, currentCompanyId: companyId });
        try {
            const { data } = await api.get(`/superadmin/company/${companyId}/users`);
            set({ users: data.data || [], usersLoading: false });
        } catch {
            set({ usersLoading: false });
        }
    },

    fetchSAProjects: async (companyId: string, params = {}) => {
        set({ projects: [], projectsLoading: true, currentCompanyId: companyId });
        try {
            const { data } = await api.get(`/superadmin/company/${companyId}/projects`, {
                params: {
                    page: params.page || 1,
                    limit: params.limit || 10,
                    search: params.search,
                    type: params.type,
                    status: params.status,
                    category: params.category,
                    sortBy: params.sortBy,
                }
            });
            set({
                projects: data.data || [],
                projectsCount: data.count || 0,
                projectsPage: data.page || 1,
                projectsTotalPages: data.totalPages || 1,
                projectsLoading: false,
            });
        } catch {
            set({ projectsLoading: false });
        }
    },

    fetchSAClients: async (companyId: string, page = 1, limit = 10, search?: string) => {
        set({ clients: [], clientsLoading: true, currentCompanyId: companyId });
        try {
            const { data } = await api.get(`/superadmin/company/${companyId}/clients`, {
                params: { page, limit, search }
            });
            set({
                clients: data.data || [],
                clientsCount: data.pagination?.totalCount || 0,
                clientsPagination: {
                    page,
                    limit,
                    totalCount: data.pagination?.totalCount || 0,
                    totalPages: data.pagination?.totalPages || 1,
                },
                clientsLoading: false,
            });
        } catch {
            set({ clientsLoading: false });
        }
    },

    fetchSATasks: async (companyId: string, page = 1, limit = 20) => {
        set({ tasks: [], tasksLoading: true, currentCompanyId: companyId });
        try {
            const { data } = await api.get(`/superadmin/company/${companyId}/tasks`, {
                params: { page, limit }
            });
            set({
                tasks: data.data || [],
                tasksCount: data.count || 0,
                tasksPage: data.page || 1,
                tasksTotalPages: data.totalPages || 1,
                tasksLoading: false,
            });
        } catch {
            set({ tasksLoading: false });
        }
    },

    clearSAData: () => set({ ...defaultState }),
}));
