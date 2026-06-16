'use client';

import { create } from 'zustand';
import api from '@/lib/api';
import { OnboardingRequest } from '@/lib/types/auth';
interface SuperAdminOnboardingState {
    requests: OnboardingRequest[];
    companies: any[];
    loading: boolean;
    error: string | null;

    fetchRequests: () => Promise<void>;
    fetchCompanies: () => Promise<void>;
    approveRequest: (id: string) => Promise<void>;
    rejectRequest: (id: string, reason: string) => Promise<void>;

}


export const useSuperAdminCompanyStore = create<SuperAdminOnboardingState>((set, get) => ({
    requests: [],
    companies: [],
    loading: false,
    error: null,

    fetchRequests: async () => {
        set({ loading: true, error: null });
        try {
            const url = '/superadmin/onboarding-requests';
            const res = await api.get(url);
            set({ requests: res.data, loading: false });
        } catch (err: any) {
            set({
                error: err.response?.data?.message || 'Failed to fetch onboarding requests',
                loading: false
            });
        }
    },


    fetchCompanies: async () => {
        set({ loading: true, error: null });
        try {

            const res = await api.get('/superadmin/companies');
            console.log("companies", res.data);

            set({ companies: res.data, loading: false });
        } catch (error) {
            console.error(error);
        }
    },


    // approve onboarding requests
    approveRequest: async (id: string) => {
        set({ loading: true, error: null });
        try {
            const url = `/superadmin/onboarding-requests/${id}/approve`;
            await api.put(url);
            await get().fetchRequests();
        } catch (err: any) {
            set({
                error: err.response?.data?.message || 'Failed to approve request',
                loading: false
            });
        }
    },

    // reject onboarding requests
    rejectRequest: async (id: string, reason: string) => {
        set({ loading: true, error: null });
        try {
            await api.put(`/superadmin/onboarding-requests/${id}/reject`, { rejection_reason: reason });
            await get().fetchRequests();
        } catch (err: any) {
            set({
                error: err.response?.data?.message || 'Failed to reject request',
                loading: false
            });
        }
    }
}));
