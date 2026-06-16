
'use client';

import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button, Input, Label, UISelect } from '@/components/ui';
import { Trash2, Plus, Edit2, CheckSquare, ShieldCheck, ArrowUp, ArrowDown } from 'lucide-react';
import { TaskDraft } from '@/lib/types/auth';
import { useAuthStore } from '@/lib/zustand/user/user';

interface TaskEditModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    task: TaskDraft | null;
    onSave: (updatedTask: TaskDraft) => void;
    isAdding?: boolean;
    isAdmin?: boolean;
}

export function TaskEditModal({ open, onOpenChange, task, onSave, isAdding, isAdmin: propIsAdmin }: TaskEditModalProps) {
    const [formData, setFormData] = useState<TaskDraft | null>(null);
    const [turnaroundValue, setTurnaroundValue] = useState<number>(0);
    const { user } = useAuthStore();
    const isAdmin = propIsAdmin !== undefined ? propIsAdmin : user?.platform_role === 'admin';

    useEffect(() => {
        if (task) {
            setFormData({ ...task });

            // Calculate turnaround value in hours
            const mins = task.turnaround_minutes || 0;
            setTurnaroundValue(Math.round(mins / 60));
        } else {
            setFormData(null);
        }
    }, [task, open]);

    if (!formData) return null;

    const handleSave = () => {
        if (!formData.title.trim()) return;

        const finalMinutes = turnaroundValue * 60;

        onSave({
            ...formData,
            turnaround_minutes: finalMinutes,
            turnaround_unit: 'Hours',
            approver_turnaround_minutes: formData.approver_turnaround_minutes || 240, // default to 4 hours
        });
        onOpenChange(false);
    };

    const updateField = (field: keyof TaskDraft, value: any) => {
        setFormData(prev => prev ? { ...prev, [field]: value } : null);
    };

    const addChecklistItem = () => {
        const items = [...(formData.checklist_items || []), { item_text: '', requires_input: false, input_label: '', input_placeholder: '' }];
        updateField('checklist_items', items);
    };

    const updateChecklistItem = (index: number, field: string, value: any) => {
        const items = [...(formData.checklist_items || [])];
        items[index] = { ...items[index], [field]: value };
        updateField('checklist_items', items);
    };

    const removeChecklistItem = (index: number) => {
        const items = (formData.checklist_items || []).filter((_, i) => i !== index);
        updateField('checklist_items', items);
    };

    const moveChecklistItem = (index: number, direction: 'up' | 'down') => {
        const items = [...(formData.checklist_items || [])];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= items.length) return;
        [items[index], items[targetIndex]] = [items[targetIndex], items[index]];
        updateField('checklist_items', items);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[750px] max-h-[90vh] overflow-y-auto custom-scrollbar">
                <DialogHeader>
                    <DialogTitle>{isAdding ? 'Add New Task' : 'Edit Task & Checklist'} <span className="text-xs text-gray-500">(Only Admin can change it)</span></DialogTitle>
                    <DialogDescription>
                        {isAdding ? 'Provide details for the new task and manage its checklist.' : 'Update the task details and manage checklist items'}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-5 py-4">
                    {/* Task Name */}
                    <div className="space-y-2">
                        <Label className="text-sm font-semibold">Task Name *</Label>
                        <Input
                            placeholder="Enter task name"
                            value={formData.title || ''}
                            onChange={e => updateField('title', e.target.value)}
                            className="h-11 border-gray-200"
                            disabled={!isAdmin}
                        />
                    </div>

                    {/* Duration and Turnaround */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-sm font-semibold">Duration (minutes)</Label>
                            <Input
                                type="number"
                                min={0}
                                value={formData.estimated_minutes === 0 ? '' : formData.estimated_minutes}
                                onChange={e => {
                                    let val = e.target.value;
                                    if (val.length > 1 && val.startsWith('0')) val = val.slice(1);
                                    updateField('estimated_minutes', val === '' ? 0 : Number(val));
                                }}
                                disabled={!isAdmin}
                                className="h-11 border-gray-200"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-sm font-semibold">Turnaround Time</Label>
                            <div className="flex gap-2">
                                <Input
                                    type="number"
                                    min={0}
                                    value={turnaroundValue === 0 ? '' : Math.round(turnaroundValue)}
                                    onChange={e => {
                                        let val = e.target.value;
                                        if (val.length > 1 && val.startsWith('0')) val = val.slice(1);
                                        setTurnaroundValue(val === '' ? 0 : Number(val));
                                    }}
                                    disabled={!isAdmin}
                                    className="h-11 border-gray-200 flex-1"
                                />
                                <div className="h-11 rounded-md border border-gray-200 bg-gray-50 flex items-center px-4 text-sm font-medium text-gray-400 w-28">
                                    Hours
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Requires Approval */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-3">
                            <input
                                type="checkbox"
                                id="approval_required"
                                className="h-5 w-5 rounded border-gray-300 accent-black cursor-pointer"
                                checked={formData.approval_required}
                                onChange={e => updateField('approval_required', e.target.checked)}
                                disabled={!isAdmin}
                            />
                            <Label htmlFor="approval_required" className="text-sm font-medium cursor-pointer">Requires Approval <span className="text-xs text-gray-500">(Only Admin can change it)</span></Label>
                        </div>

                        {formData.approval_required && (
                            <div className="bg-blue-50/50 rounded-lg p-5 border border-blue-100 ml-8 space-y-3 flex flex-col lg:flex-row lg:gap-8 lg:space-y-0">
                                <div className="flex-1">
                                    <Label className="text-sm font-medium block">Number of Approval Levels (1-5)</Label>
                                    <UISelect
                                        value={formData.approval_levels.toString()}
                                        onValueChange={(val) => updateField('approval_levels', Number(val))}
                                        className="w-full h-10"
                                        disabled={!isAdmin}
                                        options={[1, 2, 3, 4, 5].map(num => ({
                                            value: num.toString(),
                                            label: `${num} Level${num > 1 ? 's' : ''}`,
                                        }))}
                                    />
                                    <p className="text-[11px] text-blue-600/70">
                                        {formData.approval_levels === 1
                                            ? 'Single approver will review and approve'
                                            : `${formData.approval_levels} levels of sequential approvals required`}
                                    </p>
                                </div>

                                {/* Divider */}
                                <div className="hidden lg:block w-px bg-blue-200 self-stretch" />
                                <div className="block lg:hidden h-px bg-blue-200 w-full" />

                                <div className="flex-1">
                                    <Label className="text-sm font-medium block mb-2">Time per Approver (Hours)</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            type="number"
                                            min={1}
                                            max={10}
                                            value={formData.approver_turnaround_minutes ? Math.round(formData.approver_turnaround_minutes / 60) : 4}
                                            onChange={(e) => {
                                                let val = Number(e.target.value);
                                                if (val < 1) val = 1;
                                                updateField('approver_turnaround_minutes', val * 60);
                                            }}
                                            className="w-24 h-10 border-blue-200"
                                            disabled={!isAdmin}
                                        />
                                        <div className="h-10 rounded-md border border-blue-200 bg-blue-50/50 flex items-center px-4 text-sm font-medium text-blue-800">
                                            Hours
                                        </div>
                                    </div>
                                    <p className="text-[11px] text-blue-600/70 mt-2">
                                        Time allocated to each approver. The worker's turnaround time is exactly what is entered above.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Requires Checklist */}
                    <div className="pt-2">
                        <div className="flex items-center gap-3 mb-4">
                            <input
                                type="checkbox"
                                id="requires_checklist"
                                className="h-5 w-5 rounded border-gray-300 accent-black cursor-pointer"
                                checked={formData.checklist}
                                onChange={e => {
                                    updateField('checklist', e.target.checked);
                                    if (e.target.checked && (!formData.checklist_items || formData.checklist_items.length === 0)) {
                                        updateField('checklist_items', [{ item_text: '', requires_input: false, input_label: '', input_placeholder: '' }]);
                                    }

                                }}
                                disabled={!isAdmin}
                            />
                            <Label htmlFor="requires_checklist" className="text-sm font-medium cursor-pointer">Requires Checklist <span className="text-xs text-gray-500">(Only Admin can change it)</span></Label>
                        </div>

                        {formData.checklist && (
                            <div className="bg-gray-50/50 rounded-lg p-5 border border-gray-200 ml-8 space-y-4">
                                <Label className="text-sm font-semibold flex items-center justify-between">
                                    Checklist Items ({formData.checklist_items?.length || 0})
                                </Label>
                                <div className="space-y-4">
                                    {formData.checklist_items?.map((item, index) => (
                                        <div key={index} className="flex flex-col gap-2 bg-white rounded-lg border border-gray-100">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-semibold text-muted-foreground w-4 text-center shrink-0">
                                                    {index + 1}.
                                                </span>

                                                <Input
                                                    value={item.item_text}
                                                    onChange={e => updateChecklistItem(index, 'item_text', e.target.value)}
                                                    placeholder="Enter checklist item text"
                                                    className="h-9 text-sm border-gray-200 flex-1"
                                                />

                                                <div className="flex items-center gap-1.5 shrink-0 px-2 border-l border-gray-100 ml-1">
                                                    <input
                                                        type="checkbox"
                                                        id={`requires_input_${index}`}
                                                        className="h-3.5 w-3.5 rounded border-gray-300 accent-black cursor-pointer"
                                                        checked={item.requires_input}
                                                        onChange={e => updateChecklistItem(index, 'requires_input', e.target.checked)}
                                                        disabled={!isAdmin}
                                                    />
                                                    <label htmlFor={`requires_input_${index}`} className="text-[11px] font-medium text-gray-500 cursor-pointer whitespace-nowrap mr-1">
                                                        Req. Input
                                                    </label>
                                                </div>

                                                <div className="flex items-center gap-1 shrink-0 px-2 border-l border-gray-100 ml-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7 text-muted-foreground hover:text-black shrink-0 disabled:opacity-30"
                                                        onClick={() => moveChecklistItem(index, 'up')}
                                                        disabled={!isAdmin || index === 0}
                                                        title="Move Up"
                                                    >
                                                        <ArrowUp className="h-3.5 w-3.5" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7 text-muted-foreground hover:text-black shrink-0 disabled:opacity-30"
                                                        onClick={() => moveChecklistItem(index, 'down')}
                                                        disabled={!isAdmin || index === (formData.checklist_items?.length || 0) - 1}
                                                        title="Move Down"
                                                    >
                                                        <ArrowDown className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>

                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                                                    onClick={() => removeChecklistItem(index)}
                                                    disabled={!isAdmin}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>

                                            {/* Input label and placeholder rows ONLY appear when checked */}
                                            {item.requires_input && (
                                                <div className="grid grid-cols-2 gap-2 pl-8 pr-[100px] border-t border-gray-50 pt-2 mt-1">
                                                    <Input
                                                        value={item.input_label}
                                                        onChange={e => updateChecklistItem(index, 'input_label', e.target.value)}
                                                        placeholder="Input label"
                                                        className="h-8 text-xs border-gray-200 bg-gray-50/50"
                                                    />
                                                    <Input
                                                        value={item.input_placeholder}
                                                        onChange={e => updateChecklistItem(index, 'input_placeholder', e.target.value)}
                                                        placeholder="Placeholder text"
                                                        className="h-8 text-xs border-gray-200 bg-gray-50/50"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="w-full mt-2 border-dashed border-gray-300 bg-white hover:bg-gray-50 h-10"
                                    onClick={addChecklistItem}
                                    disabled={!isAdmin}
                                >
                                    <Plus className="h-3.5 w-3.5 mr-1" /> Add Checklist Item
                                </Button>
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter className="border-t pt-4">
                    <Button variant="outline" onClick={() => onOpenChange(false)} className="h-11 px-6">Cancel</Button>
                    <Button onClick={handleSave} className="h-11 px-8 bg-black hover:bg-gray-800 text-white gap-2"
                        disabled={!isAdmin}
                    >
                        <CheckSquare className="h-4 w-4" />
                        {isAdding ? 'Save Task' : 'Save Task'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
