import { create } from 'zustand';
import api from '@/lib/api';
import { Holiday } from '@/lib/types/auth';

interface HolidayStore {
    holidays: Holiday[];
    loading: boolean;
    error: string | null;
    fetchHolidays: (company_id?: string) => Promise<void>;
    addHoliday: (date: Date, name: string, description: string, type: string, company_id?: string) => Promise<boolean>;
    deleteHoliday: (id: string) => Promise<boolean>;
}

export const useHolidayStore = create<HolidayStore>((set) => ({
    holidays: [],
    loading: false,
    error: null,

    fetchHolidays: async (company_id?: string) => {
        set({ loading: true, error: null });
        try {
            const response = await api.get('/holidays', {
                params: { company_id }
            });
            set({ holidays: response.data, loading: false });
        } catch (error: any) {
            set({
                error: error.response?.data?.message || 'Failed to fetch holidays',
                loading: false,
            });
        }
    },

    addHoliday: async (date, name, description, type, company_id) => {
        set({ loading: true, error: null });
        try {
            const formattedDate = date.toISOString().split('T')[0]; // Format as YYYY-MM-DD
            const response = await api.post('/holidays', {
                date: formattedDate,
                name,
                description,
                type,
                company_id
            });

            set((state) => ({
                holidays: [...state.holidays, response.data].sort((a, b) =>
                    new Date(a.holiday_date).getTime() - new Date(b.holiday_date).getTime()
                ),
                loading: false
            }));
            return true;
        } catch (error: any) {
            set({
                error: error.response?.data?.message || 'Failed to add holiday',
                loading: false,
            });
            return false;
        }
    },

    deleteHoliday: async (id) => {
        set({ loading: true, error: null });
        try {
            await api.delete(`/holidays/${id}`);
            set((state) => ({
                holidays: state.holidays.filter(h => h.id !== id),
                loading: false
            }));
            return true;
        } catch (error: any) {
            set({
                error: error.response?.data?.message || 'Failed to delete holiday',
                loading: false,
            });
            return false;
        }
    }
}));
