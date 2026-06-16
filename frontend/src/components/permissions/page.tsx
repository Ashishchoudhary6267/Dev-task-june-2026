'use client';

import React, { useState, useEffect } from 'react';
import { Button, Checkbox, UISelect, Label } from '../ui';
import { Badge } from '@/components/ui/badge';
import {
    ShieldCheck,
    Loader2,
    Save,
    Play,
    CheckCircle2,
    AlertTriangle,
    Shield,
    UserCheck,
    UserCircle,
    LayoutDashboard,
    Users,
    FolderKanban,
    CheckSquare,
    UserCog,
    BarChart,
    Settings,
    ArrowRightCircle,
    Info,
    Timer
} from 'lucide-react';
import api from '@/lib/api';
import { useUserStore } from '@/lib/zustand/user/addUser';
import { useToast } from '../ui/toast';
import { useTatSettingsStore } from '@/lib/zustand/tat-settings/tat-settings';

const MODULES = [
    { id: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
    { id: 'clients', label: 'Clients', icon: 'Users' },
    { id: 'projects', label: 'Templates (Projects)', icon: 'FolderKanban' },
    { id: 'tasks', label: 'Tasks Management', icon: 'CheckSquare' },
    { id: 'users', label: 'User Management', icon: 'UserCog' },
    { id: 'reports', label: 'Reporting & Analytics', icon: 'BarChart' },
    { id: 'settings', label: 'Company Settings', icon: 'Settings' },
];

export default function PermissionsTab() {
    const { users, fetchUsers, loading: usersLoading } = useUserStore();
    const { addToast } = useToast();

    const [selectedUserId, setSelectedUserId] = useState('');
    const [isLoaded, setIsLoaded] = useState(false);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [permissions, setPermissions] = useState<Record<string, any>>({});
    const [originalPermissions, setOriginalPermissions] = useState<Record<string, any>>({});
    const [runNowLoading, setRunNowLoading] = useState(false);
    const [runNowResult, setRunNowResult] = useState<{ processed: number; skipped: number } | null>(null);
    const [tatHoursInput, setTatHoursInput] = useState<number>(4);
    const { tatSettings, fetchTatSettings, updateTatSettings, loading: tatLoading } = useTatSettingsStore();

    useEffect(() => {
        fetchUsers({ limit: 1000 });
    }, []);

    const loadPermissions = async () => {
        if (!selectedUserId) {
            addToast({ title: "Select User", description: "Please select a user first.", variant: "destructive" });
            return;
        }

        setLoading(true);
        try {
            const { data } = await api.get(`/permissions/${selectedUserId}`);
            const permMap: Record<string, any> = {};

            // Initialize all modules with existing data or defaults
            MODULES.forEach(m => {
                const existing = data.data?.find((p: any) => p.module === m.id);
                permMap[m.id] = existing ? {
                    module: m.id,
                    can_read: existing.can_read,
                    can_write: existing.can_write,
                    can_delete: existing.can_delete,
                } : {
                    module: m.id,
                    can_read: true,
                    can_write: false,
                    can_delete: false,
                };
            });

            setPermissions(permMap);
            setOriginalPermissions(JSON.parse(JSON.stringify(permMap)));
            setIsLoaded(true);
        } catch (error) {
            console.error(error);
            addToast({ title: "Error", description: "Failed to load permissions.", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = (moduleId: string, field: 'can_read' | 'can_write' | 'can_delete', value: any) => {
        setPermissions(prev => ({
            ...prev,
            [moduleId]: {
                ...prev[moduleId],
                [field]: value === true || value === "checked"
            }
        }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const promises = Object.values(permissions).map(p =>
                api.post('/permissions', {
                    user_id: selectedUserId,
                    module: p.module,
                    can_read: p.can_read,
                    can_write: p.can_write,
                    can_delete: p.can_delete
                })
            );

            await Promise.all(promises);
            setOriginalPermissions(JSON.parse(JSON.stringify(permissions)));
            addToast({ title: "Success", description: "Permissions updated successfully.", variant: "success" });
        } catch (error) {
            addToast({ title: "Error", description: "Failed to save permissions.", variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    const hasChanges = JSON.stringify(permissions) !== JSON.stringify(originalPermissions);
    const controllers = users.filter((u: any) => u.platform_role === 'controller' || u.workflow_role === 'interim_manager');

    // Icon mapping for modules
    const iconMap: Record<string, any> = {
        dashboard: LayoutDashboard,
        clients: Users,
        projects: FolderKanban,
        tasks: CheckSquare,
        users: UserCog,
        reports: BarChart,
        settings: Settings,
    };
    const handleTatSave = async () => {
        const success = await updateTatSettings(tatHoursInput);
        if (success) {
            addToast({ title: 'TAT settings saved', description: `Review window set to ${tatHoursInput} working hours.`, variant: 'default' });
        } else {
            addToast({ title: 'Failed to save', description: 'Please try again.', variant: 'destructive' });
        }
    };
    const handleRunNow = async () => {
        setRunNowLoading(true);
        setRunNowResult(null);
        try {
            const res = await api.post('/internal/check-overdue-tasks', {}, {
                headers: { 'x-cron-secret': process.env.NEXT_PUBLIC_CRON_SECRET || '' }
            });
            setRunNowResult(res.data);
            addToast({ title: 'Overdue check complete', description: `Processed: ${res.data.processed}, Skipped: ${res.data.skipped}`, variant: 'default' });
        } catch (err: any) {
            addToast({ title: 'Failed to run check', description: err?.response?.data?.message || 'Unauthorized or server error', variant: 'destructive' });
        } finally {
            setRunNowLoading(false);
        }
    };

    return (
        <div className="border border-border/50 rounded-[2rem] bg-background shadow-xl shadow-black/5 overflow-hidden font-manrope">
            <div className='p-4'>
                <div className="mt-6 rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
                    <div className="px-6 py-5 border-b border-border bg-muted/20">
                        <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                            <Timer className="h-4 w-4 text-primary" />
                            TAT Extension Review Window
                        </h2>
                        <p className="text-sm text-muted-foreground mt-1">
                            Time (in working hours) a controller has to act on an auto-generated TAT extension request before it's flagged as overdue.
                        </p>
                    </div>
                    <div className="px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                        <div className="flex items-center gap-3 flex-1">
                            <label className="text-sm font-medium text-foreground whitespace-nowrap">Review window:</label>
                            <input
                                type="number"
                                min={1}
                                max={168}
                                value={tatHoursInput}
                                onChange={e => setTatHoursInput(parseInt(e.target.value) || 4)}
                                className="w-24 px-3 py-2 text-sm border border-border rounded-lg bg-muted/30 focus:bg-background focus:outline-none focus:ring-1 focus:ring-border"
                            />
                            <span className="text-sm text-muted-foreground">working hours</span>
                        </div>
                        <button
                            onClick={handleTatSave}
                            disabled={tatLoading}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                        >
                            <Save className="h-3.5 w-3.5" />
                            {tatLoading ? 'Saving…' : 'Save'}
                        </button>
                    </div>
                    <div className="px-6 pb-5 flex items-center justify-between flex-wrap gap-3">
                        {/* <p className="text-xs text-muted-foreground">
                            ⚠️ Excludes weekends and company holidays. Min: 1 hour, Max: 168 hours (1 week). Current: <strong>{tatSettings?.tat_review_deadline_hours ?? 4} hours</strong>.
                        </p> */}
                        <button
                            onClick={handleRunNow}
                            disabled={runNowLoading}
                            title="Manually trigger the overdue check now (same as the 5-min cron)"
                            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50 text-muted-foreground"
                        >
                            <Play className="h-3 w-3" />
                            {runNowLoading ? 'Running check…' : 'Run Check Now'}  for testing only
                        </button>
                        {runNowResult && (
                            <p className="w-full text-xs text-green-600 font-medium">
                                ✓ Done — {runNowResult.processed} request(s) created, {runNowResult.skipped} skipped (already pending).
                            </p>
                        )}
                    </div>
                </div>
            </div>
            {/* ─── Header ─── */}
            <div className="bg-muted/30 p-8 border-b border-border/50 backdrop-blur-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-5">
                        {/* <div className="h-14 w-14 rounded-[1.5rem] bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                            <ShieldCheck className="h-8 w-8" />
                        </div> */}
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <h2 className="text-2xl font-bold tracking-tight text-foreground">Permission Management</h2>
                                {isLoaded && (
                                    <Badge variant="outline" className="rounded-lg border-primary/20 bg-primary/5 text-primary text-[10px] font-bold px-2 py-0.5 uppercase tracking-widest">
                                        Active Sync
                                    </Badge>
                                )}
                            </div>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                Configure access protocols for key personnel.
                            </p>
                        </div>
                    </div>

                    {isLoaded && hasChanges && (
                        <Button
                            size="lg"
                            onClick={handleSave}
                            disabled={saving}
                            className="hidden sm:flex w-full md:w-auto bg-primary hover:bg-primary/80 text-white rounded-2xl h-12 px-8 font-bold gap-2 shadow-lg transition-all transform active:scale-95"
                        >
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            Save Permissions
                        </Button>
                    )}
                </div>
            </div>

            <div className="p-8 space-y-10">
                {/* ─── Controller Selection ─── */}
                <div className="max-w-xl mx-auto md:mx-0  rounded-3xl bg-muted/20 border border-border/40 space-y-4 p-2">
                    <div className="flex items-center justify-between">
                        <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                            <UserCheck className="h-3.5 w-3.5" />
                            Target User
                        </Label>
                        {selectedUserId && !isLoaded && (
                            <span className="text-[10px] font-bold text-amber-500 animate-pulse uppercase tracking-widest">Awaiting Load</span>
                        )}
                    </div>

                    <div className="flex gap-4 flex-col sm:flex-row">
                        <UISelect
                            className="flex-1 rounded-2xl border-border/60 bg-white"
                            value={selectedUserId}
                            onValueChange={(val) => {
                                setSelectedUserId(val);
                                setIsLoaded(false);
                            }}
                            placeholder="Select personnel..."
                            options={controllers.map(u => ({
                                value: u.id,
                                label: `${u.name} (${u.email})`,
                                icon: UserCircle
                            }))}
                        />
                        <Button
                            onClick={loadPermissions}
                            disabled={!selectedUserId || loading}
                            variant={isLoaded ? "outline" : "default"}
                            className={`w-full sm:w-auto rounded-2xl h-11 px-6 font-bold transition-all ${!isLoaded ? 'shadow-lg shadow-primary/20' : ''
                                }`}
                        >
                            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                            {isLoaded ? "Reload Matrix" : "Load Matrix"}
                        </Button>
                    </div>
                </div>

                {/* large screens */}
                <div className='hidden sm:block'>
                    {!isLoaded ? (
                        <div className="flex flex-col items-center justify-center py-20 bg-muted/20 border border-dashed rounded-2xl gap-4 grayscale opacity-60">
                            <Shield className="h-16 w-16 text-muted-foreground/30" />
                            <div className="text-center">
                                <p className="font-semibold text-lg">No User Selected</p>
                                <p className="text-sm text-muted-foreground">Select a controller above to manage their modular access.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                            <div className="border rounded-xl overflow-hidden bg-background">
                                <table className="w-full">
                                    <thead className="bg-muted/50 border-b">
                                        <tr>
                                            <th className="p-4 text-left font-bold text-xs uppercase tracking-wider text-muted-foreground">Module</th>
                                            <th className="p-4 text-center font-bold text-xs uppercase tracking-wider text-muted-foreground">Read (View)</th>
                                            <th className="p-4 text-center font-bold text-xs uppercase tracking-wider text-muted-foreground">Write (Create/Edit)</th>
                                            <th className="p-4 text-center font-bold text-xs uppercase tracking-wider text-muted-foreground">Delete (Revoke)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {MODULES?.map((module) => (
                                            <tr key={module.id} className="hover:bg-muted/10 transition-colors">
                                                <td className="p-4">
                                                    <div className="font-semibold text-sm">{module.label}</div>
                                                    {/* <div className="text-[10px] text-muted-foreground opacity-70">Internal Module Key: {module.id}</div> */}
                                                </td>
                                                <td className="p-4 text-center">
                                                    <div className="flex justify-center">
                                                        <Checkbox
                                                            checked={permissions[module.id]?.can_read}
                                                            onCheckedChange={(checked) => handleToggle(module.id, 'can_read', checked)}
                                                        />
                                                    </div>
                                                </td>
                                                <td className="p-4 text-center">
                                                    <div className="flex justify-center">
                                                        <Checkbox
                                                            checked={permissions[module.id]?.can_write}
                                                            onCheckedChange={(checked) => handleToggle(module.id, 'can_write', checked)}
                                                        />
                                                    </div>
                                                </td>
                                                <td className="p-4 text-center">
                                                    <div className="flex justify-center">
                                                        <Checkbox
                                                            checked={permissions[module.id]?.can_delete}
                                                            onCheckedChange={(checked) => handleToggle(module.id, 'can_delete', checked)}
                                                        />
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3 text-amber-800 text-xs">
                                <AlertTriangle className="h-4 w-4 shrink-0" />
                                <p>
                                    <strong>Warning:</strong> Permissions changes take effect immediately on the next page reload for the user.
                                    Disabling <strong>Read</strong> access will hide the module entirely from their sidebar and dashboard.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
                {/* mobile dispay */}
                <div className='grid sm:hidden'>
                    {!isLoaded ? (
                        <div className="flex flex-col items-center justify-center py-24 bg-muted/10 border-2 border-dashed border-border/40 rounded-[2.5rem] gap-6 text-center px-8">
                            <div className="h-20 w-20 rounded-full bg-white flex items-center justify-center shadow-sm border border-border/20">
                                <Shield className="h-10 w-10 text-muted-foreground/30" />
                            </div>
                            <div className="max-w-xs">
                                <p className="font-bold text-xl text-foreground mb-2">Matrix Not Loaded</p>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    Please select a controller from the roster above to audit and configure their workspace permissions.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
                            {/* ─── Permission Cards Grid ─── */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {MODULES.map((module) => {
                                    const Icon = iconMap[module.id] || Shield;
                                    return (
                                        <div key={module.id} className="bg-white rounded-[2rem] border border-border/50 p-6 shadow-sm hover:shadow-xl hover:shadow-black/5 transition-all group relative overflow-hidden">
                                            {/* Subtle background icon */}
                                            <Icon className="absolute -right-4 -bottom-4 h-24 w-24 text-gray-50 opacity-0 group-hover:opacity-100 transition-opacity" />

                                            <div className="flex items-center gap-4 mb-8 relative">
                                                <div className="h-12 w-12 rounded-2xl bg-muted/50 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                                                    <Icon className="h-6 w-6" />
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-gray-900 group-hover:text-primary transition-colors">{module.label}</h4>
                                                    {/* <div className="flex items-center gap-1.5">
                                                        <span className="text-[10px] text-gray-400 font-mono uppercase tracking-widest leading-none">id: {module.id}</span>
                                                    </div> */}
                                                </div>
                                            </div>

                                            <div className="space-y-3 relative">
                                                {/* Read Permission */}
                                                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-blue-50/30 border border-blue-100/50 hover:bg-blue-50/50 transition-colors">
                                                    <div className="flex flex-col">
                                                        <Label className="text-[11px] font-bold text-blue-700 uppercase tracking-wider mb-0.5">Read Access</Label>
                                                        <span className="text-[10px] text-blue-600/60">View module data</span>
                                                    </div>
                                                    <Checkbox
                                                        checked={permissions[module.id]?.can_read}
                                                        onCheckedChange={(checked) => handleToggle(module.id, 'can_read', checked)}
                                                        className="h-6 w-6 rounded-lg border-blue-200 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 transition-all"
                                                    />
                                                </div>

                                                {/* Write Permission */}
                                                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-amber-50/30 border border-amber-100/50 hover:bg-amber-50/50 transition-colors">
                                                    <div className="flex flex-col">
                                                        <Label className="text-[11px] font-bold text-amber-700 uppercase tracking-wider mb-0.5">Write Access</Label>
                                                        <span className="text-[10px] text-amber-600/60">Modify module data</span>
                                                    </div>
                                                    <Checkbox
                                                        checked={permissions[module.id]?.can_write}
                                                        onCheckedChange={(checked) => handleToggle(module.id, 'can_write', checked)}
                                                        className="h-6 w-6 rounded-lg border-amber-200 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600 transition-all"
                                                    />
                                                </div>

                                                {/* Delete Permission */}
                                                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-red-50/30 border border-red-100/50 hover:bg-red-50/50 transition-colors">
                                                    <div className="flex flex-col">
                                                        <Label className="text-[11px] font-bold text-red-700 uppercase tracking-wider mb-0.5">Delete Access</Label>
                                                        <span className="text-[10px] text-red-600/60">Remove module data</span>
                                                    </div>
                                                    <Checkbox
                                                        checked={permissions[module.id]?.can_delete}
                                                        onCheckedChange={(checked) => handleToggle(module.id, 'can_delete', checked)}
                                                        className="h-6 w-6 rounded-lg border-red-200 data-[state=checked]:bg-red-600 data-[state=checked]:border-red-600 transition-all"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* ─── Warning Footer ─── */}
                            <div className="bg-amber-50/50 border border-amber-200/50 rounded-[1.5rem] p-6 flex gap-5 animate-in fade-in zoom-in-95 duration-500">
                                <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                                    <AlertTriangle className="h-5 w-5" />
                                </div>
                                <div className="space-y-1">
                                    <h5 className="font-bold text-amber-900 text-sm">Security Advisory</h5>
                                    <p className="text-amber-800/70 text-xs leading-relaxed">
                                        Permission updates are high-impact events. Changes will propagate upon the target user&apos;s next session initialization or manual refresh.
                                        Disabling <span className="font-bold text-amber-900 underline decoration-amber-300">Read</span> access will completely decommission the module for the selected user.
                                    </p>
                                </div>
                            </div>

                            {/* Mobile Save Button */}
                            {isLoaded && hasChanges && (
                                <div className="pt-4 pb-10 sm:hidden">
                                    <Button
                                        size="lg"
                                        onClick={handleSave}
                                        disabled={saving}
                                        className="w-full bg-primary hover:bg-primary/80 text-white rounded-2xl h-14 font-bold gap-3 shadow-xl shadow-primary/20 transition-all transform active:scale-95 animate-in fade-in slide-in-from-bottom-4 duration-500"
                                    >
                                        {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                                        Save Changes
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>



        </div>
    );
}
