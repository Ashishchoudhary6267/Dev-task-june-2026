'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useManualTaskStore } from '@/lib/zustand/tasks/manual-tasks';
import { useUserStore } from '@/lib/zustand/user/addUser';
import { useAuthStore } from '@/lib/zustand/user/user';
import { useToast } from '@/components/ui/toast';
import { ManualTask } from '@/lib/types/auth';
import { Button, Input, Label, UISelect } from '@/components/ui';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
    ClipboardList, Plus, Search, Eye, Pencil, Trash2, AlertCircle,
    Clock, CheckCircle2, Loader2, ChevronDown, User, X,
    Flag, UserCircle, ArrowUpDown, Hash, SlidersHorizontal, ChevronUp,
} from 'lucide-react';
import ViewModal from '@/components/ManualTasksmodal/Details';
import TaskModal from '@/components/ManualTasksmodal/createandedit';
import Loader from '@/components/ui/loader';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PRIORITY_STYLES: Record<string, string> = {
    low: 'bg-blue-50 text-blue-700 border border-blue-200',
    medium: 'bg-amber-50 text-amber-700 border border-amber-200',
    high: 'bg-red-50 text-red-700 border border-red-200',
};

const STATUS_STYLES: Record<string, { cls: string; icon: React.ReactNode; label: string }> = {
    IN_PROGRESS: { cls: 'bg-sky-50 text-sky-700 border border-sky-200', icon: <Loader2 className="h-3 w-3 animate-spin" />, label: 'In Progress' },
    PENDING_APPROVAL: { cls: 'bg-purple-50 text-purple-700 border border-purple-200', icon: <Clock className="h-3 w-3" />, label: 'Pending Approval' },
    COMPLETED: { cls: 'bg-green-50 text-green-700 border border-green-200', icon: <CheckCircle2 className="h-3 w-3" />, label: 'Completed' },
};

function getTimeRemaining(due_date?: string | null): string {
    if (!due_date) return '—';
    const diff = new Date(due_date).getTime() - Date.now();
    if (diff <= 0) return <span className="text-red-500 font-medium">Overdue</span> as any;
    const hours = Math.floor(diff / 3600000);
    if (hours < 24) return `${hours}h left`;
    return `${Math.floor(hours / 24)}d left`;
}

function isOverdue(task: ManualTask): boolean {
    if (task.status === 'COMPLETED') return false;
    if (!task.due_date) return false;
    return new Date(task.due_date) < new Date();
}

const TABS = ['All', 'In Progress', 'Pending Approval', 'Completed'] as const;
type Tab = typeof TABS[number];

export default function ManualTasksPage() {
    const { users, fetchUsers } = useUserStore();
    const { manualTasks, loading, fetchManualTasks, deleteManualTask } = useManualTaskStore();
    const { addToast } = useToast();

    const [activeTab, setActiveTab] = useState<Tab>('All');
    const [search, setSearch] = useState('');
    const [filterPriority, setFilterPriority] = useState('all');
    const [filterAssignee, setFilterAssignee] = useState('all');
    const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
    const [filterOpen, setFilterOpen] = useState(false);

    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' | null }>({ key: '', direction: null });

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' | null = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        } else if (sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = null;
        }
        setSortConfig({ key, direction });
    };

    const [createOpen, setCreateOpen] = useState(false);
    const [editTask, setEditTask] = useState<ManualTask | null>(null);
    const [viewTask, setViewTask] = useState<ManualTask | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    const {user}= useAuthStore();   

    const companyId = user?.company_id || '';

    useEffect(() => {
        if (companyId) {
            fetchManualTasks(companyId);
            fetchUsers();
        }
    }, [companyId]);


         const isManager= user?.workflow_role === 'interim_manager';


    // Stats
    const stats = useMemo(() => ({
        total: manualTasks.length,
        inProgress: manualTasks.filter(t => t.status === 'IN_PROGRESS').length,
        pending: manualTasks.filter(t => t.status === 'PENDING_APPROVAL').length,
        completed: manualTasks.filter(t => t.status === 'COMPLETED').length,
        overdue: manualTasks.filter(isOverdue).length,
    }), [manualTasks]);

    // Filtered list
    const filtered = useMemo(() => {
        let list = [...manualTasks];

        if (activeTab === 'In Progress') list = list.filter(t => t.status === 'IN_PROGRESS');
        else if (activeTab === 'Pending Approval') list = list.filter(t => t.status === 'PENDING_APPROVAL');
        else if (activeTab === 'Completed') list = list.filter(t => t.status === 'COMPLETED');

        if (search) {
            const q = search.toLowerCase();
            list = list.filter(t =>
                t.title.toLowerCase().includes(q) ||
                (t.assigned_user?.name?.toLowerCase().includes(q) ?? false)
            );
        }
        if (filterPriority !== 'all') list = list.filter(t => t.priority === filterPriority);
        if (filterAssignee !== 'all') list = list.filter(t => t.assigned_user_id === filterAssignee);

        if (sortConfig.key && sortConfig.direction) {
            list.sort((a: any, b: any) => {
                let aValue = a[sortConfig.key];
                let bValue = b[sortConfig.key];

                if (sortConfig.key === 'assigned_user') {
                    aValue = a.assigned_user?.name || '';
                    bValue = b.assigned_user?.name || '';
                }

                if (typeof aValue === 'string') aValue = aValue.toLowerCase();
                if (typeof bValue === 'string') bValue = bValue.toLowerCase();

                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        } else {
            list.sort((a, b) => {
                const da = new Date(a.created_at || 0).getTime();
                const db = new Date(b.created_at || 0).getTime();
                return sortOrder === 'newest' ? db - da : da - db;
            });
        }

        return list;
    }, [manualTasks, activeTab, search, filterPriority, filterAssignee, sortOrder, sortConfig]);

    const handleDelete = async (id: string) => {
        const ok = await deleteManualTask(id);
        if (ok) addToast({ title: 'Task deleted', variant: 'success' });
        else addToast({ title: 'Failed to delete task', variant: 'destructive' });
        setDeleteConfirm(null);
    };

    const uniqueAssignees = useMemo(() => {
        const seen = new Map<string, string>();
        manualTasks.forEach(t => {
            if (t.assigned_user_id && t.assigned_user?.name) {
                seen.set(t.assigned_user_id, t.assigned_user.name);
            }
        });
        return Array.from(seen.entries());
    }, [manualTasks]);

    return (
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">

            {/* ── Header ─────────────────────────────────────────────── */}
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
                        <ClipboardList className="h-5 w-5 sm:h-6 sm:w-6 text-primary shrink-0" />
                        <span className="truncate">Manual Tasks</span>
                    </h1>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 hidden sm:block">
                        Create and manage ad-hoc tasks for team members
                    </p>
                </div>
                <Button disabled={isManager} size="sm" onClick={() => setCreateOpen(true)} className="shrink-0">
                    <Plus className="h-4 w-4 sm:mr-1.5" />
                    <span className="hidden sm:inline">Create Task</span>
                </Button>
            </div>

            {/* ── Stats ──────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
                {[
                    { label: 'Total', value: stats.total, icon: <ClipboardList className="h-4 w-4 text-muted-foreground" />, cls: 'text-foreground' },
                    { label: 'Pending', value: stats.pending, icon: <Clock className="h-4 w-4 text-blue-500" />, cls: 'text-blue-600' },
                    { label: 'In Progress', value: stats.inProgress, icon: <Loader2 className="h-4 w-4 text-amber-500" />, cls: 'text-amber-600' },
                    { label: 'Completed', value: stats.completed, icon: <CheckCircle2 className="h-4 w-4 text-green-500" />, cls: 'text-green-600' },
                    { label: 'Overdue', value: stats.overdue, icon: <AlertCircle className="h-4 w-4 text-red-500" />, cls: 'text-red-500', red: true },
                ].map(s => (
                    <div
                        key={s.label}
                        className={`rounded-xl border ${s.red ? 'border-red-100 bg-red-50/40' : 'border-border bg-card'} p-3 sm:p-4 space-y-1`}
                    >
                        <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-muted-foreground">
                            {s.icon}
                            <span className="truncate">{s.label}</span>
                        </div>
                        <p className={`text-xl sm:text-2xl font-bold ${s.cls}`}>{s.value}</p>
                    </div>
                ))}
            </div>

            {/* ── Tabs (horizontal scroll pill bar on mobile) ─────────── */}
            <div className="flex gap-1 border-b border-border overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
                {TABS.map(tab => {
                    const count =
                        tab === 'All' ? stats.total
                            : tab === 'In Progress' ? stats.inProgress
                                : tab === 'Pending Approval' ? stats.pending
                                    : stats.completed;
                    return (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`shrink-0 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-medium rounded-t-md border-b-2 transition-colors whitespace-nowrap ${activeTab === tab
                                ? 'border-primary text-primary bg-primary/5'
                                : 'border-transparent text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            {tab} ({count})
                        </button>
                    );
                })}
            </div>

            {/* ── Filters ────────────────────────────────────────────── */}
            <div className="space-y-2">
                {/* Row 1: search + mobile filter toggle */}
                <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            className="pl-9 h-9 text-sm"
                            placeholder="Search tasks or assignees..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                    {/* Mobile-only filter toggle */}
                    <button
                        onClick={() => setFilterOpen(v => !v)}
                        className={`sm:hidden flex items-center gap-1.5 h-9 px-3 rounded-lg border text-xs font-medium transition-colors shrink-0 ${filterOpen
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'border-border text-muted-foreground hover:text-foreground bg-card'
                            }`}
                    >
                        <SlidersHorizontal className="h-3.5 w-3.5" />
                        Filters
                    </button>
                    {/* Task count - desktop only */}
                    <span className="shrink-0 text-xs text-muted-foreground whitespace-nowrap hidden sm:inline">
                        {filtered.length} task{filtered.length !== 1 ? 's' : ''}
                    </span>
                </div>

                {/* Row 2: filter dropdowns — collapsible on mobile, always visible on sm+ */}
                <div className={`${filterOpen ? 'flex' : 'hidden sm:flex'} flex-col sm:flex-row gap-2 sm:gap-6  sm:items-center`}>
                    <UISelect
                        value={filterPriority}
                        onValueChange={(val) => setFilterPriority(val)}
                        className="w-full sm:w-[150px]"
                        placeholder="All Priorities"
                        options={[
                            { value: 'all', label: 'All Priorities', icon: Flag },
                            { value: 'low', label: 'Low', icon: Flag },
                            { value: 'medium', label: 'Medium', icon: Flag },
                            { value: 'high', label: 'High', icon: Flag },
                        ]}
                    />
                    <UISelect
                        value={filterAssignee}
                        onValueChange={(val) => setFilterAssignee(val)}
                        className="w-full sm:w-[170px]"
                        placeholder="All Assignees"
                        options={[
                            { value: 'all', label: 'All Assignees', icon: UserCircle },
                            ...uniqueAssignees.map(([id, name]) => ({
                                value: id,
                                label: name,
                                icon: UserCircle
                            }))
                        ]}
                    />
                    <UISelect
                        value={sortOrder}
                        onValueChange={(val) => setSortOrder(val as any)}
                        className="w-full sm:w-[150px] sm:ml-auto"
                        options={[
                            { value: 'newest', label: 'Newest First', icon: ArrowUpDown },
                            { value: 'oldest', label: 'Oldest First', icon: ArrowUpDown },
                        ]}
                    />
                </div>

                {/* Task count - mobile only */}
                <p className="text-[11px] text-muted-foreground sm:hidden">
                    {filtered.length} task{filtered.length !== 1 ? 's' : ''}
                </p>
            </div>

            {/* ── Task Cards  form small screens─────────────────────────────────────────── */}
            <div className='sm:hidden'>


                {loading ? (
                    <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
                        <Loader />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-14 text-muted-foreground rounded-xl border border-dashed border-border bg-card">
                        <ClipboardList className="h-10 w-10 mb-3 opacity-15" />
                        <p className="text-sm font-semibold">No tasks found</p>
                        <p className="text-xs mt-1 opacity-70">Create your first manual task using the button above</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
                        {filtered.map(task => {
                            const st = STATUS_STYLES[task.status] || STATUS_STYLES.IN_PROGRESS;
                            const pr = PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.medium;
                            const overdue = isOverdue(task);
                            return (
                                <div
                                    key={task.id}
                                    className={`relative flex flex-col rounded-xl border bg-card overflow-hidden transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${overdue ? 'border-red-200' : 'border-border'
                                        }`}
                                >
                                    {/* Top accent bar */}
                                    <div className={`h-1 w-full ${task.status === 'COMPLETED' ? 'bg-green-400' :
                                        task.status === 'PENDING_APPROVAL' ? 'bg-purple-400' :
                                            overdue ? 'bg-red-400 animate-pulse' : 'bg-sky-400'
                                        }`} />

                                    <div className="p-3 sm:p-4 flex flex-col gap-3 flex-1">
                                        {/* Title + priority */}
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                                <p className={`font-semibold text-sm leading-snug line-clamp-2 ${overdue ? 'text-red-600' : 'text-foreground'
                                                    }`}>
                                                    {task.title}
                                                </p>
                                                {task.approval_required && (
                                                    <span className="mt-1 text-[10px] text-purple-600 bg-purple-50 border border-purple-100 rounded px-1.5 py-0.5 inline-block">
                                                        {task.approval_levels} Approval{(task.approval_levels ?? 1) > 1 ? 's' : ''}
                                                    </span>
                                                )}
                                            </div>
                                            <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${pr}`}>
                                                {task.priority}
                                            </span>
                                        </div>

                                        {/* Status + time */}
                                        <div className="flex items-center justify-between gap-2">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${st.cls}`}>
                                                {st.icon}{st.label}
                                            </span>
                                            {task.status !== 'COMPLETED' && (
                                                <span className={`text-xs font-semibold flex items-center gap-1 ${overdue ? 'text-red-500' : 'text-amber-600'
                                                    }`}>
                                                    <Clock className="h-3 w-3" />
                                                    {getTimeRemaining(task.due_date)}
                                                </span>
                                            )}
                                            {task.status === 'COMPLETED' && (
                                                <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                                                    <CheckCircle2 className="h-3 w-3" /> Done
                                                </span>
                                            )}
                                        </div>

                                        <div className="border-t border-border/60" />

                                        {/* Assignee + actions */}
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                                    <User className="h-3.5 w-3.5 text-primary" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-medium text-xs truncate">{task.assigned_user?.name || '—'}</p>
                                                    <p className="text-[10px] text-muted-foreground truncate">{task.assigned_user?.email || ''}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-0.5 shrink-0">
                                                <button
                                                    onClick={() => setViewTask(task)}
                                                    className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                                                    title="View details"
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </button>
                                                {task.status !== 'COMPLETED' && (
                                                    <button
                                                        onClick={() => setEditTask(task)}
                                                        className="p-1.5 rounded-lg text-muted-foreground hover:text-amber-600 hover:bg-amber-50 transition-colors"
                                                        title="Edit task"
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => setDeleteConfirm(task.id)}
                                                    className="p-1.5 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
                                                    title="Delete task"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <div className="rounded-xl border border-border bg-card overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-16 text-muted-foreground text-sm gap-2">
                        <Loader />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-14 text-muted-foreground">
                        <ClipboardList className="h-10 w-10 mb-3 opacity-20" />
                        <p className="text-sm font-medium">No tasks found</p>
                        <p className="text-xs mt-1">Create your first manual task using the button above</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/40 border-b border-border">
                                <tr>
                                    {[
                                        { label: 'Task', key: 'title' },
                                        { label: 'Assigned To', key: 'assigned_user' },
                                        { label: 'Status', key: 'status' },
                                        { label: 'Priority', key: 'priority' },
                                    ].map(h => (
                                        <th
                                            key={h.key}
                                            className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider cursor-pointer hover:bg-muted/50 transition-colors group/th"
                                            onClick={() => handleSort(h.key)}
                                        >
                                            <div className="flex items-center gap-1.5">
                                                {h.label}
                                                <div className="text-muted-foreground/30 group-hover/th:text-primary transition-colors">
                                                    {sortConfig.key === h.key ? (
                                                        sortConfig.direction === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                                                    ) : <ArrowUpDown className="h-3 w-3" />}
                                                </div>
                                            </div>
                                        </th>
                                    ))}
                                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {filtered?.map(task => {
                                    const st = STATUS_STYLES[task.status] || STATUS_STYLES.IN_PROGRESS;
                                    const pr = PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.medium;
                                    const overdue = isOverdue(task);
                                    return (
                                        <tr key={task.id} className="hover:bg-muted/20 transition-colors">
                                            <td className="px-4 py-3.5">
                                                <p className={`font-medium ${overdue ? 'text-red-600' : 'text-foreground'}`}>{task.title}</p>
                                                {task.approval_required && (
                                                    <span className="text-[10px] text-purple-600 bg-purple-50 border border-purple-100 rounded px-1.5 py-0.5 mt-0.5 inline-block">
                                                        {task.approval_levels} Approval{(task.approval_levels ?? 1) > 1 ? 's' : ''}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3.5">
                                                <div className="flex items-center gap-2">
                                                    <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                                        <User className="h-3.5 w-3.5 text-primary" />
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-xs">{task.assigned_user?.name || '—'}</p>
                                                        <p className="text-[10px] text-muted-foreground">{task.assigned_user?.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3.5">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${st.cls}`}>
                                                    {st.icon}{st.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3.5">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${pr}`}>
                                                    {task.priority}
                                                </span>
                                            </td>
                                            {/* <td className="px-4 py-3.5">
                                                {task.due_date ? (
                                                    <div>
                                                        <p className={`text-xs font-medium ${overdue ? 'text-red-600' : ''}`}>
                                                            {new Date(task.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                        </p>
                                                    </div>
                                                ) : '—'}
                                            </td> */}
                                            {/* <td className="px-4 py-3.5">
                                                <div className="flex items-center gap-1">
                                                    {task.status !== 'COMPLETED' && (
                                                        <span className="h-1.5 w-1.5 rounded-full bg-current inline-block opacity-50" />
                                                    )}
                                                    <span className={`text-xs font-medium ${overdue ? 'text-red-500' : 'text-muted-foreground'}`}>
                                                        {task.status === 'COMPLETED' ? '—' : getTimeRemaining(task.due_date)}
                                                    </span>
                                                </div>
                                            </td> */}
                                            <td className="px-4 py-3.5">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button
                                                        onClick={() => setViewTask(task)}
                                                        className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors"
                                                        title="View details"
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </button>
                                                    {task.status !== 'COMPLETED' && (
                                                        <button
                                                            onClick={() => setEditTask(task)}
                                                            className="p-1.5 rounded-md text-muted-foreground hover:text-amber-600 hover:bg-amber-50 transition-colors"
                                                            title="Edit task"
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => setDeleteConfirm(task.id)}
                                                        className="p-1.5 rounded-md text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
                                                        title="Delete task"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Create / Edit Modal */}
            <TaskModal
                open={createOpen || !!editTask}
                onOpenChange={(v) => { if (!v) { setCreateOpen(false); setEditTask(null); } }}
                editTask={editTask}
                users={users}
                onSaved={() => fetchManualTasks(companyId)}
                companyId={companyId}
            />

            {/* View Modal */}
            <ViewModal task={viewTask} onClose={() => setViewTask(null)} />

            {/* Delete Confirmation */}
            <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
                <DialogContent className="sm:max-w-[380px]">
                    <DialogHeader>
                        <DialogTitle>Delete Task</DialogTitle>
                        <DialogDescription>This action cannot be undone. The task and all its data will be permanently removed.</DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="mt-2">
                        <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
                        <Button
                            variant="destructive"
                            onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
                            disabled={loading}
                        >
                            Delete Task
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}


