import { create } from 'zustand';
import api from '@/lib/api';

import { Client } from '@/lib/types/auth';

interface TaskState {
    clients: Client[];
    clientsCount: number;
    clientsloading: boolean;
    clientserror: string | null;
    clientsPagination: { page: number; limit: number; totalCount: number; totalPages: number };

    createClient: (client: Client) => Promise<boolean>;
    updateClient: (id: string, client: Partial<Client>) => Promise<boolean>;
    deleteClient: (id: string) => Promise<boolean>;
    fetchClients: (company_id?: string, page?: number, limit?: number, search?: string, type?: 'CLIENT' | 'SERVICE') => Promise<void>;
}

export const useClientStore = create<TaskState>((set, get) => ({
    clients: [],
    clientsCount: 0,
    clientsloading: false,
    clientserror: null,
    clientsPagination: { page: 1, limit: 10, totalCount: 0, totalPages: 1 },

    createClient: async (client: Client) => {
        set({ clientsloading: true, clientserror: null });
        try {
            const { data } = await api.post('/createClient', client);
            set((s) => ({ clients: [data, ...s.clients], clientsCount: s.clientsCount + 1, clientsloading: false }));
            return true;
        } catch (err: any) {
            set({ clientserror: err.response?.data?.message || 'Failed to create client', clientsloading: false });
            return false;
        }
    },

    updateClient: async (id, updates) => {
        set({ clientsloading: true, clientserror: null });
        try {
            const { data } = await api.put(`/updateClient/${id}`, updates);
            set((s) => ({
                clients: s.clients.map(c => c.id === id ? { ...c, ...data } : c),
                clientsloading: false,
            }));
            return true;
        } catch (err: any) {
            set({ clientserror: err.response?.data?.message || 'Failed to update client', clientsloading: false });
            return false;
        }
    },

    deleteClient: async (id) => {
        set({ clientsloading: true, clientserror: null });
        try {
            await api.put(`/deleteClient/${id}`);
            set((s) => ({
                clients: s.clients.filter(c => c.id !== id),
                clientsCount: s.clientsCount - 1,
                clientsloading: false,
            }));
            return true;
        } catch (err: any) {
            set({ clientserror: err.response?.data?.message || 'Failed to delete client', clientsloading: false });
            return false;
        }
    },

    fetchClients: async (company_id?: string, page?: number, limit?: number, search?: string, type?: 'CLIENT' | 'SERVICE') => {
        set({ clientsloading: true, clientserror: null });
        try {
            const { data } = await api.get('/fetchClients', {
                params: { company_id, page, limit, search, type }
            });

            if (data && data.pagination) {
                set({
                    clients: data.data,
                    clientsCount: data.pagination.totalCount,
                    clientsPagination: { ...data.pagination, page: page || 1, limit: limit || 10 },
                    clientsloading: false
                });
            } else {
                const clientscount = Array.isArray(data) ? data.length : 0;
                set({
                    clients: Array.isArray(data) ? data : [],
                    clientsCount: clientscount,
                    clientsloading: false
                });
            }
        } catch (err: any) {
            set({ clientserror: err.response?.data?.message || 'Failed to fetch clients', clientsloading: false });
        }
    },

}));
