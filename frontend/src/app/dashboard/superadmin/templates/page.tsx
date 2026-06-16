'use client';

import React, { useEffect } from 'react';
import { useAuthStore } from '@/lib/zustand/user/user';
import { useRouter } from 'next/navigation';
import ProjectsTab from '@/components/projects/project-tab';

export default function GlobalTemplates() {
    const router = useRouter();
    const { user, isAuthenticated } = useAuthStore();

    useEffect(() => {
        if (!isAuthenticated) {
            router.replace('/login');
            return;
        }
        if (user?.platform_role !== 'superadmin') {
            router.replace('/dashboard/member');
            return;
        }
    }, [isAuthenticated, user, router]);

    return (
        <main className="p-6">
            <div className="mb-6">
                <div className="flex items-center gap-3 mb-1">
                    <h1 className="text-2xl font-bold text-foreground">Super Admin Dashboard</h1>
                    <span className="px-2 py-0.5 rounded text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                        Global Platform
                    </span>
                </div>
                <p className="text-sm text-muted-foreground">Manage and edit global workflow templates for the platform</p>
            </div>
            
            <div className="bg-card rounded-xl border border-border shadow-sm p-4">
                <ProjectsTab companyId="global" />
            </div>
        </main>
    );
}
