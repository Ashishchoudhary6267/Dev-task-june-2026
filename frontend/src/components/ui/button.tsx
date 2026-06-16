import React from "react";
import { cn } from "@/lib/utils";
import { Spinner } from "./spinner";

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?:
    | "default"
    | "destructive"
    | "outline"
    | "secondary"
    | "ghost"
    | "link";
    size?: "default" | "sm" | "lg" | "icon";
    loading?: boolean;
}

const variantStyles: Record<NonNullable<ButtonProps["variant"]>, string> = {
    default:
        "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
    destructive:
        "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
    outline:
        "border border-border bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground",
    secondary:
        "bg-secondary text-secondary-foreground hover:bg-secondary/80",
    ghost:
        "hover:bg-accent hover:text-accent-foreground",
    link:
        "text-primary underline-offset-4 hover:underline",
};

const sizeStyles: Record<NonNullable<ButtonProps["size"]>, string> = {
    default: "h-10 px-5 text-sm",
    sm: "h-8 px-3 text-xs rounded-md",
    lg: "h-12 px-8 text-base rounded-lg",
    icon: "h-10 w-10 p-0",
};

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    (
        {
            className,
            variant = "default",
            size = "default",
            loading = false,
            disabled,
            children,
            ...props
        },
        ref
    ) => {
        const isDisabled = disabled || loading;

        return (
            <button
                ref={ref}
                disabled={isDisabled}
                aria-busy={loading}
                className={cn(
                    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
                    "rounded-lg font-medium transition-all duration-200",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    "disabled:pointer-events-none disabled:opacity-50",
                    "active:scale-95",
                    variantStyles[variant],
                    sizeStyles[size],
                    className
                )}
                {...props}
            >
                {loading && (
                    <Spinner size="sm" className="animate-spin" />
                )}
                {children}
            </button>
        );
    }
);

Button.displayName = "Button";

export { Button };
