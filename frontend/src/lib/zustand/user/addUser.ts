'use client';

import { create } from 'zustand';
import api from '@/lib/api';
import { User } from '@/lib/types/auth';

interface UserState {
    users: User[];
    usercount: number;
    userpage: number;
    usertotalpages: number;
    loading: boolean;
    error: string | null;


    fetchUsers: (params?: { page?: number; limit?: number; search?: string; roles?: string }) => Promise<void>;
    addUser: (
        email: string,
        password: string,
        name: string,
        company_id: string,
        platform_role: string,
        workflow_role_id: string
    ) => Promise<boolean>;
}

export const useUserStore = create<UserState>((set) => ({
    users: [],
    usercount: 0,
    userpage: 1,
    usertotalpages: 1,
    loading: false,
    error: null,

    fetchUsers: async (params?: { page?: number; limit?: number; search?: string; roles?: string }) => {
        set({ loading: true, error: null });

        try {
            const { data } = await api.get('/fetchallusers', { params });

            const limit = params?.limit || 10;
            const totalPages = Math.ceil((data.userCount || 0) / limit);

            set({
                users: data.data,
                usercount: data.userCount,
                userpage: params?.page || 1,
                usertotalpages: totalPages,
                loading: false,
            });
        } catch (err: any) {
            set({
                error: err.response?.data?.message || 'Failed to fetch users',
                loading: false,
            });
        }
    },

    // ✅ Add new user and update state immediately
    addUser: async (
        email,
        password,
        name,
        company_id,
        platform_role,
        workflow_role
    ) => {
        set({ loading: true, error: null });

        try {
            const { data } = await api.post('/adduser', {
                email,
                password,
                name,
                company_id,
                platform_role,
                workflow_role,
            });

            // 🔥 Append new user to existing users array
            set((state) => ({
                users: [...state.users, data],
                usercount: state.usercount + 1,
                loading: false,
            }));

            return true;
        } catch (err: any) {
            set({
                error: err.response?.data?.message || 'Failed to add user',
                loading: false,
            });
            throw err;
        }
    },
}));