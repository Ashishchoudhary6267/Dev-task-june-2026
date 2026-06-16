import React from 'react'
import { usePerformanceStore } from '@/lib/zustand/performance/performance';
import { MemberPerformanceSummary, MemberTask } from '@/lib/types/auth';
import { useState, useMemo, useEffect } from 'react';
import { Search, X, Loader2, Download, ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react';
import { Input, Button, Checkbox, useToast } from '@/components/ui';
import { useTaskStore } from '@/lib/zustand/tasks/tasks';
import TaskModal from '../task/overdue-details-modal';
import { StatusFilter, RoleFilter } from '@/lib/types/auth';


export default function MemberTaskModal({
    member, onClose,
}: {
    member: MemberPerformanceSummary; onClose: () => void;
}) {
    const { memberTasks, memberTasksLoading, memberTasksError, fetchMemberTasks, clearMemberTasks, dateFrom, dateTo } =
        usePerformanceStore();

    const [modalSearch, setModalSearch] = useState('');
    const [statusFilters, setStatusFilters] = useState<Set<StatusFilter>>(new Set(['all']));
    const [roleFilter, setRoleFilter] = useState<RoleFilter>('all_roles');
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

    const { fetchTaskDetails } = useTaskStore();
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [selectedFullTask, setSelectedFullTask] = useState<any>(null);
    const [loadingTaskId, setLoadingTaskId] = useState<string | null>(null);
    const { addToast } = useToast();

    const handleRowClick = async (taskId: string) => {
        setLoadingTaskId(taskId);
        const fullTask = await fetchTaskDetails(taskId);
        setLoadingTaskId(null);
        if (fullTask) {
            setSelectedFullTask(fullTask);
            setIsTaskModalOpen(true);
        } else {
            addToast({
                title: "Error",
                description: "Failed to fetch task details",
                variant: "destructive"
            });
        }
    };

    useEffect(() => {
        fetchMemberTasks(member.id, dateFrom, dateTo);
        return () => clearMemberTasks();
    }, [member.id]);

    function formatDate(dateStr: string | null | undefined): string {
        if (!dateStr || dateStr === "—" || dateStr === "-") return "-";
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return "-";
        return new Intl.DateTimeFormat("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
        }).format(d);
    }

    function toggleFilter(f: StatusFilter) {
        if (f === 'all') { setStatusFilters(new Set(['all'])); return; }
        const next = new Set(statusFilters);
        next.delete('all');
        if (next.has(f)) { next.delete(f); if (next.size === 0) next.add('all'); }
        else next.add(f);
        setStatusFilters(next);
    }
    function statusBadge(t: MemberTask) {
        let label = '';
        let cls = '';

        const isLate = t.status === 'completed' && t.completedDate && t.dueDate && new Date(t.completedDate) > new Date(t.dueDate);

        if (isLate) {
            label = 'late';
            cls = 'bg-orange-100 text-orange-700 border-orange-200';
        } else {
            const map: Record<MemberTask['status'], { label: string; cls: string }> = {
                completed: { label: 'completed', cls: 'bg-green-100 text-green-700 border-green-200' },
                in_progress: { label: 'in progress', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
                pending: { label: 'pending', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
                overdue: { label: 'overdue', cls: 'bg-red-100 text-red-700 border-red-200' },
            };
            const s = map[t.status];
            label = s.label;
            cls = s.cls;
        }

        return (
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cls}`}>
                {label}
            </span>
        );
    }

    function roleTypeBadge(taskName: string) {
        const isReviewer = taskName.includes('(Approval Required)');
        if (!isReviewer) return null;
        return (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200">
                Reviewer
            </span>
        );
    }


    const filtered = useMemo(() => {
        return memberTasks.filter(t => {
            const matchSearch = modalSearch.trim() === ''
                || t.taskName.toLowerCase().includes(modalSearch.toLowerCase())
                || t.instance.toLowerCase().includes(modalSearch.toLowerCase())
                || t.client.toLowerCase().includes(modalSearch.toLowerCase());
            let matchStatus = statusFilters.has('all') || statusFilters.has(t.status as StatusFilter);
            if (!matchStatus && statusFilters.has('late')) {
                if (t.status === 'completed' && t.completedDate && t.dueDate) {
                    if (new Date(t.completedDate) > new Date(t.dueDate)) {
                        matchStatus = true;
                    }
                }
            }

            const isReviewerTask = t.taskName.includes('(Approval Required)');
            const matchRole = roleFilter === 'all_roles'
                || (roleFilter === 'reviewer' && isReviewerTask)
                || (roleFilter === 'worker' && !isReviewerTask);

            return matchSearch && matchStatus && matchRole;
        });
    }, [memberTasks, modalSearch, statusFilters, roleFilter]);

    const sortedFiltered = useMemo(() => {
        let sortableTasks = [...filtered];
        if (sortConfig.key && sortConfig.direction) {
            sortableTasks.sort((a: any, b: any) => {
                let aValue = a[sortConfig.key];
                let bValue = b[sortConfig.key];

                if (typeof aValue === 'string') aValue = aValue.toLowerCase();
                if (typeof bValue === 'string') bValue = bValue.toLowerCase();

                if (aValue == null) aValue = '';
                if (bValue == null) bValue = '';

                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return sortableTasks;
    }, [filtered, sortConfig]);

    function handleExportCSV() {
        const headers = ['Task Name', 'Role Type', 'Instance', 'Client', 'Status', 'Assigned', 'Due Date', 'Overdue'];
        const rows = sortedFiltered.map(t => {
            const isReviewerTask = t.taskName.includes('(Approval Required)');
            const cleanTaskName = t.taskName.replace(' (Approval Required)', '');
            const roleType = isReviewerTask ? 'Reviewer' : 'Worker';

            const isLate = t.status === 'completed' && t.completedDate && t.dueDate && new Date(t.completedDate) > new Date(t.dueDate);

            return [
                cleanTaskName,
                roleType,
                t.instance,
                t.client,
                isLate ? 'late' : t.status,
                formatDate(t.assigned),
                formatDate(t.dueDate),
                t.overdueDays != null ? `${t.overdueDays} days` : '-',
            ];
        });
        const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url;
        a.download = `${member.name.replace(' ', '_')}_tasks.csv`; a.click();
        URL.revokeObjectURL(url);
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="relative bg-card border border-border rounded-xl shadow-xl w-[90vw] sm:max-w-4xl max-h-[80vh] flex flex-col mx-4">
                {/* Header */}
                <div className="flex items-start justify-between p-5 pb-3 border-b border-border">
                    <div>
                        <h2 className="text-lg font-semibold text-foreground">{member.name} - Task Details</h2>
                        <p className="text-xs text-muted-foreground">View detailed task information and export to CSV</p>
                    </div>
                    <button onClick={onClose} className="ml-4 p-1 rounded-sm text-muted-foreground hover:text-foreground transition-colors">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Search */}
                <div className="px-5 pt-4 pb-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search tasks, instances, clients, or status..."
                            value={modalSearch}
                            onChange={e => setModalSearch(e.target.value)}
                            className="pl-9 w-full"
                        />
                    </div>
                </div>

                {/* Filter row */}
                <div className="px-5 py-2 space-y-3">
                    <div className="flex items-center gap-4 flex-wrap">
                        <span className="text-xs font-medium text-foreground">Filter by status:</span>
                        {(['all', 'completed', 'in_progress', 'pending', 'overdue', 'late'] as StatusFilter[]).map(f => (
                            <label key={f} className="flex items-center gap-1.5 cursor-pointer text-xs text-foreground">
                                <Checkbox
                                    checked={statusFilters.has(f)}
                                    onCheckedChange={() => toggleFilter(f)}
                                />
                                {f === 'all' ? 'All' : f === 'in_progress' ? 'In Progress' : f.charAt(0).toUpperCase() + f.slice(1)}
                            </label>
                        ))}
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 flex-wrap">
                            <span className="text-xs font-medium text-foreground">Filter by role:</span>
                            {[
                                { value: 'all_roles', label: 'All Roles' },
                                { value: 'worker', label: 'Worker Tasks' },
                                { value: 'reviewer', label: 'Reviewer Tasks' },
                            ].map(r => (
                                <label key={r.value} className="flex items-center gap-1.5 cursor-pointer text-xs text-foreground">
                                    <input
                                        type="radio"
                                        name="roleFilter"
                                        checked={roleFilter === r.value}
                                        onChange={() => setRoleFilter(r.value as RoleFilter)}
                                        className="accent-primary"
                                    />
                                    {r.label}
                                </label>
                            ))}
                        </div>
                        <Button variant="outline" size="sm" onClick={handleExportCSV} className="flex items-center gap-1.5 text-xs">
                            <Download className="h-3.5 w-3.5" />
                            Export CSV
                        </Button>
                    </div>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-auto px-5 pb-5">
                    {memberTasksLoading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : memberTasksError ? (
                        <div className="py-10 text-center text-red-500 text-sm">{memberTasksError}</div>
                    ) : (
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="border-b border-border">
                                    {[
                                        { label: 'Task Name', key: 'taskName' },
                                        { label: 'Role', key: 'taskName' },
                                        { label: 'Instance', key: 'instance' },
                                        { label: 'Client', key: 'client' },
                                        { label: 'Status', key: 'status' },
                                        { label: 'Assigned', key: 'assigned' },
                                        { label: 'Due Date', key: 'dueDate' },
                                        { label: 'Overdue', key: 'overdueDays' },
                                    ].map((h, idx) => (
                                        <th
                                            key={`${h.key}-${idx}`}
                                            className="text-left py-2 pr-4 font-medium text-muted-foreground whitespace-nowrap cursor-pointer hover:text-foreground transition-colors group/th"
                                            onClick={() => h.label !== 'Role' && handleSort(h.key)}
                                        >
                                            <div className="flex items-center gap-1.5 uppercase text-[10px] tracking-wider">
                                                {h.label}
                                                {h.label !== 'Role' && (
                                                    <div className="text-muted-foreground/30 group-hover/th:text-primary transition-colors">
                                                        {sortConfig.key === h.key ? (
                                                            sortConfig.direction === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                                                        ) : <ArrowUpDown className="h-3 w-3" />}
                                                    </div>
                                                )}
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {sortedFiltered?.map(t => {
                                    const isReviewerTask = t?.taskName?.includes('(Approval Required)');
                                    const cleanTaskName = t?.taskName?.replace(' (Approval Required)', '');

                                    return (
                                        <tr
                                            key={t.id}
                                            className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer"
                                            onClick={() => handleRowClick(t.id)}
                                        >
                                            <td className="py-2.5 pr-4 font-medium text-foreground">
                                                <div className="flex items-center gap-2">
                                                    {loadingTaskId === t.id && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                                                    {cleanTaskName}
                                                </div>
                                            </td>
                                            <td className="py-2.5 pr-4">
                                                {isReviewerTask ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200">
                                                        Reviewer
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200">
                                                        Worker
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-2.5 pr-4 text-primary font-medium">{t.instance}</td>
                                            <td className="py-2.5 pr-4 text-primary font-medium">{t.client}</td>
                                            <td className="py-2.5 pr-4">{statusBadge(t)}</td>
                                            <td className="py-2.5 pr-4 text-muted-foreground">{formatDate(t.assigned)}</td>
                                            <td className="py-2.5 pr-4 text-muted-foreground">{formatDate(t.dueDate)}</td>
                                            <td className="py-2.5">
                                                {t.overdueDays != null ? (
                                                    <span className="font-bold text-red-600">{t.overdueDays} days</span>
                                                ) : (
                                                    <span className="text-muted-foreground">-</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {sortedFiltered.length === 0 && !memberTasksLoading && (
                                    <tr>
                                        <td colSpan={7} className="py-10 text-center text-muted-foreground">
                                            No tasks match the current filters.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {selectedFullTask && (
                <TaskModal
                    isModalOpen={isTaskModalOpen}
                    setIsModalOpen={setIsTaskModalOpen}
                    selectedTask={selectedFullTask}
                />
            )}
        </div>
    );
}