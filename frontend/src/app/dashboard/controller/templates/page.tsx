'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useProjectStore } from '@/lib/zustand/projects/createproject';
import { useToast } from '@/components/ui/toast';
import {
    Layers, FileText, Tag, RefreshCw, Search, Eye, Copy, ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';
import { StatsCard } from '@/components/shared-components/stats-card';
import { EditTemplateModal } from '@/components/projects/edit-template-modal';
import ProjectsTab from '@/components/projects/project-tab';

export default function TemplatesPage() {
    const router = useRouter();
    const { addToast } = useToast();
    const { projects, projectscount, projectspage, projectstotalpages, projectsloading, fetchprojects, copyTemplate } = useProjectStore();
    const [showTemplate, setShowTemplate] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState<any>(null);

    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const limit = 10;

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchprojects({ page, limit, search: search || undefined });
        }, 300);
        return () => clearTimeout(timer);
    }, [page, search]);

    // Reset page to 1 when search changes
    useEffect(() => {
        setPage(1);
    }, [search]);

    // ─── Derived stats ────────────────────────────────────────────────────────
    const activeCount = useMemo(() => projects.filter(p => p.status === 'active').length, [projects]);
    const categoriesCount = useMemo(() => new Set(projects.map(p => p.client_name).filter(Boolean)).size, [projects]);

    return (
        <div className="min-h-screen bg-background p-6">

            {/* ─── Header ─────────────────────────────────────────────────── */}
            <div className="flex items-start justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Workflow Templates</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        View all available workflow templates and their configurations
                    </p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2"
                    onClick={() => fetchprojects()}
                    disabled={projectsloading}
                >
                    <RefreshCw className={`h-4 w-4 ${projectsloading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            {/* ─── Stats Row ───────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <StatsCard
                    title="Total Templates"
                    value={String(projectscount)}
                    sub="Available workflows"
                    icon={<Layers className="h-4 w-4" />}
                    gradient="from-blue-600 to-cyan-500"
                />
                <StatsCard
                    title="Active Templates"
                    value={String(activeCount)}
                    sub="Ready to use"
                    icon={<FileText className="h-4 w-4" />}
                    gradient="from-indigo-600 to-purple-500"
                />
                <StatsCard
                    title="Categories"
                    value={String(categoriesCount)}
                    sub="Different types"
                    icon={<Tag className="h-4 w-4" />}
                    gradient="from-emerald-600 to-teal-500"
                />
            </div>

            {/* ─── Search ──────────────────────────────────────────────────── */}
            {/* <div className="rounded-xl border border-border bg-card p-5 mb-6">
                <h2 className="text-base font-semibold text-foreground mb-1">Search Templates</h2>
                <p className="text-xs text-muted-foreground mb-3">
                    Find templates by name, category, or description
                </p>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search templates..."
                        className="w-full rounded-md border border-input bg-background pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
            </div> */}

            {/* ─── Table ───────────────────────────────────────────────────── */}
            {/* <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-5 py-4 border-b border-border">
                    <h2 className="text-base font-semibold text-foreground">
                        All Templates
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        Click on any template to view its detailed workflow steps
                    </p>
                </div>

                {projectsloading ? (
                    <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
                        <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Loading templates...
                    </div>
                ) : projects.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                        <Layers className="h-10 w-10 mb-3 opacity-20" />
                        <p className="font-medium">No templates found</p>
                        <p className="text-xs mt-1">Try adjusting your search query</p>
                    </div>
                ) : (
                    <div className='overflow-x-auto'>
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border text-muted-foreground">
                                    <th className="text-left px-5 py-3 font-medium">Name</th>
                                    <th className="text-left px-5 py-3 font-medium">Category</th>
                                    <th className="text-left px-5 py-3 font-medium">Template Type</th>
                                    <th className="text-left px-5 py-3 font-medium">Status</th>
                                    <th className="text-left px-5 py-3 font-medium">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {projects.map(template => (
                                    <tr
                                        key={template.id}
                                        className="hover:bg-muted/30 transition-colors"                                    >
                                        <td className="px-5 py-3 font-medium text-foreground">
                                            {template.name}
                                        </td>
                                        <td className="px-5 py-3">
                                            {template.type ? (
                                                <Badge
                                                    variant="outline"
                                                    className="text-purple-600 border-purple-300 bg-purple-50 dark:bg-purple-900/20 dark:border-purple-700 dark:text-purple-300 text-xs"
                                                >
                                                    {template.type || '—'}
                                                </Badge>
                                            ) : (
                                                <span className="text-muted-foreground text-xs">—</span>
                                            )}
                                        </td>
                                        <td className="px-5 py-3">
                                            {template.category ? (
                                                <Badge
                                                    variant="outline"
                                                    className="text-purple-600 border-purple-300 bg-purple-50 dark:bg-purple-900/20 dark:border-purple-700 dark:text-purple-300 text-xs"
                                                >
                                                    {template.category || '—'}
                                                </Badge>
                                            ) : (
                                                <span className="text-muted-foreground text-xs">—</span>
                                            )}
                                        </td>

                                        <td className="px-5 py-3">
                                            <Badge
                                                variant={template.status === 'active' ? 'default' : 'secondary'}
                                                className="capitalize text-xs"
                                            >
                                                {template.status === 'active' ? 'Active' : template.status || 'Unknown'}
                                            </Badge>
                                        </td>
                                        <td className="px-5 py-3" onClick={e => e.stopPropagation()}>
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground h-7 px-2"
                                                    onClick={() => { setShowTemplate(true); setSelectedTemplate(template) }}
                                                >
                                                    <Eye className="h-3.5 w-3.5" />
                                                    View
                                                </Button>

                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {projectstotalpages > 1 && (
                    <div className="flex items-center justify-between border-t border-border px-5 py-3 bg-muted/20">
                        <div className="text-sm text-muted-foreground">
                            Showing page {projectspage} of {projectstotalpages} ({projectscount} total templates)
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={projectspage <= 1 || projectsloading}
                            >
                                Prev
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(p => Math.min(projectstotalpages, p + 1))}
                                disabled={projectspage >= projectstotalpages || projectsloading}
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                )}
                {projectstotalpages <= 1 && (
                    <div className="px-5 py-3 border-t border-border bg-muted/20 text-xs text-muted-foreground">
                        Total templates: {projectscount}
                    </div>
                )}
            </div> */}
            <ProjectsTab />
            <EditTemplateModal open={showTemplate} onOpenChange={setShowTemplate} template={selectedTemplate} />
        </div>
    );
}
