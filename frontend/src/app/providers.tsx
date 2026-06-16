"use client";

import { useEffect } from "react";
import { ToastProvider, Toaster } from "@/components/ui/toast";
import { useAuthStore } from "@/lib/zustand/user/user";

export function Providers({ children }: { children: React.ReactNode }) {
    // Fetch fresh permissions on app mount if the user is authenticated
    useEffect(() => {
        const store = useAuthStore.getState();
        if (store.isAuthenticated) {
            store.fetchPermissions();
        }
    }, []);

    return (
        <ToastProvider>
            {children}
            <Toaster />
        </ToastProvider>
    );
}
