import api from '@/lib/api';
import { create } from 'zustand';


interface TatSettings {
    company_id: string;
    tat_review_deadline_hours: number;
}

interface TatSettingsStore {
    tatSettings: TatSettings | null;
    loading: boolean;
    error: string | null;
    fetchTatSettings: () => Promise<void>;
    updateTatSettings: (hours: number) => Promise<boolean>;
}

export const useTatSettingsStore = create<TatSettingsStore>((set) => ({
    tatSettings: null,
    loading: false,
    error: null,

    fetchTatSettings: async () => {
        set({ loading: true, error: null });
        try {
            const res = await api.get('/companies/tat-settings');
            set({ tatSettings: res.data, loading: false });
        } catch (err: any) {
            set({ error: err.response?.data?.message || 'Failed to fetch TAT settings', loading: false });
        }
    },

    updateTatSettings: async (hours: number) => {
        set({ loading: true, error: null });
        try {
            const res = await api.patch('/companies/tat-settings', {
                tat_review_deadline_hours: hours,
            });
            set({ tatSettings: res.data, loading: false });
            return true;
        } catch (err: any) {
            set({ error: err.response?.data?.message || 'Failed to update TAT settings', loading: false });
            return false;
        }
    },
}));
