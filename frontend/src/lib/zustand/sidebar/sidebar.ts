'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SidebarState {
    isCollapsed: boolean;
    isMobileOpen: boolean;
    toggleSidebar: () => void;
    toggleMobileSidebar: () => void;
    setCollapsed: (collapsed: boolean) => void;
    setMobileOpen: (open: boolean) => void;
}

export const useSidebarStore = create<SidebarState>()(
    persist(
        (set) => ({
            isCollapsed: false,
            isMobileOpen: false,
            toggleSidebar: () => set((state) => ({ isCollapsed: !state.isCollapsed })),
            toggleMobileSidebar: () => set((state) => ({ isMobileOpen: !state.isMobileOpen })),
            setCollapsed: (collapsed: boolean) => set({ isCollapsed: collapsed }),
            setMobileOpen: (open: boolean) => set({ isMobileOpen: open }),
        }),
        {
            name: 'sidebar-storage',
            // Only persist isCollapsed, skip mobile open state
            partialize: (state) => ({ isCollapsed: state.isCollapsed }),
        }
    )
);
