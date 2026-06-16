import React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
    variant?:
    | "default"
    | "secondary"
    | "destructive"
    | "outline"
    | "success"
    | "warning";
}

const variantStyles: Record<NonNullable<BadgeProps["variant"]>, string> = {
    default: "bg-zinc-900 text-white border-transparent",
    secondary: "bg-secondary text-secondary-foreground border-transparent",
    destructive:
        "bg-destructive text-destructive-foreground border-transparent",
    outline: "bg-transparent text-foreground border-border",
    success: "bg-green-500 text-success-foreground border-transparent",
    warning: "bg-warning text-warning-foreground border-transparent",
};

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
    ({ className, variant = "default", ...props }, ref) => {
        return (
            <span
                className={cn(
                    "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
                    "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                    variantStyles[variant],
                    className
                )}
                ref={ref}
                {...props}
            />
        );
    }
);

Badge.displayName = "Badge";

export { Badge };
