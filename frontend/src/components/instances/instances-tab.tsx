import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { useAccessControl } from '@/lib/contexts/access-control-context';
import {
    Eye, Plus, RefreshCw, Activity, CalendarClock, Pause, Play,
    AlertTriangle, Trash2, CheckCircle2, Calendar, Clock,
    CalendarDays, CalendarRange, Settings2, Users, ChevronLeft, ChevronRight, Zap, Copy,
    MoreVertical, ArrowUpDown, ArrowUp, ArrowDown,
    FolderKanban
} from 'lucide-react'
import InstanceModal from '../instance-details-modal'
import {
    Dialog, DialogContent, DialogDescription, DialogFooter,
    DialogHeader, DialogTitle, useToast, UISelect,
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    Input
} from '../ui'
import { useInstanceStore } from '@/lib/zustand/instances/instances'
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import Loader from '../ui/loader'
import { useClientStore } from '@/lib/zustand/clients/client'
import { cn } from '@/lib/utils'
import { QuickSpawnModal } from './quick-spawn-modal'
import { CloneInstanceModal } from './clone-instance-modal'
import { useProjectStore } from '@/lib/zustand/projects/createproject'
import { useAuthStore } from '@/lib/zustand/user/user';

type InstanceSubTab = 'active' | 'scheduled' | 'paused' | 'completed';

/** Convert a local YYYY-MM-DD string (or Date) to UTC ISO at start-of-day */
const toStartOfDayISO = (d: string) => {
    const dt = new Date(d);
    dt.setHours(0, 0, 0, 0);
    return dt.toISOString();
};

/** Compute from_date / to_date from a preset string. Returns null for 'all'. */
const presetToDates = (preset: string, fromDate: string, toDate: string) => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0]; // YYYY-MM-DD

    if (preset === 'today') {
        return { from_date: todayStr, to_date: todayStr };
    }
    if (preset === 'last7') {
        const d = new Date(now);
        d.setDate(d.getDate() - 7);
        return { from_date: d.toISOString().split('T')[0], to_date: todayStr };
    }
    if (preset === 'last30') {
        const d = new Date(now);
        d.setDate(d.getDate() - 30);          // ← correct cross-month math
        return { from_date: d.toISOString().split('T')[0], to_date: todayStr };
    }
    if (preset === 'custom') {
        return {
            from_date: fromDate || undefined,
            to_date: toDate || undefined,
        };
    }
    return { from_date: undefined, to_date: undefined }; // 'all'
};

export default function InstancesTab({ onNewInstance }: {
    onNewInstance: () => void;
}) {
    const { canCreate, canEdit } = useAccessControl();
    const { addToast } = useToast();
    const {
        pauseInstance, resumeInstance, setInstanceActive,
        instances, instancesCount, totalPages, statusCounts,
        fetchInstances, instanceLoading
    } = useInstanceStore();
    const { clients, fetchClients } = useClientStore();

    const [selectedInstance, setSelectedInstance] = useState<any>(null);
    const [isInstanceDetailsOpen, setIsInstanceDetailsOpen] = useState(false);
    const [subTab, setSubTab] = useState<InstanceSubTab>('active');
    const [isPauseModalOpen, setIsPauseModalOpen] = useState(false);
    const [pauseReason, setPauseReason] = useState('');
    const [isPauseLoading, setIsPauseLoading] = useState(false);
    const [isResumeModalOpen, setIsResumeModalOpen] = useState(false);
    const [isMakeActiveModalOpen, setIsMakeActiveModalOpen] = useState(false);
    const [isResumeLoading, setIsResumeLoading] = useState(false);
    const [isQuickSpawnOpen, setIsQuickSpawnOpen] = useState(false);
    const [isCloneModalOpen, setIsCloneModalOpen] = useState(false);

    // ── Filter states ────────────────────────────────────────────────────
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [searchInput, setSearchInput] = useState('');   // raw input (instant)
    const [searchQuery, setSearchQuery] = useState('');   // debounced (sent to server)
    const [clientIdFilter, setClientIdFilter] = useState('all');
    const [datePreset, setDatePreset] = useState('all');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [templateIdFilter, setTemplateIdFilter] = useState('all');
    const [hasRejectedTask, setHasRejectedTask] = useState(false);
    const { fetchprojects, projects } = useProjectStore();
    const {user}= useAuthStore();

    // ── Sorting state ────────────────────────────────────────────────────
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        } else if (sortConfig && sortConfig.key === key && sortConfig.direction === 'desc') {
            setSortConfig(null);
            return;
        }
        setSortConfig({ key, direction });
    };

    const SortIcon = ({ columnKey }: { columnKey: string }) => {
        if (sortConfig?.key === columnKey) {
            return sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3 ml-1 inline-block" /> : <ArrowDown className="h-3 w-3 ml-1 inline-block" />;
        }
        return <ArrowUpDown className="h-3 w-3 ml-1 inline-block text-muted-foreground/30" />;
    };

    // ── Debounce search input ────────────────────────────────────────────
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const handleSearchChange = useCallback((val: string) => {
        setSearchInput(val);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            setSearchQuery(val);
            setPage(1); // reset to page 1 on new search
        }, 400);
    }, []);

    // ── Fetch dropdown data ──────────────────────────────────────────────
    useEffect(() => {
        fetchClients(undefined, 1, 100);
        fetchprojects();
    }, []);

    // ── Server-side fetch: fires on every filter/page/tab change ─────────
    useEffect(() => {
        const { from_date, to_date } = presetToDates(datePreset, fromDate, toDate);
        fetchInstances({
            page,
            limit,
            status: subTab,
            search: searchQuery || undefined,
            client_id: clientIdFilter !== 'all' ? clientIdFilter : undefined,
            project_id: templateIdFilter !== 'all' ? templateIdFilter : undefined,
            from_date,
            to_date,
            sort_by: sortConfig?.key || undefined,
            sort_order: sortConfig?.direction || undefined,
            has_rejected_task: hasRejectedTask || undefined,
        });
    }, [page, limit, subTab, searchQuery, clientIdFilter, templateIdFilter, datePreset, fromDate, toDate, sortConfig, hasRejectedTask]);

    // ── Reset page to 1 when tab, filters or sorting change ──────────────
    useEffect(() => { setPage(1); }, [subTab, limit, clientIdFilter, templateIdFilter, datePreset, fromDate, toDate, sortConfig, hasRejectedTask]);

    // ── Derived values from store ────────────────────────────────────────
    const paginatedInstances = instances;   // server already paged
    const filteredInstances = instances;   // server already filtered (for empty-state check)

    const openPauseModal = (inst: any) => {
        setSelectedInstance(inst);
        setPauseReason('');
        setIsPauseModalOpen(true);
    };
    const onresumeModal = (inst: any) => {
        setSelectedInstance(inst);
        setIsResumeModalOpen(true);
    }

    const onMakeActiveModal = (inst: any) => {
        setSelectedInstance(inst);
        setIsMakeActiveModalOpen(true);
    }

    const onCloneModal = (inst: any) => {
        setSelectedInstance(inst);
        setIsCloneModalOpen(true);
    }

    const canDelete = (inst: any) => {
        return (
            inst.is_paused === true &&
            inst.paused_date &&
            Date.now() - new Date(inst.paused_date).getTime() > 30 * 24 * 60 * 60 * 1000
        );
    };
    const handlePause = async () => {
        if (!selectedInstance) return;
        setIsPauseLoading(true);
        const ok = await pauseInstance(selectedInstance.id, pauseReason.trim() || undefined);
        setIsPauseLoading(false);
        if (ok) {
            addToast({ title: 'Instance paused', description: `"${selectedInstance.name}" has been paused.`, variant: 'default' });
            setIsPauseModalOpen(false);
        } else {
            addToast({ title: 'Failed to pause', description: 'Something went wrong. Please try again.', variant: 'destructive' });
        }
    };

            const isManager= user?.workflow_role === 'interim_manager';

    const handleResume = async () => {
        const isScheduled = selectedInstance?.status === 'SCHEDULED';
        try {
            setIsResumeLoading(true);
            const ok = isScheduled ? await setInstanceActive(selectedInstance?.id) : await resumeInstance(selectedInstance?.id);
            if (ok) {
                addToast({
                    title: isScheduled ? 'Instance activated' : 'Instance resumed',
                    description: isScheduled
                        ? `"${selectedInstance?.name}" is now active and the first task has started.`
                        : `"${selectedInstance?.name}" is now active again.`,
                    variant: 'default'
                });
            } else {
                addToast({
                    title: isScheduled ? 'Failed to activate' : 'Failed to resume',
                    description: 'Something went wrong. Please try again.',
                    variant: 'destructive'
                });
            }

        }
        catch (error) {
            addToast({
                title: isScheduled ? 'Failed to activate' : 'Failed to resume',
                description: 'Something went wrong. Please try again.',
                variant: 'destructive'
            });
        }
        finally {
            setIsResumeLoading(false);
            setIsResumeModalOpen(false)
        }
    };

    return (
        <div className='border p-4 rounded-2xl'>
            <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
                <div className="relative flex-1 min-w-[280px] max-w-md">
                    {/* <Activity className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-primary opacity-60" /> */}
                    <h2 className="text-xl font-bold tracking-tight text-foreground">
                        Ongoing Instances
                        {/* <span className="ml-2 px-2 py-0.5 rounded-md bg-muted text-muted-foreground text-[10px] uppercase font-bold border border-border align-middle">Live</span> */}
                    </h2>
                    <span className="text-sm font-medium text-muted-foreground">Manage and monitor workflow instances</span>

                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <Button
                        variant="outline"
                        size="sm"
                        // className="h-9 px-4 rounded-xl border-border/60 hover:bg-muted font-bold text-xs"
                        onClick={() => {
                            const { from_date, to_date } = presetToDates(datePreset, fromDate, toDate);
                            fetchInstances({ page, limit, status: subTab, search: searchQuery || undefined, client_id: clientIdFilter !== 'all' ? clientIdFilter : undefined, project_id: templateIdFilter !== 'all' ? templateIdFilter : undefined, from_date, to_date, has_rejected_task: hasRejectedTask || undefined });
                        }}
                        disabled={instanceLoading}
                    >
                        <RefreshCw className={cn("h-3.5 w-3.5 mr-2", instanceLoading && "animate-spin")} /> Refresh
                    </Button>
                    {canCreate && (
                        <>
                            <Button
                                size="sm"
                                onClick={() => setIsQuickSpawnOpen(true)}
                                className='hidden sm:flex'
                            >
                                <Zap className="h-4 w-4 mr-2" /> Quick Task
                            </Button>

                            {/* mobile */}
                            <Button
                                size="sm"
                                className="sm:hidden h-9 px-4 rounded-xl shadow-lg shadow-primary/20 font-bold text-xs bg-amber-500 hover:bg-amber-600 text-white"
                                onClick={() => setIsQuickSpawnOpen(true)}
                            >
                                <Zap className="h-4 w-4" /> Quick
                            </Button>


                            <Button
                                size="sm"
                                className="hidden sm:flex h-9 px-4 rounded-xl shadow-lg shadow-primary/20 font-bold text-xs"
                                onClick={onNewInstance}
                            >
                                <Plus className="h-4 w-4 mr-2" /> New Instance
                            </Button>

                            <Button
                                size="sm"
                                className="sm:hidden h-9 px-4 rounded-xl shadow-lg shadow-primary/20 font-bold text-xs"
                                onClick={onNewInstance}
                            >
                                <Plus className="h-4 w-4" /> New
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {/* ─── Filters Card ─── */}
            <div className="bg-card border border-border/40 rounded-2xl p-6 shadow-sm mb-8">

                {/* Header */}
                <div className="mb-6">
                    <h2 className="text-lg font-semibold text-foreground">Filters</h2>
                    <p className="text-sm text-muted-foreground">
                        Filter ongoing instances
                    </p>
                </div>

                {/* Grid */}
                {/* Flexible Filter Bar */}
                <div className="flex flex-wrap items-end gap-4 lg:gap-x-8">

                    {/* Search */}
                    <div className="flex-1 min-w-[240px] max-w-md flex flex-col gap-1.5">
                        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">
                            Search
                        </label>
                        <div className="relative">
                            <Input
                                type="text"
                                placeholder="Instance, client, or template..."
                                // className="h-10 w-full rounded-xl border border-border/50 bg-background pl-3 pr-10 text-sm outline-none focus:ring-2 focus:ring-primary/10 transition-all font-medium"
                                value={searchInput}
                                onChange={(e) => handleSearchChange(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Client */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">
                            Client
                        </label>
                        <UISelect
                            value={clientIdFilter}
                            onValueChange={(val) => setClientIdFilter(val)}
                            className="h-10"
                            options={[
                                { value: 'all', label: 'All Clients' },
                                ...(clients?.map((c) => ({ value: c.id, label: c.name })) || [])
                            ]}
                        />
                    </div>

                    {/* Templates */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">
                            Templates
                        </label>
                        <UISelect
                            value={templateIdFilter}
                            onValueChange={(val) => setTemplateIdFilter(val)}
                            className="h-10"
                            options={[
                                { value: 'all', label: 'All Templates' },
                                ...(projects?.map((p) => ({ value: p.id, label: p.name })) || [])
                            ]}
                        />
                    </div>

                    {/* Time Preset */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">
                            Time
                        </label>
                        <UISelect
                            value={datePreset}
                            onValueChange={(val: string) => {
                                setDatePreset(val);
                                setPage(1);
                                if (val !== 'custom') {
                                    setFromDate('');
                                    setToDate('');
                                }
                            }}
                            // className="h-10"
                            options={[
                                { value: 'all', label: 'All Time' },
                                { value: 'today', label: 'Today' },
                                { value: 'last7', label: 'Last 7 Days' },
                                { value: 'last30', label: 'Last 30 Days' },
                                { value: 'custom', label: 'Custom Range' },
                            ]}
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Show</span>
                        <UISelect
                            value={limit.toString()}
                            onValueChange={(val) => setLimit(Number(val))}
                            options={[
                                { value: '10', label: '10 per page' },
                                { value: '20', label: '20 per page' },
                                { value: '50', label: '50 per page' },
                            ]}
                        />
                    </div>

                    <div className="flex items-center gap-2 mb-1.5">
                        <input
                            type="checkbox"
                            id="hasRejectedTask"
                            checked={hasRejectedTask}
                            onChange={(e) => setHasRejectedTask(e.target.checked)}
                            className="h-4 w-4 rounded border-border/50 text-primary focus:ring-primary/20"
                        />
                        <label htmlFor="hasRejectedTask" className="text-xs font-bold uppercase tracking-widest text-muted-foreground cursor-pointer">
                            Rejected Tasks Only
                        </label>
                    </div>

                    {/* Custom Date Range */}
                    {datePreset === 'custom' && (
                        <div className="flex flex-wrap items-end gap-4">
                            {/* From Date */}
                            <div className="w-full sm:w-[160px] flex flex-col gap-1.5">
                                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">
                                    From Date
                                </label>
                                <input
                                    type="date"
                                    value={fromDate}
                                    onChange={(e) => setFromDate(e.target.value)}
                                    className="h-10 w-full rounded-xl border border-border/50 bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/10 font-medium transition-all"
                                />
                            </div>

                            {/* To Date */}
                            <div className="w-full sm:w-[160px] flex flex-col gap-1.5">
                                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">
                                    To Date
                                </label>
                                <input
                                    type="date"
                                    value={toDate}
                                    onChange={(e) => setToDate(e.target.value)}
                                    className="h-10 w-full rounded-xl border border-border/50 bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/10 font-medium transition-all"
                                />
                            </div>
                        </div>
                    )}

                    {/* Clear Button */}
                    {(clientIdFilter !== 'all' || templateIdFilter !== 'all' || searchQuery || datePreset !== 'all' || fromDate || toDate || hasRejectedTask) && (
                        <div className="flex-1 flex justify-end sm:flex-none ml-auto">
                            <Button
                                variant="ghost"
                                className="h-10 px-4 text-sm font-bold text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-xl transition-all"
                                onClick={() => {
                                    setClientIdFilter('all');
                                    setTemplateIdFilter('all');
                                    setSearchInput('');
                                    setSearchQuery('');
                                    setDatePreset('all');
                                    setFromDate('');
                                    setToDate('');
                                    setHasRejectedTask(false);
                                    setPage(1);
                                }}
                            >
                                Clear Filters
                            </Button>
                        </div>
                    )}
                </div>


            </div>            {/* ─── Sub-tabs ─── */}
            <div className={cn("flex items-center gap-1 border-b border-border overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0 mb-6 pb-2", searchQuery && "opacity-50 pointer-events-none transition-opacity")}>
                <div className="p-1 bg-muted/40 rounded-2xl border border-border/40 inline-flex items-center gap-1 relative">
                    {searchQuery && <div className="absolute -top-6 left-2 text-[10px] font-bold text-amber-500 uppercase tracking-wider">Tab filtering disabled while searching</div>}
                    {[
                        { key: 'active', label: 'Active', icon: Activity, count: statusCounts.active },
                        { key: 'scheduled', label: 'Scheduled', icon: CalendarClock, count: statusCounts.scheduled },
                        { key: 'paused', label: 'Paused', icon: Pause, count: statusCounts.paused },
                        { key: 'completed', label: 'Completed', icon: CheckCircle2, count: statusCounts.completed },
                    ].map(tab => {
                        const isActive = subTab === tab.key;
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.key}
                                onClick={() => setSubTab(tab.key as InstanceSubTab)}
                                className={cn(
                                    "px-4 py-2 text-sm font-bold transition-all duration-300 rounded-xl whitespace-nowrap outline-none flex items-center gap-2",
                                    isActive
                                        ? "bg-background text-primary shadow-lg shadow-black/5 ring-1 ring-border/20 translate-y-0"
                                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                                )}
                            >
                                {Icon && <Icon className="h-3.5 w-3.5" />}
                                {tab.label}
                                <span className={cn(
                                    "text-[10px] px-1.5 py-0 h-5 min-w-[20px] inline-flex items-center justify-center rounded-full transition-colors",
                                    isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                                )}>
                                    {tab.count}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ─── Content ─── */}
            {
                instanceLoading && instances.length === 0 ? <div className="flex items-center justify-center py-20"><Loader /></div> : filteredInstances.length === 0 ? (
                    subTab === 'active' && !searchQuery && clientIdFilter === 'all' && templateIdFilter === 'all' && datePreset === 'all' ? (
                        <div className="max-w-4xl mx-auto py-8 sm:py-12 animate-in fade-in zoom-in-95 duration-500">
                            <div className="bg-linear-to-b from-white to-slate-50/50 border border-slate-200/60 rounded-[2.5rem] p-8 sm:p-12 text-center shadow-xl shadow-slate-200/20 relative overflow-hidden">
                                {/* Decorative background elements */}
                                <div className="absolute top-0 right-0 -translate-y-1/4 translate-x-1/4 opacity-10 pointer-events-none">
                                    <div className="h-64 w-64 rounded-full bg-blue-400 blur-3xl"></div>
                                </div>
                                <div className="absolute bottom-0 left-0 translate-y-1/4 -translate-x-1/4 opacity-10 pointer-events-none">
                                    <div className="h-64 w-64 rounded-full bg-purple-400 blur-3xl"></div>
                                </div>

                                <div className="relative z-10 flex flex-col items-center">
                                    <div className="inline-flex h-20 w-20 rounded-2xl bg-linear-to-br from-blue-500 to-indigo-600 items-center justify-center mb-6 shadow-lg shadow-blue-500/30 rotate-3 transition-transform hover:rotate-6 cursor-default">
                                        <Activity className="h-10 w-10 text-white" />
                                    </div>

                                    <h3 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-4 tracking-tight">Welcome to your Workspace!</h3>
                                    <p className="text-slate-500 text-base sm:text-lg max-w-xl mx-auto mb-10 leading-relaxed font-medium">
                                        It looks like you haven't started any workflows yet. In this dashboard, you'll launch project templates, assign tasks, and track your team's progress.
                                    </p>

                                    {/* Setup Steps */}
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 w-full text-left max-w-3xl mx-auto">
                                        <div className="p-6 rounded-3xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-shadow relative group">
                                            <div className="absolute -inset-px bg-linear-to-b from-purple-400 to-purple-600 rounded-3xl opacity-0 group-hover:opacity-10 transition-opacity"></div>
                                            <div className="h-12 w-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mb-4 group-hover:bg-purple-100 transition-colors">
                                                <FolderKanban className="h-6 w-6" />
                                            </div>
                                            <h4 className="font-bold text-slate-900 mb-2 text-lg">1. Templates</h4>
                                            <p className="text-sm text-slate-500 leading-relaxed">Templates define the step-by-step tasks needed to complete a project.</p>
                                        </div>

                                        <div className="p-6 rounded-3xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-shadow relative group">
                                            <div className="absolute -inset-px bg-linear-to-b from-emerald-400 to-emerald-600 rounded-3xl opacity-0 group-hover:opacity-10 transition-opacity"></div>
                                            <div className="h-12 w-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4 group-hover:bg-emerald-100 transition-colors">
                                                <Plus className="h-6 w-6" />
                                            </div>
                                            <h4 className="font-bold text-slate-900 mb-2 text-lg">2. Launch</h4>
                                            <p className="text-sm text-slate-500 leading-relaxed">Click 'New Instance' to launch a template for a specific client.</p>
                                        </div>

                                        <div className="p-6 rounded-3xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-shadow relative group">
                                            <div className="absolute -inset-px bg-linear-to-b from-blue-400 to-blue-600 rounded-3xl opacity-0 group-hover:opacity-10 transition-opacity"></div>
                                            <div className="h-12 w-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4 group-hover:bg-blue-100 transition-colors">
                                                <CheckCircle2 className="h-6 w-6" />
                                            </div>
                                            <h4 className="font-bold text-slate-900 mb-2 text-lg">3. Track</h4>
                                            <p className="text-sm text-slate-500 leading-relaxed">Monitor your team's real-time progress as they complete their assigned tasks.</p>
                                        </div>
                                    </div>

                                    <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
                                        <Button
                                            size="lg"
                                            className="h-14 px-8 rounded-2xl font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/25 text-base transition-all hover:-translate-y-0.5"
                                            onClick={onNewInstance}
                                        >
                                            <Plus className="h-5 w-5 mr-2" /> Launch First Instance
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 border border-dashed border-border rounded-xl text-muted-foreground bg-muted/10">
                            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                                {subTab === 'scheduled' ? <CalendarClock className="h-8 w-8 opacity-30" /> : <Activity className="h-8 w-8 opacity-30" />}
                            </div>
                            <p className="font-medium">
                                {subTab === 'scheduled' ? 'No scheduled instances' : subTab === 'paused' ? 'No paused instances' : subTab === 'completed' ? 'No completed instances' : 'No instances found with these filters'}
                            </p>
                            <p className="text-sm mt-1 text-center px-4 opacity-60 max-w-sm">
                                {subTab === 'scheduled' ? 'Schedule an instance for a future date when creating one.' : subTab === 'paused' ? 'Currently tracked paused instances will appear here.' : subTab === 'completed' ? 'Successfully finished workflows are archived here.' : 'Try adjusting your filters or search query.'}
                            </p>
                            {/* Only show Create New if it's not a search/filter result */}
                            {(!searchQuery && clientIdFilter === 'all' && templateIdFilter === 'all') && (
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="mt-4 h-9 rounded-xl font-bold text-xs"
                                    onClick={onNewInstance}
                                >
                                    <Plus className="h-4 w-4 mr-1.5 shadow-sm" /> Create New
                                </Button>
                            )}
                        </div>
                    )
                ) :
                    <div className="space-y-4">
                        {/* --- Desktop Table View (>768px) --- */}
                        <div className="hidden border border-border rounded-xl md:block bg-card overflow-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-muted/30 border-b border-border">
                                        <th className="px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort('name')}>
                                            Instance Name <SortIcon columnKey="name" />
                                        </th>
                                        <th className="px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort('template')}>
                                            Template <SortIcon columnKey="template" />
                                        </th>
                                        <th className="px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort('client')}>
                                            Client <SortIcon columnKey="client" />
                                        </th>
                                        <th className="px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort('status')}>
                                            Status <SortIcon columnKey="status" />
                                        </th>
                                        <th className="px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort(subTab === 'scheduled' ? 'scheduled_at' : subTab === 'paused' ? 'paused_date' : 'progress')}>
                                            {subTab === 'scheduled' ? 'Scheduled At' : subTab === 'paused' ? 'Paused At' : 'Progress'} <SortIcon columnKey={subTab === 'scheduled' ? 'scheduled_at' : subTab === 'paused' ? 'paused_date' : 'progress'} />
                                        </th>
                                        <th className="px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort('created_at')}>
                                            Created <SortIcon columnKey="created_at" />
                                        </th>
                                        <th className="px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {paginatedInstances?.map((inst: any) => {
                                        const { total, completed } = inst.task_stats || { total: 0, completed: 0 };
                                        const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
                                        const isPaused = inst.is_paused === true;

                                        return (
                                            <tr key={inst.id} className="hover:bg-muted/20 transition-colors group"
                                            >
                                                <td className="px-4 py-3">
                                                    <div className="flex flex-col">
                                                        <span
                                                            onClick={() => {
                                                                setSelectedInstance(inst);
                                                                setIsInstanceDetailsOpen(true);
                                                            }} className="cursor-pointer text-sm font-semibold text-foreground leading-tight truncate max-w-[200px]" title={inst.name}>
                                                            {inst.name}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="text-xs text-muted-foreground font-medium truncate max-w-[180px] block" title={inst.project?.name || 'Manual Template'}>
                                                        {inst.project?.name || 'Manual Template'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground uppercase">
                                                            {(inst.client?.name || 'I')[0]}
                                                        </div>
                                                        <span className="text-xs font-semibold text-foreground truncate max-w-[120px]">
                                                            {inst.client?.name || 'Internal'}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <Badge
                                                        variant={inst?.status === 'ONGOING' ? 'default' : inst?.status === 'COMPLETED' ? 'success' : 'outline'}
                                                        className="text-[9px] px-1.5 py-0 h-4 rounded-md uppercase font-black"
                                                    >
                                                        {inst.is_paused ? 'PAUSED' : inst?.status}
                                                    </Badge>
                                                </td>
                                                <td className="px-4 py-3">
                                                    {inst.status === 'SCHEDULED' ? (
                                                        <div className="flex items-center gap-2 text-xs font-bold text-amber-600">
                                                            <Calendar className="h-3.5 w-3.5" />
                                                            {inst.scheduled_at ? new Date(inst.scheduled_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'No date'}
                                                        </div>
                                                    ) : subTab === 'paused' ? (
                                                        <div className="flex items-center gap-2 text-xs font-bold text-amber-600">
                                                            <Clock className="h-3.5 w-3.5" />
                                                            {inst.paused_date ? new Date(inst.paused_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'No date'}
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-col gap-1 w-32">
                                                            <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground uppercase">
                                                                <span>{pct}%</span>
                                                                <div className='flex flex-row gap-2'>
                                                                    <span>{completed}/{total}</span>
                                                                    <Eye className="h-4 w-4 text-primary cursor-pointer" onClick={() => {
                                                                        setSelectedInstance(inst);
                                                                        setIsInstanceDetailsOpen(true);
                                                                    }}

                                                                    />
                                                                </div>
                                                            </div>
                                                            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                                                <div
                                                                    className={cn("h-full transition-all duration-500 rounded-full", isPaused ? 'bg-amber-400' : 'bg-primary')}
                                                                    style={{ width: `${pct}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="text-xs text-muted-foreground font-medium">
                                                        {inst.created_at ? new Date(inst.created_at).toLocaleDateString('en-US') : '-'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-right">

                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger disabled={isManager} >
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-8 w-8 p-0 rounded-lg opacity-60 group-hover:opacity-100"
                                                            >
                                                                <MoreVertical className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>

                                                        <DropdownMenuContent align="end" className="w-36">

                                                            <DropdownMenuItem
                                                                onClick={() => {
                                                                    setSelectedInstance(inst);
                                                                    setIsInstanceDetailsOpen(true);
                                                                }}
                                                            >
                                                                <Eye className="mr-2 h-3.5 w-3.5" />
                                                                View
                                                            </DropdownMenuItem>

                                                            <DropdownMenuItem onClick={() => onCloneModal(inst)}>
                                                                <Copy className="mr-2 h-3.5 w-3.5" />
                                                                Clone
                                                            </DropdownMenuItem>

                                                            {inst.status === 'SCHEDULED' && canEdit && (
                                                                <DropdownMenuItem onClick={() => onMakeActiveModal(inst)}>
                                                                    <Play className="mr-2 h-3.5 w-3.5 text-green-600" />
                                                                    Make Active
                                                                </DropdownMenuItem>
                                                            )}

                                                            {inst.status !== 'SCHEDULED' && inst.status !== 'COMPLETED' && canEdit && (
                                                                isPaused ? (
                                                                    <DropdownMenuItem onClick={() => onresumeModal(inst)}>
                                                                        <Play className="mr-2 h-3.5 w-3.5 text-green-600" />
                                                                        Resume
                                                                    </DropdownMenuItem>
                                                                ) : (
                                                                    <DropdownMenuItem onClick={() => openPauseModal(inst)}>
                                                                        <Pause className="mr-2 h-3.5 w-3.5 text-amber-600" />
                                                                        Pause
                                                                    </DropdownMenuItem>
                                                                )
                                                            )}
                                                            {inst.status === 'PAUSED' && (
                                                                <Tooltip className="w-full">
                                                                    <TooltipTrigger asChild>
                                                                        <div className="w-full pointer-events-auto">
                                                                            <DropdownMenuItem
                                                                                disabled={!canDelete(inst)}
                                                                                className={cn(
                                                                                    "text-destructive",
                                                                                    !canDelete(inst) && "opacity-50 cursor-not-allowed"
                                                                                )}
                                                                            >
                                                                                <Trash2 className="mr-2 h-3.5 w-3.5" />
                                                                                {!canDelete(inst) ? "Delete" : "Delete"}
                                                                            </DropdownMenuItem>
                                                                        </div>
                                                                    </TooltipTrigger>
                                                                    {!canDelete(inst) && (
                                                                        <TooltipContent side="left" className="z-[10001] bg-destructive text-destructive-foreground border-destructive/20 font-bold">
                                                                            you can delete it after 30 days of being paused
                                                                        </TooltipContent>
                                                                    )}
                                                                </Tooltip>
                                                            )}
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* --- Mobile Card View (<768px) --- */}
                        <div className="grid grid-cols-1 gap-3 md:hidden">
                            {paginatedInstances?.map((inst: any) => {
                                const { total, completed } = inst.task_stats || { total: 0, completed: 0 };
                                const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
                                const isPaused = inst.is_paused === true;

                                return (
                                    <div
                                        key={inst.id}
                                        className="flex flex-col bg-card border border-border rounded-xl p-4 transition-all cursor-pointer"
                                        onClick={() => {
                                            setSelectedInstance(inst);
                                            setIsInstanceDetailsOpen(true);
                                        }}
                                    >
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-bold text-foreground text-sm line-clamp-1">
                                                    {inst.name}
                                                </h3>
                                                <p className="text-[10px] text-muted-foreground font-semibold mt-0.5 uppercase tracking-wider">
                                                    {inst.project?.name || 'Manual Template'}
                                                </p>
                                            </div>
                                            <Badge
                                                variant={inst?.status === 'ONGOING' ? 'default' : inst?.status === 'COMPLETED' ? 'success' : 'outline'}
                                                className="text-[9px] px-1.5 py-0 h-4 rounded-md uppercase font-black"
                                            >
                                                {inst?.status}
                                            </Badge>
                                        </div>

                                        <div className="flex items-center justify-between mb-4 bg-muted/30 rounded-lg px-3 py-2">
                                            <div className="flex items-center gap-2">
                                                <Users className="h-3 w-3 text-muted-foreground" />
                                                <span className="text-[10px] font-bold text-foreground truncate max-w-[80px]">
                                                    {inst.client?.name || 'Internal'}
                                                </span>
                                            </div>
                                            {inst.status === 'SCHEDULED' ? (
                                                <div className="flex items-center gap-1.5">
                                                    <Calendar className="h-3 w-3 text-amber-500" />
                                                    <span className="text-[10px] font-black text-amber-600">
                                                        {inst.scheduled_at ? new Date(inst.scheduled_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Pending'}
                                                    </span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-black text-primary">{pct}%</span>
                                                    <div className="h-1.5 w-16 bg-muted rounded-full overflow-hidden">
                                                        <div className={cn("h-full rounded-full transition-all", isPaused ? "bg-amber-400" : "bg-primary")} style={{ width: `${pct}%` }} />
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2 pt-3 border-t border-border/40">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="flex-1 h-8 rounded-lg text-[10px] font-bold"
                                                onClick={() => { setSelectedInstance(inst); setIsInstanceDetailsOpen(true); }}
                                            >
                                                View
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-8 w-8 p-0 rounded-lg"
                                                onClick={() => onCloneModal(inst)}
                                            >
                                                <Copy className="h-3.5 w-3.5" />
                                            </Button>
                                            {/* Simplified Mobile Controls */}
                                            {inst.status !== 'COMPLETED' && canEdit && (
                                                <Button
                                                    variant={isPaused ? "default" : "outline"}
                                                    size="sm"
                                                    className={cn("h-8 w-8 p-0 rounded-lg", isPaused ? "bg-green-600 hover:bg-green-700" : "text-amber-600 hover:bg-amber-50")}
                                                    onClick={() => isPaused ? onresumeModal(inst) : openPauseModal(inst)}
                                                >
                                                    {isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* --- Card-style Pagination --- */}
                        <div className="flex items-center justify-between p-4 bg-muted/20 border border-border/40 rounded-2xl">
                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest hidden sm:block">
                                {instancesCount > 0 ? (
                                    `${(page - 1) * limit + 1}–${Math.min(page * limit, instancesCount)} of ${instancesCount}`
                                ) : (
                                    'No instances'
                                )}
                            </span>

                            <div className="flex items-center gap-1 bg-background/50 p-1 rounded-xl border border-border/20 shadow-sm">
                                <div className="flex items-center gap-2 mr-4 px-2">
                                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Show</span>
                                    <UISelect
                                        value={limit.toString()}
                                        onValueChange={(val) => setLimit(Number(val))}
                                        options={[
                                            { value: '10', label: '10' },
                                            { value: '20', label: '20' },
                                            { value: '50', label: '50' },
                                        ]}
                                    />
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="h-8 w-8 p-0 rounded-lg hover:bg-primary/5 hover:text-primary transition-colors"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <div className="flex h-8 min-w-[32px] items-center justify-center px-2 text-xs font-black text-primary">
                                    {page}
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page >= totalPages}
                                    className="h-8 w-8 p-0 rounded-lg hover:bg-primary/5 hover:text-primary transition-colors"
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
            }

            {/* ─── Modals (unchanged) ─── */}
            <InstanceModal instance={selectedInstance} open={isInstanceDetailsOpen} onOpenChange={setIsInstanceDetailsOpen} />
            <QuickSpawnModal open={isQuickSpawnOpen} onOpenChange={(open) => {
                setIsQuickSpawnOpen(open);
                if (!open) {
                    const { from_date, to_date } = presetToDates(datePreset, fromDate, toDate);
                    fetchInstances({ page, limit, status: subTab, search: searchQuery || undefined, client_id: clientIdFilter !== 'all' ? clientIdFilter : undefined, project_id: templateIdFilter !== 'all' ? templateIdFilter : undefined, from_date, to_date });
                }
            }} />
            <CloneInstanceModal instance={selectedInstance} open={isCloneModalOpen} onOpenChange={setIsCloneModalOpen} />

            {/* Pause Instance Modal */}
            <Dialog open={isPauseModalOpen} onOpenChange={setIsPauseModalOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 font-black uppercase tracking-tight">
                            <Pause className="h-5 w-5 text-amber-500" />
                            Pause Instance
                        </DialogTitle>
                        <DialogDescription className="text-xs font-medium">
                            You are about to pause <span className="font-bold text-foreground">"{selectedInstance?.name}"</span>.
                        </DialogDescription>
                    </DialogHeader>

                    {/* Warning */}
                    <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/50 px-4 py-3 text-xs text-amber-800">
                        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                        <p className="font-medium">All in-progress tasks will be frozen until the instance is resumed.</p>
                    </div>

                    {/* Optional reason */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1">Reason <span className="text-muted-foreground opacity-50 font-normal normal-case">(optional)</span></label>
                        <textarea
                            className="w-full min-h-[100px] rounded-2xl border border-border/60 bg-muted/20 px-4 py-3 text-sm resize-none focus:outline-none focus:ring-4 focus:ring-primary/5 transition-all text-foreground"
                            placeholder="e.g. Waiting for client feedback..."
                            value={pauseReason}
                            onChange={(e) => setPauseReason(e.target.value)}
                        />
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setIsPauseModalOpen(false)} disabled={isPauseLoading} className="h-10 rounded-xl font-bold flex-1">
                            Cancel
                        </Button>
                        <Button
                            type='submit'
                            className="bg-amber-500 hover:bg-amber-600 text-white h-10 rounded-xl font-bold shadow-lg shadow-amber-500/20 flex-1"
                            onClick={handlePause}
                            disabled={isPauseLoading}
                        >
                            {isPauseLoading ? 'Pausing...' : 'Pause Instance'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* resume instance */}
            <Dialog open={isResumeModalOpen} onOpenChange={setIsResumeModalOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 font-black uppercase tracking-tight">
                            <Play className="h-5 w-5 text-green-500" />
                            Resume Instance
                        </DialogTitle>
                        <DialogDescription className="text-xs font-medium">
                            Resume <span className="font-bold text-foreground">"{selectedInstance?.name}"</span> to continue workflow.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex items-start gap-3 my-2 rounded-2xl border border-green-200 bg-green-50/50 px-4 py-3 text-xs text-green-800">
                        <Activity className="h-4 w-4 mt-0.5 shrink-0" />
                        <p className="font-medium">The workflow will resume from the last active task.</p>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0 mt-4">
                        <Button variant="outline" onClick={() => setIsResumeModalOpen(false)} disabled={isResumeLoading} className="h-10 rounded-xl font-bold flex-1">
                            Cancel
                        </Button>
                        <Button
                            type='submit'
                            className="bg-green-600 hover:bg-green-700 text-white h-10 rounded-xl font-bold shadow-lg shadow-green-500/20 flex-1"
                            onClick={handleResume}
                            disabled={isResumeLoading}
                        >
                            {isResumeLoading ? 'Resuming...' : 'Confirm Resume'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Make active instance */}
            <Dialog open={isMakeActiveModalOpen} onOpenChange={setIsMakeActiveModalOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 font-black uppercase tracking-tight">
                            <Play className="h-5 w-5 text-primary" />
                            Activate Instance
                        </DialogTitle>
                        <DialogDescription className="text-xs font-medium">
                            Make <span className="font-bold text-foreground">"{selectedInstance?.name}"</span> active now.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex items-start gap-3 my-2 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-xs text-primary">
                        <CalendarClock className="h-4 w-4 mt-0.5 shrink-0" />
                        <p className="font-medium">This will bypass the schedule and start the first task immediately.</p>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0 mt-4">
                        <Button variant="outline" onClick={() => setIsMakeActiveModalOpen(false)} disabled={isResumeLoading} className="h-10 rounded-xl font-bold flex-1">
                            Cancel
                        </Button>
                        <Button
                            type='submit'
                            className="bg-primary hover:bg-primary/90 text-primary-foreground h-10 rounded-xl font-bold shadow-lg shadow-primary/20 flex-1"
                            onClick={handleResume}
                            disabled={isResumeLoading}
                        >
                            {isResumeLoading ? 'Activating...' : 'Activate Now'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div >
    );
}
