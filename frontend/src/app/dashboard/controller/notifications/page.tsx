'use client';

import React, { useEffect, useState } from 'react';
import { Button, Label, UISelect } from '@/components/ui';
import {
    Bell, Send, Settings, Clock,
    CheckCircle2, XCircle, ClipboardList,
    Search, Eye, EyeOff, RefreshCw, UserCircle2,
    Info, List, Activity, BellRing, Flag,
    Flame,
    MinusCircle,
    ArrowDownCircle,
    Timer,
    Save,
    Play
} from 'lucide-react';
import { useNotificationStore } from '@/lib/zustand/notifications/notifications';
import { useAuthStore } from '@/lib/zustand/user/user';
import { useUserStore } from '@/lib/zustand/user/addUser';
import { useTatSettingsStore } from '@/lib/zustand/tat-settings/tat-settings';
import api from '@/lib/api';
import { MultiUserSelect, UserSelect } from '@/components/ui/user-select';
import { useToastStore } from '@/lib/zustand/toast-store';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_META: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
    task_assigned: { label: 'Task Assigned', icon: <ClipboardList className="h-3.5 w-3.5" />, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
    submitted_for_review: { label: 'Submitted for Review', icon: <Eye className="h-3.5 w-3.5" />, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' },
    task_approved: { label: 'Task Approved', icon: <CheckCircle2 className="h-3.5 w-3.5" />, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' },
    task_rejected: { label: 'Task Rejected', icon: <XCircle className="h-3.5 w-3.5" />, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20' },
    task_completed: { label: 'Task Completed', icon: <CheckCircle2 className="h-3.5 w-3.5" />, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' },
    task: { label: 'Task', icon: <ClipboardList className="h-3.5 w-3.5" />, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
    approval: { label: 'Approval', icon: <CheckCircle2 className="h-3.5 w-3.5" />, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' },
    client: { label: 'Client', icon: <UserCircle2 className="h-3.5 w-3.5" />, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20' },
    meeting: { label: 'Meeting', icon: <Clock className="h-3.5 w-3.5" />, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' },
};

const DEFAULT_META = { label: 'Notification', icon: <Bell className="h-3.5 w-3.5" />, color: 'text-muted-foreground', bg: 'bg-muted' };

function timeAgo(ts: string) {
    const diff = (Date.now() - new Date(ts).getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}

type Tab = 'history' | 'send' | 'settings';

export default function ControllerNotifications() {
    const [tab, setTab] = useState<Tab>('history');
    const { user } = useAuthStore();
    const { notifications, unreadCount, loading, fetchAllNotifications, markAsRead, markAllRead, markAsUnread, subscribeRealtime } =
        useNotificationStore();
    const { users, fetchUsers } = useUserStore();

    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');

    const [form, setForm] = useState<{ title: string; message: string; recipients: string[]; type: string; priority: string; method: string }>({
        title: '', message: '', recipients: [], type: '', priority: '', method: 'in_app'
    });
    const [sending, setSending] = useState(false);
    const [sendSuccess, setSendSuccess] = useState(false);

    const [notificationSettings, setNotificationSettings] = useState<any>(null);
    const { tatSettings, fetchTatSettings, updateTatSettings, loading: tatLoading } = useTatSettingsStore();
    const [tatHoursInput, setTatHoursInput] = useState<number>(4);
    const { addToast } = useToastStore();

    useEffect(() => {
        if (tab === 'settings' && !notificationSettings) {
            api.get('/companies/notification-settings').then(res => {
                setNotificationSettings(res.data);
            }).catch(console.error);
        }
        if (tab === 'settings') {
            fetchTatSettings();
        }
    }, [tab, notificationSettings]);

    useEffect(() => {
        if (tatSettings?.tat_review_deadline_hours) {
            setTatHoursInput(tatSettings.tat_review_deadline_hours);
        }
    }, [tatSettings]);

    const handleTatSave = async () => {
        const success = await updateTatSettings(tatHoursInput);
        if (success) {
            addToast({ title: 'TAT settings saved', description: `Review window set to ${tatHoursInput} working hours.`, variant: 'default' });
        } else {
            addToast({ title: 'Failed to save', description: 'Please try again.', variant: 'destructive' });
        }
    };

    const [runNowLoading, setRunNowLoading] = useState(false);
    const [runNowResult, setRunNowResult] = useState<{ processed: number; skipped: number } | null>(null);

    const handleRunNow = async () => {
        setRunNowLoading(true);
        setRunNowResult(null);
        try {
            const res = await api.post('/internal/check-overdue-tasks', {}, {
                headers: { 'x-cron-secret': process.env.NEXT_PUBLIC_CRON_SECRET || '' }
            });
            setRunNowResult(res.data);
            addToast({ title: 'Overdue check complete', description: `Processed: ${res.data.processed}, Skipped: ${res.data.skipped}`, variant: 'default' });
        } catch (err: any) {
            addToast({ title: 'Failed to run check', description: err?.response?.data?.message || 'Unauthorized or server error', variant: 'destructive' });
        } finally {
            setRunNowLoading(false);
        }
    };

    const handleSettingToggle = async (key: string, newVal: boolean) => {
        setNotificationSettings((prev: any) => ({ ...prev, [key]: newVal }));
        try {
            await api.patch('/companies/notification-settings', { [key]: newVal });
        } catch (error) {
            console.error('Failed to update setting', error);
            setNotificationSettings((prev: any) => ({ ...prev, [key]: !newVal }));
        }
    };

    useEffect(() => {
        fetchAllNotifications();
        fetchUsers();
        if (user?.id) {
            const unsub = subscribeRealtime(user.id);
            return unsub;
        }
    }, [user?.id]);

    const filtered = notifications.filter(n => {
        const matchSearch =
            n.title.toLowerCase().includes(search.toLowerCase()) ||
            n.message?.toLowerCase().includes(search.toLowerCase()) ||
            (n as any).recipient?.name?.toLowerCase().includes(search.toLowerCase());
        const matchType = typeFilter === 'all' || n.type === typeFilter;
        return matchSearch && matchType;
    });

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.title || !form.message || form.recipients.length === 0) return;
        setSending(true);
        try {
            await api.post('/notifications/send', {
                user_ids: form.recipients,
                type: form.type || 'task',
                title: form.title,
                message: form.message,
            });
            setSendSuccess(true);
            setForm({ title: '', message: '', recipients: [], type: '', priority: '', method: 'in_app' });
            setTimeout(() => { setSendSuccess(false); fetchAllNotifications(); }, 2500);
        } catch {
            // silent
        } finally {
            setSending(false);
        }
    };

    const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
        { key: 'history', label: 'Notification History', icon: <Clock className="h-3.5 w-3.5" /> },
        { key: 'send', label: 'Send Notification', icon: <Send className="h-3.5 w-3.5" /> },
        { key: 'settings', label: 'Settings', icon: <Settings className="h-3.5 w-3.5" /> },
    ];

    return (
        <div className="min-h-screen bg-background p-6">

            {/* ── Header ── */}
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Bell className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-base font-semibold text-foreground leading-tight">Notifications</h1>
                        <p className="text-sm text-muted-foreground">Manage team communications</p>
                    </div>
                </div>
                {unreadCount > 0 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-sm font-medium bg-primary text-primary-foreground">
                        {unreadCount} unread
                    </span>
                )}
            </div>

            {/* ── Tabs ── */}
            <div className="flex gap-0.5 bg-muted/50 p-1 rounded-lg mb-5 w-full overflow-x-auto  custom-scrollbar">
                {tabs.map(t => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${tab === t.key
                            ? 'bg-background text-foreground shadow-sm border border-border/50'
                            : 'text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        {t.icon}
                        {t.label}
                    </button>
                ))}
            </div>

            {/* ── TAB: History ── */}
            {tab === 'history' && (
                <div>
                    {/* Toolbar */}
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                        <div className="relative flex-1 min-w-[200px] max-w-sm">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <input
                                className="w-full pl-8 pr-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-border"
                                placeholder="Search by title, message, or recipient…"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>
                        <UISelect
                            value={typeFilter}
                            onValueChange={(val) => setTypeFilter(val)}
                            className="min-w-[160px] text-sm"
                            options={[
                                { value: 'all', label: 'All Types', icon: List },
                                { value: 'task_assigned', label: 'Task Assigned', icon: ClipboardList },
                                { value: 'submitted_for_review', label: 'Submitted for Review', icon: Eye },
                                { value: 'task_approved', label: 'Task Approved', icon: CheckCircle2 },
                                { value: 'task_rejected', label: 'Task Rejected', icon: XCircle },
                                { value: 'task_completed', label: 'Task Completed', icon: CheckCircle2 },
                                { value: 'task', label: 'Task (manual)', icon: ClipboardList },
                                { value: 'approval', label: 'Approval (manual)', icon: CheckCircle2 },
                                { value: 'client', label: 'Client (manual)', icon: UserCircle2 },
                                { value: 'meeting', label: 'Meeting (manual)', icon: Clock },
                            ]}
                        />
                        <button
                            onClick={() => fetchAllNotifications()}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-muted transition-colors text-muted-foreground"
                        >
                            <RefreshCw className="h-3.5 w-3.5" /> Refresh
                        </button>
                        <button
                            onClick={() => markAllRead(user?.id || '')}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-muted transition-colors text-muted-foreground"
                        >
                            <EyeOff className="h-3.5 w-3.5" /> Mark all read
                        </button>
                    </div>

                    {/* List */}
                    <div className="rounded-xl border border-border overflow-hidden bg-card">
                        {loading ? (
                            <div className="py-12 text-center text-muted-foreground text-sm">Loading…</div>
                        ) : filtered.length === 0 ? (
                            <div className="py-12 text-center">
                                <Bell className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                                <p className="text-sm text-muted-foreground">No notifications found.</p>
                            </div>
                        ) : (
                            <ul className="divide-y divide-border">
                                {filtered.map(n => {
                                    const meta = TYPE_META[n.type] ?? DEFAULT_META;
                                    const recipientName = (n as any).recipient?.name;
                                    const senderName = (n as any).sender?.name;
                                    return (
                                        <li key={n.id} className={`flex items-start gap-3 px-4 py-3 transition-colors ${!n.is_read ? 'bg-primary/5' : ''}`}>
                                            <div className={`shrink-0 mt-0.5 h-7 w-7 rounded-full flex items-center justify-center ${meta.bg}`}>
                                                <span className={meta.color}>{meta.icon}</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                                                    <span className={`text-[14px] font-medium px-1.5 py-0.5 rounded-full ${meta.bg} ${meta.color}`}>
                                                        {meta.label}
                                                    </span>
                                                    {!n.is_read && <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
                                                </div>
                                                <p className="text-sm font-medium text-foreground">{n.title}</p>
                                                {n.message && (
                                                    <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{n.message}</p>
                                                )}
                                                <div className="flex items-center gap-3 mt-1 flex-wrap">
                                                    {recipientName && (
                                                        <span className="flex items-center gap-1 text-[14px] text-muted-foreground">
                                                            <UserCircle2 className="h-3 w-3" />
                                                            To: <span className="font-medium text-foreground">{recipientName}</span>
                                                        </span>
                                                    )}
                                                    {senderName ? (
                                                        <span className="flex items-center gap-1 text-[14px] text-muted-foreground">
                                                            <Send className="h-3 w-3" />
                                                            By: <span className="font-medium text-foreground">{senderName}</span>
                                                        </span>
                                                    ) : (
                                                        <span className="text-[14px] text-muted-foreground italic">System</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-1.5 shrink-0">
                                                <span className="text-[14px] text-muted-foreground whitespace-nowrap">{timeAgo(n.created_at)}</span>
                                                {!n.is_read ? (
                                                    <button onClick={() => markAsRead(n.id)} className="text-[14px] text-primary hover:underline flex items-center gap-0.5">
                                                        <EyeOff className="h-3 w-3" /> Read
                                                    </button>
                                                ) : (
                                                    <button onClick={() => markAsUnread(n.id)} className="text-[14px] text-primary hover:underline flex items-center gap-0.5">
                                                        <Eye className="h-3 w-3" /> Unread
                                                    </button>
                                                )}
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                        <div className="px-4 py-2 border-t border-border bg-muted/20 text-[14px] text-muted-foreground">
                            {filtered.length} of {notifications.length} notifications
                        </div>
                    </div>
                </div>
            )}

            {/* ── TAB: Send ── */}
            {tab === 'send' && (
                <div className="max-w-full">
                    <div className="rounded-xl border border-border bg-card overflow-hidden">
                        <div className="px-5 py-4 border-b border-border">
                            <h2 className="text-md font-semibold text-foreground">Send notification</h2>
                            <p className="text-sm text-muted-foreground mt-0.5">Compose and deliver a message to team members</p>
                        </div>

                        <form onSubmit={handleSend} className="px-5 py-4 space-y-4">
                            {sendSuccess && (
                                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-sm border border-green-200 dark:border-green-800">
                                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> Notification sent successfully!
                                </div>
                            )}

                            {/* Title */}
                            <div className="space-y-1.5">
                                <label className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                    Title <span className="text-red-500">*</span>
                                </label>
                                <input
                                    className="w-full px-3 py-2 text-md border border-border rounded-lg bg-muted/30 focus:bg-background focus:outline-none focus:ring-1 focus:ring-border transition-colors placeholder:text-muted-foreground/50"
                                    placeholder="e.g. Task deadline reminder"
                                    value={form.title}
                                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                                    required
                                />
                            </div>

                            {/* Message */}
                            <div className="space-y-1.5">
                                <label className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                    Message <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    rows={3}
                                    className="w-full px-3 py-2 text-md border border-border rounded-lg bg-muted/30 focus:bg-background focus:outline-none focus:ring-1 focus:ring-border resize-none transition-colors placeholder:text-muted-foreground/50"
                                    placeholder="Write your notification message…"
                                    value={form.message}
                                    onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                                    required
                                />
                            </div>

                            {/* Recipients */}
                            <div className="space-y-1.5">
                                <label className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                    Recipients <span className="text-red-500">*</span>
                                </label>
                                <div className="border border-border rounded-lg bg-muted/30 p-2 min-h-[42px]">
                                    <MultiUserSelect
                                        users={users.filter((u: any) => u.platform_role === 'member')}
                                        selectedUsers={form.recipients}
                                        onSelect={(user) => setForm(f => ({ ...f, recipients: [...f.recipients, user.id] }))}
                                        onRemove={(user) => setForm(f => ({ ...f, recipients: f.recipients.filter(r => r !== user.id) }))}
                                    />
                                </div>
                                {form.recipients.length === 0 && (
                                    <p className="text-[14px] text-red-500">Select at least one recipient</p>
                                )}
                            </div>

                            {/* Divider */}
                            <div className="border-t border-border" />

                            {/* Type + Priority + Method */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className="space-y-1.5">
                                    <label className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Type</label>
                                    <UISelect
                                        value={['task', 'approval', 'client', 'meeting', ''].includes(form.type) ? form.type : 'other'}
                                        onValueChange={(val) => setForm(f => ({ ...f, type: val }))}
                                        className="w-full"
                                        placeholder="Select type"
                                        options={[
                                            { value: 'task', label: 'Task', icon: ClipboardList },
                                            { value: 'approval', label: 'Approval', icon: CheckCircle2 },
                                            { value: 'client', label: 'Client', icon: UserCircle2 },
                                            { value: 'meeting', label: 'Meeting', icon: Clock },
                                            { value: 'other', label: 'Other', icon: BellRing },
                                        ]}
                                    />
                                    {(!['task', 'approval', 'client', 'meeting', ''].includes(form.type) || form.type === 'other') && (
                                        <input
                                            type="text"
                                            className="w-full mt-1 px-2.5 py-1.5 text-sm border border-border rounded-lg bg-muted/30 focus:outline-none focus:ring-1 focus:ring-border"
                                            placeholder="Specify type"
                                            value={form.type === 'other' ? '' : form.type}
                                            onChange={e => setForm(f => ({ ...f, type: e.target.value || 'other' }))}
                                        />
                                    )}
                                </div>
                                <div className="space-y-1.5">
                                    <label className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Priority</label>
                                    <UISelect
                                        value={form.priority}
                                        onValueChange={(val) => setForm(f => ({ ...f, priority: val }))}
                                        className="w-full"
                                        placeholder="Priority"
                                        options={[
                                            { value: 'high', label: 'High', icon: Flame },          // urgent / critical
                                            { value: 'normal', label: 'Normal', icon: MinusCircle },// neutral / standard
                                            { value: 'low', label: 'Low', icon: ArrowDownCircle },  // low importance
                                        ]}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Method</label>
                                    <UISelect
                                        value={form.method}
                                        onValueChange={(val) => setForm(f => ({ ...f, method: val }))}
                                        className="w-full"
                                        placeholder="Method"
                                        options={[
                                            { value: 'in_app', label: 'In-App', icon: Activity },
                                        ]}
                                    />
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="flex items-center justify-between pt-1">
                                <span className="text-[11px] text-muted-foreground">{form.message.length} / 500 characters</span>
                                <button
                                    type="submit"
                                    disabled={sending || !form.title || !form.message || form.recipients.length === 0}
                                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-foreground text-background rounded-lg hover:opacity-85 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <Send className="h-3.5 w-3.5" />
                                    {sending ? 'Sending…' : 'Send notification'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── TAB: Settings ── */}
            {tab === 'settings' && (
                <div className="flex flex-col lg:flex-row gap-6 items-start animate-in fade-in slide-in-from-bottom-2 duration-500">
                    {/* Primary Preferences */}
                    <div className="flex-1 w-full max-w-3xl">
                        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
                            <div className="px-6 py-5 border-b border-border bg-muted/20">
                                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                                    <BellRing className="h-4 w-4 text-primary" />
                                    Notification Preferences
                                </h2>
                                <p className="text-sm text-muted-foreground mt-1">Configure which events should trigger a system-wide broadcast</p>
                            </div>
                            <div className="divide-y divide-border/60">
                                {[
                                    { settingKey: 'task_assigned', label: 'Task Assigned', desc: 'Broadcast to members when a new task is allocated to them.', icon: ClipboardList, defaultOn: true },
                                    { settingKey: 'task_submitted', label: 'Submitted for Review', desc: 'Alert controllers when a task is ready for final verification.', icon: Eye, defaultOn: true },
                                    { settingKey: 'task_approved', label: 'Task Approved', desc: 'Notify the assignee when their work has been officially accepted.', icon: CheckCircle2, defaultOn: false },
                                    { settingKey: 'task_rejected', label: 'Task Rejected', desc: 'Immediate notification if a task fails verification checks.', icon: XCircle, defaultOn: true },
                                    { settingKey: 'task_completed', label: 'Task Completed', desc: 'System-wide update when a task instance reaches terminal state.', icon: CheckCircle2, defaultOn: true },
                                ].map(setting => (
                                    <ToggleSetting 
                                        key={setting.label} 
                                        {...setting} 
                                        value={notificationSettings?.[setting.settingKey] ?? setting.defaultOn}
                                        onChange={(val) => handleSettingToggle(setting.settingKey, val)}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Additional Info Footer */}
                        <div className="mt-6 p-4 rounded-xl bg-blue-50/50 border border-blue-100 flex gap-3 text-blue-800 text-xs leading-relaxed">
                            <Info className="h-4 w-4 shrink-0 text-blue-600" />
                            <p>
                                <strong>Pro-Tip:</strong> These settings apply to the entire team. To manage your individual account notification sounds or email alerts, visit your profile settings.
                            </p>
                        </div>

                        {/* TAT Review Window Card */}
                        <div className="mt-6 rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
                            <div className="px-6 py-5 border-b border-border bg-muted/20">
                                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                                    <Timer className="h-4 w-4 text-primary" />
                                    TAT Extension Review Window
                                </h2>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Time (in working hours) a controller has to act on an auto-generated TAT extension request before it's flagged as overdue.
                                </p>
                            </div>
                            <div className="px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                                <div className="flex items-center gap-3 flex-1">
                                    <label className="text-sm font-medium text-foreground whitespace-nowrap">Review window:</label>
                                    <input
                                        type="number"
                                        min={1}
                                        max={168}
                                        value={tatHoursInput}
                                        onChange={e => setTatHoursInput(parseInt(e.target.value) || 4)}
                                        className="w-24 px-3 py-2 text-sm border border-border rounded-lg bg-muted/30 focus:bg-background focus:outline-none focus:ring-1 focus:ring-border"
                                    />
                                    <span className="text-sm text-muted-foreground">working hours</span>
                                </div>
                                <button
                                    onClick={handleTatSave}
                                    disabled={tatLoading}
                                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                                >
                                    <Save className="h-3.5 w-3.5" />
                                    {tatLoading ? 'Saving…' : 'Save'}
                                </button>
                            </div>
                            <div className="px-6 pb-5 flex items-center justify-between flex-wrap gap-3">
                                <p className="text-xs text-muted-foreground">
                                    ⚠️ Excludes weekends and company holidays. Min: 1 hour, Max: 168 hours (1 week). Current: <strong>{tatSettings?.tat_review_deadline_hours ?? 4} hours</strong>.
                                </p>
                                <button
                                    onClick={handleRunNow}
                                    disabled={runNowLoading}
                                    title="Manually trigger the overdue check now (same as the 5-min cron)"
                                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50 text-muted-foreground"
                                >
                                    <Play className="h-3 w-3" />
                                    {runNowLoading ? 'Running check…' : 'Run Check Now'}
                                </button>
                                {runNowResult && (
                                    <p className="w-full text-xs text-green-600 font-medium">
                                        ✓ Done — {runNowResult.processed} request(s) created, {runNowResult.skipped} skipped (already pending).
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Secondary Info Panel (Desktop Only) */}
                    <div className="hidden lg:block w-80 shrink-0 space-y-4">
                        <div className="rounded-2xl border border-border bg-muted/10 p-5">
                            <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                                <Activity className="h-4 w-4 text-primary" />
                                Delivery Status
                            </h3>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground">In-App Delivery</span>
                                    <span className="font-bold text-green-600">Active</span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground">Email Fallback</span>
                                    <span className="font-bold text-muted-foreground/50">Disabled</span>
                                </div>
                                <div className="pt-3 border-t border-border/50">
                                    <p className="text-[10px] text-muted-foreground leading-tight italic">
                                        All broadcasts are being delivered in near real-time.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-dashed border-border p-5 text-center">
                            <Bell className="h-8 w-8 mx-auto text-muted-foreground/20 mb-2" />
                            <p className="text-[11px] text-muted-foreground">Need help with notification templates? Contact support for custom integration options.</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function ToggleSetting({ label, desc, icon: Icon, value, onChange }: { label: string; desc: string; icon: any; value: boolean; onChange: (v: boolean) => void }) {
    return (
        <div className="flex items-center justify-between gap-6 px-6 py-4 hover:bg-muted/5 transition-colors group">
            <div className="flex items-start gap-4">
                <div className={`mt-0.5 h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${value ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                    <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">{label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{desc}</p>
                </div>
            </div>
            <button
                onClick={() => onChange(!value)}
                className={`relative shrink-0 h-6 w-11 rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-primary/20 ${value ? 'bg-primary shadow-[0_0_15px_rgba(var(--primary-rgb),0.3)]' : 'bg-muted-foreground/20'}`}
            >
                <span className={`absolute top-1 left-1 h-4 w-4 rounded-full bg-white shadow-md transition-all duration-300 ${value ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
        </div>
    );
}