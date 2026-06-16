import { useState, useMemo } from "react";
import { Search, AlertTriangle, Loader2, AlertCircle, SlidersHorizontal, Info, Check, SortAsc, CheckCircle, Clock, Zap, Star } from "lucide-react";
import { Button, Input, Checkbox, UISelect } from "@/components/ui";
import { MemberPerformanceSummary, Thresholds } from "@/lib/types/auth";
import MetricBlock from "@/components/ui/Metricblock";
import MemberTaskModal from "./Member-task-modal";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { UserSelect } from "../ui/user-select";

function isUnderperformer(m: MemberPerformanceSummary, thresh: Thresholds) {
    return m.onTimeDelivery < thresh.onTimePercent
        || m.taskEfficiency < thresh.taskEfficiencyPercent
        || m.overdue > thresh.overdueCount;
}

function qualityLabel(score: number) {
    if (score >= 80) return { text: 'Excellent', color: 'text-green-600' };
    if (score >= 60) return { text: 'Good', color: 'text-blue-600' };
    if (score >= 40) return { text: 'Average', color: 'text-amber-600' };
    return { text: 'Needs Improvement', color: 'text-red-600' };
}

function qualityBarColor(score: number) {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-blue-500';
    if (score >= 40) return 'bg-amber-500';
    return 'bg-red-500';
}

export default function IndividualPerformance({
    members, search, setSearch, thresholds, setThresholds, showThresholds, setShowThresholds, showOnly, loading
}: {
    members: MemberPerformanceSummary[];
    search: string;
    setSearch: (s: string) => void;
    thresholds: Thresholds;
    setThresholds: (t: Thresholds | ((prev: Thresholds) => Thresholds)) => void;
    showThresholds: boolean;
    setShowThresholds: (v: boolean | ((prev: boolean) => boolean)) => void;
    showOnly: boolean;
    loading: boolean;
}) {
    const [showCount, setShowCount] = useState(10);
    const [selectedMember, setSelectedMember] = useState<MemberPerformanceSummary | null>(null);
    const [sortBy, setSortBy] = useState('completed');

    const filtered = useMemo(() => {
        let list = [...members];
        if (search.trim()) list = list.filter(m => String(m.id) === search.trim());
        if (showOnly) list = list.filter(m => isUnderperformer(m, thresholds));

        list.sort((a, b) => {
            switch (sortBy) {
                case 'completed': return (b.completed || 0) - (a.completed || 0);
                case 'overdue': return (b.overdue || 0) - (a.overdue || 0);
                case 'ontime': return (b.onTimeDelivery || 0) - (a.onTimeDelivery || 0);
                case 'efficiency': return (b.taskEfficiency || 0) - (a.taskEfficiency || 0);
                case 'quality': return (b.qualityScore ?? -1) - (a.qualityScore ?? -1);
                default: return 0;
            }
        });

        return list;
    }, [members, search, showOnly, thresholds, sortBy]);

    const displayed = filtered.slice(0, showCount);

    return (
        <div className="space-y-4">
            {selectedMember && (
                <MemberTaskModal member={selectedMember} onClose={() => setSelectedMember(null)} />
            )}

            {/* Header with Configure Thresholds button */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-xl font-semibold text-foreground tracking-tight">Individual Performance</h2>
                    <p className="text-sm text-muted-foreground">Monitor individual team member productivity and quality metrics</p>
                </div>
                <Button
                    variant="outline" size="sm"
                    onClick={() => setShowThresholds(v => !v)}
                    className="flex items-center justify-center gap-2 text-sm w-auto sm:w-auto h-10 rounded-xl"
                >
                    <SlidersHorizontal className="h-4 w-4" />
                    Configure Thresholds
                </Button>
            </div>
            <div className="flex-1 min-w-[200px] max-w-sm">
                <p className="text-xs font-medium text-foreground mb-1">Sort By</p>
                <UISelect
                    value={sortBy}
                    onValueChange={(val) => setSortBy(val)}
                    className="w-full"
                    options={[
                        { value: 'completed', label: 'Completed Tasks', icon: CheckCircle },   // clear success state
                        { value: 'overdue', label: 'Overdue Tasks', icon: AlertTriangle },     // warning / attention
                        { value: 'ontime', label: 'On-Time %', icon: Clock },                  // time-related
                        { value: 'efficiency', label: 'Task Efficiency', icon: Zap },          // speed/performance
                        { value: 'quality', label: 'Quality Score', icon: Star },              // rating/quality
                    ]}
                />
            </div>

            {/* Thresholds Panel */}
            {showThresholds && (
                <div className="rounded-xl border border-border bg-card p-5 mb-4">
                    <h3 className="text-base font-semibold text-foreground mb-0.5">Underperformance Thresholds</h3>
                    <p className="text-xs text-muted-foreground mb-4">Define thresholds to identify underperforming team members</p>
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
                                        <p className="text-[10px] leading-relaxed">Percentage of completed tasks submitted before the deadline. Members falling below this threshold will be flagged.</p>
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                            <Input type="number" value={thresholds.onTimePercent} onChange={e => setThresholds(t => ({ ...t, onTimePercent: e.target.value as any }))} />
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
                                        <p className="text-[10px] leading-relaxed italic">Example: -10% means 10% of workload has breached SLA. Higher negative numbers (e.g. -30%) indicate poorer performance.</p>
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                            <Input type="number" value={thresholds.taskEfficiencyPercent} onChange={e => setThresholds(t => ({ ...t, taskEfficiencyPercent: e.target.value as any }))} />
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
                                        <p className="text-[10px] leading-relaxed">The maximum number of currently active tasks that have passed their deadline. Members exceeding this count will be flagged.</p>
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                            <Input type="number" value={thresholds.overdueCount} onChange={e => setThresholds(t => ({ ...t, overdueCount: e.target.value as any }))} />
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

            {/* Search bar */}
            <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between gap-4 flex-col sm:flex-row">
                <div className="flex-1 w-full sm:max-w-xs">
                    <UserSelect
                        className="w-full"
                        value={search}
                        onChange={val => setSearch(val)}
                        placeholder="Select team member..."
                    />
                </div>
                <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground ml-auto">
                    <span>Show:</span>
                    <select
                        value={showCount}
                        onChange={e => setShowCount(Number(e.target.value))}
                        className="border border-border rounded-md px-2 py-1 text-sm bg-background text-foreground"
                    >
                        {[5, 10, 20, 50].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                    <span>{filtered.length} members</span>
                </div>

            </div>

            {/* Loading */}
            {loading && (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            )}

            {/* Member cards */}
            {!loading && displayed.map(m => {
                const under = thresholds.showBadges && isUnderperformer(m, thresholds);
                const ql = m.qualityScore !== null
                    ? qualityLabel(m.qualityScore)
                    : { text: 'No completions yet', color: 'text-muted-foreground' };
                return (
                    <div
                        key={m.id}
                        className="rounded-xl border border-border bg-card p-5 cursor-pointer hover:border-foreground/30 transition-colors"
                        onClick={() => setSelectedMember(m)}
                    >
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="text-base font-semibold text-foreground">{m.name}</span>
                                    {under && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-semibold border border-red-200">
                                            <AlertTriangle className="h-3 w-3" />
                                            Underperforming
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-muted-foreground">{m.role}</p>
                            </div>
                            <div className="text-right">
                                <span className="text-2xl font-bold text-foreground">{m.totalTasks}</span>
                                <p className="text-[10px] text-muted-foreground">Total Tasks</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[180px_1fr_1fr_1fr] gap-6 items-start">
                            {/* Task breakdown */}
                            <div>
                                <p className="text-xs font-medium text-foreground mb-2">Tasks</p>
                                <div className="space-y-1 text-xs">
                                    {[
                                        { label: 'Completed:', val: m.completed, cls: 'text-blue-600' },
                                        { label: 'In Progress:', val: m.inProgress, cls: 'text-blue-600' },
                                        { label: 'Pending:', val: m.pending, cls: 'text-foreground' },
                                    ]?.map(row => (
                                        <div key={row.label} className="flex justify-start gap-2">
                                            <span className="text-muted-foreground">{row?.label}</span>
                                            <span className={`font-semibold ${row?.cls}`}>{row?.val}</span>
                                        </div>
                                    ))}
                                    <div className="flex justify-start items-center gap-2">
                                        <span className="text-muted-foreground flex items-center gap-1">Late <AlertCircle className="h-3 w-3" /></span>
                                        <span className="font-semibold text-foreground">{m?.late}</span>
                                    </div>
                                    <div className="flex justify-start items-center gap-2">
                                        <span className="text-muted-foreground flex items-center gap-1">Overdue <AlertCircle className="h-3 w-3" /></span>
                                        <span className="font-semibold text-foreground">{m?.overdue}</span>
                                    </div>
                                </div>
                            </div>

                            <MetricBlock
                                label="On-Time Delivery"
                                value={`${m.onTimeDelivery}%`}
                                target={`Target: ${thresholds.onTimePercent}%+`}
                                barValue={m.onTimeDelivery}
                                barColor="bg-foreground"
                                tooltip="Percentage of tasks completed before deadline."
                            />
                            <MetricBlock
                                label="Task Efficiency"
                                value={`${m.taskEfficiency > 0 ? '+' : ''}${m.taskEfficiency}%`}
                                target={`Target: ${thresholds.taskEfficiencyPercent}%+`}
                                barValue={Math.abs(m.taskEfficiency)}
                                barColor={m.taskEfficiency >= 0 ? 'bg-green-500' : 'bg-foreground'}
                                tooltip="Percentage of workload currently breaching SLA."
                            />
                            <MetricBlock
                                label="Quality Score"
                                value={m.qualityScore !== null ? `${m.qualityScore}/100` : 'N/A'}
                                target=""
                                barValue={m.qualityScore ?? 0}
                                barColor={m.qualityScore !== null ? qualityBarColor(m.qualityScore) : 'bg-muted'}
                                note={ql.text}
                                noteColor={ql.color}
                                tooltip="Average rating based on rework iterations."
                            />
                        </div>
                    </div>
                );
            })}

            {!loading && filtered.length === 0 && (
                <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground text-sm">
                    No members match your current filters.
                </div>
            )}
        </div>
    );
}