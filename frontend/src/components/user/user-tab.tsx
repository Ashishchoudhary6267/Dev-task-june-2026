'use client'
import React, { useEffect, useState } from 'react'
import { Button, Input, Badge, Avatar, AvatarFallback, Select, Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, TooltipContent, Tooltip, TooltipTrigger, UISelect } from '../ui';
import { RefreshCw, Plus, Search, Edit2, Trash2, Settings, MoreVertical, SlidersHorizontal, Bell, ArrowUpDown, ChevronUp, ChevronDown, Eye } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { useUserStore } from '@/lib/zustand/user/addUser';
import { useToast } from '../ui';
import EditUserModal, { DeleteUserModal } from '../user-edit-modal';
import { AddUserModal, ChangePasswordModalForAdmin } from './add-user-modal';
import { useAuthStore } from '@/lib/zustand/user/user';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { useSACompanyDataStore } from '@/lib/zustand/superadmin/company-data';
import Loader from '../ui/loader';
import { useRouter } from 'next/navigation';
import { useAccessControl } from '@/lib/contexts/access-control-context';

export default function UsersTab({ search, setSearch, companyId }: { search?: string; setSearch?: (v: string) => void; companyId?: string }) {
    const router = useRouter();
    const { canCreate, canEdit, canDelete } = useAccessControl();
    const [selectedUser, setselectedUser] = useState<any>(null);
    const [editUserModal, setEditUserModal] = useState(false);
    const [userRoleFilter, setUserRoleFilter] = useState('all');
    const [isAddUserOpen, setIsAddUserOpen] = useState(false);
    const [deleteUserModal, setDeleteUserModal] = useState(false);
    const [changePasswordModal, setChangePasswordModal] = useState(false);
    const adminUserStore = useUserStore();
    const saStore = useSACompanyDataStore();
    const { addToast } = useToast();
    const { user, impersonate } = useAuthStore();
    const isAdmin = user?.platform_role === 'admin';
    const isSuperAdmin = user?.platform_role === 'superadmin';
    const usingSAStore = !!companyId && isSuperAdmin;
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const { hasAccess } = usePermissions();
    console.log("issuperadmin", isSuperAdmin);


    const users = usingSAStore ? saStore.users : adminUserStore.users;
    const usersLoading = usingSAStore ? saStore.usersLoading : adminUserStore.loading;
    const usercount = usingSAStore ? saStore.users.length : adminUserStore.usercount;
    const userpage = usingSAStore ? 1 : adminUserStore.userpage;
    const usertotalpages = usingSAStore ? 1 : adminUserStore.usertotalpages;

    // Sorting state
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' | null }>({ key: '', direction: null });

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' | null = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        } else if (sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = null;
        }
        setSortConfig({ key, direction });
    };

    const sortedUsers = React.useMemo(() => {
        let sortableUsers = [...users];
        if (sortConfig.key && sortConfig.direction) {
            sortableUsers.sort((a: any, b: any) => {
                let aValue = a[sortConfig.key];
                let bValue = b[sortConfig.key];

                // Handle string comparison
                if (typeof aValue === 'string') aValue = aValue.toLowerCase();
                if (typeof bValue === 'string') bValue = bValue.toLowerCase();

                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return sortableUsers;
    }, [users, sortConfig]);


    // Fetch users when page, search, or role filter changes
    useEffect(() => {
        if (usingSAStore) {
            saStore.fetchSAUsers(companyId!);
            return;
        }
        const timer = setTimeout(() => {
            adminUserStore.fetchUsers({
                page,
                limit,
                search: search || undefined,
                roles: userRoleFilter === 'all' ? undefined : userRoleFilter
            });
        }, 300);
        return () => clearTimeout(timer);
    }, [page, search, userRoleFilter, limit, companyId]);

    const roles = [
        { value: 'all', label: 'All' },
        { value: 'admin', label: 'Admin' },
        { value: 'controller', label: 'Controller' },
        { value: 'member', label: 'Member' },
    ];


    function getUserStatus(last_seen_at?: string | null): 'online' | 'idle' | 'offline' | 'never' {
        if (!last_seen_at) return 'never';
        const diff = Date.now() - new Date(last_seen_at).getTime();
        if (diff < 60_000) return 'online';
        if (diff < 5 * 60_000) return 'idle';
        return 'offline';
    }

    const STATUS_CONFIG = {
        online: { label: 'Online', dot: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/30', pulse: true },
        idle: { label: 'Idle', dot: 'bg-amber-400', text: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/30', pulse: false },
        offline: { label: 'Offline', dot: 'bg-zinc-400', text: 'text-zinc-500 dark:text-zinc-400', bg: 'bg-zinc-100 dark:bg-zinc-800/40', pulse: false },
        never: { label: 'Offline', dot: 'bg-zinc-400', text: 'text-zinc-500 dark:text-zinc-400', bg: 'bg-zinc-100 dark:bg-zinc-800/40', pulse: false },
    };
    function StatusBadge({ last_seen_at }: { last_seen_at?: string | null }) {
        const status = getUserStatus(last_seen_at);
        const cfg = STATUS_CONFIG[status];
        return (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
                <span className="relative flex h-1.5 w-1.5">
                    {cfg.pulse && (
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${cfg.dot} opacity-60`} />
                    )}
                    <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${cfg.dot}`} />
                </span>
                {cfg.label}
            </span>
        );
    }
    return (
        <div className='w-full border p-4 border-border rounded-xl'>
            {/* --- MOBILE VIEW (Current UI) --- */}
            <div className="md:hidden">
                {/* Header Area */}
                <div className="flex flex-col items-start justify-between gap-4 mb-6">
                    <div className="pr-2">
                        <h1 className="text-xl font-bold tracking-tight text-foreground">Manage Users</h1>
                        <p className="text-sm text-muted-foreground mt-1">Add, edit, and manage user access across your organization.</p>
                    </div>
                    <div className="shrink-0 w-full">
                        {!isSuperAdmin && !isAdmin && !hasAccess('users', 'write') ? (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <span className="inline-block cursor-not-allowed w-full">
                                        <Button size="sm" onClick={() => setIsAddUserOpen(true)} disabled={true}
                                            variant='default'
                                        // className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm"
                                        >
                                            <Plus className="h-4 w-4 mr-1.5" /> Add User
                                        </Button>
                                    </span>
                                </TooltipTrigger>
                                <TooltipContent side="left">
                                    You do not have adding user access. Contact Admin.
                                </TooltipContent>
                            </Tooltip>
                        ) : canCreate && (
                            <Button size="sm" onClick={() => setIsAddUserOpen(true)}
                            //  className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm"
                            >
                                <Plus className="h-4 w-4 mr-1.5" /> Add User
                            </Button>
                        )}
                    </div>
                </div>

                {/* Search and Filters */}
                <div className="space-y-4 mb-6">
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search users..."
                                className="pl-9 h-11 bg-card border-border/50 rounded-xl shadow-sm focus-visible:ring-1 focus-visible:ring-primary/30"
                                value={search}
                                onChange={e => setSearch?.(e.target.value)}
                            />
                        </div>
                        <DropdownMenu>
                            <DropdownMenuTrigger className="focus:outline-none">
                                <Button variant="outline" className="h-11 w-11 p-0 shrink-0 border-border/50 rounded-xl shadow-sm text-muted-foreground hover:text-foreground">
                                    <SlidersHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                                <div className="p-2">
                                    <span className="text-[10px] font-bold text-muted-foreground mb-1 mt-1 px-2 uppercase tracking-wider block">Items per page</span>
                                    <DropdownMenuItem active={limit === 10} onClick={() => setLimit(10)}>10 per page</DropdownMenuItem>
                                    <DropdownMenuItem active={limit === 20} onClick={() => setLimit(20)}>20 per page</DropdownMenuItem>
                                    <DropdownMenuItem active={limit === 50} onClick={() => setLimit(50)}>50 per page</DropdownMenuItem>
                                </div>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    {/* Pill Tabs for Role */}
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-2 px-2">
                        {roles.map(r => (
                            <button
                                key={r.value}
                                onClick={() => setUserRoleFilter(r.value)}
                                className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors border ${userRoleFilter === r.value
                                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                                    : 'bg-muted/30 text-muted-foreground hover:bg-muted/60 border-transparent hover:border-border/30'
                                    }`}
                            >
                                {r.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* User Cards List */}
                <div className="space-y-3 pb-8">
                    {usersLoading && sortedUsers?.length === 0 ? (
                        <div className="py-10 flex justify-center"><Loader /></div>
                    ) : sortedUsers?.length === 0 ? (
                        <div className="text-center py-10 bg-card/50 rounded-xl border border-dashed border-border text-muted-foreground">No users found.</div>
                    ) : sortedUsers?.map((u: any) => (
                        <div key={u.id} className="flex items-start gap-3 p-4 bg-card rounded-2xl border border-border/60 hover:border-border hover:shadow-sm transition-all duration-200">
                            {/* Avatar Area with Notification Status */}
                            <div className="shrink-0 mt-0.5">
                                {u.push_notifications_enabled ? (
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <div className="relative group cursor-pointer w-fit">
                                                <Avatar className="h-11 w-11 transition-transform group-hover:scale-105 duration-300">
                                                    <AvatarFallback className={`${u.platform_role === 'admin' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' :
                                                        u.platform_role === 'controller' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                                            'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                                        } font-semibold text-sm`}>
                                                        {u.name?.slice(0, 2).toUpperCase() || 'U'}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="absolute -top-1 -right-1 flex items-center justify-center translate-x-1/4 -translate-y-1/4">
                                                    <div className="absolute h-full w-full rounded-full bg-amber-400 animate-ping opacity-40" />
                                                    <div className="relative h-5 w-5 rounded-full bg-linear-to-tr from-amber-500 to-amber-300 border-2 border-background shadow-[0_2px_10px_rgba(245,158,11,0.5)] flex items-center justify-center animate-in zoom-in duration-500">
                                                        <Bell className="h-2.5 w-2.5 text-white fill-white" />
                                                    </div>
                                                </div>
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent side="bottom" className="left-0 translate-x-0 bg-background/95 backdrop-blur-md border-primary/10 shadow-xl font-medium">
                                            Notifications enabled
                                        </TooltipContent>
                                    </Tooltip>
                                ) : (
                                    <Avatar className="h-11 w-11">
                                        <AvatarFallback className={`${u.platform_role === 'admin' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' :
                                            u.platform_role === 'controller' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                                'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                            } font-semibold text-sm`}>
                                            {u.name?.slice(0, 2).toUpperCase() || 'U'}
                                        </AvatarFallback>
                                    </Avatar>
                                )}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2 max-w-full">
                                    <div className="flex items-center gap-2 truncate">
                                        <h3 className="font-semibold text-foreground truncate">{u.name}</h3>
                                        <Badge variant="secondary" className="capitalize text-[10px] px-1.5 py-0 h-4 bg-muted/60 text-muted-foreground/90 font-medium tracking-wide">
                                            {u.platform_role === 'member' ? 'Team Member' : u.platform_role}
                                        </Badge>
                                    </div>
                                </div>

                                <p className="text-[13px] text-muted-foreground truncate mb-2 mt-0.5">{u.email}</p>

                                <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium flex-wrap">
                                    {/* <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-1.5 py-0.5 rounded-md">
                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Active
                                    </span> */}
                                    <StatusBadge last_seen_at={u.last_seen_at} />
                                    <span className="capitalize opacity-80">Workflow: {u.workflow_role || 'General'}</span>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="shrink-0 -mt-1 -mr-2">
                                {!isAdmin && !hasAccess('users', 'delete') && !hasAccess('users', 'write') ? (
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <span className="inline-block cursor-not-allowed">
                                                <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-muted pointer-events-none" disabled={true}>
                                                    <span className="sr-only">Open menu</span>
                                                    <MoreVertical className="h-4 w-4 text-muted-foreground" />
                                                </Button>
                                            </span>
                                        </TooltipTrigger>
                                        <TooltipContent side="left">
                                            You do not have access to this. Contact Admin.
                                        </TooltipContent>
                                    </Tooltip>
                                ) : (canEdit || canDelete) && (
                                    <DropdownMenu>
                                        <DropdownMenuTrigger className="focus:outline-none">
                                            <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-muted/50 rounded-full text-muted-foreground hover:text-foreground">
                                                <MoreVertical className="h-5 w-5" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-[180px] rounded-xl shadow-lg">
                                            {isSuperAdmin && (
                                                <DropdownMenuItem className="cursor-pointer py-2 text-primary font-bold" onClick={() => {
                                                    impersonate(u.id);
                                                    router.push('/dashboard');
                                                }}>
                                                    <Eye className="mr-2 h-4 w-4" />
                                                    <span>Login As</span>
                                                </DropdownMenuItem>
                                            )}
                                            {((isAdmin || hasAccess('users', 'write')) && canEdit) && (
                                                <>
                                                    <DropdownMenuItem className="cursor-pointer py-2" onClick={() => {
                                                        setselectedUser(u);
                                                        setEditUserModal(true);
                                                    }}>
                                                        <Edit2 className="mr-2 h-4 w-4" />
                                                        <span>Edit User</span>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem className="cursor-pointer py-2" onClick={() => {
                                                        setselectedUser(u);
                                                        setChangePasswordModal(true);
                                                    }}>
                                                        <Settings className="mr-2 h-4 w-4" />
                                                        <span>Change Password</span>
                                                    </DropdownMenuItem>
                                                </>
                                            )}
                                            {((isAdmin || hasAccess('users', 'delete')) && canDelete) && (
                                                <DropdownMenuItem className="cursor-pointer py-2 text-destructive focus:text-destructive" onClick={() => {
                                                    setselectedUser(u);
                                                    setDeleteUserModal(true);
                                                }}>
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    <span>Delete</span>
                                                </DropdownMenuItem>
                                            )}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Mobile Pagination */}
                {(usercount > 0 && usertotalpages > 1) && (
                    <div className="flex items-center justify-between mt-4 pb-8">
                        <div className="text-sm text-muted-foreground">
                            Page {userpage} of {usertotalpages}
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                className="h-9 px-4 rounded-xl"
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page <= 1 || usersLoading}
                            >
                                Prev
                            </Button>
                            <Button
                                variant="outline"
                                className="h-9 px-4 rounded-xl"
                                onClick={() => setPage(p => Math.min(usertotalpages || 1, p + 1))}
                                disabled={page >= (usertotalpages || 1) || usersLoading}
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                )}
            </div>


            {/* --- DESKTOP VIEW (Previous Table-based UI) --- */}
            <div className="hidden md:block">
                <div className="flex items-start justify-between mb-6">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight text-foreground">User Management</h2>
                        <p className="text-sm text-muted-foreground mt-1">Add, edit, and manage user accounts and roles</p>
                    </div>
                    <div>
                        {!isSuperAdmin && !isAdmin && !hasAccess('users', 'write') ? (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <span className="inline-block cursor-not-allowed">
                                        <Button size="sm" onClick={() => setIsAddUserOpen(true)} disabled={true}
                                        // className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4"
                                        >
                                            <Plus className="h-4 w-4 mr-1.5" /> Add User
                                        </Button>
                                    </span>
                                </TooltipTrigger>
                                <TooltipContent side="left">
                                    You do not have adding user access. Contact Admin.
                                </TooltipContent>
                            </Tooltip>
                        ) : canCreate && (
                            <Button size="sm" onClick={() => setIsAddUserOpen(true)}
                            // className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4"
                            >
                                <Plus className="h-4 w-4 mr-1.5" /> Add User
                            </Button>
                        )}
                    </div>
                </div>

                {/* Desktop Filters */}
                <div className="flex gap-4 mb-6">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search users..."
                            className="pl-9 h-10 bg-card border-border/50 rounded-xl"
                            value={search}
                            onChange={e => setSearch?.(e.target.value)}
                        />
                    </div>
                    <UISelect
                        value={userRoleFilter}
                        onValueChange={(val: string) => setUserRoleFilter(val)}
                        options={[
                            { value: 'all', label: 'All Roles' },
                            { value: 'admin', label: 'Admin' },
                            { value: 'controller', label: 'Controller' },
                            { value: 'member', label: 'Member' },
                        ]}
                    />
                    <div className="flex items-center gap-2 ml-2">
                        <span className="text-sm font-medium text-muted-foreground mr-1">Show:</span>
                        <UISelect
                            value={limit.toString()}
                            onValueChange={(val) => setLimit(Number(val))}
                            className="h-10 rounded-xl"
                            options={[
                                { value: '10', label: '10' },
                                { value: '20', label: '20' },
                                { value: '50', label: '50' },
                            ]}
                        />
                        <span className="text-sm text-muted-foreground ml-1">users</span>
                    </div>
                </div>

                {/* Desktop Table */}
                <div className="rounded-xl border border-border/60 overflow-hidden bg-card shadow-sm">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/30 text-muted-foreground border-b border-border/60">
                            <tr>
                                <th
                                    className="text-left px-6 py-4 font-semibold cursor-pointer hover:bg-muted/50 transition-colors group/th"
                                    onClick={() => handleSort('name')}
                                >
                                    <div className="flex items-center gap-2 uppercase text-[11px] tracking-wider">
                                        Name
                                        <div className="text-muted-foreground/30 group-hover/th:text-primary transition-colors">
                                            {sortConfig.key === 'name' ? (
                                                sortConfig.direction === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                                            ) : <ArrowUpDown className="h-3 w-3" />}
                                        </div>
                                    </div>
                                </th>
                                <th
                                    className="text-left px-6 py-4 font-semibold cursor-pointer hover:bg-muted/50 transition-colors group/th"
                                    onClick={() => handleSort('email')}
                                >
                                    <div className="flex items-center gap-2 uppercase text-[11px] tracking-wider">
                                        Email
                                        <div className="text-muted-foreground/30 group-hover/th:text-primary transition-colors">
                                            {sortConfig.key === 'email' ? (
                                                sortConfig.direction === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                                            ) : <ArrowUpDown className="h-3 w-3" />}
                                        </div>
                                    </div>
                                </th>
                                <th
                                    className="text-left px-6 py-4 font-semibold cursor-pointer hover:bg-muted/50 transition-colors group/th"
                                    onClick={() => handleSort('platform_role')}
                                >
                                    <div className="flex items-center gap-2 uppercase text-[11px] tracking-wider">
                                        Role
                                        <div className="text-muted-foreground/30 group-hover/th:text-primary transition-colors">
                                            {sortConfig.key === 'platform_role' ? (
                                                sortConfig.direction === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                                            ) : <ArrowUpDown className="h-3 w-3" />}
                                        </div>
                                    </div>
                                </th>
                                <th
                                    className="text-left px-6 py-4 font-semibold cursor-pointer hover:bg-muted/50 transition-colors group/th"
                                    onClick={() => handleSort('workflow_role')}
                                >
                                    <div className="flex items-center gap-2 uppercase text-[11px] tracking-wider">
                                        Workflow Role
                                        <div className="text-muted-foreground/30 group-hover/th:text-primary transition-colors">
                                            {sortConfig.key === 'workflow_role' ? (
                                                sortConfig.direction === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                                            ) : <ArrowUpDown className="h-3 w-3" />}
                                        </div>
                                    </div>
                                </th>
                                <th className="text-left px-6 py-4 font-semibold">
                                    <div className="flex items-center gap-2 uppercase text-[11px] tracking-wider">Status</div>
                                </th>
                                <th className="text-left px-6 py-4 font-semibold">
                                    <div className="flex items-center gap-2 uppercase text-[11px] tracking-wider">Actions</div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                            {usersLoading && sortedUsers?.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-20 text-center">
                                        <div className="flex flex-col items-center gap-2">
                                            <Loader />
                                            <span className="text-xs text-muted-foreground">Loading users...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : sortedUsers?.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-20 text-muted-foreground italic">
                                        No users found in this view.
                                    </td>
                                </tr>
                            ) : sortedUsers?.map((u: any) => (
                                <tr key={u.id} className="hover:bg-muted/20 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            {u.push_notifications_enabled ? (
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <div className="relative group cursor-pointer w-fit">
                                                            <Avatar className="h-9 w-9 transition-transform group-hover:scale-105 duration-300">
                                                                <AvatarFallback className="bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400 text-xs font-bold">
                                                                    {u.name?.slice(0, 2).toUpperCase() || 'U'}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                            <div className="absolute -top-1 -right-1 flex items-center justify-center translate-x-1/4 -translate-y-1/4">
                                                                <div className="absolute h-full w-full rounded-full bg-amber-400 animate-ping opacity-40" />
                                                                <div className="relative h-4 w-4 rounded-full bg-gradient-to-tr from-amber-500 to-amber-300 border-2 border-background shadow-[0_2px_8px_rgba(245,158,11,0.4)] flex items-center justify-center animate-in zoom-in duration-500">
                                                                    <Bell className="h-2 w-2 text-white fill-white" />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="bottom" className="left-0 translate-x-0 bg-background/95 backdrop-blur-md border-primary/10 shadow-xl font-medium">
                                                        Notifications enabled
                                                    </TooltipContent>
                                                </Tooltip>
                                            ) : (
                                                <Avatar className="h-9 w-9">
                                                    <AvatarFallback className="bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400 text-xs font-bold">
                                                        {u.name?.slice(0, 2).toUpperCase() || 'U'}
                                                    </AvatarFallback>
                                                </Avatar>
                                            )}
                                            <span className="font-semibold text-foreground group-hover:text-primary transition-colors">{u.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-muted-foreground">{u.email}</td>
                                    <td className="px-6 py-4">
                                        <Badge variant="outline" className="capitalize text-[11px] font-medium border-border/50">
                                            {u.platform_role === 'member' ? 'Team Member' : u.platform_role}
                                        </Badge>
                                    </td>
                                    <td className="px-6 py-4 text-muted-foreground capitalize">
                                        {u.workflow_role || '—'}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                            <StatusBadge last_seen_at={u.last_seen_at} />

                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        {(!isAdmin && !isSuperAdmin) && !hasAccess('users', 'delete') && !hasAccess('users', 'write') ? (
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <span className="inline-block cursor-not-allowed">
                                                        <Button variant="ghost" className="h-8 w-8 p-0" disabled>
                                                            <MoreVertical className="h-4 w-4 text-muted-foreground opacity-50" />
                                                        </Button>
                                                    </span>
                                                </TooltipTrigger>
                                                <TooltipContent>No access</TooltipContent>
                                            </Tooltip>
                                        ) : (canEdit || canDelete) && (
                                            <DropdownMenu>
                                                <DropdownMenuTrigger>
                                                    <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-muted/80 rounded-full">
                                                        <MoreVertical className="h-4 w-4 text-muted-foreground" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-[180px] rounded-xl shadow-xl">
                                                    {isSuperAdmin && (
                                                        <DropdownMenuItem className="cursor-pointer font-bold text-primary" onClick={() => {
                                                            impersonate(u.id);
                                                            router.push('/dashboard');
                                                        }}>
                                                            <Eye className="mr-2 h-4 w-4" /> Login As
                                                        </DropdownMenuItem>
                                                    )}
                                                    {((isAdmin || hasAccess('users', 'write')) && canEdit) && (
                                                        <>
                                                            <DropdownMenuItem onClick={() => { setselectedUser(u); setEditUserModal(true); }}>
                                                                <Edit2 className="mr-2 h-4 w-4" /> Edit User
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => { setselectedUser(u); setChangePasswordModal(true); }}>
                                                                <Settings className="mr-2 h-4 w-4" /> Change Password
                                                            </DropdownMenuItem>
                                                        </>
                                                    )}
                                                    {((isAdmin || hasAccess('users', 'delete')) && canDelete) && (
                                                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => { setselectedUser(u); setDeleteUserModal(true); }}>
                                                            <Trash2 className="mr-2 h-4 w-4" /> Delete User
                                                        </DropdownMenuItem>
                                                    )}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* Desktop Pagination Bar */}
                    <div className="flex items-center justify-between border-t border-border/60 px-6 py-4 bg-muted/10">
                        <div className="text-sm text-muted-foreground font-medium">
                            Showing page <span className="text-foreground">{userpage || 1}</span> of <span className="text-foreground">{usertotalpages || 1}</span> ({usercount} users)
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-9 px-4 rounded-lg bg-card"
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={(userpage || 1) <= 1 || usersLoading}
                            >
                                Previous
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-9 px-4 rounded-lg bg-card"
                                onClick={() => setPage(p => Math.min(usertotalpages || 1, p + 1))}
                                disabled={(userpage || 1) >= (usertotalpages || 1) || usersLoading}
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modals are globally shared */}
            <EditUserModal
                open={editUserModal}
                editUser={selectedUser}
                onClose={() => setEditUserModal(false)}
            />
            <DeleteUserModal open={deleteUserModal} onClose={() => setDeleteUserModal(false)} selectedUser={selectedUser} />
            <AddUserModal open={isAddUserOpen} onOpenChange={setIsAddUserOpen} />
            <ChangePasswordModalForAdmin open={changePasswordModal} onClose={() => setChangePasswordModal(false)} selectedUser={selectedUser} />
        </div >
    );
}
