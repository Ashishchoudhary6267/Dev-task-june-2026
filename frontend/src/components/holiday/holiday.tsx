'use client';

import { useEffect, useState } from "react";
import { Activity, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Badge, Button, Input, Checkbox, Label, Textarea, Tooltip, TooltipTrigger, TooltipContent } from "../ui";
import { useHolidayStore } from "@/lib/zustand/holidays/holiday";
import { useAuthStore } from "@/lib/zustand/user/user";
import { AddHolidayModal } from "./add-holiday-modal";
import { useToast } from "@/components/ui/toast";
import api from "@/lib/api";
import CompanyPage from "@/app/settings/CompanySettingsContent";
import { usePermissions } from '@/lib/hooks/usePermissions';
import { useAccessControl } from '@/lib/contexts/access-control-context';

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function CompanySettings({ companyId: propCompanyId }: { companyId?: string }) {

    const { canCreate, canEdit, canDelete } = useAccessControl();
    const { addToast } = useToast();
    const { user } = useAuthStore();
    const companyId = propCompanyId || user?.company_id;
    const { holidays, loading, fetchHolidays, deleteHoliday } = useHolidayStore();
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    const [workingDays, setWorkingDays] = useState<string[]>(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]);
    const [workStartTime, setWorkStartTime] = useState("09:30");
    const [workEndTime, setWorkEndTime] = useState("18:30");
    const [savingSettings, setSavingSettings] = useState(false);
    const [initialSettings, setInitialSettings] = useState<{
        working_days: string[];
        work_start_time: string;
        work_end_time: string;
    } | null>(null);

    const { hasAccess } = usePermissions();
    const isAdmin = user?.platform_role === 'admin';
    const superAdmin = user?.platform_role === 'superadmin';
    const isMember = user?.platform_role === 'member';
    const fetchCompanySettings = async (cid?: string) => {
        try {
            const response = await api.get('/getCompanySettings', {
                params: { company_id: cid }
            });
            if (response.data) {
                if (response.data.working_days) setWorkingDays(response.data.working_days);
                if (response.data.work_start_time) setWorkStartTime(response.data.work_start_time.substring(0, 5));
                if (response.data.work_end_time) setWorkEndTime(response.data.work_end_time.substring(0, 5));
            }
            setInitialSettings({
                working_days: response.data.working_days,
                work_start_time: response.data.work_start_time,
                work_end_time: response.data.work_end_time
            });
        } catch (error) {
            console.error("Failed to fetch company settings", error);
        }
    };


    useEffect(() => {
        if (companyId) {
            fetchHolidays(companyId);
            fetchCompanySettings(companyId);
        }
    }, [companyId]);

    const noChanges =
        JSON.stringify([...workingDays].sort()) ===
        JSON.stringify([...(initialSettings?.working_days ?? [])].sort()) &&
        workStartTime === (initialSettings?.work_start_time ?? "") &&
        workEndTime === (initialSettings?.work_end_time ?? "");

    const handleSaveWorkingDays = async () => {
        if (!initialSettings) return;

        if (workingDays.length === 0) {
            addToast({ title: "Error", description: "Working days cannot be empty.", variant: "destructive" });
            return;
        }

        if (!workStartTime || !workEndTime) {
            addToast({ title: "Error", description: "Work start and end times cannot be empty.", variant: "destructive" });
            return;
        }

        // 🔥 Compare changes


        if (noChanges) {
            addToast({
                title: "No Changes",
                description: "No changes to save.",
                variant: "default"
            });
            return; // ❌ stop here, no API call
        }
        if (!user?.company_id) return;
        setSavingSettings(true);

        try {
            await api.put('/updateCompanySettings', {
                working_days: workingDays,
                work_start_time: workStartTime,
                work_end_time: workEndTime,
                company_id: companyId
            });
            addToast({ title: "Success", description: "Business calendar settings saved.", variant: "success" });
        } catch (error) {
            addToast({ title: "Error", description: "Failed to save settings.", variant: "destructive" });
        } finally {
            setSavingSettings(false);
        }
    };

    const toggleDay = (day: string) => {
        setWorkingDays(prev =>
            prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
        );
    };

    return (
        <div className="space-y-8">
            <AddHolidayModal open={isAddModalOpen} onOpenChange={setIsAddModalOpen} />
            <CompanyPage companyId={propCompanyId} />
            <div className="px-6 pb-8 space-y-8">
                {/* Page Header */}
                <div>
                    <h2 className="text-xl font-semibold">Business Calendar Settings</h2>
                    <p className="text-sm text-muted-foreground">Configure working days and holidays for accurate due date calculations.</p>

                    <div className="mt-4 p-4 bg-muted/30 border border-border rounded-lg text-sm flex gap-2 items-start">
                        <span className="mt-0.5">ℹ️</span>
                        <p>
                            <strong>How it works:</strong> When a task is assigned on Friday with a 24-hour turnaround, the due date will automatically be set to Monday (skipping the weekend). Holidays are also skipped.
                        </p>
                    </div>
                </div>

                {/* Working Days Config */}
                <div className="border border-border rounded-xl overflow-hidden bg-card">
                    <div className="p-6">
                        <h3 className="text-lg font-medium mb-1">Working Days</h3>
                        <p className="text-sm text-muted-foreground mb-6">Select which days of the week are working days for your organization.</p>

                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                            {DAYS_OF_WEEK.map(day => (
                                <div key={day} className="flex items-center space-x-2">
                                    <Checkbox
                                        id={`day-${day}`}
                                        checked={workingDays.includes(day)}
                                        onCheckedChange={() => toggleDay(day)}
                                        disabled={isMember}
                                    />
                                    <Label htmlFor={`day-${day}`}>{day}</Label>
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-2">
                                <Label htmlFor="start-time">Work Start Time (Optional)</Label>
                                <Input
                                    id="start-time"
                                    type="time"
                                    value={workStartTime}
                                    onChange={(e) => setWorkStartTime(e.target.value)}
                                    disabled={isMember}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="end-time">Work End Time (Optional)</Label>
                                <Input
                                    id="end-time"
                                    type="time"
                                    value={workEndTime}
                                    onChange={(e) => setWorkEndTime(e.target.value)}
                                    disabled={isMember}
                                />
                            </div>
                        </div>
                    </div>
                    <div className="bg-muted/30 px-6 py-4 border-t border-border flex justify-end">
                        {!isMember && (
                            !superAdmin && !isAdmin && !hasAccess('settings', 'write') ? (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <span className="inline-block cursor-not-allowed">
                                            <Button
                                                onClick={handleSaveWorkingDays}
                                                loading={savingSettings}
                                                disabled={true}
                                                className="pointer-events-none"
                                            >
                                                Save Working Days
                                            </Button>
                                        </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                        You do not have access to this. Contact Admin for access.
                                    </TooltipContent>
                                </Tooltip>
                            ) : (
                                <Button
                                    onClick={handleSaveWorkingDays}
                                    loading={savingSettings}
                                    disabled={savingSettings || noChanges}
                                >
                                    Save Working Days
                                </Button>
                            )
                        )}
                    </div>
                </div>

                {/* Company Holidays */}
                <div className="border border-border rounded-xl overflow-hidden bg-card">
                    <div className="p-6 flex items-center justify-between gap-2 border-b border-border">
                        <div>
                            <h3 className="text-lg font-medium mb-1">Company Holidays</h3>
                            <p className="text-sm text-muted-foreground sm:block hidden">Define holidays that will be excluded from working day calculations.</p>
                            <p className="text-sm text-muted-foreground sm:hidden">Define holidays.</p>
                        </div>
                        <div className="flex items-center gap-2 mt-2 sm:flex-row flex-col">
                            <Button variant="outline" size="sm" onClick={() => fetchHolidays(companyId)} disabled={loading}>
                                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
                            </Button>
                            {!isMember && canCreate && (
                                !superAdmin && !isAdmin && !hasAccess('settings', 'write') ? (
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <span className="inline-block cursor-not-allowed">
                                                <Button
                                                    onClick={() => setIsAddModalOpen(true)}
                                                    disabled={true}
                                                    className="pointer-events-none"
                                                >
                                                    <Plus className="h-4 w-4 mr-2" /> Add Holiday
                                                </Button>
                                            </span>
                                        </TooltipTrigger>
                                        <TooltipContent side="top">
                                            You do not have access to this. Contact Admin for access.
                                        </TooltipContent>
                                    </Tooltip>
                                ) : (
                                    <Button size="sm" onClick={() => setIsAddModalOpen(true)}>
                                        <Plus className="h-4 w-4 mr-2" /> Add Holiday
                                    </Button>
                                )
                            )}
                        </div>
                    </div>

                    {holidays.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                                <Activity className="h-8 w-8 opacity-30" />
                            </div>
                            <p className="font-medium">No holidays defined</p>
                            <p className="text-sm mt-1">Add your first company holiday to exclude it from turnarounds.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/50 text-muted-foreground">
                                    <tr>
                                        <th className="text-left px-6 py-3 font-medium">Date</th>
                                        <th className="text-left px-6 py-3 font-medium">Holiday Name</th>
                                        <th className="text-left px-6 py-3 font-medium">Description</th>
                                        <th className="text-left px-6 py-3 font-medium">Type</th>
                                        <th className="text-right px-6 py-3 font-medium">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {holidays.map((holiday) => (
                                        <tr key={holiday.id} className="hover:bg-muted/30 transition-colors">
                                            <td className="px-6 py-4 font-medium">
                                                {new Date(holiday.holiday_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                                            </td>
                                            <td className="px-6 py-4">{holiday.name}</td>
                                            <td className="px-6 py-4 text-muted-foreground">{holiday.description || '—'}</td>
                                            <td className="px-6 py-4">
                                                <Badge variant={holiday.type === 'Recurring' ? 'default' : 'secondary'} className="text-xs">
                                                    {holiday.type}
                                                </Badge>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {!isMember && canDelete && (
                                                    !isAdmin && !hasAccess('settings', 'write') ? (
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <span className="inline-block cursor-not-allowed">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => deleteHoliday(holiday.id)}
                                                                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                                                        disabled={true}
                                                                    >
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </Button>
                                                                </span>
                                                            </TooltipTrigger>
                                                            <TooltipContent side="left">
                                                                You do not have access to this. Contact Admin for access.
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    ) : (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => deleteHoliday(holiday.id)}
                                                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    )
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}



