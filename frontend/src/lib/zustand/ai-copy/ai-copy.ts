import { create } from 'zustand';
import api from '@/lib/api';
import { AICopy, CopyPromptData } from '@/lib/types/auth';

interface AICopyState {
    currentCopy: AICopy | null;
    copies: AICopy[];
    generating: boolean;
    fetchingList: boolean;
    error: string | null;

    generateCopy: (taskId: string, companyId: string, promptData: CopyPromptData) => Promise<AICopy | null>;
    fetchCopiesForTask: (taskId: string) => Promise<void>;
    clearCopy: () => void;
}

export const useAICopyStore = create<AICopyState>((set) => ({
    currentCopy: null,
    copies: [],
    generating: false,
    fetchingList: false,
    error: null,

    generateCopy: async (taskId, companyId, promptData) => {
        set({ generating: true, error: null });
        try {
            const { data } = await api.post('/ai-copy/generate', {
                task_id: taskId,
                company_id: companyId,
                prompt_data: promptData,
            });
            set(state => ({
                currentCopy: data.data,
                generating: false,
                copies: [data.data, ...state.copies]
            }));
            return data.data;
        } catch (err: any) {
            const msg = err.response?.data?.message || 'Failed to generate copy';
            set({ error: msg, generating: false });
            return null;
        }
    },

    fetchCopiesForTask: async (taskId) => {
        set({ fetchingList: true, error: null });
        try {
            const { data } = await api.get(`/ai-copy/task/${taskId}`);
            set({ copies: data.data || [], fetchingList: false });
        } catch (err: any) {
            const msg = err.response?.data?.message || 'Failed to fetch copies';
            set({ error: msg, fetchingList: false });
        }
    },

    clearCopy: () => set({ currentCopy: null, error: null, copies: [] }),
}));
