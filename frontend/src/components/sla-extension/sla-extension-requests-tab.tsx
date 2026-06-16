'use client';

import { useEffect, useState } from 'react';
import { useSLAExtensionStore } from '@/lib/zustand/sla-extension/sla-extension';
import { useToastStore } from '@/lib/zustand/toast-store';
import { useUserStore } from '@/lib/zustand/user/addUser';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger, UISelect } from '@/components/ui';
import { Clock, CheckCircle, XCircle, AlertCircle, Calendar, User, Filter, Search, X, ArrowUpDown, ArrowUp, ArrowDown, Zap, Timer, TrendingUp } from 'lucide-react';
import ExtendSLAModal from './extend-sla-modal';
import RejectSLARequestModal from './reject-sla-request-modal';
import TaskModal from '@/components/task/overdue-details-modal';
import { useTaskStore } from '@/lib/zustand/tasks/tasks';
import { useAuthStore } from '@/lib/zustand/user/user';

export default function SLAExtensionRequestsTab() {
    const {
        requests,
        requestsCount,
        currentPage,
        totalPages,
        loading,
        fetchRequests
    } = useSLAExtensionStore();

    const { users, fetchUsers } = useUserStore();

    const [activeTab, setActiveTab] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL'>('PENDING');
    const [selectedRequest, setSelectedRequest] = useState<any>(null);
    const [showApproveModal, setShowApproveModal] = useState(false);
    const [showRejectModal, setShowRejectModal] = useState(false);

    const fetchTaskDetails = useTaskStore(state => state.fetchTaskDetails);
    const [selectedTask, setSelectedTask] = useState<any | null>(null);
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [isFetchingTask, setIsFetchingTask] = useState(false);

    // Filters
    const [filters, setFilters] = useState({
        search: '',
        member: '',
        dateFrom: '',
        dateTo: '',
        overdue: ''
    });
    const [showFilters, setShowFilters] = useState(false);
    const { user } = useAuthStore()

    const taskPermission = user?.permissions?.find((p: any) => p.module === 'tasks');
    const canReadTasks = user?.workflow_role === 'interim_manager' ? !!taskPermission?.can_read : true;
    const canWriteTasks = user?.workflow_role === 'interim_manager' ? !!taskPermission?.can_write : true;

    // Sorting
    const [sortConfig, setSortConfig] = useState<{
        key: string | null;
        direction: 'asc' | 'desc' | null;
    }>({ key: null, direction: null });

    useEffect(() => {
        fetchUsers({ limit: 1000 });
    }, []);

    useEffect(() => {
        fetchRequests({ status: activeTab, page: 1 });
    }, [activeTab]);

    const applyFilters = () => {
        fetchRequests({
            status: activeTab,
            page: 1,
            ...filters,
            sortBy: sortConfig.key || undefined,
            sortOrder: sortConfig.direction || undefined
        });
    };

    const clearFilters = () => {
        setFilters({
            search: '',
            member: '',
            dateFrom: '',
            dateTo: '',
            overdue: ''
        });
        setSortConfig({ key: null, direction: null });
        fetchRequests({ status: activeTab, page: 1 });
    };

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' | null = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        } else if (sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = null;
        }
        setSortConfig({ key, direction });

        fetchRequests({
            status: activeTab,
            page: 1,
            ...filters,
            sortBy: direction ? key : undefined,
            sortOrder: direction || undefined
        });
    };

    const getSortIcon = (key: string) => {
        if (sortConfig.key !== key) {
            return <ArrowUpDown className="w-4 h-4 text-gray-400" />;
        }
        if (sortConfig.direction === 'asc') {
            return <ArrowUp className="w-4 h-4 text-blue-600" />;
        }
        if (sortConfig.direction === 'desc') {
            return <ArrowDown className="w-4 h-4 text-blue-600" />;
        }
        return <ArrowUpDown className="w-4 h-4 text-gray-400" />;
    };

    const hasActiveFilters = Object.values(filters).some(v => v !== '');

    const getStatusBadge = (status: string) => {
        const variants: Record<string, { color: string; icon: any }> = {
            PENDING: { color: 'bg-yellow-100 text-yellow-800 border-yellow-300', icon: Clock },
            APPROVED: { color: 'bg-green-100 text-green-800 border-green-300', icon: CheckCircle },
            REJECTED: { color: 'bg-red-100 text-red-800 border-red-300', icon: XCircle }
        };

        const variant = variants[status] || variants.PENDING;
        const Icon = variant.icon;

        return (
            <Badge className={`${variant.color} border flex items-center gap-1`}>
                <Icon className="w-3 h-3" />
                {status}
            </Badge>
        );
    };

    const calculateOverdueDays = (dueDate: string) => {
        const due = new Date(dueDate);
        const today = new Date();
        const diffTime = today.getTime() - due.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays > 0 ? diffDays : 0;
    };

    /** Returns a formatted date and time (e.g. 11 May 10:15 AM) */
    const formatDateTime = (dateString: string | null | undefined) => {
        if (!dateString) return 'N/A';
        const dl = new Date(dateString);
        const dateStr = dl.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        const timeStr = dl.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        return `${dateStr} ${timeStr}`;
    };

    /** Returns a human-readable date/time or "overdue" label for controller_deadline */
    const getDeadlineCountdown = (deadline: string | null | undefined) => {
        if (!deadline) return null;
        const now = new Date();
        const dl = new Date(deadline);
        const diffMs = dl.getTime() - now.getTime();
        if (diffMs <= 0) return { label: 'Deadline passed', overdue: true };

        return { label: formatDateTime(deadline), overdue: false };
    };

    /** Returns response time vs. deadline info */
    const getResponseTime = (request: any) => {
        if (!request.reviewed_at || !request.requested_at) return null;
        const requested = new Date(request.requested_at);
        const reviewed = new Date(request.reviewed_at);
        const diffMs = reviewed.getTime() - requested.getTime();
        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        const label = hours >= 1 ? `${hours}h ${minutes}m` : `${minutes}m`;
        const beatDeadline = request.controller_deadline
            ? reviewed <= new Date(request.controller_deadline)
            : null;
        return { label, beatDeadline };
    };

    const handleApprove = (request: any) => {
        setSelectedRequest(request);
        setShowApproveModal(true);
    };

    const handleReject = (request: any) => {
        setSelectedRequest(request);
        setShowRejectModal(true);
    };

    const handleRowClick = async (request: any, e?: React.MouseEvent) => {
        if (e && (e.target as HTMLElement).closest('button')) {
            return;
        }

        const taskId = request.task_id || request.tasks?.id;
        if (!taskId) return;
        setIsFetchingTask(true);
        const fullTask = await fetchTaskDetails(taskId);
        setIsFetchingTask(false);
        if (fullTask) {
            setSelectedTask(fullTask);
            setIsTaskModalOpen(true);
        }
    };
    if (user?.workflow_role === 'interim_manager' && !canReadTasks) {
        return (
            <div className="border rounded-xl border-gray-200 flex items-center justify-center h-[500px]">
                <p className="text-sm text-gray-500">You don't have permission to review requests contact Admin for task permission.</p>
            </div>
        )
    }
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        TAT Extension Requests
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <AlertCircle className="w-4 h-4 text-gray-400 cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                                Turnaround Time Extension
                            </TooltipContent>
                        </Tooltip>
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                        Review and manage deadline extension requests from team members
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-sm text-gray-500">Total Requests</p>
                    <p className="text-2xl font-bold text-gray-900">{requestsCount}</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200">
                <nav className="flex gap-4">
                    {['PENDING', 'APPROVED', 'REJECTED', 'ALL'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab as any)}
                            className={`pb-3 px-1 border-b-2 font-medium text-sm transition ${activeTab === tab
                                ? 'border-blue-600 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                        >
                            {tab}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Filters */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <Button
                        variant="outline"
                        onClick={() => setShowFilters(!showFilters)}
                        className="flex items-center gap-2"
                    >
                        <Filter className="w-4 h-4" />
                        Filters
                        {hasActiveFilters && (
                            <Badge className="ml-1 bg-blue-600 text-white">Active</Badge>
                        )}
                    </Button>
                    {hasActiveFilters && (
                        <Button
                            variant="ghost"
                            onClick={clearFilters}
                            className="text-sm text-gray-600 hover:text-gray-900"
                        >
                            <X className="w-4 h-4 mr-1" />
                            Clear Filters
                        </Button>
                    )}
                </div>

                {showFilters && (
                    <Card className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {/* Search */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Search Task</label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <Input
                                        placeholder="Search by task name..."
                                        value={filters.search}
                                        onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                                        className="pl-10"
                                    />
                                </div>
                            </div>

                            {/* Member Filter */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Requested By</label>
                                <UISelect
                                    className="h-[36px] w-full]"
                                    value={filters.member}
                                    onValueChange={(val) => setFilters({ ...filters, member: val })}
                                    placeholder="All Members"
                                    options={[
                                        { value: '', label: 'All Members' },
                                        ...users.map(u => ({ value: u.id, label: u.name }))
                                    ]}
                                />
                            </div>

                            {/* Date From */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Request Date From</label>
                                <Input
                                    type="date"
                                    value={filters.dateFrom}
                                    onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                                />
                            </div>

                            {/* Date To */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Request Date To</label>
                                <Input
                                    type="date"
                                    value={filters.dateTo}
                                    onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                                />
                            </div>

                            {/* Overdue Filter */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Overdue Status</label>
                                <UISelect
                                    value={filters.overdue}
                                    onValueChange={(val) => setFilters({ ...filters, overdue: val })}
                                    placeholder="All Tasks"
                                    options={[
                                        { value: '', label: 'All Tasks' },
                                        { value: 'yes', label: 'Overdue Only' },
                                        { value: 'no', label: 'Not Overdue' }
                                    ]}
                                />
                            </div>

                            {/* Apply Button */}
                            <div className="flex items-end">
                                <Button
                                    onClick={applyFilters}
                                    className="w-full bg-blue-600 hover:bg-blue-700"
                                >
                                    Apply Filters
                                </Button>
                            </div>
                        </div>
                    </Card>
                )}
            </div>

            {/* Requests List */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
            ) : requests.length === 0 ? (
                <Card className="p-12 text-center">
                    <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No {activeTab.toLowerCase()} requests found</p>
                </Card>
            ) : (
                <>
                    {/* Desktop Table View */}
                    <div className="hidden lg:block overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-200">
                                    <th
                                        className="text-left p-4 text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors"
                                        onClick={() => handleSort('task')}
                                    >
                                        <div className="flex items-center gap-2">
                                            Task
                                            {getSortIcon('task')}
                                        </div>
                                    </th>
                                    <th
                                        className="text-left p-4 text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors"
                                        onClick={() => handleSort('member')}
                                    >
                                        <div className="flex items-center gap-2">
                                            Requested By
                                            {getSortIcon('member')}
                                        </div>
                                    </th>
                                    {/* <th
                                        className="text-left p-4 text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors"
                                        onClick={() => handleSort('requested_at')}
                                    >
                                        <div className="flex items-center gap-2">
                                            Request Date
                                            {getSortIcon('requested_at')}
                                        </div>
                                    </th> */}
                                    <th
                                        className="text-left p-4 text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors"
                                        onClick={() => handleSort('due_date')}
                                    >
                                        <div className="flex items-center gap-2">
                                            Due Date
                                            {getSortIcon('due_date')}
                                        </div>
                                    </th>
                                    <th
                                        className="text-left p-4 text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors"
                                        onClick={() => handleSort('status')}
                                    >
                                        <div className="flex items-center gap-2">
                                            Status
                                            {getSortIcon('status')}
                                        </div>
                                    </th>
                                    <th className="text-left p-4 text-sm font-semibold text-gray-700">Reason</th>
                                    <th className="text-left p-4 text-sm font-semibold text-gray-700">
                                        <div className="flex items-center gap-1.5"><Timer className="w-3.5 h-3.5 text-amber-500" />Controller Deadline</div>
                                    </th>
                                    {activeTab !== 'PENDING' && (
                                        <th className="text-left p-4 text-sm font-semibold text-gray-700">
                                            <div className="flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5 text-blue-500" />Response Time</div>
                                        </th>
                                    )}
                                    {activeTab === 'PENDING' && (
                                        <th className="text-right p-4 text-sm font-semibold text-gray-700">Actions</th>
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {requests.map((request) => {
                                    const overdueDays = request.tasks?.due_date
                                        ? calculateOverdueDays(request.tasks.due_date)
                                        : 0;

                                    return (
                                        <tr key={request.id} onClick={(e) => handleRowClick(request, e)} className={`border-b border-gray-100 hover:bg-gray-50 transition cursor-pointer ${isFetchingTask ? 'opacity-70 pointer-events-none' : ''}`}>
                                            <td className="p-4">
                                                <div>
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <p className="font-medium text-gray-900">{request.tasks?.title || 'Unknown Task'}</p>
                                                        {request.is_auto_generated && (
                                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-300">
                                                                <Zap className="w-2.5 h-2.5" />Auto
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-gray-500 mt-1">
                                                        {request.tasks?.instances?.projects?.name} → {request.tasks?.instances?.name}
                                                    </p>
                                                    {overdueDays > 0 && (
                                                        <Badge className="mt-2 bg-red-100 text-red-700 border-red-300">
                                                            {overdueDays}d overdue
                                                        </Badge>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-2">
                                                    <User className="w-4 h-4 text-gray-400" />
                                                    <span className="text-sm text-gray-700">{request.requested_by_user?.name || 'Unknown'}</span>
                                                </div>
                                            </td>
                                            {/* <td className="p-4">
                                                <div className="flex items-center gap-2">
                                                    <Calendar className="w-4 h-4 text-gray-400" />
                                                    <span className="text-sm text-gray-700">
                                                        {formatDateTime(request.requested_at)}
                                                    </span>
                                                </div>
                                            </td> */}
                                            <td className="p-4">
                                                <div className="flex items-center gap-2">
                                                    <Clock className="w-4 h-4 text-gray-400" />
                                                    <span className="text-sm text-gray-700">
                                                        {formatDateTime(request.tasks?.due_date)}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                {getStatusBadge(request.status)}
                                            </td>                                            <td className="p-4 align-middle">
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <div className="flex items-center gap-2 max-w-xs truncate cursor-help">
                                                            {request.reason || "-"}
                                                        </div>
                                                    </TooltipTrigger>
                                                    <TooltipContent className="max-w-sm break-words">
                                                        {request.reason}
                                                    </TooltipContent>
                                                </Tooltip>
                                            </td>

                                            {/* Controller Deadline column */}
                                            <td className="p-4 align-middle">
                                                {(() => {
                                                    const cd = getDeadlineCountdown(request.controller_deadline);
                                                    if (!cd) return <span className="text-xs text-gray-400">—</span>;
                                                    if (request.status !== 'PENDING') {
                                                        return (
                                                            <span className="text-xs text-gray-500">
                                                                {new Date(request.controller_deadline).toLocaleDateString()}
                                                            </span>
                                                        );
                                                    }
                                                    return (
                                                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${cd.overdue
                                                            ? 'bg-red-100 text-red-700'
                                                            : 'bg-amber-50 text-amber-700'
                                                            }`}>
                                                            <Timer className="w-3 h-3" />
                                                            {cd.label}
                                                        </span>
                                                    );
                                                })()}
                                            </td>

                                            {/* Response Time column (non-pending) */}
                                            {activeTab !== 'PENDING' && (
                                                <td className="p-4 align-middle">
                                                    {(() => {
                                                        const rt = getResponseTime(request);
                                                        if (!rt) return <span className="text-xs text-gray-400">—</span>;
                                                        return (
                                                            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${rt.beatDeadline === true
                                                                ? 'bg-green-100 text-green-700'
                                                                : rt.beatDeadline === false
                                                                    ? 'bg-red-100 text-red-700'
                                                                    : 'bg-gray-100 text-gray-600'
                                                                }`}>
                                                                <TrendingUp className="w-3 h-3" />
                                                                {rt.label}
                                                                {rt.beatDeadline === true && ' ✓'}
                                                                {rt.beatDeadline === false && ' ✗'}
                                                            </span>
                                                        );
                                                    })()}
                                                </td>
                                            )}

                                            {activeTab === 'PENDING' && (
                                                <td className="p-4">
                                                    <div className="flex items-center justify-end gap-2">
                                                        {canWriteTasks && (
                                                            <Button
                                                                size="sm"
                                                                onClick={() => handleApprove(request)}
                                                            >
                                                                <CheckCircle className="w-3 h-3 mr-1" />
                                                                Review
                                                            </Button>
                                                        )}
                                                    </div >
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile/Tablet Card View */}
                    <div className="lg:hidden space-y-4">
                        {requests.map((request) => {
                            const overdueDays = request.tasks?.due_date
                                ? calculateOverdueDays(request.tasks.due_date)
                                : 0;

                            return (
                                <Card key={request.id} onClick={(e) => handleRowClick(request, e as any)} className={`p-6 hover:shadow-md transition cursor-pointer ${isFetchingTask ? 'opacity-70 pointer-events-none' : ''}`}>
                                    <div className="flex items-start justify-between gap-4">
                                        {/* Left Section */}
                                        <div className="flex-1 space-y-3">
                                            {/* Task Info */}
                                            <div>
                                                <div className="flex items-center gap-3 mb-2">
                                                    <h3 className="text-lg font-semibold text-gray-900">
                                                        {request.tasks?.title || 'Unknown Task'}
                                                    </h3>
                                                    {getStatusBadge(request.status)}
                                                </div>
                                                <p className="text-sm text-gray-600">
                                                    {request.tasks?.instances?.projects?.name} → {request.tasks?.instances?.name}
                                                </p>
                                            </div>

                                            {/* Overdue Badge + Auto badge */}
                                            <div className="flex items-center gap-2 flex-wrap">
                                                {overdueDays > 0 && (
                                                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-50 border border-red-200 rounded-full">
                                                        <AlertCircle className="w-4 h-4 text-red-600" />
                                                        <span className="text-sm font-medium text-red-700">
                                                            {overdueDays} day{overdueDays !== 1 ? 's' : ''} overdue
                                                        </span>
                                                    </div>
                                                )}
                                                {request.is_auto_generated && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-300">
                                                        <Zap className="w-3 h-3" />Auto-generated
                                                    </span>
                                                )}
                                            </div>

                                            {/* Reason */}
                                            <div className="bg-gray-50 rounded-lg p-4">
                                                <p className="text-xs font-medium text-gray-500 mb-1">REASON</p>
                                                <p className="text-sm text-gray-700">{request.reason}</p>
                                            </div>

                                            {/* Metadata */}
                                            <div className="flex items-center gap-6 text-sm text-gray-500">
                                                <div className="flex items-center gap-2">
                                                    <User className="w-4 h-4" />
                                                    <span>{request.requested_by_user?.name || 'Unknown'}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Calendar className="w-4 h-4" />
                                                    <span>
                                                        Requested: {formatDateTime(request.requested_at)}
                                                    </span>
                                                </div>
                                                {request.tasks?.due_date && (
                                                    <div className="flex items-center gap-2">
                                                        <Clock className="w-4 h-4" />
                                                        <span>
                                                            Due: {formatDateTime(request.tasks.due_date)}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Suggested Deadline */}
                                            {request.suggested_new_deadline && (
                                                <div className="text-sm">
                                                    <span className="text-gray-500">Suggested deadline: </span>
                                                    <span className="font-medium text-gray-900">
                                                        {new Date(request.suggested_new_deadline).toLocaleDateString()}
                                                    </span>
                                                </div>
                                            )}

                                            {/* Controller Deadline (mobile) */}
                                            {request.controller_deadline && (
                                                <div className="flex items-center gap-2">
                                                    <Timer className="w-4 h-4 text-amber-500" />
                                                    <span className="text-sm text-gray-600">Controller deadline: </span>
                                                    {(() => {
                                                        const cd = getDeadlineCountdown(request.controller_deadline);
                                                        if (!cd) return null;
                                                        return (
                                                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cd.overdue ? 'bg-red-100 text-red-700' : 'bg-amber-50 text-amber-700'
                                                                }`}>{cd.label}</span>
                                                        );
                                                    })()}
                                                </div>
                                            )}

                                            {/* Response Time (mobile) */}
                                            {request.status !== 'PENDING' && (() => {
                                                const rt = getResponseTime(request);
                                                if (!rt) return null;
                                                return (
                                                    <div className="flex items-center gap-2">
                                                        <TrendingUp className="w-4 h-4 text-blue-500" />
                                                        <span className="text-sm text-gray-600">Response time: </span>
                                                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${rt.beatDeadline === true ? 'bg-green-100 text-green-700'
                                                            : rt.beatDeadline === false ? 'bg-red-100 text-red-700'
                                                                : 'bg-gray-100 text-gray-600'
                                                            }`}>
                                                            {rt.label}{rt.beatDeadline === true ? ' ✓' : rt.beatDeadline === false ? ' ✗' : ''}
                                                        </span>
                                                    </div>
                                                );
                                            })()}

                                            {/* Review Info (for approved/rejected) */}
                                            {request.status !== 'PENDING' && (
                                                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                                                    <p className="text-xs font-medium text-blue-900 mb-1">
                                                        {request.status === 'APPROVED' ? 'APPROVED BY' : 'REJECTED BY'}
                                                    </p>
                                                    <p className="text-sm text-blue-800">
                                                        {request.reviewed_by_user?.name || 'Unknown'} on{' '}
                                                        {request?.reviewed_at && new Date(request.reviewed_at).toLocaleDateString()}
                                                    </p>
                                                    {request.reviewer_comment && (
                                                        <p className="text-sm text-blue-700 mt-2">
                                                            Comment: {request.reviewer_comment}
                                                        </p>
                                                    )}
                                                    {request.final_new_deadline && (
                                                        <p className="text-sm text-blue-700 mt-1">
                                                            New deadline: {formatDateTime(request.final_new_deadline)}
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Right Section - Actions */}
                                        {request.status === 'PENDING' && (
                                            <div className="flex flex-col gap-2">
                                                {canWriteTasks && (
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleApprove(request)}                                                >
                                                        <CheckCircle className="w-3 h-3 mr-1" />
                                                        Review
                                                    </Button>
                                                )}
                                            </div>
                                        )}



                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                </>
            )
            }

            {/* Pagination */}
            {
                totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-6">
                        <Button
                            variant="outline"
                            onClick={() => fetchRequests({ status: activeTab, page: currentPage - 1 })}
                            disabled={currentPage === 1 || loading}
                        >
                            Previous
                        </Button>
                        <span className="text-sm text-gray-600">
                            Page {currentPage} of {totalPages}
                        </span>
                        <Button
                            variant="outline"
                            onClick={() => fetchRequests({ status: activeTab, page: currentPage + 1 })}
                            disabled={currentPage === totalPages || loading}
                        >
                            Next
                        </Button>
                    </div>
                )
            }

            {/* Modals */}
            {
                showApproveModal && selectedRequest && (
                    <ExtendSLAModal
                        isOpen={showApproveModal}
                        onClose={() => {
                            setShowApproveModal(false);
                            setSelectedRequest(null);
                        }}
                        request={selectedRequest}
                        onSuccess={() => {
                            fetchRequests({ status: activeTab });
                        }}
                    />
                )
            }

            {/* {showRejectModal && selectedRequest && (
                <RejectSLARequestModal
                    isOpen={showRejectModal}
                    onClose={() => {
                        setShowRejectModal(false);
                        setSelectedRequest(null);
                    }}
                    request={selectedRequest}
                    onSuccess={() => {
                        fetchRequests({ status: activeTab });
                    }}
                />
            )} */}

            {/* Task Details Modal — opens full task context when clicking a row */}
            <TaskModal
                isModalOpen={isTaskModalOpen}
                setIsModalOpen={(open) => {
                    setIsTaskModalOpen(open);
                    if (!open) setSelectedTask(null);
                }}
                selectedTask={selectedTask}
            />
        </div >
    );
}
