import React, { useEffect, useState } from 'react'
import { Client } from '@/lib/types/auth';
import { Button } from '../ui/button';
import { RefreshCw, Plus, Search, Edit2, Trash2, Mail, Phone, MapPin, Briefcase, ChevronDown, MoreHorizontal, Globe, ArrowUpDown, ChevronUp } from 'lucide-react';
import { Input } from '../ui/input';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Badge } from '../ui/badge';
import { useClientStore } from '@/lib/zustand/clients/client';
import { useSACompanyDataStore } from '@/lib/zustand/superadmin/company-data';
import { AddClientModal } from './add-client-modal';
import DeleteClientModal, { EditClientModal } from './edit-client-modal';
import Loader from '../ui/loader';
import { useAuthStore } from '@/lib/zustand/user/user';
import { useToast } from '../ui/toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { UISelect } from '../ui';
import { useAccessControl } from '@/lib/contexts/access-control-context';

export default function ClientsTab({ companyId }: { companyId?: string }) {
    const { canCreate, canEdit, canDelete } = useAccessControl();
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [isAddClientOpen, setIsAddClientOpen] = useState(false);
    const [isEditClientOpen, setIsEditClientOpen] = useState(false);
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [activeType, setActiveType] = useState<'CLIENT' | 'SERVICE'>('CLIENT');
    const [isDeleteClientOpen, setIsDeleteClientOpen] = useState(false);
    const [limit, setLimit] = useState(10);
    const [page, setPage] = useState(1);
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
    const { user } = useAuthStore();
    const { addToast } = useToast();
    const isAdmin = user?.platform_role === 'admin';
    const isSuperAdmin = user?.platform_role === 'superadmin';
    const usingSAStore = !!companyId && isSuperAdmin;
    const { hasAccess } = usePermissions();

    // Admin store (default)
    const adminClientStore = useClientStore();
    // SA store (superadmin viewing a specific company)
    const saStore = useSACompanyDataStore();

    const clients = usingSAStore ? saStore.clients : adminClientStore.clients;
    const clientsCount = usingSAStore ? saStore.clientsCount : adminClientStore.clientsCount;
    const clientsPagination = usingSAStore ? saStore.clientsPagination : adminClientStore.clientsPagination;
    const clientsloading = usingSAStore ? saStore.clientsLoading : adminClientStore.clientsloading;
    const updateClient = adminClientStore.updateClient;

    const sortedClients = React.useMemo(() => {
        let sortableClients = [...(clients || [])];
        if (sortConfig.key && sortConfig.direction) {
            sortableClients.sort((a: any, b: any) => {
                let aValue = a[sortConfig.key];
                let bValue = b[sortConfig.key];

                if (typeof aValue === 'string') aValue = aValue.toLowerCase();
                if (typeof bValue === 'string') bValue = bValue.toLowerCase();

                if (aValue == null) aValue = '';
                if (bValue == null) bValue = '';

                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return sortableClients;
    }, [clients, sortConfig]);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(search);
            setPage(1); // Reset to page 1 on new search
        }, 500);
        return () => clearTimeout(handler);
    }, [search]);

    useEffect(() => {
        if (usingSAStore) {
            saStore.fetchSAClients(companyId!, page, limit, debouncedSearch);
        } else {
            adminClientStore.fetchClients(companyId, page, limit, debouncedSearch, activeType);
        }
    }, [companyId, page, limit, debouncedSearch, activeType]);

    const handleStatusChange = async (clientId: string, newStatus: string, oldStatus: string) => {
        if (newStatus === oldStatus) {
            addToast({
                title: 'Select another status',
                description: `Client status is already ${newStatus.replace('_', ' ')}`,
                variant: 'warning'
            })
            return;
        };
        const success = await updateClient(clientId, { status: newStatus });
        if (success) {
            addToast({
                title: 'Status Updated',
                description: `Client status changed to ${newStatus.replace('_', ' ')}`,
                variant: 'success'
            });
        }
    };

    return (
        <div className="space-y-6 border border-border rounded-xl p-4 bg-card">
            {/* Header section with modernization */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div className="space-y-1">
                    <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground" style={{ fontFamily: 'Manrope, sans-serif' }}>
                        Client Management
                    </h2>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        Manage your clients and their contact information
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-9 rounded-xl border-border/40 hover:bg-muted/50 transition-all font-semibold"
                        onClick={() => usingSAStore ? saStore.fetchSAClients(companyId!, page, limit, debouncedSearch) : adminClientStore.fetchClients(companyId, page, limit, debouncedSearch)}
                    >
                        <RefreshCw className={`h-4 w-4 mr-1.5 ${clientsloading ? 'animate-spin' : ''}`} /> Refresh
                    </Button>

                    {!isSuperAdmin && !isAdmin && !hasAccess('clients', 'write') ? (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span className="inline-block cursor-not-allowed">
                                    <Button size="sm" className="h-9 rounded-xl font-bold px-4" disabled={true}>
                                        <Plus className="h-4 w-4 mr-1.5" /> Add Client
                                    </Button>
                                </span>
                            </TooltipTrigger>
                            <TooltipContent side="left">
                                You do not have access to this. Contact Admin for access.
                            </TooltipContent>
                        </Tooltip>
                    ) : canCreate && (
                        <Button size="sm" className="h-9 rounded-xl font-bold px-4 shadow-sm" onClick={() => setIsAddClientOpen(true)}>
                            <Plus className="h-4 w-4 mr-1.5" /> Add Client
                        </Button>
                    )}
                </div>
            </div>

            {/* Tab selection for Client vs Service */}
            <div className="flex p-1 bg-muted/20 rounded-2xl w-full sm:w-fit mb-2">
                <button
                    onClick={() => { setActiveType('CLIENT'); setPage(1); }}
                    className={cn(
                        "px-6 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 flex items-center gap-2",
                        activeType === 'CLIENT' ? "bg-white shadow-sm text-primary" : "text-muted-foreground hover:bg-white/50"
                    )}
                >
                    <Briefcase className="h-4 w-4" />
                    CLIENTS
                </button>
                <button
                    onClick={() => { setActiveType('SERVICE'); setPage(1); }}
                    className={cn(
                        "px-6 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 flex items-center gap-2",
                        activeType === 'SERVICE' ? "bg-white shadow-sm text-primary" : "text-muted-foreground hover:bg-white/50"
                    )}
                >
                    <RefreshCw className="h-4 w-4" />
                    SERVICES
                </button>
            </div>

            {/* Filters modernized */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="relative flex-1 sm:max-w-sm">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search clients, emails, locations..."
                        className="pl-10 h-11 rounded-xl bg-white border-border/40 shadow-sm focus:border-primary/40 focus:ring-primary/5 text-sm"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2 pb-1 sm:pb-0">
                    <UISelect
                        value={limit.toString()}
                        onValueChange={(val) => setLimit(Number(val))}
                        className=""
                        placeholder={limit.toString()}
                        contentWidth="min-w-24"
                        options={[
                            { value: '10', label: '10' },
                            { value: '20', label: '20' },
                            { value: '50', label: '50' },
                        ]}
                    />
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest whitespace-nowrap"> clients</span>
                </div>
            </div>


            {/* large screen */}
            <div className="rounded-xl border border-border bg-card sm:block hidden">
                <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-muted-foreground [&_th:first-child]:rounded-tl-xl [&_th:last-child]:rounded-tr-xl">
                        <tr>
                            {[
                                { label: 'Name', key: 'name' },
                                { label: 'Email', key: 'email' },
                                { label: 'Phone', key: 'phone' },
                                { label: 'Location', key: 'location' },
                                { label: 'Status', key: 'status' },
                            ].map(h => (
                                <th 
                                    key={h.key} 
                                    className="text-left px-4 py-3 font-semibold cursor-pointer hover:bg-muted/50 transition-colors group/th text-xs uppercase tracking-wider"
                                    onClick={() => handleSort(h.key)}
                                >
                                    <div className="flex items-center gap-1.5">
                                        {h.label}
                                        <div className="text-muted-foreground/30 group-hover/th:text-primary transition-colors">
                                            {sortConfig.key === h.key ? (
                                                sortConfig.direction === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                                            ) : <ArrowUpDown className="h-3 w-3" />}
                                        </div>
                                    </div>
                                </th>
                            ))}
                            <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {clientsloading && sortedClients?.length === 0 ? (
                            <tr><td colSpan={6} className="text-center py-10 text-muted-foreground"><Loader /></td></tr>
                        ) : sortedClients?.length === 0 ? (
                            <tr><td colSpan={6} className="text-center py-10 text-muted-foreground">No clients found.</td></tr>
                        ) : sortedClients?.map((u: Client) => (
                            <tr key={u.id} className="bg-card hover:bg-muted/30 transition-colors">
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-3">
                                        <Avatar size="sm">
                                            <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                                {u.name?.slice(0, 2).toUpperCase() || 'C'}
                                            </AvatarFallback>
                                        </Avatar>
                                        <span className="font-medium text-foreground">{u.name}</span>
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                                <td className="px-4 py-3 text-muted-foreground">{u.phone || '—'}</td>
                                <td className="px-4 py-3 text-muted-foreground">{u.location || '—'}</td>
                                <td className="px-4 py-3">
                                    {isAdmin || hasAccess('clients', 'write') ? (
                                        <DropdownMenu>
                                            <DropdownMenuTrigger className="outline-none group">
                                                <Badge
                                                    variant={
                                                        u?.status === 'active' || u?.status === 'completed' ? 'success' :
                                                            u?.status === 'in_progress' ? 'default' :
                                                                u?.status === 'hold' || u?.status === 'pause' ? 'warning' :
                                                                    'outline'
                                                    }
                                                    className="text-[10px] uppercase font-bold py-0.5 px-2 flex items-center gap-1 cursor-pointer group-hover:opacity-80 transition-opacity"
                                                >
                                                    {u?.status?.replace('_', ' ') || 'not started'}
                                                    <ChevronDown className="h-3 w-3 opacity-50" />
                                                </Badge>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="start" className="w-40 z-100">
                                                {/* <DropdownMenuItem onClick={() => handleStatusChange(u.id, 'not_started', u.status)}>Not Started</DropdownMenuItem> */}
                                                {/* <DropdownMenuItem onClick={() => handleStatusChange(u.id, 'in_progress', u.status)}>In Progress</DropdownMenuItem> */}
                                                {/* <DropdownMenuItem onClick={() => handleStatusChange(u.id, 'completed', u.status)}>Completed</DropdownMenuItem> */}
                                                <DropdownMenuItem onClick={() => handleStatusChange(u.id, 'pause', u.status)}>Pause</DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleStatusChange(u.id, 'hold', u.status)}>Hold</DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleStatusChange(u.id, 'active', u.status)}>Active</DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleStatusChange(u.id, 'inactive', u.status)}>Inactive</DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    ) : (
                                        <Badge
                                            variant={
                                                u?.status === 'active' || u?.status === 'completed' ? 'success' :
                                                    u?.status === 'in_progress' ? 'default' :
                                                        u?.status === 'hold' || u?.status === 'pause' ? 'warning' :
                                                            'outline'
                                            }
                                            className="text-[10px] uppercase font-bold py-0.5 px-2"
                                        >
                                            {u?.status?.replace('_', ' ') || 'not started'}
                                        </Badge>
                                    )}
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex gap-2">
                                        {!isAdmin && !hasAccess('clients', 'write') ? (
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <span className="inline-block cursor-not-allowed">
                                                        <button className="p-1.5 rounded text-muted-foreground pointer-events-none" disabled={true}>
                                                            <Edit2 className="h-3.5 w-3.5" />
                                                        </button>
                                                    </span>
                                                </TooltipTrigger>
                                                <TooltipContent side="top">
                                                    You do not have access to this. Contact Admin.
                                                </TooltipContent>
                                            </Tooltip>
                                        ) : (
                                            <button className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" onClick={() => { setSelectedClient(u); setIsEditClientOpen(true); }}>
                                                <Edit2 className="h-3.5 w-3.5" />
                                            </button>
                                        )}

                                        {!isAdmin && !hasAccess('clients', 'delete') ? (
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <span className="inline-block cursor-not-allowed">
                                                        <button className="p-1.5 rounded text-muted-foreground pointer-events-none" disabled={true}>
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                    </span>
                                                </TooltipTrigger>
                                                <TooltipContent side="left">
                                                    You do not have access to this. Contact Admin.
                                                </TooltipContent>
                                            </Tooltip>
                                        ) : (
                                            <button className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" onClick={() => { setSelectedClient(u); setIsDeleteClientOpen(true); }}>
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {/* <span className='text-xs font-semibold text-muted-foreground uppercase tracking-widest whitespace-nowrap p-4 mb-4'>Total Clients: {clientsCount}</span> */}

            </div>
            {/* GRID OF CLIENT CARDS  mobile*/}
            <div className="grid grid-cols-1 sm:hidden md:grid-cols-2 xl:grid-cols-3 gap-4">
                {clientsloading && sortedClients?.length === 0 ? (
                    <div className="col-span-full flex flex-col items-center justify-center py-20">
                        <Loader />
                    </div>
                ) : sortedClients?.length === 0 ? (
                    <div className="col-span-full flex flex-col items-center justify-center py-20 rounded-2xl bg-white border border-dashed border-border/60">
                        <div className="h-16 w-16 rounded-2xl bg-muted/30 flex items-center justify-center mb-4">
                            <Briefcase className="h-8 w-8 text-muted-foreground/30" />
                        </div>
                        <p className="font-bold text-foreground text-lg">No clients found</p>
                        <p className="text-sm text-muted-foreground">Try adjusting your search criteria</p>
                    </div>
                ) : (
                    sortedClients?.map((u: Client) => (
                        <div
                            key={u.id}
                            className="group bg-white rounded-[2rem] p-5 border border-border/30 shadow-sm hover:shadow-md hover:border-primary/20 transition-all duration-300 flex flex-col gap-5 relative overflow-hidden"
                        >
                            {/* Card Top: Branding & Status */}
                            <div className="flex items-start justify-between">
                                <div className="flex gap-4 items-center">
                                    <Avatar className="h-12 w-12 rounded-2xl ring-4 ring-muted/30 border border-border/20 shadow-inner">
                                        <AvatarFallback className="bg-linear-to-br from-primary/10 to-primary/20 text-primary font-bold text-sm">
                                            {u.name?.slice(0, 2).toUpperCase() || 'C'}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="space-y-0.5">
                                        <h3 className="font-bold text-foreground leading-tight tracking-tight text-lg" style={{ fontFamily: 'Manrope, sans-serif' }}>
                                            {u.name}
                                        </h3>
                                        <p className="text-[11px] font-bold text-primary/70 uppercase tracking-widest flex items-center gap-1.5 leading-none">
                                            <Briefcase className="h-3 w-3" />
                                            {u.company_name || 'Individual Client'}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2 items-end">
                                    {isAdmin || hasAccess('clients', 'write') ? (
                                        <DropdownMenu>
                                            <DropdownMenuTrigger className="outline-none">
                                                <Badge
                                                    variant={
                                                        u?.status === 'active' || u?.status === 'completed' ? 'success' :
                                                            u?.status === 'in_progress' ? 'default' :
                                                                u?.status === 'hold' || u?.status === 'pause' ? 'warning' :
                                                                    'outline'
                                                    }
                                                    className="rounded-full text-[9px] uppercase font-bold tracking-widest py-1 px-3 border-none flex items-center gap-1 shadow-sm hover:opacity-80 transition-all"
                                                >
                                                    {u?.status?.replace('_', ' ') || 'not started'}
                                                    <ChevronDown className="h-2.5 w-2.5 opacity-60" />
                                                </Badge>
                                            </DropdownMenuTrigger>

                                            <DropdownMenuContent align="end" className="w-48 rounded-2xl border-border/40 p-1.5 shadow-xl">
                                                {['pause', 'hold', 'active', 'inactive'].map(status => (
                                                    <DropdownMenuItem
                                                        key={status}
                                                        className="rounded-xl text-xs font-semibold py-2.5 px-3 focus:bg-primary/5 focus:text-primary transition-colors cursor-pointer"
                                                        onClick={() => handleStatusChange(u.id, status, u.status)}
                                                    >
                                                        {status.replace('_', ' ').toUpperCase()}
                                                    </DropdownMenuItem>
                                                ))}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    ) : (
                                        <Badge
                                            variant={
                                                u?.status === 'active' || u?.status === 'completed' ? 'success' :
                                                    u?.status === 'in_progress' ? 'default' :
                                                        u?.status === 'hold' || u?.status === 'pause' ? 'warning' :
                                                            'outline'
                                            }
                                            className="rounded-full text-[9px] uppercase font-bold tracking-widest py-1 px-3 border-none shadow-sm"
                                        >
                                            {u?.status?.replace('_', ' ') || 'not started'}
                                        </Badge>
                                    )}
                                </div>
                            </div>

                            {/* Card Middle: Info Pills */}
                            <div className="grid grid-cols-1 gap-2.5 p-2 rounded-[1.5rem] bg-muted/30 border border-border/40">
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-xl bg-white border border-border/30 flex items-center justify-center shadow-sm shrink-0">
                                        <Mail className="h-3.5 w-3.5 text-primary/70" />
                                    </div>
                                    <span className="text-xs font-semibold text-foreground/80 truncate font-mono tracking-tight">{u.email}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-xl bg-white border border-border/30 flex items-center justify-center shadow-sm shrink-0">
                                        <Phone className="h-3.5 w-3.5 text-primary/70" />
                                    </div>
                                    <span className="text-xs font-semibold text-foreground/80 truncate select-all">{u.phone || '—'}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-xl bg-white border border-border/30 flex items-center justify-center shadow-sm shrink-0">
                                        <MapPin className="h-3.5 w-3.5 text-primary/70" />
                                    </div>
                                    <span className="text-xs font-semibold text-foreground/80 truncate leading-tight">{u.location || 'N/A'}</span>
                                </div>
                                {u.website && (
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-xl bg-white border border-border/30 flex items-center justify-center shadow-sm shrink-0">
                                            <Globe className="h-3.5 w-3.5 text-primary/70" />
                                        </div>
                                        <a href={u.website.startsWith('http') ? u.website : `https://${u.website}`} target="_blank" rel="noreferrer" className="text-xs font-semibold text-primary hover:underline truncate">
                                            {u.website.replace(/(^\w+:|^)\/\//, '')}
                                        </a>
                                    </div>
                                )}
                            </div>

                            {/* Footer: Quick Actions */}
                            <div className="flex items-center justify-between mt-1">
                                <div className="flex gap-1.5">
                                    {(isAdmin || hasAccess('clients', 'write')) && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-9 w-9 rounded-xl hover:bg-primary/5 hover:text-primary transition-all shadow-none"
                                            onClick={() => { setSelectedClient(u); setIsEditClientOpen(true); }}
                                        >
                                            <Edit2 className="h-4 w-4" />
                                        </Button>
                                    )}

                                    {(isAdmin || hasAccess('clients', 'delete')) && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-9 w-9 rounded-xl hover:bg-destructive/5 hover:text-destructive transition-all shadow-none"
                                            onClick={() => { setSelectedClient(u); setIsDeleteClientOpen(true); }}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    )}

                                    {/* <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-9 w-9 rounded-xl hover:bg-muted transition-all shadow-none"
                                    >
                                        <MoreHorizontal className="h-4 w-4" />
                                    </Button> */}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* MODERN PAGINATION */}
            {(clientsPagination?.totalPages || 1) > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-6 py-4">
                    <div className="text-sm text-muted-foreground font-medium order-2 sm:order-1 flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                        Showing page <span className="text-foreground font-bold">{clientsPagination?.page || 1}</span> of <span className="text-foreground font-bold">{clientsPagination?.totalPages || 1}</span>
                    </div>

                    <div className="flex items-center gap-2 order-1 sm:order-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-9 px-4 rounded-xl text-xs font-bold uppercase tracking-widest border-border/50 hover:bg-primary/5 hover:text-primary hover:border-primary/20 transition-all disabled:opacity-30 flex items-center gap-2"
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={(clientsPagination?.page || 1) <= 1 || clientsloading}
                        >
                            Previous
                        </Button>

                        <div className="hidden sm:flex items-center gap-1.5 px-2">
                            {Array.from({ length: Math.min(5, clientsPagination?.totalPages || 1) }, (_, i) => {
                                const pageNum = i + 1;
                                return (
                                    <button
                                        key={pageNum}
                                        onClick={() => setPage(pageNum)}
                                        className={`h-9 w-9 rounded-xl text-xs font-bold transition-all ${(clientsPagination?.page || 1) === pageNum
                                            ? 'bg-primary text-white shadow-lg shadow-primary/20 transform scale-110'
                                            : 'text-muted-foreground hover:bg-muted/40'
                                            }`}
                                    >
                                        {pageNum}
                                    </button>
                                );
                            })}
                        </div>

                        <Button
                            variant="outline"
                            size="sm"
                            className="h-9 px-4 rounded-xl text-xs font-bold uppercase tracking-widest border-border/50 hover:bg-primary/5 hover:text-primary hover:border-primary/20 transition-all disabled:opacity-30 flex items-center gap-2"
                            onClick={() => setPage(p => p + 1)}
                            disabled={(clientsPagination?.page || 1) >= (clientsPagination?.totalPages || 1) || clientsloading}
                        >
                            Next
                        </Button>
                    </div>
                </div>
            )}

            <AddClientModal open={isAddClientOpen} onOpenChange={setIsAddClientOpen} />
            <EditClientModal open={isEditClientOpen} onOpenChange={setIsEditClientOpen} client={selectedClient} />
            <DeleteClientModal open={isDeleteClientOpen} onOpenChange={setIsDeleteClientOpen} client={selectedClient} />
        </div>
    );
}

// Helper for class consolidation
function cn(...inputs: any[]) {
    return inputs.filter(Boolean).join(' ');
}