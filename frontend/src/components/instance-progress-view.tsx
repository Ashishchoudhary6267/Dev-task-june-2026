'use client';

import React, { useEffect, useState } from 'react';
// import { api } from '@/lib/api';
import { Task, Instance } from '@/lib/types/auth';
import { Loader2, User, Clock, CheckCircle2, ArrowRight, Pause } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import api from '@/lib/api';

interface InstanceProgressViewProps {
    taskId: string;
    currentUserId?: string;
}

export default function InstanceProgressView({ taskId, currentUserId }: InstanceProgressViewProps) {
    const [instance, setInstance] = useState<Instance | null>(null);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchProgress = async () => {
            try {
                setLoading(true);
                const res = await api.get(`/instances/tasks/${taskId}`);
                setInstance(res.data.instance);
                setTasks(res.data.tasks);
            } catch (err: any) {
                setError(err.response?.data?.message || 'Failed to load instance progress');
            } finally {
                setLoading(false);
            }
        };
        fetchProgress();
    }, [taskId]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-slate-300 mb-4" />
                <p className="text-sm text-slate-500">Loading instance progress...</p>
            </div>
        );
    }

    if (error || !instance) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <p className="text-sm text-red-500 mb-2">{error || 'Instance not found'}</p>
            </div>
        );
    }

    const completedTasks = tasks.filter(t => t.status === 'COMPLETED' || t.status === 'APPROVED').length;
    const totalTasks = tasks.length;
    const currentTask = tasks.find(t => ['IN_PROGRESS', 'PENDING_APPROVAL', 'REJECTED'].includes(t.status))
        || tasks.find(t => !['COMPLETED', 'APPROVED'].includes(t.status))
        || tasks[tasks.length - 1];

    const isOverdue = (dateString?: string) => {
        if (!dateString) return false;
        return new Date(dateString) < new Date();
    };

    return (
        <div className="space-y-6">
            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <span className="text-xs font-semibold text-slate-500 block mb-1">Status</span>
                        <Badge variant="secondary" className="bg-slate-200/50 text-slate-700 hover:bg-slate-200/50 capitalize shadow-none">
                            {instance.status.toLowerCase().replace('_', ' ')}
                        </Badge>
                    </div>
                    <div>
                        <span className="text-xs font-semibold text-slate-500 block mb-1">Progress</span>
                        <span className="text-sm font-bold text-slate-900">{completedTasks} / {totalTasks} tasks completed</span>
                    </div>
                    <div>
                        <span className="text-xs font-semibold text-slate-500 block mb-1">Current Step</span>
                        <span className="text-sm font-bold text-slate-900">Step {currentTask?.task_order || 1}</span>
                    </div>
                </div>
            </div>

            <div>
                <h3 className="text-sm font-bold text-slate-900 mb-4 px-1">All Tasks in This Instance</h3>
                <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                    <div className="divide-y divide-slate-100">
                        {tasks.map((t, index) => {
                            const isCurrent = t.id === currentTask?.id && t.status !== 'COMPLETED';
                            const isMine = t.assigned_user_id === currentUserId;
                            const isPastDue = t.status !== 'COMPLETED' && isOverdue(t.due_date || '');

                            let statusDisplay = t.status.replace(/_/g, ' ');
                            if (t.status === 'LOCKED') statusDisplay = 'Not Started';

                            return (
                                <div key={t.id} className={cn("p-4 flex items-center gap-4 transition-colors", isCurrent ? "bg-blue-50/30 relative" : "hover:bg-slate-50")}>
                                    {isCurrent && <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500" />}

                                    <div className={cn(
                                        "h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                                        isCurrent ? "bg-blue-100 text-blue-600" :
                                            t.status === 'COMPLETED' ? "bg-emerald-100 text-emerald-600" :
                                                "bg-slate-100 text-slate-500"
                                    )}>
                                        {t.task_order}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                            <span className="font-semibold text-sm text-slate-900 truncate">{t.title}</span>
                                            {isCurrent && (
                                                <Badge className={cn(
                                                    "text-[10px] h-5 px-1.5 shadow-none rounded-md flex items-center gap-1",
                                                    instance.status?.toLowerCase() === 'paused'
                                                        ? "bg-amber-500 text-white hover:bg-amber-600"
                                                        : "bg-slate-900 text-white hover:bg-slate-800"
                                                )}>
                                                    {instance.status?.toLowerCase() === 'paused' ? <Pause className="h-3 w-3" /> : <ArrowRight className="h-3 w-3" />}
                                                    {instance.status?.toLowerCase() === 'paused' ? 'Paused' : 'Current'}
                                                </Badge>
                                            )}
                                            {isMine && (
                                                <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50 text-[10px] h-5 px-1.5 rounded-md">
                                                    Your Task
                                                </Badge>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3 text-xs text-slate-500">
                                            <div className="flex items-center gap-1">
                                                <User className="h-3 w-3" />
                                                <span className="truncate max-w-[100px]">{t.assigned_user?.name || 'Unassigned'}</span>
                                            </div>
                                            <span className="text-slate-300">•</span>
                                            <div className={cn("flex items-center gap-1", isPastDue && "text-red-600 font-medium")}>
                                                <Clock className="h-3 w-3" />
                                                {t.due_date ? `Due: ${format(new Date(t.due_date), 'MM/dd/yyyy')}` : 'No due date'}
                                                {isPastDue && " (Overdue)"}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="shrink-0 text-right flex flex-col items-end justify-center gap-1">
                                        {t.status === 'COMPLETED' ? (
                                            <>
                                                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                                                    <CheckCircle2 className="h-3.5 w-3.5" /> Completed
                                                </div>
                                                {t.assigned_at && t.submitted_at && (
                                                    <span className="text-[10px] font-bold text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                                                        {(() => {
                                                            const startDate = new Date(t.assigned_at);
                                                            const endDate = new Date(t.submitted_at);
                                                            if (endDate <= startDate) return "0m";
                                                            const startH = 9, startM = 30, endH = 18, endM = 30;
                                                            const bSH = 13, bSM = 30, bEH = 14, bEM = 30;
                                                            let totalMinutes = 0;
                                                            let current = new Date(startDate);
                                                            const getDateStr = (d: Date) => d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
                                                            const endStr = getDateStr(endDate);
                                                            while (getDateStr(current) <= endStr) {
                                                                const day = current.getDay();
                                                                if (day !== 0 && day !== 6) {
                                                                    const mS = new Date(current); mS.setHours(startH, startM, 0, 0);
                                                                    const mE = new Date(current); mE.setHours(bSH, bSM, 0, 0);
                                                                    const aS = new Date(current); aS.setHours(bEH, bEM, 0, 0);
                                                                    const aE = new Date(current); aE.setHours(endH, endM, 0, 0);
                                                                    const mF = Math.max(startDate.getTime(), mS.getTime());
                                                                    const mT = Math.min(endDate.getTime(), mE.getTime());
                                                                    if (mT > mF) totalMinutes += (mT - mF) / 60000;
                                                                    const aF = Math.max(startDate.getTime(), aS.getTime());
                                                                    const aT = Math.min(endDate.getTime(), aE.getTime());
                                                                    if (aT > aF) totalMinutes += (aT - aF) / 60000;
                                                                }
                                                                current.setDate(current.getDate() + 1);
                                                                current.setHours(0, 0, 0, 0);
                                                            }
                                                            if (totalMinutes < 60) return `${Math.round(totalMinutes)}m`;
                                                            return `${(totalMinutes / 60).toFixed(1)}h`;
                                                        })()}
                                                    </span>
                                                )}
                                            </>
                                        ) : (
                                            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-slate-50 px-2.5 py-1 rounded-full border border-slate-200">
                                                <Clock className="h-3.5 w-3.5 text-slate-400" /> <span className="capitalize">{statusDisplay.toLowerCase()}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
