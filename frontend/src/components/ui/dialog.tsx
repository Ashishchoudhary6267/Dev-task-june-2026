"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

let _openDialogCount = 0;

/* ─── Dialog Context ─── */
interface DialogContextValue {
    open: boolean;
    setOpen: (open: boolean) => void;
}

const DialogContext = React.createContext<DialogContextValue | undefined>(
    undefined
);

function useDialog() {
    const ctx = React.useContext(DialogContext);
    if (!ctx) throw new Error("Dialog components must be used within <Dialog>");
    return ctx;
}

/* ─── Dialog Root ─── */
export function Dialog({
    children,
    open: controlledOpen,
    onOpenChange,
    defaultOpen = false,
}: {
    children: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    defaultOpen?: boolean;
}) {
    const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
    const isControlled = controlledOpen !== undefined;
    const open = isControlled ? controlledOpen : uncontrolledOpen;

    const setOpen = useCallback(
        (value: boolean) => {
            if (!isControlled) setUncontrolledOpen(value);
            onOpenChange?.(value);
        },
        [isControlled, onOpenChange]
    );

    return (
        <DialogContext.Provider value={{ open, setOpen }}>
            {children}
        </DialogContext.Provider>
    );
}

/* ─── Dialog Trigger ─── */
export function DialogTrigger({
    children,
    className,
    ...props
}: React.HTMLAttributes<HTMLElement>) {
    const { setOpen } = useDialog();

    // If child is a React element (e.g. <Button>), clone it with onClick to avoid nested <button>
    if (React.isValidElement(children)) {
        return React.cloneElement(
            children as React.ReactElement<Record<string, unknown>>,
            { onClick: () => setOpen(true) }
        );
    }

    return (
        <button
            type="button"
            className={className}
            onClick={() => setOpen(true)}
            {...props}
        >
            {children}
        </button>
    );
}

/* ─── Dialog Content ─── */
export function DialogContent({
    children,
    className,
    showCloseButton = true,
    ...props
}: React.HTMLAttributes<HTMLDivElement> & { showCloseButton?: boolean }) {
    const { open, setOpen } = useDialog();
    const contentRef = useRef<HTMLDivElement>(null);

    // Close on Escape
    useEffect(() => {
        if (!open) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [open, setOpen]);

    // Prevent body scroll — uses a reference counter so stacking multiple dialogs
    // doesn't cause one dialog's close to prematurely restore scrollability.
    useEffect(() => {
        if (!open) return;
        _openDialogCount++;
        if (_openDialogCount === 1) {
            document.body.style.overflow = "hidden";
            document.body.classList.add("modal-open");
        }
        return () => {
            _openDialogCount = Math.max(0, _openDialogCount - 1);
            if (_openDialogCount === 0) {
                document.body.style.overflow = "";
                document.body.classList.remove("modal-open");
            }
        };
    }, [open]);

    if (!open) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-[fade-in_200ms_ease-out]"
                onClick={() => setOpen(false)}
                aria-hidden="true"
            />

            {/* Content */}
            <div
                ref={contentRef}
                className={cn(
                    "relative z-50 w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl",
                    "animate-[scale-in_200ms_ease-out]",
                    className
                )}
                role="dialog"
                aria-modal="true"
                {...props}
            >
                {showCloseButton && (
                    <button
                        className="absolute right-4 top-4 rounded-sm p-1 text-muted-foreground opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring"
                        onClick={() => setOpen(false)}
                    >
                        <X className="h-4 w-4" />
                    </button>
                )}
                {children}
            </div>
        </div>,
        document.body
    );
}

/* ─── Dialog Header ─── */
export function DialogHeader({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)}
            {...props}
        />
    );
}

/* ─── Dialog Title ─── */
export function DialogTitle({
    className,
    ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
    return (
        <h2
            className={cn("text-lg font-semibold leading-none tracking-tight text-card-foreground", className)}
            {...props}
        />
    );
}

/* ─── Dialog Description ─── */
export function DialogDescription({
    className,
    ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
    return (
        <p
            className={cn("text-sm text-muted-foreground", className)}
            {...props}
        />
    );
}

/* ─── Dialog Footer ─── */
export function DialogFooter({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn(
                "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
                className
            )}
            {...props}
        />
    );
}

/* ─── Dialog Close ─── */
export function DialogClose({
    children,
    className,
    ...props
}: React.HTMLAttributes<HTMLElement>) {
    const { setOpen } = useDialog();

    // If child is a React element (e.g. <Button>), clone it with onClick to avoid nested <button>
    if (React.isValidElement(children)) {
        return React.cloneElement(
            children as React.ReactElement<Record<string, unknown>>,
            {
                onClick: (e: React.MouseEvent) => {
                    // Call original onClick if present
                    const original = (children as React.ReactElement<Record<string, unknown>>).props
                        ?.onClick as ((e: React.MouseEvent) => void) | undefined;
                    original?.(e);
                    setOpen(false);
                },
            }
        );
    }

    return (
        <button
            type="button"
            className={className}
            onClick={() => setOpen(false)}
            {...props}
        >
            {children}
        </button>
    );
}
