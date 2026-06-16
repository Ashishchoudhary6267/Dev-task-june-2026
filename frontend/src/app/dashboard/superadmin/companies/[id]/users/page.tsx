'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    ChevronLeft,
    Layers,
    FileText,
    Activity,
    Users as UsersIcon,
} from 'lucide-react';
import { Button } from '@/components/ui';
import { StatsCard } from '@/components/shared-components/stats-card';
import { useSuperadminOverviewStore } from '@/lib/zustand/superadmin/overview';
import ProjectsTab from '@/components/projects/project-tab';
import TasksTab from '@/components/task/task-tab';
import ClientsTab from '@/components/clients/clients_tab';
import CompanySettings from '@/components/holiday/holiday';
import UsersTab from '@/components/user/user-tab';

type Tab = 'users' | 'templates' | 'tasks' | 'clients' | 'settings';

export default function CompanyUsersPage({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const unwrappedParams = React.use(params);
    const companyId = unwrappedParams.id;
    const { company, loading, fetchCompanyOverview } = useSuperadminOverviewStore();
    const [activeTab, setActiveTab] = useState<Tab>('users');

    // ─── Tabs definition ───
    const tabs: { key: Tab; label: string }[] = [
        { key: 'users', label: 'Users' },
        { key: 'templates', label: 'Templates' },
        { key: 'tasks', label: 'Tasks' },
        { key: 'clients', label: 'Clients' },
        { key: 'settings', label: 'Settings' },
    ];

    useEffect(() => {
        if (companyId) {
            fetchCompanyOverview(companyId);
        }
    }, [companyId, fetchCompanyOverview]);


    return (
        <div className="min-h-screen bg-background p-6">

            {/* ─── Header ─── */}
            <div className="mb-6">
                <div className="flex items-start justify-between">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <Button
                                variant="ghost"
                                onClick={() => router.push('/dashboard/superadmin/companies')}
                                className="text-muted-foreground hover:text-foreground h-8 w-8 p-0 rounded-full bg-muted/50"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <h1 className="text-2xl font-bold text-foreground">{company?.name || 'Company'}</h1>
                            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                                Company Overview
                            </span>
                        </div>
                        <p className="text-sm text-muted-foreground ml-11">Manage company users, projects, and settings</p>
                    </div>
                </div>
            </div>

            {/* ─── Stats Row ─── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <StatsCard
                    icon={<UsersIcon className="h-5 w-5" />}
                    gradient="from-blue-600 to-cyan-500"
                    title="Total Users"
                    value={loading ? '...' : String(company?.stats?.totalUsers || 0)}
                    sub="Active members"
                />
                <StatsCard
                    icon={<Layers className="h-5 w-5" />}
                    gradient="from-purple-600 to-indigo-600"
                    title="Total Instances"
                    value={loading ? '...' : String(company?.stats?.totalInstances || 0)}
                    sub="Running workflows"
                />
                <StatsCard
                    icon={<FileText className="h-5 w-5" />}
                    gradient="from-amber-500 to-orange-500"
                    title="Total Templates"
                    value={loading ? '...' : String(company?.stats?.totalTemplates || 0)}
                    sub="Configured structures"
                />
                <StatsCard
                    icon={<Activity className="h-5 w-5" />}
                    gradient="from-emerald-600 to-teal-500"
                    title="System Status"
                    value="Online"
                    sub="All systems operational"
                />
            </div>

            {/* ─── Tab Bar ─── */}
            <div className="border-b border-border mb-6">
                <div className="flex gap-0 overflow-x-auto">
                    {tabs.map(t => (
                        <button
                            key={t.key}
                            onClick={() => setActiveTab(t.key)}
                            className={`px-5 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${activeTab === t.key
                                ? 'border-primary text-primary'
                                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                                }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* ─── Tab Content ─── */}

            {activeTab === 'users' && (
                // <div className="overflow-x-auto animate-in fade-in duration-300">
                //     <div className="flex items-start justify-between mb-4">
                //         <div>
                //             <div className="flex items-center gap-2">
                //                 <h2 className="text-lg font-semibold">User Management</h2>
                //             </div>
                //             <p className="text-sm text-muted-foreground">Manage accounts within this company</p>
                //         </div>
                //         <div className="flex gap-3">
                //             <div className="relative max-w-xs">
                //                 <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                //                 <Input
                //                     placeholder="Search users..."
                //                     className="pl-9 h-9"
                //                     value={searchTerm}
                //                     onChange={e => setSearchTerm(e.target.value)}
                //                 />
                //             </div>
                //         </div>
                //     </div>

                //     <div className="rounded-xl border border-border overflow-hidden overflow-x-auto">
                //         <table className="w-full text-sm">
                //             <thead className="bg-muted/50 text-muted-foreground">
                //                 <tr>
                //                     <th className="text-left px-4 py-3 font-medium">Name</th>
                //                     <th className="text-left px-4 py-3 font-medium">Email</th>
                //                     <th className="text-left px-4 py-3 font-medium">Role</th>
                //                     <th className="text-left px-4 py-3 font-medium">Status</th>
                //                     <th className="text-right px-4 py-3 font-medium">Actions</th>
                //                 </tr>
                //             </thead>
                //             <tbody className="divide-y divide-border">
                //                 {loading ? (
                //                     <tr>
                //                         <td colSpan={5} className="text-center py-10 text-muted-foreground">
                //                             Loading users...
                //                         </td>
                //                     </tr>
                //                 ) : filteredUsers && filteredUsers.length === 0 ? (
                //                     <tr>
                //                         <td colSpan={5} className="text-center py-10 text-muted-foreground">
                //                             No users found for this company.
                //                         </td>
                //                     </tr>
                //                 ) : (
                //                     filteredUsers?.map((u: ExternalUser) => (
                //                         <tr key={u.id} className="bg-card hover:bg-muted/30 transition-colors">
                //                             <td className="px-4 py-3">
                //                                 <div className="flex items-center gap-3">
                //                                     <Avatar size="sm">
                //                                         <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                //                                             {u.name?.charAt(0).toUpperCase() || 'U'}
                //                                         </AvatarFallback>
                //                                     </Avatar>
                //                                     <span className="font-medium text-foreground">{u.name}</span>
                //                                 </div>
                //                             </td>
                //                             <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                //                             <td className="px-4 py-3">
                //                                 <Badge variant="outline" className="capitalize text-xs">
                //                                     {u.platform_role}
                //                                 </Badge>
                //                             </td>
                //                             <td className="px-4 py-3">
                //                                 <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${u.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-muted text-muted-foreground'}`}>
                //                                     <span className={`h-1.5 w-1.5 rounded-full ${u.is_active ? 'bg-green-500' : 'bg-muted-foreground'}`} />
                //                                     {u.is_active ? 'Active' : 'Inactive'}
                //                                 </span>
                //                             </td>
                //                             <td className="px-4 py-3 text-right">
                //                                 <DropdownMenu>
                //                                     <DropdownMenuTrigger>
                //                                         <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-muted">
                //                                             <span className="sr-only">Open menu</span>
                //                                             <MoreVertical className="h-4 w-4 text-muted-foreground" />
                //                                         </Button>
                //                                     </DropdownMenuTrigger>
                //                                     <DropdownMenuContent align="end" className="w-[180px]">
                //                                         <DropdownMenuItem className="cursor-pointer" onClick={() => {
                //                                             setSelectedUser(u);
                //                                             setEditUserModal(true);
                //                                         }}>
                //                                             <Edit2 className="mr-2 h-4 w-4" />
                //                                             <span>Edit User</span>
                //                                         </DropdownMenuItem>

                //                                         <DropdownMenuItem className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10" onClick={() => {
                //                                             setSelectedUser(u);
                //                                             setDeleteUserModal(true);
                //                                         }}>
                //                                             <Trash2 className="mr-2 h-4 w-4" />
                //                                             <span>Delete</span>
                //                                         </DropdownMenuItem>
                //                                     </DropdownMenuContent>
                //                                 </DropdownMenu>
                //                             </td>
                //                         </tr>
                //                     ))
                //                 )}
                //             </tbody>
                //         </table>
                //     </div>
                // </div>
                <UsersTab companyId={companyId} />
            )}

            {activeTab === 'templates' && (
                <div className="animate-in fade-in duration-300">
                    <ProjectsTab companyId={companyId} />
                </div>
            )}

            {activeTab === 'tasks' && (
                <div className="animate-in fade-in duration-300">
                    <TasksTab companyId={companyId} />
                </div>
            )}

            {activeTab === 'clients' && (
                <div className="animate-in fade-in duration-300">
                    <ClientsTab companyId={companyId} />
                </div>
            )}

            {activeTab === 'settings' && (
                <div className="animate-in fade-in duration-300">
                    <CompanySettings companyId={companyId} />
                </div>
            )}

        </div>
    );
}
