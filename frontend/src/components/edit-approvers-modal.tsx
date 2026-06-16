'use client';

import React, { useState, useEffect } from 'react';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
    DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button, Input, Label, Badge } from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import api from '@/lib/api';
import { UserSelect } from '@/components/ui/user-select';
import { Trash2, Plus, AlertCircle } from 'lucide-react';
import { LiveTask, ApprovalLevel } from '@/lib/types/auth';

interface EditApproversModalProps {
    task: LiveTask | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

export function EditApproversModal({ task, open, onOpenChange, onSuccess }: EditApproversModalProps) {
    const { addToast } = useToast();
    const [levels, setLevels] = useState<Partial<ApprovalLevel>[]>([]);
    const [reason, setReason] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [applyToAll, setApplyToAll] = useState(false);


    useEffect(() => {
        if (open && task) {
            const initialLevels = (task.task_approval_levels || []).sort((a, b) => a.level_number - b.level_number).map((al: any) => ({
                id: al.id,
                level_number: al.level_number,
                approver_id: al.approver_id,
                status: al.status,
                approver: al.approver,
            }));
            setLevels(initialLevels);
            setReason('');
            setApplyToAll(false);
        }
    }, [open, task]);

    const updateApprover = (levelIdx: number, approver_id: string) => {
        setLevels(prev => {
            const copy = [...prev];
            copy[levelIdx] = { ...copy[levelIdx], approver_id };
            return copy;
        });
    };

    const addLevel = () => {
        setLevels(prev => [
            ...prev,
            { level_number: prev.length + 1, approver_id: '', status: 'PENDING' }
        ]);
    };

    const removeLevel = (index: number) => {
        setLevels(prev => {
            const filtered = prev.filter((_, i) => i !== index);
            return filtered.map((l, i) => ({ ...l, level_number: i + 1 }));
        });
    };

    const handleSave = async () => {
        if (!task) return;
        if (!reason || reason.trim().length < 10) {
            addToast({ title: 'Validation', description: 'Please provide a valid reason (min 10 characters).', variant: 'destructive' });
            return;
        }

        const missingApprovers = levels.some(l => !l.approver_id);
        if (missingApprovers) {
            addToast({ title: 'Validation', description: 'Please select a user for all approval levels.', variant: 'destructive' });
            return;
        }

        const initialLevelsFormatted = (task.task_approval_levels || []).sort((a: any, b: any) => a.level_number - b.level_number);
        let hasChanges = false;
        if (levels.length !== initialLevelsFormatted.length) {
            hasChanges = true;
        } else {
            for (let i = 0; i < levels.length; i++) {
                if (levels[i].id !== initialLevelsFormatted[i].id || levels[i].approver_id !== initialLevelsFormatted[i].approver_id) {
                    hasChanges = true;
                    break;
                }
            }
        }

        if (!hasChanges) {
            addToast({ title: 'Validation Failed', description: 'Cannot reassign to the same approvers. Please make a change or cancel.', variant: 'destructive' });
            return;
        }

        try {
            setIsSaving(true);
            const res = await api.put(`/tasks/${task.id}/approval-levels`, {
                levels: levels.map(l => ({ id: l.id, approver_id: l.approver_id, level_number: l.level_number })),
                reason,
                applyToAll
            });
            if (res.status === 200) {
                addToast({ title: 'Success', description: 'Approval levels updated successfully', variant: 'success' });
                onSuccess();
                onOpenChange(false);
            }
        } catch (err: any) {
            addToast({ title: 'Error', description: err.response?.data?.message || 'Failed to update approval levels', variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    if (!task) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto custom-scrollbar">
                <DialogHeader>
                    <DialogTitle>Edit Approval Levels</DialogTitle>
                    <DialogDescription>
                        Modify assignees, add or remove pending approval levels for "{task.title}".
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-3">
                        <Label className="text-sm font-semibold">Approval Sequence</Label>
                        <div className="rounded-xl border border-border p-4 bg-muted/10 space-y-3">
                            {levels.length === 0 && (
                                <p className="text-sm text-muted-foreground text-center py-4">No approval levels defined.</p>
                            )}
                            {levels.map((level, idx) => {
                                const isActedUpon = level.status === 'APPROVED' || level.status === 'REJECTED';
                                return (
                                    <div key={level.id || `new-${idx}`} className="flex items-center gap-3">
                                        <Badge variant="secondary" className="w-[80px] justify-center shrink-0">
                                            Level {level.level_number}
                                        </Badge>
                                        <div className="flex-1 min-w-0">
                                            {isActedUpon ? (
                                                <div className="h-9 px-3 flex items-center border border-border rounded-md bg-muted text-muted-foreground text-sm">
                                                    <span className="truncate flex-1">
                                                        {(task.task_approval_levels || []).find((al: any) => al.id === level.id)?.approver?.name || 'Unknown User'}
                                                    </span>
                                                    <span className="ml-2 text-[10px] font-bold uppercase tracking-widest text-green-600 shrink-0">
                                                        ({level.status})
                                                    </span>
                                                </div>
                                            ) : (
                                                <UserSelect
                                                    className="w-full h-9"
                                                    value={level.approver_id || ''}
                                                    onChange={val => updateApprover(idx, val)}
                                                    roles={['copywriter', 'designer', 'reviewer', 'interim_manager']}
                                                    placeholder="Select approver..."
                                                    initialSelectedUser={level.approver ? { id: level.approver.id, name: level.approver.name } : null}
                                                    excludeIds={[
                                                        task.assigned_user_id,
                                                        ...levels.filter((_, i) => i !== idx).map(l => l.approver_id)
                                                    ].filter(Boolean) as string[]}
                                                />
                                            )}
                                        </div>
                                        {!isActedUpon ? (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-red-500 hover:text-red-700 hover:bg-red-50 shrink-0 h-9 w-9"
                                                onClick={() => removeLevel(idx)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        ) : (
                                            <div className="w-9 shrink-0"></div>
                                        )}
                                    </div>
                                );
                            })}

                            <Button variant="outline" size="sm" onClick={addLevel} className="mt-2 text-xs">
                                <Plus className="h-3 w-3 mr-1" /> Add Approval Level
                            </Button>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-sm font-semibold">Reason for Change <span className="text-red-500">*</span></Label>
                        <Input
                            placeholder="Provide a reason for these changes to the workflow..."
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                        />
                        <div className="flex items-center gap-1.5 mt-1 text-muted-foreground">
                            <AlertCircle className="h-3 w-3" />
                            <p className="text-[10px]">This change will be logged in the audit trail.</p>
                        </div>
                    </div>

                    <div className="flex items-start gap-3 pt-3 border-t border-border">
                        <div className="mt-1 flex items-center justify-center">
                            <input
                                type="checkbox"
                                id="applyToAll"
                                checked={applyToAll}
                                onChange={(e) => setApplyToAll(e.target.checked)}
                                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="applyToAll" className="text-sm font-medium leading-none cursor-pointer">
                                Apply to all active instances
                            </Label>
                            <p className="text-xs text-muted-foreground">
                                Apply this exact approval sequence to all unfinished instances of this project.
                            </p>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancel</Button>
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
