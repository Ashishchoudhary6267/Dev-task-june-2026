"use client";

import { create } from "zustand";

export type ToastVariant = "default" | "success" | "destructive" | "warning";

export interface Toast {
    id: string;
    title?: string;
    description?: string;
    variant?: ToastVariant;
    duration?: number;
}

interface ToastState {
    toasts: Toast[];
    addToast: (toast: Omit<Toast, "id">) => void;
    removeToast: (id: string) => void;

    // Convenience methods
    success: (title: string, description?: string) => void;
    error: (title: string, description?: string) => void;
    warning: (title: string, description?: string) => void;
    info: (title: string, description?: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
    toasts: [],
    addToast: (toast) => {
        const id = Math.random().toString(36).substring(2, 9);
        set((state) => ({
            toasts: [...state.toasts, { ...toast, id }],
        }));
    },
    removeToast: (id) => {
        set((state) => ({
            toasts: state.toasts.filter((t) => t.id !== id),
        }));
    },

    success: (title, description) => {
        const id = Math.random().toString(36).substring(2, 9);
        set((state) => ({
            toasts: [...state.toasts, { id, title, description, variant: "success" }],
        }));
    },
    error: (title, description) => {
        const id = Math.random().toString(36).substring(2, 9);
        set((state) => ({
            toasts: [...state.toasts, { id, title, description, variant: "destructive" }],
        }));
    },
    warning: (title, description) => {
        const id = Math.random().toString(36).substring(2, 9);
        set((state) => ({
            toasts: [...state.toasts, { id, title, description, variant: "warning" }],
        }));
    },
    info: (title, description) => {
        const id = Math.random().toString(36).substring(2, 9);
        set((state) => ({
            toasts: [...state.toasts, { id, title, description, variant: "default" }],
        }));
    },
}));

// Export a plain object for use outside of React components
export const toast = {
    success: (title: string, description?: string) => useToastStore.getState().success(title, description),
    error: (title: string, description?: string) => useToastStore.getState().error(title, description),
    warning: (title: string, description?: string) => useToastStore.getState().warning(title, description),
    info: (title: string, description?: string) => useToastStore.getState().info(title, description),
    add: (toast: Omit<Toast, "id">) => useToastStore.getState().addToast(toast),
};
