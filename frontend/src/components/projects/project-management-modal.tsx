'use client';

import React, { useEffect, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useUserStore } from '@/lib/zustand/user/addUser';
import { AddProjectModal } from './add-project-modal';
import { Plus, Search, User as UserIcon } from 'lucide-react';
import { Input, Avatar, AvatarFallback, Badge } from '@/components/ui';
import { useProjectStore } from '@/lib/zustand/projects/createproject';
import { useRouter } from 'next/navigation';

interface ProjectManagementModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ProjectManagementModal({ open, onOpenChange }: ProjectManagementModalProps) {
    const { projects, fetchprojects, projectsloading, projectscount } = useProjectStore();
    const [isAddProjectOpen, setIsAddProjectOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const router = useRouter();

    useEffect(() => {
        fetchprojects();
    }, [open, fetchprojects])

    const filteredProjects = projects?.filter((project) =>
        project?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project?.client_name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-[800px] h-[80vh] flex flex-col p-0 gap-0">
                    <DialogHeader className="px-6 py-4 border-b border-border">
                        <div className="flex items-center justify-between">
                            <div>
                                <DialogTitle className="text-xl">Projects Management</DialogTitle>
                                <DialogDescription className="mt-1">
                                    Manage projects and their permissions.
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-border bg-muted/20">
                        <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder="Search projects by name or client name..."
                                className="pl-9 bg-background"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className="flex flex-row items-center gap-2 whitespace-nowrap shrink-0">
                            <Button variant='default' onClick={() => setIsAddProjectOpen(true)} size="sm">
                                <Plus className="h-4 w-4" /> Add Projects
                            </Button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6">
                        {projectsloading && projects?.length === 0 ? (
                            <div className="flex items-center justify-center py-10 text-muted-foreground">
                                Loading Projects...
                            </div>
                        ) : filteredProjects?.length > 0 ? (
                            <div className="grid grid-cols-1 gap-4">
                                {filteredProjects?.map((user) => (
                                    <div
                                        key={user.id || Math.random()} // Fallback key
                                        className="flex items-center justify-between p-4 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors"
                                    >
                                        <div className="flex items-center gap-4">
                                            <Avatar>
                                                <AvatarFallback className="bg-primary/10 text-primary">
                                                    {user.name?.slice(0, 2).toUpperCase() || 'U'}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <div className="font-medium text-foreground">
                                                    {user?.name || 'Unknown Name'}
                                                </div>
                                                <div className="text-sm text-muted-foreground">
                                                    {user?.client_name || 'No Client Name'}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <Badge variant={user?.status === 'active' ? 'success' : 'warning'} className="capitalize">
                                                {user?.status || 'Member'}
                                            </Badge>
                                            <Button onClick={() => router.push(`/project-details/${user.id}`)} variant='outline'>View</Button>
                                            {/* Future actions like Edit/Delete could go here */}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                                <UserIcon className="h-12 w-12 mb-4 opacity-20" />
                                <p>No projects found matching your search.</p>
                            </div>
                        )}
                    </div>

                    <div className="p-4 border-t border-border text-xs text-center text-muted-foreground">
                        Total Projects: {projectscount}
                    </div>
                </DialogContent>
            </Dialog>

            <AddProjectModal open={isAddProjectOpen} onOpenChange={setIsAddProjectOpen} />
        </>
    );
}
