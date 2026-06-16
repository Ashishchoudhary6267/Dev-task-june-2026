import axios from 'axios';
import { useAuthStore } from '@/lib/zustand/user/user';

const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL,
    withCredentials: true,
});

// REQUEST INTERCEPTOR
api.interceptors.request.use((config) => {
    const state = useAuthStore.getState();
    const token = state.session?.access_token;
    const isImpersonating = !!state.impersonatingFrom;
    const targetUserId = state.user?.id;

    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    if (isImpersonating && targetUserId) {
        config.headers['X-Impersonate-User'] = targetUserId;
    }

    return config;
});

let isRefreshing = false;
let isRedirecting = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
    failedQueue.forEach(prom => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });

    failedQueue = [];
};

// RESPONSE INTERCEPTOR
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
            if (isRefreshing) {
                return new Promise(function (resolve, reject) {
                    failedQueue.push({ resolve, reject });
                }).then(token => {
                    originalRequest.headers.Authorization = `Bearer ${token}`;
                    return api(originalRequest);
                }).catch(err => {
                    return Promise.reject(err);
                });
            }

            originalRequest._retry = true;
            isRefreshing = true;

            const session = useAuthStore.getState().session;
            const refreshToken = session?.refresh_token;

            if (refreshToken) {
                try {
                    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
                    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

                    if (!supabaseUrl || !supabaseAnonKey) {
                        throw new Error("Missing Supabase credentials");
                    }

                    // Attempt to refresh the token using Supabase API
                    const response = await axios.post(
                        `${supabaseUrl}/auth/v1/token?grant_type=refresh_token`,
                        { refresh_token: refreshToken },
                        {
                            headers: {
                                'apikey': supabaseAnonKey,
                                'Content-Type': 'application/json'
                            }
                        }
                    );

                    const newSession = response.data;

                    // Update zustand store
                    useAuthStore.setState((state) => ({
                        ...state,
                        session: {
                            ...state.session,
                            access_token: newSession.access_token,
                            refresh_token: newSession.refresh_token,
                            expires_at: Math.floor(Date.now() / 1000) + newSession.expires_in,
                        }
                    }));

                    processQueue(null, newSession.access_token);

                    originalRequest.headers.Authorization = `Bearer ${newSession.access_token}`;
                    return api(originalRequest);
                } catch (refreshError) {
                    processQueue(refreshError, null);
                    // clear session if refresh fails
                    useAuthStore.getState().logout?.();
                    if (typeof window !== "undefined" && !isRedirecting) {
                        isRedirecting = true;
                        window.location.href = "/landing";
                    }
                    return Promise.reject(refreshError);
                } finally {
                    isRefreshing = false;
                }
            } else {
                processQueue(error, null);
                isRefreshing = false;
                // clear session if no refresh token
                useAuthStore.getState().logout?.();
                if (typeof window !== "undefined" && !isRedirecting) {
                    isRedirecting = true;
                    window.location.href = "/landing";
                }
            }
        } else if (error.response?.status === 401) {
            // For non-retryable 401s or if refresh also returns 401
            useAuthStore.getState().logout?.();
            if (typeof window !== "undefined" && !isRedirecting) {
                isRedirecting = true;
                window.location.href = "/landing";
            }
        }

        return Promise.reject(error);
    }
);

export default api;