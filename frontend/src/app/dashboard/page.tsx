'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/zustand/user/user';

export default function DashboardRedirect() {
    const { user, isAuthenticated } = useAuthStore();
    const router = useRouter();

    useEffect(() => {
        if (!isAuthenticated) {
            router.replace('/login');
            return;
        }

        if (!user) return;

        const role = user.platform_role?.toLowerCase();
        const workflowRole = user.workflow_role?.toLowerCase();
        
        if (role === 'admin') {
            router.replace('/dashboard/admin');
        } else if (role === 'controller') {
            router.replace('/dashboard/controller');
        } else if (role === 'superadmin') {
            router.replace('/dashboard/superadmin');
        } else if (role === 'member' && workflowRole === 'interim_manager') {
            router.replace('/dashboard/controller');
        } else {
            router.replace('/dashboard/member');
        }
    }, [user, isAuthenticated, router]);

    return (
        <div className="flex min-h-screen items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
    );
}