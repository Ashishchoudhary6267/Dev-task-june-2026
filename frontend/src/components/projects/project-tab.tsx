'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { Button, Input, Badge, UISelect } from '@/components/ui';
import {
    Dialog, DialogContent, DialogDescription,
    DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { RefreshCw, Plus, Search, Edit2, Copy, Trash2, Eye, MoreVertical, Layers, Activity, Tag, SortAsc, Clock, Repeat, CheckCircle, PauseCircle, Megaphone, Share2, UserPlus, ArrowUpAZ, ArrowDownAZ, Calendar, ALargeSmall, FolderKanban, ArrowUpDown, SortDesc } from 'lucide-react';
import { useProjectStore } from '@/lib/zustand/projects/createproject';
import { useSACompanyDataStore } from '@/lib/zustand/superadmin/company-data';
import { AddProjectModal } from './add-project-modal';
import { EditTemplateModal } from './edit-template-modal';
import { useToast } from '@/components/ui/toast';
import Loader from '../ui/loader';
import { useAuthStore } from '@/lib/zustand/user/user';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '../ui/dropdown-menu';
import { useStatsStore } from '@/lib/zustand/stats/dashboard-stats';


export default function ProjectsTab({ onEditTemplate, companyId }: { onEditTemplate?: any; companyId?: string }) {
    const [projectSearch, setProjectSearch] = useState('');
    const [editTemplateOpen, setEditTemplateOpen] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
    const [isAddProjectOpen, setIsAddProjectOpen] = useState(false);

    // Delete confirmation state
    const [deleteTarget, setDeleteTarget] = useState<any>(null);
    const [deleteOpen, setDeleteOpen] = useState(false);



    const { addToast } = useToast();

    const [limit, setLimit] = useState(10);
    const [page, setPage] = useState(1);
    const [typeFilter, setTypeFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [sortBy, setSortBy] = useState('recently_created');
    const { user } = useAuthStore();
    const { fetchStats } = useStatsStore();
    const isSuperAdmin = user?.platform_role === 'superadmin';
    const usingSAStore = !!companyId && isSuperAdmin;
    const canManage = user?.platform_role === 'admin' || (isSuperAdmin && companyId === 'global');
    // ADD THESE after your existing useState declarations
    const [sortKey, setSortKey] = useState<string | null>(null);
    const [sortDir, setSortDir] = useState<'asc' | 'desc' | null>(null);

    const[makingcopy, setmakingcopy] = useState(false);
    // Admin store (used when NOT superadmin)
    const adminStore = useProjectStore();
    // SA store (used when superadmin viewing a specific company)
    const saStore = useSACompanyDataStore();

    const projects = usingSAStore ? saStore.projects : adminStore.projects;
    const projectscount = usingSAStore ? saStore.projectsCount : adminStore.projectscount;
    const projectspage = usingSAStore ? saStore.projectsPage : adminStore.projectspage;
    const projectstotalpages = usingSAStore ? saStore.projectsTotalPages : adminStore.projectstotalpages;
    const projectsloading = usingSAStore ? saStore.projectsLoading : adminStore.projectsloading;
    const deleteproject = adminStore.deleteproject;
    const copyTemplate = adminStore.copyTemplate;
    // Fetch projects when page, search, or filters change
    useEffect(() => {
        const timer = setTimeout(() => {
            if (usingSAStore) {
                saStore.fetchSAProjects(companyId!, {
                    page, limit,
                    search: projectSearch || undefined,
                    type: typeFilter,
                    status: statusFilter,
                    category: categoryFilter,
                    sortBy,
                });
            } else {
                adminStore.fetchprojects({
                    page, limit,
                    search: projectSearch || undefined,
                    type: typeFilter,
                    status: statusFilter,
                    category: categoryFilter,
                    sortBy,
                    company_id: companyId
                });
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [page, limit, projectSearch, typeFilter, statusFilter, categoryFilter, sortBy, companyId]);

    // Reset page to 1 when filters or search changes
    useEffect(() => {
        setPage(1);
    }, [projectSearch, typeFilter, statusFilter, categoryFilter, sortBy, limit]);

        const isManager= user?.workflow_role === 'interim_manager';


    const handleSort = (key: string) => {
        if (sortKey === key) {
            setSortDir(d => d === 'asc' ? 'desc' : d === 'desc' ? null : 'asc');
            if (sortDir === 'desc') setSortKey(null);
        } else {
            setSortKey(key);
            setSortDir('asc');
        }
    };
    const sortedProjects = useMemo(() => {
        if (!sortKey || !sortDir) return projects;
        return [...projects].sort((a, b) => {
            const av = a[sortKey], bv = b[sortKey];
            if (av < bv) return sortDir === 'asc' ? -1 : 1;
            if (av > bv) return sortDir === 'asc' ? 1 : -1;
            return 0;
        });
    }, [projects, sortKey, sortDir]);
    const handleRefresh = () => {
        if (usingSAStore) {
            saStore.fetchSAProjects(companyId!, {
                page, limit,
                search: projectSearch || undefined,
                type: typeFilter,
                status: statusFilter,
                category: categoryFilter,
                sortBy,
            });
        } else {
            adminStore.fetchprojects({
                page, limit,
                search: projectSearch || undefined,
                type: typeFilter,
                status: statusFilter,
                category: categoryFilter,
                sortBy,
                company_id: companyId
            });
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        const ok = await deleteproject(deleteTarget.id);
        if (ok) {
            addToast({ title: 'Template deleted', description: `"${deleteTarget.name}" and all related tasks have been deleted.`, variant: 'success' });
            handleRefresh();
            fetchStats();
        } else {
            addToast({ title: 'Error', description: 'Failed to delete template. Please try again.', variant: 'destructive' });
        }
        setDeleteOpen(false);
        setDeleteTarget(null);
    };

    const handleCopy = async (p: any) => {
        setmakingcopy(true);
        const ok = await copyTemplate(p.id);
        if (ok) {
            addToast({ title: 'Template copied', description: `"${p.name} (Copy)" has been created.`, variant: 'success' });
            handleRefresh();
        } else {
            addToast({ title: 'Error', description: 'Failed to copy template.', variant: 'destructive' });
        }
        setmakingcopy(false);
    };

    if(makingcopy){
        return(
            <Loader />
        )
    }

    return (
        <div className='overflow-auto border p-4 rounded-lg'>
            <div className="flex flex-col space-y-6 mb-8">
                {/* --- Header Area --- */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2.5 mb-1">
                            <h2 className="text-3xl font-bold tracking-tight text-foreground">Templates</h2>
                            <Badge variant="outline" className="rounded-lg border-primary/20 bg-primary/5 text-primary text-[10px] font-bold px-2 py-0.5 uppercase tracking-widest">
                                {projectscount} Total
                            </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">Create and manage reusable workflow templates.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button
                            variant="outline"
                            size="sm"
                            // className="rounded-2xl h-11 px-6 font-bold text-[11px] uppercase tracking-widest border-border/60 hover:bg-muted/50 active:scale-95 transition-all"
                            onClick={() => usingSAStore ? saStore.fetchSAProjects(companyId!) : adminStore.fetchprojects()}
                        >
                            <RefreshCw className="h-3.5 w-3.5 mr-2 group-hover:rotate-180 transition-transform duration-500" />
                            Refresh
                        </Button>
                        <Button
                            size="sm"
                            disabled={isManager}
                            // className="rounded-2xl h-11 px-8 font-bold text-[11px] uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all bg-primary hover:bg-primary/90"
                            onClick={() => setIsAddProjectOpen(true)}
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            New Template
                        </Button>
                    </div>
                </div>

                {/* --- Control Row --- */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                    <div className="relative flex-1 group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <Input
                            placeholder="Search Filter by name or reference..."
                            className="pl-11 h-12 rounded-[1.25rem] bg-card border-border/50 focus:border-primary/40 focus:ring-primary/5 transition-all text-sm font-medium shadow-sm"
                            value={projectSearch}
                            onChange={e => setProjectSearch(e.target.value)}
                        />
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2 p-1 rounded-[1.25rem] bg-card/50 sm:bg-transparent  ">
                            <UISelect
                                value={typeFilter}
                                onValueChange={(val) => setTypeFilter(val)}
                                options={[
                                    { value: 'all', label: 'All Modes', icon: Layers },
                                    { value: 'one-time', label: 'One-time', icon: Clock },
                                    { value: 'recurring', label: 'Recurring', icon: Repeat },
                                    { value: 'micro', label: 'Micro-Template', icon: ALargeSmall }
                                ]}
                            />
                            <div className="h-6 w-px bg-border/40" />
                            <UISelect
                                value={statusFilter}
                                onValueChange={(val) => setStatusFilter(val)}
                                options={[
                                    { value: 'all', label: 'All Status', icon: Activity },
                                    { value: 'active', label: 'Operational', icon: CheckCircle },
                                    { value: 'inactive', label: 'Standby', icon: PauseCircle },
                                ]}
                            />
                        </div>
                        <div className="flex items-center gap-2 p-1 rounded-[1.25rem] bg-card/50 sm:bg-transparent ">

                            <UISelect
                                value={categoryFilter}
                                onValueChange={(val) => setCategoryFilter(val)}
                                options={[
                                    { value: 'all', label: 'Categories', icon: Tag },
                                    { value: 'Campaign', label: 'Campaign', icon: Megaphone },
                                    { value: 'Social Media', label: 'Network', icon: Share2 },
                                    { value: 'Onboarding', label: 'Onboarding', icon: UserPlus },
                                ]}
                            />

                            {/* <div className="flex items-center gap-2 bg-muted/20 pl-4 pr-1 rounded-2xl h-12"> */}
                            <UISelect
                                value={sortBy}
                                onValueChange={(val) => setSortBy(val)}
                                options={[
                                    { value: 'recently_created', label: 'Newest', icon: Clock },
                                    { value: 'recently_updated', label: 'History', icon: RefreshCw },
                                    { value: 'name_asc', label: 'A-Z', icon: ArrowUpAZ },
                                    { value: 'name_desc', label: 'Z-A', icon: ArrowDownAZ },
                                ]}
                            />
                            {/* </div> */}
                        </div>
                    </div>
                </div>
            </div>

            {/* layout big screen */}
            {projectsloading && projects.length === 0 ? (
                <div className="hidden sm:flex flex-col items-center justify-center p-20 space-y-4 rounded-xl border border-border">
                    <Loader />
                    <p className="text-sm text-muted-foreground animate-pulse">Synchronizing templates...</p>
                </div>
            ) : projects.length === 0 ? (
                (!projectSearch && typeFilter === 'all' && statusFilter === 'all' && categoryFilter === 'all') ? (
                    <div className="hidden sm:block max-w-4xl mx-auto py-8 sm:py-12 animate-in fade-in zoom-in-95 duration-500 transition-all w-full">
                        <div className="bg-linear-to-b from-white to-slate-50/50 border border-slate-200/60 rounded-[2.5rem] p-8 sm:p-12 text-center shadow-xl shadow-slate-200/20 relative overflow-hidden">
                            <div className="absolute top-0 right-0 -translate-y-1/4 translate-x-1/4 opacity-10 pointer-events-none">
                                <div className="h-64 w-64 rounded-full bg-purple-400 blur-3xl"></div>
                            </div>
                            <div className="absolute bottom-0 left-0 translate-y-1/4 -translate-x-1/4 opacity-10 pointer-events-none">
                                <div className="h-64 w-64 rounded-full bg-blue-400 blur-3xl"></div>
                            </div>

                            <div className="relative z-10 flex flex-col items-center">
                                <div className="inline-flex h-20 w-20 rounded-2xl bg-linear-to-br from-purple-500 to-indigo-600 items-center justify-center mb-6 shadow-lg shadow-purple-500/30 rotate-3 transition-transform hover:rotate-6 cursor-default">
                                    <FolderKanban className="h-10 w-10 text-white" />
                                </div>

                                <h3 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-4 tracking-tight">Create Your First Template!</h3>
                                <p className="text-slate-500 text-base sm:text-lg max-w-xl mx-auto mb-10 leading-relaxed font-medium">
                                    Templates are the core of your platform. They define the step-by-step tasks that controllers will use to launch workflows.
                                </p>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 w-full text-left max-w-3xl mx-auto">
                                    <div className="p-6 rounded-3xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-shadow relative group">
                                        <div className="absolute -inset-px bg-linear-to-b from-purple-400 to-purple-600 rounded-3xl opacity-0 group-hover:opacity-10 transition-opacity"></div>
                                        <div className="h-12 w-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mb-4 group-hover:bg-purple-100 transition-colors">
                                            <Layers className="h-6 w-6" />
                                        </div>
                                        <h4 className="font-bold text-slate-900 mb-2 text-lg">1. Draft</h4>
                                        <p className="text-sm text-slate-500 leading-relaxed">Name your template and set whether it is an onboarding, one-time, or recurring workflow.</p>
                                    </div>

                                    <div className="p-6 rounded-3xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-shadow relative group">
                                        <div className="absolute -inset-px bg-linear-to-b from-blue-400 to-blue-600 rounded-3xl opacity-0 group-hover:opacity-10 transition-opacity"></div>
                                        <div className="h-12 w-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4 group-hover:bg-blue-100 transition-colors">
                                            <Edit2 className="h-6 w-6" />
                                        </div>
                                        <h4 className="font-bold text-slate-900 mb-2 text-lg">2. Add Tasks</h4>
                                        <p className="text-sm text-slate-500 leading-relaxed">Add steps! Assign turnaround times, roles, and configure up to 3 levels of approvals.</p>
                                    </div>

                                    <div className="p-6 rounded-3xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-shadow relative group">
                                        <div className="absolute -inset-px bg-linear-to-b from-green-400 to-green-600 rounded-3xl opacity-0 group-hover:opacity-10 transition-opacity"></div>
                                        <div className="h-12 w-12 rounded-2xl bg-green-50 text-green-600 flex items-center justify-center mb-4 group-hover:bg-green-100 transition-colors">
                                            <CheckCircle className="h-6 w-6" />
                                        </div>
                                        <h4 className="font-bold text-slate-900 mb-2 text-lg">3. Publish</h4>
                                        <p className="text-sm text-slate-500 leading-relaxed">Mark the template as 'Active' so Controllers can start launching instances immediately.</p>
                                    </div>
                                </div>

                                <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
                                    <Button
                                        size="lg"
                                        className="h-14 px-8 rounded-2xl font-bold bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/25 text-base transition-all hover:-translate-y-0.5"
                                        onClick={() => setIsAddProjectOpen(true)}
                                    >
                                        <Plus className="h-5 w-5 mr-2" /> Create Template
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="hidden sm:flex flex-col items-center justify-center p-20 rounded-3xl border-2 border-dashed border-border/40 bg-muted/5 min-h-[300px]">
                        <div className="h-16 w-16 rounded-2xl bg-muted/20 flex items-center justify-center text-muted-foreground mb-4">
                            <Search className="h-8 w-8 opacity-20" />
                        </div>
                        <h3 className="text-lg font-bold text-foreground">No templates found</h3>
                        <p className="text-sm text-muted-foreground mb-6">Try adjusting your filters or search query.</p>
                        <Button
                            variant="outline"
                            size="sm"
                            className="rounded-xl px-6"
                            onClick={() => {
                                setProjectSearch('');
                                setTypeFilter('all');
                                setStatusFilter('all');
                                setCategoryFilter('all');
                            }}
                        >
                            Reset Form
                        </Button>
                    </div>
                )
            ) : (
                <div className="rounded-xl border border-border overflow-hidden hidden sm:block">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/50 text-muted-foreground">
                            <tr>
                                {[
                                    { label: 'Template Name', key: 'name' },
                                    { label: 'Category', key: 'category' },
                                    { label: 'Type', key: 'type' },
                                    { label: 'Status', key: 'status' },
                                ].map(col => (
                                    <th key={col.key} onClick={() => handleSort(col.key)}
                                        className="text-left px-4 py-3 font-medium cursor-pointer select-none group">
                                        <div className="flex items-center gap-1 text-muted-foreground group-hover:text-foreground transition-colors">
                                            {col.label}
                                            {sortKey === col.key
                                                ? (sortDir === 'asc' ? <SortAsc className="h-3 w-3 text-primary" /> : <SortDesc className="h-3 w-3 text-primary" />)
                                                : <ArrowUpDown className="h-3 w-3 opacity-30 group-hover:opacity-60" />}
                                        </div>
                                    </th>
                                ))}
                                <th className="text-left px-4 py-3 font-medium">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {sortedProjects.map((p: any) => (
                                <tr key={p.id} className="bg-card hover:bg-muted/30 transition-colors">
                                    <td className="px-4 py-3 font-medium text-foreground">{p.name}</td>
                                    <td className='px-4 py-3 font-medium text-foreground'>{p.category}</td>
                                    {/* <td className="px-4 py-3 text-muted-foreground">{p.client_name || '—'}</td> */}
                                    <td className="px-4 py-3 text-muted-foreground"><Badge variant="default" className="capitalize text-xs">{p.type || '—'}</Badge></td>
                                    {/* <td className="px-4 py-3 text-muted-foreground">
                                    {p.start_date ? new Date(p.start_date).toLocaleDateString() : '—'}
                                </td> */}
                                    {/* <td className="px-4 py-3 text-muted-foreground">
                                    {p.tasks_count || 0}
                                </td> */}
                                    <td className="px-4 py-3">
                                        <Badge variant={p.status === 'active' ? 'success' : 'warning'} className="capitalize text-xs">
                                            {p.status}
                                        </Badge>
                                    </td>



                                    <td className="px-4 py-3">
                                        {canManage && (
                                            <DropdownMenu>
                                                <DropdownMenuTrigger className="cursor-pointer">
                                                    <Button variant="ghost" size="sm">
                                                        <MoreVertical className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => { setSelectedTemplate(p); setEditTemplateOpen(true); }}>
                                                        <Edit2 className="h-4 w-4 mr-2" />
                                                        Edit
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleCopy(p)}>
                                                        <Copy className="h-4 w-4 mr-2" />
                                                        Duplicate
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10" onClick={() => { setDeleteTarget(p); setDeleteOpen(true); }}>
                                                        <Trash2 className="h-4 w-4 mr-2" />
                                                        Delete
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        )}

                                    </td>

                                    {user?.platform_role === 'controller' && (
                                        <td className="px-4 py-3 text-muted-foreground" >
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground h-7 px-2"
                                                    onClick={() => { setSelectedTemplate(p); setEditTemplateOpen(true); }}
                                                >
                                                    <Eye className="h-3.5 w-3.5" />
                                                    View
                                                </Button>

                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))}


                        </tbody>
                    </table>
                </div>
            )
            }
            {/* --- Grid Layout mobile --- */}
            <div className="min-h-[400px] sm:hidden">
                {projectsloading && projects.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-20 space-y-4">
                        <Loader />
                        <p className="text-sm text-muted-foreground animate-pulse">Synchronizing templates...</p>
                    </div>
                ) : projects.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-20 rounded-3xl border-2 border-dashed border-border/40 bg-muted/5 min-h-[300px]">
                        <div className="h-16 w-16 rounded-2xl bg-muted/20 flex items-center justify-center text-muted-foreground mb-4">
                            <Layers className="h-8 w-8 opacity-20" />
                        </div>
                        <h3 className="text-lg font-bold text-foreground">No templates found</h3>
                        <p className="text-sm text-muted-foreground mb-6">Try adjusting your filters or search query.</p>
                        <Button
                            variant="outline"
                            size="sm"
                            className="rounded-xl px-6"
                            onClick={() => {
                                setProjectSearch('');
                                setTypeFilter('all');
                                setStatusFilter('all');
                                setCategoryFilter('all');
                            }}
                        >
                            Reset all filters
                        </Button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                        {sortedProjects.map((p: any) => (
                            <div
                                key={p.id}
                                className="group relative bg-card rounded-[2rem] border border-border/50 p-5 hover:border-primary/30 hover:shadow-2xl hover:shadow-primary/5 transition-all duration-300 hover:-translate-y-1 flex flex-col h-full"
                            >
                                {/* Header: Status & Actions */}
                                <div className="flex items-center justify-between mb-4">
                                    <div className='flex gap-2 items-center'>
                                        <div className=''>
                                            <h3 className="font-bold text-foreground text-sm line-clamp-2 leading-snug tracking-tight mb-1">{p.name}</h3>
                                            {/* <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                                                <Activity className="h-3 w-3 opacity-50" />
                                                {p.client_name || ''}
                                            </p> */}
                                        </div>
                                        <Badge
                                            variant={p.status === 'active' ? 'success' : 'warning'}
                                            className="rounded-full text-[10px] uppercase font-bold tracking-widest border-none shadow-sm"
                                        >
                                            {p.status}
                                        </Badge>
                                    </div>
                                    {canManage && (
                                        <DropdownMenu>
                                            <DropdownMenuTrigger>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl hover:bg-muted/50 text-muted-foreground hover:text-foreground">
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="rounded-2xl border-border/50 shadow-xl p-1.5 min-w-[160px]">
                                                <DropdownMenuItem
                                                    className="rounded-xl flex items-center gap-8 py-2.5 cursor-pointer"
                                                    onClick={() => { setSelectedTemplate(p); setEditTemplateOpen(true); }}
                                                >
                                                    <Edit2 className="h-4 w-4 text-blue-500 mr-2" />
                                                    <span className="font-semibold text-xs">Edit Template</span>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    className="rounded-xl flex items-center gap-2.5 py-2.5 cursor-pointer"
                                                    onClick={() => handleCopy(p)}
                                                >
                                                    <Copy className="h-4 w-4 text-purple-500 mr-2" />
                                                    <span className="font-semibold text-xs">Duplicate</span>
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator className="bg-border/40 my-1" />
                                                <DropdownMenuItem
                                                    className="rounded-xl flex items-center gap-2.5 py-2.5 cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/5"
                                                    onClick={() => { setDeleteTarget(p); setDeleteOpen(true); }}
                                                >
                                                    <Trash2 className="h-4 w-4 mr-2" />
                                                    <span className="font-semibold text-xs">Delete Template</span>
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    )}
                                </div>

                                {/* Footer: Metadata & View Button */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between gap-2 p-3 rounded-[1.25rem] bg-muted/30 border border-border/40">
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none">Type</span>
                                            <span className="text-[11px] font-bold text-foreground flex items-center gap-1">
                                                {p.type === 'recurring' ? <Repeat className="h-3 w-3 text-blue-500" strokeWidth={3} /> : <Clock className="h-3 w-3 text-orange-500" strokeWidth={3} />}
                                                {p.type?.replace('-', ' ') || '—'}
                                            </span>
                                        </div>
                                        <div className="h-6 w-px bg-border/50 rotate-20" />
                                        <div className="flex flex-col gap-0.5 items-end text-right">
                                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none">Started</span>
                                            <span className="text-[11px] font-bold text-foreground">
                                                {p.start_date ? new Date(p.start_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' }) : '—'}
                                            </span>
                                        </div>
                                    </div>

                                    {user?.platform_role === 'controller' && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="w-full rounded-[1.25rem] h-10 font-bold text-[11px] uppercase tracking-wider group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-all duration-300 shadow-sm"
                                            onClick={() => { setSelectedTemplate(p); setEditTemplateOpen(true); }}
                                        >
                                            <Eye className="h-3.5 w-3.5 mr-2" />
                                            View Architecture
                                        </Button>
                                    )}
                                    {canManage && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="w-full rounded-[1.25rem] h-10 font-bold text-[11px] uppercase tracking-wider hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all duration-300 shadow-sm border-border/60"
                                            onClick={() => { setSelectedTemplate(p); setEditTemplateOpen(true); }}
                                        >
                                            <Edit2 className="h-3.5 w-3.5 mr-2" />
                                            Manage Tasks
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* --- Pagination --- */}
            <div className="flex items-center justify-between p-4 rounded-[2rem] border border-border/50 bg-card/50 backdrop-blur-sm shadow-xl shadow-muted/20">
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-4">
                    Page <span className="text-primary">{projectspage}</span> / {projectstotalpages}
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl h-9 px-4 font-bold text-[10px] uppercase tracking-widest border-border/60 shadow-sm hover:scale-105 active:scale-95 transition-all"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={projectspage <= 1 || projectsloading}
                    >
                        Prev
                    </Button>
                    <div className="flex items-center gap-1 shrink-0 px-2">
                        {Array.from({ length: Math.min(5, projectstotalpages) }, (_, i) => {
                            const pageNum = i + 1;
                            return (
                                <button
                                    key={pageNum}
                                    onClick={() => setPage(pageNum)}
                                    className={`h-7 w-7 rounded-lg text-[10px] font-bold transition-all ${projectspage === pageNum
                                        ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-110'
                                        : 'bg-muted/30 text-muted-foreground hover:bg-muted/50'
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
                        className="rounded-xl h-9 px-4 font-bold text-[10px] uppercase tracking-widest border-border/60 shadow-sm hover:scale-105 active:scale-95 transition-all"
                        onClick={() => setPage(p => Math.min(projectstotalpages, p + 1))}
                        disabled={projectspage >= projectstotalpages || projectsloading}
                    >
                        Next
                    </Button>
                </div>
            </div>

            {/* Modals */}
            <AddProjectModal open={isAddProjectOpen} onOpenChange={setIsAddProjectOpen} companyId={companyId} onSuccess={handleRefresh} />
            <EditTemplateModal open={editTemplateOpen} onOpenChange={setEditTemplateOpen} template={selectedTemplate} companyId={companyId} onSuccess={handleRefresh} />

            {/* Delete confirmation dialog */}
            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <DialogContent className="sm:max-w-[420px]">
                    <DialogHeader>
                        <DialogTitle className="text-destructive">Delete Template</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete <span className="font-semibold text-foreground">"{deleteTarget?.name}"</span>?
                            <br /><br />
                            This will permanently delete the template and <span className="font-medium text-destructive">all associated template tasks, instances, and live tasks</span>. This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="bg-destructive/5 border border-destructive/20 rounded-md px-3 py-2 text-sm text-destructive">
                        ⚠️ All workflow instances created from this template will also be deleted.
                    </div>

                    <DialogFooter>
                        <div className='pt-2 flex items-center justify-end w-full gap-2'>
                            <Button variant="outline" onClick={() => { setDeleteOpen(false); setDeleteTarget(null); }}>Cancel</Button>
                            <Button
                                variant="destructive"
                                onClick={handleDelete}
                                loading={projectsloading}
                            >
                                Yes, Delete
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div >
    );
}