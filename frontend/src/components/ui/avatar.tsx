"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";

/* ─── Avatar Root ─── */
export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
    size?: "sm" | "default" | "lg";
}

const sizeStyles: Record<NonNullable<AvatarProps["size"]>, string> = {
    sm: "h-8 w-8 text-xs",
    default: "h-10 w-10 text-sm",
    lg: "h-14 w-14 text-base",
};

const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
    ({ className, size = "default", ...props }, ref) => (
        <div
            ref={ref}
            className={cn(
                "relative flex shrink-0 overflow-hidden rounded-full",
                sizeStyles[size],
                className
            )}
            {...props}
        />
    )
);
Avatar.displayName = "Avatar";

/* ─── Avatar Image ─── */
export interface AvatarImageProps
    extends React.ImgHTMLAttributes<HTMLImageElement> { }

const AvatarImage = React.forwardRef<HTMLImageElement, AvatarImageProps>(
    ({ className, onError, ...props }, ref) => {
        const [hasError, setHasError] = useState(false);

        if (hasError) return null;

        return (
            <img
                ref={ref}
                className={cn("aspect-square h-full w-full object-cover", className)}
                onError={(e) => {
                    setHasError(true);
                    onError?.(e);
                }}
                {...props}
            />
        );
    }
);
AvatarImage.displayName = "AvatarImage";

/* ─── Avatar Fallback ─── */
const AvatarFallback = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn(
            "flex h-full w-full items-center justify-center rounded-full bg-muted font-medium text-muted-foreground",
            className
        )}
        {...props}
    />
));
AvatarFallback.displayName = "AvatarFallback";

export { Avatar, AvatarImage, AvatarFallback };
