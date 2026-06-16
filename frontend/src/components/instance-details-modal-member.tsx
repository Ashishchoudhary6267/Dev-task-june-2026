'use client';
import React, { useEffect, useState } from 'react';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
    DialogDescription, DialogFooter, DialogClose,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge, Input, Label, Select, useToast } from '@/components/ui';
import api from '@/lib/api';
import { CheckCircle2, Circle, Clock, ChevronDown, ChevronUp, MessageSquare, Eye, FileWarning, User, CalendarClock } from 'lucide-react';
import { useUserStore } from '@/lib/zustand/user/addUser';
import { ApprovalLevel, LiveTask } from '@/lib/types/auth';
import { useAuthStore } from '@/lib/zustand/user/user';


interface InstanceModalProps {
    task: any;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    LOCKED: { label: 'not_started', color: 'text-muted-foreground', bg: 'bg-muted' },
    IN_PROGRESS: { label: 'in_progress', color: 'text-blue-700 dark:text-blue-300', bg: 'bg-blue-100 dark:bg-blue-900/30' },
    PENDING_APPROVAL: { label: 'pending_approval', color: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-100 dark:bg-amber-900/30' },
    COMPLETED: { label: 'completed', color: 'text-green-700 dark:text-green-300', bg: 'bg-green-100 dark:bg-green-900/30' },
    REJECTED: { label: 'rejected', color: 'text-red-700 dark:text-red-300', bg: 'bg-red-100 dark:bg-red-900/30' },
};

function ApproverBadge({ level, al }: { level: number; al?: ApprovalLevel }) {
    if (!al) return null;
    const approved = al?.status === 'APPROVED';
    return (
        <div className="flex items-center gap-1 text-xs">
            <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-[10px]">
                L{level}
            </span>
            <span className={approved ? 'text-green-600 dark:text-green-400' : 'text-foreground'}>
                {al.approver?.name || 'Unassigned'}
            </span>
            {approved && <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
        </div>
    );
}

const InstanceMemberModal = ({ task, open, onOpenChange }: InstanceModalProps) => {
    const [tasks, setTasks] = useState<LiveTask[]>([]);
    const [loading, setLoading] = useState(false);
    const [detailedTask, setDetailedTask] = useState<LiveTask | null>(null);
    const [selectedTask, setSelectedTask] = useState<any>(null);
    const [isExtendSlaOpen, setIsExtendSlaOpen] = useState(false);
    const [reason, setReason] = useState('');
    const { addToast } = useToast();
    const [commentTask, setCommentTask] = useState<LiveTask | null>(null);
    const [comment, setComment] = useState("");
    const [showCommentBox, setShowCommentBox] = useState(false);
    const { user } = useAuthStore();
    const { users, fetchUsers, usercount, loading: usersLoading } = useUserStore();
    useEffect(() => {
        if (open && task?.id) {
            setLoading(true);
            api.get(`/instances/tasks/${task.id}`)
                .then(res => { setTasks(res.data.tasks || []); })
                .catch(() => { })
                .finally(() => setLoading(false));
        }
    }, [open, task?.id]);

    console.log("tasks", tasks);


    if (!task) return null;
    const filteredCopywriters = users.filter((u: any) => u.workflow_role === 'copywriter');
    const totalTasks = tasks?.length;
    const completedCount = tasks?.filter(t => t?.status === 'COMPLETED').length;
    const progressPct = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;
    const currentTaskOrder = tasks?.find(t => t?.status === 'IN_PROGRESS' || t?.status === 'PENDING_APPROVAL')?.task_order ?? null;

    const { total, completed } = task.task_stats || { total: 0, completed: 0 };
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    console.log("percentage", pct);


    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto custom-scrollbar">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-semibold">Workflow Progress</DialogTitle>
                        <DialogDescription>
                            {task?.name} · {task.project?.name}
                        </DialogDescription>
                    </DialogHeader>

                    {/* Status + Progress */}
                    <div className="space-y-3 mt-2">
                        <div className="flex items-center gap-3">
                            <span className="text-sm text-muted-foreground">Status:</span>
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${task?.status === 'COMPLETED'
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                : 'bg-gray-800 text-white dark:bg-gray-800/80 dark:text-gray-100'
                                }`}>
                                {/* {instance?.status === 'COMPLETED' ? 'Completed' : 'In Progress'} */}
                                {task?.status}
                            </span>
                        </div>

                        <div>
                            <p className="text-sm font-semibold mb-1.5">Overall Completion</p>
                            <div className="w-full bg-muted rounded-full h-2.5">
                                <div
                                    className="h-2.5 rounded-full bg-amber-500 transition-all duration-500"
                                    style={{ width: `${pct}%` }}
                                />
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                {completedCount} of {totalTasks} tasks completed
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                                Completion: {pct}%
                            </p>
                        </div>
                    </div>

                    {/* Task Table */}
                    {loading ? (
                        <div className="text-center py-8 text-muted-foreground text-sm">Loading tasks…</div>
                    ) : tasks?.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground text-sm">No tasks found.</div>
                    ) : (
                        <div className="mt-4 rounded-xl border border-border overflow-hidden overflow-x-auto custom-scrollbar h-[300px] overflow-y-auto">
                            {/* Header */}
                            <table className="w-full text-sm border-collapse ">
                                {/* Header */}
                                <thead>
                                    <tr className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide bg-muted/50">
                                        <th className="px-4 py-2 text-left">Task</th>
                                        <th className="px-4 py-2 text-left">Assigned To</th>
                                        {/* <th className="px-4 py-2 text-left">Approvers</th> */}
                                        <th className="px-4 py-2 text-left">Status</th>
                                        <th className="px-4 py-2 text-left">Due Date</th>
                                        <th className="px-4 py-2 text-left">Checklist</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {tasks?.map(task => {
                                        const cfg = STATUS_CONFIG[task?.status] || STATUS_CONFIG.LOCKED;
                                        const isCurrent = task?.status === 'IN_PROGRESS' || task?.status === 'PENDING_APPROVAL';
                                        const checkedCount = (task?.task_checklist_progress || []).filter(i => i.is_checked).length;
                                        const totalChecklist = (task.task_checklist_progress || []).length;

                                        return (
                                            <React.Fragment key={task.id}>
                                                {/* Main Row */}
                                                <tr
                                                    className={`border-t border-border cursor-pointer hover:bg-muted/20 
${isCurrent
                                                            ? 'bg-blue-50/50 dark:bg-blue-900/10 border-l-4 border-blue-500'
                                                            : task.assigned_user_id === user?.id
                                                                ? 'bg-green-50 dark:bg-green-900/10 border-l-4 border-green-500'
                                                                : 'bg-card'
                                                        }`}
                                                    onClick={() => setDetailedTask(task)}
                                                >
                                                    {/* Task */}
                                                    <td className="px-4 py-3 align-top">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <div className='flex gap-2 items-center'>
                                                                {task?.status === 'COMPLETED'
                                                                    ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                                                                    : <Circle className={`h-4 w-4 ${isCurrent ? 'text-blue-500' : 'text-muted-foreground/30'}`} />
                                                                }
                                                                <span className="font-medium">{task?.title}</span>
                                                            </div>
                                                            {task.assigned_user_id === user?.id && (
                                                                <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded">
                                                                    Assigned to you
                                                                </span>
                                                            )}
                                                            {isCurrent && (
                                                                <span className="text-[10px] font-bold bg-zinc-600 text-white dark:bg-zinc-700 px-1.5 py-0.5 rounded-full">
                                                                    → Current
                                                                </span>
                                                            )}

                                                            {task.approval_required && (
                                                                <span className="text-[10px] border border-border rounded px-1.5 py-0.5 text-muted-foreground">
                                                                    Requires Approval
                                                                </span>
                                                            )}
                                                        </div>

                                                        <p className="text-xs text-muted-foreground mt-1">
                                                            Step {task.task_order} of {totalTasks}
                                                            {task.status === 'PENDING_APPROVAL' && (
                                                                <span className="text-amber-500 ml-1">· Awaiting approval</span>
                                                            )}
                                                        </p>
                                                    </td>

                                                    {/* Assigned */}
                                                    <td className="px-4 py-3 align-top text-muted-foreground">
                                                        {task.assigned_user?.name || '—'}
                                                    </td>

                                                    {/* Approvers */}
                                                    {/* <td className="px-4 py-3 align-top">
                                                    {task.approval_required && (task.task_approval_levels || []).length > 0
                                                        ? task?.task_approval_levels
                                                            ?.sort((a, b) => a.level_number - b.level_number)
                                                            ?.map(al => (
                                                                <ApproverBadge key={al.id} level={al.level_number} al={al} />
                                                            ))
                                                        : <span className="text-xs text-muted-foreground/50">—</span>
                                                    }
                                                </td> */}

                                                    {/* Status */}
                                                    <td className="px-4 py-3 align-top">
                                                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${cfg.bg} ${cfg.color}`}>
                                                            {cfg.label}
                                                        </span>
                                                    </td>

                                                    {/* Due Date */}
                                                    <td className="px-4 py-3 align-top text-xs text-muted-foreground">
                                                        {task.due_date
                                                            ? new Date(task.due_date).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
                                                            : '—'}
                                                    </td>

                                                    {/* Checklist */}
                                                    <td className="px-4 py-3 align-top text-xs text-muted-foreground">
                                                        {totalChecklist > 0 ? `${checkedCount}/${totalChecklist}` : '—'}
                                                    </td>


                                                </tr>

                                                <Dialog open={!!commentTask} onOpenChange={() => setCommentTask(null)}>
                                                    <DialogContent className="sm:max-w-lg">
                                                        <DialogHeader>
                                                            <DialogTitle>Approval Comments</DialogTitle>
                                                            <DialogDescription>
                                                                {commentTask?.title}
                                                            </DialogDescription>
                                                        </DialogHeader>

                                                        <div className="space-y-3 mt-4 max-h-[400px] overflow-y-auto">
                                                            {(() => {
                                                                const history = (commentTask?.task_approval_history || [])
                                                                    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
                                                                const rejectionCount = history.filter(h => h.action === 'REJECTED').length;

                                                                if (history.length === 0) {
                                                                    return (
                                                                        <p className="text-sm text-muted-foreground text-center py-4">
                                                                            No approval/rejection history yet.
                                                                        </p>
                                                                    );
                                                                }

                                                                return (
                                                                    <>
                                                                        {/* Summary bar */}
                                                                        {/* <div className="flex items-center gap-3 text-xs mb-3 px-1">
                                                                        <span className="text-muted-foreground">
                                                                            Total actions: <strong>{history.length}</strong>
                                                                        </span>
                                                                        {rejectionCount > 0 && (
                                                                            <span className="text-red-600 font-medium">
                                                                                ⚠ {rejectionCount} rejection{rejectionCount > 1 ? 's' : ''}
                                                                            </span>
                                                                        )}
                                                                    </div> */}

                                                                        {/* Timeline */}
                                                                        {/* {history.map((entry, idx) => (
                                                                        <div
                                                                            key={entry.id}
                                                                            className={`p-3 rounded-lg border ${entry.action === 'REJECTED'
                                                                                ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
                                                                                : 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
                                                                                }`}
                                                                        >
                                                                            <div className="flex items-center justify-between text-xs mb-1.5">
                                                                                <div className="flex items-center gap-2">
                                                                                    <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold ${entry.action === 'REJECTED'
                                                                                        ? 'bg-red-100 text-red-700 dark:bg-red-800 dark:text-red-200'
                                                                                        : 'bg-green-100 text-green-700 dark:bg-green-800 dark:text-green-200'
                                                                                        }`}>
                                                                                        {entry.action}
                                                                                    </span>
                                                                                    <span className="font-semibold text-foreground">
                                                                                        {entry.actor?.name || 'Unknown'}
                                                                                    </span>
                                                                                    <span className="text-muted-foreground">
                                                                                        · Level {entry.level_number}
                                                                                    </span>
                                                                                </div>
                                                                                <span className="text-muted-foreground">
                                                                                    #{idx + 1} · {new Date(entry.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                                                                                </span>
                                                                            </div>
                                                                            {entry.comment ? (
                                                                                <p className="text-sm text-foreground">{entry.comment}</p>
                                                                            ) : (
                                                                                <p className="text-sm text-muted-foreground italic">No comment provided</p>
                                                                            )}
                                                                        </div>
                                                                    ))} */}
                                                                    </>
                                                                );
                                                            })()}

                                                            {/* {showCommentBox && (
                                                            <div className="mt-4 p-4 border border-border rounded-lg bg-muted/30">
                                                                <div className="space-y-4">

                                                                    <Input
                                                                        placeholder="Write your comment..."
                                                                        value={comment}
                                                                        onChange={(e) => setComment(e.target.value)}
                                                                    />

                                                                    <div className="flex justify-end gap-3">
                                                                        <Button
                                                                            variant="ghost"
                                                                            onClick={() => {
                                                                                setShowCommentBox(false);
                                                                                setComment("");
                                                                            }}
                                                                        >
                                                                            Cancel
                                                                        </Button>

                                                                        <Button
                                                                            onClick={() => {
                                                                                // future save logic
                                                                                setShowCommentBox(false);
                                                                            }}
                                                                            disabled={!comment.trim()}
                                                                        >
                                                                            Save
                                                                        </Button>
                                                                    </div>

                                                                </div>
                                                            </div>
                                                        )} */}
                                                        </div>

                                                        <DialogFooter className='pt-4'>
                                                            {!showCommentBox && (
                                                                <Button variant="outline" onClick={() => setShowCommentBox(true)}>
                                                                    Add a comment
                                                                </Button>
                                                            )}
                                                            <Button variant="outline" onClick={() => setCommentTask(null)}>
                                                                Close
                                                            </Button>
                                                        </DialogFooter>
                                                    </DialogContent>
                                                </Dialog>

                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}



                    {/* Task Details Dialog */}
                    <Dialog open={!!detailedTask} onOpenChange={(open) => { if (!open) setDetailedTask(null); }}>
                        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto custom-scrollbar">
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2 text-lg">
                                    <span className="font-semibold">{detailedTask?.title}</span>
                                    {detailedTask?.status === 'COMPLETED' && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                                </DialogTitle>
                                <DialogDescription className="text-base mt-2">
                                    {detailedTask?.description || 'No description provided for this task.'}
                                </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-6 pt-4">
                                {detailedTask && (detailedTask.task_checklist_progress || []).length > 0 && (
                                    <div className="space-y-3">
                                        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest border-b pb-2">
                                            Checklist
                                        </h4>
                                        <div className="space-y-2 pt-1">
                                            {(detailedTask.task_checklist_progress || []).map((item: any) => (
                                                <div key={item.id} className={`rounded-lg border p-3 transition-all ${item.is_checked ? 'bg-green-50/50 border-green-200/50 dark:bg-green-900/10 dark:border-green-800/20' : 'bg-card border-border'}`}>
                                                    <div className="flex flex-col gap-2">
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="flex items-center gap-3">
                                                                {item.is_checked
                                                                    ? <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                                                                    : <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                                                                }
                                                                <span className={`text-sm ${item.is_checked ? 'text-muted-foreground line-through' : 'text-foreground font-medium'}`}>
                                                                    {item.item_text}
                                                                </span>
                                                            </div>
                                                            {!item.requires_input ? (
                                                                <span className={`px-2 py-0.5 rounded text-[10px] whitespace-nowrap font-bold ${item.status === 'Done' ? 'bg-green-100 text-green-700' : item.status === 'Not Needed' ? 'bg-gray-100 text-gray-700' : 'bg-amber-100 text-amber-700'}`}>
                                                                    {item.status || 'Pending'}
                                                                </span>
                                                            ) : null}
                                                        </div>
                                                        {(item.requires_input || item.input_value) && (
                                                            <div className="text-xs text-muted-foreground bg-muted/50 rounded px-2.5 py-1.5 ml-7">
                                                                {item.input_label && <span className="font-medium">{item.input_label}: </span>}
                                                                {item.input_value || <span className="italic opacity-50">No value entered</span>}
                                                            </div>
                                                        )}
                                                        {item.reviewer_comments && item.reviewer_comments.length > 0 && (
                                                            <div className="mt-1 ml-7 bg-red-50/50 border border-red-100 rounded p-2 text-xs space-y-1 text-red-600">
                                                                <p className="font-bold">Reviewer Feedback:</p>
                                                                {item.reviewer_comments.map((c: any, idx: number) => (
                                                                    <div key={idx}><span className="font-semibold">{c.reviewer_name}: </span>{c.comment}  ({new Date(c.created_at).toLocaleString()})</div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Controller Actions History */}
                                {detailedTask && (() => {
                                    const bypassEvents = (detailedTask.task_bypass_logs || []).map((b: any) => ({ ...b, _type: 'bypass' }));
                                    const reassignEvents = (detailedTask.task_reassignments || []).map((r: any) => ({ ...r, _type: 'reassign' }));
                                    const slaEvents = (detailedTask.task_sla_extensions || []).map((s: any) => ({ ...s, _type: 'sla_extend' }));
                                    const history = [...bypassEvents, ...reassignEvents, ...slaEvents].sort(
                                        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime() // Sort newest first
                                    );
                                    if (history.length === 0) return null;
                                    return (
                                        <div className="space-y-3 mt-6">
                                            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest border-b pb-2">
                                                Controller Actions History
                                            </h4>
                                            <div className="space-y-3 pt-2">
                                                {history.map((entry: any) => (
                                                    <div
                                                        key={entry.id}
                                                        className={`p-4 rounded-lg border text-sm ${entry._type === 'bypass'
                                                            ? 'bg-orange-50/50 border-orange-200 dark:bg-orange-900/10 dark:border-orange-800'
                                                            : entry._type === 'reassign' ? 'bg-blue-50/50 border-blue-200 dark:bg-blue-900/10 dark:border-blue-800'
                                                                : 'bg-purple-50/50 border-purple-200 dark:bg-purple-900/10 dark:border-purple-800'
                                                            }`}
                                                    >
                                                        <div className="flex items-start justify-between mb-3">
                                                            <div className="flex flex-col gap-1.5">
                                                                <div className="flex items-center gap-2">
                                                                    {entry._type === 'bypass' && (
                                                                        <span className="font-bold px-2 py-0.5 rounded text-xs bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
                                                                            ⚡ {entry.action || 'BYPASS'}
                                                                        </span>
                                                                    )}
                                                                    {entry._type === 'reassign' && (
                                                                        <span className="font-bold px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                                                                            🔁 REASSIGNED
                                                                        </span>
                                                                    )}
                                                                    {entry._type === 'sla_extend' && (
                                                                        <span className="font-bold px-2 py-0.5 rounded text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                                                                            📅 SLA EXTENDED
                                                                        </span>
                                                                    )}
                                                                    <span className="text-muted-foreground text-xs">
                                                                        by <strong className="text-foreground">{entry._type === 'bypass' ? entry.performer?.name : entry._type === 'reassign' ? entry.reassigner?.name : entry.requester?.name}</strong>
                                                                    </span>
                                                                </div>
                                                                {entry._type === 'bypass' && (
                                                                    <p className="text-muted-foreground text-xs">Step {entry.from_step} → {entry.to_step}</p>
                                                                )}
                                                                {entry._type === 'reassign' && (
                                                                    <p className="text-muted-foreground text-xs">
                                                                        {entry.from_user?.name || '?'} → {entry.to_user?.name || '?'}
                                                                    </p>
                                                                )}
                                                                {entry._type === 'sla_extend' && (
                                                                    <p className="text-muted-foreground text-xs">
                                                                        Deadline: {new Date(entry.old_deadline).toLocaleDateString()} → {new Date(entry.new_deadline).toLocaleDateString()}
                                                                    </p>
                                                                )}
                                                            </div>
                                                            <span className="text-muted-foreground text-[11px] bg-background/50 px-2 py-1 rounded">
                                                                {new Date(entry.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                                                            </span>
                                                        </div>
                                                        <div className="bg-background/80 p-3 rounded-md border border-border/50 text-foreground/90 italic text-sm shadow-sm">
                                                            "{entry.reason}"
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>

                            <DialogFooter className="mt-6">
                                <Button variant="outline" onClick={() => setDetailedTask(null)}>Close</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    <DialogFooter className="mt-4">
                        <DialogClose>
                            <Button variant="outline">Close</Button>
                        </DialogClose>
                    </DialogFooter>
                </DialogContent >

            </Dialog >
        </>
    );
};

export default InstanceMemberModal;