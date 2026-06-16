'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Bell, BellRing, Check, CheckCheck } from 'lucide-react';
import { useNotificationStore } from '@/lib/zustand/notifications/notifications';
import { useAuthStore } from '@/lib/zustand/user/user';
import { AppNotification } from '@/lib/types/auth';

const TYPE_STYLE: Record<string, { icon: string; color: string }> = {
    task_assigned: { icon: '📋', color: 'text-blue-600' },
    submitted_for_review: { icon: '🔍', color: 'text-amber-600' },
    task_approved: { icon: '✅', color: 'text-green-600' },
    task_completed: { icon: '🎉', color: 'text-green-600' },
    task_rejected: { icon: '↩️', color: 'text-destructive' },
    onboarding_request: { icon: '👋', color: 'text-blue-600' },
};

function timeAgo(ts: string): string {
    const diff = (Date.now() - new Date(ts).getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}

/**
 * NotificationBell — pure UI component.
 *
 * Reads notification state from the store only. Does NOT set up any
 * realtime subscription or register any toast callback. That is done
 * once at the layout level via useNotificationSubscription (in ContentWrapper).
 *
 * This means it is safe to render this component in both the mobile header
 * and the desktop header simultaneously without causing double toasts.
 */
export function NotificationBell() {
    const { user } = useAuthStore();
    const {
        notifications, unreadCount,
        markAsRead, markAllRead, markAsUnread,
    } = useNotificationStore();

    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0 });
    const prevCountRef = useRef<number>(unreadCount);

    // Play sound when unread count increases
    useEffect(() => {
        if (unreadCount > prevCountRef.current) {
            try {
                const audio = new Audio('/noti.mp3');
                audio.volume = 1;
                audio.play().catch(() => { });
            } catch { }
        }
        prevCountRef.current = unreadCount;
    }, [unreadCount]);

    // Close dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleOpen = () => {
        if (!open && ref.current) {
            const rect = ref.current.getBoundingClientRect();
            setDropdownPos({
                top: rect.bottom + 8,
                right: window.innerWidth - rect.right,
            });
        }
        setOpen(o => !o);
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission().catch(() => { });
        }
    };

    const handleClick = (n: AppNotification) => {
        if (!n.is_read) markAsRead(n.id);
    };

    return (
        <div ref={ref} className="relative">
            {/* Bell button */}
            <button
                onClick={handleOpen}
                className="relative h-9 w-9 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
                aria-label="Notifications"
            >
                {unreadCount > 0
                    ? <BellRing className="h-5 w-5 text-primary animate-[wiggle_1s_ease-in-out]" />
                    : <Bell className="h-5 w-5 text-muted-foreground" />
                }
                {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] px-0.5 flex items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white leading-none">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown */}
            {open && (
                <div
                    style={{ top: dropdownPos.top, right: dropdownPos.right }}
                    className="fixed z-9999 w-[300px] sm:w-[360px] rounded-xl border border-border bg-card shadow-xl overflow-hidden"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/40">
                        <span className="text-sm font-semibold text-foreground">
                            Notifications {unreadCount > 0 && (
                                <span className="ml-1.5 text-[11px] font-bold text-primary">({unreadCount} new)</span>
                            )}
                        </span>
                        {unreadCount > 0 && (
                            <button
                                onClick={() => user?.id && markAllRead(user.id)}
                                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors"
                            >
                                <CheckCheck className="h-3.5 w-3.5" /> Mark all read
                            </button>
                        )}
                    </div>

                    {/* List */}
                    <div className="max-h-[440px] overflow-y-auto divide-y divide-border">
                        {notifications.length === 0 ? (
                            <div className="py-10 flex flex-col items-center gap-2 text-muted-foreground">
                                <Bell className="h-8 w-8 opacity-30" />
                                <p className="text-sm">No notifications yet</p>
                            </div>
                        ) : (
                            notifications.map(n => {
                                const style = TYPE_STYLE[n.type] || { icon: '🔔', color: 'text-foreground' };
                                return (
                                    <div
                                        key={n.id}
                                        onClick={() => handleClick(n)}
                                        className={`group flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors ${n.is_read
                                            ? 'bg-card hover:bg-muted/30'
                                            : 'bg-primary/5 hover:bg-primary/10'
                                            }`}
                                    >
                                        <div className="mt-1 h-8 w-8 rounded-full bg-muted/50 flex items-center justify-center text-base shrink-0 border border-border/50">
                                            {style.icon}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2">
                                                <p className={`text-sm leading-snug truncate ${n.is_read ? 'text-foreground/70' : 'text-foreground font-semibold'}`}>
                                                    {n.title}
                                                </p>
                                                {!n.is_read && <span className="h-2 w-2 rounded-full bg-primary shrink-0 shadow-sm" />}
                                            </div>
                                            {n.message && (
                                                <p className="text-xs text-muted-foreground mt-0.5 leading-snug line-clamp-2">
                                                    {n.message}
                                                </p>
                                            )}
                                            <div className="flex items-center justify-between mt-2">
                                                <p className="text-[10px] text-muted-foreground/60">{timeAgo(n.created_at)}</p>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        n.is_read ? markAsUnread(n.id) : markAsRead(n.id);
                                                    }}
                                                    className="text-[11px] font-medium text-primary flex items-center gap-1 hover:underline"
                                                >
                                                    <Check className="h-3 w-3" />
                                                    {n.is_read ? 'Mark as unread' : 'Mark as read'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
