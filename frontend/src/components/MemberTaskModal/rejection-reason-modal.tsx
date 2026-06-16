import React, { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { CheckCircle2, Square } from 'lucide-react';
import { Textarea, useToast } from '../ui';
import { Task } from '@/lib/types/auth';
import { useTaskStore } from '@/lib/zustand/tasks/tasks';


//rejection reason modal for member
export default function RejectionReasonModal({ rejectionTask, setRejectionTask, setSelectedActionTask, setShowSubmitBox, setLocalChecked }: { rejectionTask: any, setRejectionTask: (task: any) => void, setSelectedActionTask: (task: any) => void, setShowSubmitBox: (show: boolean) => void, setLocalChecked: (checked: Record<string, boolean>) => void }) {
    return (
        <div>  {/* ── Rejection Reason Modal ── */}
            <Dialog open={!!rejectionTask} onOpenChange={() => setRejectionTask(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600">
                            <span className="text-lg">↩️</span> Task Rejected
                        </DialogTitle>
                        <DialogDescription>
                            This task was returned to you with feedback. Please review the reason below and resubmit.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3 py-1">
                        {/* Task title */}
                        <div className="rounded-lg bg-muted/40 border border-border px-3 py-2 text-sm font-medium">
                            {rejectionTask?.title}
                        </div>

                        {/* Rejected by + when */}
                        <div className="grid grid-cols-2 gap-3 text-sm">
                            {/* <div>
                                <p className="text-xs text-muted-foreground mb-0.5">Rejected by</p>
                                <p className="font-medium">{(rejectionTask as any)?.last_rejector?.name || 'Approver'}</p>
                            </div> */}
                            <div>
                                <p className="text-xs text-muted-foreground mb-0.5">Rejected at</p>
                                <p className="font-medium">
                                    {rejectionTask?.last_rejected_at
                                        ? new Date(rejectionTask.last_rejected_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
                                        : '—'}
                                </p>
                            </div>
                        </div>

                        {/* Rejection comment */}
                        <div>
                            <p className="text-xs text-muted-foreground mb-1">Reason / Comment</p>
                            <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 px-3 py-2.5 text-sm text-red-800 dark:text-red-200 min-h-[48px]">
                                {rejectionTask?.last_rejection_comment
                                    ? rejectionTask.last_rejection_comment
                                    : <span className="italic text-red-400">No comment provided.</span>}
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <DialogClose><Button variant="outline">Close</Button></DialogClose>
                        <Button
                            className="bg-primary"
                            onClick={() => {
                                setSelectedActionTask(rejectionTask);
                                setLocalChecked({});
                                setShowSubmitBox(true);
                                setRejectionTask(null);
                            }}
                        >
                            Resubmit Task
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog></div>
    )
}


{/* ── Submit Modal ── */ }
// export function SubmitModal({ rejectionTask, setRejectionTask, setSelectedActionTask, setShowSubmitBox, setLocalChecked,
//     showSubmitBox, selectedActionTask, localChecked }: { rejectionTask: any, setRejectionTask: (task: any) => void, setSelectedActionTask: (task: any) => void, setShowSubmitBox: (show: boolean) => void, setLocalChecked: (checked: Record<string, boolean>) => void, showSubmitBox: boolean, selectedActionTask: any, localChecked: Record<string, boolean> }) {
//     const handleLocalToggle = (itemId: string) => {
//         setLocalChecked((prev: any) => ({ ...prev, [itemId]: !prev[itemId] }));
//     };
//     const [links, setLinks] = useState('');
//     const [submitting, setSubmitting] = useState(false);
//     const [comment, setComment] = useState('');
//     const {
//         workerTasks, approvalTasks, completedTasks,
//         pendingApprovalTasks, upcomingTasks,
//         fetchMyTasks, submitTask, approveTask, rejectTask,
//         toggleChecklistItem, loading,
//     } = useTaskStore();
//     const { addToast } = useToast();

//     const handleSubmit = async (task: Task) => {
//         const items = task.task_checklist_progress || [];


//         if (items.length > 0 && !items.every(i => localChecked[i.id] === true)) {
//             addToast({ title: 'Checklist incomplete', description: 'Please complete all checklist items first.', variant: 'destructive' });
//             return;
//         }
//         setSubmitting(true);
//         const ok = await submitTask(task.id, links)
//         // await toggleChecklistItem(task.id, items[0].id, true);
//         setSubmitting(false);
//         setShowSubmitBox(false);
//         if (ok) {
//             addToast({
//                 title: task.approval_required ? 'Submitted for Approval ✅' : 'Task Completed! ✅',
//                 description: task.approval_required ? 'Waiting for approver.' : 'Task marked as complete.',
//                 variant: 'success',
//             });
//             setSelectedActionTask(null);
//             setComment('');
//         } else {
//             addToast({ title: 'Error', description: 'Could not submit task.', variant: 'destructive' });
//         }
//     };

//     return (
//         <div>
//             <Dialog open={showSubmitBox} onOpenChange={setShowSubmitBox}>
//                 <DialogContent className="sm:max-w-md">
//                     <DialogHeader>
//                         <DialogTitle>Submit Task</DialogTitle>
//                         <DialogDescription>
//                             {selectedActionTask?.current_level && selectedActionTask.approval_levels > 1
//                                 ? `You are submitting at Level ${selectedActionTask.current_level} of ${selectedActionTask.approval_levels}.`
//                                 : 'Confirm your submission of this task.'}
//                         </DialogDescription>
//                     </DialogHeader>

//                     {/* ── Checklist in Submit Modal ── */}
//                     {selectedActionTask?.task_checklist_progress && selectedActionTask.task_checklist_progress.length > 0 && (
//                         <div className="space-y-3 py-2 border-y border-border my-2">
//                             <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Completion Checklist</p>
//                             <div className="space-y-2">
//                                 {selectedActionTask.task_checklist_progress.map((item: any) => (
//                                     <button
//                                         key={item.id}
//                                         onClick={() => handleLocalToggle(item.id)}
//                                         className={`flex items-center gap-3 w-full p-2.5 rounded-lg border transition-all text-left ${localChecked[item.id]
//                                             ? 'bg-green-50/50 border-green-200/50 dark:bg-green-900/10 dark:border-green-800/20'
//                                             : 'bg-card border-border hover:border-primary/30'
//                                             }`}
//                                     >
//                                         {localChecked[item.id]
//                                             ? <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
//                                             : <Square className="h-4 w-4 text-muted-foreground shrink-0" />
//                                         }
//                                         <span className={`text-sm ${localChecked[item.id] ? 'text-muted-foreground line-through' : 'text-foreground font-medium'}`}>
//                                             {item.item_text}
//                                         </span>
//                                     </button>
//                                 ))}
//                             </div>
//                         </div>
//                     )}
//                     <div className="py-2">
//                         <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Deliverable links (optional)</p>
//                         <Textarea
//                             className="w-full border border-border rounded-lg p-3 text-sm bg-background resize-none h-20"
//                             placeholder="Paste google drive links, figma or any other deliverable links here (optional)…"
//                             value={links}
//                             onChange={e => setLinks(e.target.value)}
//                         />
//                         <DialogFooter className='py-2'>
//                             <DialogClose><Button variant="outline">Cancel</Button></DialogClose>
//                             <Button
//                                 className="bg-green-600 hover:bg-green-700 text-white"
//                                 onClick={() => handleSubmit(selectedActionTask!)}
//                                 disabled={submitting || (selectedActionTask?.task_checklist_progress?.some((i: any) => !localChecked[i.id]) ?? false)}
//                             >
//                                 <CheckCircle2 className="h-4 w-4 mr-2" /> Confirm Submit
//                             </Button>
//                         </DialogFooter>

//                     </div>
//                 </DialogContent>

//             </Dialog>
//         </div>
//     )
// }



