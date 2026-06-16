'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useTaskStore } from '@/lib/zustand/tasks/tasks';
import { useUserStore } from '@/lib/zustand/user/addUser';
import { Task } from '@/lib/types/auth';
import api from '@/lib/api';
import {
    Search,
    Filter,
    ChevronLeft,
    ChevronRight,
    ArrowUp,
    ArrowDown,
    Activity,
    AlertCircle,
    CheckCircle2,
    Clock,
    RefreshCw,
    CheckSquare,
    Eye,
    ArrowUpDown,
    User,
    Calendar
} from 'lucide-react';
import { Button, UISelect, Input, Badge, Checkbox, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui';
import TaskModal from '@/components/task/overdue-details-modal';
import { AlertTriangle, Folder } from 'lucide-react';

// ─── Types and Helper Functions ───────────────────────────────────────────────

type DateRangeFilter = 'All Time' | 'Today' | 'Yesterday' | 'Last 7 Days' | 'Last 30 Days' | 'Custom';

function isTaskOverdue(task: Task, now: Date): boolean {
    if (!task.due_date) return false;
    if (task.status === 'COMPLETED' || task.status === 'APPROVED' || task.status === 'REJECTED') return false;
    return new Date(task.due_date) < now;
}

function isTaskLate(task: Task): boolean {
    if (!task.due_date || (task.status !== 'COMPLETED' && task.status !== 'APPROVED')) return false;
    const completedAt = task.submitted_at ? new Date(task.submitted_at) : new Date();
    return completedAt > new Date(task.due_date);
}

function isTaskOnTime(task: Task): boolean {
    if (!task.due_date || (task.status !== 'COMPLETED' && task.status !== 'APPROVED')) return false;
    const completedAt = task.submitted_at ? new Date(task.submitted_at) : new Date();
    return completedAt <= new Date(task.due_date);
}

const getStatusStyle = (status: string, isOverdue: boolean) => {
    if (isOverdue) return 'bg-red-50 text-red-600 border-red-100';
    switch (status) {
        case 'IN_PROGRESS': return 'bg-blue-50 text-blue-600 border-blue-100';
        case 'LOCKED': return 'bg-gray-100 text-gray-500 border-gray-200';
        case 'PENDING_APPROVAL': return 'bg-amber-50 text-amber-600 border-amber-100';
        case 'COMPLETED': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
        default: return 'bg-gray-100 text-gray-500 border-gray-200';
    }
};

const getOverdueDays = (deadline: Date) => {
    const diffMs = Date.now() - deadline.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return null;
    return diffDays === 1 ? '1d' : `${diffDays}d`;
};

import { useTeamActivityStore } from '@/lib/zustand/performance/team-activity';
import { OverdueDetailsModal, LateTaskDetailsModal } from './member-task-details';

// ─── Main Component ──────────────────────────────────────────────────────────

export default function OverdueTasks() {
    const { allTasks, allTasksCount, allTasksPage, allTasksTotalPages, fetchAllTasks, loading } = useTaskStore();
    const { users, fetchUsers } = useUserStore();
    const { stats, memberStats: rawMemberStats, loading: statsLoading, fetchTeamActivity } = useTeamActivityStore();

    const [selectedMember, setSelectedMember] = useState<string>('all');
    const [dateRange, setDateRange] = useState<DateRangeFilter>('All Time');
    const [customStartDate, setCustomStartDate] = useState<string>('');
    const [customEndDate, setCustomEndDate] = useState<string>('');
    const [excludeArchived, setExcludeArchived] = useState(false);

    // Team Performance Table
    const [teamSearch, setTeamSearch] = useState('');
    const [teamShowCount, setTeamShowCount] = useState(10);
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
    const [selectedOverdueMember, setSelectedOverdueMember] = useState<any | null>(null);
    const [selectedLateTaskMember, setSelectedLateTaskMember] = useState<any | null>(null);

    // Task Details Pagination
    const [page, setPage] = useState(1);
    const [taskSearch, setTaskSearch] = useState('');
    const [selectedDetailTask, setSelectedDetailTask] = useState<any>(null);
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [taskSortConfig, setTaskSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
    const [taskStatusFilter, setTaskStatusFilter] = useState<string>('all');
    const [taskClientFilter, setTaskClientFilter] = useState<string>('all');
    const [limit, setLimit] = useState(10);

    const fetchStats = async () => {
        fetchTeamActivity({
            dateRange,
            memberId: selectedMember,
            startDate: dateRange === 'Custom' ? customStartDate : undefined,
            endDate: dateRange === 'Custom' ? customEndDate : undefined
        });
    };

    // Auto-fetch stats when filters change
    useEffect(() => {
        if (dateRange === 'Custom') {
            if (customStartDate && customEndDate) fetchStats();
        } else {
            fetchStats();
        }
    }, [selectedMember, dateRange, customStartDate, customEndDate]);

    // Initial users load
    useEffect(() => {
        if (users.length === 0) fetchUsers();
    }, []);

    // Fetch paginated Task Details whenever filters or pagination changes
    useEffect(() => {
        if (dateRange === 'Custom' && (!customStartDate || !customEndDate)) return;

        const timeoutId = setTimeout(() => {
            fetchAllTasks({
                page,
                limit,
                // When a search query is active, don't restrict by user so the
                // backend can match task title AND assigned_user name across everyone.
                assigned_user_id: taskSearch ? undefined : selectedMember,
                date_range: dateRange,
                startDate: dateRange === 'Custom' ? customStartDate : undefined,
                endDate: dateRange === 'Custom' ? customEndDate : undefined,
                search: taskSearch || undefined
            });
        }, 300);
        return () => clearTimeout(timeoutId);
    }, [page, selectedMember, dateRange, taskSearch, customStartDate, customEndDate, limit]);

    // Reset pagination when broad filters change
    useEffect(() => {
        setPage(1);
    }, [selectedMember, dateRange, taskSearch, customStartDate, customEndDate, limit]);



    // ─── Member Performance Aggregation ───
    // ─── Member Performance Sorting ───
    const memberStats = useMemo(() => {
        let result = [...rawMemberStats];

        // Search Filter
        if (teamSearch.trim() !== '') {
            const query = teamSearch.toLowerCase();
            result = result.filter((m: any) => m.name.toLowerCase().includes(query) || m.role.toLowerCase().includes(query));
        }

        // Sorting
        if (sortConfig !== null) {
            result.sort((a: any, b: any) => {
                let aVal = a[sortConfig.key];
                let bVal = b[sortConfig.key];

                if (typeof aVal === 'string') aVal = aVal.toLowerCase();
                if (typeof bVal === 'string') bVal = bVal.toLowerCase();

                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return result;
    }, [rawMemberStats, teamSearch, sortConfig]);

    const displayedTeamMembers = useMemo(() => {
        return memberStats.slice(0, teamShowCount);
    }, [memberStats, teamShowCount]);

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const SortIcon = ({ columnKey }: { columnKey: string }) => {
        if (sortConfig?.key === columnKey) {
            return sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3 ml-1 inline-block" /> : <ArrowDown className="h-3 w-3 ml-1 inline-block" />;
        }
        return <ArrowUpDown className="h-3 w-3 ml-1 inline-block text-muted-foreground/30" />;
    };

    console.log("displayedTeamMembers", displayedTeamMembers);

    // ─── Task Details Sorting ───
    const handleTaskSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (taskSortConfig && taskSortConfig.key === key && taskSortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setTaskSortConfig({ key, direction });
    };

    const TaskSortIcon = ({ columnKey }: { columnKey: string }) => {
        if (taskSortConfig?.key === columnKey) {
            return taskSortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3 ml-1 inline-block" /> : <ArrowDown className="h-3 w-3 ml-1 inline-block" />;
        }
        return <ArrowUpDown className="h-3 w-3 ml-1 inline-block text-muted-foreground/30" />;
    };

    const availableClients = useMemo(() => {
        const clients = new Map<string, string>();
        allTasks.forEach((task: any) => {
            const name = task.instance?.client?.name || task.project?.client?.name || task.project?.client_name;
            if (name) {
                clients.set(name, name);
            }
        });
        return Array.from(clients.values()).sort();
    }, [allTasks]);

    const sortedTasks = useMemo(() => {
        let filtered = allTasks;
        if (taskStatusFilter !== 'all') {
            filtered = filtered.filter((task: any) => {
                const isCompleted = task.status === 'COMPLETED';
                const isLocked = task.status === 'LOCKED';
                const isOverdue =
                    task.due_date &&
                    !isCompleted &&
                    new Date(task.due_date) < new Date();

                switch (taskStatusFilter) {
                    case 'overdue':
                        return isOverdue;

                    case 'active':
                        return !isCompleted && !isLocked;

                    case 'in_progress':
                        return task.status === 'IN_PROGRESS';

                    case 'completed':
                        return isCompleted;

                    default:
                        return true;
                }
            });
        }

        if (taskClientFilter !== 'all') {
            filtered = filtered.filter((task: any) => {
                const clientName = task.instance?.client?.name || task.project?.client?.name || task.project?.client_name;
                return clientName === taskClientFilter;
            });
        }

        if (!taskSortConfig) return filtered;
        const sorted = [...filtered].sort((a: any, b: any) => {
            let aVal: any, bVal: any;
            switch (taskSortConfig.key) {
                case 'title':
                    aVal = a.title?.toLowerCase() || '';
                    bVal = b.title?.toLowerCase() || '';
                    break;
                case 'assigned_user':
                    aVal = a.assigned_user?.name?.toLowerCase() || '';
                    bVal = b.assigned_user?.name?.toLowerCase() || '';
                    break;
                case 'instance':
                    aVal = a.instance?.name?.toLowerCase() || '';
                    bVal = b.instance?.name?.toLowerCase() || '';
                    break;
                case 'status':
                    aVal = a.status?.toLowerCase() || '';
                    bVal = b.status?.toLowerCase() || '';
                    break;
                case 'due_date':
                    aVal = a.due_date ? new Date(a.due_date).getTime() : 0;
                    bVal = b.due_date ? new Date(b.due_date).getTime() : 0;
                    break;
                default:
                    return 0;
            }
            if (aVal < bVal) return taskSortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return taskSortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
        return sorted;
    }, [allTasks, taskSortConfig, taskStatusFilter, taskClientFilter]);


    // ─── Render ───
    return (
        <div className="space-y-6">
            {selectedOverdueMember && (
                <OverdueDetailsModal
                    memberId={selectedOverdueMember.id}
                    memberName={selectedOverdueMember.name}
                    onClose={() => setSelectedOverdueMember(null)}
                    dateRange={dateRange}
                    startDate={dateRange === 'Custom' ? customStartDate : undefined}
                    endDate={dateRange === 'Custom' ? customEndDate : undefined}
                />
            )}
            {selectedLateTaskMember && (
                <LateTaskDetailsModal
                    memberId={selectedLateTaskMember.id}
                    memberName={selectedLateTaskMember.name}
                    onClose={() => setSelectedLateTaskMember(null)}
                    dateRange={dateRange}
                    startDate={dateRange === 'Custom' ? customStartDate : undefined}
                    endDate={dateRange === 'Custom' ? customEndDate : undefined}
                />
            )}
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold tracking-tight text-foreground mb-1">Team Activity</h2>
                    <p className="text-sm text-muted-foreground">Monitor team members and task activity</p>
                </div>
                <div className="flex items-center gap-3 border rounded-xl p-1">
                    <Button variant="ghost" size="sm" className="text-muted-foreground hover:bg-muted/50" onClick={() => {
                        fetchStats();
                        fetchAllTasks({
                            page: 1, // Reset to page 1
                            limit,
                            assigned_user_id: selectedMember,
                            date_range: dateRange,
                            startDate: dateRange === 'Custom' ? customStartDate : undefined,
                            endDate: dateRange === 'Custom' ? customEndDate : undefined
                        });
                    }}>
                        <RefreshCw className={`h-4 w-4 mr-2 ${statsLoading ? 'animate-spin' : ''}`} />
                        Refresh Data
                    </Button>
                    {/* <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200 px-2.5 py-1">
                        <Activity className="h-3 w-3 mr-1" /> Live Updates
                    </Badge> */}
                </div>
            </div>

            {/* Filters */}
            <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-sm">
                <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-end">
                    <div className="flex-1 min-w-[200px]">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Team Member</label>
                        <UISelect
                            value={selectedMember}
                            onValueChange={(val) => {
                                setSelectedMember(val);
                                setTaskSearch(users?.find(u => u.id === val)?.name || '');
                            }}
                            className="w-full h-10"
                            placeholder="All Team Members"
                            options={[
                                { value: 'all', label: 'All Team Members', icon: User },
                                ...(users?.map(u => ({ value: u.id, label: u.name, icon: User })) || [])
                            ]}
                        />
                    </div>
                    <div className="flex-1 min-w-[200px]">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Date Range</label>
                        <UISelect
                            value={dateRange}
                            onValueChange={(val: any) => setDateRange(val)}
                            className="w-full h-10"
                            options={['All Time', 'Today', 'Yesterday', 'Last 7 Days', 'Last 30 Days', 'Custom'].map(opt => ({
                                value: opt,
                                label: opt,
                                icon: Calendar
                            }))}
                        />
                    </div>
                    {dateRange === 'Custom' && (
                        <div className="flex flex-1 gap-3 sm:gap-4 flex-col sm:flex-row">
                            <div className="flex-1 min-w-[140px]">
                                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Start Date</label>
                                <Input type="date" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)} className="w-full text-sm h-10" />
                            </div>
                            <div className="flex-1 min-w-[140px]">
                                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">End Date</label>
                                <Input type="date" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)} className="w-full text-sm h-10" />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Top Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                <div className="rounded-xl border border-border bg-card p-5 relative overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                    <p className="text-sm font-medium text-muted-foreground mb-4">Total Tasks</p>
                    <p className="text-3xl font-bold text-foreground">{stats.total}</p>
                    <p className="text-[11px] text-muted-foreground mt-1.5 font-medium border-t border-border/50 pt-2"><span className="text-foreground">{stats.active}</span> active • <span className="text-foreground">{stats.completed}</span> completed</p>
                    <div className="absolute top-5 right-5 h-8 w-8 rounded-full bg-blue-50/50 flex items-center justify-center text-blue-600">
                        <CheckCircle2 className="h-4.5 w-4.5" />
                    </div>
                </div>

                <div className="rounded-xl border border-border bg-card p-5 relative overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                    <p className="text-sm font-medium text-muted-foreground mb-4">SLA Performance</p>
                    <p className="text-3xl font-bold text-emerald-600">{stats.slaPercent}%</p>
                    <p className="text-[11px] text-muted-foreground mt-1.5 font-medium border-t border-border/50 pt-2"><span className="text-emerald-700">{stats.onTime}</span> on time • <span className="text-amber-700">{stats.late}</span> late</p>
                    <div className="absolute top-5 right-5 h-8 w-8 rounded-full bg-emerald-50/50 flex items-center justify-center text-emerald-600">
                        <Activity className="h-4.5 w-4.5" />
                    </div>
                </div>

                <div className="rounded-xl border border-border bg-card p-5 relative overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                    <p className="text-sm font-medium text-muted-foreground mb-4">Active Tasks</p>
                    <p className="text-3xl font-bold text-blue-600">{stats.active}</p>
                    <p className="text-[11px] text-muted-foreground mt-1.5 font-medium border-t border-border/50 pt-2">In progress now</p>
                    <div className="absolute top-5 right-5 h-8 w-8 rounded-full bg-blue-50/50 flex items-center justify-center text-blue-600">
                        <Clock className="h-4.5 w-4.5" />
                    </div>
                </div>

                <div className="rounded-xl border border-red-200 bg-red-50/40 p-5 relative overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                    <p className="text-sm text-red-900/60 mb-4 font-semibold uppercase tracking-tight">Overdue Tasks</p>
                    <p className="text-3xl font-bold text-red-600">{stats.overdue}</p>
                    <p className="text-[11px] text-red-600 mt-1.5 font-bold uppercase tracking-wider pt-2 border-t border-red-100">Immediate attention needed</p>
                    <div className="absolute top-5 right-5 h-8 w-8 rounded-full bg-red-100/60 flex items-center justify-center text-red-600">
                        <AlertCircle className="h-4.5 w-4.5" />
                    </div>
                </div>
            </div>

            {/* Team Performance Table */}
            <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
                <div className="p-4 sm:p-5 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between bg-gray-50/50 gap-3">
                    <div>
                        <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                            <Activity className="h-4 w-4 text-muted-foreground" />
                            Team Performance
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5 font-medium">Individual team member statistics</p>
                    </div>
                    {/* <div className="flex items-center gap-2.5 bg-background border border-border/50 px-3 py-2 rounded-lg self-start sm:self-auto">
                        <Checkbox checked={excludeArchived} onCheckedChange={(v) => setExcludeArchived(!!v)} id="exclude-archived" />
                        <label htmlFor="exclude-archived" className="text-xs font-semibold text-foreground cursor-pointer select-none">Exclude archived instances</label>
                    </div> */}
                </div>

                <div className="p-4 border-b border-border flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search team members..."
                            value={teamSearch}
                            onChange={(e) => setTeamSearch(e.target.value)}
                            className="pl-9 h-10 bg-muted/20"
                        />
                    </div>
                    <div className="flex items-center justify-between sm:justify-start gap-3">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-tight">Show:</span>
                            <UISelect
                                value={teamShowCount.toString()}
                                onValueChange={(val) => setTeamShowCount(Number(val))}
                                contentWidth="min-w-[80px]"
                                options={[
                                    { value: '10', label: '10' },
                                    { value: '20', label: '20' },
                                    { value: '50', label: '50' },
                                ]}
                            />
                        </div>
                        <Badge variant="secondary" className="bg-muted text-muted-foreground border-transparent px-2.5 py-1 text-[11px] font-bold">
                            {memberStats.length} members
                        </Badge>
                    </div>
                </div>

                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm text-left border-collapse min-w-[900px]">
                        <thead className="bg-muted/40 text-muted-foreground text-[10px] uppercase font-bold tracking-wider">
                            <tr>
                                <th className="px-6 py-4 cursor-pointer hover:bg-muted border-r border-border/50 sticky left-0 z-10 bg-muted/40" onClick={() => handleSort('name')}>Team Member <SortIcon columnKey="name" /></th>
                                <th className="px-6 py-4 cursor-pointer hover:bg-muted" onClick={() => handleSort('role')}>Role <SortIcon columnKey="role" /></th>
                                <th className="px-6 py-4 text-center cursor-pointer hover:bg-muted" onClick={() => handleSort('total')}>Total <SortIcon columnKey="total" /></th>
                                <th className="px-6 py-4 text-center cursor-pointer hover:bg-muted" onClick={() => handleSort('active')}>Active <SortIcon columnKey="active" /></th>
                                <th className="px-6 py-4 text-center cursor-pointer hover:bg-muted" onClick={() => handleSort('completed')}>Done <SortIcon columnKey="completed" /></th>
                                <th className="px-6 py-4 text-center cursor-pointer hover:bg-muted" onClick={() => handleSort('onTime')}>On Time <SortIcon columnKey="onTime" /></th>
                                <th className="px-6 py-4 text-center cursor-pointer hover:bg-muted" onClick={() => handleSort('late')}>Late <SortIcon columnKey="late" /></th>
                                <th className="px-6 py-4 text-center cursor-pointer hover:bg-muted" onClick={() => handleSort('overdue')}>Overdue <SortIcon columnKey="overdue" /></th>
                                <th className="px-6 py-4 min-w-[150px] cursor-pointer hover:bg-muted" onClick={() => handleSort('performance')}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <span className="flex items-center gap-1">
                                                Perf. <SortIcon columnKey="performance" />
                                            </span>
                                        </TooltipTrigger>
                                        <TooltipContent className="z-[100]">
                                            <p className="text-xs font-semibold">On-time Delivery Rate</p>
                                            <p className="text-[10px] opacity-80">Completed On-Time / Total Completed Tasks</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {displayedTeamMembers?.map(m => (
                                <tr key={m?.id} className="hover:bg-muted/30 transition-colors group">
                                    <td className="px-6 py-4 font-bold text-foreground border-r border-border/20 sticky left-0 z-10 bg-white group-hover:bg-muted/50 transition-colors">{m?.name}</td>
                                    <td className="px-6 py-4"><Badge variant="outline" className="text-[10px] font-bold uppercase tracking-tight bg-background">{m?.role}</Badge></td>
                                    <td className="px-6 py-4 text-center font-medium">{m?.total}</td>
                                    <td className="px-6 py-4 text-center text-blue-600 bg-blue-50/20 font-bold">{m?.active}</td>
                                    <td className="px-6 py-4 text-center font-black bg-gray-50/40 text-foreground">{m?.completed}</td>
                                    <td className="px-6 py-4 text-center text-emerald-600 font-bold">{m?.onTime}</td>
                                    <td className="px-6 py-4 text-center text-red-600 font-black">
                                        <div className="flex items-center justify-center gap-2">
                                            {m?.late}
                                            {m?.late > 0 && (
                                                <button
                                                    onClick={() => setSelectedLateTaskMember(m)}
                                                    className="p-1 rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-colors active:scale-95"
                                                    title="View Late Task Details"
                                                >
                                                    <Eye className="h-3 w-3" />
                                                </button>
                                            )}
                                        </div>
                                    </td>                                    <td className="px-6 py-4 text-center text-red-600 font-black">
                                        <div className="flex items-center justify-center gap-2">
                                            {m?.overdue}
                                            {m?.overdue > 0 && (
                                                <button
                                                    onClick={() => setSelectedOverdueMember(m)}
                                                    className="p-1 rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-colors active:scale-95"
                                                    title="View Overdue Details"
                                                >
                                                    <Eye className="h-3 w-3" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2.5">
                                            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full transition-all duration-500 ease-out ${m?.performance >= 80 ? 'bg-emerald-500' : m?.performance >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                                                    style={{ width: `${m?.performance}%` }}
                                                />
                                            </div>
                                            <span className="font-bold min-w-[38px] text-right text-[11px] text-foreground">{m?.performance}%</span>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {memberStats?.length === 0 && (
                                <tr>
                                    <td colSpan={9} className="px-6 py-12 text-center text-muted-foreground italic bg-muted/5">
                                        No team performance data available for the selected filters.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* MOBILE TEAM CARDS */}
                <div className="md:hidden divide-y divide-border">
                    {displayedTeamMembers?.map(m => (
                        <div key={m?.id} className="p-5 active:bg-muted/30 transition-colors">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold border border-primary/20">
                                        {m.name.slice(0, 2).toUpperCase()}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-foreground text-sm leading-none mb-1">{m.name}</h4>
                                        <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-tight py-0 px-1.5 h-4 bg-muted/30">{m.role}</Badge>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-0.5">Efficiency</span>
                                    <span className={`text-sm font-black ${m?.performance >= 80 ? 'text-emerald-500' : m?.performance >= 50 ? 'text-amber-500' : 'text-red-500'}`}>{m.performance}%</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-3 mb-4">
                                <div className="p-2.5 rounded-xl bg-muted/20 border border-border/40 text-center">
                                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-tight block mb-1">Total</span>
                                    <span className="text-sm font-bold text-foreground">{m.total}</span>
                                </div>
                                <div className="p-2.5 rounded-xl bg-blue-50/40 border border-blue-100/50 text-center">
                                    <span className="text-[9px] font-bold text-blue-600/70 uppercase tracking-tight block mb-1">Active</span>
                                    <span className="text-sm font-bold text-blue-600">{m.active}</span>
                                </div>
                                <div className="p-2.5 rounded-xl bg-emerald-50/40 border border-emerald-100/50 text-center">
                                    <span className="text-[9px] font-bold text-emerald-600/70 uppercase tracking-tight block mb-1">Done</span>
                                    <span className="text-sm font-bold text-emerald-600">{m.completed}</span>
                                </div>
                            </div>

                            <div className="flex items-center justify-between gap-4">
                                <div className="flex-1 space-y-2">
                                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-tight text-muted-foreground px-0.5">
                                        <div className="flex gap-2">
                                            <span className="text-emerald-600">On Time: {m.onTime}</span>
                                            <span className="text-orange-600">Late: {m.late}</span>
                                        </div>
                                    </div>
                                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                        <div
                                            className={`h-full transition-all duration-500 ${m?.performance >= 80 ? 'bg-emerald-500' : m?.performance >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                                            style={{ width: `${m?.performance}%` }}
                                        />
                                    </div>
                                </div>

                                <div className="shrink-0">
                                    {m?.overdue > 0 ? (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setSelectedOverdueMember(m)}
                                            className="h-9 px-3 border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 font-bold text-[11px] gap-1.5"
                                        >
                                            <AlertCircle className="h-3.5 w-3.5" />
                                            {m.overdue} Overdue
                                        </Button>
                                    ) : (
                                        <Badge variant="outline" className="h-9 px-3 text-muted-foreground/60 border-border/50 bg-muted/10 font-bold text-[10px]">
                                            No Overdue
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}

                    {memberStats?.length === 0 && (
                        <div className="py-12 text-center text-muted-foreground bg-muted/5 italic">
                            No member performance data.
                        </div>
                    )}
                </div>
            </div>

            {/* Task Details Table */}
            {/* <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
                <div className="p-4 sm:p-5 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between bg-gray-50/50 gap-2">
                    <div>
                        <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                            <CheckSquare className="h-4 w-4 text-muted-foreground" />
                            Task Details
                        </h3>
                        <p className="text-[11px] text-muted-foreground mt-0.5 font-medium uppercase tracking-tight">
                            Showing <span className="text-foreground">{allTasksCount}</span> total records
                        </p>
                    </div>
                    <Badge variant="outline" className="bg-background font-bold text-xs self-start sm:self-auto py-1 border-border/50">
                        {selectedMember !== 'all' ? users.find(u => u.id === selectedMember)?.name : 'All Members'} <span className="mx-1.5 opacity-30 select-none">|</span> {dateRange}
                    </Badge>
                </div>

                <div className="p-4 border-b border-border flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">

                    <div className="relative w-full max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            value={taskSearch}
                            onChange={(e) => setTaskSearch(e.target.value)}
                            placeholder="Search tasks, members, or instances..."
                            className="pl-9 h-10 bg-muted/20"
                        />
                    </div>

                    <div className="relative flex items-center gap-2">

                    </div>
                    <div className="flex flex-col sm:flex-row w-full md:w-auto items-stretch sm:items-center gap-3">
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-tight">Show:</span>
                        <UISelect
                            value={limit.toString()}
                            onValueChange={(val) => setLimit(Number(val))}
                            contentWidth="min-w-[80px]"
                            options={[
                                { value: '10', label: '10' },
                                { value: '20', label: '20' },
                                { value: '50', label: '50' },
                            ]}
                        />
                        <UISelect
                            value={taskStatusFilter}
                            onValueChange={setTaskStatusFilter}
                            className="w-full sm:w-[160px] h-10 bg-muted/20"
                            options={[
                                { value: 'all', label: 'All Status' },
                                { value: 'active', label: 'Active' },
                                { value: 'overdue', label: 'Overdue' },
                                // { value: 'in_progress', label: 'In Progress' },
                                { value: 'completed', label: 'Completed' },
                            ]}
                        />
                        <UISelect
                            value={taskClientFilter}
                            onValueChange={setTaskClientFilter}
                            className="w-full sm:w-[180px] h-10 bg-muted/20"
                            options={[
                                { value: 'all', label: 'All Clients' },
                                ...availableClients.map(c => ({ value: c, label: c }))
                            ]}
                        />
                    </div>
                </div>

                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm text-left border-collapse min-w-[600px]">
                        <thead className="bg-muted/40 text-muted-foreground text-[10px] uppercase font-bold tracking-wider">
                            <tr>
                                <th className="px-6 py-4 cursor-pointer hover:bg-muted select-none transition-colors" onClick={() => handleTaskSort('title')}>Task <TaskSortIcon columnKey="title" /></th>
                                <th className="px-6 py-4 cursor-pointer hover:bg-muted select-none transition-colors" onClick={() => handleTaskSort('assigned_user')}>Assigned To <TaskSortIcon columnKey="assigned_user" /></th>
                                <th className="px-6 py-4 cursor-pointer hover:bg-muted select-none transition-colors" onClick={() => handleTaskSort('instance')}>Instance <TaskSortIcon columnKey="instance" /></th>
                                <th className="px-6 py-4 cursor-pointer hover:bg-muted select-none transition-colors" onClick={() => handleTaskSort('status')}>Status <TaskSortIcon columnKey="status" /></th>
                                <th className="px-6 py-4 cursor-pointer hover:bg-muted select-none transition-colors" onClick={() => handleTaskSort('due_date')}>Due Date <TaskSortIcon columnKey="due_date" /></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {sortedTasks?.map((task: any) => { // Now fully paginated by server
                                const isCompleted = ['COMPLETED', 'APPROVED'].includes(task.status);
                                const isOverdue = task.due_date && !isCompleted && new Date(task.due_date) < new Date();
                                const deadline = task.due_date ? new Date(task.due_date) : null;
                                const overdueDays = deadline && isOverdue ? getOverdueDays(deadline) : null;

                                return (
                                    <tr
                                        key={task?.id}
                                        className="hover:bg-muted/30 transition-colors group cursor-pointer"
                                        onClick={() => {
                                            setSelectedDetailTask(task);
                                            setIsTaskModalOpen(true);
                                        }}
                                    >
                                        <td className="px-6 py-4 font-bold text-foreground max-w-[200px] truncate group-hover:text-primary transition-colors" title={task.title}>
                                            <div className="flex flex-col gap-0.5">
                                                <span className="flex items-center gap-2">
                                                    {task.title}
                                                    {task?.is_manual && <Badge variant="outline" className="text-[9px] bg-purple-50 text-purple-600 border-purple-200">Manual</Badge>}
                                                </span>
                                                <span className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                                                    <Folder className="h-2.5 w-2.5 opacity-50" />
                                                    {task?.project?.name || 'Manual Task'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {task?.assigned_user ? (
                                                <div className="flex items-center gap-2">
                                                    <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold border border-primary/20 shrink-0">
                                                        {task.assigned_user.name.slice(0, 2).toUpperCase()}
                                                    </div>
                                                    <span className="text-sm font-medium text-foreground">{task.assigned_user.name}</span>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-muted-foreground italic">Unassigned</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-muted-foreground text-[11px] font-semibold">
                                            {task?.instance?.name || '-'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <Badge
                                                variant={isOverdue ? 'destructive' : isCompleted ? 'success' : 'outline'}
                                                className={`text-[10px] font-bold uppercase tracking-tight px-2.5 py-1 ${!isOverdue && !isCompleted ? getStatusStyle(task.status, false) : ''}`}
                                            >
                                                {isOverdue ? `OVERDUE ${overdueDays ? `(${overdueDays})` : ''}` : task?.status?.replace('_', ' ')}
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-4 text-[11px] font-bold text-muted-foreground whitespace-nowrap">
                                            <div className="flex items-center gap-1.5">
                                                <Calendar className="h-3.5 w-3.5 opacity-60" />
                                                {task?.due_date ? new Date(task.due_date).toLocaleDateString('en-IN', {
                                                    day: 'numeric',
                                                    month: 'short',
                                                    year: 'numeric'
                                                }) : '-'}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}

                            {loading && allTasks.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="py-16 text-center text-muted-foreground bg-muted/5 italic">
                                        <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 opacity-30" />
                                        Streaming task data...
                                    </td>
                                </tr>
                            )}

                            {!loading && allTasks.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="py-16 text-center text-muted-foreground bg-muted/5 font-medium">
                                        No tasks found matching your filters.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* MOBILE LIST VIEW */}
                {/* <div className="md:hidden divide-y divide-border">
                    {allTasks?.map((task: any) => {
                        const isCompleted = ['COMPLETED', 'APPROVED'].includes(task.status);
                        const isOverdue = task.due_date && !isCompleted && new Date(task.due_date) < new Date();
                        const deadline = task.due_date ? new Date(task.due_date) : null;
                        const formattedDate = deadline ? deadline.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—';

                        return (
                            <div
                                key={task.id}
                                className="p-4 active:bg-muted/30 transition-colors cursor-pointer"
                                onClick={() => {
                                    setSelectedDetailTask(task);
                                    setIsTaskModalOpen(true);
                                }}
                            >
                                <div className="flex items-start justify-between mb-2.5">
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-primary/70 leading-none">
                                            {task?.project?.name || 'Manual Task'}
                                        </span>
                                        <h4 className="font-bold text-foreground text-[14px] leading-tight">
                                            {task.title}
                                            {task?.is_manual && <Badge variant="outline" className="ml-1.5 text-[8px] bg-purple-50 text-purple-600 border-purple-200 px-1 py-0 font-bold uppercase">M</Badge>}
                                        </h4>
                                    </div>
                                    <Badge
                                        variant={isOverdue ? 'destructive' : isCompleted ? 'success' : 'outline'}
                                        className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 ${!isOverdue && !isCompleted ? getStatusStyle(task.status, false) : ''}`}
                                    >
                                        {isOverdue ? 'OVERDUE' : task?.status?.replace('_', ' ')}
                                    </Badge>
                                </div>

                                <div className="flex items-center justify-between mt-3">
                                    <div className="flex items-center gap-2">
                                        {task?.assigned_user ? (
                                            <>
                                                <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[9px] font-bold border border-primary/20 shrink-0">
                                                    {task.assigned_user.name.slice(0, 1).toUpperCase()}
                                                </div>
                                                <span className="text-xs text-muted-foreground font-medium truncate max-w-[100px]">
                                                    {task.assigned_user.name}
                                                </span>
                                            </>
                                        ) : (
                                            <span className="text-[11px] text-muted-foreground/50 italic">Unassigned</span>
                                        )}
                                    </div>

                                    <div className={`flex items-center gap-1.5 text-[11px] font-bold ${isOverdue ? 'text-red-500' : 'text-muted-foreground'}`}>
                                        <Calendar className="h-3 w-3 opacity-60" />
                                        {formattedDate}
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {loading && allTasks.length === 0 && (
                        <div className="py-12 text-center text-muted-foreground bg-muted/5 italic">
                            <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 opacity-30" />
                            Loading tasks...
                        </div>
                    )}

                    {!loading && allTasks.length === 0 && (
                        <div className="py-12 text-center text-muted-foreground bg-muted/5 font-medium">
                            No tasks found.
                        </div>
                    )}
                </div> */}

                {/* PAGINATION CONTROLS */}
                {/* {allTasksTotalPages > 1 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between border-t border-border p-5 bg-gray-50/50 gap-4"> */}

                        {/* Info */}
                        {/* <div className='flex items-center gap-2'>
                            <div className="text-[13px] text-muted-foreground font-semibold bg-muted/40 px-3 py-1 rounded-full border border-border/50 order-2 sm:order-1">
                                Page <span className="text-foreground">{allTasksPage}</span> of{" "}
                                <span className="text-foreground">{allTasksTotalPages}</span>
                                <span className="mx-1 opacity-20">·</span>
                                <span className="text-foreground">{allTasksCount}</span> tasks
                            </div>
                            <div className="flex items-center gap-2 order-1 sm:order-1">
                                <span className="text-xs font-bold text-muted-foreground uppercase tracking-tight">Show:</span>
                                <UISelect
                                    value={limit.toString()}
                                    onValueChange={(val) => setLimit(Number(val))}
                                    contentWidth="min-w-[80px]"
                                    options={[
                                        { value: '10', label: '10' },
                                        { value: '20', label: '20' },
                                        { value: '50', label: '50' },
                                    ]}
                                />
                            </div>
                        </div>                        */}
                         {/* Pagination Controls */}
                        {/* <div className="flex items-center gap-2 flex-wrap order-1 sm:order-2"> */}

                            {/* First Page */}
                            {/* <Button
                                variant="outline"
                                size="sm"
                                className="h-9 px-2"
                                onClick={() => setPage(1)}
                                disabled={allTasksPage === 1 || loading}
                            >
                                {"<<"}
                            </Button> */}

                            {/* Prev */}
                            {/* <Button
                                variant="outline"
                                size="sm"
                                className="h-9 px-2"
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={allTasksPage === 1 || loading}
                            >
                                {"<"}
                            </Button> */}

                            {/* Page Numbers */}
                            {/* {Array.from({ length: allTasksTotalPages }, (_, i) => i + 1)
                                .filter((page) => {
                                    return (
                                        page === 1 ||
                                        page === allTasksTotalPages ||
                                        Math.abs(page - allTasksPage) <= 1
                                    );
                                })
                                .map((page, index, arr) => {
                                    const prevPage = arr[index - 1];

                                    return (
                                        <React.Fragment key={page}>
                                            {prevPage && page - prevPage > 1 && (
                                                <span className="px-1 text-muted-foreground">...</span>
                                            )}

                                            <Button
                                                variant={page === allTasksPage ? "default" : "outline"}
                                                size="sm"
                                                className={`h-9 w-9 p-0 font-semibold ${page === allTasksPage
                                                    ? "bg-primary text-white"
                                                    : "text-muted-foreground hover:text-foreground"
                                                    }`}
                                                onClick={() => setPage(page)}
                                                disabled={loading}
                                            >
                                                {page}
                                            </Button>
                                        </React.Fragment>
                                    );
                                })} */}

                            {/* Next */}
                            {/* <Button
                                variant="outline"
                                size="sm"
                                className="h-9 px-2"
                                onClick={() =>
                                    setPage(p => Math.min(allTasksTotalPages, p + 1))
                                }
                                disabled={allTasksPage === allTasksTotalPages || loading}
                            >
                                {">"}
                            </Button> */}

                            {/* Last */}
                            {/* <Button
                                variant="outline"
                                size="sm"
                                className="h-9 px-2"
                                onClick={() => setPage(allTasksTotalPages)}
                                disabled={allTasksPage === allTasksTotalPages || loading}
                            >
                                {">>"}
                            </Button> */}

                            {/* Manual Input */}
                            {/* <div className="flex items-center gap-1 ml-2">
                                <input
                                    type="number"
                                    min={1}
                                    max={allTasksTotalPages}
                                    value={allTasksPage}
                                    onChange={(e) => {
                                        let val = Number(e.target.value);
                                        if (!val) return;
                                        val = Math.max(1, Math.min(allTasksTotalPages, val));
                                        setPage(val);
                                    }}
                                    className="h-9 w-16 px-2 text-sm border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                                />
                            </div>

                        </div> */}
                    {/* </div> */}
                {/* )}
            </div>  */}

            <TaskModal isModalOpen={isTaskModalOpen} setIsModalOpen={setIsTaskModalOpen} selectedTask={selectedDetailTask} />

        </div>
    );
}