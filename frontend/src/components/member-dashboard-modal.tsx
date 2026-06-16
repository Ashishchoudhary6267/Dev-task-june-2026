import React, { useState } from 'react'
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
    DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Task } from '@/lib/types/auth';
import { useTaskStore } from '@/lib/zustand/tasks/tasks';
import { useAuthStore } from '@/lib/zustand/user/user';
import {
    CheckSquare, Square, Clock, Send, CheckCircle2, FolderKanban,
    Loader2, RefreshCw, XCircle, FileText, Activity,
    ThumbsUp, ThumbsDown, Inbox, Eye, Search, ListChecks,
    ClipboardCheck, CalendarClock, ArrowUpRight, BarChart3,
    Sparkles
} from 'lucide-react';
import { Button, Badge, Input, Textarea } from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import AICopyPanel from '@/components/ai-copy/ai-copy-panel';
import InstanceProgressView from '@/components/instance-progress-view';
import { RejectModal } from './ManualTasksmodal/Details';

interface LinkItem {
    type: 'link' | 'title';
    value: string;
}

export default function TaskDetailsModal({ detailTask, setDetailTask }: { detailTask: Task | null; setDetailTask: (task: Task | null) => void }) {
    const { addToast } = useToast();
    const { user } = useAuthStore();
    const [showAICopy, setShowAICopy] = useState(false);

    const {
        workerTasks, approvalTasks, completedTasks,
        pendingApprovalTasks, upcomingTasks,
        fetchMyTasks, submitTask, approveTask, rejectTask,
        toggleChecklistItem, loading, allTasks
    } = useTaskStore();
    const [localChecked, setLocalChecked] = useState<Record<string, boolean>>({});
    const [submitting, setSubmitting] = useState(false);
    const [links, setLinks] = useState('');
    const [showSubmitBox, setShowSubmitBox] = useState(false);
    const [comment, setComment] = useState('');
    const [selectedActionTask, setSelectedActionTask] = useState<Task | null>(null);
    const [rejectModalOpen, setRejectModalOpen] = useState(false);
    const [approveModalOpen, setApproveModalOpen] = useState(false);
    const [rejectLoading, setRejectLoading] = useState(false);
    const [clientApprovalNeeded, setClientApprovalNeeded] = useState(false);

    const isApprovalQueueTask = (task: Task) =>
        approvalTasks.some(t => t.id === task.id);


    const handleApprove = async () => {
        if (!selectedActionTask) return;

        setSubmitting(true);
        const ok = await approveTask(selectedActionTask.id, comment.trim() || undefined, clientApprovalNeeded);
        setSubmitting(false);
        setApproveModalOpen(false);
        if (ok) {
            addToast({ title: 'Approved! ✅', description: 'Task approved successfully.', variant: 'success' });
            setSelectedActionTask(null); setComment(''); setClientApprovalNeeded(false);
        } else {
            addToast({ title: 'Error', description: 'Failed to approve task.', variant: 'destructive' });
        }
    };

    const handleSelectAll = (items: any[]) => {
        const allChecked = items.every(item => localChecked[item.id]);
        const newState = { ...localChecked };
        items.forEach(item => {
            newState[item.id] = !allChecked;
        });
        setLocalChecked(newState);
    };
    const handleLocalToggle = (itemId: string) => {
        setLocalChecked(prev => ({ ...prev, [itemId]: !prev[itemId] }));
    };

    // ─── Status config ──────────────────────────────────────────────────
    const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
        IN_PROGRESS: { label: 'In Progress', color: 'text-blue-700 dark:text-blue-300', bg: 'bg-blue-100 dark:bg-blue-900/30' },
        PENDING_APPROVAL: { label: 'Under Review', color: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-100 dark:bg-amber-900/30' },
        REJECTED: { label: 'Returned', color: 'text-red-700 dark:text-red-300', bg: 'bg-red-100 dark:bg-red-900/30' },
        COMPLETED: { label: 'Completed', color: 'text-green-700 dark:text-green-300', bg: 'bg-green-100 dark:bg-green-900/30' },
        LOCKED: { label: 'Upcoming', color: 'text-muted-foreground', bg: 'bg-muted' },
    };

    // ── Handlers ────────────────────────────────────────────────────────
    const handleSubmit = async (task: Task) => {
        const items = task.task_checklist_progress || [];


        if (items.length > 0 && !items.every(i => localChecked[i.id] === true)) {
            addToast({ title: 'Checklist incomplete', description: 'Please complete all checklist items first.', variant: 'destructive' });
            return;
        }
        try {
            setSubmitting(true);
            const ok = await submitTask(task.id, links)
            // await toggleChecklistItem(task.id, items[0].id, true);
            setSubmitting(false);
            setShowSubmitBox(false);
            if (ok) {
                addToast({
                    title: task.approval_required ? 'Submitted for Approval ✅' : 'Task Completed! ✅',
                    description: task.approval_required ? 'Waiting for approver.' : 'Task marked as complete.',
                    variant: 'success',
                });
                setSelectedActionTask(null);
                setComment('');
            } else {
                addToast({ title: 'Error', description: 'Could not submit task.', variant: 'destructive' });
            }
        } catch (err) {
            addToast({ title: 'Error', description: 'Could not submit task.', variant: 'destructive' });
        } finally {
            setSubmitting(false);
            setDetailTask(null);
        }
    };

    const handleReject = async () => {
        if (!selectedActionTask) return;
        setRejectLoading(true);
        setSubmitting(true);
        const ok = await rejectTask(selectedActionTask.id, comment.trim() || undefined);
        setRejectLoading(false);
        setSubmitting(false);
        if (ok) {
            addToast({ title: 'Rejected', description: 'Task sent back to worker.', variant: 'success' });
            setSelectedActionTask(null); setComment('');
        } else {
            addToast({ title: 'Error', description: 'Failed to reject task.', variant: 'destructive' });
        }
        setApproveModalOpen(false);
        setRejectModalOpen(false);
    };
    function parseLinkItems(raw: string | null | undefined): LinkItem[] {
        if (!raw) return [];

        const URL_REGEX = /https?:\/\/[^\s]+/g;
        const lines = raw.split('\n');
        const items: LinkItem[] = [];

        for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line) continue;

            const urls = [...line.matchAll(URL_REGEX)].map(m => m[0]);
            const textPart = line.replace(URL_REGEX, '').trim();

            if (textPart) {
                items.push({ type: 'title', value: textPart });
            }

            for (const url of urls) {
                items.push({ type: 'link', value: url });
            }
        }

        return items;
    }
    function renderInputValue(value: string) {
        if (!value) return null;

        const items = parseLinkItems(value);
        if (items.length === 0) return <span>{value}</span>;

        // If it's just one item and it's a link
        if (items.length === 1 && items[0].type === 'link') {
            return (
                <a
                    href={items[0].value}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-blue-600 hover:underline inline-flex items-center gap-1 break-all"
                    onClick={e => e.stopPropagation()}
                >
                    <ArrowUpRight className="h-3 w-3" />
                    {items[0].value}
                </a>
            );
        }

        return (
            <div className="flex flex-col gap-1.5 mt-1" onClick={e => e.stopPropagation()}>
                {items.map((item: any, idx: number) => (
                    item.type === 'link' ? (
                        <a
                            key={idx}
                            href={item.value}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="text-blue-600 hover:underline inline-flex items-center gap-1 break-all"
                        >
                            <ArrowUpRight className="h-3 w-3" />
                            {item.value}
                        </a>
                    ) : (
                        <div key={idx} className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight mt-1 first:mt-0">
                            {item.value}
                        </div>
                    )
                ))}
            </div>
        );
    }

    const handleToggle = async (taskId: string, itemId: string, current: boolean) => {
        await toggleChecklistItem(taskId, itemId, !current);
    };
    console.log("detailTask", detailTask);

    return (
        <>
            <Dialog open={!!detailTask} onOpenChange={() => setDetailTask(null)}>
                <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
                    {detailTask && (() => {
                        const task = detailTask;

                        const checklist = task.task_checklist_progress || [];
                        const checkedCount = checklist.filter(i => i.is_checked).length;
                        const allChecked = checklist.length === 0 || checkedCount === checklist.length;
                        const isApproval = isApprovalQueueTask(task);
                        const isPaused = task.instance?.status?.toLowerCase() === 'paused';
                        const cfg = isPaused
                            ? { label: 'Paused', color: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-100 dark:bg-amber-900/30' }
                            : (STATUS_STYLE[task.status] || STATUS_STYLE.LOCKED);

                        return (
                            <>
                                {task.status === 'LOCKED' ? (
                                    <DialogHeader>
                                        <DialogTitle className="text-lg flex items-center gap-2">
                                            <Eye className="h-5 w-5 text-slate-700" /> Instance Progress
                                        </DialogTitle>
                                        <DialogDescription className="flex items-center gap-2 flex-wrap text-slate-500">
                                            <span>{task.instance?.name || task.project?.name}</span>
                                            {task.instance?.client?.name && <span>· {task.instance.client.name}</span>}
                                        </DialogDescription>
                                    </DialogHeader>
                                ) : (
                                    <DialogHeader>
                                        <DialogTitle className="text-lg">{task.title}</DialogTitle>
                                        <DialogDescription className="flex items-center gap-2 flex-wrap">
                                            <span>{task.instance?.name || task.project?.name}</span>
                                            {task.instance?.client?.name && <span>· {task.instance.client.name}</span>}
                                            <span>· Step {task.task_order}</span>
                                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${cfg.bg} ${cfg.color}`}>
                                                {cfg.label}
                                            </span>
                                        </DialogDescription>
                                    </DialogHeader>
                                )}

                                <div className="space-y-5 mt-4">
                                    {task.status === 'LOCKED' ? (
                                        <InstanceProgressView taskId={task.id} currentUserId={user?.id} />
                                    ) : (
                                        <>
                                            {/* Rejection banner */}
                                            {task.last_rejected_at && (
                                                <div className="rounded-xl border border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-900/20 p-4">
                                                    <div className="flex items-start gap-3">
                                                        <XCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                                                        <div className="flex-1 min-w-0">
                                                            <h3 className="text-sm font-semibold text-red-700 dark:text-red-400">Task Returned</h3>
                                                            <p className="text-xs text-red-600/80 dark:text-red-400/70 mt-0.5">
                                                                Rejected by{' '}
                                                                <span className="font-medium text-red-700 dark:text-red-300">
                                                                    {task.last_rejector?.name || 'Unknown'}
                                                                </span>
                                                                {task.last_rejected_at && (
                                                                    <> · {new Date(task.last_rejected_at).toLocaleString()}</>
                                                                )}
                                                            </p>
                                                            {task.last_rejection_comment && (
                                                                <div className="mt-2 p-3 rounded-lg bg-red-100/60 dark:bg-red-900/30 border border-red-200/50 dark:border-red-800/30">
                                                                    <p className="text-sm text-red-800 dark:text-red-200 whitespace-pre-wrap">
                                                                        "{task.last_rejection_comment}"
                                                                    </p>
                                                                </div>
                                                            )}

                                                            {/* Checklist Specific Feedback */}
                                                            {task.task_checklist_progress?.some((item: any) => item.reviewer_comments?.length > 0) && (
                                                                <div className="mt-3 space-y-2">
                                                                    <p className="text-[10px] font-bold text-red-700/60 uppercase tracking-wider px-1">Checklist Feedback</p>
                                                                    <div className="space-y-1.5">
                                                                        {task.task_checklist_progress.filter((item: any) => item.reviewer_comments?.length > 0).map((item: any) => (
                                                                            <div key={item.id} className="p-2.5 rounded-lg bg-red-100/40 dark:bg-red-900/20 border border-red-200/40 dark:border-red-800/20">
                                                                                <p className="text-xs font-semibold text-red-800 dark:text-red-200 mb-1 flex items-center gap-1.5">
                                                                                    <CheckSquare className="h-3 w-3 opacity-70" /> {item.item_text}
                                                                                </p>
                                                                                <div className="space-y-1 pl-4 border-l border-red-300/30 ml-1.5">
                                                                                    {item.reviewer_comments.map((c: any, idx: number) => (
                                                                                        <p key={idx} className="text-[11px] text-red-700/90 dark:text-red-300/80">
                                                                                            <span className="font-bold">{c.reviewer_name}:</span> {c.comment}
                                                                                        </p>
                                                                                    ))}
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Description */}
                                            <div className="rounded-xl border border-border bg-card p-4">
                                                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
                                                    <FileText className="h-3.5 w-3.5" /> Task Brief
                                                </h3>
                                                <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                                                    {task.description || 'No brief provided.'}
                                                </p>
                                            </div>

                                            {/* AI Copywriter will add it later when needed */}
                                            {/* {(task.status === 'IN_PROGRESS' || task.status === 'REJECTED') && !isApproval && (
                                    <div>
                                        {!showAICopy ? (
                                            <Button
                                                variant="outline"
                                                onClick={() => setShowAICopy(true)}
                                                className="w-full h-11 gap-2 border-violet-200 dark:border-violet-800 hover:bg-violet-50 dark:hover:bg-violet-950/30 text-violet-700 dark:text-violet-300 font-medium transition-all"
                                            >
                                                <Sparkles className="h-4 w-4" />
                                                ✨ Create with AI
                                            </Button>
                                        ) : (
                                            <AICopyPanel
                                                taskId={task.id}
                                                companyId={user?.company_id || ''}
                                                onClose={() => setShowAICopy(false)}
                                            />
                                        )}
                                    </div>
                                )} */}

                                            {/* Info grid */}
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                                <div className="rounded-lg border border-border p-3">
                                                    <p className="text-xs text-muted-foreground mb-1">Due Date</p>
                                                    <p className="font-medium">{task.due_date ? new Date(task.due_date).toLocaleString('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : '—'}</p>
                                                </div>
                                                <div className="rounded-lg border border-border p-3">
                                                    <p className="text-xs text-muted-foreground mb-1">Role</p>
                                                    <p className="font-medium capitalize">{task.assigned_role || '—'}</p>
                                                </div>
                                                <div className="rounded-lg border border-border p-3">
                                                    <p className="text-xs text-muted-foreground mb-1">Approval</p>
                                                    <p className="font-medium">{task.approval_required ? `${task.approval_levels} level${task.approval_levels > 1 ? 's' : ''}` : 'Not required'}</p>
                                                </div>
                                                <div className="rounded-lg border border-border p-3">
                                                    <p className="text-xs text-muted-foreground mb-1">Instance</p>
                                                    <p className="font-medium truncate">{task.instance?.name || '—'}</p>
                                                </div>
                                                {task.rejection_count ? (
                                                    <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 p-3">
                                                        <p className="text-xs text-red-600 dark:text-red-400 mb-1">Rejections</p>
                                                        <p className="font-bold text-red-700 dark:text-red-300">{task.rejection_count}</p>
                                                    </div>
                                                ) : null}
                                            </div>

                                            {/* Checklist — interactive for workers, readonly for approvers */}
                                            {checklist.length > 0 && (
                                                <div>
                                                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
                                                        <CheckSquare className="h-3.5 w-3.5" /> Checklist ({checkedCount}/{checklist.length})
                                                    </h3>
                                                    <div className="space-y-2">
                                                        {checklist.map(item => {
                                                            const canToggle = (task.status === 'IN_PROGRESS' || task.status === 'REJECTED') && !isApproval;
                                                            return (
                                                                <div key={item.id} className={`rounded-xl border transition-all ${item.is_checked
                                                                    ? 'bg-green-50/50 border-green-200/50 dark:bg-green-900/10 dark:border-green-800/20'
                                                                    : 'bg-card border-border'
                                                                    }`}>
                                                                    <div
                                                                        className={`flex items-center gap-3 p-3 text-left ${canToggle ? 'cursor-pointer hover:opacity-80' : ''}`}
                                                                    >
                                                                        {item.is_checked
                                                                            ? <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                                                                            : <Square className="h-4 w-4 text-muted-foreground shrink-0" />
                                                                        }
                                                                        <span className={`text-sm ${item.is_checked ? 'text-muted-foreground line-through' : 'text-foreground font-medium'}`}>
                                                                            {item.item_text}
                                                                        </span>
                                                                        {item.requires_input && <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded font-medium ml-auto">Required</span>}
                                                                    </div>
                                                                    {/* Input field area */}
                                                                    {(item.requires_input || item.input_value) && (
                                                                        <div className="px-3 pb-3">
                                                                            <input
                                                                                type="text"
                                                                                className="w-full h-9 rounded-md border border-gray-200 px-3 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                                                                                placeholder={item.input_placeholder || 'Enter value...'}
                                                                                defaultValue={item.input_value || ''}
                                                                                onBlur={e => {
                                                                                    if (canToggle && e.target.value !== (item.input_value || '')) {
                                                                                        toggleChecklistItem(task.id, item.id, item.is_checked, e.target.value);
                                                                                    }
                                                                                }}
                                                                                disabled={!canToggle}
                                                                            />
                                                                            {item.input_label && <p className="text-[10px] text-muted-foreground mt-1">{item.input_label}</p>}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>

                                {/* Footer actions */}
                                <DialogFooter className="mt-4 gap-2">
                                    {(task.status === 'IN_PROGRESS' || task.status === 'REJECTED') && !isApproval && checklist.length < 1 && (
                                        <Button
                                            onClick={() => handleSubmit(task)}
                                            disabled={submitting || !allChecked}
                                            className="shadow-lg shadow-primary/20"
                                        >
                                            <Send className="h-4 w-4 mr-2" />
                                            {task.approval_required ? 'Submit for Approval' : 'Mark Complete'}
                                        </Button>
                                    )}
                                    {isApproval && (
                                        <>
                                            <Button
                                                variant="outline"
                                                className="text-destructive hover:bg-destructive/5 border-destructive/20"
                                                onClick={() => { setSelectedActionTask(task); setRejectModalOpen(true); }}
                                            >
                                                <ThumbsDown className="h-4 w-4 mr-2" /> Reject
                                            </Button>
                                            <Button
                                                className="bg-green-600 hover:bg-green-700 text-white"
                                                onClick={() => { setSelectedActionTask(task); setApproveModalOpen(true); }}
                                            >
                                                <ThumbsUp className="h-4 w-4 mr-2" /> Approve
                                            </Button>
                                        </>
                                    )}
                                    <DialogClose>
                                        <Button variant="outline">Close</Button>
                                    </DialogClose>
                                </DialogFooter>
                            </>
                        );
                    })()}
                </DialogContent>
            </Dialog>



            {/* ── Reject Modal ── */}
            <RejectModal rejectModalOpen={rejectModalOpen} setRejectModalOpen={setRejectModalOpen} comment={comment} setComment={setComment} handleReject={handleReject} submitting={submitting} />


            {/* ── Approve Modal ── */}
            < Dialog open={approveModalOpen} onOpenChange={setApproveModalOpen} >
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Review Task</DialogTitle>
                        <DialogDescription>
                            {selectedActionTask?.current_level && selectedActionTask.approval_levels > 1
                                ? `You are reviewing at Level ${selectedActionTask.current_level} of ${selectedActionTask.approval_levels}.`
                                : 'Review the checklist to approve or reject this task.'}
                        </DialogDescription>
                    </DialogHeader>

                    {/* ── Checklist in Review Modal ── */}
                    {selectedActionTask && (() => {
                        const displayTask = allTasks.find(t => t.id === selectedActionTask.id) || workerTasks.find(t => t.id === selectedActionTask.id) || selectedActionTask;
                        const checklist = displayTask.task_checklist_progress || [];

                        if (checklist.length === 0) return null;

                        return (
                            <div className="space-y-3 py-2 border-y border-border my-2">
                                <div className="flex items-center justify-between">
                                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Review Checklist</p>
                                    {checklist.length > 1 && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 px-2 text-[10px] font-bold uppercase tracking-tight text-primary hover:text-primary hover:bg-primary/5 rounded-lg transition-all"
                                            onClick={() => handleSelectAll(checklist)}
                                        >
                                            {checklist.every((item: any) => localChecked[item.id])
                                                ? 'Deselect All'
                                                : 'Select All'}
                                        </Button>
                                    )}
                                </div>
                                <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                                    {displayTask?.task_checklist_progress?.slice()
                                        .sort((a, b) => a.sort_order - b.sort_order)
                                        .map(item => (
                                            <div key={item.id} className={`rounded-lg border p-3 transition-all ${localChecked[item.id] ? 'bg-green-50/50 border-green-200/50 dark:bg-green-900/10 dark:border-green-800/20' : 'bg-card border-border'}`}>
                                                <div className="flex flex-col gap-2">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <button
                                                            onClick={() => handleLocalToggle(item.id)}
                                                            className="flex items-center gap-3 text-left w-full group"
                                                        >
                                                            {localChecked[item.id]
                                                                ? <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                                                                : <Square className="h-4 w-4 text-muted-foreground shrink-0 group-hover:text-foreground" />
                                                            }
                                                            <span className={`text-sm ${localChecked[item.id] ? 'text-muted-foreground line-through' : 'text-foreground font-medium'}`}>
                                                                {item.item_text}
                                                            </span>
                                                        </button>
                                                        {!item.requires_input ? (
                                                            <span className={`px-2 py-0.5 rounded text-[10px] whitespace-nowrap font-bold ${item.status === 'Done' ? 'bg-green-100 text-green-700' : item.status === 'Not Needed' ? 'bg-gray-100 text-gray-700' : 'bg-amber-100 text-amber-700'}`}>
                                                                {item.status || 'Pending'}
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                    {(item.requires_input || item.input_value) && (
                                                        <div className="text-xs text-muted-foreground bg-muted/50 rounded px-2.5 py-1.5 ml-7">
                                                            {item.input_label && <span className="font-medium">{item.input_label}: </span>}
                                                            {item.input_value
                                                                ? renderInputValue(item.input_value)
                                                                : <span className="italic opacity-50">No value entered</span>
                                                            }
                                                        </div>
                                                    )}
                                                    {/* Add Reviewer Comment Box */}
                                                    <div className="mt-2 ml-7">
                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                type="text"
                                                                placeholder="Add specific feedback for this item (optional)..."
                                                                className="flex-1 h-8 rounded-md border border-gray-200 px-3 text-xs focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
                                                                onBlur={e => {
                                                                    const val = e.target.value.trim();
                                                                    if (val) {
                                                                        const newComments = [...(item.reviewer_comments || []), { reviewer_id: user?.id, reviewer_name: user?.name, comment: val, created_at: new Date().toISOString() }];
                                                                        toggleChecklistItem(selectedActionTask.id, item.id, false, item.input_value, null, newComments);
                                                                        e.target.value = '';
                                                                        addToast({ title: 'Feedback Added', description: 'Item marked as unchecked with your comment.', variant: 'success' });
                                                                    }
                                                                }}
                                                            />
                                                        </div>
                                                        {item.reviewer_comments && item.reviewer_comments.length > 0 && (
                                                            <div className="mt-2 bg-red-50/50 border border-red-100 rounded p-2 text-xs space-y-1 text-red-600">
                                                                <p className="font-bold">Previous Feedback:</p>
                                                                {item.reviewer_comments.map((c: any, idx: number) => (
                                                                    <div key={idx}><span className="font-semibold">{c.reviewer_name}: </span>{c.comment}</div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        )
                    })()}

                    {/* ── Client Approval Toggle (Only on last level) ──  */}
                    {/* Not needed currently as the approvers are clicking on it mistakenly */}
                    {/* {selectedActionTask && selectedActionTask.current_level >= selectedActionTask.approval_levels && (
                                        <div className="mt-2 p-4 rounded-xl border border-amber-200/60 bg-amber-50/30 dark:border-amber-900/30 dark:bg-amber-900/10">
                                            <label className="flex items-start gap-3 cursor-pointer group">
                                                <div className="pt-0.5">
                                                    <input
                                                        type="checkbox"
                                                        className="w-4 h-4 rounded border-border text-amber-500 focus:ring-amber-500/50 cursor-pointer"
                                                        checked={clientApprovalNeeded}
                                                        onChange={(e) => setClientApprovalNeeded(e.target.checked)}
                                                    />
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-sm font-semibold text-foreground group-hover:text-amber-600 transition-colors">Client Approval Needed</p>
                                                    <p className="text-xs text-muted-foreground mt-0.5">Pause this instance after approval to await client feedback.</p>
                                                    {clientApprovalNeeded && (
                                                        <div className="mt-2 text-[11px] font-bold text-amber-700 bg-amber-100/50 dark:bg-amber-900/30 dark:text-amber-400 p-2 rounded flex items-start gap-1.5 border border-amber-200/50 dark:border-amber-800/50">
                                                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                                            <p>Warning: The next task will remain locked until the client approves this deliverable.</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </label>
                                        </div>
                                    )} */}

                    <textarea
                        className="w-full border border-border rounded-lg p-3 text-sm bg-background resize-none h-20"
                        placeholder="Overall review comment (required for rejection)..."
                        value={comment}
                        onChange={e => setComment(e.target.value)}
                    />
                    <DialogFooter>
                        <DialogClose><Button variant="outline">Cancel</Button></DialogClose>
                        <Button
                            variant="destructive"
                            onClick={handleReject}
                            disabled={rejectLoading || submitting || !comment.trim().length || (selectedActionTask?.task_checklist_progress?.some((i: any) => !localChecked[i.id]) ?? false)}
                        >
                            <XCircle className="h-4 w-4 mr-2" /> Reject Task
                        </Button>
                        <Button
                            className="bg-green-600 hover:bg-green-700 text-white"
                            onClick={handleApprove}
                            disabled={submitting || rejectLoading || (selectedActionTask?.task_checklist_progress?.some((i: any) => !localChecked[i.id]) ?? false)}
                        >
                            <CheckCircle2 className="h-4 w-4 mr-2" /> Confirm Approve
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog >
        </>

    )
}