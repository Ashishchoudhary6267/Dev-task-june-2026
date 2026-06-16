'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useClientApprovalStore, ClientApproval } from '@/lib/zustand/client-approvals/client-approvals';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import {
    CheckCircle2, XCircle, Clock, MessageSquare,
    Building2, RefreshCw, Bell, AlertTriangle,
    User, Calendar, Loader2, InboxIcon, Search, Eye,
    ChevronUp,
    ChevronDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { UISelect } from '@/components/ui/ui-select';
import { useClientStore } from '@/lib/zustand/clients/client';

const presetToDates = (preset: string, fromDate: string, toDate: string) => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

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
        d.setDate(d.getDate() - 30);
        return { from_date: d.toISOString().split('T')[0], to_date: todayStr };
    }
    if (preset === 'custom') {
        return {
            from_date: fromDate || undefined,
            to_date: toDate || undefined,
        };
    }
    return { from_date: undefined, to_date: undefined };
};

// ── Rejection Comment Modal ──────────────────────────────────────────────────
interface RejectModalProps {
    approval: ClientApproval;
    onConfirm: (comment: string) => void;
    onCancel: () => void;
    loading: boolean;
}

function RejectModal({ approval, onConfirm, onCancel, loading }: RejectModalProps) {
    const [comment, setComment] = useState('');
    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in fade-in slide-in-from-bottom-4 duration-200">
                <div className="flex items-center gap-3 mb-4">
                    <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                        <XCircle className="h-5 w-5 text-red-600" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-900 text-base">Log Client Rejection</h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Record the client&apos;s feedback for <span className="font-semibold">{approval.instance?.name}</span>
                        </p>
                    </div>
                </div>
                <div className="mb-5">
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Client&apos;s feedback / reason for rejection <span className="text-red-500">*</span>
                    </label>
                    <textarea
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-400/40 focus:border-red-400 resize-none transition-all"
                        rows={4} placeholder="E.g. Client wants the tone to be more formal..."
                        value={comment} onChange={(e) => setComment(e.target.value)} autoFocus
                    />
                </div>
                <div className="flex gap-3">
                    <Button variant="outline" className="flex-1" onClick={onCancel} disabled={loading}>Cancel</Button>
                    <Button className="flex-1 bg-red-500 hover:bg-red-600 text-white" onClick={() => onConfirm(comment)} disabled={loading || comment.trim().length === 0}>
                        {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : <><XCircle className="h-4 w-4 mr-2" />Log Rejection</>}
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ── Details Modal ──────────────────────────────────────────────────────────
interface DetailsModalProps {
    approval: ClientApproval;
    onClose: () => void;
    onApprove: (approval: ClientApproval) => void;
    onReject: (approval: ClientApproval) => void;
    resolving: string | null;
}

function DetailsModal({ approval, onClose, onApprove, onReject, resolving }: DetailsModalProps) {
    const isPending = approval.status === 'PENDING';
    const isResolving = resolving === approval.id;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div>
                        <h3 className="font-bold text-slate-900 text-lg">Client Approval Details</h3>
                        <p className="text-sm text-slate-500 mt-0.5">Review and take action</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors"><XCircle className="h-5 w-5" /></button>
                </div>
                <div className="p-6 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Instance</span>
                            <span className="text-sm font-semibold text-slate-900">{approval.instance?.name || 'N/A'}</span>
                        </div>
                        <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Task</span>
                            <span className="text-sm font-semibold text-slate-900">{approval.task?.title || 'N/A'}</span>
                        </div>
                        <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Assignee</span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <div className="h-5 w-5 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[9px] font-bold">
                                    {approval.task?.assigned_user?.name?.slice(0, 2).toUpperCase() || '?'}
                                </div>
                                <span className="text-sm text-slate-700">{approval.task?.assigned_user?.name || 'Unassigned'}</span>
                            </div>
                        </div>
                        <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Status</span>
                            <Badge variant={approval.status === 'APPROVED' ? 'success' : approval.status === 'REJECTED' ? 'destructive' : 'outline'} className={isPending ? 'bg-amber-100 text-amber-700 hover:bg-amber-100' : ''}>
                                {approval.status}
                            </Badge>
                        </div>
                    </div>
                    {approval.client_comment && (
                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-2 flex items-center gap-1"><MessageSquare className="h-3 w-3" /> Client Comment</span>
                            <p className="text-sm text-slate-700">{approval.client_comment}</p>
                        </div>
                    )}
                    {isPending ? (
                        <div className="space-y-3 pt-2">
                            <a
                                href={`mailto:?subject=${encodeURIComponent(`Follow Up: ${approval.instance?.name || ''}`)}&body=${encodeURIComponent(`Hi,\n\nI am following up regarding the deliverable: ${approval.task?.title || ''}.\n\nPlease let us know if you have any feedback or if you approve.\n\nThank you!`)}`}
                                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all duration-150 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200"
                            >
                                <MessageSquare className="h-4 w-4" /> Send Follow-up Email
                            </a>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <button onClick={() => onApprove(approval)} disabled={isResolving} className={cn('flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all duration-150', 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm shadow-emerald-200', isResolving && 'opacity-50 cursor-not-allowed')}>
                                    {isResolving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Approved
                                </button>
                                <button onClick={() => { onClose(); onReject(approval); }} disabled={isResolving} className={cn('flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all duration-150', 'bg-red-50 hover:bg-red-100 text-red-600 border border-red-200', isResolving && 'opacity-50 cursor-not-allowed')}>
                                    {isResolving ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />} Rejected
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="text-xs text-slate-500 pt-2 border-t border-slate-100">
                            Decision logged by <span className="font-semibold">{approval.decided_by?.name || 'Unknown'}</span>
                            {approval.decision_at && ` on ${new Date(approval.decision_at).toLocaleDateString()}`}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Main Tab ─────────────────────────────────────────────────────────────────
const STATUS_TABS = [
    { key: 'PENDING', label: 'Pending', color: 'text-amber-600 bg-amber-50 border-amber-200' },
    { key: 'APPROVED', label: 'Approved', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
    { key: 'REJECTED', label: 'Rejected', color: 'text-red-600 bg-red-50 border-red-200' },
    { key: 'ALL', label: 'All', color: 'text-slate-600 bg-slate-50 border-slate-200' },
] as const;

export default function ClientApprovalsTab() {
    const { approvals, count, loading, error, resolving, fetchApprovals, resolveApproval } = useClientApprovalStore();
    const { clients, fetchClients } = useClientStore();
    const { addToast } = useToast();
    const [statusFilter, setStatusFilter] = useState<typeof STATUS_TABS[number]['key']>('PENDING');
    const [rejectTarget, setRejectTarget] = useState<ClientApproval | null>(null);
    const [detailTarget, setDetailTarget] = useState<ClientApproval | null>(null);
    const [rejectLoading, setRejectLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // New filters
    const [clientIdFilter, setClientIdFilter] = useState('all');
    const [datePreset, setDatePreset] = useState('all');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');

    const [sortKey, setSortKey] = useState('date');
    const [sortDir, setSortDir] = useState('desc');

    useEffect(() => { fetchApprovals(statusFilter); }, [statusFilter]);
    useEffect(() => { fetchClients(); }, []);

    const handleApprove = async (approval: ClientApproval) => {
        try {
            await resolveApproval(approval.id, 'APPROVED');
            addToast({ title: 'Client approval recorded ✅', description: `"${approval.instance?.name}" has resumed.`, variant: 'success' });
            setDetailTarget(null);
        } catch (err: any) {
            addToast({ title: 'Failed to record approval', description: err.response?.data?.message || 'Please try again.', variant: 'destructive' });
        }
    };

    const handleRejectConfirm = async (comment: string) => {
        if (!rejectTarget) return;
        setRejectLoading(true);
        try {
            await resolveApproval(rejectTarget.id, 'REJECTED', comment);
            addToast({ title: 'Client rejection logged ↩', description: `The task has been reopened.`, variant: 'success' });
            setRejectTarget(null);
        } catch (err: any) {
            addToast({ title: 'Failed to log rejection', description: err.response?.data?.message || 'Please try again.', variant: 'destructive' });
        } finally {
            setRejectLoading(false);
        }
    };

    const filteredApprovals = useMemo(() => {
        let result = approvals;

        // Text Search
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            result = result.filter(a =>
                a.instance?.name?.toLowerCase().includes(q) ||
                a.task?.title?.toLowerCase().includes(q) ||
                a.task?.assigned_user?.name?.toLowerCase().includes(q)
            );
        }

        // Client Filter
        if (clientIdFilter !== 'all') {
            result = result.filter(a => a.instance?.client?.id === clientIdFilter);
        }

        // Date Filter
        const { from_date, to_date } = presetToDates(datePreset, fromDate, toDate);
        if (from_date || to_date) {
            result = result.filter(a => {
                const dateStr = a.created_at.split('T')[0];
                if (from_date && dateStr < from_date) return false;
                if (to_date && dateStr > to_date) return false;
                return true;
            });
        }

        return result;
    }, [approvals, searchQuery, clientIdFilter, datePreset, fromDate, toDate]);

    return (
        <>
            {rejectTarget && <RejectModal approval={rejectTarget} onConfirm={handleRejectConfirm} onCancel={() => setRejectTarget(null)} loading={rejectLoading} />}
            {detailTarget && <DetailsModal approval={detailTarget} onClose={() => setDetailTarget(null)} onApprove={handleApprove} onReject={setRejectTarget} resolving={resolving} />}

            <div className="space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <h2 className="text-lg font-bold text-slate-900">Client Approvals</h2>
                        <p className="text-sm text-slate-500 mt-0.5">Log client decisions on message deliverables.</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => fetchApprovals(statusFilter)} disabled={loading} className="shrink-0">
                        <RefreshCw className={cn('h-3.5 w-3.5 mr-2', loading && 'animate-spin')} /> Refresh
                    </Button>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                    <div className="flex gap-2 flex-wrap mb-2 sm:mb-0">
                        {STATUS_TABS.map((tab) => (
                            <button key={tab.key} onClick={() => setStatusFilter(tab.key)} className={cn('px-4 py-1.5 rounded-full text-sm font-semibold border transition-all duration-150', statusFilter === tab.key ? tab.color + ' shadow-sm' : 'text-slate-500 bg-white border-slate-200 hover:border-slate-300')}>
                                {tab.label}
                                {tab.key === 'PENDING' && count > 0 && statusFilter !== 'PENDING' && <span className="ml-1.5 bg-amber-500 text-white rounded-full px-1.5 py-0.5 text-xs">{count}</span>}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ─── Filters Card ─── */}
                <div className="bg-card border border-border/40 rounded-2xl p-6 shadow-sm mb-6">
                    <div className="mb-6">
                        <h2 className="text-lg font-semibold text-foreground">Filters</h2>
                        <p className="text-sm text-muted-foreground">
                            Filter client approvals
                        </p>
                    </div>

                    <div className="flex flex-wrap items-end gap-4 lg:gap-x-8">
                        {/* Search */}
                        <div className="flex-1 min-w-[240px] max-w-md flex flex-col gap-1.5">
                            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">
                                Search
                            </label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <Input placeholder="Search instance, task, or assignee..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 bg-background" />
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

                        {/* Time Preset */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">
                                Time
                            </label>
                            <UISelect
                                value={datePreset}
                                onValueChange={(val: string) => {
                                    setDatePreset(val);
                                    if (val !== 'custom') {
                                        setFromDate('');
                                        setToDate('');
                                    }
                                }}
                                options={[
                                    { value: 'all', label: 'All Time' },
                                    { value: 'today', label: 'Today' },
                                    { value: 'last7', label: 'Last 7 Days' },
                                    { value: 'last30', label: 'Last 30 Days' },
                                    { value: 'custom', label: 'Custom Range' },
                                ]}
                            />
                        </div>

                        {/* Custom Date Range */}
                        {datePreset === 'custom' && (
                            <div className="flex flex-wrap items-end gap-4">
                                <div className="w-full sm:w-[160px] flex flex-col gap-1.5">
                                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">From Date</label>
                                    <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-10 w-full rounded-xl border border-border/50 bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/10 font-medium transition-all" />
                                </div>
                                <div className="w-full sm:w-[160px] flex flex-col gap-1.5">
                                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">To Date</label>
                                    <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-10 w-full rounded-xl border border-border/50 bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/10 font-medium transition-all" />
                                </div>
                            </div>
                        )}

                        {/* Clear Button */}
                        {(clientIdFilter !== 'all' || searchQuery || datePreset !== 'all' || fromDate || toDate) && (
                            <div className="flex-1 flex justify-end sm:flex-none ml-auto">
                                <Button
                                    variant="ghost"
                                    className="h-10 px-4 text-sm font-bold text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-xl transition-all"
                                    onClick={() => {
                                        setClientIdFilter('all');
                                        setSearchQuery('');
                                        setDatePreset('all');
                                        setFromDate('');
                                        setToDate('');
                                    }}
                                >
                                    Clear Filters
                                </Button>
                            </div>
                        )}
                    </div>
                </div>

                {statusFilter === 'PENDING' && approvals.length > 0 && (
                    <div className="flex items-start gap-2.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        <p>Pending items are paused waiting for client decision. Daily reminders are sent to assignees.</p>
                    </div>
                )}

                {loading ? (
                    <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-slate-300" /></div>
                ) : error ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <AlertTriangle className="h-10 w-10 text-red-400 mb-3" />
                        <p className="text-sm font-medium text-slate-700">Failed to load</p>
                    </div>
                ) : filteredApprovals.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="h-16 w-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4"><InboxIcon className="h-8 w-8 text-slate-400" /></div>
                        <p className="text-base font-semibold text-slate-700">No {statusFilter.toLowerCase()} approvals</p>
                    </div>
                ) : (
                    <>
                        {/* Table View (Desktop) */}
                        <div className="hidden md:block rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left border-collapse">
                                    <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                                        <tr>
                                            {[
                                                { key: 'instance', label: 'Instance / Task' },
                                                { key: 'assignee', label: 'Assignee' },
                                                { key: 'status', label: 'Status' },
                                                { key: 'date', label: 'Date' },
                                            ].map(col => (
                                                <th
                                                    key={col.key}
                                                    className="px-6 py-4 cursor-pointer select-none"
                                                    onClick={() => {
                                                        if (sortKey === col.key) {
                                                            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
                                                        } else {
                                                            setSortKey(col.key);
                                                            setSortDir('asc');
                                                        }
                                                    }}
                                                >
                                                    <div className="flex items-center gap-1.5">
                                                        {col.label}
                                                        <span className={`text-[11px] transition-colors ${sortKey === col.key ? 'text-violet-600' : 'text-slate-400'}`}>
                                                            {sortKey === col.key ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                                                        </span>
                                                    </div>
                                                </th>
                                            ))}
                                            <th className="px-6 py-4 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {[...filteredApprovals]
                                            .sort((a, b) => {
                                                let aVal, bVal;
                                                if (sortKey === 'instance') {
                                                    aVal = a.instance?.name || '';
                                                    bVal = b.instance?.name || '';
                                                } else if (sortKey === 'assignee') {
                                                    aVal = a.task?.assigned_user?.name || '';
                                                    bVal = b.task?.assigned_user?.name || '';
                                                } else if (sortKey === 'status') {
                                                    aVal = a.status || '';
                                                    bVal = b.status || '';
                                                } else if (sortKey === 'date') {
                                                    aVal = new Date(a.created_at);
                                                    bVal = new Date(b.created_at);
                                                } else {
                                                    return 0;
                                                }
                                                if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
                                                if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
                                                return 0;
                                            })
                                            .map(approval => (
                                                <tr key={approval.id} onClick={() => setDetailTarget(approval)} className="hover:bg-slate-50 transition-colors cursor-pointer group">
                                                    <td className="px-6 py-4">
                                                        <div className="font-semibold text-slate-900 group-hover:text-violet-600 transition-colors">{approval.instance?.name || 'N/A'}</div>
                                                        <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1"><MessageSquare className="h-3 w-3" /> {approval.task?.title}</div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-2">
                                                            <div className="h-6 w-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600">
                                                                {approval.task?.assigned_user?.name?.slice(0, 2).toUpperCase() || '?'}
                                                            </div>
                                                            <span className="text-sm font-medium">{approval.task?.assigned_user?.name || 'Unassigned'}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <Badge variant={approval.status === 'APPROVED' ? 'success' : approval.status === 'REJECTED' ? 'destructive' : 'outline'} className={approval.status === 'PENDING' ? 'bg-amber-100 text-amber-700 hover:bg-amber-100' : ''}>
                                                            {approval.status}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-6 py-4 text-xs text-slate-500">
                                                        {new Date(approval.created_at).toLocaleDateString()}
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <Button variant="ghost" size="sm" className="h-8 text-slate-500" onClick={(e) => { e.stopPropagation(); setDetailTarget(approval); }}>
                                                            <Eye className="h-4 w-4 mr-1.5" /> View
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Card View (Mobile) */}
                        <div className="grid grid-cols-1 gap-4 md:hidden">
                            {filteredApprovals.map(approval => (
                                <Card key={approval.id} onClick={() => setDetailTarget(approval)} className="p-4 cursor-pointer hover:border-violet-300 transition-colors">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <div className="font-semibold text-slate-900">{approval.instance?.name}</div>
                                            <div className="text-xs text-slate-500 truncate mt-0.5">{approval.task?.title}</div>
                                        </div>
                                        <Badge variant={approval.status === 'APPROVED' ? 'success' : approval.status === 'REJECTED' ? 'destructive' : 'outline'} className={approval.status === 'PENDING' ? 'bg-amber-100 text-amber-700' : ''}>
                                            {approval.status}
                                        </Badge>
                                    </div>
                                    <div className="flex items-center gap-2 mt-4 text-xs text-slate-500">
                                        <User className="h-3 w-3" /> {approval.task?.assigned_user?.name || 'Unassigned'}
                                    </div>
                                </Card>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </>
    );
}
