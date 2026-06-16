'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '@/lib/api';
import { User, Session } from '@/lib/types/auth';
import Cookies from 'js-cookie';
import { supabase } from '@/lib/supabase';

interface AuthState {
    user: User | null;
    session: Session | null;
    isAuthenticated: boolean;
    loading: boolean;
    error: string | null;

    impersonatingFrom: User | null;

    login: (email: string, password: string) => Promise<boolean>;
    signInWithGoogle: () => Promise<void>;
    checkGoogleLoginStatus: () => Promise<{ status: string; userData?: any; googleUser?: any; message?: string }>;
    logout: () => void;
    fetchPermissions: () => Promise<void>;
    impersonate: (userId: string) => Promise<void>;
    stopImpersonating: () => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            user: null,
            session: null,
            isAuthenticated: false,
            loading: false,
            error: null,
            impersonatingFrom: null,

            login: async (email: string, password: string) => {
                set({ loading: true, error: null });

                try {
                    const { data } = await api.post('/login', {
                        email,
                        password,
                    });

                    const authUser = data.authData.user;
                    const authSession = data.authData.session;
                    const profile = data.userData;

                    const storedUser: User = {
                        id: profile.id,
                        name: profile.name,
                        company_id: profile.company_id,
                        platform_role: profile.platform_role,
                        workflow_role: profile.workflow_role,
                        login_count: profile.login_count || 0,
                        permissions: profile.permissions,
                        
                    };

                    const storedSession: Session = {
                        access_token: authSession.access_token,
                        refresh_token: authSession.refresh_token,
                        expires_at: authSession.expires_at,
                    };

                    // Set cookie for middleware
                    Cookies.set('auth-user', JSON.stringify({
                        id: profile.id,
                        platform_role: profile.platform_role,
                        workflow_role: profile.workflow_role,
                        isAuthenticated: true,
                        permissions: profile.permissions,
                    }), { expires: 7, path: '/' }); // 7 days

                    set({
                        user: storedUser,
                        session: storedSession,
                        isAuthenticated: true,
                        loading: false,
                    });

                    return true;
                } catch (err: any) {
                    set({
                        error: err.response?.data?.message || 'Login failed',
                        loading: false,
                    });
                    return false;
                }
            },

            signInWithGoogle: async () => {
                // Determine the correct redirect URL
                const getURL = () => {
                    let url =
                        process.env.NEXT_PUBLIC_URL ?? // Custom site URL
                        process.env.NEXT_PUBLIC_VERCEL_URL ?? // Vercel deployment URL
                        (typeof window !== 'undefined' ? window.location.origin : '');

                    // Ensure protocol is present
                    url = url.includes('http') ? url : `https://${url}`;
                    // Remove trailing slash
                    url = url.replace(/\/$/, '');
                    return url;
                };

                const redirectUrl = `${getURL()}/auth/callback`;
                console.log('OAuth Redirect URL:', redirectUrl);

                const { error } = await supabase.auth.signInWithOAuth({
                    provider: 'google',
                    options: {
                        redirectTo: redirectUrl,
                    },
                });
                if (error) throw error;
            },

            checkGoogleLoginStatus: async () => {
                set({ loading: true, error: null });
                try {
                    // Try to get session, giving it a moment to process the fragment if needed
                    let { data: { session: supabaseSession } } = await supabase.auth.getSession();

                    if (!supabaseSession) {
                        // If session is missing, try getUser() as it can trigger an internal refresh/code exchange
                        const { data: { user: authUser }, error: userError } = await supabase.auth.getUser();
                        if (userError || !authUser) {
                            set({ loading: false });
                            return { status: 'UNAUTHENTICATED' };
                        }
                        // try get session again after getUser
                        const { data: { session: secondAttemptSession } } = await supabase.auth.getSession();
                        supabaseSession = secondAttemptSession;
                    }

                    if (!supabaseSession) {
                        set({ loading: false });
                        return { status: 'UNAUTHENTICATED' };
                    }

                    const { data } = await api.post('/google-login', {}, {
                        headers: {
                            Authorization: `Bearer ${supabaseSession.access_token}`
                        }
                    });

                    if (data.status === 'LOGGED_IN') {
                        const profile = data.userData;
                        const authUser = data.authData.user;

                        const storedUser: User = {
                            id: profile.id,
                            name: profile.name,
                            company_id: profile.company_id,
                            platform_role: profile.platform_role,
                            workflow_role: profile.workflow_role,
                            login_count: profile.login_count || 0,
                            permissions: profile.permissions,
                          
                        };

                        const storedSession: Session = {
                            access_token: supabaseSession.access_token,
                            refresh_token: supabaseSession.refresh_token,
                            expires_at: supabaseSession.expires_at!,
                        };

                        Cookies.set('auth-user', JSON.stringify({
                            id: profile.id,
                            platform_role: profile.platform_role,
                            workflow_role: profile.workflow_role,
                            isAuthenticated: true,
                            permissions: profile.permissions,
                        }), { expires: 7, path: '/' });

                        set({
                            user: storedUser,
                            session: storedSession,
                            isAuthenticated: true,
                            loading: false,
                        });
                    } else {
                        set({ loading: false });
                    }

                    return data;
                } catch (err: any) {
                    set({
                        error: err.response?.data?.message || 'Google login verification failed',
                        loading: false,
                    });
                    return { status: 'ERROR', message: err.message };
                }
            },

            logout: () => {
                Cookies.remove('auth-user', { path: '/' });
                sessionStorage.clear();
                set({
                    user: null,
                    session: null,
                    isAuthenticated: false,
                });
            },

            fetchPermissions: async () => {
                const { user } = get();
                if (!user) return;

                try {
                    const { data } = await api.get(`/permissions/${user.id}`);
                    if (data && Array.isArray(data.data)) {
                        set((state) => ({
                            user: state.user ? { ...state.user, permissions: data.data } : null
                        }));
                    }
                } catch (error) {
                    console.error("Failed to fetch fresh permissions", error);
                }
            },

            impersonate: async (userId: string) => {
                const currentUser = get().user;
                if (!currentUser || currentUser.platform_role !== 'superadmin') return;

                set({ loading: true });
                try {
                    const { data } = await api.get(`/superadmin/impersonate/${userId}`);
                    const targetUser = data.userData;

                    set({
                        impersonatingFrom: currentUser,
                        user: {
                            id: targetUser.id,
                            name: targetUser.name,
                            company_id: targetUser.company_id,
                            platform_role: targetUser.platform_role,
                            workflow_role: targetUser.workflow_role,
                            login_count: targetUser.login_count || 0,
                            permissions: targetUser.permissions || [],
                          
                        },
                        loading: false
                    });

                    // Update cookie for middleware (though it won't have the header yet, 
                    // the header logic is in api.ts)
                    Cookies.set('auth-user', JSON.stringify({
                        id: targetUser.id,
                        platform_role: targetUser.platform_role,
                        workflow_role: targetUser.workflow_role,
                        isAuthenticated: true,
                        permissions: targetUser.permissions || [],
                    }), { expires: 1, path: '/' });

                } catch (error) {
                    console.error("Impersonation failed", error);
                    set({ loading: false });
                }
            },

            stopImpersonating: () => {
                const originalAdmin = get().impersonatingFrom;
                if (!originalAdmin) return;

                set({
                    user: originalAdmin,
                    impersonatingFrom: null
                });

                Cookies.set('auth-user', JSON.stringify({
                    id: originalAdmin.id,
                    platform_role: originalAdmin.platform_role,
                    workflow_role: originalAdmin.workflow_role,
                    isAuthenticated: true,
                    permissions: originalAdmin.permissions || [],
                }), { expires: 7, path: '/' });
            },
        }),
        {
            name: 'auth-storage',
            partialize: (state) => ({
                user: state.user,
                session: state.session,
                isAuthenticated: state.isAuthenticated,
            }),
        }
    )
);