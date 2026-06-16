import React, { useState } from 'react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogClose,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { UserSelect } from "@/components/ui/user-select";
import { UISelect, useToast } from '../ui';
import api from '@/lib/api';
import { FastForward, Zap } from 'lucide-react';
export default function ReassignDialog({ isReassignTaskOpen, setReassignTaskOpen, selectedTask, setSelectedTask, onSuccess }: any) {

    const [assignReviewerId, setAssignReviewerId] = useState("");
    const [reason, setReason] = useState("");
    const [applyReassignToAll, setApplyReassignToAll] = useState(false);
    const { addToast } = useToast();
    const [isReassigning, setIsReassigning] = useState(false);

    const handleReassignTask = async (
        taskId: any,
        assignReviewerId: any,
        reason: any,
    ) => {
        if (!assignReviewerId) {
            addToast({
                title: "Error",
                description: "Please select a reviewer.",
                variant: "destructive",
            });
            return;
        }
        if (!reason) {
            addToast({
                title: "Error",
                description: "Please enter a reason.",
                variant: "destructive",
            });
            return;
        }

        setIsReassigning(true);
        try {
            const res = await api.post(`/tasks/${taskId}/reassign`, {
                assignee_id: assignReviewerId,
                reason,
                applyToAll: applyReassignToAll,
            });
            if (res.status === 200) {
                addToast({
                    title: "Success",
                    description: "Task reassigned successfully.",
                    variant: "success",
                });
                setReassignTaskOpen(false);
                setReason("");
                setAssignReviewerId("");
                setApplyReassignToAll(false);
                onSuccess();
            }
        } catch (err: any) {
            addToast({
                title: "Error",
                description: err.response?.data?.message || "Failed to reassign task.",
                variant: "destructive",
            });
        } finally {
            setIsReassigning(false);
        }
    };
    return (

        <Dialog open={isReassignTaskOpen} onOpenChange={setReassignTaskOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="font-semibold">Assign Task</DialogTitle>
                    <DialogDescription>
                        Assign this task to another member.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-2">
                    <div>
                        <Label>
                            Currently Assigned to: {selectedTask?.assigned_user?.name}
                        </Label>
                    </div>
                    <Label className="text-xs font-semibold uppercase text-muted-foreground">
                        Assign to Copywriter
                    </Label>
                    <UserSelect
                        value={assignReviewerId}
                        onChange={(val) => setAssignReviewerId(val)}
                        className="w-full"
                        placeholder="— Select Copywriter —"
                        excludeIds={
                            selectedTask?.assigned_user_id
                                ? [selectedTask.assigned_user_id]
                                : []
                        }
                    />
                </div>

                <div className="space-y-2 pt-4">
                    <Label htmlFor="assign-reason">Reason</Label>
                    <Input
                        id="assign-reason"
                        placeholder="Enter reason for assignment"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        required
                    />
                </div>

                <div className="flex items-start gap-3 pt-3 border-t border-border">
                    <div className="mt-1 flex items-center justify-center">
                        <input
                            type="checkbox"
                            id="applyReassignToAll"
                            checked={applyReassignToAll}
                            onChange={(e) => setApplyReassignToAll(e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                    </div>
                    <div className="space-y-1">
                        <Label
                            htmlFor="applyReassignToAll"
                            className="text-sm font-medium leading-none cursor-pointer"
                        >
                            Apply to all active instances
                        </Label>
                        <p className="text-xs text-muted-foreground">
                            Apply this reassignment to all unfinished instances of this
                            project.
                        </p>
                    </div>
                </div>

                <div className="flex justify-end gap-2 p-2">
                    <DialogFooter>
                        <DialogClose>
                            <Button variant="outline">Cancel</Button>
                        </DialogClose>
                        <Button
                            onClick={() =>
                                handleReassignTask(
                                    selectedTask?.id,
                                    assignReviewerId,
                                    reason,
                                )
                            }
                            disabled={!assignReviewerId || !reason || isReassigning}
                        >
                            {isReassigning ? "Assigning..." : "Assign"}
                        </Button>
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>

    )
}


export function BypassModal({
    isBypassTaskOpen,
    setBypassTaskOpen,
    selectedTask,
    onSuccess,
}: any) {
    const [bypassAction, setBypassAction] = useState("");
    const [reason, setReason] = useState("");
    const { addToast } = useToast();
    const [isBypassing, setIsBypassing] = useState(false);

    const handleBypassTask = async (taskId: any, action: any, reason: any) => {
        try {
            setIsBypassing(true);
            await api.post(`/tasks/${taskId}/bypass`, { action, reason });
            addToast({ title: "Success", description: "Task bypassed successfully" });
            setReason("");
            setBypassAction("");
            setBypassTaskOpen(false);
            onSuccess();
        } catch (err) {
            addToast({ title: "Error", description: "Failed to bypass task" });
        } finally {
            setIsBypassing(false);
        }
    };
    return (
        <Dialog open={isBypassTaskOpen} onOpenChange={setBypassTaskOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="text-red-600 font-bold">
                        Emergency Task Bypass
                    </DialogTitle>
                    <DialogDescription>
                        Emergency action for "{selectedTask?.title}"
                    </DialogDescription>
                    <DialogDescription>
                        Are you sure you want to proceed? This action cannot be
                        undone.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-muted-foreground">
                        Bypass Action *
                    </Label>
                    <UISelect
                        value={bypassAction}
                        onValueChange={(val) => setBypassAction(val)}
                        className="w-full"
                        placeholder="— Select action —"
                        options={[
                            { value: "skip", label: "Skip Task", icon: FastForward },
                            {
                                value: "force_complete",
                                label: "Force Complete",
                                icon: Zap,
                            },
                        ]}
                    />
                </div>

                <div className="pt-4 space-y-2">
                    <Label htmlFor="bypass-reason">Reason *</Label>
                    <Input
                        id="bypass-reason"
                        placeholder="Enter reason for bypass"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                    />
                </div>

                <div className="flex items-start gap-3 p-4 rounded-lg border border-red-500/30 bg-red-500/10 mt-2">
                    <span className="text-red-600 text-lg">⚠️</span>
                    <DialogDescription className="text-red-700 font-medium">
                        Warning: This is an emergency action that should be used
                        sparingly. The bypass will be permanently logged in the audit
                        trail with full accountability.
                    </DialogDescription>
                </div>

                <DialogFooter>
                    <div className="p-2 flex gap-2">
                        <DialogClose>
                            <Button variant="outline">Cancel</Button>
                        </DialogClose>
                        <Button
                            variant="destructive"
                            disabled={!bypassAction || !reason || isBypassing}
                            onClick={() =>
                                handleBypassTask(selectedTask?.id, bypassAction, reason)
                            }
                        >
                            Confirm Bypass
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}





