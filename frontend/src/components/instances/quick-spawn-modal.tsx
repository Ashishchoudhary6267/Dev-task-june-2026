'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
    DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button, Input, Label, UISelect } from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import { useInstanceStore } from '@/lib/zustand/instances/instances';
import { useProjectStore } from '@/lib/zustand/projects/createproject';
import { useClientStore } from '@/lib/zustand/clients/client';
import { useUserStore } from '@/lib/zustand/user/addUser';
import { Zap, UserCircle } from 'lucide-react';
import { useAuthStore } from '@/lib/zustand/user/user';
import { UserSelect } from '@/components/ui/user-select';
import Loader from '../ui/loader';
import { ClientSelect } from '../ui/client-select';

interface QuickSpawnModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function QuickSpawnModal({ open, onOpenChange }: QuickSpawnModalProps) {
    const { addToast } = useToast();
    const { projects, fetchprojects } = useProjectStore();
    const { clients, fetchClients } = useClientStore();
    const { user } = useAuthStore();
    const { createInstance, fetchTemplateTasks, templateTasks, instanceLoading, templateTasksinstanceLoading } = useInstanceStore();

    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [selectedClientId, setSelectedClientId] = useState('');
    const [instanceName, setInstanceName] = useState('');
    const [assignedUsers, setAssignedUsers] = useState<Record<string, string>>({});
    const [approverAssignments, setApproverAssignments] = useState<Record<string, Record<number, string>>>({});

    useEffect(() => {
        if (open) {
            fetchprojects();
            fetchClients();
            setSelectedProjectId('');
            setSelectedClientId('');
            setInstanceName('');
            setAssignedUsers({});
            setApproverAssignments({});
        }
    }, [open]);

    useEffect(() => {
        if (selectedProjectId) fetchTemplateTasks(selectedProjectId);
    }, [selectedProjectId]);

    useEffect(() => {
        if (templateTasks.length > 0) {
            const initialApprovers: Record<string, Record<number, string>> = {};
            templateTasks.forEach(task => {
                if (task.approval_required) {
                    initialApprovers[task.id] = {};
                    for (let i = 1; i <= (task.approval_levels || 1); i++) {
                        initialApprovers[task.id][i] = '';
                    }
                }
            });
            setApproverAssignments(initialApprovers);
            setAssignedUsers({});
        } else {
            setApproverAssignments({});
            setAssignedUsers({});
        }
    }, [selectedProjectId, templateTasks.length]);

    // Filter to only show micro templates
    const microTemplates = useMemo(() => projects.filter(p => p.type === 'micro'), [projects]);

    const handleCreate = async () => {
        if (!selectedClientId) {
            addToast({ title: 'Missing fields', description: 'Select a client.', variant: 'destructive' });
            return;
        }
        if (!selectedProjectId || !instanceName.trim()) {
            addToast({ title: 'Missing fields', description: 'Select a task template and enter an instance name.', variant: 'destructive' });
            return;
        }
        if (templateTasks.length === 0) {
            addToast({ title: 'No Tasks', description: 'The selected micro template has no tasks. Ask admin to add a task first.', variant: 'destructive' });
            return;
        }

        const task_assignments = [];

        for (const task of templateTasks) {
            if (!assignedUsers[task.id]) {
                addToast({ title: 'Missing Assignment', description: `Please assign a user for task: ${task.title}`, variant: 'destructive' });
                return;
            }

            let approvers = [];
            if (task.approval_required) {
                for (let i = 1; i <= (task.approval_levels || 1); i++) {
                    const approverId = approverAssignments[task.id]?.[i];
                    if (!approverId) {
                        addToast({ title: 'Missing Approvers', description: `Please select an approver for Level ${i} on task: ${task.title}`, variant: 'destructive' });
                        return;
                    }
                    approvers.push({ level: i, approver_id: approverId });
                }
            }

            const turnaroundHours = Math.round((task.turnaround_minutes || 60) / 60);

            task_assignments.push({
                template_task_id: task.id,
                assigned_user_id: assignedUsers[task.id],
                effort_minutes: Number(task.estimated_minutes),
                turnaround_minutes: Math.round(Number(turnaroundHours) * 60),
                approvers: approvers
            });
        }

        try {
            const ok = await createInstance({
                project_id: selectedProjectId,
                company_id: user?.company_id || '',
                client_id: selectedClientId || undefined,
                name: instanceName,
                task_assignments,
            });

            if (ok) {
                addToast({
                    title: 'Quick Task Spawnd! ⚡',
                    description: `"${instanceName}" is now live and assigned.`,
                    variant: 'success',
                });
                onOpenChange(false);
            }
        } catch (error: any) {
            console.error(error);
            const errorMessage = error?.response?.data?.message || 'Failed to spawn task.';
            addToast({ title: 'Error', description: errorMessage, variant: 'destructive' });
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[550px] max-h-[85vh] overflow-y-auto custom-scrollbar">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2"><Zap className="h-5 w-5 text-amber-500" /> Spawn Quick Task</DialogTitle>
                    <DialogDescription>Quickly assign a Micro Template task directly to a user.</DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Micro Template */}
                    <div>
                        <Label className="text-xs font-semibold text-muted-foreground mb-1 block">Micro Template</Label>
                        <UISelect
                            value={selectedProjectId}
                            onValueChange={(val) => {
                                setSelectedProjectId(val);
                                const proj = microTemplates.find(p => p.id === val);
                                if (proj) setInstanceName(proj.name + " - Ad-hoc");
                            }}
                            className="w-full"
                            placeholder="— Select a Quick Task —"
                            options={microTemplates.map(p => ({
                                value: p.id,
                                label: p.name,
                                icon: Zap
                            }))}
                        />
                        {microTemplates.length === 0 && <p className="text-xs text-orange-500 mt-1">No Micro Templates found. Ask Admin to create one.</p>}
                    </div>

                    {/* Client */}
                    <div>
                        <Label className="text-xs font-semibold text-muted-foreground mb-1 block">Client</Label>
                        <ClientSelect
                            className="w-full"
                            value={selectedClientId}
                            onChange={setSelectedClientId}
                            placeholder="— Select a client —"
                        />
                    </div>

                    {/* Instance name */}
                    <div>
                        <Label className="text-xs font-semibold text-muted-foreground mb-1 block">Task Reference Name</Label>
                        <Input placeholder="e.g. Graphic Request" value={instanceName} onChange={e => setInstanceName(e.target.value)} />
                    </div>

                    {/* Assignees */}
                    {selectedProjectId && (
                        <div className="pt-2">
                            <Label className="block text-sm font-bold border-b border-border/50 pb-2 mb-3">Task Assignments</Label>
                            {templateTasksinstanceLoading ? (
                                <Loader />
                            ) : templateTasks.length > 0 ? (
                                <div className="space-y-4">
                                    {templateTasks.sort((a, b) => a.step_order - b.step_order).map((task, idx) => {
                                        const requiredRole = task.assigned_role || 'copywriter';

                                        // A simple display logic to differentiate tasks
                                        return (
                                            <div key={task.id} className="bg-card border border-border/50 rounded-xl p-3 shadow-sm hover:border-border transition-colors">
                                                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border/40">
                                                    <div className="h-5 w-5 rounded bg-muted flex items-center justify-center text-[10px] font-medium text-muted-foreground">
                                                        {idx + 1}
                                                    </div>
                                                    <div>
                                                        <p className="text-[13px] font-bold leading-none">{task.title}</p>
                                                        <p className="text-[10px] text-muted-foreground mt-1 capitalize leading-none">{requiredRole}</p>
                                                    </div>
                                                </div>

                                                <div className="space-y-3 mt-3">
                                                    <div>
                                                        <Label className="text-[10px] font-semibold text-muted-foreground mb-1 block uppercase tracking-widest">Assign</Label>
                                                        <UserSelect
                                                            className="w-full h-8"
                                                            value={assignedUsers[task.id] || ''}
                                                            onChange={val => setAssignedUsers(prev => ({ ...prev, [task.id]: val }))}
                                                            roles={[requiredRole]}
                                                            placeholder={`Assign ${requiredRole}...`}
                                                        />
                                                    </div>
                                                    {task.approval_required && (
                                                        <div className="space-y-2 mt-2 pt-2 border-t border-border/40">
                                                            <div className="flex items-center gap-1.5 mb-1.5">
                                                                <span className="h-1.5 w-1.5 rounded-full bg-blue-500"></span>
                                                                <Label className="text-[10px] font-semibold text-muted-foreground block uppercase tracking-widest">Approvers Required</Label>
                                                            </div>
                                                            {Array.from({ length: task.approval_levels || 1 }).map((_, levelIdx) => {
                                                                const level = levelIdx + 1;
                                                                const isLastLevel = level === task.approval_levels;
                                                                const roles = isLastLevel && task.approval_levels > 1 ? ['interim_manager', 'reviewer'] : ['copywriter', 'designer', 'reviewer', 'interim_manager'];
                                                                return (
                                                                    <div key={level} className="flex flex-col gap-1 pl-3 border-l-2 border-muted">
                                                                        <span className="text-[10px] text-muted-foreground font-medium">Level {level}</span>
                                                                        <UserSelect
                                                                            className="w-full h-8"
                                                                            value={approverAssignments[task.id]?.[level] || ''}
                                                                            onChange={val => setApproverAssignments(prev => ({
                                                                                ...prev,
                                                                                [task.id]: {
                                                                                    ...prev[task.id],
                                                                                    [level]: val
                                                                                }
                                                                            }))}
                                                                            roles={roles}
                                                                            placeholder={`Select Approver ${level}`}
                                                                        />
                                                                    </div>
                                                                )
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">This template has no tasks attached.</p>
                            )}
                        </div>
                    )}
                </div>

                <DialogFooter className="sticky bottom-0 bg-background pt-2 pb-0 mt-2 border-t border-border/40">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleCreate} disabled={!selectedProjectId || !instanceName.trim() || Object.keys(assignedUsers).length !== templateTasks.length || instanceLoading} className="bg-amber-500 hover:bg-amber-600 outline-none text-white font-bold">
                        {instanceLoading ? 'Creating...' : '⚡ Create Task'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
