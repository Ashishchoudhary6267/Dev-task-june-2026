'use client';

import React, { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/zustand/user/user';
import { useRouter } from 'next/navigation';
import { Building, LogOut, ClipboardList, Users2, FolderKanban, CheckSquare } from 'lucide-react';
import { Button, Badge } from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import { StatsCard } from '@/components/shared-components/stats-card';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { useSuperAdminStatsStore } from '@/lib/zustand/superadmin/stats';
import { useSuperAdminCompanyStore } from '@/lib/zustand/superadmin/onboarding-request';
import ProfileModal from '@/components/profile/profile-modal';

// Chart imports
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function SuperAdminDashboard() {
    const router = useRouter();
    const { user, isAuthenticated } = useAuthStore();
    const { addToast } = useToast();
    const { stats, fetchStats } = useSuperAdminStatsStore();
    const { companies, fetchCompanies } = useSuperAdminCompanyStore();

    const [showProfileModal, setShowProfileModal] = useState(false);

    useEffect(() => {
        if (!isAuthenticated) { router.replace('/landing'); return; }
        if (user?.platform_role !== 'superadmin') {
            router.replace('/dashboard/member');
            return;
        }
        fetchStats();
        fetchCompanies();
    }, [isAuthenticated, user, router, fetchStats, fetchCompanies]);

    // Derived lists
    const recentCompanies = [...companies]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5);


    const topCompanies = [...companies]
        .sort((a, b) => (Number(b.team_size) || 0) - (Number(a.team_size) || 0))
        .slice(0, 5);

    const formatDate = (dateStr: string) => {
        if (!dateStr || dateStr === '—' || dateStr === '-') return '—';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '—';
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    // --- Chart Data Processing ---
    // Take top 4 by team_size (which is now real user count), group rest into "Others"
    const processChartData = () => {
        if (!companies || companies.length === 0) return [];

        const sorted = [...companies].sort((a, b) => (Number(b.team_size) || 0) - (Number(a.team_size) || 0));
        const top4 = sorted.slice(0, 4);
        const rest = sorted.slice(4);

        const chartData = top4.map(c => ({
            name: c.name || 'Unknown',
            value: Number(c.team_size) || 0
        })).filter(item => item.value > 0); // Only show segments > 0 users

        const othersCount = rest.reduce((sum, c) => sum + (Number(c.team_size) || 0), 0);
        if (othersCount > 0) {
            chartData.push({ name: 'Others', value: othersCount });
        }

        return chartData;
    };

    const donutData = processChartData();
    const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#64748b']; // Blue, Green, Amber, Purple, Slate (Others)

    // Custom Tooltip for dark mode
    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-card border border-border p-3 rounded-lg shadow-lg">
                    <p className="font-semibold text-foreground text-sm">{payload[0].name}</p>
                    <p className="text-muted-foreground text-xs mt-1">
                        {payload[0].value} Users
                        {/* <span className="ml-1 opacity-70">
                            ({(payload[0].percent * 100).toFixed(1)}%)
                        </span> */}
                    </p>
                </div>
            );
        }
        return null;
    };


    return (
        <div className="min-h-screen bg-background p-6">

            {/* ── Header ── */}
            <div className="mb-6 flex items-start justify-between">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <h1 className="text-2xl font-bold text-foreground">Super Admin Dashboard</h1>
                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                            Global Platform
                        </span>
                    </div>
                    <p className="text-sm text-muted-foreground">Manage tenant companies and platform administration</p>
                </div>
                <div className="hidden md:flex items-center gap-3">
                    <Badge variant="outline" className="text-xs px-3 py-1 bg-primary text-primary-foreground border-primary">
                        Super Administrator
                    </Badge>
                    <div className="flex items-center gap-2">
                        <div
                            onClick={() => setShowProfileModal(true)}
                            className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold cursor-pointer"
                        >
                            {user?.name?.slice(0, 1).toUpperCase() || 'S'}
                        </div>
                        <NotificationBell />
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                useAuthStore.getState().logout();
                                router.push('/landing');
                            }}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 px-2"
                        >
                            <LogOut className="h-4 w-4 mr-1" />
                            <span className="text-xs">Logout</span>
                        </Button>
                    </div>
                </div>
            </div>

            {/* ── Stat Cards ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                <StatsCard
                    icon={<Building className="h-5 w-5" />}
                    gradient="from-blue-600 to-cyan-500"
                    title="Total Companies"
                    value={String(stats?.total_companies || 0)}
                    sub="Registered tenants"
                />
                <StatsCard
                    icon={<ClipboardList className="h-5 w-5" />}
                    gradient="from-amber-500 to-orange-500"
                    title="Pending Requests"
                    value={String(stats?.pending_requests || 0)}
                    sub="Awaiting review"
                />
                <StatsCard
                    icon={<Users2 className="h-5 w-5" />}
                    gradient="from-emerald-600 to-teal-500"
                    title="Total Users"
                    value={String(stats?.total_users || 0)}
                    sub="Active across platform"
                />
                <StatsCard
                    icon={<FolderKanban className="h-5 w-5" />}
                    gradient="from-purple-600 to-indigo-600"
                    title="Total Templates"
                    value={String(stats?.total_templates || 0)}
                    sub="Active templates"
                />
                <StatsCard
                    icon={<FolderKanban className="h-5 w-5" />}
                    gradient="from-cyan-500 to-blue-500"
                    title="Total Instances"
                    value={String(stats?.total_instances || 0)}
                    sub="Running workflows"
                />
                <StatsCard
                    icon={<CheckSquare className="h-5 w-5" />}
                    gradient="from-pink-600 to-rose-500"
                    title="Total Tasks"
                    value={String(stats?.total_tasks || 0)}
                    sub="Platform-wide tasks"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                {/* User Distribution Chart */}
                <div className="rounded-xl border border-border bg-card p-5 lg:col-span-1 flex flex-col">
                    <div className="mb-2">
                        <h2 className="text-sm font-semibold text-foreground">User Distribution</h2>
                        <span className="text-xs text-muted-foreground">Top companies by active users</span>
                    </div>

                    <div className="flex-1 w-full min-h-[250px] flex items-center justify-center">
                        {donutData.length === 0 ? (
                            <p className="text-xs text-muted-foreground">No active users found</p>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={donutData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={3}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {donutData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend
                                        verticalAlign="bottom"
                                        height={36}
                                        iconType="circle"
                                        iconSize={8}
                                        wrapperStyle={{ fontSize: '12px', color: 'var(--muted-foreground)' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                {/* User Distribution Chart */}
                <div className="rounded-xl border border-border bg-card p-5 lg:col-span-1 flex flex-col">
                    <div className="mb-2">
                        <h2 className="text-sm font-semibold text-foreground">User Distribution</h2>
                        <span className="text-xs text-muted-foreground">Top companies by active users</span>
                    </div>

                    <div className="flex-1 w-full min-h-[250px] flex items-center justify-center">
                        {donutData.length === 0 ? (
                            <p className="text-xs text-muted-foreground">No active users found</p>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={donutData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={3}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {donutData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend
                                        verticalAlign="bottom"
                                        height={36}
                                        iconType="circle"
                                        iconSize={8}
                                        wrapperStyle={{ fontSize: '12px', color: 'var(--muted-foreground)' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>


            </div>

            {/* ── Charts & Panels Grid ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">


                {/* Recently Joined Companies */}
                <div className="rounded-xl border border-border bg-card p-5 lg:col-span-1">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-sm font-semibold text-foreground">Recently Joined</h2>
                        <span className="text-xs text-muted-foreground">Last {recentCompanies.length}</span>
                    </div>
                    {recentCompanies.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-6">No companies found</p>
                    ) : (
                        <div className="divide-y divide-border">
                            {recentCompanies?.map((company: any) => (
                                <div key={company.id} className="flex items-center justify-between py-2.5 cursor-pointer hover:bg-muted/30 transition-colors"
                                    onClick={() => router.push(`/dashboard/superadmin/companies/${company.id}/users`)}>
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold shrink-0">
                                            {company.name?.slice(0, 1).toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-foreground truncate">{company.name}</p>
                                            <p className="text-xs text-muted-foreground truncate">{company.email}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0 ml-2">
                                        {company.industry && (
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                                                {company.industry}
                                            </span>
                                        )}
                                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                                            {formatDate(company.created_at)}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Top Companies by Users */}
                <div className="rounded-xl border border-border bg-card p-5 lg:col-span-1">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-sm font-semibold text-foreground">Top Companies</h2>
                        <span className="text-xs text-muted-foreground">By User Count</span>
                    </div>
                    {topCompanies?.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-6">No companies found</p>
                    ) : (
                        <div className="space-y-4">
                            {topCompanies?.map((company: any, idx: number) => {
                                const size = Number(company.team_size) || 0;
                                const max = Number(topCompanies[0]?.team_size) || 1;
                                const pct = max > 0 ? Math.round((size / max) * 100) : 0;
                                return (
                                    <div key={company.id} className="flex items-center gap-3">
                                        <span className="text-xs font-bold text-muted-foreground w-5 shrink-0 text-right">{idx + 1}</span>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-1">
                                                <p className="text-sm font-medium text-foreground truncate">{company.name}</p>
                                                <span className="text-xs text-muted-foreground shrink-0 ml-2">{size} users</span>
                                            </div>
                                            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                                                <div
                                                    className="h-full rounded-full bg-primary transition-all duration-500"
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            <ProfileModal open={showProfileModal} onOpenChange={() => setShowProfileModal(false)} />
        </div>
    );
}
