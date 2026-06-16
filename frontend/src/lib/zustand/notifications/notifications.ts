'use client';

import { create } from 'zustand';
import { createClient, RealtimeChannel } from '@supabase/supabase-js';
import api from '@/lib/api';
import { AppNotification } from '@/lib/types/auth';

// ── Singleton Supabase client for Realtime (anon key, browser-side) ──────────
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface NotificationState {
    notifications: AppNotification[];
    unreadCount: number;
    loading: boolean;

    fetchNotifications: (userId: string) => Promise<void>;
    fetchAllNotifications: () => Promise<void>;
    markAsRead: (id: string) => Promise<void>;
    markAllRead: (userId: string) => Promise<void>;
    subscribeRealtime: (userId: string, onNewNotification?: (n: AppNotification) => void) => () => void;
    markAsUnread: (id: string) => Promise<void>;
}

// Internal tracking for singleton subscription
let activeChannel: RealtimeChannel | null = null;
let currentSubscribedUserId: string | null = null;
const listeners = new Set<(n: AppNotification) => void>();

export const useNotificationStore = create<NotificationState>((set, get) => ({
    notifications: [],
    unreadCount: 0,
    loading: false,

    fetchNotifications: async (userId) => {
        set({ loading: true });
        try {
            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(20);

            if (!error && data) {
                const unread = (data as AppNotification[]).filter((n: AppNotification) => !n.is_read).length;
                set({ notifications: data as AppNotification[], unreadCount: unread, loading: false });
            } else {
                set({ loading: false });
            }
        } catch {
            set({ loading: false });
        }
    },

    fetchAllNotifications: async () => {
        set({ loading: true });
        try {
            const { data } = await api.get('/notifications/all');
            set({ notifications: data as AppNotification[], loading: false });
        } catch {
            set({ loading: false });
        }
    },

    markAsRead: async (id) => {
        await supabase.from('notifications').update({ is_read: true }).eq('id', id);
        set(s => {
            const updated = s.notifications.map(n => n.id === id ? { ...n, is_read: true } : n);
            return { notifications: updated, unreadCount: updated.filter(n => !n.is_read).length };
        });
    },

    markAsUnread: async (id) => {
        await supabase.from('notifications').update({ is_read: false }).eq('id', id);
        set(s => {
            const updated = s.notifications.map(n => n.id === id ? { ...n, is_read: false } : n);
            return { notifications: updated, unreadCount: updated.filter(n => !n.is_read).length };
        });
    },

    markAllRead: async (userId) => {
        await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false);
        set(s => ({
            notifications: s.notifications.map(n => ({ ...n, is_read: true })),
            unreadCount: 0,
        }));
    },

    subscribeRealtime: (userId, onNewNotification) => {
        // 1. Manage listeners
        if (onNewNotification) listeners.add(onNewNotification);

        // 2. If already subscribed to THIS user, just return cleanup for the listener
        if (activeChannel && currentSubscribedUserId === userId) {
            return () => {
                if (onNewNotification) listeners.delete(onNewNotification);
                // We keep the channel alive as long as someone is using it
            };
        }

        // 3. If subscribed to a DIFFERENT user, cleanup first
        if (activeChannel) {
            supabase.removeChannel(activeChannel);
            activeChannel = null;
            currentSubscribedUserId = null;
        }

        // 4. Create new singleton channel
        currentSubscribedUserId = userId;
        const channel = supabase
            .channel(`notifications:${userId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${userId}`,
                },
                (payload) => {
                    const newNotif = payload.new as AppNotification;
                    
                    // Update the global store state (only once!)
                    set(s => ({
                        notifications: [newNotif, ...s.notifications].slice(0, 50),
                        unreadCount: s.unreadCount + 1,
                    }));

                    // Execute all registered UI callbacks (toasts, sounds, etc.)
                    listeners.forEach(cb => cb(newNotif));
                }
            )
            .subscribe((status) => {
                console.log(`Supabase Realtime Status for ${userId}:`, status);
            });

        activeChannel = channel;

        return () => {
            if (onNewNotification) listeners.delete(onNewNotification);
            
            // Cleanup the actual channel only when the LAST listener unmounts
            if (listeners.size === 0 && activeChannel) {
                supabase.removeChannel(activeChannel);
                activeChannel = null;
                currentSubscribedUserId = null;
            }
        };
    },
}));
