"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

/* ─── DropdownMenu Context ─── */
interface DropdownMenuContextValue {
    open: boolean;
    setOpen: (open: boolean) => void;
    triggerRef: React.RefObject<HTMLButtonElement | null>;
}

const DropdownMenuContext = React.createContext<DropdownMenuContextValue | undefined>(undefined);

function useDropdownMenu() {
    const ctx = React.useContext(DropdownMenuContext);
    if (!ctx) throw new Error("DropdownMenu components must be used within <DropdownMenu>");
    return ctx;
}

/* ─── DropdownMenu Root ─── */
export function DropdownMenu({ children }: { children: React.ReactNode }) {
    const [open, setOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);

    return (
        <DropdownMenuContext.Provider value={{ open, setOpen, triggerRef }}>
            <div className="relative text-left">{children}</div>
        </DropdownMenuContext.Provider>
    );
}

/* ─── DropdownMenu Trigger ─── */
export const DropdownMenuTrigger = React.forwardRef<
    HTMLButtonElement,
    React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, children, ...props }, ref) => {
    const { open, setOpen, triggerRef } = useDropdownMenu();

    // Merge refs
    const mergedRef = useCallback(
        (node: HTMLButtonElement | null) => {
            (triggerRef as React.MutableRefObject<HTMLButtonElement | null>).current = node;
            if (typeof ref === "function") ref(node);
            else if (ref) (ref as React.MutableRefObject<HTMLButtonElement | null>).current = node;
        },
        [ref, triggerRef]
    );

    return (
        <button
            ref={mergedRef}
            type="button"
            className={className}
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-haspopup="true"
            {...props}
        >
            {children}
        </button>
    );
});
DropdownMenuTrigger.displayName = "DropdownMenuTrigger";

/* ─── DropdownMenu Content ─── */
export function DropdownMenuContent({
    className,
    children,
    align = "start",
    ...props
}: React.HTMLAttributes<HTMLDivElement> & {
    align?: "start" | "end" | "center";
}) {
    const { open, setOpen, triggerRef } = useDropdownMenu();
    const contentRef = useRef<HTMLDivElement>(null);
    const [side, setSide] = useState<"top" | "bottom">("bottom");
    const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
    const [currentAlign, setCurrentAlign] = useState(align);

    // Calculate position and handle collisions
    const updatePosition = useCallback(() => {
        if (!open || !triggerRef.current || !contentRef.current) return;

        const triggerRect = triggerRef.current.getBoundingClientRect();
        const contentRect = contentRef.current.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;

        // 1. Vertical Positioning (Top/Bottom)
        const spaceBelow = viewportHeight - triggerRect.bottom;
        const spaceAbove = triggerRect.top;
        let newSide: "top" | "bottom" = "bottom";

        if (spaceBelow < contentRect.height + 10 && spaceAbove > contentRect.height + 10) {
            newSide = "top";
        }

        // 2. Horizontal Positioning & Alignment Flip
        let newAlign = align;
        let left = 0;

        if (align === "start") {
            left = triggerRect.left;
            if (left + contentRect.width > viewportWidth - 10) newAlign = "end";
        }

        if (align === "end" || newAlign === "end") {
            left = triggerRect.right - contentRect.width;
            if (left < 10) newAlign = "start";
        }

        if (align === "center" || (newAlign !== "start" && newAlign !== "end")) {
            left = triggerRect.left + (triggerRect.width - contentRect.width) / 2;
            // Center containment
            if (left < 10) left = 10;
            if (left + contentRect.width > viewportWidth - 10) left = viewportWidth - contentRect.width - 10;
        }

        // Final left calculation based on refined alignment
        if (newAlign === "start") left = triggerRect.left;
        if (newAlign === "end") left = triggerRect.right - contentRect.width;

        const top = newSide === "bottom" ? triggerRect.bottom + 4 : triggerRect.top - contentRect.height - 4;

        setSide(newSide);
        setCurrentAlign(newAlign);
        setCoords({ top, left: Math.max(10, Math.min(left, viewportWidth - contentRect.width - 10)), width: contentRect.width });
    }, [open, triggerRef, align]);

    useEffect(() => {
        if (open) {
            // Initial position update
            // We use a small delay to ensure contentRef has dimensions after first render
            const timer = setTimeout(updatePosition, 0);
            return () => clearTimeout(timer);
        }
    }, [open, updatePosition]);

    // Close on scroll or resize (Portalled elements don't track naturally)
    useEffect(() => {
        if (!open) return;

        const handleEscape = () => setOpen(false);
        window.addEventListener("scroll", handleEscape, true);
        window.addEventListener("resize", handleEscape);

        return () => {
            window.removeEventListener("scroll", handleEscape, true);
            window.removeEventListener("resize", handleEscape);
        };
    }, [open, setOpen]);

    // Close on click outside
    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (
                contentRef.current &&
                !contentRef.current.contains(e.target as Node) &&
                triggerRef.current &&
                !triggerRef.current.contains(e.target as Node)
            ) {
                setOpen(false);
            }
        };
        const timeoutId = setTimeout(() => {
            document.addEventListener("mousedown", handler);
        }, 0);
        return () => {
            clearTimeout(timeoutId);
            document.removeEventListener("mousedown", handler);
        };
    }, [open, setOpen, triggerRef]);

    // Close on Escape
    useEffect(() => {
        if (!open) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [open, setOpen]);

    if (!open) return null;

    return createPortal(
        <div
            ref={contentRef}
            style={{
                position: "fixed",
                top: coords.top,
                left: coords.left,
                zIndex: 10000,
            }}
            className={cn(
                "min-w-32 rounded-xl border border-border bg-muted/10 backdrop-blur-md text-popover-foreground shadow-lg",
                className
            )}
            role="menu"
            {...props}
        >
            {/* Arrow */}
            <div className={cn(
                "absolute w-3 h-3 rotate-45 border-t border-l border-border bg-[#F8F8F8] z-51",
                side === "bottom" ? "-top-[7px]" : "-bottom-[7px]",
                currentAlign === "start" ? "left-6" : currentAlign === "end" ? "right-6" : "left-1/2 -translate-x-1/2"
            )} />

            <div className="relative z-104 bg-[#F8F8F8]/90 rounded-xl p-1">
                {children}
            </div>
        </div>,
        document.body
    );
}

/* ─── DropdownMenu Item ─── */
export function DropdownMenuItem({
    className,
    disabled,
    children,
    active,
    icon: Icon,
    ...props
}: React.HTMLAttributes<HTMLDivElement> & {
    disabled?: boolean;
    active?: boolean;
    icon?: React.ElementType;
}) {
    const { setOpen } = useDropdownMenu();

    return (
        <div
            className={cn(
                "relative flex cursor-pointer select-none items-center gap-3 rounded-md px-3 py-2 text-sm outline-none transition-all duration-200",
                "hover:bg-accent/80 hover:text-accent-foreground",
                "focus:bg-accent/80 focus:text-accent-foreground",
                active && "bg-muted/80 text-foreground font-semibold",
                disabled && "pointer-events-none opacity-50",
                className
            )}
            role="menuitem"
            {...props}
            onClick={(e) => {
                if (!disabled) setOpen(false);
                props.onClick?.(e);
            }}
        >
            {Icon && <Icon className={cn("h-[18px] w-[18px]", active ? "text-foreground" : "text-muted-foreground/80")} />}
            <span className="flex items-center">{children}</span>
            {active && (
                <div className="h-1.5 w-1.5 rounded-full bg-black animate-in fade-in zoom-in-50 duration-300" />
            )}
        </div>
    );
}

/* ─── DropdownMenu Separator ─── */
export function DropdownMenuSeparator({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn("-mx-1 my-1 h-px bg-border", className)}
            role="separator"
            {...props}
        />
    );
}
