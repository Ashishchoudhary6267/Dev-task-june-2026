import { useManualTaskStore } from '@/lib/zustand/tasks/manual-tasks';
import { ManualTask } from '@/lib/types/auth';
import { Button, UISelect, useToast } from '@/components/ui';
import { useEffect, useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input, Label } from '@/components/ui';
import { Layout, Loader2 } from 'lucide-react';
import { useProjectStore } from '@/lib/zustand/projects/createproject';
import { UserSelect } from '../ui/user-select';
interface TaskModalProps {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    editTask?: ManualTask | null;
    users: any[];
    onSaved: () => void;
    companyId: string;
}
const EMPTY_FORM = {
    title: '',
    description: '',
    project_id: '',
    assigned_user_id: '',
    priority: 'medium' as 'low' | 'medium' | 'high',
    estimated_minutes: 30,
    turnaround_minutes: 0,
    due_date: '',
    approval_required: false,
    approval_levels: 1,
    approvers: [] as { level: number; approver_id: string }[],
};
export default function TaskModal({ open, onOpenChange, editTask, users, onSaved, companyId }: TaskModalProps) {
    const { createManualTask, updateManualTask, loading } = useManualTaskStore();
    const { addToast } = useToast();
    const { projects, fetchprojects } = useProjectStore();


    const [form, setForm] = useState(EMPTY_FORM);


    useEffect(() => {
        if (open) {
            fetchprojects();
        }
    }, [open]);

    useEffect(() => {
        if (!form.due_date) return;

        const selectedDate = new Date(form.due_date);
        const day = selectedDate.getDay(); // 0 = Sunday, 6 = Saturday

        if (day === 0 || day === 6) {
            addToast({
                title: 'Task due date cannot be on weekend',
                variant: 'destructive'
            });

            // reset due date
            setForm(prev => ({ ...prev, due_date: '' }));
        }
    }, [form.due_date]);

    useEffect(() => {
        if (editTask) {
            setForm({
                title: editTask.title,
                description: editTask.description || '',
                project_id: editTask.project_id || '',
                assigned_user_id: editTask.assigned_user_id,
                priority: editTask.priority,
                estimated_minutes: editTask.estimated_minutes,
                turnaround_minutes: editTask.turnaround_minutes || 0,
                due_date: editTask.due_date ? editTask.due_date.split('T')[0] : '',
                approval_required: editTask.approval_required,
                approval_levels: editTask.approval_levels || 1,
                approvers: editTask.task_approval_levels?.map(al => ({ level: al.level_number, approver_id: al.approver_id })) || [],
            });
        } else {
            setForm(EMPTY_FORM);
        }
    }, [editTask, open]);

    const updateApprover = (level: number, approver_id: string) => {
        setForm(prev => {
            const existing = prev.approvers.filter(a => a.level !== level);
            if (!approver_id) return { ...prev, approvers: existing };
            return { ...prev, approvers: [...existing, { level, approver_id }] };
        });
    };

    const getApproverForLevel = (level: number) =>
        form.approvers.find(a => a.level === level)?.approver_id || '';

    const teamMembers = users.filter(u => u.platform_role === 'member' || u.platform_role === 'controller');

    // Get available approvers for a given level, excluding the assigned user and users already selected at other levels
    const getAvailableApproversForLevel = useCallback((level: number) => {
        const assignedId = String(form.assigned_user_id);
        const otherApproverIds = form.approvers
            .filter(a => a.level !== level && a.approver_id)
            .map(a => String(a.approver_id));

        return users.filter(u => {
            const uid = String(u.id);
            // Exclude the assigned user (can't approve own task)
            if (uid === assignedId) return false;
            // Exclude users already selected at other approval levels
            if (otherApproverIds.includes(uid)) return false;
            return true;
        });
    }, [users, form.assigned_user_id, form.approvers]);

    const handleSubmit = async () => {
        if (!form.title.trim()) return addToast({ title: 'Task title is required', variant: 'destructive' });
        if (!form.assigned_user_id) return addToast({ title: 'Please assign the task to a team member', variant: 'destructive' });
        if (form.approval_required && form.approvers.filter(a => a.approver_id).length < form.approval_levels) {
            return addToast({ title: 'Please assign all approvers', variant: 'destructive' });
        }

        let ok: boolean;
        if (editTask) {
            ok = await updateManualTask(editTask.id, {
                title: form.title,
                description: form.description,
                project_id: form.project_id,
                priority: form.priority,
                estimated_minutes: form.estimated_minutes,
                turnaround_minutes: form.turnaround_minutes,
                due_date: form.due_date || undefined,
            });
        } else {
            ok = await createManualTask({
                ...form,
                due_date: form.due_date || undefined,
                company_id: companyId,
            });
        }

        if (ok) {
            addToast({ title: editTask ? 'Task updated' : 'Task created & member notified', variant: 'success' });
            onOpenChange(false);
            onSaved();
        } else {
            addToast({ title: 'Something went wrong', variant: 'destructive' });
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[580px] max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{editTask ? 'Edit Task' : 'Create Manual Task'}</DialogTitle>
                    <DialogDescription>
                        {editTask ? 'Update the task details.' : 'Assign a new ad-hoc task to a team member with SLA tracking.'}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {/* Title */}
                    <div className="space-y-1.5">
                        <Label className="text-sm font-semibold">Task Title *</Label>
                        <Input
                            placeholder="e.g., Review client proposal"
                            value={form.title}
                            onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                            className="h-10"
                        />
                    </div>

                    {/* Description */}
                    <div className="space-y-1.5">
                        <Label className="text-sm font-semibold">Description</Label>
                        <textarea
                            className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-none"
                            placeholder="Additional details about the task..."
                            value={form.description}
                            onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                        />
                    </div>
                    <div>
                        <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Template</Label>
                        <UISelect
                            value={form.project_id}
                            onValueChange={(val) => setForm(p => ({ ...p, project_id: val }))}
                            className="w-full"
                            placeholder="— Select a template —"
                            options={projects.map(p => ({
                                value: p.id,
                                label: p.name,
                                icon: Layout
                            }))}
                        />
                        {/* {templateTasks.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-1">{templateTasks.length} task(s) in this template</p>
                        )} */}
                    </div>

                    {/* Assign To + Priority */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label className="text-sm font-semibold">Assign To *</Label>
                            {/* <select
                                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                                value={form.assigned_user_id}
                                onChange={e => {
                                    const newId = e.target.value;
                                    setForm(p => ({
                                        ...p,
                                        assigned_user_id: newId,
                                        approvers: p.approvers.filter(a => String(a.approver_id) !== String(newId)),
                                    }));
                                }}
                                disabled={!!editTask}
                            >
                                <option value="">Select team member</option>
                                {users.map(u => (
                                    <option key={u.id} value={u.id}>{u.name}</option>
                                ))}
                            </select> */}

                            <UserSelect
                                value={form.assigned_user_id}
                                onChange={newId => {
                                    setForm(p => ({
                                        ...p,
                                        assigned_user_id: newId,
                                        approvers: p.approvers.filter(a => String(a.approver_id) !== String(newId)),
                                    }));
                                }}
                                disabled={!!editTask}
                            />
                            {users.length > 0 && (
                                <p className="text-[10px] text-muted-foreground">{users.length} member(s) available</p>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-sm font-semibold">Priority *</Label>
                            <select
                                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                                value={form.priority}
                                onChange={e => setForm(p => ({ ...p, priority: e.target.value as any }))}
                            >
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                            </select>
                        </div>
                    </div>

                    {/* Duration + Turnaround */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label className="text-sm font-semibold">Task Duration (Minutes) *</Label>
                            <Input
                                type="number" min={1}
                                className="h-10"
                                value={form.estimated_minutes}
                                onChange={e => setForm(p => ({ ...p, estimated_minutes: Number(e.target.value) }))}
                            />
                            <p className="text-[10px] text-muted-foreground">Actual work effort</p>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-sm font-semibold">Turnaround Time (Hours) *</Label>
                            <Input
                                type="number" min={0}
                                className="h-10"
                                value={form.turnaround_minutes ? Math.round(form.turnaround_minutes / 60) : 0}
                                onChange={e => setForm(p => ({ ...p, turnaround_minutes: Number(e.target.value) * 60 }))}
                            />
                            <p className="text-[10px] text-muted-foreground">Deadline window (8 hours means 1 working day)</p>
                        </div>
                    </div>

                    {/* Due Date */}
                    <div className="space-y-1.5">
                        <Label className="text-sm font-semibold">Due Date *</Label>
                        <Input
                            type="date"
                            className="h-10"
                            value={form.due_date}
                            onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))}
                        />
                    </div>

                    {/* Requires Approval toggle */}
                    <div className="flex items-center justify-between rounded-lg border border-border p-4 bg-muted/20">
                        <div>
                            <p className="text-sm font-semibold">Requires Approval</p>
                            <p className="text-xs text-muted-foreground mt-0.5">Task must be approved before being marked complete</p>
                        </div>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={form.approval_required}
                            onClick={() => setForm(p => ({ ...p, approval_required: !p.approval_required, approvers: [] }))}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${form.approval_required ? 'bg-primary' : 'bg-gray-200'}`}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.approval_required ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                    </div>

                    {/* Approval config */}
                    {form.approval_required && (
                        <div className="rounded-lg border border-border p-4 space-y-4">
                            <div className="space-y-1.5">
                                <Label className="text-sm font-semibold">Approval Levels (1-5)</Label>
                                <select
                                    className="w-36 h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                                    value={form.approval_levels}
                                    onChange={e => setForm(p => ({ ...p, approval_levels: Number(e.target.value), approvers: [] }))}
                                >
                                    {[1, 2, 3, 4, 5].map(n => (
                                        <option key={n} value={n}>{n} {n === 1 ? 'Level' : 'Levels'}</option>
                                    ))}
                                </select>
                                <p className="text-[10px] text-muted-foreground">
                                    Requires {form.approval_levels} sequential approval{form.approval_levels > 1 ? 's' : ''}
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-sm font-semibold">Assign Approvers *</Label>
                                {Array.from({ length: form.approval_levels }, (_, i) => i + 1).map(level => (
                                    <div key={level} className="flex items-center gap-3">
                                        <span className="shrink-0 h-7 w-8 rounded-md bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                                            L{level}
                                        </span>
                                        <select
                                            className="flex-1 h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                                            value={getApproverForLevel(level)}
                                            onChange={e => updateApprover(level, e.target.value)}
                                        >
                                            <option value="">Select Level {level} Approver</option>
                                            {getAvailableApproversForLevel(level).map(u => (
                                                <option key={u.id} value={u.id}>{u.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                ))}
                                {form.approval_levels > 1 && (
                                    <p className="text-[10px] text-blue-600">
                                        Sequential approval: {Array.from({ length: form.approval_levels }, (_, i) => `L${i + 1}`).join(' → ')}
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={loading}>
                        {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                        {editTask ? 'Save Changes' : 'Create Task'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}