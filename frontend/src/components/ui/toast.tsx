"use client";

import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
} from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

import { useToastStore, Toast, ToastVariant } from "@/lib/zustand/toast-store";

/* ─── Types ─── */
interface ToastContextValue {
    toasts: Toast[];
    addToast: (toast: Omit<Toast, "id">) => void;
    removeToast: (id: string) => void;
}

/* ─── Context ─── */
const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function useToast() {
    const { toasts, addToast, removeToast } = useToastStore();
    return { toasts, addToast, removeToast };
}

/* ─── Provider ─── */
export function ToastProvider({ children }: { children: React.ReactNode }) {
    const { toasts, addToast, removeToast } = useToastStore();

    return (
        <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
            {children}
        </ToastContext.Provider>
    );
}

/* ─── Variant Styles ─── */
const variantStyles: Record<ToastVariant, string> = {
    default: "bg-card text-card-foreground border-border",
    success: "bg-success text-success-foreground border-success",
    destructive: "bg-destructive text-destructive-foreground border-destructive",
    warning: "bg-warning text-warning-foreground border-warning",
};

/* ─── Toast Item ─── */
function ToastItem({
    toast,
    onDismiss,
}: {
    toast: Toast;
    onDismiss: (id: string) => void;
}) {
    const [isVisible, setIsVisible] = useState(false);
    const [isLeaving, setIsLeaving] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

    useEffect(() => {
        // Trigger entrance animation
        requestAnimationFrame(() => setIsVisible(true));

        const duration = toast.duration ?? 4000;
        timerRef.current = setTimeout(() => {
            setIsLeaving(true);
            setTimeout(() => onDismiss(toast.id), 300);
        }, duration);

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [toast.id, toast.duration, onDismiss]);

    const handleClose = () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        setIsLeaving(true);
        setTimeout(() => onDismiss(toast.id), 300);
    };

    return (
        <div
            className={cn(
                "pointer-events-auto relative flex w-full max-w-sm items-start gap-3 overflow-hidden rounded-lg border p-4 shadow-lg",
                "transition-all duration-300 ease-out",
                isVisible && !isLeaving
                    ? "translate-y-0 opacity-100"
                    : "translate-y-2 opacity-0",
                variantStyles[toast.variant ?? "default"]
            )}
            role="alert"
        >
            <div className="flex-1">
                {toast.title && (
                    <p className="text-sm font-semibold">{toast.title}</p>
                )}
                {toast.description && (
                    <p className={cn("text-sm", toast.title && "mt-1 opacity-90")}>
                        {toast.description}
                    </p>
                )}
            </div>
            <button
                onClick={handleClose}
                className="shrink-0 rounded-md p-0.5 opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring"
            >
                <X className="h-4 w-4" />
            </button>
        </div>
    );
}

/* ─── Toaster (Renderer) ─── */
export function Toaster() {
    const { toasts, removeToast } = useToast();

    return (
        <div className="fixed bottom-4 right-4 z-9999 flex flex-col-reverse gap-2 pointer-events-none">
            {toasts.map((toast) => (
                <ToastItem key={toast.id} toast={toast} onDismiss={removeToast} />
            ))}
        </div>
    );
}
