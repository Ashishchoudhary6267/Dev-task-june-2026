'use client';

import { useMemo } from 'react';
import { useAuthStore } from '@/lib/zustand/user/user';

export interface ModulePermission {
    id: string;
    uid: string;
    company_id: string;
    module: string;
    can_read: boolean;
    can_write: boolean;
    can_delete: boolean;
    created_at: string;
    updated_at: string;
}

export const usePermissions = (moduleName?: string) => {
    const { user, isAuthenticated } = useAuthStore();

    // Read directly from the user object in the store
    const allPermissions = (user?.permissions || []) as ModulePermission[];

    const result = useMemo(() => {
        // Admin Case: Standard admins usually have full access
        // Platform role 'admin' or 'superadmin' gets everything
        // if (user?.platform_role === 'admin' || user?.platform_role === 'superadmin') {
        //     return {
        //         canRead: true,
        //         canWrite: true,
        //         canDelete: true,
        //         permissions: allPermissions,
        //         loading: false,
        //         hasAccess: () => true
        //     };
        // }

        // Helper to check any module manually
        const checkAccess = (mod: string, action: 'read' | 'write' | 'delete') => {
            const p = allPermissions.find(x => x.module === mod);
            return p ? p[`can_${action}` as keyof ModulePermission] === true : false;
        };

        // Specific Module Case
        if (moduleName) {
            return {
                canRead: checkAccess(moduleName, 'read'),
                canWrite: checkAccess(moduleName, 'write'),
                canDelete: checkAccess(moduleName, 'delete'),
                permissions: allPermissions,
                loading: false,
                hasAccess: checkAccess
            };
        }

        // General Case
        return {
            permissions: allPermissions,
            loading: false,
            hasAccess: checkAccess
        };
    }, [allPermissions, moduleName, user]);

    return result;
};
