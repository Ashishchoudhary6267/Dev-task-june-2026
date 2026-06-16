"use client";

import React, { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/* ─── Tooltip Context ─── */
interface TooltipContextValue {
    open: boolean;
    setOpen: (open: boolean) => void;
    triggerRef: React.RefObject<HTMLElement | null>;
    delay: number;
}

const TooltipContext = React.createContext<TooltipContextValue | undefined>(
    undefined
);

function useTooltip() {
    const ctx = React.useContext(TooltipContext);
    if (!ctx) throw new Error("Tooltip components must be used within <Tooltip>");
    return ctx;
}

/* ─── Tooltip Root ─── */
export function Tooltip({
    children,
    delay = 300,
    className,
}: {
    children: React.ReactNode;
    delay?: number;
    className?: string;
}) {
    const [open, setOpen] = useState(false);
    const triggerRef = useRef<HTMLElement>(null);

    return (
        <TooltipContext.Provider value={{ open, setOpen, triggerRef, delay }}>
            <div className={cn("relative inline-flex", className)}>{children}</div>
        </TooltipContext.Provider>
    );
}

/* ─── Tooltip Trigger ─── */
export function TooltipTrigger({
    children,
    className,
    asChild,
    ...props
}: React.HTMLAttributes<HTMLElement> & { asChild?: boolean }) {
    const { setOpen, triggerRef, delay } = useTooltip();
    const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

    const handleMouseEnter = useCallback(() => {
        timerRef.current = setTimeout(() => setOpen(true), delay);
    }, [delay, setOpen]);

    const handleMouseLeave = useCallback(() => {
        if (timerRef.current) clearTimeout(timerRef.current);
        setOpen(false);
    }, [setOpen]);

    const handleFocus = useCallback(() => {
        timerRef.current = setTimeout(() => setOpen(true), delay);
    }, [delay, setOpen]);

    const handleBlur = useCallback(() => {
        if (timerRef.current) clearTimeout(timerRef.current);
        setOpen(false);
    }, [setOpen]);

    const eventHandlers = {
        onMouseEnter: handleMouseEnter,
        onMouseLeave: handleMouseLeave,
        onFocus: handleFocus,
        onBlur: handleBlur,
    };

    if (asChild && React.isValidElement(children)) {
        return React.cloneElement(
            children as React.ReactElement<Record<string, unknown>>,
            {
                ref: triggerRef,
                ...eventHandlers,
            }
        );
    }

    return (
        <span
            ref={triggerRef as React.RefObject<HTMLSpanElement>}
            className={className}
            tabIndex={0}
            {...eventHandlers}
            {...props}
        >
            {children}
        </span>
    );
}

/* ─── Tooltip Content ─── */
export function TooltipContent({
    children,
    className,
    side = "top",
    ...props
}: React.HTMLAttributes<HTMLDivElement> & {
    side?: "top" | "bottom" | "left" | "right";
}) {
    const { open } = useTooltip();

    if (!open) return null;

    const sidePositions = {
        top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
        bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
        left: "right-full top-1/2 -translate-y-1/2 mr-2",
        right: "left-full top-1/2 -translate-y-1/2 ml-2",
    };

    return (
        <div
            className={cn(
                "absolute z-[10001] overflow-hidden rounded-md border border-border bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-md",
                "animate-[fade-in_150ms_ease-out]",
                "w-max max-w-[200px] text-wrap",
                sidePositions[side],
                className
            )}
            role="tooltip"
            {...props}
        >
            {children}
        </div>
    );
}
