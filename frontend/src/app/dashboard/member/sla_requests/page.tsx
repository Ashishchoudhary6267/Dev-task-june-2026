'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '@/lib/zustand/user/user';
import { useSLAExtensionStore, SLAExtensionRequest } from '@/lib/zustand/sla-extension/sla-extension';
import { useRouter } from 'next/navigation';
import {
    CalendarClock,
    Search,
    RefreshCw,
    Clock,
    CheckCircle2,
    XCircle,
    FileText,
    ChevronLeft,
    ChevronRight,
    Eye,
    SlidersHorizontal,
    ArrowUpDown,
    Calendar,
    ArrowUpRight,
    UserCheck,
    MessageSquare,
    CornerDownRight
} from 'lucide-react';
import { Button, Badge, Input, Card, CardContent, UISelect } from '@/components/ui';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogClose
} from '@/components/ui/dialog';
import Loader from '@/components/ui/loader';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

const formatDate = (dateString?: string | null) => {
    if (!dateString || dateString === '—' || dateString === '-') return '—';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

const formatDateOnly = (dateString?: string | null) => {
    if (!dateString || dateString === '—' || dateString === '-') return '—';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
};

const STATUS_CONFIG = {
    PENDING: {
        label: 'Pending Review',
        color: 'text-amber-700 dark:text-amber-300 border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-900/30',
        badge: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800',
        icon: Clock
    },
    APPROVED: {
        label: 'Approved',
        color: 'text-green-700 dark:text-green-300 border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-900/30',
        badge: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-800',
        icon: CheckCircle2
    },
    REJECTED: {
        label: 'Returned / Rejected',
        color: 'text-red-700 dark:text-red-300 border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-900/30',
        badge: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800',
        icon: XCircle
    }
};

export default function MemberSLARequestsPage() {
    const router = useRouter();
    const { user, isAuthenticated } = useAuthStore();
    const {
        myRequests,
        myLoading,
        myError,
        fetchMyRequests
    } = useSLAExtensionStore();
    const { addToast } = useToast();

    // Local filters
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
    const [datePeriod, setDatePeriod] = useState<string>('ALL');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    const [sortBy, setSortBy] = useState('requested_at');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    // UI states
    const [page, setPage] = useState(1);
    const [limit] = useState(10);
    const [selectedRequest, setSelectedRequest] = useState<SLAExtensionRequest | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [showFilters, setShowFilters] = useState(false);

    // Initial fetch
    useEffect(() => {
        if (!isAuthenticated) {
            router.replace('/login');
            return;
        }
        if (user?.platform_role === 'admin') {
            router.replace('/dashboard/admin');
            return;
        }
        loadRequests();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAuthenticated, user, router]);

    // Refetch on filters changing
    const loadRequests = () => {
        let dateFrom = undefined;
        let dateTo = undefined;

        if (datePeriod !== 'ALL' && datePeriod !== 'CUSTOM') {
            const now = new Date();
            const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

            if (datePeriod === 'TODAY') {
                dateFrom = startOfToday.toISOString();
            } else if (datePeriod === 'LAST_7') {
                const last7 = new Date(startOfToday);
                last7.setDate(last7.getDate() - 7);
                dateFrom = last7.toISOString();
            } else if (datePeriod === 'LAST_30') {
                const last30 = new Date(startOfToday);
                last30.setDate(last30.getDate() - 30);
                dateFrom = last30.toISOString();
            }
        } else if (datePeriod === 'CUSTOM') {
            if (customStart) {
                dateFrom = new Date(customStart).toISOString();
            }
            if (customEnd) {
                const end = new Date(customEnd);
                end.setHours(23, 59, 59, 999);
                dateTo = end.toISOString();
            }
        }

        fetchMyRequests({
            status: statusFilter,
            search: search.trim() || undefined,
            dateFrom,
            dateTo,
            sortBy,
            sortOrder,
            page,
            limit
        });
    };

    // Trigger loading on change of page, status, period, sorting, custom dates
    useEffect(() => {
        loadRequests();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [statusFilter, datePeriod, sortBy, sortOrder, page]);

    // Custom date changes trigger reload automatically if both are entered
    useEffect(() => {
        if (datePeriod === 'CUSTOM' && customStart && customEnd) {
            loadRequests();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [customStart, customEnd, datePeriod]);

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        loadRequests();
    };

    const handleRefresh = () => {
        loadRequests();
        addToast({
            title: 'Refreshed! ⚡',
            description: 'SLA request status loaded successfully.',
            variant: 'success'
        });
    };

    // Compute Metrics summary from local requests
    const metrics = useMemo(() => {
        const result = {
            total: myRequests.length,
            pending: 0,
            approved: 0,
            rejected: 0
        };
        myRequests.forEach(req => {
            if (req.status === 'PENDING') result.pending++;
            else if (req.status === 'APPROVED') result.approved++;
            else if (req.status === 'REJECTED') result.rejected++;
        });
        return result;
    }, [myRequests]);

    // Client-side filtering & search (as secondary backup for real-time smoothness)
    const filteredRequests = useMemo(() => {
        let items = [...myRequests];

        if (search) {
            const query = search.toLowerCase();
            items = items.filter(req =>
                req.tasks?.title?.toLowerCase().includes(query) ||
                req.reason?.toLowerCase().includes(query) ||
                req.reviewer_comment?.toLowerCase().includes(query)
            );
        }

        return items;
    }, [myRequests, search]);

    const paginatedRequests = useMemo(() => {
        const startIndex = (page - 1) * limit;
        return filteredRequests.slice(startIndex, startIndex + limit);
    }, [filteredRequests, page, limit]);

    const totalPages = Math.max(1, Math.ceil(filteredRequests.length / limit));

    return (
        <div className="min-h-screen bg-background pb-12 font-sans selection:bg-primary/10">
            {/* Header section */}
            <div className="border-b border-border px-6 py-5 flex flex-col md:flex-row md:items-center justify-between bg-card/40 backdrop-blur-md sticky top-0 z-10 gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/5 border border-primary/10 flex items-center justify-center text-primary shadow-inner">
                        <CalendarClock className="h-5 w-5" />
                    </div>
                    <div className="flex flex-col">
                        <h1 className="text-xl font-bold text-foreground tracking-tight">TAT Extension Requests</h1>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Track the milestones and review status of your overdue tasks extensions.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRefresh}
                        disabled={myLoading}
                        className="h-9 px-3 hover:bg-muted font-semibold transition-all duration-300"
                    >
                        <RefreshCw className={cn("h-4 w-4 mr-2 text-muted-foreground", myLoading && "animate-spin")} />
                        Refresh
                    </Button>
                </div>
            </div>

            <div className="px-6 py-6 space-y-6 max-w-7xl mx-auto">
                {/* Metrics Overview Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Total Card */}
                    <div className="relative group overflow-hidden bg-card border border-border/60 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-500">
                        <div className="absolute -right-8 -top-8 w-24 h-24 bg-primary/5 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-700" />
                        <div className="relative z-10 flex items-center justify-between">
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Total Submitted</span>
                            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                                <FileText className="h-4 w-4" />
                            </div>
                        </div>
                        <div className="relative z-10 mt-3">
                            <h2 className="text-2xl font-black text-foreground tracking-tight">{metrics.total}</h2>
                            <p className="text-[10px] text-muted-foreground mt-1 font-medium">All historical requests</p>
                        </div>
                    </div>

                    {/* Pending Card */}
                    <div className="relative group overflow-hidden bg-card border border-border/60 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-500">
                        <div className="absolute -right-8 -top-8 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-700" />
                        <div className="relative z-10 flex items-center justify-between">
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Pending Review</span>
                            <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                                <Clock className="h-4 w-4" />
                            </div>
                        </div>
                        <div className="relative z-10 mt-3">
                            <h2 className="text-2xl font-black text-amber-600 dark:text-amber-400 tracking-tight">{metrics.pending}</h2>
                            <p className="text-[10px] text-muted-foreground mt-1 font-medium">Awaiting controller decision</p>
                        </div>
                    </div>

                    {/* Approved Card */}
                    <div className="relative group overflow-hidden bg-card border border-border/60 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-500">
                        <div className="absolute -right-8 -top-8 w-24 h-24 bg-green-500/5 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-700" />
                        <div className="relative z-10 flex items-center justify-between">
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Approved SLA</span>
                            <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 flex items-center justify-center">
                                <CheckCircle2 className="h-4 w-4" />
                            </div>
                        </div>
                        <div className="relative z-10 mt-3">
                            <h2 className="text-2xl font-black text-green-600 dark:text-green-400 tracking-tight">{metrics.approved}</h2>
                            <p className="text-[10px] text-muted-foreground mt-1 font-medium">New deadlines committed</p>
                        </div>
                    </div>

                    {/* Rejected Card */}
                    <div className="relative group overflow-hidden bg-card border border-border/60 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-500">
                        <div className="absolute -right-8 -top-8 w-24 h-24 bg-red-500/5 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-700" />
                        <div className="relative z-10 flex items-center justify-between">
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Returned Requests</span>
                            <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center justify-center">
                                <XCircle className="h-4 w-4" />
                            </div>
                        </div>
                        <div className="relative z-10 mt-3">
                            <h2 className="text-2xl font-black text-red-600 dark:text-red-400 tracking-tight">{metrics.rejected}</h2>
                            <p className="text-[10px] text-muted-foreground mt-1 font-medium">Returned for rework or denied</p>
                        </div>
                    </div>
                </div>

                {/* Filters and Controls */}
                <div className="bg-card border border-border/60 rounded-2xl p-4 shadow-sm space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        {/* Search */}
                        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by task title or extension reason..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="pl-9 h-10"
                            />
                        </form>

                        {/* Fast Filters toggles */}
                        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1">
                            <button
                                onClick={() => setStatusFilter('ALL')}
                                className={cn(
                                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                                    statusFilter === 'ALL'
                                        ? "bg-primary text-primary-foreground shadow-sm"
                                        : "bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground"
                                )}
                            >
                                All Statuses
                            </button>
                            <button
                                onClick={() => setStatusFilter('PENDING')}
                                className={cn(
                                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
                                    statusFilter === 'PENDING'
                                        ? "bg-amber-600 text-white shadow-sm"
                                        : "bg-muted/40 hover:bg-muted text-muted-foreground hover:text-amber-600"
                                )}
                            >
                                <Clock className="h-3 w-3" />
                                Pending
                            </button>
                            <button
                                onClick={() => setStatusFilter('APPROVED')}
                                className={cn(
                                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
                                    statusFilter === 'APPROVED'
                                        ? "bg-green-600 text-white shadow-sm"
                                        : "bg-muted/40 hover:bg-muted text-muted-foreground hover:text-green-600"
                                )}
                            >
                                <CheckCircle2 className="h-3 w-3" />
                                Approved
                            </button>
                            <button
                                onClick={() => setStatusFilter('REJECTED')}
                                className={cn(
                                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
                                    statusFilter === 'REJECTED'
                                        ? "bg-red-600 text-white shadow-sm"
                                        : "bg-muted/40 hover:bg-muted text-muted-foreground hover:text-red-600"
                                )}
                            >
                                <XCircle className="h-3 w-3" />
                                Returned
                            </button>
                        </div>

                        {/* Toggle advanced filters */}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowFilters(!showFilters)}
                            className={cn("h-9 font-semibold", showFilters && "bg-muted")}
                        >
                            <SlidersHorizontal className="h-4 w-4 mr-2" />
                            Filters
                        </Button>
                    </div>

                    {/* Advanced filter panels */}
                    {showFilters && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-border/60 animate-in fade-in slide-in-from-top duration-300">
                            {/* Date Period dropdown */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Date Range Period</label>
                                <UISelect
                                    value={datePeriod}
                                    onValueChange={setDatePeriod}
                                    options={[
                                        { value: 'ALL', label: 'All Time' },
                                        { value: 'TODAY', label: 'Today' },
                                        { value: 'LAST_7', label: 'Last 7 Days' },
                                        { value: 'LAST_30', label: 'Last 30 Days' },
                                        { value: 'CUSTOM', label: 'Custom Range' }
                                    ]}
                                />
                            </div>

                            {/* Sort column */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Sort Column</label>
                                <UISelect
                                    value={sortBy}
                                    onValueChange={setSortBy}
                                    options={[
                                        { value: 'requested_at', label: 'Requested At Date' },
                                        { value: 'task', label: 'Task Title' },
                                        { value: 'due_date', label: 'Suggested Deadline' },
                                        { value: 'status', label: 'Review Status' }
                                    ]}
                                />
                            </div>

                            {/* Sort order */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Sort Order</label>
                                <UISelect
                                    value={sortOrder}
                                    onValueChange={(val) => setSortOrder(val as any)}
                                    options={[
                                        { value: 'desc', label: 'Descending (Newest)' },
                                        { value: 'asc', label: 'Ascending (Oldest)' }
                                    ]}
                                />
                            </div>

                            {/* Custom Date Pickers */}
                            {datePeriod === 'CUSTOM' && (
                                <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border/40 animate-in fade-in slide-in-from-top duration-200">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-muted-foreground">Start Date</label>
                                        <div className="relative">
                                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            <input
                                                type="date"
                                                className="w-full h-10 pl-9 pr-4 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                                value={customStart}
                                                onChange={e => setCustomStart(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-muted-foreground">End Date</label>
                                        <div className="relative">
                                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            <input
                                                type="date"
                                                className="w-full h-10 pl-9 pr-4 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                                value={customEnd}
                                                onChange={e => setCustomEnd(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Main Content Area */}
                {myLoading && paginatedRequests.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 bg-card border border-border/60 rounded-2xl shadow-sm space-y-4">
                        <Loader />
                        <span className="text-xs text-muted-foreground font-semibold">Loading requests history...</span>
                    </div>
                ) : filteredRequests.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-card border border-dashed border-border rounded-2xl text-muted-foreground">
                        <div className="h-16 w-16 rounded-2xl bg-muted/60 flex items-center justify-center mb-4 border border-border/30">
                            <CalendarClock className="h-7 w-7 text-muted-foreground/60" />
                        </div>
                        <p className="font-bold text-foreground text-sm">No SLA Requests Found</p>
                        <p className="text-xs mt-1 text-center max-w-sm px-4">
                            {search ? "No extension requests match your search criteria. Try removing filters or changing search terms." : "You haven't requested any task SLA extensions during this period."}
                        </p>
                        {search && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => { setSearch(''); setStatusFilter('ALL'); setDatePeriod('ALL'); }}
                                className="mt-4"
                            >
                                Reset All Filters
                            </Button>
                        )}
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Desktop View Table */}
                        <div className="hidden md:block overflow-hidden bg-card border border-border/60 rounded-2xl shadow-sm transition-all duration-300">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-border bg-muted/20 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                        <th className="px-6 py-4">Task Details</th>
                                        <th className="px-6 py-4">Requested At</th>
                                        <th className="px-6 py-4">Suggested Deadline</th>
                                        <th className="px-6 py-4">Reason Summary</th>
                                        <th className="px-6 py-4 text-center">Status</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/60">
                                    {paginatedRequests.map(req => {
                                        const config = STATUS_CONFIG[req.status] || STATUS_CONFIG.PENDING;
                                        const StatusIcon = config.icon;

                                        return (
                                            <tr
                                                key={req.id}
                                                className="group hover:bg-muted/10 transition-colors duration-250 cursor-pointer"
                                                onClick={() => {
                                                    setSelectedRequest(req);
                                                    setIsDetailsOpen(true);
                                                }}
                                            >
                                                {/* Task Title & Project context */}
                                                <td className="px-6 py-4 max-w-xs">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-foreground text-sm line-clamp-1 group-hover:text-primary transition-colors">
                                                            {req.tasks?.title || 'Unknown Task'}
                                                        </span>
                                                        {req.tasks?.instances?.projects && (
                                                            <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mt-0.5">
                                                                {req.tasks.instances.projects.name}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Requested at */}
                                                <td className="px-6 py-4 text-xs font-semibold text-muted-foreground">
                                                    {formatDateOnly(req.requested_at)}
                                                </td>

                                                {/* Suggested deadline */}
                                                <td className="px-6 py-4 text-xs font-bold text-foreground">
                                                    {formatDateOnly(req.suggested_new_deadline)}
                                                </td>

                                                {/* Reason preview */}
                                                <td className="px-6 py-4 max-w-xs text-xs text-muted-foreground">
                                                    <span className="line-clamp-1">{req.reason}</span>
                                                </td>

                                                {/* Status Badge */}
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center justify-center">
                                                        <span className={cn(
                                                            "px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border flex items-center gap-1.5 shadow-xs",
                                                            config.color
                                                        )}>
                                                            <StatusIcon className="h-3.5 w-3.5 shrink-0" />
                                                            {req.status}
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Actions */}
                                                <td className="px-6 py-4 text-right">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedRequest(req);
                                                            setIsDetailsOpen(true);
                                                        }}
                                                        className="h-8 w-8 p-0 rounded-full hover:bg-primary/10 hover:text-primary transition-colors"
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile View Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:hidden">
                            {paginatedRequests.map(req => {
                                const config = STATUS_CONFIG[req.status] || STATUS_CONFIG.PENDING;
                                const StatusIcon = config.icon;

                                return (
                                    <div
                                        key={req.id}
                                        onClick={() => {
                                            setSelectedRequest(req);
                                            setIsDetailsOpen(true);
                                        }}
                                        className="relative bg-card border border-border/60 rounded-2xl p-5 shadow-xs flex flex-col group overflow-hidden active:scale-98 transition-all duration-300"
                                    >
                                        {/* Colored Glow Accent based on status */}
                                        <div className={cn(
                                            "absolute -right-8 -top-8 w-20 h-20 blur-xl opacity-5 rounded-full",
                                            req.status === 'APPROVED' && 'bg-green-500',
                                            req.status === 'PENDING' && 'bg-amber-500',
                                            req.status === 'REJECTED' && 'bg-red-500'
                                        )} />

                                        {/* Status Header */}
                                        <div className="flex items-center justify-between gap-2 mb-3">
                                            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                                                {formatDateOnly(req.requested_at)}
                                            </span>
                                            <span className={cn(
                                                "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border flex items-center gap-1",
                                                config.color
                                            )}>
                                                <StatusIcon className="h-3 w-3 shrink-0" />
                                                {req.status}
                                            </span>
                                        </div>

                                        {/* Task Title */}
                                        <h3 className="font-bold text-foreground text-sm line-clamp-2 leading-tight group-hover:text-primary transition-colors mb-4">
                                            {req.tasks?.title || 'Unknown Task'}
                                        </h3>

                                        {/* Details Grid */}
                                        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border/40 text-xs mt-auto">
                                            <div className="flex flex-col">
                                                <span className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider">Suggested</span>
                                                <span className="font-bold text-foreground mt-0.5">
                                                    {formatDateOnly(req.suggested_new_deadline)}
                                                </span>
                                            </div>
                                            <div className="flex flex-col text-right">
                                                <span className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider">Reviewer</span>
                                                <span className="font-semibold text-muted-foreground mt-0.5 truncate">
                                                    {req.reviewed_by_user?.name || 'Awaiting Review'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Pagination Footer */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-between border-t border-border/60 pt-4 px-2">
                                <span className="text-xs text-muted-foreground font-semibold">
                                    Page {page} of {totalPages}
                                </span>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={page === 1}
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                        className="h-8 w-8 p-0"
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={page === totalPages}
                                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                        className="h-8 w-8 p-0"
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Request Details View Dialog */}
            {selectedRequest && (
                <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
                    <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto custom-scrollbar p-6 bg-background rounded-2xl border border-border shadow-2xl">
                        <DialogHeader className="border-b border-border pb-4">
                            <div className="flex items-center gap-2 mb-2">
                                <Badge variant="secondary" className="px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase bg-primary/5 text-primary border border-primary/10">
                                    Extension Request
                                </Badge>
                                <span className={cn(
                                    "px-2 py-0.5 rounded-full text-[9px] font-black uppercase border",
                                    STATUS_CONFIG[selectedRequest.status]?.color
                                )}>
                                    {selectedRequest.status}
                                </span>
                            </div>
                            <DialogTitle className="text-base font-bold text-foreground leading-snug">
                                {selectedRequest.tasks?.title || 'Task SLA Extension Details'}
                            </DialogTitle>
                            {/* <DialogDescription className="text-xs text-muted-foreground mt-1">
                                Audit history, reason statement, and review outcomes from the controller.
                            </DialogDescription> */}
                        </DialogHeader>

                        {/* Info Body */}
                        <div className="py-4 space-y-5">
                            {/* Auditing timeline trace */}
                            <div className="relative pl-6 space-y-4 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[1px] before:bg-border">
                                {/* Step 1: Requested */}
                                <div className="relative">
                                    <div className="absolute -left-[20px] top-1.5 w-3.5 h-3.5 rounded-full border border-border bg-card flex items-center justify-center shadow-xs">
                                        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-xs font-bold text-foreground">Requested Extension</span>
                                        <span className="text-[10px] text-muted-foreground font-semibold mt-0.5">
                                            Submitted by you on {formatDate(selectedRequest.requested_at)}
                                        </span>
                                    </div>
                                </div>

                                {/* Step 2: Controller review outcome */}
                                <div className="relative">
                                    <div className="absolute -left-[20px] top-1.5 w-3.5 h-3.5 rounded-full border border-border bg-card flex items-center justify-center shadow-xs">
                                        <div className={cn(
                                            "w-1.5 h-1.5 rounded-full",
                                            selectedRequest.status === 'APPROVED' && 'bg-green-500',
                                            selectedRequest.status === 'PENDING' && 'bg-amber-500',
                                            selectedRequest.status === 'REJECTED' && 'bg-red-500'
                                        )} />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-xs font-bold text-foreground">
                                            {selectedRequest.status === 'PENDING' ? 'Awaiting Review' : `Reviewed & ${selectedRequest.status}`}
                                        </span>
                                        {selectedRequest.status !== 'PENDING' && (
                                            <span className="text-[10px] text-muted-foreground font-semibold mt-0.5">
                                                Reviewed by {selectedRequest.reviewed_by_user?.name || 'Controller'} on {formatDate(selectedRequest.reviewed_at)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Dates details box */}
                            <div className="grid grid-cols-2 gap-4 bg-muted/20 border border-border/40 rounded-xl p-3.5">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Suggested Deadline</span>
                                    <span className="font-bold text-foreground text-sm mt-0.5">
                                        {formatDateOnly(selectedRequest.suggested_new_deadline)}
                                    </span>
                                </div>
                                {selectedRequest.status === 'APPROVED' && (
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-bold text-green-700 dark:text-green-400 uppercase tracking-wider">Final Committed Deadline</span>
                                        <span className="font-extrabold text-green-700 dark:text-green-400 text-sm mt-0.5">
                                            {formatDateOnly(selectedRequest.final_new_deadline)}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Reason details */}
                            <div className="space-y-1.5">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Reason for TAT Extension</span>
                                <div className="border border-border/60 rounded-xl p-3.5 bg-card text-xs text-foreground leading-relaxed shadow-inner">
                                    <div className="flex gap-2">
                                        <CornerDownRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                                        <p className="whitespace-pre-line italic text-muted-foreground">{selectedRequest.reason}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Reviewer Comment */}
                            {selectedRequest.status !== 'PENDING' && selectedRequest.reviewer_comment && (
                                <div className="space-y-1.5">
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Controller Reviewer Comments</span>
                                    <div className={cn(
                                        "border rounded-xl p-4 text-xs leading-relaxed flex gap-3 shadow-xs",
                                        selectedRequest.status === 'APPROVED'
                                            ? 'bg-green-50/20 border-green-200/50 dark:bg-green-950/10'
                                            : 'bg-red-50/20 border-red-200/50 dark:bg-red-950/10'
                                    )}>
                                        <MessageSquare className={cn(
                                            "h-4 w-4 shrink-0 mt-0.5",
                                            selectedRequest.status === 'APPROVED' ? 'text-green-600' : 'text-red-600'
                                        )} />
                                        <div className="flex flex-col gap-1">
                                            <span className="font-bold text-foreground">
                                                Feedback from {selectedRequest.reviewed_by_user?.name || 'Controller'}
                                            </span>
                                            <p className="text-muted-foreground italic">"{selectedRequest.reviewer_comment}"</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Dialog Footer Actions */}
                        <DialogFooter className="border-t border-border pt-4 mt-2">
                            <DialogClose>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-9 px-4 font-semibold border-border"
                                >
                                    Close
                                </Button>
                            </DialogClose>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}
