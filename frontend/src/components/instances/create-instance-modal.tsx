'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
    DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Badge, Button, Input, Label, Tooltip, TooltipContent, TooltipTrigger, UISelect } from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import { useInstanceStore } from '@/lib/zustand/instances/instances';
import { useProjectStore } from '@/lib/zustand/projects/createproject';
import { useClientStore } from '@/lib/zustand/clients/client';
import { useUserStore } from '@/lib/zustand/user/addUser';
import { CalendarClock, Users, ChevronDown, ChevronUp, AlertTriangle, Layout, UserCircle, Repeat, Plus, Trash2, Play } from 'lucide-react';
import { useHolidayStore } from '@/lib/zustand/holidays/holiday';
import { useAuthStore } from '@/lib/zustand/user/user';
import { UserSelect } from '@/components/ui/user-select';
import { AddClientModal } from '../clients/add-client-modal';
import Loader from '../ui/loader';
import { cn } from '@/lib/utils';
import { ClientSelect } from '../ui/client-select';


interface CreateInstanceModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

interface ApproverRow {
    level: number;
    approver_id: string;
    allocated_minutes: number;
}

interface TaskAssignmentRow {
    template_task_id: string;
    title: string;
    step_order: number;
    estimated_minutes: number;
    original_estimated_minutes: number;
    approval_required: boolean;
    approval_levels: number;
    assigned_role: string;
    assigned_user_id: string;
    approver_turnaround_minutes: number;
    /** Turnaround expressed in HOURS (always). Stored as a string for input binding. */
    turnaround_hours: string;
    original_turnaround_hours: string;
    approvers: ApproverRow[];
    description?: string;
}

/**
 * Converts turnaround hours → working minutes.
 * We always use hours as the unit so there is no ambiguity:
 *   1 h = 60 working minutes
 *   8 h = 1 full working day (backend counts only inside office hours)
 */
function hoursToMinutes(hours: string): number {
    const n = Number(hours);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.round(n * 60);
}

function isWorkingDay(d: Date, holidays: any[]) {
    const day = d.getDay();
    if (day === 0 || day === 6) return false;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dayDate = String(d.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${dayDate}`;
    if (holidays?.some(h => h.holiday_date === dateStr)) return false;
    return true;
}

function addWorkingMinutesLocal(startDate: Date, minutesToAdd: number, holidays: any[]): Date {
    let current = new Date(startDate);
    current.setSeconds(0, 0); // clear seconds and ms to prevent precision bugs
    let remaining = Math.round(minutesToAdd);

    if (remaining <= 0) return current;

    while (remaining > 0) {
        while (!isWorkingDay(current, holidays)) {
            current.setDate(current.getDate() + 1);
            current.setHours(9, 30, 0, 0);
        }

        const h = current.getHours();
        const m = current.getMinutes();
        const totalMins = h * 60 + m;

        // 9:30 = 570, 13:30 = 810, 14:30 = 870, 18:30 = 1110
        if (totalMins < 570) {
            current.setHours(9, 30, 0, 0);
            continue;
        }

        if (totalMins >= 1110) {
            current.setDate(current.getDate() + 1);
            current.setHours(9, 30, 0, 0);
            continue;
        }

        if (totalMins >= 810 && totalMins < 870) {
            current.setHours(14, 30, 0, 0);
            continue;
        }

        let nextBoundary = 1110;
        if (totalMins < 810) nextBoundary = 810;

        const minutesToBoundary = nextBoundary - totalMins;
        const advance = Math.min(remaining, Math.max(1, minutesToBoundary));

        current = new Date(current.getTime() + advance * 60000);
        remaining -= advance;
    }

    return current;
}

export function CreateInstanceModal({ open, onOpenChange }: CreateInstanceModalProps) {
    const { addToast } = useToast();
    const { projects, fetchprojects } = useProjectStore();
    const { clients, fetchClients } = useClientStore();
    const { user } = useAuthStore();
    const { users, fetchUsers } = useUserStore();
    const { createInstance, fetchTemplateTasks, templateTasks, instanceLoading, templateTasksinstanceLoading } = useInstanceStore();

    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [selectedClientId, setSelectedClientId] = useState('');
    const [targetType, setTargetType] = useState<'CLIENT' | 'SERVICE'>('CLIENT');
    const [instanceName, setInstanceName] = useState('');
    const [startImmediately, setStartImmediately] = useState(false);
    const [scheduleLater, setScheduleLater] = useState(false);
    const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
    const [scheduledAt, setScheduledAt] = useState('');
    const [recurrenceInterval, setRecurrenceInterval] = useState('');
    const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
    const [rows, setRows] = useState<TaskAssignmentRow[]>([]);
    const today = new Date().toISOString().split("T")[0];
    const { holidays, fetchHolidays } = useHolidayStore();
    const [errors, setErrors] = useState<Record<string, boolean>>({});

    useEffect(() => {
        if (!open) {
            setErrors({});
        }
    }, [open]);

    useEffect(() => {
        if (open) {
            fetchprojects();
            fetchClients(undefined, 1, 100);
            // fetchUsers();
            fetchHolidays();
        }
    }, [open]);


    // schedule date validation on the basis of working days and holidays
    useEffect(() => {
        if (!scheduledAt) return;

        // Weekend Check
        const day = new Date(scheduledAt + "T00:00:00").getDay();
        if (day === 0 || day === 6) {
            setScheduledAt('');
            addToast({
                title: 'Invalid Date',
                description: 'Instances cannot be scheduled on weekends.',
                variant: 'destructive'
            });
            return;
        }

        // Holiday Check
        const isHoliday = holidays?.some(
            (holiday) => holiday.holiday_date === scheduledAt
        );

        if (isHoliday) {
            setScheduledAt('');
            addToast({
                title: 'Holiday Selected',
                description: 'Instances cannot be scheduled on company holidays.',
                variant: 'destructive'
            });
            return;
        }

    }, [scheduledAt, holidays]);

    useEffect(() => {
        if (selectedProjectId) {
            fetchTemplateTasks(selectedProjectId);
            setErrors(prev => ({ ...prev, template: false }));
        }
    }, [selectedProjectId]);

    // Build rows from template tasks
    useEffect(() => {
        if (templateTasks.length > 0) {
            setRows(templateTasks.map(t => {
                const turnaroundHours = String(Math.round((t.turnaround_minutes || 60) / 60));
                return {
                    template_task_id: t.id,
                    title: t.title,
                    step_order: t.step_order,
                    estimated_minutes: t.estimated_minutes,
                    original_estimated_minutes: t.estimated_minutes,
                    approval_required: t.approval_required,
                    approval_levels: t.approval_levels || 1,
                    assigned_role: t.assigned_role || 'copywriter',
                    assigned_user_id: '',
                    approver_turnaround_minutes: t.approver_turnaround_minutes || 240,
                    // Convert stored minutes → hours for display.
                    // e.g. template saved 480 min → shows as 8h (= 1 working day)
                    turnaround_hours: turnaroundHours,
                    original_turnaround_hours: turnaroundHours,
                    approvers: Array.from({ length: t.approval_levels || 1 }, (_, i) => ({
                        level: i + 1,
                        approver_id: '',
                        allocated_minutes: t.approver_turnaround_minutes || 240,
                    })),
                };
            }));
        } else {
            setRows([]);
        }
    }, [templateTasks]);

    const taskEndDates = useMemo(() => {
        if (!startImmediately && (!scheduleLater || !scheduledAt)) return [];

        let current = startImmediately ? new Date() : new Date(`${scheduledAt}T09:30:00`);
        const results: Date[] = [];

        for (const row of rows) {
            const workerMinutes = hoursToMinutes(row.turnaround_hours);
            const totalTaskMinutes = workerMinutes + (row.approval_required ? row.approvers.reduce((sum, a) => sum + (a.allocated_minutes || 240), 0) : 0);
            const endDate = addWorkingMinutesLocal(current, totalTaskMinutes, holidays || []);
            results.push(endDate);
            current = endDate;
        }

        return results;
    }, [rows, startImmediately, scheduleLater, scheduledAt, holidays]);

    const estEndDate = taskEndDates[taskEndDates.length - 1];

    const updateRow = (idx: number, field: keyof TaskAssignmentRow, value: any) => {
        setRows(prev => {
            const copy = [...prev];
            copy[idx] = { ...copy[idx], [field]: value };
            return copy;
        });
    };

    const updateApprover = (rowIdx: number, level: number, field: keyof ApproverRow, value: any) => {
        setRows(prev => {
            const copy = [...prev];
            copy[rowIdx] = {
                ...copy[rowIdx],
                approvers: copy[rowIdx].approvers.map(a =>
                    a.level === level ? { ...a, [field]: value } : a
                ),
            };
            return copy;
        });
    };

    const addApprover = (rowIdx: number) => {
        setRows(prev => {
            const copy = [...prev];
            const currentApprovers = copy[rowIdx].approvers || [];
            const newLevel = currentApprovers.length + 1;
            copy[rowIdx] = {
                ...copy[rowIdx],
                approvers: [...currentApprovers, { level: newLevel, approver_id: '', allocated_minutes: copy[rowIdx].approver_turnaround_minutes }],
                approval_levels: newLevel,
            };
            return copy;
        });
    };

    const removeApprover = (rowIdx: number, levelToRemove: number) => {
        setRows(prev => {
            const copy = [...prev];
            const filtered = copy[rowIdx].approvers.filter(a => a.level !== levelToRemove);
            const newApprovers = filtered.map((a, idx) => ({ ...a, level: idx + 1 }));
            copy[rowIdx] = {
                ...copy[rowIdx],
                approvers: newApprovers,
                approval_levels: newApprovers.length,
            };
            return copy;
        });
    };

    const handleCreate = async () => {
        const newErrors: Record<string, boolean> = {};
        if (!selectedProjectId) newErrors.template = true;
        if (!selectedClientId) newErrors.client = true;
        if (!instanceName.trim()) newErrors.name = true;
        if (!startImmediately && !scheduleLater) newErrors.timing = true;
        if (scheduleLater && !scheduledAt) newErrors.scheduledAt = true;

        setErrors(newErrors);

        if (Object.keys(newErrors).length > 0) {
            addToast({
                title: 'Missing fields',
                description: 'Please select or fill all required fields highlighted in red.',
                variant: 'destructive',
            });
            return;
        }

        if (rows.length === 0) {
            addToast({ title: 'No Tasks', description: 'The selected template has no tasks.', variant: 'destructive' });
            return;
        }

        // Check that all required approvers are selected
        const missingApprovers = rows.filter(
            row => row.approval_required && row.approvers.some(a => !a.approver_id)
        );
        if (missingApprovers.length > 0) {
            addToast({
                title: 'Missing Approvers',
                description: `Please select all approvers for: ${missingApprovers.map(r => r.title).join(', ')}`,
                variant: 'destructive',
            });
            return;
        }

        const task_assignments = rows.map(row => ({
            template_task_id: row.template_task_id,
            assigned_user_id: row.assigned_user_id,
            effort_minutes: Number(row.estimated_minutes),
            // Always hours → minutes. Backend addWorkingMinutes then counts
            // only inside office hours (8 h/day), so 8 h = exactly 1 working day.
            turnaround_minutes: hoursToMinutes(row.turnaround_hours),
            approvers: row.approval_required
                ? row.approvers.filter(a => a.approver_id)
                : [],
        }));
        try {
            const ok = await createInstance({
                project_id: selectedProjectId,
                company_id: user?.company_id || '',
                client_id: selectedClientId || undefined,
                name: instanceName,
                scheduled_at: scheduleLater && scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
                task_assignments,
                recurrence_interval: recurrenceInterval || undefined,
                recurrence_end_date: (recurrenceInterval && recurrenceEndDate) ? recurrenceEndDate : undefined,
            });

            if (ok) {
                const isScheduled = scheduleLater && scheduledAt;
                addToast({
                    title: isScheduled ? 'Instance Scheduled! 📅' : 'Instance Created! 🚀',
                    description: isScheduled
                        ? `"${instanceName}" is scheduled for ${new Date(scheduledAt).toLocaleDateString('en-IN')}.`
                        : `"${instanceName}" is now live.`,
                    variant: 'success',
                });
                setSelectedProjectId(''); setSelectedClientId(''); setInstanceName('');
                setScheduleLater(false); setScheduledAt(''); setRows([]);
                setRecurrenceInterval(''); setRecurrenceEndDate('');
                onOpenChange(false);
            }
        } catch (error: any) {
            const message = error?.response?.data?.message || 'Failed to create instance';
            addToast({ title: 'Error', description: message, variant: 'destructive' });
        }
    };

    const roleLabel = (role: string) => {
        const map: Record<string, string> = { copywriter: 'Copywriter', designer: 'Designer', reviewer: 'Reviewer' };
        return map[role] || role;
    };

    const interim_managers = users.filter((u: any) => u.workflow_role === 'interim_manager');


    const reviewers = useMemo(() => users.filter((u: any) => u.workflow_role === 'reviewer'), [users]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[1100px] max-h-[80vh] overflow-y-auto custom-scrollbar">
                <DialogHeader>
                    <DialogTitle>Create New Instance</DialogTitle>
                    <DialogDescription>Select a template and assign users to each task</DialogDescription>
                </DialogHeader>

                <div className="space-y-5 py-2 relative min-h-[400px]">
                    {/* Premium Loading Overlay */}
                    {instanceLoading && (
                        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/70 dark:bg-black/70 backdrop-blur-lg animate-in fade-in duration-700 rounded-xl">
                            <div className="w-full max-w-2xl px-8 transform -translate-y-4">
                                <Loader />
                                <div className="mt-8 flex flex-col items-center gap-2">
                                    <div className="flex gap-1">
                                        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                                        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                                        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" />
                                    </div>
                                    <p className="text-[10px] font-bold text-muted-foreground tracking-[0.3em] uppercase opacity-70">
                                        Initializing instance
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Template and Target Entity Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                        {/* Template */}
                        <div className="flex flex-col gap-1.5">
                            <Label className="text-xs font-semibold text-muted-foreground">Template</Label>
                            <UISelect
                                value={selectedProjectId}
                                onValueChange={(val) => {
                                    setSelectedProjectId(val);
                                    setErrors(prev => ({ ...prev, template: false }));
                                }}
                                placeholder="— Select a template —"
                                options={projects.map(p => ({
                                    value: p.id,
                                    label: p.name,
                                    icon: Layout
                                }))}
                            />
                            {errors.template && (
                                <div className="h-0.5 bg-red-500 w-full animate-in fade-in duration-200 mt-0.5" />
                            )}
                            {templateTasks.length > 0 && (
                                <p className="text-[11px] text-muted-foreground px-1">{templateTasks?.length} task(s) in this template</p>
                            )}
                            {projects.length === 0 && (
                                <p className="text-[11px] text-red-500 px-1">No templates found. Please ask admin to create a template first.</p>
                            )}
                        </div>

                        {/* Client / Service */}
                        <div className="flex flex-col gap-1.5">
                            <Label className="text-xs font-semibold text-muted-foreground">
                                Target Entity
                            </Label>
                            <ClientSelect
                                className="w-full"
                                value={selectedClientId}
                                onChange={(val) => {
                                    setSelectedClientId(val);
                                    setErrors(prev => ({ ...prev, client: false }));
                                }}
                                roles={[targetType]} // Passes 'CLIENT' or 'SERVICE' to the search
                                placeholder={targetType === 'CLIENT' ? "— Select a client —" : "— Select a service —"}
                            />
                            {errors.client && (
                                <div className="h-0.5 bg-red-500 w-full animate-in fade-in duration-200 mt-0.5" />
                            )}
                        </div>
                    </div>

                    <AddClientModal open={isQuickAddOpen} onOpenChange={setIsQuickAddOpen} />

                    {/* Instance name */}
                    <div>
                        <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Instance Name</Label>
                        <Input
                            placeholder="e.g. Q1 2025 Campaign"
                            value={instanceName}
                            onChange={e => {
                                setInstanceName(e.target.value);
                                setErrors(prev => ({ ...prev, name: false }));
                            }}
                        />
                        {errors.name && (
                            <div className="h-0.5 bg-red-500 w-full animate-in fade-in duration-200 mt-0.5" />
                        )}
                    </div>

                    {/* Schedule & Recurrence Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Schedule */}
                        <div className={cn(
                            "rounded-xl border p-4 space-y-3 bg-muted/10 transition-colors",
                            errors.timing ? "border-red-500" : "border-border/50"
                        )}>
                            <label className="flex items-center gap-2 cursor-pointer mb-2">
                                <input type="radio" className="h-4 w-4 rounded accent-primary border-border/50 focus:ring-primary/20" checked={startImmediately} onChange={e => {
                                    setStartImmediately(e.target.checked);
                                    if (e.target.checked) {
                                        setScheduleLater(false);
                                        setErrors(prev => ({ ...prev, timing: false, scheduledAt: false }));
                                    }
                                }} />
                                <Play className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-medium text-foreground">Start immediately</span>
                            </label>

                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" className="h-4 w-4 rounded accent-primary border-border/50 focus:ring-primary/20" checked={scheduleLater} onChange={e => {
                                    setScheduleLater(e.target.checked);
                                    if (e.target.checked) {
                                        setStartImmediately(false);
                                        setErrors(prev => ({ ...prev, timing: false }));
                                    }
                                }} />
                                <CalendarClock className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-medium text-foreground">Schedule for later</span>
                            </label>

                            {scheduleLater ? (
                                <div className="space-y-1.5 animate-in slide-in-from-top-2 fade-in duration-200">
                                    <Label className="text-xs font-semibold text-muted-foreground block text-left">Pick Start Date</Label>
                                    <Input type="date" min={today} value={scheduledAt}
                                        className='w-fit'
                                        onChange={e => {
                                            setScheduledAt(e.target.value);
                                            setErrors(prev => ({ ...prev, scheduledAt: false }));
                                        }} />
                                    {errors.scheduledAt && (
                                        <div className="h-0.5 bg-red-500 w-full animate-in fade-in duration-200 mt-0.5" />
                                    )}
                                    {estEndDate && (
                                        <div className="text-[11px] text-blue-600 font-medium mt-1.5 flex items-center gap-1 bg-blue-50/50 w-fit px-1.5 py-0.5 rounded-sm border border-blue-100">
                                            {/* <CalendarClock className="h-3 w-3" /> */}
                                            {/* Est. End: 20 December 10:00 PM */}
                                            This Insatnce will end on {estEndDate.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="pt-2">
                                    <p className="text-[11px] text-muted-foreground/70">
                                        {startImmediately ? "Instance will start immediately upon creation." : "Please select when to start the instance."}
                                    </p>
                                    {estEndDate && (
                                        <div className="text-[11px] text-blue-600 font-medium mt-1.5 flex items-center gap-1 bg-blue-50/50 w-fit px-1.5 py-0.5 rounded-sm border border-blue-100">
                                            {/* <CalendarClock className="h-3 w-3" /> */}
                                            {/* Est. End: 20 December 10:00 PM */}
                                            This Insatnce will end on {estEndDate.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Recurrence */}
                        <div className="rounded-xl border border-border/50 p-4 space-y-3 bg-muted/10">
                            <div className="flex items-center gap-2">
                                <Repeat className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-medium text-foreground">Repeat automatically</span>
                            </div>
                            <UISelect
                                value={recurrenceInterval}
                                onValueChange={(val) => { setRecurrenceInterval(val); if (!val) setRecurrenceEndDate(''); }}
                                placeholder="— No repeat —"
                                className="w-full"
                                options={[
                                    { value: '', label: 'No repeat' },
                                    { value: '1 week', label: 'Every week' },
                                    { value: '1 month', label: 'Every month' },
                                    { value: '3 months', label: 'Every 3 months' },
                                    { value: '6 months', label: 'Every 6 months' },
                                ]}
                            />
                            {recurrenceInterval ? (
                                <div className="space-y-1.5 animate-in slide-in-from-top-2 fade-in duration-200">
                                    <Label className="text-xs font-semibold text-muted-foreground block text-left">End repeat on (optional)</Label>
                                    <Input
                                        type="date"
                                        min={today}
                                        value={recurrenceEndDate}
                                        onChange={e => setRecurrenceEndDate(e.target.value)}
                                        placeholder="No end date"
                                    />
                                    <p className="text-[11px] text-muted-foreground/70 text-left">Leave blank to repeat indefinitely.</p>
                                </div>
                            ) : (
                                <div className="pt-0.5">
                                    <p className="text-[11px] text-muted-foreground/70">Instance will not repeat after completion.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Task assignments */}
                    {rows.length > 0 && (
                        <div>
                            <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                                <Users className="h-4 w-4 text-primary" /> Process Assignments
                            </h3>

                            <div className="rounded-xl border border-border overflow-hidden overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-muted/50 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                                        <tr>
                                            <th className="text-left px-4 py-3 font-medium">Task</th>
                                            <th className="text-center px-4 py-3 font-medium">Duration</th>
                                            <th className="text-center px-4 py-3 font-medium">Turnaround</th>
                                            <th className="text-left px-4 py-3 font-medium w-[200px]">Assign To</th>
                                            <th className="text-left px-4 py-3 font-medium min-w-[320px]">Approvers</th>
                                        </tr>
                                    </thead>

                                    {templateTasksinstanceLoading ? (
                                        <tbody>
                                            <tr>
                                                <td colSpan={5} className="text-center py-8">
                                                    <Loader />
                                                </td>
                                            </tr>
                                        </tbody>
                                    ) : rows.length === 0 ? (
                                        <tbody>
                                            <tr>
                                                <td colSpan={5} className="text-center py-8">
                                                    <div className="text-sm text-muted-foreground border border-dashed rounded-lg p-4">
                                                        No tasks defined for this template. Ask admin to add tasks first.
                                                    </div>
                                                </td>
                                            </tr>
                                        </tbody>
                                    ) : (
                                        <tbody className="divide-y divide-border">
                                            {rows.map((row, idx) => (
                                                <tr key={row.template_task_id} className="bg-card hover:bg-muted/30 transition-colors">
                                                    {/* Task info */}
                                                    <td className="px-4 py-3 align-top min-w-[200px]">
                                                        <div className="font-medium text-sm">{row.title}</div>
                                                        {row.description && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{row.description}</p>}
                                                        {taskEndDates[idx] && (
                                                            <div className="text-[11px] text-blue-600 font-medium mt-1.5 flex items-center gap-1 bg-blue-50/50 w-fit px-1.5 py-0.5 rounded-sm border border-blue-100">
                                                                <CalendarClock className="h-3 w-3" />
                                                                Est. End: {taskEndDates[idx].toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                                            </div>
                                                        )}
                                                        <p className="text-[10px] text-muted-foreground mt-1">{roleLabel(row.assigned_role)}</p>
                                                        {row.approval_required && (
                                                            <span className="text-[9px] border border-border rounded px-1 py-0.5 mt-0.5 inline-block text-muted-foreground">
                                                                Approval
                                                            </span>
                                                        )}
                                                    </td>

                                                    {/* Effort (Editable) */}
                                                    <td className="text-center px-4 py-3 align-top w-[120px]">
                                                        <div className="flex flex-col gap-1 items-center">
                                                            <div className="flex items-center gap-1">
                                                                <Input
                                                                    type="number"
                                                                    min={0}
                                                                    value={row.estimated_minutes === 0 ? '' : row.estimated_minutes}
                                                                    onChange={e => {
                                                                        let val = e.target.value;
                                                                        if (val.length > 1 && val.startsWith('0')) val = val.slice(1);
                                                                        updateRow(idx, 'estimated_minutes', val === '' ? 0 : Number(val));
                                                                    }}
                                                                    className="h-8 w-[70px] text-center px-2"
                                                                />
                                                                <span className="text-xs text-muted-foreground w-4">m</span>
                                                            </div>
                                                            {row.estimated_minutes !== row.original_estimated_minutes && (
                                                                <span className="text-[10px] text-red-500 font-medium flex items-center justify-center w-full mt-0.5 leading-tight">
                                                                    <AlertTriangle className="h-3 w-3 mr-1 inline shrink-0" /> <span className="text-left">Default time has changed.</span>
                                                                </span>
                                                            )}

                                                        </div>
                                                    </td>

                                                    {/* Turnaround (Editable) */}
                                                    <td className="text-center px-4 py-3 align-top w-[120px]" title={`${row.turnaround_hours}h working time (holidays excluded)`}>
                                                        <div className="flex flex-col gap-1 items-center">
                                                            <div className="flex items-center gap-1">
                                                                <Input
                                                                    type="number"
                                                                    min={0}
                                                                    value={row.turnaround_hours === '0' ? '' : row.turnaround_hours}
                                                                    onChange={e => {
                                                                        let val = e.target.value;
                                                                        if (val.length > 1 && val.startsWith('0')) val = val.slice(1);
                                                                        updateRow(idx, 'turnaround_hours', val === '' ? '0' : val);
                                                                    }}
                                                                    className="h-8 w-[70px] text-center px-2"
                                                                />
                                                                <span className="text-xs text-muted-foreground w-4">h</span>
                                                            </div>
                                                            {Number(row.turnaround_hours) !== Number(row.original_turnaround_hours) && (
                                                                <span className="text-[10px] text-red-500 font-medium flex items-center justify-center w-full mt-0.5 leading-tight">
                                                                    <AlertTriangle className="h-3 w-3 mr-1 inline shrink-0" /> <span className="text-left">Default time has changed.</span>
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>

                                                    <td className="px-6 py-3 align-top">
                                                        <UserSelect
                                                            className="h-8 w-[180px]"
                                                            value={row.assigned_user_id}
                                                            onChange={val => updateRow(idx, 'assigned_user_id', val)}
                                                            roles={['copywriter', 'designer', 'reviewer']}
                                                            placeholder="Assign to..."
                                                        />
                                                    </td>

                                                    {/* Approver levels */}
                                                    <td className="px-4 py-3 align-top">
                                                        <div className="flex flex-col gap-1.5">
                                                            {row.approval_required ? (
                                                                <>
                                                                    {row.approvers.map(approver => {
                                                                        const isLastLevel = approver.level === row.approval_levels;
                                                                        const isRestrictedLastLevel = isLastLevel && row.approval_levels > 1;
                                                                        return (
                                                                            <div key={approver.level} className="flex flex-row gap-1 items-center">
                                                                                <div className="flex items-center gap-1.5 w-[55px]">
                                                                                    <Badge className="text-[10px] font-bold bg-muted px-1.5 rounded text-muted-foreground shrink-0 w-full text-center">
                                                                                        L{approver.level}
                                                                                    </Badge>
                                                                                </div>
                                                                                <div className="flex items-center gap-1 ml-1 bg-white rounded-md border border-input shadow-sm">
                                                                                    <Input
                                                                                        type="number"
                                                                                        min={1}
                                                                                        value={approver.allocated_minutes ? Math.round(approver.allocated_minutes / 60) : ''}
                                                                                        onChange={e => {
                                                                                            let val = Number(e.target.value);
                                                                                            if (val < 1) val = 1;
                                                                                            updateApprover(idx, approver.level, 'allocated_minutes', val * 60);
                                                                                        }}
                                                                                        title="Time allocated to this approver"
                                                                                        className="h-8 w-[50px] border-0 focus-visible:ring-0 text-center px-1"
                                                                                        placeholder="Hrs"
                                                                                    />
                                                                                    <span className="text-[10px] text-muted-foreground pr-2 font-medium">h</span>
                                                                                </div>
                                                                                <UserSelect
                                                                                    className="h-8 w-[150px]"
                                                                                    value={approver.approver_id}
                                                                                    onChange={val => updateApprover(idx, approver.level, 'approver_id', val)}
                                                                                    roles={isRestrictedLastLevel ? ['interim_manager', 'reviewer'] : ['copywriter', 'designer', 'reviewer', 'interim_manager']}
                                                                                    placeholder={isRestrictedLastLevel ? 'Manager / Reviewer *' : `Approver ${approver.level} *`}
                                                                                    excludeIds={[
                                                                                        row.assigned_user_id,
                                                                                        ...row.approvers
                                                                                            .filter(a => a.level !== approver.level)
                                                                                            .map(a => a.approver_id),
                                                                                    ].filter(Boolean)}
                                                                                />

                                                                                <Button
                                                                                    variant="ghost"
                                                                                    size="icon"
                                                                                    className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 ml-1 shrink-0"
                                                                                    onClick={() => removeApprover(idx, approver.level)}
                                                                                    title="Remove approver"
                                                                                >
                                                                                    <Trash2 className="h-4 w-4" />
                                                                                </Button>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                    <div className="flex items-center justify-between mt-1">
                                                                        <Button
                                                                            variant="outline"
                                                                            size="sm"
                                                                            className="h-6 text-[10px] px-2 rounded-md"
                                                                            onClick={() => addApprover(idx)}
                                                                        >
                                                                            <Plus className="h-3 w-3 mr-1" /> Add Level
                                                                        </Button>
                                                                        {row.approval_levels > 1 && (
                                                                            <p className="text-[9px] text-muted-foreground ml-auto">
                                                                                Sequential approval
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                </>
                                                            ) : (
                                                                <span className="text-xs text-muted-foreground/50">N/A</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    )}
                                </table>
                            </div>
                        </div>
                    )}

                    {/* {selectedProjectId && instanceLoading && (
                        <div className="text-center py-4 text-sm text-muted-foreground"><Loader /></div>
                    )} */}
                    {selectedProjectId && !instanceLoading && rows.length === 0 && (
                        <div className="text-center py-4 text-sm text-muted-foreground border border-dashed rounded-lg">
                            No tasks defined for this template. Ask admin to add tasks first.
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} className={`${instanceLoading ? 'hidden' : 'cursor-pointer'}`}>Cancel</Button>
                    <Button onClick={handleCreate} disabled={instanceLoading} className={` ${instanceLoading ? 'hidden' : 'cursor-pointer'}`}>
                        {instanceLoading ? 'Creating...' : '🚀 Create Instance'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
