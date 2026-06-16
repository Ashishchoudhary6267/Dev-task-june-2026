'use client';

import { useEffect, useRef } from 'react';
import { useNotificationStore } from '@/lib/zustand/notifications/notifications';
import { useAuthStore } from '@/lib/zustand/user/user';
import { AppNotification } from '@/lib/types/auth';
import { useToast } from '@/components/ui/toast';
import { useUpdateStore } from '@/lib/zustand/updates/updates';

/**
 * useNotificationSubscription
 *
 * Initialises the Supabase realtime subscription and toast handler for
 * the logged-in user. Must be called EXACTLY ONCE per session — place it
 * in a top-level layout component (e.g. ContentWrapper) so it never
 * remounts due to page navigation.
 *
 * NotificationBell UI components can be rendered anywhere without
 * re-triggering subscription or causing duplicate toasts.
 */
function getToastVariant(type: string): 'default' | 'success' | 'destructive' | 'warning' {
    switch (type) {
        case 'task_rejected': return 'destructive';
        case 'submitted_for_review': return 'warning';
        case 'task_approved':
        case 'task_completed': return 'success';
        default: return 'default';
    }
}

export function useNotificationSubscription() {
    const { user } = useAuthStore();
    const { fetchNotifications, subscribeRealtime } = useNotificationStore();
    const { addToast } = useToast();

    // Stable ref so the useEffect never re-runs due to addToast reference changes
    const callbackRef = useRef<(n: AppNotification) => void>(() => {});
    callbackRef.current = (n: AppNotification) => {
        addToast({
            title: n.title || 'New Notification',
            description: n.message || undefined,
            variant: getToastVariant(n.type),
        });

        useUpdateStore.getState().setHasUpdates(true);

        if ('Notification' in window && Notification.permission === 'granted') {
            const systemNotif = new Notification(n.title || 'New Notification', {
                body: n.message || 'You have a new update.',
                icon: '/logo.png',
            });
            systemNotif.onclick = () => { window.focus(); systemNotif.close(); };
        }

        // Play sound
        try {
            const audio = new Audio('/noti.mp3');
            audio.volume = 1;
            audio.play().catch(() => { });
        } catch { }
    };

    const stableCallback = useRef((n: AppNotification) => callbackRef.current(n)).current;

    useEffect(() => {
        if (!user?.id) return;
        fetchNotifications(user.id);
        const unsub = subscribeRealtime(user.id, stableCallback);

        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission().catch(() => { });
        }

        return unsub;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id]);
}
