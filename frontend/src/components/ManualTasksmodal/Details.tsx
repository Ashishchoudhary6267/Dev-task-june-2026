import { ManualTask } from '@/lib/types/auth';
import React from 'react'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { CheckCircle2, Clock, Loader2, XCircle } from 'lucide-react';

export default function ViewModal({ task, onClose }: { task: ManualTask | null; onClose: () => void }) {
    const PRIORITY_STYLES: Record<string, string> = {
        low: 'bg-blue-50 text-blue-700 border border-blue-200',
        medium: 'bg-amber-50 text-amber-700 border border-amber-200',
        high: 'bg-red-50 text-red-700 border border-red-200',
    };

    const STATUS_STYLES: Record<string, { cls: string; icon: React.ReactNode; label: string }> = {
        IN_PROGRESS: { cls: 'bg-sky-50 text-sky-700 border border-sky-200', icon: <Loader2 className="h-3 w-3 animate-spin" />, label: 'In Progress' },
        PENDING_APPROVAL: { cls: 'bg-purple-50 text-purple-700 border border-purple-200', icon: <Clock className="h-3 w-3" />, label: 'Pending Approval' },
        COMPLETED: { cls: 'bg-green-50 text-green-700 border border-green-200', icon: <CheckCircle2 className="h-3 w-3" />, label: 'Completed' },
    };
    if (!task) return null;
    const st = STATUS_STYLES[task.status] || STATUS_STYLES.IN_PROGRESS;
    const pr = PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.medium;
    return (
        <Dialog open={!!task} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Task Details</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 py-2 text-sm">
                    <div className=''>
                        <p className="text-xs text-muted-foreground mb-0.5">Title</p>
                        <p className="font-semibold text-base">{task.title}</p>
                    </div>
                    {task.description && (
                        <div>
                            <p className="text-xs text-muted-foreground mb-0.5">Description</p>
                            <p className="text-muted-foreground">{task.description}</p>
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <p className="text-xs text-muted-foreground mb-0.5">Assigned To</p>
                            <p className="font-medium">{task.assigned_user?.name || '—'}</p>
                            <p className="text-xs text-muted-foreground">{task.assigned_user?.email}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground mb-0.5">Status</p>
                            <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${st.cls}`}>
                                {st.icon}{st.label}
                            </span>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground mb-0.5">Priority</p>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${pr}`}>
                                {task.priority}
                            </span>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground mb-0.5">Due Date</p>
                            <p className="font-medium">{task.due_date ? new Date(task.due_date).toLocaleDateString('en-IN') : '—'}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground mb-0.5">Est. Duration</p>
                            <p className="font-medium">{task.estimated_minutes} min</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground mb-0.5">Turnaround</p>
                            <p className="font-medium">{task.turnaround_minutes ? `${Math.round(task.turnaround_minutes / 60)} hrs` : '—'}</p>
                        </div>
                    </div>
                    {task.approval_required && task.task_approval_levels && task.task_approval_levels.length > 0 && (
                        <div>
                            <p className="text-xs text-muted-foreground mb-1.5">Approval Levels</p>
                            <div className="space-y-1.5">
                                {task.task_approval_levels.sort((a, b) => a.level_number - b.level_number).map(al => (
                                    <div key={al.id} className="flex items-center gap-2">
                                        <span className="h-6 w-8 rounded bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">L{al.level_number}</span>
                                        <span className="font-medium">{al.approver?.name || '—'}</span>
                                        <span className={`ml-auto text-xs px-1.5 py-0.5 rounded ${al.status === 'APPROVED' ? 'bg-green-100 text-green-700' : al.status === 'REJECTED' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                                            {al.status}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}



export function RejectModal({ rejectModalOpen, setRejectModalOpen, comment, setComment, handleReject, submitting }: { rejectModalOpen: boolean; setRejectModalOpen: (open: boolean) => void; comment: string; setComment: (comment: string) => void; handleReject: () => void; submitting: boolean }) {
    return (
        <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Reject Task</DialogTitle>
                    <DialogDescription>Add a comment explaining why this is being returned to the worker.</DialogDescription>
                </DialogHeader>
                <textarea
                    className="w-full border border-border rounded-lg p-3 text-sm bg-background resize-none h-24"
                    placeholder="Reason for rejection (optional)…"
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                />

                <div className="text-sm text-muted-foreground pb-2">
                    {comment.length < 20 && (
                        <p className="text-red-500">At least 20 characters required.</p>
                    )}
                  
                </div>
                <DialogFooter>
                    <DialogClose><Button variant="outline" disabled={submitting}>Cancel</Button></DialogClose>
                    <Button variant="destructive" onClick={handleReject} disabled={submitting || comment.trim() === '' || comment.length < 20}>
                        <XCircle className="h-4 w-4 mr-2" /> Confirm Reject
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
