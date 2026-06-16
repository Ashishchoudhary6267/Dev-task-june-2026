'use client';

import React, { createContext, useContext, useMemo } from 'react';
import { useAuthStore } from '@/lib/zustand/user/user';

interface AccessControlContextType {
    isInterimManager: boolean;
    isReadOnly: boolean;
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
}

const AccessControlContext = createContext<AccessControlContextType>({
    isInterimManager: false,
    isReadOnly: false,
    canCreate: true,
    canEdit: true,
    canDelete: true,
});

export function AccessControlProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuthStore();

    const accessControl = useMemo(() => {
        const isInterimManager = user?.platform_role === 'member' && user?.workflow_role === 'interim_manager';
        const isReadOnly = isInterimManager;

        return {
            isInterimManager,
            isReadOnly,
            canCreate: !isReadOnly,
            canEdit: !isReadOnly,
            canDelete: !isReadOnly,
        };
    }, [user]);

    return (
        <AccessControlContext.Provider value={accessControl}>
            {children}
        </AccessControlContext.Provider>
    );
}

export function useAccessControl() {
    const context = useContext(AccessControlContext);
    if (!context) {
        throw new Error('useAccessControl must be used within AccessControlProvider');
    }
    return context;
}
