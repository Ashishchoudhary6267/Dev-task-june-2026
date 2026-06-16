'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button, Input, Label, Textarea, UISelect } from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import { useInstanceStore } from '@/lib/zustand/instances/instances';
import { Plus, Trash2, Settings, CheckSquare, User, ChevronUp, ChevronDown, ListChecks, CheckCircle2, RefreshCw, Info, Layers, Clock, Zap, DollarSign } from 'lucide-react';
import { Project } from '@/lib/types/auth';
import { TaskDraft } from '@/lib/types/auth';
import { useAuthStore } from '@/lib/zustand/user/user';
import { useProjectStore } from '@/lib/zustand/projects/createproject';
import { TaskEditModal } from './task-edit-modal';
import { Badge } from '@/components/ui/badge';
interface EditTemplateMdlProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    template: Project | null;
    companyId?: string;
    onSuccess?: () => void;
}

export function EditTemplateModal({ open, onOpenChange, template, companyId, onSuccess }: EditTemplateMdlProps) {
    const { addToast } = useToast();
    const { templateTasks, templateTasksinstanceLoading, fetchTemplateTasks, addTemplateTask, updateTemplateTask, deleteTemplateTask } = useInstanceStore();
    const { updateProject } = useProjectStore();
    const { user } = useAuthStore();
    const isAdmin = user?.platform_role === 'admin' || (user?.platform_role === 'superadmin' && (companyId === 'global' || template?.company_id === null));

    const [drafts, setDrafts] = useState<TaskDraft[]>([]);
    const [saving, setSaving] = useState(false);
    const [showremovetask, setShowremovetask] = useState(false);
    const [removingTaskIdx, setRemovingTaskIdx] = useState<number | null>(null);

    // Description modal state
    const [isDescriptionOpen, setIsDescriptionOpen] = useState(false);
    const [selectedDescription, setSelectedDescription] = useState<{ title: string; content: string } | null>(null);

    // Project info state
    const [projectData, setProjectData] = useState({
        name: '',
        category: '',
        description: '',
        type: '',
        status: 'active'
    });

    // Task modal state
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [editingTaskIdx, setEditingTaskIdx] = useState<number | null>(null);

    // Load existing template tasks and project data when modal opens
    useEffect(() => {
        if (open && template) {
            fetchTemplateTasks(template.id);
            setProjectData({
                name: template.name || '',
                category: template.category || '',
                description: template.description || '',
                type: template.type || 'one-time',
                status: template.status || 'active'
            });
        }
    }, [open, template?.id]);

    useEffect(() => {
        if (templateTasks.length > 0) {
            setDrafts(templateTasks.map(t => {
                const items = (t.checklist_items || []).map(ci => ({
                    item_text: ci.item_text,
                    requires_input: ci.requires_input || false,
                    input_label: ci.input_label || '',
                    input_placeholder: ci.input_placeholder || '',
                }));
                return {
                    id: t.id,
                    title: t.title,
                    description: t.description || '',
                    step_order: t.step_order,
                    estimated_minutes: t.estimated_minutes,
                    turnaround_minutes: t.turnaround_minutes || 60,
                    worker_time_percentage: t.worker_time_percentage || 70,
                    turnaround_unit: 'Hours' as "Days" | "Hours" | "Minutes",
                    approval_required: t.approval_required,
                    approval_levels: t.approval_levels,
                    assigned_role: t.assigned_role || '',
                    checklist: items.length > 0,
                    checklist_items: items,
                    isNew: false,
                };
            }).sort((a, b) => (a.step_order || 0) - (b.step_order || 0)));
        } else {
            setDrafts([]);
        }
    }, [templateTasks]);

    const handleAddTask = () => {
        setEditingTaskIdx(null);
        setIsTaskModalOpen(true);
    };

    const handleEditTask = (idx: number) => {
        setEditingTaskIdx(idx);
        setIsTaskModalOpen(true);
    };

    const updateInlineTask = (idx: number, field: keyof TaskDraft, value: any) => {
        setDrafts(prev => {
            const copy = [...prev];
            copy[idx] = { ...copy[idx], [field]: value };
            return copy;
        });
    };

    const saveTaskDraft = (updatedTask: TaskDraft) => {
        if (editingTaskIdx !== null) {
            setDrafts(prev => {
                const copy = [...prev];
                copy[editingTaskIdx] = updatedTask;
                return copy;
            });
        } else {
            setDrafts(prev => [...prev, {
                ...updatedTask,
                step_order: prev.length + 1,
                isNew: true
            }]);
        }
    };

    const moveTask = (idx: number, direction: 'up' | 'down') => {
        if (direction === 'up' && idx === 0) return;
        if (direction === 'down' && idx === drafts.length - 1) return;

        const newDrafts = [...drafts];
        const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
        [newDrafts[idx], newDrafts[targetIdx]] = [newDrafts[targetIdx], newDrafts[idx]];

        // Update step orders
        const updatedOrders = newDrafts.map((d, i) => ({ ...d, step_order: i + 1 }));
        setDrafts(updatedOrders);
    };

    const hasChanges = useMemo(() => {
        if (!template) return false;

        // Check project data changes
        const projectChanged =
            projectData.name !== (template.name || '') ||
            projectData.category !== (template.category || '') ||
            projectData.description !== (template.description || '') ||
            projectData.type !== (template.type || '') ||
            projectData.status !== (template.status || 'active');

        if (projectChanged) return true;

        // Check if task count changed
        if (drafts.length !== templateTasks.length) return true;

        // Check each task for changes
        for (let i = 0; i < drafts.length; i++) {
            const draft = drafts[i];
            // Since drafts are sorted by step_order, and templateTasks might not be,
            // let's find the original task by ID if it exists.
            const original = draft.id ? templateTasks.find(t => t.id === draft.id) : null;

            if (!original) return true; // New task added (even if same count, e.g. delete+add)

            if (
                draft.title !== original.title ||
                draft.description !== (original.description || '') ||
                draft.step_order !== original.step_order ||
                draft.estimated_minutes !== original.estimated_minutes ||
                draft.turnaround_minutes !== (original.turnaround_minutes || 60) ||
                draft.worker_time_percentage !== (original.worker_time_percentage || 70) ||
                draft.approval_required !== original.approval_required ||
                draft.approval_levels !== original.approval_levels ||
                draft.assigned_role !== (original.assigned_role || '')
            ) return true;

            // Check checklist items
            const originalItems = (original.checklist_items || []).map(ci => ci.item_text);
            if (JSON.stringify(draft.checklist_items) !== JSON.stringify(originalItems)) return true;
        }

        return false;
    }, [projectData, drafts, template, templateTasks]);

    const removeDraft = async (idx: number) => {
        const draft = drafts[idx];
        if (draft.id) {
            await deleteTemplateTask(draft.id);
        }
        setDrafts(prev => prev.filter((_, i) => i !== idx).map((d, i) => ({ ...d, step_order: i + 1 })));
        setShowremovetask(false);
        setRemovingTaskIdx(null);
    };

    const confirmRemoveTask = (idx: number) => {
        setRemovingTaskIdx(idx);
        setShowremovetask(true);
    };

    const handleSave = async () => {
        if (!template) return;
        setSaving(true);

        // 1. Update project details
        if (isAdmin) {
            await updateProject(template.id, {
                name: projectData.name,
                category: projectData.category,
                description: projectData.description,
                type: projectData.type,
                status: projectData.status
            });
        }

        // 2. Save tasks
        const tasksPayload = drafts
            .filter(draft => draft.title.trim())
            .map((draft, idx) => ({
                id: draft.isNew ? undefined : draft.id,
                project_id: template.id,
                title: draft.title,
                description: draft.description,
                step_order: idx + 1,
                estimated_minutes: draft.estimated_minutes,
                turnaround_minutes: draft.turnaround_minutes,
                worker_time_percentage: draft.worker_time_percentage,
                approval_required: draft.approval_required,
                approval_levels: draft.approval_levels,
                checklist_items: (draft.checklist_items || []).filter(i => i.item_text?.trim()),
                assigned_role: draft.assigned_role,
            }));

        if (tasksPayload.length > 0) {
            await addTemplateTask(tasksPayload);
            await fetchTemplateTasks(template.id);
        }

        setSaving(false);
        addToast({ title: 'Template updated', description: 'Template and tasks saved successfully.', variant: 'success' });
        onOpenChange(false);
        if (onSuccess) onSuccess();
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[850px] max-h-[95vh] h-[95vh] overflow-hidden flex flex-col p-0 border-none shadow-2xl">
                <DialogHeader className="p-8 pb-4">
                    <div className="flex justify-between items-start">
                        <div>
                            <DialogTitle className="text-2xl font-bold text-gray-900">Edit Template</DialogTitle>
                            <DialogDescription className="text-gray-500 mt-1">Update template details and manage tasks</DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto px-8 pb-8 space-y-8">
                    {/* Template Info Section */}
                    <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase tracking-wider text-gray-400">Template Name</Label>
                                <Input
                                    value={projectData.name}
                                    onChange={e => setProjectData(p => ({ ...p, name: e.target.value }))}
                                    placeholder="Enter template name"
                                    className="h-11 border-gray-200 focus:border-black focus:ring-black rounded-lg"
                                    readOnly={!isAdmin}
                                    disabled={!isAdmin}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase tracking-wider text-gray-400">Type</Label>

                                <UISelect
                                    id="template_type"
                                    value={projectData.type}
                                    onValueChange={val => setProjectData(p => ({ ...p, type: val }))}

                                    className="col-span-3"
                                    placeholder="Select a type.."
                                    options={[
                                        { value: 'one-time', label: 'One Time', icon: Layers },
                                        { value: 'recurring', label: 'Recurring', icon: Clock },
                                        { value: 'micro', label: 'Micro Template', icon: Zap },
                                        { value: 'billing', label: 'Billing', icon: DollarSign }
                                    ]}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase tracking-wider text-gray-400">Category</Label>
                                <Input
                                    value={projectData.category}
                                    onChange={e => setProjectData(p => ({ ...p, category: e.target.value }))}
                                    placeholder="e.g. Campaign"
                                    className="h-11 border-gray-200 focus:border-black focus:ring-black rounded-lg"
                                    readOnly={!isAdmin}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase tracking-wider text-gray-400">Description <span className='text-xs'>(Click to view )</span></Label>
                                <Input
                                    value={projectData.description}
                                    onChange={e => setProjectData(p => ({ ...p, description: e.target.value }))}
                                    onClick={() => {
                                        setSelectedDescription({ title: projectData.name, content: projectData.description });
                                        setIsDescriptionOpen(true);
                                    }}
                                    placeholder="Optional"
                                    className="h-11 border-gray-200 focus:border-black focus:ring-black rounded-lg text-wrap"
                                    readOnly={!isAdmin}
                                />
                            </div>
                            {/* {projectData.description && (
                                <button
                                    onClick={() => {
                                        setSelectedDescription({ title: projectData.name, content: projectData.description });
                                        setIsDescriptionOpen(true);
                                    }}
                                    className="text-[10px] text-primary hover:underline flex items-center gap-0.5 mt-0.5 w-fit"
                                >
                                    <Info className="h-2.5 w-2.5" /> View Description
                                </button>
                            )} */}
                        </div>

                        {/*  only admin can change it */}
                        <div className="flex items-center gap-2 pt-2">
                            <input
                                type="checkbox"
                                id="template-active"
                                checked={projectData.status === 'active'}
                                onChange={e => setProjectData(p => ({ ...p, status: e.target.checked ? 'active' : 'inactive' }))}
                                className="h-5 w-5 rounded border-gray-300 accent-black cursor-pointer"
                                disabled={!isAdmin}
                            />
                            <Label htmlFor="template-active" className="text-sm font-semibold cursor-pointer">Active</Label>
                        </div>
                    </div>

                    {/* Tasks Section */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <h3 className="text-lg font-bold text-gray-900">Tasks</h3>
                                <Badge variant="secondary" className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs font-medium">
                                    {drafts.length}
                                </Badge>
                            </div>
                            {isAdmin && (
                                <Button
                                    onClick={handleAddTask}
                                    variant='default'
                                // className='text-green-600'
                                // className="bg-black hover:bg-gray-800 text-white rounded-lg h-10 px-4 gap-2 text-sm font-semibold transition-all"
                                >
                                    <Plus className="h-4 w-4" /> Add Task
                                </Button>
                            )}
                        </div>

                        {templateTasksinstanceLoading ? (
                            <div className="bg-gray-50 rounded-xl p-20 flex flex-col items-center justify-center border border-dashed border-gray-200">
                                <RefreshCw className="h-8 w-8 text-gray-300 animate-spin mb-4" />
                                <p className="text-gray-400 font-medium">Loading tasks...</p>
                            </div>
                        ) : drafts?.length === 0 ? (
                            <div className="bg-gray-50 rounded-xl p-20 flex flex-col items-center justify-center border border-dashed border-gray-200 text-center">
                                <div className="h-16 w-16 rounded-full bg-white flex items-center justify-center shadow-sm mb-4">
                                    <Settings className="h-8 w-8 text-gray-300" />
                                </div>
                                <h4 className="text-gray-900 font-bold">No tasks added yet</h4>
                                <p className="text-gray-500 text-sm mt-1 max-w-[240px]">
                                    {isAdmin ? 'Start by adding your first task to define the workflow.' : 'No tasks have been defined for this template.'}
                                </p>
                                {isAdmin && (
                                    <Button variant="outline" className="mt-6 h-10 rounded-lg hover:bg-white" onClick={handleAddTask}>
                                        <Plus className="h-4 w-4 mr-2" /> Add First Task
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto custom-scrollbar">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50/50 text-gray-400 border-b border-gray-100">
                                        <tr>
                                            <th className="text-left px-6 py-4 font-bold uppercase tracking-wider text-[10px] w-12">#</th>
                                            <th className="text-left px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Task Name</th>
                                            <th className="text-left px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Duration (min)</th>
                                            <th className="text-left px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Turnaround (hrs)</th>
                                            <th className="text-center px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Approval</th>
                                            <th className="text-center px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Checklist</th>
                                            <th className="text-right px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {drafts?.map((draft, idx) => (
                                            <tr key={idx} className="group hover:bg-gray-50/50 transition-colors">
                                                <td className="px-6 py-4 text-gray-400 font-medium">{idx + 1}</td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col">
                                                        <div className="font-semibold text-gray-900 cursor-pointer hover:text-black" onClick={() => isAdmin && handleEditTask(idx)}>
                                                            {draft.title}
                                                        </div>

                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-gray-600">
                                                    <div className="flex items-center gap-2">
                                                        <Input
                                                            type="number"
                                                            value={draft.estimated_minutes === 0 ? '' : draft.estimated_minutes}
                                                            min={0}
                                                            onChange={e => {
                                                                let val = e.target.value;
                                                                if (val.length > 1 && val.startsWith('0')) val = val.slice(1);
                                                                updateInlineTask(idx, 'estimated_minutes', val === '' ? 0 : Number(val));
                                                            }}
                                                            className="w-20 h-8 text-xs border-gray-200 focus:border-black"
                                                            readOnly={!isAdmin}
                                                        />
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-gray-600">
                                                    <div className="flex items-center gap-2">
                                                        <Input
                                                            type="number"
                                                            value={draft.turnaround_minutes === 0 ? '' : Math.round(draft.turnaround_minutes / 60)}
                                                            min={0}
                                                            onChange={e => {
                                                                let val = e.target.value;
                                                                if (val.length > 1 && val.startsWith('0')) val = val.slice(1);
                                                                updateInlineTask(idx, 'turnaround_minutes', (val === '' ? 0 : Number(val)) * 60);
                                                            }}
                                                            className="w-20 h-8 text-xs border-gray-200 focus:border-black"
                                                            readOnly={!isAdmin}
                                                        />
                                                        <span className="text-xs text-gray-400">hrs</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex justify-center">
                                                        {draft.approval_required ? (
                                                            <div className="flex items-center gap-1 text-black px-2 py-0.5 rounded text-[10px] font-bold">
                                                                <CheckCircle2 className="h-4 w-4" />
                                                                <span className='text-sm'>{draft.approval_levels} L</span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-gray-300">—</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex justify-center">
                                                        {draft.checklist ? (
                                                            <Button
                                                                onClick={() => handleEditTask(idx)}
                                                                variant='outline'
                                                                className='text-green-600'
                                                            // className="flex items-center gap-1.5 text-green-600 bg-green-50 px-2.5 py-1 rounded-full text-xs font-bold hover:bg-green-100 transition-colors border border-green-100"
                                                            >
                                                                <ListChecks className="h-3.5 w-3.5" />
                                                                {draft.checklist_items?.length || 0}
                                                            </Button>
                                                        ) : (
                                                            <span className="text-gray-300">—</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center justify-end gap-1 opacity-100 transition-opacity">
                                                        {isAdmin && (
                                                            <>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-8 w-8 text-gray-400 hover:text-black"
                                                                    onClick={() => moveTask(idx, 'up')}
                                                                    disabled={idx === 0}
                                                                >
                                                                    <ChevronUp className="h-4 w-4" />
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-8 w-8 text-gray-400 hover:text-black"
                                                                    onClick={() => moveTask(idx, 'down')}
                                                                    disabled={idx === drafts.length - 1}
                                                                >
                                                                    <ChevronDown className="h-4 w-4" />
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-8 w-8 text-gray-400 hover:text-destructive"
                                                                    onClick={() => confirmRemoveTask(idx)}
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter className="p-8 py-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center sm:justify-between">
                    <div className="text-[11px] text-gray-400 flex items-center gap-4 font-medium uppercase tracking-wider">
                        <span>{drafts.length} tasks</span>
                        <span className="h-1 w-1 rounded-full bg-gray-300" />
                        <span>Last updated: {template?.start_date ? new Date(template.start_date).toLocaleDateString('en-IN') : '—'}</span>
                    </div>
                    <div className="flex gap-3">
                        <Button variant="ghost" className="h-11 px-6 font-semibold text-gray-500 hover:text-black" onClick={() => onOpenChange(false)}>Cancel</Button>
                        {isAdmin && (
                            <Button
                                onClick={handleSave}
                                loading={saving}
                                disabled={!hasChanges}
                                className={`${!hasChanges ? 'bg-gray-200 text-gray-400' : 'bg-black hover:bg-gray-800 text-white'} h-11 px-8 rounded-lg font-bold gap-2 shadow-sm transition-all`}
                            >
                                <CheckSquare className="h-4 w-4" /> Save Changes
                            </Button>
                        )}
                    </div>
                </DialogFooter>

                <TaskEditModal
                    open={isTaskModalOpen}
                    onOpenChange={setIsTaskModalOpen}
                    task={editingTaskIdx !== null ? drafts[editingTaskIdx] : {
                        title: '',
                        description: '',
                        step_order: drafts.length + 1,
                        estimated_minutes: 30,
                        turnaround_minutes: 480,
                        worker_time_percentage: 70,
                        turnaround_unit: 'Days',
                        approval_required: false,
                        approval_levels: 1,
                        assigned_role: '',
                        checklist: false,
                        checklist_items: [],
                        isNew: true
                    }}
                    onSave={saveTaskDraft}
                    isAdding={editingTaskIdx === null}
                    isAdmin={isAdmin}
                />

                {/* Depletion Confirmation Dialog */}
                <Dialog open={showremovetask} onOpenChange={setShowremovetask}>
                    <DialogContent className="sm:max-w-[400px]">
                        <DialogHeader>
                            <DialogTitle className="text-destructive flex items-center gap-2">
                                <Trash2 className="h-5 w-5" /> Confirm Deletion
                            </DialogTitle>
                            <DialogDescription className="py-2">
                                Are you sure you want to remove this task from the template? This action cannot be undone.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter className="gap-2 sm:gap-0">
                            <Button variant="ghost" onClick={() => setShowremovetask(false)}>Cancel</Button>
                            <Button
                                variant="destructive"
                                onClick={() => removingTaskIdx !== null && removeDraft(removingTaskIdx)}
                            >
                                Remove Task
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Description Viewer Dialog */}
                <Dialog open={isDescriptionOpen} onOpenChange={setIsDescriptionOpen}>
                    <DialogContent className="sm:max-w-[500px]">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                                <Info className="h-5 w-5 text-primary" />
                                Task Description
                            </DialogTitle>
                            <DialogDescription className="text-gray-900 mt-2 font-medium py-2">

                                Template Name : <span className='text-primary'>{selectedDescription?.title}</span>
                            </DialogDescription>
                        </DialogHeader>
                        <Textarea
                            value={projectData.description}
                            onChange={e => setProjectData(p => ({ ...p, description: e.target.value }))}
                            onClick={() => {
                                setSelectedDescription({ title: projectData.name, content: projectData.description });
                                setIsDescriptionOpen(true);
                            }}
                            placeholder="Optional"
                            className="h-11 border-gray-200 focus:border-black focus:ring-black rounded-lg my-2"
                            readOnly={!isAdmin}
                        />
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsDescriptionOpen(false)}>Close</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </DialogContent >
        </Dialog >
    );
}