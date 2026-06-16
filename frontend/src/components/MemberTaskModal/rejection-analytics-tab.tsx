'use client';

import { useState, useEffect, useMemo } from "react";
import { Search, Loader2, AlertTriangle, Calendar, ChevronDown } from "lucide-react";
import { Button, Input } from "@/components/ui";
import api from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import RejectionHistory from "./rejection-history";
import { cn } from "@/lib/utils";

interface MemberRejectionSummary {
    user_id: string;
    user_name: string;
    user_role: string;
    total_rejected_tasks: number;
    total_rejection_events: number;
}

export default function RejectionAnalyticsTab() {
    const [members, setMembers] = useState<MemberRejectionSummary[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [minRejections, setMinRejections] = useState<string>('');
    const [selectedMember, setSelectedMember] = useState<MemberRejectionSummary | null>(null);
    const { addToast } = useToast();

    const [filterType, setFilterType] = useState<string>('month');

    const formatLocalDate = (date: Date) => {
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    };

    // Date range state
    const [dateFrom, setDateFrom] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    });
    const [dateTo, setDateTo] = useState(() => formatLocalDate(new Date()));

    const handleFilterTypeChange = (type: string) => {
        setFilterType(type);
        const now = new Date();
        const todayStr = formatLocalDate(now);

        if (type === '7days') {
            const past = new Date();
            past.setDate(now.getDate() - 7);
            setDateFrom(formatLocalDate(past));
            setDateTo(todayStr);
        } else if (type === 'month') {
            const past = new Date(now.getFullYear(), now.getMonth(), 1);
            setDateFrom(formatLocalDate(past));
            setDateTo(todayStr);
        } else if (type === '6months') {
            const past = new Date();
            past.setMonth(now.getMonth() - 6);
            setDateFrom(formatLocalDate(past));
            setDateTo(todayStr);
        }
    };

    useEffect(() => {
        fetchRejectionSummary();
    }, [dateFrom, dateTo]);

    const fetchRejectionSummary = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/performance/rejections/summary', {
                params: { from: dateFrom, to: dateTo }
            });
            setMembers(data.data || []);
        } catch (err: any) {
            addToast({
                title: "Error",
                description: err.response?.data?.message || "Failed to fetch rejection analytics",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    const filtered = useMemo(() => {
        return members.filter(m => {
            const matchesSearch = search.trim() === '' ||
                m.user_name.toLowerCase().includes(search.toLowerCase()) ||
                m.user_role.toLowerCase().includes(search.toLowerCase());

            const rejectionsThreshold = parseInt(minRejections);
            const matchesRejections = isNaN(rejectionsThreshold) || m.total_rejection_events >= rejectionsThreshold;

            return matchesSearch && matchesRejections;
        });
    }, [members, search, minRejections]);

    const sorted = useMemo(() => {
        return [...filtered].sort((a, b) => b.total_rejection_events - a.total_rejection_events);
    }, [filtered]);

    if (selectedMember) {
        return (
            <div className="space-y-4">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedMember(null)}
                    className="mb-4"
                >
                    ← Back to Summary
                </Button>
                <RejectionHistory
                    userId={selectedMember.user_id}
                    userName={selectedMember.user_name}
                    dateFrom={dateFrom}
                    dateTo={dateTo}
                />
            </div>
        );
    }

    const totalRejections = members.reduce((sum, m) => sum + m.total_rejection_events, 0);
    const totalMembers = members.filter(m => m.total_rejection_events > 0).length;

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-semibold text-foreground tracking-tight flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-red-600" />
                        Rejection Analytics
                    </h2>
                    <p className="text-sm text-muted-foreground">Track task rejections across your team</p>
                </div>
            </div>

            {/* Date Range Filter */}
            <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs font-medium text-foreground">Date Range:</span>
                    </div>

                    <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border border-border/40">
                        {[
                            { value: '7days', label: 'Last 7 Days' },
                            { value: 'month', label: 'This Month' },
                            { value: '6months', label: 'Last 6 Months' },
                            { value: 'custom', label: 'Custom' }
                        ].map((opt) => (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => handleFilterTypeChange(opt.value)}
                                className={cn(
                                    "px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer",
                                    filterType === opt.value
                                        ? "bg-white text-foreground shadow-sm"
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                    <div className="animate-in slide-in-from-left-2 fade-in duration-200">
                        <p className="text-xs text-orange-600">*By default it will fetch this month's rejections</p>
                    </div>

                    {filterType === 'custom' && (
                        <div className="flex items-center gap-2 animate-in slide-in-from-left-2 fade-in duration-200">
                            <Input
                                type="date"
                                value={dateFrom}
                                onChange={e => setDateFrom(e.target.value)}
                                className="text-xs h-9 w-36"
                            />
                            <span className="text-xs text-muted-foreground">to</span>
                            <Input
                                type="date"
                                value={dateTo}
                                onChange={e => setDateTo(e.target.value)}
                                className="text-xs h-9 w-36"
                            />
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={fetchRejectionSummary}
                                className="text-xs h-9 cursor-pointer"
                            >
                                Apply Filter
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="rounded-xl border border-border bg-card p-5">
                    <div className="text-3xl font-bold text-foreground">{totalMembers}</div>
                    <p className="text-xs text-muted-foreground mt-1">Members with Rejections</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-5">
                    <div className="text-3xl font-bold text-red-600">{totalRejections}</div>
                    <p className="text-xs text-muted-foreground mt-1">Total Rejection Events</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-5">
                    <div className="text-3xl font-bold text-amber-600">
                        {totalMembers > 0 ? (totalRejections / totalMembers).toFixed(1) : '0'}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Avg Rejections per Member</p>
                </div>
            </div>

            {/* Search & Filters */}
            <div className="rounded-xl border border-border bg-card p-4 flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search team members..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="pl-9"
                    />
                </div>
                <div className="w-full sm:w-64 flex items-center gap-3">
                    <span className="text-sm font-medium whitespace-nowrap text-muted-foreground">Rejections &gt;</span>
                    <Input
                        type="number"
                        placeholder="0"
                        value={minRejections}
                        onChange={(e) => setMinRejections(e.target.value)}
                        min="0"
                        style={{
                            width: `${Math.max(String(minRejections || "").length + 2, 4)}ch`,
                        }}
                        className="min-w-[60px]"
                    />
                </div>
            </div>

            {/* Member Cards */}
            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            ) : (
                <div className="space-y-3">
                    {sorted.map(m => (
                        <div
                            key={m.user_id}
                            className="rounded-xl border border-border bg-card p-5 cursor-pointer hover:border-foreground/30 transition-colors"
                            onClick={() => setSelectedMember(m)}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-base font-semibold text-foreground">{m.user_name}</span>
                                        {m.total_rejection_events > 5 && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-semibold border border-red-200">
                                                <AlertTriangle className="h-3 w-3" />
                                                High Rejections
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-muted-foreground">{m.user_role}</p>
                                </div>
                                <div className="flex items-center gap-6">
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-foreground">{m.total_rejected_tasks}</div>
                                        <p className="text-[10px] text-muted-foreground">Tasks Rejected</p>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-red-600">{m.total_rejection_events}</div>
                                        <p className="text-[10px] text-muted-foreground">Total Rejections</p>
                                    </div>
                                    <ChevronDown className="h-5 w-5 text-muted-foreground rotate-[-90deg]" />
                                </div>
                            </div>
                        </div>
                    ))}
                    {sorted.length === 0 && !loading && (
                        <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground text-sm">
                            No rejection data found for the selected date range.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
