'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '@/lib/api';

interface ExternalUser {
    id: string;
    name: string;
    email: string;
    platform_role: string;
    workflow_role: string | null;
    is_active: boolean;
    created_at: string;
}

interface CompanyDetails {
    id: string;
    name: string;
    stats: {
        totalUsers: number;
        totalTasks: number;
        totalInstances: number;
        totalTemplates: number;
    };
}

interface SuperadminOverviewState {
    company: CompanyDetails | null;
    users: ExternalUser[];
    projects: any[];
    instances: any[];
    loading: boolean;
    error: string | null;

    fetchCompanyOverview: (companyId: string) => Promise<void>;
    clearOverview: () => void;
}

export const useSuperadminOverviewStore = create<SuperadminOverviewState>()(
    persist(
        (set, get) => ({
            company: null,
            users: [],
            projects: [],
            instances: [],
            loading: false,
            error: null,

            fetchCompanyOverview: async (companyId: string) => {
                // Only set loading to true if we don't have data for this company yet
                // This prevents the "blank screen" effect on refetch
                const currentCompany = get().company;
                if (!currentCompany || currentCompany.id !== companyId) {
                    set({ loading: true });
                }

                try {
                    const [companyRes, usersRes, projectsRes, instancesRes] = await Promise.all([
                        api.get(`/superadmin/company/details/${companyId}`),
                        api.get(`/superadmin/company/${companyId}/users`),
                        api.get('/fetchallprojects', { params: { company_id: companyId } }),
                        api.get('/instances', { params: { company_id: companyId } })
                    ]);

                    set({
                        company: companyRes.data,
                        users: usersRes.data.data,
                        projects: projectsRes.data.data,
                        instances: instancesRes.data.data,
                        loading: false,
                        error: null
                    });
                } catch (err: any) {
                    set({
                        error: err.response?.data?.message || 'Failed to fetch company overview',
                        loading: false
                    });
                }
            },

            clearOverview: () => {
                set({ company: null, users: [], projects: [], instances: [], loading: false, error: null });
            }
        }),
        {
            name: 'superadmin-overview-storage',
            partialize: (state) => ({
                company: state.company,
                users: state.users,
                projects: state.projects,
                instances: state.instances,
            }),
        }
    )
);
