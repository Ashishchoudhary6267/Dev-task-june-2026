'use client';

import React, { useEffect } from 'react';
import {
    Users, FolderKanban, CheckSquare, Activity,
    UserPlus, Briefcase, BarChart3, Settings,
    Shield, Zap, Server, ArrowRight, ExternalLink,
    Play, Clock, CheckCircle2, AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    Card,
    CardHeader,
    CardTitle,
    CardContent,
    Badge,
    Button
} from '@/components/ui';

interface OverviewTabProps {
    role: 'admin' | 'controller';
    stats: any;
    onAction?: (action: string) => void;
}
import { useInstanceStore } from '@/lib/zustand/instances/instances';

const getInitials = (name: string) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
};


export default function OverviewTab({ role, stats, onAction }: OverviewTabProps) {

    const { fetchInstances, instances } = useInstanceStore();
    useEffect(() => {
        fetchInstances();
    }, []);
    // Quick Actions data based on role
    const quickActions = [
        {
            id: 'add-user',
            label: 'Add User',
            icon: <UserPlus className="h-6 w-6 text-blue-500" />,
            bg: 'bg-blue-50',
            borderColor: 'border-blue-100',
            roles: ['admin', 'controller']
        },
        {
            id: 'new-client',
            label: 'New Client',
            icon: <Briefcase className="h-6 w-6 text-purple-500" />,
            bg: 'bg-purple-50',
            borderColor: 'border-purple-100',
            roles: ['admin', 'controller']
        },
        {
            id: 'reports',
            label: 'Reports',
            icon: <BarChart3 className="h-6 w-6 text-emerald-500" />,
            bg: 'bg-emerald-50',
            borderColor: 'border-emerald-100',
            roles: ['admin', 'controller']
        },
        {
            id: 'settings',
            label: 'Settings',
            icon: <Settings className="h-6 w-6 text-amber-500" />,
            bg: 'bg-amber-50',
            borderColor: 'border-amber-100',
            roles: ['admin', 'controller']
        }
    ].filter(action => action.roles.includes(role));

    // Stats cards data
    const statCards = [
        {
            label: 'System Users',
            value: stats?.users || '0',
            sub: 'Full registered access',
            icon: <Users className="h-5 w-5 text-blue-600" />,
            onClick: () => onAction?.('users')
        },
        {
            label: 'Task Templates',
            value: stats?.projects || '0',
            sub: 'Active blueprints for Instances',
            icon: <FolderKanban className="h-5 w-5 text-blue-600" />,
            onClick: () => onAction?.('templates')
        },
        {
            label: 'Active Tasks',
            value: stats?.activeTasks || '0',
            sub: 'Currently processing',
            icon: <Activity className="h-5 w-5 text-blue-600" />,
            onClick: () => onAction?.('tasks')
        },
        {
            label: 'Instance Uptime',
            value: '99.9%',
            sub: 'High availability',
            icon: <Clock className="h-5 w-5 text-blue-600" />,
        }
    ];

    return (
        <div className="space-y-8 animate-in fade-in duration-500">

            {/* ─── Top Stats Grid ─── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {statCards.map((stat, idx) => (
                    <Card key={idx} className="border-none shadow-sm hover:shadow-md transition-all bg-white rounded-[2.5rem] p-8 min-h-[80px] flex flex-col justify-between relative group">
                        <div className="space-y-4" onClick={stat.onClick}>
                            {/* Icon & Label */}
                            <div className="flex items-center gap-2">
                                <div className="text-blue-600">
                                    {stat.icon}
                                </div>
                                <span className="text-sm font-semibold text-slate-500 tracking-tight">{stat.label}</span>
                            </div>

                            {/* Value */}
                            <h3 className="text-5xl font-black text-slate-900 tracking-tighter">
                                {stat.value}
                            </h3>
                        </div>

                        {/* Subtext */}
                        <div className="flex flex-col items-end gap-1 mt-2">
                            {stat.sub && (
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-1 text-right">
                                    {stat.sub}
                                </span>
                            )}
                        </div>
                    </Card>
                ))}
            </div>

            {/* ─── Middle Section: Quick Actions & Workflows ─── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* Left: Quick Actions */}
                <div className="lg:col-span-4 space-y-4">
                    <div className="flex items-center gap-2 mb-2 px-1">
                        <Zap className="h-4 w-4 text-primary" />
                        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Quick Actions</h2>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        {quickActions.map((action) => (
                            <button
                                key={action.id}
                                onClick={() => onAction?.(action.id)}
                                className={cn(
                                    "flex flex-col items-center justify-center p-6 rounded-3xl border transition-all duration-300 group hover:-translate-y-1 hover:shadow-xl hover:shadow-black/5 bg-white",
                                    action.borderColor,
                                    "hover:bg-white"
                                )}
                            >
                                <div className={cn("p-4 rounded-2xl mb-3 transition-transform duration-300 group-hover:scale-110", action.bg)}>
                                    {action.icon}
                                </div>
                                <span className="text-sm font-bold text-foreground">{action.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Security Patch Mini Card */}
                    {/* <Card className="mt-6 border-none shadow-sm bg-emerald-50/30 overflow-hidden relative group">
                        <div className="absolute right-0 top-0 p-3">
                            <Shield className="h-10 w-10 text-emerald-500/10 transition-transform duration-500 group-hover:scale-125" />
                        </div>
                        <CardContent className="p-6">
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-2">
                                    <Shield className="h-4 w-4 text-emerald-600" />
                                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Security Patch Status</span>
                                </div>
                                <Badge className="bg-emerald-500 hover:bg-emerald-600 border-none text-[10px] h-5">Latest</Badge>
                            </div>
                            <p className="text-xs text-emerald-800/70 leading-relaxed max-w-[200px]">
                                System core is up to date. Next maintenance window scheduled for Saturday at 03:00 UTC.
                            </p>
                        </CardContent>
                    </Card> */}
                </div>

                {/* Right: Instance Workflows */}
                <div className="lg:col-span-8">
                    <Card className="h-full border-none shadow-sm bg-white overflow-hidden">
                        <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-border/40 px-6 py-5">
                            <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-primary" />
                                <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Instance Workflows</CardTitle>
                            </div>
                            {/* <Button variant="link" size="sm" className="text-xs font-bold text-primary p-0 h-auto">
                                View All Tasks
                                <ArrowRight className="ml-1 h-3 w-3" />
                            </Button> */}
                        </CardHeader>
                        <CardContent className="p-0">
                            {instances && instances.length > 0 ? (
                                <div className="divide-y divide-border/40">
                                    {instances.slice(0, 3).map((instance, idx) => {
                                        const total = instance.task_stats?.total || 1;
                                        const completed = instance.task_stats?.completed || 0;
                                        const progress = Math.round((completed / total) * 100);

                                        return (
                                            <div key={idx} className="p-6 transition-colors hover:bg-muted/30 cursor-pointer group">
                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{instance.name}</p>
                                                            {instance.status === 'SCHEDULED' && instance.scheduled_at && (
                                                                <span className="text-[9px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded italic">
                                                                    Starts {new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit' }).format(new Date(instance.scheduled_at))}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <h4 className="text-base font-bold text-foreground group-hover:text-primary transition-colors">{instance?.project?.name}</h4>
                                                        <div className="flex items-center gap-3 mt-2">
                                                            <div className="flex -space-x-2">
                                                                <div title={instance.client?.name} className="h-6 w-6 rounded-full border-2 border-white bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                                                                    {getInitials(instance.client?.name || 'Client')}
                                                                </div>
                                                                <div title={instance.creator?.name} className="h-6 w-6 rounded-full border-2 border-white bg-muted flex items-center justify-center text-[10px] font-bold">
                                                                    {getInitials(instance.creator?.name || 'User')}
                                                                </div>
                                                            </div>
                                                            <span className="text-[10px] font-medium text-muted-foreground">Client: <span className="text-foreground font-bold">{instance.client?.name || 'N/A'}</span></span>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col items-end gap-2 shrink-0">
                                                        <div className="flex items-center gap-3 w-full sm:w-48">
                                                            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                                                <div
                                                                    className={cn(
                                                                        "h-full rounded-full transition-all duration-1000",
                                                                        instance.status === 'COMPLETED' ? "bg-emerald-500" : "bg-primary"
                                                                    )}
                                                                    style={{ width: `${progress}%` }}
                                                                />
                                                            </div>
                                                            <span className="text-[10px] font-bold text-muted-foreground whitespace-nowrap">{progress}% COMPLETE</span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {instance.is_paused ? (
                                                                <Badge variant="outline" className="text-[10px] font-bold border-amber-200 text-amber-700 bg-amber-50 px-2 h-5 flex items-center gap-1">
                                                                    <AlertCircle className="h-2 w-2 fill-current" />
                                                                    Paused
                                                                </Badge>
                                                            ) : instance.status === 'SCHEDULED' ? (
                                                                <Badge variant="outline" className="text-[10px] font-bold border-blue-200 text-blue-700 bg-blue-50 px-2 h-5 flex items-center gap-1">
                                                                    <Clock className="h-2 w-2" />
                                                                    Scheduled
                                                                </Badge>
                                                            ) : instance.status === 'COMPLETED' ? (
                                                                <Badge variant="outline" className="text-[10px] font-bold border-emerald-200 text-emerald-700 bg-emerald-50 px-2 h-5 flex items-center gap-1">
                                                                    <CheckCircle2 className="h-2 w-2" />
                                                                    Completed
                                                                </Badge>
                                                            ) : (
                                                                <Badge variant="outline" className="text-[10px] font-bold border-primary/20 text-primary bg-primary/5 px-2 h-5 flex items-center gap-1">
                                                                    <Play className="h-2 w-2 fill-current" />
                                                                    In Progress
                                                                </Badge>
                                                            )}
                                                            <div className="h-8 w-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors">
                                                                <ExternalLink className="h-3.5 w-3.5" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="p-12 text-center text-muted-foreground">
                                    <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                                        <Activity className="h-6 w-6 opacity-20" />
                                    </div>
                                    <p className="text-sm font-medium">No Instance Workflows at the moment.</p>
                                    <p className="text-xs mt-1">New instances will appear here for monitoring.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* ─── Bottom Info Row ─── */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Traffic Analysis */}
                <div className="md:col-span-1 lg:col-span-2">
                    <Card className="border-none shadow-sm bg-white overflow-hidden group">
                        <CardContent className="p-6 flex items-center gap-5">
                            <div className="h-12 w-12 rounded-2xl bg-muted/50 flex items-center justify-center shrink-0 border border-border transition-colors group-hover:border-primary/20">
                                <Activity className="h-6 w-6 text-muted-foreground/60 transition-colors group-hover:text-primary/60" />
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center justify-between">
                                    <h5 className="text-sm font-bold text-foreground">Traffic Analysis</h5>
                                    <span className="text-[10px] font-medium text-emerald-500 flex items-center gap-1">
                                        <CheckCircle2 className="h-3 w-3" />
                                        Optimal
                                    </span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">Load balancing is distributing traffic efficiently across all active nodes.</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Permissions Review */}
                <Card className="border-none shadow-sm bg-white overflow-hidden group">
                    <CardContent className="p-6 flex items-center gap-5">
                        <div className="h-12 w-12 rounded-2xl bg-muted/50 flex items-center justify-center shrink-0 border border-border transition-colors group-hover:border-amber-500/20">
                            <Shield className="h-6 w-6 text-muted-foreground/60 transition-colors group-hover:text-amber-500/60" />
                        </div>
                        <div className="flex-1">
                            <h5 className="text-sm font-bold text-foreground">Permissions Review</h5>
                            <p className="text-xs text-muted-foreground mt-1">7 entries pending audit review for high-privilege access.</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

        </div>
    );
}