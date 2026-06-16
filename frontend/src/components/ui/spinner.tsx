import React from "react";
import { cn } from "@/lib/utils";

export interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
    size?: "sm" | "default" | "lg";
}

const sizeStyles: Record<NonNullable<SpinnerProps["size"]>, string> = {
    sm: "h-4 w-4 border-2",
    default: "h-6 w-6 border-2",
    lg: "h-8 w-8 border-[3px]",
};

const Spinner = React.forwardRef<HTMLDivElement, SpinnerProps>(
    ({ className, size = "default", ...props }, ref) => {
        return (
            <div
                ref={ref}
                className={cn(
                    "animate-spin rounded-full border-current border-t-transparent opacity-70",
                    sizeStyles[size],
                    className
                )}
                role="status"
                aria-label="Loading"
                {...props}
            >
                <span className="sr-only">Loading...</span>
            </div>
        );
    }
);

Spinner.displayName = "Spinner";

export { Spinner };
