'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
    SlidersHorizontal, Calendar, SortAsc,
    Check
} from 'lucide-react';
import { Button, Input, Checkbox, UISelect } from '@/components/ui';
import {
    usePerformanceStore,
} from '@/lib/zustand/performance/performance';
import { Thresholds, MemberPerformanceSummary, MemberTask } from '@/lib/types/auth';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';
import TeamOverview from '@/components/MemberTaskModal/teamOverview-modal';
import WorkloadTab from '@/components/MemberTaskModal/workload_modal';
import IndividualPerformance from '@/components/MemberTaskModal/individual-performance';

// ─── Types ────────────────────────────────────────────────────────────────────


type Tab = 'individual' | 'team' | 'workload';
type StatusFilter = 'all' | 'completed' | 'in_progress' | 'pending' | 'overdue';


// ─── Time period → date range ─────────────────────────────────────────────────

function formatLocalDate(date: Date): string {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

function getDateRangeForPeriod(period: string): { from: string; to: string } {
    const now = new Date();
    const toStr = formatLocalDate(now);
    let from = new Date(now.getFullYear(), now.getMonth(), 1); // default monthly

    switch (period) {
        case '7d': from = new Date(now); from.setDate(now.getDate() - 7); break;
        case '30d': from = new Date(now); from.setDate(now.getDate() - 30); break;
        case '90d': from = new Date(now); from.setDate(now.getDate() - 90); break;
        case '1y': from = new Date(now); from.setFullYear(now.getFullYear() - 1); break;
        default: break; // 'all' → 1st of month
    }
    return { from: formatLocalDate(from), to: toStr };
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PerformanceMetrics() {
    const {
        members, teamLoading, teamError,
        fetchTeamPerformance, setDateRange, dateFrom, dateTo,
    } = usePerformanceStore();

    const [activeTab, setActiveTab] = useState<Tab>('individual');
    const [timePeriod, setTimePeriod] = useState('all');
    const [sortBy, setSortBy] = useState('completed');
    const [showUnderperformersOnly, setShowUnderperformersOnly] = useState(false);
    const [memberSearch, setMemberSearch] = useState('');
    const [showThresholds, setShowThresholds] = useState(false);
    const [thresholds, setThresholds] = useState<Thresholds>({
        onTimePercent: 80, taskEfficiencyPercent: -20, overdueCount: 3, showBadges: true,
    });

    // Fetch on mount with monthly default
    useEffect(() => {
        fetchTeamPerformance();
    }, []);

    // Re-fetch when time period changes
    function handleTimePeriodChange(period: string) {
        setTimePeriod(period);
        const { from, to } = getDateRangeForPeriod(period);
        setDateRange(from, to);
        fetchTeamPerformance(from, to);
    }

    const sortedMembers = useMemo(() => {
        return [...members].sort((a, b) => {
            switch (sortBy) {
                case 'completed': return b.completed - a.completed;
                case 'overdue': return b.overdue - a.overdue;
                case 'ontime': return b.onTimeDelivery - a.onTimeDelivery;
                case 'efficiency': return b.taskEfficiency - a.taskEfficiency;
                case 'quality': return (b?.qualityScore || 0) - (a?.qualityScore || 0);
                default: return 0;
            }
        });
    }, [members, sortBy]);

    const tabs: { key: Tab; label: string }[] = [
        { key: 'individual', label: 'Individual Performance' },
        { key: 'team', label: 'Team Overview' },
        { key: 'workload', label: 'Workload' },
    ];

    return (
        <div className="min-h-screen bg-background p-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-foreground tracking-tight">Team Performance</h1>
                    <p className="text-sm text-muted-foreground">Monitor team productivity and quality metrics</p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-4 mb-4">
                <div className="flex-1 min-w-[180px] max-w-xs">
                    <p className="text-xs font-medium text-foreground mb-1">Time Period</p>
                    <UISelect
                        value={timePeriod}
                        onValueChange={(val) => handleTimePeriodChange(val)}
                        className="w-full"
                        options={[
                            { value: 'all', label: 'Monthly (default)', icon: Calendar },
                            { value: '7d', label: 'Last 7 Days', icon: Calendar },
                            { value: '30d', label: 'Last 30 Days', icon: Calendar },
                            { value: '90d', label: 'Last 90 Days', icon: Calendar },
                            { value: '1y', label: 'Last Year', icon: Calendar },
                        ]}
                    />
                </div>
                {/* <div className="flex-1 min-w-[200px] max-w-sm">
                    <p className="text-xs font-medium text-foreground mb-1">Sort By</p>
                    <UISelect
                        value={sortBy}
                        onValueChange={(val) => setSortBy(val)}
                        className="w-full"
                        options={[
                            { value: 'completed', label: 'Completed Tasks', icon: Check },
                            { value: 'overdue', label: 'Overdue Tasks', icon: SortAsc },
                            { value: 'ontime', label: 'On-Time %', icon: SortAsc },
                            { value: 'efficiency', label: 'Task Efficiency', icon: SortAsc },
                            { value: 'quality', label: 'Quality Score', icon: SortAsc },
                        ]}
                    />
                </div> */}
                <div className="flex items-center gap-2 mt-5">
                    <Checkbox
                        id="underperformers"
                        checked={showUnderperformersOnly}
                        onCheckedChange={(v) => setShowUnderperformersOnly(!!v)}
                    />
                    <label htmlFor="underperformers" className="text-sm text-foreground cursor-pointer">
                        Show underperformers only
                    </label>
                </div>
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

            {/* Error state */}
            {teamError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 mb-4 text-sm text-red-600">
                    {teamError}
                </div>
            )}

            {/* Tab Bar */}
            <div className="flex gap-1 mb-6">
                {tabs.map(t => (
                    <button
                        key={t.key}
                        onClick={() => setActiveTab(t.key)}
                        className={`px-4 py-1.5 text-sm rounded-md font-medium transition-colors ${activeTab === t.key
                            ? 'bg-background border border-border text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'individual' && (
                <IndividualPerformance
                    members={sortedMembers}
                    search={memberSearch}
                    setSearch={setMemberSearch}
                    thresholds={thresholds}
                    setThresholds={setThresholds}
                    showThresholds={showThresholds}
                    setShowThresholds={setShowThresholds}
                    showOnly={showUnderperformersOnly}
                    loading={teamLoading}
                />
            )}
            {activeTab === 'team' && <TeamOverview members={sortedMembers} />}
            {activeTab === 'workload' && <WorkloadTab />}
        </div>
    );
}