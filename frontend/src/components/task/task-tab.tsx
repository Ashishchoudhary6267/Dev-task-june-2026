import { CheckSquare, Loader2, Search, FileText, User, Calendar, CheckCircle2, XCircle, Clock, ExternalLink, ChevronLeft, ChevronRight, Folder, AlertTriangle } from 'lucide-react';
import React, { useState, useEffect, useMemo } from 'react';
import { Input, UISelect } from '../ui';
import { Badge } from '../ui';
import { useProjectStore } from '@/lib/zustand/projects/createproject';
import { useTaskStore } from '@/lib/zustand/tasks/tasks';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import TaskModal from './overdue-details-modal';
import Loader from '../ui/loader';

export default function TasksTab({ companyId }: { companyId?: string }) {

    const STEP_LABELS: Record<number, { label: string; color: string }> = {
        1: { label: 'Copywriting', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
        2: { label: 'Review', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
        3: { label: 'Design', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' },
        4: { label: 'Final Review', color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
    };

    const [taskSearch, setTaskSearch] = useState('');
    const [projectFilter, setProjectFilter] = useState('all');
    const [activeTab, setActiveTab] = useState<"active" | "pending" | "completed">("active");

    // Independent pagination states for each tab
    const [pages, setPages] = useState({ active: 1, pending: 1, completed: 1 });
    const [limit, setLimit] = useState(10);

    const [selectedTask, setSelectedTask] = useState<any>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const { projects } = useProjectStore();
    const { activeTab: activeTabData, pendingTab: pendingTabData, completedTab: completedTabData, fetchTabTasks } = useTaskStore();

    const TAB_STATUS_MAP: Record<string, string[]> = {
        active: ["IN_PROGRESS", "LOCKED"],
        pending: ["PENDING_APPROVAL"],
        completed: ["COMPLETED"],
    };

    const tabDataMap = {
        active: activeTabData,
        pending: pendingTabData,
        completed: completedTabData
    };

    // The data for the current active tab
    const currentData = tabDataMap[activeTab];

    /* ---------------- TABS ---------------- */

    const tabs = [
        { label: `Active Tasks`, value: "active" },
        { label: `Pending Approval`, value: "pending" },
        { label: `Completed`, value: "completed" },
    ];

    /* ---------------- FETCH DATA ---------------- */

    // Fetch ALL tabs when global filters change
    useEffect(() => {
        setPages({ active: 1, pending: 1, completed: 1 });
        const timeoutId = setTimeout(() => {
            fetchTabTasks('active', { page: 1, limit, project_id: projectFilter, search: taskSearch || undefined, status: TAB_STATUS_MAP['active'].join(','), company_id: companyId });
            fetchTabTasks('pending', { page: 1, limit, project_id: projectFilter, search: taskSearch || undefined, status: TAB_STATUS_MAP['pending'].join(','), company_id: companyId });
            fetchTabTasks('completed', { page: 1, limit, project_id: projectFilter, search: taskSearch || undefined, status: TAB_STATUS_MAP['completed'].join(','), company_id: companyId });
        }, 300); // 300ms debounce for search

        return () => clearTimeout(timeoutId);
    }, [projectFilter, taskSearch, limit, projectFilter]);

    const handlePageChange = (newPage: number) => {
        setPages(prev => ({ ...prev, [activeTab]: newPage }));
        fetchTabTasks(activeTab, {
            page: newPage,
            limit,
            project_id: projectFilter,
            search: taskSearch || undefined,
            status: TAB_STATUS_MAP[activeTab].join(','),
            company_id: companyId
        });
    };

    /* ---------- STATUS BADGE HELPER ---------- */
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

    /* ---------- OVERDUE HELPER ---------- */
    const getOverdueDays = (deadline: Date) => {
        const diffMs = Date.now() - deadline.getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays <= 0) return null;
        return diffDays === 1 ? '1d' : `${diffDays}d`;
    };

    return (
        <div className="space-y-6">

            {/* HEADER */}
            <div className="flex flex-col gap-5">

                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                    <div className="space-y-1">
                        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground" style={{ fontFamily: 'Manrope, sans-serif' }}>
                            Master Task List
                        </h2>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            {currentData?.count || 0} total tasks across {currentData?.totalPages || 1} pages
                        </p>
                    </div>

                    {/* Tab pills – Desktop: right-aligned, Mobile: full-width scroll */}
                    <div className="flex items-center gap-1.5 p-1 rounded-full bg-muted/40 border border-border/30 w-fit max-w-full overflow-x-auto scrollbar-hide shrink-0">
                        {tabs?.map(tab => (
                            <button
                                key={tab.value}
                                onClick={() => setActiveTab(tab.value as any)}
                                className={`px-4 py-2 rounded-full text-xs font-semibold tracking-wide transition-all whitespace-nowrap ${activeTab === tab.value
                                    ? 'bg-white text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-white/50'
                                    }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* SEARCH + FILTERS ROW */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <div className="relative flex-1 sm:max-w-sm">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search tasks, IDs, or markers..."
                            className="pl-10 h-11 rounded-xl bg-white border-border/40 shadow-sm focus:border-primary/40 focus:ring-primary/5 text-sm"
                            value={taskSearch}
                            onChange={e => setTaskSearch(e.target.value)}
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <UISelect
                            value={projectFilter}
                            onValueChange={(val) => setProjectFilter(val)}
                            className="flex-1 sm:w-48 h-11"
                            placeholder="All Projects"
                            options={[
                                { value: 'all', label: 'All Projects', icon: Folder },
                                ...(projects?.map((p: any) => ({ value: p.id, label: p.name, icon: Folder })) || [])
                            ]}
                        />
                        <UISelect
                            value={limit.toString()}
                            onValueChange={(val) => setLimit(Number(val))}
                            className="w-[80px] h-11"
                            contentWidth="min-w-[80px]"
                            options={[
                                { value: '10', label: '10' },
                                { value: '20', label: '20' },
                                { value: '50', label: '50' },
                            ]}
                        />
                    </div>
                </div>
            </div>


            {/* ---- DESKTOP TABLE (hidden on mobile) ---- */}
            <div className="hidden sm:block rounded-2xl bg-white border border-border/30 shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-border/30">
                            <th className="text-left px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Task Details</th>
                            <th className="text-left px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Assignee</th>
                            <th className="text-left px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hidden md:table-cell">Deadline</th>
                            <th className="text-left px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Status</th>
                        </tr>
                    </thead>

                    <tbody>
                        {currentData?.loading && currentData?.tasks.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="text-center py-20 text-muted-foreground">
                                    <Loader />
                                </td>
                            </tr>
                        ) : (currentData?.tasks || []).length === 0 ? (
                            <tr>
                                <td colSpan={4} className="text-center py-20 text-muted-foreground">
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="h-14 w-14 rounded-2xl bg-muted/30 flex items-center justify-center mb-1">
                                            <CheckSquare className="h-7 w-7 opacity-20" />
                                        </div>
                                        <p className="font-semibold text-foreground">No tasks found</p>
                                        <p className="text-sm max-w-xs">Try adjusting your filters or search term.</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            (currentData?.tasks || []).map((t: any) => {
                                const deadline = t.task_steps?.find(
                                    (s: any) => s.step_order === t.current_level
                                )?.original_due_date
                                    ? new Date(t.task_steps?.find(
                                        (s: any) => s.step_order === t.current_level
                                    )?.original_due_date)
                                    : null;

                                const isOverdue =
                                    deadline &&
                                    t.task_steps?.find(
                                        (s: any) => s.step_order === t.current_level
                                    )?.status === 'IN_PROGRESS' &&
                                    deadline.getTime() < Date.now();

                                const formattedDeadline = deadline ? deadline.toLocaleDateString('en-IN', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                }) : '—';

                                const overdueDays = deadline && isOverdue ? getOverdueDays(deadline) : null;

                                return (
                                    <tr
                                        key={t.id}
                                        className="group hover:bg-muted/20 transition-colors cursor-pointer border-b border-border/10 last:border-b-0"
                                        onClick={() => {
                                            setSelectedTask(t);
                                            setIsModalOpen(true);
                                        }}
                                    >
                                        {/* TASK DETAILS */}
                                        <td className="px-6 py-5">
                                            <div className="flex flex-col gap-0.5">
                                                <span className="font-semibold text-foreground group-hover:text-primary transition-colors leading-snug flex items-center gap-2">
                                                    {t.title}
                                                    {t.is_manual && (
                                                        <Badge variant="outline" className="text-[9px] bg-purple-50 text-purple-600 border-purple-200 px-1.5 py-0 font-bold uppercase tracking-tight">Manual</Badge>
                                                    )}
                                                </span>
                                                <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                                                    <Folder className="h-3 w-3 opacity-50" />
                                                    {t.project?.name || 'Manual Task'}
                                                </span>
                                            </div>
                                        </td>

                                        {/* ASSIGNEE */}
                                        <td className="px-6 py-5">
                                            {t.assigned_user ? (
                                                <div className="flex items-center gap-2.5">
                                                    <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[11px] font-bold border border-primary/20 shrink-0">
                                                        {t.assigned_user.name.slice(0, 2).toUpperCase()}
                                                    </div>
                                                    <span className="text-sm font-medium text-foreground truncate max-w-[120px]">
                                                        {t.assigned_user.name}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-muted-foreground/50 italic">Unassigned</span>
                                            )}
                                        </td>

                                        {/* DEADLINE */}
                                        <td className="px-6 py-5 hidden md:table-cell">
                                            {isOverdue ? (
                                                <span className="text-sm font-semibold text-red-500 flex items-center gap-1.5">
                                                    <AlertTriangle className="h-3.5 w-3.5" />
                                                    Overdue {overdueDays ? `(${overdueDays})` : ''}
                                                </span>
                                            ) : (
                                                <span className="text-sm text-muted-foreground">
                                                    {formattedDeadline}
                                                </span>
                                            )}
                                        </td>

                                        {/* STATUS */}
                                        <td className="px-6 py-5">
                                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusStyle(t.status, !!isOverdue)}`}>
                                                {isOverdue ? 'OVERDUE' : t?.status?.replace('_', ' ')}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>


            {/* ---- MOBILE CARDS (hidden on desktop) ---- */}
            <div className="sm:hidden space-y-3">
                {currentData?.loading && currentData?.tasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16">
                        <Loader />
                    </div>
                ) : (currentData?.tasks || []).length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 rounded-2xl bg-white border border-border/30">
                        <div className="h-14 w-14 rounded-2xl bg-muted/30 flex items-center justify-center mb-3">
                            <CheckSquare className="h-7 w-7 opacity-20" />
                        </div>
                        <p className="font-semibold text-foreground">No tasks found</p>
                        <p className="text-sm text-muted-foreground">Try adjusting your filters.</p>
                    </div>
                ) : (
                    (currentData?.tasks || []).map((t: any) => {
                        const deadline = t.task_steps?.find(
                            (s: any) => s.step_order === t.current_level
                        )?.original_due_date
                            ? new Date(t.task_steps?.find(
                                (s: any) => s.step_order === t.current_level
                            )?.original_due_date)
                            : null;

                        const isOverdue =
                            deadline &&
                            t.task_steps?.find(
                                (s: any) => s.step_order === t.current_level
                            )?.status === 'IN_PROGRESS' &&
                            deadline.getTime() < Date.now();

                        const formattedDeadline = deadline ? deadline.toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                        }) : '—';

                        return (
                            <div
                                key={t.id}
                                className="bg-white rounded-2xl border border-border/30 p-4 shadow-sm active:scale-[0.99] transition-transform cursor-pointer"
                                onClick={() => {
                                    setSelectedTask(t);
                                    setIsModalOpen(true);
                                }}
                            >
                                {/* Top row: Project label + Status badge */}
                                <div className="flex items-start justify-between mb-2">
                                    <span className="text-[9px] font-bold uppercase tracking-widest text-primary/70 leading-none">
                                        {t.project?.name || 'Manual Task'}
                                    </span>
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${getStatusStyle(t.status, !!isOverdue)}`}>
                                        {isOverdue ? 'OVERDUE' : t?.status?.replace('_', ' ')}
                                    </span>
                                </div>

                                {/* Task Title */}
                                <h4 className="font-bold text-foreground text-sm leading-snug mb-3 flex items-center gap-1.5" style={{ fontFamily: 'Manrope, sans-serif' }}>
                                    {t.title}
                                    {t.is_manual && (
                                        <Badge variant="outline" className="text-[8px] bg-purple-50 text-purple-600 border-purple-200 px-1 py-0 font-bold uppercase">M</Badge>
                                    )}
                                </h4>

                                {/* Bottom row: Assignee + Date */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        {t.assigned_user ? (
                                            <>
                                                <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[9px] font-bold border border-primary/20 shrink-0">
                                                    {t.assigned_user.name.slice(0, 1).toUpperCase()}
                                                </div>
                                                <span className="text-xs text-muted-foreground font-medium truncate max-w-[100px]">
                                                    {t.assigned_user.name}
                                                </span>
                                            </>
                                        ) : (
                                            <span className="text-[11px] text-muted-foreground/50 italic">Unassigned</span>
                                        )}
                                    </div>

                                    <div className={`flex items-center gap-1 text-xs ${isOverdue ? 'text-red-500 font-semibold' : 'text-muted-foreground'}`}>
                                        <Calendar className="h-3 w-3 opacity-60" />
                                        {isOverdue ? (
                                            <span className="text-red-500">{formattedDeadline}</span>
                                        ) : (
                                            formattedDeadline
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>


            {/* PAGINATION */}
            {(currentData?.totalPages || 1) > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-xs text-muted-foreground font-medium order-2 sm:order-1">
                        Showing <span className="text-foreground font-semibold">{currentData?.page || 1}</span> of <span className="text-foreground font-semibold">{currentData?.totalPages || 1}</span> pages
                    </div>
                    <div className="flex items-center gap-1.5 order-1 sm:order-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-3 rounded-lg text-[10px] font-bold uppercase tracking-widest border-border/50 hover:border-primary/30 transition-all disabled:opacity-30"
                            onClick={() => handlePageChange(Math.max(1, (currentData?.page || 1) - 1))}
                            disabled={(currentData?.page || 1) <= 1 || currentData?.loading}
                        >
                            Prev
                        </Button>

                        {/* Page number buttons */}
                        <div className="flex items-center gap-1">
                            {Array.from({ length: Math.min(5, currentData?.totalPages || 1) }, (_, i) => {
                                const pageNum = i + 1;
                                return (
                                    <button
                                        key={pageNum}
                                        onClick={() => handlePageChange(pageNum)}
                                        className={`h-8 w-8 rounded-lg text-xs font-semibold transition-all ${(currentData?.page || 1) === pageNum
                                            ? 'bg-primary text-white shadow-sm'
                                            : 'text-muted-foreground hover:bg-muted/30'
                                            }`}
                                    >
                                        {pageNum}
                                    </button>
                                );
                            })}
                        </div>

                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-3 rounded-lg text-[10px] font-bold uppercase tracking-widest border-border/50 hover:border-primary/30 transition-all disabled:opacity-30"
                            onClick={() => handlePageChange(Math.min(currentData?.totalPages || 1, (currentData?.page || 1) + 1))}
                            disabled={(currentData?.page || 1) >= (currentData?.totalPages || 1) || currentData?.loading}
                        >
                            Next
                        </Button>
                    </div>
                </div>
            )}


            {/* TASK DETAIL MODAL */}
            <TaskModal isModalOpen={isModalOpen} setIsModalOpen={setIsModalOpen} selectedTask={selectedTask} />

        </div>
    );
}