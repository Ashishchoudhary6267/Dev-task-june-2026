"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
} from "./dropdown-menu";
import { Button } from "./button";

export interface UISelectOption {
    value: string;
    label: string;
    icon?: React.ElementType;
}

interface UISelectProps {
    value?: any;
    onValueChange: (value: string) => void;
    options: UISelectOption[];
    placeholder?: string;
    className?: string;
    triggerClassName?: string;
    contentClassName?: string;
    contentWidth?: string;
    disabled?: boolean;
    id?: string;
}

export function UISelect({
    value,
    onValueChange,
    options,
    placeholder = "Select an option",
    className,
    triggerClassName,
    contentClassName,
    contentWidth = "min-w-56",
    disabled = false,
    id,
}: UISelectProps) {
    const selectedOption = options.find((opt) => opt.value == value);
    const Icon = selectedOption?.icon;

    return (
        <div className={cn("relative", className)}>
            <DropdownMenu>
                <DropdownMenuTrigger
                    id={id}
                    disabled={disabled}
                    className={cn(
                        "flex items-center justify-between gap-3 px-4 py-2 text-sm font-medium transition-all duration-200 border border-border rounded-xl bg-background hover:bg-accent/10 active:scale-[0.98] w-full shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-muted/30 disabled:hover:bg-muted/30 disabled:active:scale-100",
                        triggerClassName
                    )}
                >
                    <div className="flex items-center gap-2.5 truncate">
                        {Icon && <Icon className="h-4.5 w-4.5 shrink-0 text-foreground hidden sm:block" />}
                        <span
                            className={cn(
                                "truncate",
                                !selectedOption && "text-muted-foreground"
                            )}
                        >
                            {selectedOption ? selectedOption.label : placeholder}
                        </span>
                    </div>
                    <ChevronDown className="h-4 w-4 shrink-0 opacity-40" />
                </DropdownMenuTrigger>
                <DropdownMenuContent
                    className={cn(contentWidth, "p-1.5 mt-2", contentClassName)}
                    align="start"
                >
                    {options.map((option) => (
                        <DropdownMenuItem
                            key={option.value}
                            active={value === option.value}
                            icon={option.icon}
                            onClick={() => onValueChange(option.value)}
                        >
                            {option.label}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
