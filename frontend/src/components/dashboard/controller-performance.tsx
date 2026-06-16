import React, { useState, useEffect, useMemo } from 'react';
import { Download, SlidersHorizontal, ArrowUpRight, ArrowDown, Info } from 'lucide-react';
import { Button, Checkbox, UISelect, Badge, Avatar, AvatarFallback, Input } from '@/components/ui';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { UserSelect } from '../ui/user-select';
import { Thresholds } from '@/lib/types/auth';
import api from '@/lib/api';
import MemberTaskModal from '../MemberTaskModal/Member-task-modal';
import Loader from '../ui/loader';
import { ControllerPerformanceData } from '@/lib/types/auth';

export default function ControllerPerformance() {
    const [controllers, setControllers] = useState<ControllerPerformanceData[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedController, setSelectedController] = useState<ControllerPerformanceData | null>(null);
    const [sortBy, setSortBy] = useState('completed');
    const [showUnderperformers, setShowUnderperformers] = useState(false);
    const [timeframe, setTimeframe] = useState('monthly');
    const [showThresholds, setShowThresholds] = useState(false);
    const [search, setSearch] = useState('');
    const [thresholds, setThresholds] = useState<Thresholds>({
        onTimePercent: 80,
        taskEfficiencyPercent: -20,
        overdueCount: 2,
        showBadges: true,
    });

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // Fetch team performance data from backend
                const response = await api.get('/performance/team');
                // Filter only controllers
                const filtered = (response.data.data || []).filter((m: any) => m.role === 'controller' || m.role === 'admin');
                setControllers(filtered);
            } catch (err) {
                console.error('Failed to fetch controller performance', err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [timeframe]);

    const isUnderperformer = (m: ControllerPerformanceData) => {
        const hasCompleted = m.completed > 0;
        return (hasCompleted && m.onTimeDelivery < thresholds.onTimePercent)
            || m.taskEfficiency < thresholds.taskEfficiencyPercent
            || m.overdue > thresholds.overdueCount;
    };

    const filteredAndSorted = useMemo(() => {
        let list = [...controllers];

        if (showUnderperformers) {
            list = list.filter(m => isUnderperformer(m));
        }

        if (search.trim()) {
            list = list.filter(m => String(m.id) === search.trim() || m.name.toLowerCase().includes(search.toLowerCase()));
        }

        list.sort((a, b) => {
            switch (sortBy) {
                case 'completed': return (b.completed || 0) - (a.completed || 0);
                case 'efficiency': return (b.taskEfficiency || 0) - (a.taskEfficiency || 0);
                case 'ontime': return (b.onTimeDelivery || 0) - (a.onTimeDelivery || 0);
                default: return 0;
            }
        });
        return list;
    }, [controllers, showUnderperformers, sortBy, thresholds, search]);

    const stats = useMemo(() => {
        const total = controllers.length;
        const underperforming = controllers.filter(isUnderperformer).length;
        const avgOnTime = total > 0 ? Math.round(controllers.reduce((acc, c) => acc + c.onTimeDelivery, 0) / total) : 0;
        const tasksReviewed = controllers.reduce((acc, c) => acc + c.completed, 0);
        return { total, underperforming, avgOnTime, tasksReviewed };
    }, [controllers, thresholds]);

    const handleExportCSV = () => {
        // Simple CSV export
        const headers = ['Name', 'Role', 'Total Tasks', 'Completed', 'In Progress', 'Late', 'Overdue', 'On-time %', 'Task Efficiency %', 'Avg Review Time (hrs)'];
        const rows = filteredAndSorted.map(c => [
            c.name, c.role, c.totalTasks, c.completed, c.inProgress, c.late, c.overdue, c.onTimeDelivery, c.taskEfficiency, c.avgReviewTime || 'N/A'
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(r => r.join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `controller_performance_${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12 text-muted-foreground">
                <Loader />
            </div>);
    }

    return (
        <div className="space-y-6">
            {selectedController && (
                <MemberTaskModal
                    member={selectedController as any}
                    onClose={() => setSelectedController(null)}
                />
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-foreground tracking-tight">Controller Performance</h2>
                    <p className="text-sm text-muted-foreground mt-1">Monitor controller productivity, review quality and task delivery</p>
                </div>
                <div className="flex items-center gap-3">
                    {/* <Button variant="outline" size="sm" onClick={handleExportCSV} className="h-9 gap-2">
                        <Download className="h-4 w-4" /> Export CSV
                    </Button> */}
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-9 gap-2"
                        onClick={() => setShowThresholds(v => !v)}
                    >
                        <SlidersHorizontal className="h-4 w-4" /> Configure thresholds
                    </Button>
                </div>
            </div>

            {/* Top Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
                    <p className="text-sm font-medium text-muted-foreground mb-2">Total controllers</p>
                    <p className="text-3xl font-bold">{stats.total}</p>
                </div>
                <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
                    <p className="text-sm font-medium text-muted-foreground mb-2">Underperforming</p>
                    <p className="text-3xl font-bold text-amber-500">{stats.underperforming}</p>
                </div>
                <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
                    <p className="text-sm font-medium text-muted-foreground mb-2">Avg on-time delivery</p>
                    <p className="text-3xl font-bold text-emerald-500">{stats.avgOnTime}%</p>
                </div>
                <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
                    <p className="text-sm font-medium text-muted-foreground mb-2">Tasks reviewed this month</p>
                    <p className="text-3xl font-bold">{stats.tasksReviewed}</p>
                </div>
            </div>

            {/* Thresholds Panel */}
            {showThresholds && (
                <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                    <h3 className="text-base font-semibold text-foreground mb-0.5">Underperformance Thresholds</h3>
                    <p className="text-xs text-muted-foreground mb-4">Define thresholds to identify underperforming controllers</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                        <div>
                            <div className="flex items-center gap-1.5 mb-1">
                                <label className="text-xs font-medium text-foreground block">On-Time % Threshold</label>
                                <Tooltip delay={200}>
                                    <TooltipTrigger asChild>
                                        <button className="focus:outline-none">
                                            <Info className="h-3.5 w-3.5 text-muted-foreground hover:text-primary transition-colors cursor-help" />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-[250px]">
                                        <p className="font-semibold mb-1">On-Time % Calculation</p>
                                        <p className="text-[10px] leading-relaxed">Percentage of completed tasks submitted before the deadline.</p>
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                            <Input type="number" value={thresholds.onTimePercent} onChange={e => setThresholds(t => ({ ...t, onTimePercent: Number(e.target.value) }))} />
                        </div>
                        <div>
                            <div className="flex items-center gap-1.5 mb-1">
                                <label className="text-xs font-medium text-foreground block">Task Efficiency Threshold (%)</label>
                                <Tooltip delay={200}>
                                    <TooltipTrigger asChild>
                                        <button className="focus:outline-none">
                                            <Info className="h-3.5 w-3.5 text-muted-foreground hover:text-primary transition-colors cursor-help" />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-[250px]">
                                        <p className="font-semibold mb-1">Efficiency Calculation</p>
                                        <p className="text-[10px] leading-relaxed mb-1.5">Calculated as: <strong>-(Late + Overdue) / Total Tasks</strong>.</p>
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                            <Input type="number" value={thresholds.taskEfficiencyPercent} onChange={e => setThresholds(t => ({ ...t, taskEfficiencyPercent: Number(e.target.value) }))} />
                        </div>
                        <div>
                            <div className="flex items-center gap-1.5 mb-1">
                                <label className="text-xs font-medium text-foreground block">Overdue Count Threshold</label>
                                <Tooltip delay={200}>
                                    <TooltipTrigger asChild>
                                        <button className="focus:outline-none">
                                            <Info className="h-3.5 w-3.5 text-muted-foreground hover:text-primary transition-colors cursor-help" />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-[250px]">
                                        <p className="font-semibold mb-1">Active Overdue Tasks</p>
                                        <p className="text-[10px] leading-relaxed">The maximum number of active tasks that have passed their deadline.</p>
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                            <Input type="number" value={thresholds.overdueCount} onChange={e => setThresholds(t => ({ ...t, overdueCount: Number(e.target.value) }))} />
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Checkbox
                            id="showBadges"
                            checked={thresholds.showBadges}
                            onCheckedChange={(v) => setThresholds(t => ({ ...t, showBadges: !!v }))}
                        />
                        <label htmlFor="showBadges" className="text-sm text-foreground cursor-pointer">
                            Highlight underperformers with warning badges
                        </label>
                    </div>
                </div>
            )}

            {/* Filters and Search */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-4 bg-muted/30 rounded-xl border border-border">
                <div className="w-full lg:max-w-xs">
                    <UserSelect
                        className="w-full"
                        value={search}
                        onChange={val => setSearch(val)}
                        placeholder="Search controller..."
                    />
                </div>

                <div className="flex items-center gap-6 flex-wrap w-full lg:w-auto">
                    <select
                        value={timeframe}
                        onChange={e => setTimeframe(e.target.value)}
                        className="bg-background border border-border text-foreground text-sm rounded-lg px-3 py-2 outline-none font-medium w-[180px]"
                    >
                        <option value="monthly">Monthly (default)</option>
                        <option value="quarterly">Quarterly</option>
                        <option value="yearly">Yearly</option>
                    </select>

                    <div className="flex items-center gap-2">
                        <Checkbox
                            id="underperformers"
                            checked={showUnderperformers}
                            onCheckedChange={(c) => setShowUnderperformers(!!c)}
                        />
                        <label htmlFor="underperformers" className="text-sm font-medium cursor-pointer">
                            Show underperformers only
                        </label>
                    </div>
                </div>

                <div className="flex items-center gap-3 min-w-[240px]">
                    <span className="text-sm font-medium whitespace-nowrap">Sort by:</span>
                    <select
                        value={sortBy}
                        onChange={e => setSortBy(e.target.value)}
                        className="bg-background border border-border text-foreground text-sm rounded-lg px-3 py-2 outline-none font-medium w-full"
                    >
                        <option value="completed">Completed tasks</option>
                        <option value="efficiency">Task efficiency</option>
                        <option value="ontime">On-time delivery</option>
                    </select>
                </div>
            </div>

            {/* List */}
            <div className="space-y-4">
                {filteredAndSorted.map((controller) => {
                    const underperforming = isUnderperformer(controller);
                    const onTimeColor = controller.onTimeDelivery >= thresholds.onTimePercent ? 'bg-emerald-500' : 'bg-amber-500';
                    const efficiencyColor = controller.taskEfficiency >= thresholds.taskEfficiencyPercent ? 'bg-rose-500' : 'bg-red-600';

                    return (
                        <div key={controller.id} className="bg-card border border-border rounded-xl p-5 shadow-sm">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-10 w-10 border border-border bg-primary/10">
                                        <AvatarFallback className="font-bold text-primary">
                                            {controller.name.substring(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-bold text-foreground text-base">{controller.name}</h3>
                                            {thresholds.showBadges && underperforming && (
                                                <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200 dark:bg-red-950/30 dark:border-red-900">
                                                    ⚠️ Underperforming
                                                </Badge>
                                            )}
                                        </div>
                                        <p className="text-sm text-muted-foreground capitalize">{controller.role}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 text-right">
                                    <div>
                                        <p className="text-2xl font-bold leading-none">{controller.totalTasks}</p>
                                        <p className="text-xs text-muted-foreground mt-1">Total tasks</p>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="gap-2 rounded-lg"
                                        onClick={() => setSelectedController(controller)}
                                    >
                                        View details <ArrowUpRight className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                                <div className="col-span-2 md:col-span-1 space-y-2">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground">Completed:</span>
                                        <span className="font-bold">{controller.completed}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground">In progress:</span>
                                        <span className="font-bold text-blue-500">{controller.inProgress}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground">Pending:</span>
                                        <span className="font-bold">{controller.pending}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground">Late:</span>
                                        <span className="font-bold text-amber-500">{controller.late}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground">Overdue:</span>
                                        <span className="font-bold text-red-500">{controller.overdue}</span>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <p className="text-sm font-medium">On-time delivery</p>
                                    <p className="text-2xl font-bold text-amber-500">{controller.onTimeDelivery}%</p>
                                    <div className="h-1.5 w-full bg-muted rounded-full mt-2 overflow-hidden">
                                        <div className={`h-full rounded-full ${onTimeColor}`} style={{ width: `${Math.max(0, Math.min(100, controller.onTimeDelivery))}%` }} />
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">Target: {thresholds.onTimePercent}%+</p>
                                </div>

                                <div className="space-y-1">
                                    <p className="text-sm font-medium">Task efficiency</p>
                                    <p className="text-2xl font-bold text-red-500">{controller.taskEfficiency}%</p>
                                    <div className="h-1.5 w-full bg-muted rounded-full mt-2 overflow-hidden">
                                        <div className={`h-full rounded-full ${efficiencyColor}`} style={{ width: `${Math.max(0, Math.min(100, 100 + controller.taskEfficiency))}%` }} />
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">Target: {thresholds.taskEfficiencyPercent}%+</p>
                                </div>

                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Quality score</p>
                                    <p className="text-xl font-bold mt-1">
                                        {controller.qualityScore !== null && controller.qualityScore !== undefined ? `${controller.qualityScore}/100` : 'N/A'}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {controller.qualityScore !== null && controller.qualityScore !== undefined ? 'Based on rejections' : 'No completions yet'}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Avg review time</p>
                                    <p className="text-xl font-bold mt-1">
                                        {controller.avgReviewTime !== undefined && controller.avgReviewTime > 0 ? `${controller.avgReviewTime}h` : 'N/A'}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">per task</p>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {filteredAndSorted.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground bg-card border border-border rounded-xl">
                        No controllers found matching criteria.
                    </div>
                )}
            </div>
        </div>
    );
}
