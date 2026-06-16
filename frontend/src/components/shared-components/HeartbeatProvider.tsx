'use client';

import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/lib/zustand/user/user';
import api from '@/lib/api';

const PING_INTERVAL_MS = 60_000; // 60 seconds

/**
 * HeartbeatProvider
 *
 * Mounts once in the root layout. When the user is authenticated it pings
 * POST /api/heartbeat every 30 s to keep `last_seen_at` and `is_online`
 * up-to-date in the database.
 *
 * Uses the shared `api` axios instance which automatically attaches the
 * Bearer token via its request interceptor — no manual token handling needed.
 */
export function HeartbeatProvider() {
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
    const userId = useAuthStore((s) => s.user?.id);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        // Only run when the user is signed in
        if (!isAuthenticated || !userId) return;

        const ping = () => {
            api.post('/heartbeat').catch(() => {
                // Silent fail — losing a single heartbeat is not fatal
            });
        };

        // Send an immediate ping on mount / login
        ping();

        // Then send every 30 seconds
        intervalRef.current = setInterval(ping, PING_INTERVAL_MS);

        // Also ping on visibility change (tab becomes active again)
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') ping();
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [isAuthenticated, userId]);

    // This component renders nothing — it is a pure side-effect provider
    return null;
}
