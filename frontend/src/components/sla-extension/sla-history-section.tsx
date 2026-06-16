'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui';

interface SLAHistorySectionProps {
    taskId: string;
}

export default function SLAHistorySection({ taskId }: SLAHistorySectionProps) {
    const [slaRequests, setSlaRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (taskId) {
            setLoading(true);
            api.get(`/tasks/${taskId}/sla-extension-requests`)
                .then(res => setSlaRequests(res.data.data || []))
                .catch(() => setSlaRequests([]))
                .finally(() => setLoading(false));
        }
    }, [taskId]);

    if (loading) {
        return (
            <div className="space-y-3 mt-6">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest border-b pb-2">
                    TAT Extension Requests
                </h4>
                <div className="text-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                </div>
            </div>
        );
    }

    if (slaRequests.length === 0) return null;

    return (
        <div className="space-y-3 mt-6">
            <div className="flex items-center justify-between border-b pb-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
                    TAT Extension Requests
                </h4>
                <span className="text-xs font-medium bg-muted text-muted-foreground px-2.5 py-0.5 rounded-full border">
                    {slaRequests.length} {slaRequests.length === 1 ? 'request' : 'requests'}
                </span>
            </div>

            <div className="space-y-3 pt-1">
                {slaRequests.map((req: any) => {
                    const isApproved = req.status === 'APPROVED';
                    const isRejected = req.status === 'REJECTED';
                    const isPending = req.status === 'PENDING';

                    const accentBorder = isApproved
                        ? 'border-l-[3px] border-l-green-500'
                        : isRejected
                            ? 'border-l-[3px] border-l-red-500'
                            : 'border-l-[3px] border-l-yellow-400';

                    const avatarColor = isApproved
                        ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                        : isRejected
                            ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                            : 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300';

                    const pillColor = isApproved
                        ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                        : isRejected
                            ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                            : 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300';

                    const reviewBg = isApproved
                        ? 'bg-green-50/70 dark:bg-green-900/10'
                        : 'bg-red-50/70 dark:bg-red-900/10';

                    const reviewLabelColor = isApproved
                        ? 'text-green-700 dark:text-green-400'
                        : 'text-red-700 dark:text-red-400';

                    const initials = (req.requested_by_user?.name || '?')
                        .split(' ')
                        .map((n: string) => n[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase();

                    return (
                        <div
                            key={req.id}
                            className={`rounded-lg border border-border text-sm overflow-hidden ${accentBorder}`}
                        >
                            {/* Top: avatar + name + meta */}
                            <div className="flex items-start gap-3 p-4">
                                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-medium shrink-0 ${avatarColor}`}>
                                    {initials}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                        <span className="text-sm font-medium text-foreground">
                                            {req.requested_by_user?.name || 'Unknown'}
                                        </span>
                                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${pillColor}`}>
                                            {isApproved ? '✓ Approved' : isRejected ? '✗ Rejected' : '⏳ Pending'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-4 flex-wrap">
                                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                                            Requested:{' '}
                                            {new Date(req.requested_at).toLocaleString('en-IN', {
                                                dateStyle: 'medium',
                                                timeStyle: 'short',
                                            })}
                                        </span>
                                        {req.suggested_new_deadline && (
                                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                Suggested: {new Date(req.suggested_new_deadline).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="border-t border-border/50" />

                            {/* Member's reason */}
                            <div className="px-4 py-3">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                                    Member's Reason
                                </p>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <p className="text-sm text-foreground/80 italic line-clamp-2 cursor-help">
                                            "{req.reason}"
                                        </p>
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-sm break-words">
                                        {req.reason}
                                    </TooltipContent>
                                </Tooltip>
                            </div>

                            {/* Controller's response (only when not pending) */}
                            {!isPending && (
                                <div className={`mx-4 mb-4 p-3 rounded-md flex items-start justify-between gap-3 ${reviewBg}`}>
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-[10px] font-semibold uppercase tracking-wider mb-1 ${reviewLabelColor}`}>
                                            Controller's Response
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {isApproved ? 'Approved' : 'Rejected'} by{' '}
                                            <strong className="text-foreground">
                                                {req.reviewed_by_user?.name || 'Unknown'}
                                            </strong>
                                        </p>
                                        {isApproved && req.final_new_deadline && (
                                            <p className="text-xs font-medium text-green-700 dark:text-green-300 mt-1.5 flex items-center gap-1">
                                                New deadline:{' '}
                                                {new Date(req.final_new_deadline).toLocaleString('en-IN', {
                                                    dateStyle: 'medium',
                                                    timeStyle: 'short',
                                                })}
                                            </p>
                                        )}
                                        {req.reviewer_comment && (
                                            <p className="text-xs text-foreground/80 italic mt-1.5">
                                                "{req.reviewer_comment}"
                                            </p>
                                        )}
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-xs font-medium text-foreground">
                                            {req.reviewed_by_user?.name || 'Unknown'}
                                        </p>
                                        {req.reviewed_at && (
                                            <p className="text-[11px] text-muted-foreground mt-0.5">
                                                {new Date(req.reviewed_at).toLocaleString('en-IN', {
                                                    dateStyle: 'medium',
                                                    timeStyle: 'short',
                                                })}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
