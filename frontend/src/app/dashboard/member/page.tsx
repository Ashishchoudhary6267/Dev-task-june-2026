'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuthStore } from '@/lib/zustand/user/user';
import { useTaskStore } from '@/lib/zustand/tasks/tasks';
import { Task } from '@/lib/types/auth';
import { useClientStore } from '@/lib/zustand/clients/client';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/toast';
import {
    CheckSquare, Square, Clock, Send, CheckCircle2, FolderKanban,
    Loader2, RefreshCw, XCircle, FileText, Activity,
    ThumbsUp, ThumbsDown, Inbox, Eye, Search, ListChecks,
    ClipboardCheck, CalendarClock, ArrowUpRight, BarChart3,
    ChevronLeft, ChevronRight, Layout, Users, Calendar, Settings2, SortAsc, Hash, HelpCircle,
    AlertTriangle
} from 'lucide-react';
import { HowToModal } from '@/components/how-to/how-to-modal';
import { Button, Badge, Input, Textarea, UISelect } from '@/components/ui';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
    DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import InstanceMemberModal from '@/components/instance-details-modal-member';
import { NotificationBell } from '@/components/notifications/notification-bell';
import ViewModal, { RejectModal } from '@/components/ManualTasksmodal/Details';
import RejectionReasonModal from '@/components/MemberTaskModal/rejection-reason-modal';
import TaskDetailsModal from '@/components/member-dashboard-modal';
import Loader from '@/components/ui/loader';
import { TaskProgressOverview } from '@/components/task/task-progress-overview';
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { LogOut } from 'lucide-react';
import BottomNav from '@/components/dashboard/bottom-nav';
import { cn } from '@/lib/utils';
import { UpdatePrompt } from '@/components/ui/update-prompt';
import { MemberHowToModal } from '@/components/how-to/memberHowTo';
import RequestSLAExtensionModal from '@/components/sla-extension/request-sla-extension-modal';
import { LinksDialog } from '@/components/shared-components/links-dialog';

// ─── Status config ──────────────────────────────────────────────────
const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
    IN_PROGRESS: { label: 'In Progress', color: 'text-blue-700 dark:text-blue-300', bg: 'bg-blue-100 dark:bg-blue-900/30' },
    PENDING_APPROVAL: { label: 'Under Review', color: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-100 dark:bg-amber-900/30' },
    REJECTED: { label: 'Returned', color: 'text-red-700 dark:text-red-300', bg: 'bg-red-100 dark:bg-red-900/30' },
    COMPLETED: { label: 'Completed', color: 'text-green-700 dark:text-green-300', bg: 'bg-green-100 dark:bg-green-900/30' },
    LOCKED: { label: 'Upcoming', color: 'text-muted-foreground', bg: 'bg-muted' },
};

// ─── Link helpers ────────────────────────────────────────────────────
/**
 * Splits a multi-line links string into individual URLs and ensures each
 * has a proper protocol so Next.js router does not prepend the app origin.
 */
interface LinkItem {
    type: 'link' | 'title';
    value: string;
}

/**
 * Parses a string of links and titles.
 * Lines starting with http, https, or www are treated as links.
 * Other lines are treated as titles.
 */
function parseLinkItems(raw: string | null | undefined): LinkItem[] {
    if (!raw) return [];

    const URL_REGEX = /https?:\/\/[^\s]+/g;
    const lines = raw.split('\n');
    const items: LinkItem[] = [];

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;

        const urls = [...line.matchAll(URL_REGEX)].map(m => m[0]);
        const textPart = line.replace(URL_REGEX, '').trim();

        if (textPart) {
            items.push({ type: 'title', value: textPart });
        }

        for (const url of urls) {
            items.push({ type: 'link', value: url });
        }
    }

    return items;
}
/**
 * Detects whether a string value looks like a URL and returns an anchor
 * element; otherwise returns plain text.
 */
/**
 * Detects whether a string value contains URLs and returns them as clickable links.
 * Supports multiple links and titles using parseLinkItems.
 */
function renderInputValue(value: string) {
    if (!value) return null;

    const items = parseLinkItems(value);
    if (items.length === 0) return <span>{value}</span>;

    // If it's just one item and it's a link
    if (items.length === 1 && items[0].type === 'link') {
        return (
            <a
                href={items[0].value}
                target="_blank"
                rel="noreferrer noopener"
                className="text-blue-600 hover:underline inline-flex items-center gap-1 break-all"
                onClick={e => e.stopPropagation()}
            >
                <ArrowUpRight className="h-3 w-3" />
                {items[0].value}
            </a>
        );
    }

    return (
        <div className="flex flex-col gap-1.5 mt-1" onClick={e => e.stopPropagation()}>
            {items.map((item, idx) => (
                item.type === 'link' ? (
                    <a
                        key={idx}
                        href={item.value}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-blue-600 hover:underline inline-flex items-center gap-1 break-all"
                    >
                        <ArrowUpRight className="h-3 w-3" />
                        {item.value}
                    </a>
                ) : (
                    <div key={idx} className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight mt-1 first:mt-0">
                        {item.value}
                    </div>
                )
            ))}
        </div>
    );
}

// ─── TAT performance badge ───────────────────────────────────────────
// Returns a JSX badge if the task was submitted (completed or under review).
// "On Time" = submitted_at ≤ due_date; "Late" = submitted_at > due_date.
function TatBadge({ submittedAt, dueDate }: { submittedAt?: string | null; dueDate?: string | null }) {
    if (!submittedAt || !dueDate) return null;
    const submitted = new Date(submittedAt);
    const deadline = new Date(dueDate);
    const onTime = submitted <= deadline;
    return (
        <span
            className={`ml-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${onTime
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                }`}
        >
            {onTime ? '✓ On Time' : '✗ Late'}
        </span>
    );
}

const isUserActiveActor = (task: any, userId: string | undefined) => {
    if (!userId || !task) return false;

    if (task.status === 'IN_PROGRESS' || task.status === 'REJECTED') {
        return task.assigned_user_id === userId;
    }

    if (task.status === 'PENDING_APPROVAL') {
        // Only the approver of the currently PENDING level is the active actor.
        // A level that is REJECTED means the reviewer already acted — they are not active.
        const pendingLevel = [...(task.task_approval_levels || [])]
            .sort((a: any, b: any) => a.level_number - b.level_number)
            .find((al: any) => al.status === 'PENDING');
        return pendingLevel?.approver_id === userId;
    }

    return false;
};

type MemberTab = 'all' | 'workerTasks' | 'approvalTasks' | 'pendingApprovalTasks' | 'upcomingTasks' | 'completedTasks' | 'reviewedTasks' | 'upcomingReviews';

export default function MemberDashboard() {
    const router = useRouter();
    const { user, isAuthenticated } = useAuthStore();
    const {
        workerTasks, approvalTasks, completedTasks,
        pendingApprovalTasks, upcomingTasks, reviewedTasks, allTasks, upcomingReviews,
        myTasksCounts, myTasksPagination, myTabTasks,
        fetchMyTasks, submitTask, approveTask, rejectTask,
        toggleChecklistItem, loading,
    } = useTaskStore();
    const { clients, fetchClients } = useClientStore();
    const { addToast } = useToast();

    const [activeTab, setActiveTab] = useState<MemberTab>('all');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [typeFilter, setTypeFilter] = useState('all');
    const [clientIdFilter, setClientIdFilter] = useState('all');
    const [dateRangeFilter, setDateRangeFilter] = useState('Last 30 Days');
    const [customDateStart, setCustomDateStart] = useState('');
    const [customDateEnd, setCustomDateEnd] = useState('');
    const [sortBy, setSortBy] = useState('due_date');

    const [detailTask, setDetailTask] = useState<Task | null>(null);
    const [comment, setComment] = useState('');
    const [rejectModalOpen, setRejectModalOpen] = useState(false);
    const [approveModalOpen, setApproveModalOpen] = useState(false);
    const [clientApprovalNeeded, setClientApprovalNeeded] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [selectedActionTask, setSelectedActionTask] = useState<Task | null>(null);
    const [isTaskDetailsOpen, setIsTaskDetailsOpen] = useState(false);
    const [showSubmitBox, setShowSubmitBox] = useState(false);
    const [links, setLinks] = useState('');
    const [localChecked, setLocalChecked] = useState<Record<string, boolean>>({});
    const [manualViewTask, setManualViewTask] = useState<Task | null>(null);
    const [rejectionTask, setRejectionTask] = useState<Task | null>(null);
    const [rejectLoading, setRejectLoading] = useState(false);
    const [isHowToOpen, setIsHowToOpen] = useState(false);
    const [linksDialogTask, setLinksDialogTask] = useState<any>(null);
    const [extendOpenTask, setExtendOpenTask] = useState<Task | null>(null);


    useEffect(() => {
        if (!isAuthenticated) { router.replace('/login'); return; }
        if (user?.platform_role === 'admin') { router.replace('/dashboard/admin'); return; }
        fetchClients();
    }, [isAuthenticated, user, router, fetchClients]);

    // Helper: build fetch params from current filter state
    const buildFetchParams = (overrides: Record<string, any> = {}) => ({
        client_side: true,
        date_range: dateRangeFilter === 'Custom Date' ? 'Custom' : dateRangeFilter,
        ...(dateRangeFilter === 'Custom Date' && customDateStart ? { start_date: customDateStart } : {}),
        ...(dateRangeFilter === 'Custom Date' && customDateEnd ? { end_date: customDateEnd } : {}),
        ...overrides,
    });

    // Initial fetch (Last 30 Days by default)
    useEffect(() => {
        fetchMyTasks({ client_side: true, date_range: 'Last 30 Days' });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fetchMyTasks]);

    // Refetch when date range filter changes (skip 'Custom Date' — handled separately below)
    const isFirstFilterRender = useRef(true);
    useEffect(() => {
        if (isFirstFilterRender.current) { isFirstFilterRender.current = false; return; }
        if (dateRangeFilter === 'Custom Date') return;
        fetchMyTasks({ client_side: true, date_range: dateRangeFilter });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dateRangeFilter]);

    // Refetch when both custom dates are supplied
    useEffect(() => {
        if (dateRangeFilter !== 'Custom Date' || !customDateStart || !customDateEnd) return;
        fetchMyTasks({ client_side: true, date_range: 'Custom', start_date: customDateStart, end_date: customDateEnd });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [customDateStart, customDateEnd, dateRangeFilter]);

    // Reset page when any filter changes
    useEffect(() => {
        setPage(1);
    }, [activeTab, search, typeFilter, clientIdFilter, dateRangeFilter]);

    // ── Data Filtering & Pagination ────────────────────────────────────
    const filteredTasks = useMemo(() => {
        let baseTasks = [];
        if (activeTab === 'all') baseTasks = allTasks || [];
        else if (activeTab === 'workerTasks') baseTasks = workerTasks || [];
        else if (activeTab === 'approvalTasks') baseTasks = approvalTasks || [];
        else if (activeTab === 'pendingApprovalTasks') baseTasks = pendingApprovalTasks || [];
        else if (activeTab === 'upcomingTasks') baseTasks = upcomingTasks || [];
        else if (activeTab === 'completedTasks') baseTasks = completedTasks || [];
        else if (activeTab === 'reviewedTasks') baseTasks = reviewedTasks || [];
        else if (activeTab === 'upcomingReviews') baseTasks = upcomingReviews || [];

        let filtered = [...baseTasks];

        if (search) {
            const s = search.toLowerCase();
            filtered = filtered.filter((t: any) => {
                const target = activeTab === 'reviewedTasks' ? t.task : t;
                return target?.title?.toLowerCase().includes(s) || target?.instance?.name?.toLowerCase().includes(s);
            });
        }

        if (typeFilter !== 'all') {
            filtered = filtered.filter((t: any) => {
                const target = activeTab === 'reviewedTasks' ? t.task : t;
                return typeFilter === 'manual' ? target?.is_manual === true : target?.is_manual === false;
            });
        }

        if (clientIdFilter !== 'all') {
            filtered = filtered.filter((t: any) => {
                const target = activeTab === 'reviewedTasks' ? t.task : t;
                const matchClientId = target?.instance?.client?.id || target?.instance?.client_id || target?.project?.client_id;
                return String(matchClientId) === String(clientIdFilter);
            });
        }

        if (dateRangeFilter !== 'All Time') {
            const now = new Date();
            let cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate());

            const isActiveTab = ['workerTasks', 'approvalTasks', 'pendingApprovalTasks', 'upcomingTasks', 'upcomingReviews'].includes(activeTab);

            if (dateRangeFilter === 'Custom Date') {
                filtered = filtered.filter((t: any) => {
                    if (isActiveTab) return true;

                    const target = activeTab === 'reviewedTasks' ? t.task : t;
                    const d = target?.assigned_at ? new Date(target.assigned_at) : null;
                    if (!d) return false;

                    const startD = customDateStart ? new Date(customDateStart) : null;
                    const endD = customDateEnd ? new Date(customDateEnd) : null;
                    if (startD) startD.setHours(0, 0, 0, 0);
                    if (endD) endD.setHours(23, 59, 59, 999);

                    if (startD && endD) return d >= startD && d <= endD;
                    if (startD) return d >= startD;
                    if (endD) return d <= endD;
                    return true;
                });
            } else if (dateRangeFilter !== 'Custom Date') {
                // Server already applied the date filter; this is a client-side guard
                // for instant post-filter display — must use the same field as the backend:
                //   completedTasks → approved_at  (set when status becomes COMPLETED)
                //   reviewedTasks  → created_at   (approval history timestamp)
                //   all others     → created_at
                if (dateRangeFilter === 'Last 7 Days') cutoff.setDate(cutoff.getDate() - 7);
                else if (dateRangeFilter === 'Last 30 Days') cutoff.setDate(cutoff.getDate() - 30);

                filtered = filtered.filter((t: any) => {
                    if (isActiveTab) return true;

                    const target = activeTab === 'reviewedTasks' ? t.task : t;
                    // For completed tasks use approved_at to match backend filter
                    const dateField = activeTab === 'completedTasks'
                        ? (t?.approved_at || t?.submitted_at)
                        : target?.created_at;
                    return dateField ? new Date(dateField) >= cutoff : true;
                });
            }
        }

        let mapped = filtered.map((item: any) => {
            const target = activeTab === 'reviewedTasks' ? item.task : item;
            if (!target) return item;

            // Only substitute the approver-level due_date when the current user IS
            // the active approver. Workers should see the task-level due_date so they
            // don't get a false "Late" badge while their task is under review.
            const activeLevel = target.task_approval_levels?.find((al: any) => al.level_number === target.current_level);
            const currentUserIsActiveApprover =
                target.status === 'PENDING_APPROVAL' &&
                activeLevel &&
                activeLevel.approver_id === user?.id;

            if (currentUserIsActiveApprover && activeLevel.due_date) {
                if (activeTab === 'reviewedTasks') {
                    return { ...item, task: { ...target, original_due_date_display: target.due_date, due_date: activeLevel.due_date } };
                }
                return { ...item, original_due_date_display: target.due_date, due_date: activeLevel.due_date };
            }
            return item;
        });

        if (activeTab !== 'reviewedTasks') {
            if (sortBy === 'due_date') {
                mapped.sort((a: any, b: any) => new Date(a.due_date || 0).getTime() - new Date(b.due_date || 0).getTime());
            } else if (sortBy === 'due_date_desc') {
                mapped.sort((a: any, b: any) => new Date(b.due_date || 0).getTime() - new Date(a.due_date || 0).getTime());
            } else if (sortBy === 'created_at') {
                mapped.sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
            } else {
                mapped.sort((a: any, b: any) => (a.task_order || 0) - (b.task_order || 0));
            }
        }

        return mapped;
    }, [activeTab, workerTasks, approvalTasks, pendingApprovalTasks, upcomingTasks, completedTasks, reviewedTasks, allTasks, upcomingReviews, search, typeFilter, clientIdFilter, dateRangeFilter, customDateStart, customDateEnd, sortBy]);

    const totalCount = filteredTasks.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / limit));
    const tabTasks = useMemo(() => {
        const start = (page - 1) * limit;
        return filteredTasks.slice(start, start + limit);
    }, [filteredTasks, page, limit]);

    // ── Tab definitions ─────────────────────────────────────────────────
    const tabs: { key: MemberTab; label: string; count: number }[] = [
        { key: 'all', label: 'All', count: myTasksCounts.all || 0 },
        { key: 'workerTasks', label: 'In Progress', count: myTasksCounts.workerTasks },
        { key: 'approvalTasks', label: 'Approval Queue', count: myTasksCounts.approvalTasks },
        { key: 'pendingApprovalTasks', label: 'Under Review', count: myTasksCounts.pendingApprovalTasks },
        { key: 'upcomingTasks', label: 'Upcoming', count: myTasksCounts.upcomingTasks },
        { key: 'upcomingReviews', label: 'Upcoming Reviews', count: myTasksCounts.upcomingReviews || 0 },
        { key: 'completedTasks', label: 'Completed', count: myTasksCounts.completedTasks },
        { key: 'reviewedTasks', label: 'My Reviews', count: myTasksCounts.reviewedTasks },
    ];

    // ── Handlers ────────────────────────────────────────────────────────
    const handleSubmit = async (task: Task) => {
        const items = task.task_checklist_progress || [];

        // if (items.length > 0 && !items.every((i: any) => i.is_checked === true)) {
        //     addToast({ title: 'Checklist incomplete', description: 'Please complete all checklist items first.', variant: 'destructive' });
        //     return;
        // }
        setSubmitting(true);
        const ok = await submitTask(task.id, links)
        // await toggleChecklistItem(task.id, items[0].id, true);
        setSubmitting(false);
        setShowSubmitBox(false);
        if (ok) {
            addToast({
                title: task.approval_required ? 'Submitted for Approval ✅' : 'Task Completed! ✅',
                description: task.approval_required ? 'Waiting for approver.' : 'Task marked as complete.',
                variant: 'success',
            });
            setSelectedActionTask(null);
            fetchMyTasks(buildFetchParams())

            setComment('');
        } else {
            addToast({ title: 'Error', description: 'Could not submit task.', variant: 'destructive' });
        }
    };

    const handleApprove = async () => {
        if (!selectedActionTask) return;

        setSubmitting(true);
        const ok = await approveTask(selectedActionTask.id, comment.trim() || undefined, clientApprovalNeeded);
        setSubmitting(false);
        setApproveModalOpen(false);
        if (ok) {
            addToast({ title: 'Approved! ✅', description: 'Task approved successfully.', variant: 'success' });
            setSelectedActionTask(null); setComment(''); setClientApprovalNeeded(false);
        } else {
            addToast({ title: 'Error', description: 'Failed to approve task.', variant: 'destructive' });
        }
    };

    const handleReject = async () => {
        if (!selectedActionTask) return;
        setRejectLoading(true);
        setSubmitting(true);
        const ok = await rejectTask(selectedActionTask.id, comment.trim() || undefined);
        setRejectLoading(false);
        setSubmitting(false);
        if (ok) {
            addToast({ title: 'Rejected', description: 'Task sent back to worker.', variant: 'success' });
            setSelectedActionTask(null); setComment('');
        } else {
            addToast({ title: 'Error', description: 'Failed to reject task.', variant: 'destructive' });
        }
        setApproveModalOpen(false);
        setRejectModalOpen(false);
    };

    const handleToggle = async (taskId: string, itemId: string, current: boolean) => {
        await toggleChecklistItem(taskId, itemId, !current);
    };

    const handleLocalToggle = (itemId: string) => {
        setLocalChecked(prev => ({ ...prev, [itemId]: !prev[itemId] }));
    };

    const handleSelectAll = (items: any[]) => {
        const allChecked = items.every(item => localChecked[item.id]);
        const newState = { ...localChecked };
        items.forEach(item => {
            newState[item.id] = !allChecked;
        });
        setLocalChecked(newState);
    };

    // ── Workflow role display ───────────────────────────────────────────
    // const roleDisplayName = user?.workflow_role !== 'interim_manager' ? 'Email Marketer' : 'Interim Manager'
    const roleDisplayName =
        user?.workflow_role === 'interim_manager' || user?.workflow_role === 'designer'
            ? user.workflow_role
            : 'Email Marketer';

    // Determine if a task is an "approval queue" task (i.e. I am the current approver)
    const isApprovalQueueTask = (task: Task) =>
        approvalTasks.some(t => t.id === task.id);



    if (submitting) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Loader />
            </div>
        )
    }

    const handleSoftRefresh = () => {
        fetchMyTasks(buildFetchParams());
    };
    const userInitials = user?.name
        ? user.name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2)
        : 'U';

    return (
        <>
            <div className="relative">
                <UpdatePrompt onRefresh={handleSoftRefresh} />
                <div className="min-h-screen bg-background pb-32 md:pb-8">
                    {/* ── Top Bar ── */}
                    <div className="border-b border-border px-6 py-4 flex items-center justify-between bg-card/50 backdrop-blur-md md:sticky md:top-0 z-10 transition-all duration-300">
                        <div className="flex flex-col">
                            <h1 className="text-xl font-bold text-foreground tracking-tight">My Workspace</h1>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs text-muted-foreground">Welcome, <span className="font-semibold text-primary">{user?.name}</span></span>
                                <span className="h-1 w-1 rounded-full bg-border" />
                                {user?.platform_role !== 'controller' && roleDisplayName && (
                                    <Badge variant="secondary" className="px-1.5 py-0 h-4 text-[10px] font-bold uppercase tracking-wider bg-primary/5 text-primary border-primary/10">
                                        {roleDisplayName}
                                    </Badge>
                                )}
                            </div>
                        </div>

                        <div className="hidden md:flex items-center gap-4">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setIsHowToOpen(true)}
                                className="h-8 w-8 p-0 rounded-full hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                            >
                                <HelpCircle className="h-5 w-5" />
                            </Button>
                            <NotificationBell />
                            <DropdownMenu>
                                <DropdownMenuTrigger className="outline-none group">
                                    <div className="flex items-center gap-3 pl-1 pr-1 py-1 rounded-full border border-transparent hover:border-border hover:bg-muted/30 transition-all duration-300">
                                        <Avatar className="h-9 w-9 ring-2 ring-background ring-offset-2 ring-offset-border/10 group-hover:ring-primary/20 transition-all duration-500 shadow-sm">
                                            <AvatarFallback className="bg-linear-to-br from-primary/10 to-primary/5 text-primary font-bold text-sm">
                                                {user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                            </AvatarFallback>
                                        </Avatar>
                                    </div>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-64 p-2 shadow-2xl border-border/40 bg-background/95 backdrop-blur-xl">
                                    {/* Profile Summary */}
                                    <div className="px-3 py-4 mb-2 bg-linear-to-br from-primary/3 to-transparent rounded-xl border border-primary/5">
                                        <p className="text-[10px] font-black text-primary/60 uppercase tracking-[0.2em] mb-2 px-1"> </p>
                                        <div className="flex items-center gap-3 px-1">
                                            <Avatar className="h-10 w-10 border border-border/40 shadow-sm">
                                                <AvatarFallback className="bg-primary text-primary-foreground font-black text-xs">
                                                    {user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                                </AvatarFallback>
                                            </Avatar>

                                            <div className="flex flex-col min-w-0">
                                                <p className="text-sm font-bold text-foreground truncate">{user?.name}</p>
                                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">{roleDisplayName}</p>
                                            </div>
                                            <Avatar size="sm">
                                                <AvatarFallback className="bg-primary/15 text-primary text-xs font-bold">
                                                    {userInitials}
                                                </AvatarFallback>
                                            </Avatar>
                                        </div>
                                    </div>

                                    <div className="px-1 space-y-1">
                                        {/* Integrated notification bell access */}


                                        <DropdownMenuSeparator className="opacity-50" />

                                        <DropdownMenuItem
                                            onClick={() => {
                                                const { logout } = useAuthStore.getState();
                                                logout();
                                                localStorage.clear();
                                                router.push('/landing');
                                            }}
                                            className="px-3 py-2.5 text-red-500 font-bold focus:text-red-500 focus:bg-red-50 dark:focus:bg-red-950/20 rounded-lg group"
                                        >
                                            <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center mr-3 group-hover:scale-110 transition-transform">
                                                <LogOut className="h-4 w-4" />
                                            </div>
                                            Logout
                                        </DropdownMenuItem>
                                    </div>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>

                    <div className="px-6 py-6 space-y-6 max-w-full">
                        {/* ── Task Progress Overview (Replaces old stats cards) ── */}
                        <TaskProgressOverview onTabSelect={(tab) => setActiveTab(tab)} />

                        {/* ── Filters ── */}
                        <div className="flex flex-wrap items-center gap-4">
                            <div className="relative flex-1 min-w-[240px] max-w-md">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search tasks, instances..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    className="pl-9"
                                />
                            </div>

                            <div className="flex items-center gap-3 flex-wrap">
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <span>Items per page:</span>
                                    <UISelect
                                        value={limit.toString()}
                                        onValueChange={(val) => setLimit(Number(val))}
                                        className="w-20"
                                        contentWidth="min-w-24"
                                        options={[
                                            { value: '10', label: '10' },
                                            { value: '20', label: '20' },
                                            { value: '50', label: '50' },
                                            { value: '100', label: '100' },
                                        ]}
                                    />
                                </div>
                                <UISelect
                                    value={typeFilter}
                                    onValueChange={(val) => setTypeFilter(val)}
                                    // className="min-w-[140px]"
                                    options={[
                                        { value: 'all', label: 'All Types' },
                                        { value: 'manual', label: 'Manual' },
                                        { value: 'instance', label: 'Instance' },
                                    ]}
                                />


                                <UISelect
                                    value={clientIdFilter}
                                    onValueChange={(val) => setClientIdFilter(val)}
                                    // className="min-w-[160px]"
                                    options={[
                                        { value: 'all', label: 'All Clients', icon: Users },
                                        ...clients.map(c => ({
                                            value: c.id,
                                            label: c.name,
                                            icon: Users
                                        }))
                                    ]}
                                />

                                <UISelect
                                    value={dateRangeFilter}
                                    onValueChange={(val) => setDateRangeFilter(val)}
                                    // className="min-w-[160px]"
                                    options={[
                                        { value: 'All Time', label: 'All Time' },
                                        { value: 'Today', label: 'Today' },
                                        { value: 'Last 7 Days', label: 'Last 7 Days' },
                                        { value: 'Last 30 Days', label: 'Last 30 Days' },
                                        { value: 'Custom Date', label: 'Custom Date' },
                                    ]}
                                />
                                {dateRangeFilter === 'Custom Date' && (
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="date"
                                            className="h-9 px-3 py-1 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                                            value={customDateStart}
                                            onChange={e => setCustomDateStart(e.target.value)}
                                        />
                                        <span className="text-muted-foreground text-sm">to</span>
                                        <input
                                            type="date"
                                            className="h-9 px-3 py-1 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                                            value={customDateEnd}
                                            onChange={e => setCustomDateEnd(e.target.value)}
                                        />
                                    </div>
                                )}

                                <UISelect
                                    value={sortBy}
                                    onValueChange={(val) => setSortBy(val)}
                                    // className="min-w-[180px]"
                                    options={[
                                        { value: 'due_date', label: 'Due Date (Earliest)' },
                                        { value: 'due_date_desc', label: 'Due Date (Latest)' },
                                        { value: 'created_at', label: 'Created Date' },
                                    ]}
                                />
                                <Button variant="outline" size="sm" onClick={() => fetchMyTasks(buildFetchParams())} disabled={loading}>
                                    <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
                                </Button>

                            </div>
                        </div>

                        {/* ── Tabs (Simple Pill Design) ── */}
                        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0 mb-6">
                            <div className="p-1 bg-muted/50 rounded-xl border border-border hidden sm:inline-flex items-center gap-1">
                                {tabs.map(tab => {
                                    const isActive = activeTab === tab.key;
                                    return (
                                        <button
                                            key={tab.key}
                                            onClick={() => setActiveTab(tab.key)}
                                            className={cn(
                                                "px-4 py-1.5 text-sm font-bold transition-colors rounded-lg whitespace-nowrap outline-none flex items-center gap-2",
                                                isActive
                                                    ? "bg-primary text-primary-foreground"
                                                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                                            )}
                                        >
                                            {tab.label}
                                            <span className={cn(
                                                "text-[10px] px-1.5 py-0.5 min-w-[20px] inline-flex items-center justify-center rounded-md font-bold transition-colors",
                                                isActive ? "bg-white/20 text-white" : "bg-muted-foreground/10 text-muted-foreground"
                                            )}>
                                                {tab.count}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* ── Bottom Nav (Mobile only) ── */}
                        <BottomNav
                            items={[
                                { id: 'all', label: 'All', icon: ListChecks },
                                { id: 'workerTasks', label: 'Working', icon: Activity },
                                { id: 'approvalTasks', label: 'Review', icon: CheckCircle2 },
                                { id: 'pendingApprovalTasks', label: 'Reviewing', icon: Clock },
                                { id: 'upcomingTasks', label: 'Upcoming', icon: CalendarClock },
                                { id: 'completedTasks', label: 'Completed', icon: ClipboardCheck },
                                { id: 'reviewedTasks', label: 'Reviews', icon: ThumbsUp },
                            ]}
                            activeId={activeTab}
                            onTabChange={(id) => setActiveTab(id as MemberTab)}
                        />

                        {/* for small screens */}
                        <div className='block sm:hidden w-full'>

                            {/* ── Task Grid (hidden on Reviews and Upcoming Reviews tabs) ── */}
                            {activeTab !== 'reviewedTasks' && activeTab !== 'upcomingReviews' && (loading && tabTasks.length === 0 ? (
                                <div className="flex items-center justify-center py-20">
                                    <Loader />
                                </div>
                            ) : tabTasks.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 border border-dashed border-border rounded-2xl text-muted-foreground bg-muted/10">
                                    <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                                        <Inbox className="h-8 w-8 opacity-30" />
                                    </div>
                                    <p className="font-medium">No tasks found</p>
                                    <p className="text-sm mt-1">
                                        {search ? 'Try a different search term.' : 'No tasks in this category yet.'}
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                                        {tabTasks?.map(task => {
                                            const cfg = STATUS_STYLE[task.status] || STATUS_STYLE.LOCKED;
                                            const checklist = task.task_checklist_progress || [];
                                            const checkedCount = checklist.filter((i: any) => i.is_checked).length;
                                            const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'COMPLETED' && isUserActiveActor(task, user?.id);
                                            const isApproval = isApprovalQueueTask(task);

                                            return (
                                                <div
                                                    key={task.id}
                                                    className={cn(
                                                        "group relative flex flex-col bg-card border border-border/50 rounded-2xl p-5 transition-all duration-300 hover:shadow-2xl hover:shadow-primary/5 hover:-translate-y-1.5 overflow-hidden",
                                                        task?.last_rejected_by && "bg-red-50/30 dark:bg-red-900/10 border-red-200/50"
                                                    )}
                                                >
                                                    {/* Status Accent Glow */}
                                                    <div className={cn(
                                                        "absolute -right-12 -top-12 w-32 h-32 blur-[60px] opacity-10 group-hover:opacity-25 transition-opacity duration-500 rounded-full",
                                                        cfg.bg.replace('bg-', 'bg-') // Map color
                                                    )} />

                                                    {/* Header: Title & Badges */}
                                                    <div className="relative z-10 flex items-start justify-between gap-3 mb-4">
                                                        <div className="flex-1 min-w-0">
                                                            <h3 className="font-bold text-foreground text-sm leading-tight group-hover:text-primary transition-colors line-clamp-2" title={task.title}>
                                                                {task.title}
                                                            </h3>
                                                            <div className="flex items-center gap-2 mt-1.5">
                                                                {(task as any).is_manual && (
                                                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 ring-1 ring-purple-200/50">
                                                                        Manual
                                                                    </span>
                                                                )}
                                                                <span className="text-[10px] text-muted-foreground font-medium">
                                                                    {(task as any).is_manual ? 'Ad-hoc' : `Step ${task.task_order}`}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <span className={cn(
                                                            "shrink-0 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest ring-1 ring-inset",
                                                            cfg.bg, cfg.color, "ring-current/10"
                                                        )}>
                                                            {cfg.label}
                                                        </span>
                                                    </div>

                                                    {/* Content: Instance & Client */}
                                                    <div className="relative z-10 space-y-3 mb-5 flex-1">
                                                        <div className="flex items-center gap-2.5  rounded-xl bg-muted/30 border border-border/20">
                                                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-background shadow-sm ring-1 ring-border/10">
                                                                <Layout className="h-4 w-4 text-primary/70" />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="text-[11px] font-bold text-foreground truncate">{task.instance?.name || '—'}</p>
                                                                <p className="text-[10px] text-muted-foreground truncate">{task?.instance?.client?.name || '—'}</p>
                                                            </div>
                                                        </div>

                                                        <div className="grid grid-cols-2 gap-2">
                                                            <div className="flex flex-col gap-1 p-2 rounded-xl bg-muted/20 border border-border/10">
                                                                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                                                                    <Users className="h-2.5 w-2.5" /> Assigned
                                                                </span>
                                                                <p className="text-[11px] font-semibold text-foreground truncate">{task.assigned_user?.name || '—'}</p>
                                                            </div>
                                                            <div className="flex flex-col gap-1 p-2 rounded-xl bg-muted/20 border border-border/10">
                                                                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                                                                    <Calendar className="h-2.5 w-2.5" /> Due Date
                                                                </span>
                                                                <p className={cn(
                                                                    "text-[11px] font-semibold truncate",
                                                                    isOverdue ? "text-red-500" : "text-foreground"
                                                                )}>
                                                                    {task.due_date
                                                                        ? new Date(task.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                                                                        : '—'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Footer: Stats & Actions */}
                                                    <div className="relative z-10 border-t border-border/40 space-y-4">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-2">
                                                                {checklist.length > 0 && (
                                                                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/5 border border-primary/10 text-primary text-[10px] font-bold">
                                                                        <ListChecks className="h-3 w-3" />
                                                                        {checkedCount}/{checklist.length}
                                                                    </div>
                                                                )}
                                                                {task.turnaround_minutes > 0 && (
                                                                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-muted/50 text-muted-foreground text-[10px] font-bold">
                                                                        <Clock className="h-3 w-3" />
                                                                        {Math.round(task.turnaround_minutes / 60)}h
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* TAT Badge — only when task is fully COMPLETED (historical stamp) */}
                                                            {task.status === 'COMPLETED' && (
                                                                <TatBadge submittedAt={task.submitted_at} dueDate={task.due_date} />
                                                            )}
                                                        </div>

                                                        <div className="flex items-center gap-2">
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="flex-1 h-9 rounded-xl border-border/60 hover:bg-muted font-bold text-xs"
                                                                onClick={() => (task as any).is_manual ? setManualViewTask(task) : setDetailTask(task)}
                                                            >
                                                                <Eye className="h-3.5 w-3.5 mr-1.5" /> Details
                                                            </Button>

                                                            {(task.status === 'IN_PROGRESS' || task.status === 'REJECTED') && !isApproval && (
                                                                <Button
                                                                    size="sm"
                                                                    className="flex-1 h-9 rounded-xl shadow-lg shadow-primary/10 font-bold text-xs"
                                                                    onClick={() => {
                                                                        setShowSubmitBox(true);
                                                                        setSelectedActionTask(task);
                                                                        setLocalChecked({});
                                                                    }}
                                                                    disabled={submitting}
                                                                >
                                                                    {task.approval_required ? 'Submit' : 'Complete'}
                                                                </Button>
                                                            )}

                                                            {isApproval && (
                                                                <div className="flex flex-1 gap-2">
                                                                    <Button
                                                                        size="sm"
                                                                        className="flex-1 h-9 rounded-xl bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-500/10 font-bold text-xs"
                                                                        onClick={() => {
                                                                            setSelectedActionTask(task);
                                                                            setLocalChecked({});
                                                                            setApproveModalOpen(true);
                                                                        }}
                                                                    >
                                                                        Approve
                                                                    </Button>
                                                                    <Button
                                                                        variant="destructive"
                                                                        size="sm"
                                                                        className="h-9 w-9 rounded-xl shadow-lg shadow-red-500/10"
                                                                        onClick={() => {
                                                                            setSelectedActionTask(task);
                                                                            setRejectModalOpen(true);
                                                                        }}
                                                                    >
                                                                        <XCircle className="h-4 w-4" />
                                                                    </Button>
                                                                </div>
                                                            )}

                                                            {task.last_rejection_comment && (
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="h-9 w-9 p-0 rounded-xl border-red-200 text-red-600 bg-red-50/50 hover:bg-red-50"
                                                                    onClick={() => setRejectionTask(task)}
                                                                >
                                                                    <RefreshCw className="h-4 w-4" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* --- Card-style Pagination --- */}
                                    <div className="flex items-center justify-between p-4 bg-muted/20 border border-border/40 rounded-2xl">
                                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                                            {totalCount > 0 ? (
                                                `${(page - 1) * limit + 1} - ${Math.min(page * limit, totalCount)} of ${totalCount}`
                                            ) : (
                                                'No results'
                                            )}
                                        </span>

                                        <div className="flex items-center gap-1 bg-background/50 p-1 rounded-xl border border-border/20 shadow-sm">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                                disabled={page === 1}
                                                className="h-8 w-8 p-0 rounded-lg"
                                            >
                                                <ChevronLeft className="h-4 w-4" />
                                            </Button>
                                            <div className="flex h-8 min-w-[32px] items-center justify-center px-2 text-xs font-black text-primary">
                                                {page}
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setPage(p => p + 1)}
                                                disabled={page * limit >= totalCount}
                                                className="h-8 w-8 p-0 rounded-lg"
                                            >
                                                <ChevronRight className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                            )
                            )}

                            {/* ── Reviews Tab: My Approval History ── */}
                            {activeTab === 'reviewedTasks' && (
                                reviewedTasks.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-20 border border-dashed border-border rounded-2xl text-muted-foreground bg-muted/10 mx-4 sm:mx-0">
                                        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                                            <ThumbsUp className="h-8 w-8 opacity-30" />
                                        </div>
                                        <p className="font-medium text-foreground">No reviews yet</p>
                                        <p className="text-sm mt-1 text-center px-4">Tasks you approve or reject will appear here.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 px-4 sm:px-0">
                                            {reviewedTasks.map((entry: any) => {
                                                const isApproved = entry.action === 'APPROVED';
                                                const date = entry.created_at ? new Date(entry.created_at) : null;

                                                return (
                                                    <div
                                                        key={entry.id}
                                                        className="group relative flex flex-col bg-card border border-border/50 rounded-2xl p-5 transition-all duration-300 hover:shadow-2xl hover:shadow-primary/5 hover:-translate-y-1.5 overflow-hidden"
                                                    >
                                                        {/* Background Accent */}
                                                        <div className={cn(
                                                            "absolute -right-12 -top-12 w-32 h-32 blur-[60px] opacity-10 group-hover:opacity-20 transition-opacity duration-500 rounded-full",
                                                            isApproved ? "bg-green-500" : "bg-red-500"
                                                        )} />

                                                        {/* Header: Action & Date */}
                                                        <div className="relative z-10 flex items-center justify-between mb-4">
                                                            <span className={cn(
                                                                "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ring-1 ring-inset",
                                                                isApproved
                                                                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 ring-green-500/20"
                                                                    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 ring-red-500/20"
                                                            )}>
                                                                {isApproved ? <ThumbsUp className="h-3 w-3" /> : <ThumbsDown className="h-3 w-3" />}
                                                                {isApproved ? 'Approved' : 'Rejected'}
                                                            </span>
                                                            <span className="text-[10px] font-bold text-muted-foreground bg-muted/50 px-2 py-1 rounded-lg">
                                                                {date ? date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
                                                            </span>
                                                        </div>

                                                        {/* Title & Step */}
                                                        <div className="relative z-10 mb-4 flex-1">
                                                            <h3 className="font-bold text-foreground text-sm leading-tight group-hover:text-primary transition-colors line-clamp-2">
                                                                {entry.task?.title || '—'}
                                                            </h3>
                                                            <div className="mt-2 flex items-center gap-2">
                                                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter bg-muted/30 px-1.5 py-0.5 rounded border border-border/40">
                                                                    Step {entry.task?.task_order}
                                                                </span>
                                                                <span className="text-[10px] font-bold text-primary/70">
                                                                    Level {entry.level_number}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {/* Instance & Client Pill */}
                                                        <div className="relative z-10 mb-5 p-3 rounded-xl bg-muted/30 border border-border/20">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <Layout className="h-3.5 w-3.5 text-primary/60" />
                                                                <p className="text-[11px] font-bold text-foreground truncate">{entry.task?.instance?.name || '—'}</p>
                                                            </div>
                                                            <p className="text-[10px] text-muted-foreground pl-5 truncate">{entry.task?.instance?.client?.name || '—'}</p>
                                                        </div>

                                                        {/* Review Comment */}
                                                        {entry.comment && (
                                                            <div className="relative z-10 mb-5 pl-3 border-l-2 border-primary/20">
                                                                <p className="text-[11px] text-muted-foreground italic leading-relaxed line-clamp-3">
                                                                    "{entry.comment}"
                                                                </p>
                                                            </div>
                                                        )}

                                                        {/* Worker Info & TAT stamp (Footer) */}
                                                        <div className="relative z-10 pt-4 border-t border-border/40 flex items-center gap-3">
                                                            <div className="h-9 w-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary text-[10px] font-black uppercase shadow-inner">
                                                                {entry.task?.assigned_user?.name?.slice(0, 2) || '??'}
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <p className="text-[11px] font-bold text-foreground truncate">{entry.task?.assigned_user?.name || 'Unknown Worker'}</p>
                                                                <p className="text-[9px] text-muted-foreground truncate">{entry.task?.assigned_user?.email || ''}</p>
                                                            </div>
                                                            {/* TAT: did the reviewer act on time? acted_at vs approval level due_date */}
                                                            {(() => {
                                                                const myLevel = entry.task?.task_approval_levels?.find(
                                                                    (al: any) => al.level_number === entry.level_number
                                                                );
                                                                if (!entry.acted_at || !myLevel?.due_date) return null;
                                                                const actedOnTime = new Date(entry.acted_at) <= new Date(myLevel.due_date);
                                                                return (
                                                                    <span className={`ml-auto shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${actedOnTime
                                                                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                                                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                                                        }`}>
                                                                        {actedOnTime ? '✓ On Time' : '✗ Late'}
                                                                    </span>
                                                                );
                                                            })()}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Card-style Pagination */}
                                        <div className="flex items-center justify-between p-4 bg-muted/20 border border-border/40 rounded-2xl mx-4 sm:mx-0">
                                            <div className="flex items-center gap-4">
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground font-bold uppercase tracking-widest text-[9px]">
                                                    <span>Limit:</span>
                                                    <UISelect
                                                        value={limit.toString()}
                                                        onValueChange={(val) => setLimit(Number(val))}
                                                        className="w-14 h-7"
                                                        contentWidth="min-w-24"
                                                        options={[
                                                            { value: '10', label: '10' },
                                                            { value: '20', label: '20' },
                                                            { value: '50', label: '50' },
                                                            { value: '100', label: '100' },
                                                        ]}
                                                    />
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-1 bg-background/50 p-1 rounded-xl border border-border/20 shadow-sm">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                                    disabled={page === 1}
                                                    className="h-8 w-8 p-0 rounded-lg"
                                                >
                                                    <ChevronLeft className="h-4 w-4" />
                                                </Button>
                                                <span className="text-[10px] font-black text-primary px-2">
                                                    {page} of {totalPages}
                                                </span>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setPage(p => p + 1)}
                                                    disabled={page >= totalPages}
                                                    className="h-8 w-8 p-0 rounded-lg"
                                                >
                                                    <ChevronRight className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                )
                            )}


                            {/* ── Upcoming Reviews Tab ── */}
                            {activeTab === 'upcomingReviews' && (
                                tabTasks.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-20 border border-dashed border-border rounded-xl text-muted-foreground">
                                        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                                            <CalendarClock className="h-8 w-8 opacity-30" />
                                        </div>
                                        <p className="font-medium">No upcoming reviews</p>
                                        <p className="text-sm mt-1">You haven't been assigned as a reviewer for any active tasks yet.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300 text-xs">
                                            <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                                            <span>These tasks are assigned to you for review. They will move to your <strong>Approval Queue</strong> once the worker submits them. You cannot take action here.</span>
                                        </div>

                                        {/* ── Desktop Table ── */}
                                        <div className="hidden sm:block rounded-xl border border-border overflow-hidden overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead className="bg-muted/50 text-muted-foreground">
                                                    <tr>
                                                        <th className="text-left px-4 py-3 font-medium">Task</th>
                                                        <th className="text-left px-4 py-3 font-medium">Instance / Client</th>
                                                        <th className="text-left px-4 py-3 font-medium">Assigned To</th>
                                                        <th className="text-left px-4 py-3 font-medium">Turnaround</th>
                                                        <th className="text-left px-4 py-3 font-medium">Status</th>


                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-border">
                                                    {tabTasks.map((task: any) => {
                                                        const cfg = STATUS_STYLE[task.status] || STATUS_STYLE.LOCKED;
                                                        const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'COMPLETED' && isUserActiveActor(task, user?.id);
                                                        return (
                                                            <tr key={task.id} className="bg-card hover:bg-muted/30 transition-colors">
                                                                <td className="px-4 py-3">
                                                                    <div className="font-medium text-foreground">{task.title}</div>
                                                                    <div className="text-xs text-muted-foreground mt-0.5">
                                                                        {task.is_manual ? 'Ad-hoc task' : `Step ${task.task_order}`}
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    <div className="font-medium text-sm">{task.instance?.name || '—'}</div>
                                                                    <div className="text-xs text-muted-foreground">{task.instance?.client?.name || '—'}</div>
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    <div className="text-sm font-medium text-foreground">{task.assigned_user?.name || '—'}</div>
                                                                    <div className="text-xs text-muted-foreground capitalize">{task.assigned_role || ''}</div>
                                                                </td>
                                                                <td className="px-4 py-3 text-xs text-muted-foreground">
                                                                    {task.turnaround_minutes
                                                                        ? <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{Math.round(task.turnaround_minutes / 60)}h</span>
                                                                        : '—'}
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${cfg.bg} ${cfg.color}`}>
                                                                        {cfg.label}
                                                                    </span>
                                                                    {isOverdue && (
                                                                        <span className="ml-1.5 inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                                                                            Overdue
                                                                        </span>
                                                                    )}
                                                                </td>

                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                            <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-card">
                                                <div className="text-xs text-muted-foreground">
                                                    {totalCount > 0
                                                        ? `Showing ${(page - 1) * limit + 1} to ${Math.min(page * limit, totalCount)} of ${totalCount} results`
                                                        : 'No results'}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="h-8 w-8 p-0">
                                                        <ChevronLeft className="h-4 w-4" />
                                                    </Button>
                                                    <span className="text-xs font-medium px-2">{page} of {totalPages}</span>
                                                    <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages} className="h-8 w-8 p-0">
                                                        <ChevronRight className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* ── Mobile Cards ── */}
                                        <div className="flex flex-col gap-3 sm:hidden">
                                            {tabTasks.map((task: any) => {
                                                const cfg = STATUS_STYLE[task.status] || STATUS_STYLE.LOCKED;
                                                const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'COMPLETED' && isUserActiveActor(task, user?.id);
                                                return (
                                                    <div key={task.id} className="bg-card border border-border/50 rounded-2xl p-4 space-y-3">
                                                        {/* Header */}
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="flex-1 min-w-0">
                                                                <p className="font-bold text-sm text-foreground leading-tight">{task.title}</p>
                                                                <p className="text-[11px] text-muted-foreground mt-1">
                                                                    {task.is_manual ? 'Ad-hoc task' : `Step ${task.task_order}`}
                                                                </p>
                                                            </div>
                                                            <div className="flex flex-col items-end gap-1 shrink-0">
                                                                <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${cfg.bg} ${cfg.color}`}>
                                                                    {cfg.label}
                                                                </span>
                                                                {isOverdue && (
                                                                    <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                                                                        Overdue
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Instance pill */}
                                                        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-muted/30 border border-border/20">
                                                            <Layout className="h-3.5 w-3.5 text-primary/60 shrink-0" />
                                                            <div className="min-w-0">
                                                                <p className="text-[11px] font-bold text-foreground truncate">{task.instance?.name || '—'}</p>
                                                                <p className="text-[10px] text-muted-foreground truncate">{task.instance?.client?.name || '—'}</p>
                                                            </div>
                                                        </div>

                                                        {/* Grid details */}
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <div className="flex flex-col gap-1 p-2 rounded-xl bg-muted/20 border border-border/10">
                                                                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                                                                    <Users className="h-2.5 w-2.5" /> Assigned
                                                                </span>
                                                                <p className="text-[11px] font-semibold text-foreground truncate">{task.assigned_user?.name || '—'}</p>
                                                            </div>
                                                            <div className="flex flex-col gap-1 p-2 rounded-xl bg-muted/20 border border-border/10">
                                                                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                                                                    <Calendar className="h-2.5 w-2.5" /> Due Date
                                                                </span>
                                                                <p className={cn("text-[11px] font-semibold truncate", isOverdue ? "text-red-500" : "text-foreground")}>
                                                                    {task.due_date
                                                                        ? new Date(task.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                                                                        : '—'}
                                                                </p>
                                                            </div>
                                                            <div className="flex flex-col gap-1 p-2 rounded-xl bg-muted/20 border border-border/10">
                                                                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                                                                    <Clock className="h-2.5 w-2.5" /> Turnaround
                                                                </span>
                                                                <p className="text-[11px] font-semibold text-foreground">
                                                                    {task.turnaround_minutes ? `${Math.round(task.turnaround_minutes / 60)}h` : '—'}
                                                                </p>
                                                            </div>
                                                            <div className="flex flex-col gap-1 p-2 rounded-xl bg-muted/20 border border-border/10">
                                                                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Type</span>
                                                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold w-fit ${task.is_manual ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'}`}>
                                                                    {task.is_manual ? 'Manual' : 'Workflow'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}

                                            {/* Mobile pagination */}
                                            <div className="flex items-center justify-between py-2">
                                                <span className="text-xs text-muted-foreground">
                                                    {totalCount > 0 ? `${(page - 1) * limit + 1}–${Math.min(page * limit, totalCount)} of ${totalCount}` : 'No results'}
                                                </span>
                                                <div className="flex items-center gap-1 bg-background/50 p-1 rounded-xl border border-border/20">
                                                    <Button variant="ghost" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="h-8 w-8 p-0 rounded-lg">
                                                        <ChevronLeft className="h-4 w-4" />
                                                    </Button>
                                                    <span className="text-xs font-bold text-primary px-2">{page} of {totalPages}</span>
                                                    <Button variant="ghost" size="sm" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages} className="h-8 w-8 p-0 rounded-lg">
                                                        <ChevronRight className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            )}
                        </div>

                        {/* for large screens */}

                        <div className='hidden sm:block w-full'>

                            {activeTab !== 'reviewedTasks' && activeTab !== 'upcomingReviews' && (loading && tabTasks.length === 0 ? (
                                <div className="flex items-center justify-center py-20 bg-blur">
                                    <Loader />
                                </div>
                            ) : tabTasks.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 border border-dashed border-border rounded-xl text-muted-foreground">
                                    <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                                        <Inbox className="h-8 w-8 opacity-30" />
                                    </div>
                                    <p className="font-medium">No tasks found</p>
                                    <p className="text-sm mt-1">
                                        {search ? 'Try a different search term.' : 'No tasks in this category yet.'}
                                    </p>
                                </div>
                            ) : (
                                <div className="rounded-xl border border-border overflow-hidden overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-muted/50 text-muted-foreground">
                                            <tr>
                                                <th className="text-left px-4 py-3 font-medium">Task</th>
                                                <th className="text-left px-4 py-3 font-medium">Instance / Client</th>
                                                <th className="text-left px-4 py-3 font-medium">Assigned To</th>
                                                <th className="text-left px-4 py-3 font-medium">Turnaround</th>
                                                <th className="text-left px-4 py-3 font-medium">Status</th>
                                                <th className="text-left px-4 py-3 font-medium">Due Date</th>
                                                <th className="text-left px-4 py-3 font-medium">Checklist</th>
                                                <th className="text-left px-4 py-3 font-medium">Links</th>
                                                <th className="text-left px-4 py-3 font-medium">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {tabTasks?.map(task => {
                                                const cfg = STATUS_STYLE[task.status] || STATUS_STYLE.LOCKED;
                                                const checklist = task.task_checklist_progress || [];
                                                const checkedCount = checklist.filter((i: any) => i.is_checked).length;
                                                const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'COMPLETED' && isUserActiveActor(task, user?.id);
                                                const isApproval = isApprovalQueueTask(task);

                                                return (
                                                    <tr
                                                        key={task.id}
                                                        className={`
                                                transition-colors
                                                ${task?.last_rejected_by
                                                                ? "bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40"
                                                                : "bg-card hover:bg-muted/30"
                                                            }`}
                                                    >
                                                        {/* Task */}
                                                        <td className="px-4 py-3">
                                                            <div className="font-medium text-foreground flex items-center gap-1.5">
                                                                {task.title}
                                                                {(task as any).is_manual && (
                                                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 shrink-0">
                                                                        Manual
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="text-xs text-muted-foreground mt-0.5">
                                                                {(task as any).is_manual ? 'Ad-hoc task' : `Step ${task.task_order}`}
                                                                {task.status === 'REJECTED' && task.last_rejection_comment && (
                                                                    <span className="text-red-500 ml-1">· Feedback available</span>
                                                                )}
                                                            </div>

                                                        </td>

                                                        {/* Instance / Client */}
                                                        <td className="px-4 py-3">
                                                            <div className="font-medium text-sm">{task.instance?.name || '—'}</div>
                                                            <div className="text-xs text-muted-foreground">{task?.instance?.client?.name || '—'}</div>
                                                        </td>

                                                        {/* Assigned To */}
                                                        <td className="px-4 py-3">
                                                            <div className="text-sm font-medium text-foreground">
                                                                {task.assigned_user?.name || '—'}
                                                            </div>
                                                            <div className="text-xs text-muted-foreground capitalize">
                                                                {task.assigned_role || ''}
                                                            </div>
                                                        </td>

                                                        {/* Turnaround — shows SLA window in working hours */}
                                                        <td className="px-4 py-3 text-xs text-muted-foreground">
                                                            {(() => {
                                                                const myLevel = task.task_approval_levels?.find((al: any) => al.level_number === task.current_level);
                                                                const displayTurnaround = (task.status === 'PENDING_APPROVAL' && myLevel) ? myLevel.allocated_minutes : task.turnaround_minutes;
                                                                return displayTurnaround
                                                                    ? <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{Math.round(displayTurnaround / 60)}h</span>
                                                                    : '—';
                                                            })()}
                                                        </td>

                                                        {/* Status */}
                                                        <td className="px-4 py-3">
                                                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${cfg.bg} ${cfg.color}`}>
                                                                {cfg.label}
                                                            </span>
                                                            {/* Live overdue warning for non-completed tasks */}
                                                            {isOverdue && (
                                                                <span className="ml-1.5 inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                                                                    Overdue
                                                                </span>
                                                            )}
                                                            {/* Final TAT result — only on COMPLETED tasks */}
                                                            {task.status === 'COMPLETED' && (
                                                                <TatBadge submittedAt={task.submitted_at} dueDate={task.due_date} />
                                                            )}
                                                        </td>

                                                        {/* Due Date */}
                                                        <td className="px-4 py-3 text-muted-foreground text-xs">
                                                            {task.due_date
                                                                ? new Date(task.due_date).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
                                                                : '—'}
                                                        </td>

                                                        {/* Checklist */}
                                                        <td className="px-4 py-3 text-xs text-muted-foreground">
                                                            {checklist.length > 0 ? `${checkedCount}/${checklist.length}` : '—'}
                                                        </td>

                                                        {/* Links */}
                                                        <td className="px-4 py-3 text-xs text-muted-foreground">
                                                            {task.links ? (
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); setLinksDialogTask(task); }}
                                                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-600 font-semibold text-[11px] transition-colors border border-blue-200"
                                                                >
                                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
                                                                    {(() => {
                                                                        const items = parseLinkItems(task.links);
                                                                        const linksCount = items.filter(i => i.type === 'link').length;
                                                                        return `${linksCount} link${linksCount !== 1 ? 's' : ''}`;
                                                                    })()}
                                                                </button>
                                                            ) : '—'}
                                                        </td>

                                                        {/* Actions */}
                                                        <td className="px-4 py-3">
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger>
                                                                    <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                                                                        <Settings2 className="h-4 w-4" />
                                                                    </Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end" className="w-48">
                                                                    <DropdownMenuItem
                                                                        onClick={() => {
                                                                            if ((task as any).is_manual) {
                                                                                setManualViewTask(task);
                                                                            } else {
                                                                                setDetailTask(task);
                                                                            }
                                                                        }}
                                                                    >
                                                                        <Eye className="h-4 w-4 mr-2" />
                                                                        View Details
                                                                    </DropdownMenuItem>

                                                                    {(task.status === 'IN_PROGRESS' || task.status === 'REJECTED') && !isApproval && (
                                                                        <DropdownMenuItem
                                                                            onClick={() => {
                                                                                setShowSubmitBox(true);
                                                                                setSelectedActionTask(task);
                                                                                setLocalChecked({});
                                                                            }}
                                                                            disabled={submitting}
                                                                        >
                                                                            <Send className="h-4 w-4 mr-2" />
                                                                            {task.approval_required ? 'Submit' : 'Complete'}
                                                                        </DropdownMenuItem>
                                                                    )}

                                                                    {task.last_rejection_comment && (
                                                                        <DropdownMenuItem
                                                                            onClick={() => setRejectionTask(task)}
                                                                            className="text-red-600 focus:text-red-600"
                                                                        >
                                                                            <RefreshCw className="h-4 w-4 mr-2" />
                                                                            View Rejection
                                                                        </DropdownMenuItem>
                                                                    )}

                                                                    {/* removed from current workflow may add it later */}
                                                                    {/* {isOverdue && (
                                                                        <DropdownMenuItem
                                                                            onClick={() => setExtendOpenTask(task)}
                                                                            className="text-red-600 focus:text-red-600"
                                                                        >
                                                                            <Clock className="h-4 w-4 mr-2" />
                                                                            Request TAT Extension
                                                                        </DropdownMenuItem>
                                                                    )} */}

                                                                    {isApproval && (
                                                                        <>
                                                                            <DropdownMenuSeparator />
                                                                            <DropdownMenuItem
                                                                                onClick={() => {
                                                                                    setSelectedActionTask(task);
                                                                                    setLocalChecked({});
                                                                                    setApproveModalOpen(true);
                                                                                }}
                                                                                className="text-green-600 focus:text-green-600"
                                                                            >
                                                                                <ThumbsUp className="h-4 w-4 mr-2" />
                                                                                Approve
                                                                            </DropdownMenuItem>
                                                                            <DropdownMenuItem
                                                                                onClick={() => {
                                                                                    setSelectedActionTask(task);
                                                                                    setRejectModalOpen(true);
                                                                                }}
                                                                                className="text-red-600 focus:text-red-600"
                                                                            >
                                                                                <ThumbsDown className="h-4 w-4 mr-2" />
                                                                                Reject
                                                                            </DropdownMenuItem>
                                                                        </>
                                                                    )}
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                    <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-card">
                                        <div className="flex items-center gap-4">
                                            {/* <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <span>Items per page:</span>
                                    <select
                                        className="h-8 px-2 py-1 border border-border rounded bg-background"
                                        value={limit}
                                        onChange={e => setLimit(Number(e.target.value))}
                                    >
                                        {[10, 20, 50, 100].map(v => (
                                            <option key={v} value={v}>{v}</option>
                                        ))}
                                    </select>
                                </div> */}
                                            <div className="text-xs text-muted-foreground">
                                                {totalCount > 0 ? (
                                                    `Showing ${(page - 1) * limit + 1} to ${Math.min(page * limit, totalCount)} of ${totalCount} results`
                                                ) : (
                                                    'No results'
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                                disabled={page === 1}
                                                className="h-8 w-8 p-0"
                                            >
                                                <ChevronLeft className="h-4 w-4" />
                                            </Button>
                                            <span className="text-xs font-medium px-2">
                                                {page} of {totalPages}
                                            </span>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setPage(p => p + 1)}
                                                disabled={page >= totalPages}
                                                className="h-8 w-8 p-0"
                                            >
                                                <ChevronRight className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {/* ── Reviews Tab: My Approval History ── */}
                            {activeTab === 'reviewedTasks' && (
                                reviewedTasks.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-20 border border-dashed border-border rounded-xl text-muted-foreground">
                                        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                                            <ListChecks className="h-8 w-8 opacity-30" />
                                        </div>
                                        <p className="font-medium">No reviews yet</p>
                                        <p className="text-sm mt-1">Tasks you approve or reject will appear here.</p>
                                    </div>
                                ) : (
                                    <div className="rounded-xl border border-border overflow-hidden overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="bg-muted/50 text-muted-foreground">
                                                <tr>
                                                    <th className="text-left px-4 py-3 font-medium">Task</th>
                                                    <th className="text-left px-4 py-3 font-medium">Instance / Client</th>
                                                    <th className="text-left px-4 py-3 font-medium">Worker</th>
                                                    <th className="text-left px-4 py-3 font-medium">Action</th>
                                                    <th className="text-left px-4 py-3 font-medium">Level</th>
                                                    <th className="text-left px-4 py-3 font-medium">Comment</th>
                                                    <th className="text-left px-4 py-3 font-medium">Date</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border">
                                                {reviewedTasks.map((entry: any) => (
                                                    <tr key={entry.id} className="bg-card hover:bg-muted/30 transition-colors">
                                                        {/* Task */}
                                                        <td className="px-4 py-3">
                                                            <div className="font-medium text-foreground">{entry.task?.title || '—'}</div>
                                                            <div className="text-xs text-muted-foreground">
                                                                Step {entry.task?.task_order}
                                                                {/* {entry.task?.assigned_role || 'Unassigned'} */}
                                                            </div>
                                                        </td>

                                                        {/* Instance / Client */}
                                                        <td className="px-4 py-3">
                                                            <div className="font-medium text-sm">{entry.task?.instance?.name || '—'}</div>
                                                            <div className="text-xs text-muted-foreground">{entry.task?.instance?.client?.name || '—'}</div>
                                                        </td>

                                                        {/* Worker (assigned user) */}
                                                        <td className="px-4 py-3">
                                                            <div className="text-sm font-medium">{entry.task?.assigned_user?.name || '—'}</div>
                                                            <div className="text-xs text-muted-foreground">{entry.task?.assigned_user?.email || ''}</div>
                                                        </td>

                                                        {/* Action badge */}
                                                        <td className="px-4 py-3">
                                                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${entry.action === 'APPROVED'
                                                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                                                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                                                }`}>
                                                                {entry.action === 'APPROVED' ? <ThumbsUp className="h-3 w-3" /> : <ThumbsDown className="h-3 w-3" />}
                                                                {entry.action === 'APPROVED' ? 'Approved' : 'Rejected'}
                                                            </span>
                                                        </td>

                                                        {/* Level */}
                                                        <td className="px-4 py-3 text-xs text-muted-foreground">
                                                            Level {entry.level_number}
                                                        </td>

                                                        {/* Comment */}
                                                        <td className="px-4 py-3 text-xs text-muted-foreground max-w-[200px]">
                                                            {entry.comment
                                                                ? <span className="italic">"{entry.comment}"</span>
                                                                : <span className="opacity-40">—</span>
                                                            }
                                                        </td>

                                                        {/* Date */}
                                                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                                                            {entry.created_at
                                                                ? new Date(entry.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                                                                : '—'}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-card">
                                            <div className="flex items-center gap-4">
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                    <span>Items per page:</span>
                                                    <UISelect
                                                        value={limit.toString()}
                                                        onValueChange={(val) => setLimit(Number(val))}
                                                        className="w-16"
                                                        contentWidth="min-w-24"
                                                        options={[
                                                            { value: '10', label: '10' },
                                                            { value: '20', label: '20' },
                                                            { value: '50', label: '50' },
                                                            { value: '100', label: '100' },
                                                        ]}
                                                    />
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    {totalCount > 0 ? (
                                                        `Showing ${(page - 1) * limit + 1} to ${Math.min(page * limit, totalCount)} of ${totalCount} results`
                                                    ) : (
                                                        'No results'
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                                    disabled={page === 1}
                                                    className="h-8 w-8 p-0"
                                                >
                                                    <ChevronLeft className="h-4 w-4" />
                                                </Button>
                                                <span className="text-xs font-medium px-2">
                                                    {page} of {totalPages}
                                                </span>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setPage(p => p + 1)}
                                                    disabled={page >= totalPages}
                                                    className="h-8 w-8 p-0"
                                                >
                                                    <ChevronRight className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                )
                            )}


                            {/* ── Upcoming Reviews Tab ── */}
                            {activeTab === 'upcomingReviews' && (
                                tabTasks.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-20 border border-dashed border-border rounded-xl text-muted-foreground">
                                        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                                            <CalendarClock className="h-8 w-8 opacity-30" />
                                        </div>
                                        <p className="font-medium">No upcoming reviews</p>
                                        <p className="text-sm mt-1">You haven't been assigned as a reviewer for any active tasks yet.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300 text-xs">
                                            <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                                            <span>These tasks are assigned to you for review. They will move to your <strong>Approval Queue</strong> once the worker submits them. You cannot take action here.</span>
                                        </div>
                                        <div className="rounded-xl border border-border overflow-hidden overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead className="bg-muted/50 text-muted-foreground">
                                                    <tr>
                                                        <th className="text-left px-4 py-3 font-medium">Task</th>
                                                        <th className="text-left px-4 py-3 font-medium">Instance / Client</th>
                                                        <th className="text-left px-4 py-3 font-medium">Assigned To</th>
                                                        <th className="text-left px-4 py-3 font-medium">Turnaround</th>
                                                        <th className="text-left px-4 py-3 font-medium">Status</th>
                                                        <th className="text-left px-4 py-3 font-medium">Due Date</th>
                                                        <th className="text-left px-4 py-3 font-medium">Type</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-border">
                                                    {tabTasks.map((task: any) => {
                                                        const cfg = STATUS_STYLE[task.status] || STATUS_STYLE.LOCKED;
                                                        const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'COMPLETED' && isUserActiveActor(task, user?.id);
                                                        return (
                                                            <tr key={task.id} className="bg-card hover:bg-muted/30 transition-colors">
                                                                {/* Task */}
                                                                <td className="px-4 py-3">
                                                                    <div className="font-medium text-foreground">{task.title}</div>
                                                                    <div className="text-xs text-muted-foreground mt-0.5">
                                                                        {task.is_manual ? 'Ad-hoc task' : `Step ${task.task_order}`}
                                                                    </div>
                                                                </td>

                                                                {/* Instance / Client */}
                                                                <td className="px-4 py-3">
                                                                    <div className="font-medium text-sm">{task.instance?.name || '—'}</div>
                                                                    <div className="text-xs text-muted-foreground">{task.instance?.client?.name || '—'}</div>
                                                                </td>

                                                                {/* Assigned To */}
                                                                <td className="px-4 py-3">
                                                                    <div className="text-sm font-medium text-foreground">{task.assigned_user?.name || '—'}</div>
                                                                    <div className="text-xs text-muted-foreground capitalize">{task.assigned_role || ''}</div>
                                                                </td>

                                                                {/* Turnaround */}
                                                                <td className="px-4 py-3 text-xs text-muted-foreground">
                                                                    {task.turnaround_minutes
                                                                        ? <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{Math.round(task.turnaround_minutes / 60)}h</span>
                                                                        : '—'}
                                                                </td>

                                                                {/* Status */}
                                                                <td className="px-4 py-3">
                                                                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${cfg.bg} ${cfg.color}`}>
                                                                        {cfg.label}
                                                                    </span>
                                                                    {isOverdue && (
                                                                        <span className="ml-1.5 inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                                                                            Overdue
                                                                        </span>
                                                                    )}
                                                                </td>

                                                                {/* Due Date */}
                                                                <td className="px-4 py-3 text-muted-foreground text-xs">
                                                                    {task.due_date
                                                                        ? new Date(task.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                                                                        : '—'}
                                                                </td>

                                                                {/* Type */}
                                                                <td className="px-4 py-3">
                                                                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${task.is_manual ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'}`}>
                                                                        {task.is_manual ? 'Manual' : 'Workflow'}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                            <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-card">
                                                <div className="text-xs text-muted-foreground">
                                                    {totalCount > 0
                                                        ? `Showing ${(page - 1) * limit + 1} to ${Math.min(page * limit, totalCount)} of ${totalCount} results`
                                                        : 'No results'}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="h-8 w-8 p-0">
                                                        <ChevronLeft className="h-4 w-4" />
                                                    </Button>
                                                    <span className="text-xs font-medium px-2">{page} of {totalPages}</span>
                                                    <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages} className="h-8 w-8 p-0">
                                                        <ChevronRight className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            )}


                        </div>

                    </div>
                </div >
                {/* how to modal */}
                <MemberHowToModal userName={user?.name} open={isHowToOpen} onOpenChange={() => setIsHowToOpen(false)} />
                {/* ── Reject Modal ── */}
                < RejectModal rejectModalOpen={rejectModalOpen} setRejectModalOpen={setRejectModalOpen} comment={comment} setComment={setComment} handleReject={handleReject} submitting={submitting} />


                {/* ── Approve Modal ── */}
                < Dialog open={approveModalOpen} onOpenChange={setApproveModalOpen} >
                    <DialogContent className="sm:max-w-lg">
                        <DialogHeader>
                            <DialogTitle>Review Task</DialogTitle>
                            <DialogDescription>
                                {selectedActionTask?.current_level && selectedActionTask.approval_levels > 1
                                    ? `You are reviewing at Level ${selectedActionTask.current_level} of ${selectedActionTask.approval_levels}.`
                                    : 'Review the checklist to approve or reject this task.'}
                            </DialogDescription>
                        </DialogHeader>

                        {/* ── Checklist in Review Modal ── */}
                        {selectedActionTask && (() => {
                            const displayTask = allTasks.find(t => t.id === selectedActionTask.id) || workerTasks.find(t => t.id === selectedActionTask.id) || selectedActionTask;
                            const checklist = displayTask.task_checklist_progress || [];

                            if (checklist.length === 0) return null;

                            return (
                                <div className="space-y-3 py-2 border-y border-border my-2">
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Review Checklist</p>
                                        {checklist.length > 1 && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 px-2 text-[10px] font-bold uppercase tracking-tight text-primary hover:text-primary hover:bg-primary/5 rounded-lg transition-all"
                                                onClick={() => handleSelectAll(checklist)}
                                            >
                                                {checklist.every((item: any) => localChecked[item.id])
                                                    ? 'Deselect All'
                                                    : 'Select All'}
                                            </Button>
                                        )}
                                    </div>
                                    <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                                        {displayTask?.task_checklist_progress?.slice()
                                            .sort((a, b) => a.sort_order - b.sort_order)
                                            .map(item => (
                                                <div key={item.id} className={`rounded-lg border p-3 transition-all ${localChecked[item.id] ? 'bg-green-50/50 border-green-200/50 dark:bg-green-900/10 dark:border-green-800/20' : 'bg-card border-border'}`}>
                                                    <div className="flex flex-col gap-2">
                                                        <div className="flex items-start justify-between gap-3">
                                                            <button
                                                                onClick={() => handleLocalToggle(item.id)}
                                                                className="flex items-center gap-3 text-left w-full group"
                                                            >
                                                                {localChecked[item.id]
                                                                    ? <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                                                                    : <Square className="h-4 w-4 text-muted-foreground shrink-0 group-hover:text-foreground" />
                                                                }
                                                                <span className={`text-sm ${localChecked[item.id] ? 'text-muted-foreground line-through' : 'text-foreground font-medium'}`}>
                                                                    {item.item_text}
                                                                </span>
                                                            </button>
                                                            {!item.requires_input ? (
                                                                <span className={`px-2 py-0.5 rounded text-[10px] whitespace-nowrap font-bold ${item.status === 'Done' ? 'bg-green-100 text-green-700' : item.status === 'Not Needed' ? 'bg-gray-100 text-gray-700' : 'bg-amber-100 text-amber-700'}`}>
                                                                    {item.status || 'Pending'}
                                                                </span>
                                                            ) : null}
                                                        </div>
                                                        {(item.requires_input || item.input_value) && (
                                                            <div className="text-xs text-muted-foreground bg-muted/50 rounded px-2.5 py-1.5 ml-7">
                                                                {item.input_label && <span className="font-medium">{item.input_label}: </span>}
                                                                {item.input_value
                                                                    ? renderInputValue(item.input_value)
                                                                    : <span className="italic opacity-50">No value entered</span>
                                                                }
                                                            </div>
                                                        )}
                                                        {/* Add Reviewer Comment Box */}
                                                        <div className="mt-2 ml-7">
                                                            <div className="flex items-center gap-2">
                                                                <input
                                                                    type="text"
                                                                    placeholder="Add specific feedback for this item (optional)..."
                                                                    className="flex-1 h-8 rounded-md border border-gray-200 px-3 text-xs focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
                                                                    onBlur={e => {
                                                                        const val = e.target.value.trim();
                                                                        if (val) {
                                                                            const newComments = [...(item.reviewer_comments || []), { reviewer_id: user?.id, reviewer_name: user?.name, comment: val, created_at: new Date().toISOString() }];
                                                                            toggleChecklistItem(selectedActionTask.id, item.id, false, item.input_value, null, newComments);
                                                                            e.target.value = '';
                                                                            addToast({ title: 'Feedback Added', description: 'Item marked as unchecked with your comment.', variant: 'success' });
                                                                        }
                                                                    }}
                                                                />
                                                            </div>
                                                            {item.reviewer_comments && item.reviewer_comments.length > 0 && (
                                                                <div className="mt-2 bg-red-50/50 border border-red-100 rounded p-2 text-xs space-y-1 text-red-600">
                                                                    <p className="font-bold">Previous Feedback:</p>
                                                                    {item.reviewer_comments.map((c: any, idx: number) => (
                                                                        <div key={idx}><span className="font-semibold">{c.reviewer_name}: </span>{c.comment}</div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            )
                        })()}

                        {/* ── Client Approval Toggle (Only on last level) ──  */}
                        {/* Not needed currently as the approvers are clicking on it mistakenly */}
                        {/* {selectedActionTask && selectedActionTask.current_level >= selectedActionTask.approval_levels && (
                            <div className="mt-2 p-4 rounded-xl border border-amber-200/60 bg-amber-50/30 dark:border-amber-900/30 dark:bg-amber-900/10">
                                <label className="flex items-start gap-3 cursor-pointer group">
                                    <div className="pt-0.5">
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 rounded border-border text-amber-500 focus:ring-amber-500/50 cursor-pointer"
                                            checked={clientApprovalNeeded}
                                            onChange={(e) => setClientApprovalNeeded(e.target.checked)}
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-semibold text-foreground group-hover:text-amber-600 transition-colors">Client Approval Needed</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">Pause this instance after approval to await client feedback.</p>
                                        {clientApprovalNeeded && (
                                            <div className="mt-2 text-[11px] font-bold text-amber-700 bg-amber-100/50 dark:bg-amber-900/30 dark:text-amber-400 p-2 rounded flex items-start gap-1.5 border border-amber-200/50 dark:border-amber-800/50">
                                                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                                <p>Warning: The next task will remain locked until the client approves this deliverable.</p>
                                            </div>
                                        )}
                                    </div>
                                </label>
                            </div>
                        )} */}

                        <textarea
                            className="w-full border border-border rounded-lg p-3 text-sm bg-background resize-none h-20"
                            placeholder="Overall review comment (required for rejection)..."
                            value={comment}
                            onChange={e => setComment(e.target.value)}
                        />
                        <DialogFooter>
                            <DialogClose><Button variant="outline">Cancel</Button></DialogClose>
                            <Button
                                variant="destructive"
                                onClick={handleReject}
                                disabled={rejectLoading || submitting || !comment.trim().length || (selectedActionTask?.task_checklist_progress?.some((i: any) => !localChecked[i.id]) ?? false)}
                            >
                                <XCircle className="h-4 w-4 mr-2" /> Reject Task
                            </Button>
                            <Button
                                className="bg-green-600 hover:bg-green-700 text-white"
                                onClick={handleApprove}
                                disabled={submitting || rejectLoading || (selectedActionTask?.task_checklist_progress?.some((i: any) => !localChecked[i.id]) ?? false)}
                            >
                                <CheckCircle2 className="h-4 w-4 mr-2" /> Confirm Approve
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog >

                <InstanceMemberModal
                    task={selectedActionTask}
                    open={isTaskDetailsOpen}
                    onOpenChange={setIsTaskDetailsOpen}
                />

                {/* Manual task details modal */}
                <ViewModal task={manualViewTask as any} onClose={() => setManualViewTask(null)} />

                {/* ── Rejection Reason Modal ── */}
                <RejectionReasonModal rejectionTask={rejectionTask} setRejectionTask={setRejectionTask} setSelectedActionTask={setSelectedActionTask} setShowSubmitBox={setShowSubmitBox} setLocalChecked={setLocalChecked} />

                {/* ── Task Details Modal (with AI Copy) ── */}
                <TaskDetailsModal detailTask={detailTask} setDetailTask={setDetailTask} />

                {/* ── Submit Modal ── */}
                <Dialog open={showSubmitBox} onOpenChange={setShowSubmitBox}>
                    <DialogContent className="sm:max-w-xl">
                        <DialogHeader>
                            <DialogTitle>Submit Task</DialogTitle>
                            <DialogDescription>
                                {selectedActionTask?.current_level && selectedActionTask.approval_levels > 1
                                    ? `You are submitting at Level ${selectedActionTask.current_level} of ${selectedActionTask.approval_levels}.`
                                    : 'Confirm your submission of this task.'}
                            </DialogDescription>
                        </DialogHeader>

                        {/* ── Checklist in Submit Modal ── */}
                        {selectedActionTask && (() => {
                            const displayTask = allTasks.find((t: any) => t.id === selectedActionTask.id) || workerTasks.find((t: any) => t.id === selectedActionTask.id) || selectedActionTask;
                            return displayTask.task_checklist_progress && displayTask.task_checklist_progress.length > 0 && (
                                <div className="space-y-3 py-2 border-y border-border my-2">
                                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Completion Checklist <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">({displayTask.task_checklist_progress.length} items)</span></p>
                                    <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                                        {displayTask.task_checklist_progress.slice()
                                            .sort((a: any, b: any) => a.sort_order - b.sort_order)
                                            .map((item: any, index: number) => (
                                                <div key={item.id} className={`rounded-lg border p-3 transition-all ${item.is_checked ? 'bg-green-50/50 border-green-200/50 dark:bg-green-900/10 dark:border-green-800/20' : 'bg-card border-border'}`}>
                                                    <div className="flex flex-col gap-2">
                                                        <div className="flex items-center justify-between gap-3">
                                                            <span className={`text-sm ${item.is_checked ? 'text-muted-foreground' : 'text-foreground font-medium'}`}>
                                                                {index + 1}. {item.item_text}
                                                            </span>
                                                            {item.requires_input ? (
                                                                <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded font-medium shrink-0">Input Required</span>
                                                            ) : (
                                                                <select
                                                                    className="h-8 px-2 py-1 text-xs border border-border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary w-[120px]"
                                                                    value={item.status || ''}
                                                                    onChange={e => {
                                                                        const val = e.target.value;
                                                                        toggleChecklistItem(selectedActionTask.id, item.id, !!val, undefined, val || null);
                                                                    }}
                                                                >
                                                                    <option value="" disabled>Select...</option>
                                                                    <option value="Done">Done</option>
                                                                    <option value="Not Needed">Not Needed</option>
                                                                </select>
                                                            )}
                                                        </div>
                                                        {item.requires_input && (
                                                            <div className="pt-1">
                                                                <input
                                                                    type="text"
                                                                    className="w-full h-9 rounded-md border border-gray-200 px-3 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                                                                    placeholder={item.input_placeholder || 'Enter value...'}
                                                                    defaultValue={item.input_value || ''}
                                                                    onBlur={e => {
                                                                        const val = e.target.value;
                                                                        if (val !== (item.input_value || '')) {
                                                                            toggleChecklistItem(selectedActionTask.id, item.id, val.trim().length > 0, val);
                                                                        }
                                                                    }}
                                                                />
                                                                {item.input_label && <p className="text-[10px] text-muted-foreground mt-1">{item.input_label}</p>}
                                                            </div>
                                                        )}
                                                        {item.reviewer_comments && item.reviewer_comments.length > 0 && (
                                                            <div className="mt-1 bg-red-50/50 border border-red-100 rounded p-2 text-xs space-y-1 text-red-600">
                                                                <p className="font-bold">Reviewer Feedback:</p>
                                                                {item.reviewer_comments.map((c: any, idx: number) => (
                                                                    <div key={idx}><span className="font-semibold">{c.reviewer_name}: </span>{c.comment}</div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            )
                        })()}
                        <div className="py-2">
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Deliverable links (optional)</p>
                            <Textarea
                                className="w-full border border-border rounded-lg p-3 text-sm bg-background resize-none h-20"
                                placeholder="Paste google drive links, figma or any other deliverable links here (optional)…"
                                value={links}
                                onChange={e => setLinks(e.target.value)}
                            />
                            <DialogFooter className='py-2'>
                                <DialogClose><Button variant="outline">Cancel</Button></DialogClose>
                                <Button
                                    className="bg-green-600 hover:bg-green-700 text-white"
                                    onClick={() => handleSubmit(selectedActionTask!)}
                                    disabled={submitting || (() => {
                                        const displayTask = allTasks.find(t => t.id === selectedActionTask?.id) || workerTasks.find(t => t.id === selectedActionTask?.id) || selectedActionTask;
                                        return displayTask?.task_checklist_progress?.some((i: any) => !i.is_checked) ?? false;
                                    })()}
                                >
                                    <CheckCircle2 className="h-4 w-4 mr-2" /> Confirm Submit
                                </Button>
                            </DialogFooter>

                        </div>
                    </DialogContent>

                </Dialog>

            </div >

            {/* ── Links Dialog ── */}
            {/* Links Dialog */}
            <LinksDialog
                task={linksDialogTask}
                onClose={() => setLinksDialogTask(null)}
            />


            {extendOpenTask && (
                <RequestSLAExtensionModal
                    isOpen={!!extendOpenTask}
                    task={extendOpenTask}
                    onClose={() => setExtendOpenTask(null)}
                />
            )}

        </>
    );
}

