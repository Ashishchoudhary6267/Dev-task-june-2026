'use client';

import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogTrigger,
    DialogFooter,
    DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UISelect } from '@/components/ui';
import api from '@/lib/api';
import { useToast } from './ui';
import { useUserStore } from '@/lib/zustand/user/addUser';
import { useAuthStore } from '@/lib/zustand/user/user';
import { useSuperadminOverviewStore } from '@/lib/zustand/superadmin/overview';
import { Badge } from './ui/badge';
import { useTaskStore } from '@/lib/zustand/tasks/tasks';
import { CheckCircle2, Loader2, AlertCircle, UserCog, Shield, UserCircle } from 'lucide-react';

interface EditUserModalProps {
    open: boolean;
    editUser: any;
    onClose: () => void;
}


export default function EditUserModal({
    open,
    editUser,
    onClose,
}: EditUserModalProps) {
    const { addToast } = useToast();
    const [formData, setFormData] = useState({
        userId: '',
        name: '',
        email: '',
        platform_role: '',
        workflow_role: '',
    });
    const { fetchUsers } = useUserStore();
    const { user } = useAuthStore();
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (editUser) {
            setFormData({
                userId: editUser?.id || '',
                name: editUser?.name || '',
                email: editUser?.email || '',
                platform_role: editUser?.platform_role || '',
                workflow_role: editUser?.workflow_role || '',
            });
        }
    }, [editUser]);

    const hasChanges = () => {
        return (
            editUser?.name !== formData?.name ||
            editUser?.email !== formData?.email ||
            editUser?.platform_role !== formData?.platform_role ||
            editUser?.workflow_role !== formData?.workflow_role
        );
    };

    const handleChange = (field: string, value: string) => {
        setFormData((prev) => ({
            ...prev,
            [field]: value,
        }));
    };

    const handleSubmit = async () => {
        if (!hasChanges()) {
            addToast({ title: 'Error', description: 'No changes to update.', variant: 'destructive' });
            return;
        }
        setLoading(true);
        try {
            const res = await api.put(`/updateuser`, formData);
            console.log("submitted res ", res);
            if (res.status === 200) {
                addToast({ title: 'User updated successfully', description: 'User has been updated successfully.', variant: 'success' });
                fetchUsers();
                onClose();
            }
            else {
                addToast({ title: 'Error', description: 'Failed to update user.', variant: 'destructive' });
            }
        }
        catch (error) {
            addToast({ title: 'Error', description: 'Failed to update user.', variant: 'destructive' });
        }
        finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Edit User</DialogTitle>
                    <DialogDescription>
                        Update user details and roles.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 mt-4">

                    {/* Name */}
                    <div className="space-y-2">
                        <Label>Name</Label>
                        <Input
                            value={formData.name}
                            onChange={(e) => handleChange('name', e.target.value)}
                        />
                    </div>

                    {/* Email */}
                    <div className="space-y-2">
                        <Label>Email</Label>
                        <Input
                            value={formData.email}
                            onChange={(e) => handleChange('email', e.target.value)}
                        />
                    </div>

                    {/* Platform Role */}
                    <div className='flex gap-2'>
                        <div className="space-y-2">
                            <Label>Platform Role</Label>

                            <UISelect
                                value={formData.platform_role}
                                onValueChange={(val) => handleChange('platform_role', val)}
                                className="w-full"
                                placeholder="Select a role…"
                                options={[
                                    { value: 'controller', label: 'Controller' },
                                    { value: 'member', label: 'Member' },
                                ]}
                            />
                        </div>

                        {/* Workflow Role */}
                        <div className="space-y-2">
                            <Label>Workflow Role</Label>
                            <UISelect
                                value={formData.workflow_role || ''}
                                onValueChange={(val) => handleChange('workflow_role', val)}
                                disabled={formData.platform_role === 'admin' || formData.platform_role === 'controller'}
                                className="w-full"
                                placeholder="Select a role…"
                                options={[
                                    { value: 'interim_manager', label: 'Interim Manager' },
                                    { value: 'copywriter', label: 'Copywriter' },
                                    { value: 'designer', label: 'Designer' },
                                    { value: 'reviewer', label: 'Reviewer' },
                                ]}
                            />
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-4">
                        <Button variant="outline" onClick={onClose} disabled={loading}>
                            Cancel
                        </Button>
                        <Button type='submit' onClick={handleSubmit} loading={loading}>
                            Save Changes
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog >
    );
}
interface DeleteUserModalProps {
    open: boolean;
    onClose: () => void;
    selectedUser: any;
}



export function DeleteUserModal({ open, onClose, selectedUser }: DeleteUserModalProps) {
    const { addToast } = useToast();
    const { fetchUsers, users } = useUserStore();
    const { fetchTaskForUserDeletion, myTabTasks, loading: tasksLoading } = useTaskStore();
    const [reassigning, setReassigning] = useState(false);
    const [reassignments, setReassignments] = useState<Record<string, string>>({});
    const [activeTasks, setActiveTasks] = useState<any[]>([]);

    useEffect(() => {
        if (open && selectedUser?.id) {
            fetchTaskForUserDeletion(selectedUser.id);
            fetchUsers({ limit: 100 });
        }
    }, [open, selectedUser, fetchTaskForUserDeletion, fetchUsers]);

    useEffect(() => {
        if (open && myTabTasks) {
            setActiveTasks(myTabTasks);
            // Initialize reassignments with empty strings if not already set
            const initial: Record<string, string> = {};
            myTabTasks.forEach(task => {
                initial[task.id] = "";
            });
            setReassignments(initial);
        }
    }, [myTabTasks, open]);

    const checkConflict = (taskId: string, userId: string) => {
        if (!userId) return false;
        const task = activeTasks.find(t => t.id === taskId);
        return task?.task_approval_levels?.some((level: any) => level.approver_id === userId);
    };

    const handleSingleReassignmentChange = (taskId: string, newId: string) => {
        if (checkConflict(taskId, newId)) {
            addToast({
                title: "Conflict Detected",
                description: "This user is already an approver for this task. Select another member.",
                variant: "destructive",
            });
            // Still set it so the UI can show the error state, but the footer button will be blocked
        }
        setReassignments(prev => ({ ...prev, [taskId]: newId }));
    };

    const handleBulkAssignAll = (newId: string) => {
        const updated: Record<string, string> = {};
        let conflictCount = 0;

        activeTasks.forEach(task => {
            const isApprover = task.task_approval_levels?.some((level: any) => level.approver_id === newId);
            if (isApprover) {
                conflictCount++;
                updated[task.id] = ""; // Reset if conflict
            } else {
                updated[task.id] = newId;
            }
        });

        setReassignments(updated);
        if (conflictCount > 0) {
            addToast({
                title: "Partial Assignment",
                description: `${conflictCount} tasks were skipped as the selected user is an approver.`,
                variant: "warning",
            });
        }
    };

    const handleBulkReassignAndDeactivate = async () => {
        const incomplete = activeTasks.some(task => !reassignments[task.id]);
        if (activeTasks.length > 0 && incomplete) {
            addToast({
                title: "Incomplete Reassignment",
                description: "Please select an assignee for all active tasks.",
                variant: "destructive",
            });
            return;
        }

        setReassigning(true);
        try {
            for (const task of activeTasks) {
                const targetId = reassignments[task.id];
                if (!targetId) continue;

                // 1. Reassign as worker if applicable
                if (task.assigned_user_id === selectedUser?.id) {
                    await api.post(`/tasks/${task.id}/reassign`, {
                        assignee_id: targetId,
                        reason: `System reassignment (Worker) due to user deactivation (${selectedUser?.name})`
                    });
                }

                // 2. Reassign as approver if applicable
                const isApprover = task.task_approval_levels?.some((level: any) => level.approver_id === selectedUser?.id);
                if (isApprover) {
                    await api.post(`/tasks/${task.id}/reassign-approver`, {
                        old_approver_id: selectedUser.id,
                        new_approver_id: targetId,
                        reason: `System reassignment (Approver) due to user deactivation (${selectedUser?.name})`
                    });
                }
            }

            const res = await api.put(`/deactivateuser`, { userId: selectedUser.id });
            if (res.status === 200) {
                addToast({
                    title: "User Deactivated",
                    description: activeTasks.length > 0
                        ? `All tasks reassigned and user deactivated successfully.`
                        : "User deactivated successfully.",
                    variant: "success",
                });
                fetchUsers();
                onClose();
            }
        } catch (error) {
            console.error("Process error:", error);
            addToast({
                title: "Error",
                description: "An error occurred during reassignment or deactivation.",
                variant: "destructive",
            });
        } finally {
            setReassigning(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-red-600 font-semibold text-xl flex items-center gap-2">
                        <AlertCircle className="h-6 w-6" />
                        Deactivate User: {selectedUser?.name}
                    </DialogTitle>
                    <DialogDescription>
                        This user will lose all access. Active tasks must be reassigned to ensure continuity.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {tasksLoading ? (
                        <div className="flex flex-col items-center justify-center py-10 gap-3">
                            <Loader2 className="h-10 w-10 animate-spin text-primary" />
                            <p className="text-muted-foreground animate-pulse">Analyzing user workload...</p>
                        </div>
                    ) : activeTasks.length > 0 ? (
                        <div className="space-y-4">
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-800 flex gap-4">
                                <AlertCircle className="h-6 w-6 shrink-0 mt-0.5" />
                                <div className="space-y-1">
                                    <p className="font-bold text-lg">Caution: {activeTasks.length} Assigned Tasks Found</p>
                                    <p className="text-sm opacity-90">
                                        These tasks require a new owner. You can reassign them individually or apply one user to all.
                                    </p>
                                </div>
                            </div>

                            {/* Quick Action: Bulk Reassign */}
                            <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border border-dashed">
                                <span className="text-sm font-semibold whitespace-nowrap">Quick Reassign All To:</span>
                                <UISelect
                                    onValueChange={(val) => handleBulkAssignAll(val)}
                                    disabled={reassigning}
                                    className="h-9 text-sm flex-1"
                                    placeholder="Choose a member..."
                                    options={users
                                        .filter((u: any) => u.id !== selectedUser?.id && u.platform_role !== 'admin')
                                        .map((u: any) => ({
                                            value: u.id,
                                            label: `${u.name} (${u.workflow_role || u.platform_role})`,
                                            icon: UserCircle
                                        }))}
                                />
                            </div>

                            {/* Individual Task List */}
                            <div className="border rounded-xl divide-y overflow-hidden bg-card shadow-sm">
                                <div className="grid grid-cols-12 gap-4 p-3 bg-muted/50 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                    <div className="col-span-1">No.</div>
                                    <div className="col-span-5">Task Details</div>
                                    <div className="col-span-2 text-center">Status</div>
                                    <div className="col-span-4">New Assignee</div>
                                </div>
                                <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                                    {activeTasks.map((task: any, index: number) => {
                                        const isWorker = task.assigned_user_id === selectedUser?.id;
                                        const isApprover = task.task_approval_levels?.some((level: any) => level.approver_id === selectedUser?.id);
                                        return (
                                            <div key={task.id} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-muted/10 transition-colors">
                                                <div className="col-span-1 text-xs text-muted-foreground font-medium">#{index + 1}</div>
                                                <div className="col-span-5 space-y-1">
                                                    <p className="text-sm font-semibold truncate leading-tight">{task.title}</p>
                                                    <div className="flex flex-wrap gap-1">
                                                        {isWorker && (
                                                            <Badge className="text-[9px] px-1.5 h-4 bg-blue-50 text-blue-700 border-blue-200">Worker</Badge>
                                                        )}
                                                        {isApprover && (
                                                            <Badge className="text-[9px] px-1.5 h-4 bg-purple-50 text-purple-700 border-purple-200">Approver</Badge>
                                                        )}
                                                        <span className="text-[9px] text-muted-foreground ml-1 italic">{task.instance?.name || 'Manual Task'}</span>
                                                    </div>
                                                </div>
                                                <div className="col-span-2 text-center shrink-0">
                                                    <Badge variant="outline" className="text-[9px] font-mono border-muted uppercase">
                                                        {task.status.replace('_', ' ')}
                                                    </Badge>
                                                </div>
                                                <div className="col-span-4 space-y-1">
                                                    <UISelect
                                                        value={reassignments[task.id] || ""}
                                                        onValueChange={(val) => handleSingleReassignmentChange(task.id, val)}
                                                        disabled={reassigning}
                                                        className={`h-9 text-xs w-full ${checkConflict(task.id, reassignments[task.id]) ? 'border-red-500 bg-red-50 text-red-900' : ''}`}
                                                        placeholder="Select Assignee..."
                                                        options={users
                                                            .filter((u: any) => u.id !== selectedUser?.id && u.platform_role !== 'admin')
                                                            .map((u: any) => ({
                                                                value: u.id,
                                                                label: u.name,
                                                                icon: UserCircle
                                                            }))}
                                                    />
                                                    {checkConflict(task.id, reassignments[task.id]) && (
                                                        <p className="text-[10px] text-red-600 font-semibold animate-pulse">
                                                            User is already an approver!
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-6 text-emerald-800 text-center flex flex-col items-center gap-3">
                            <CheckCircle2 className="h-12 w-12 text-emerald-500" />
                            <div className="space-y-1">
                                <p className="font-bold text-xl">Safe to Deactivate</p>
                                <p className="text-sm opacity-80">This user has no active task responsibilities.</p>
                            </div>
                        </div>
                    )}

                    <div className="bg-red-50/50 border border-red-100 rounded-lg p-3 flex gap-3 text-red-700/70 text-xs italic">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        Note: Deactivation is permanent and will revoke all current session tokens for this user.
                    </div>
                </div>

                <DialogFooter className="mt-4 gap-3 bg-muted/10 p-4 -mx-6 -mb-6 border-t rounded-b-lg">
                    <DialogClose >
                        <Button variant="ghost" disabled={reassigning}>
                            Cancel
                        </Button>
                    </DialogClose>

                    <Button
                        variant="destructive"
                        className="bg-red-600 hover:bg-red-700 min-w-[160px] shadow-lg shadow-red-500/20"
                        onClick={handleBulkReassignAndDeactivate}
                        disabled={
                            reassigning ||
                            tasksLoading ||
                            (activeTasks.length > 0 && (
                                activeTasks.some(t => !reassignments[t.id]) ||
                                activeTasks.some(t => checkConflict(t.id, reassignments[t.id]))
                            ))
                        }
                    >
                        {reassigning ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                Reassigning...
                            </>
                        ) : activeTasks.length > 0 ? (
                            <>
                                <UserCog className="h-4 w-4 mr-2" />
                                Reassign & Deactivate
                            </>
                        ) : (
                            'Confirm Deactivation'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
