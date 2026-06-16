'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '@/lib/api';
import { CompanyInfo } from '@/lib/types/auth';

interface CompanyState {
    company: CompanyInfo | null;
    companyloading: boolean;
    companyerror: string | null;

    fetchCompany: (companyId?: string) => Promise<void>;
    updateCompany: (formData: CompanyInfo) => Promise<boolean>;
    clearCompany: () => void;
}

export const useCompanyStore = create<CompanyState>()(
    persist(
        (set) => ({
            company: null,
            companyloading: false,
            companyerror: null,

            fetchCompany: async (companyId?: string) => {
                set({ companyloading: true, companyerror: null });

                try {
                    const { data } = await api.get('/getCompanyInfo', {
                        params: companyId ? { company_id: companyId } : undefined
                    });

                    set({
                        company: data,
                        companyloading: false,
                    });
                } catch (err: any) {
                    set({
                        companyerror: err.response?.data?.message || 'Failed to fetch company info',
                        companyloading: false,
                    });
                }
            },

            updateCompany: async (formData: CompanyInfo) => {
                set({ companyloading: true, companyerror: null });

                try {
                    const { data } = await api.put('/updateCompanyInfo', formData);

                    set({
                        company: data,
                        companyloading: false,
                    });

                    return true;
                } catch (err: any) {
                    set({
                        companyerror: err.response?.data?.message || 'Update failed',
                        companyloading: false,
                    });

                    return false;
                }
            },

            clearCompany: () => {
                set({
                    company: null,
                });
            },
        }),
        {
            name: 'company-storage',
            partialize: (state) => ({
                company: state.company,
            }),
        }
    )
);
