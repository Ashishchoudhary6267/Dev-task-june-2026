'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Check, ChevronsUpDown, Loader2, Search, User as UserIcon, XCircle, ChevronDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import { useClientStore } from '@/lib/zustand/clients/client';

// Adjust debounce timing if you like
const DEBOUNCE_MS = 300;

interface ClientSelectProps {
    value: string;
    onChange: (value: string) => void;
    roles?: string[]; // Optional: restrict users to certain roles (e.g. ['copywriter', 'reviewer'])
    excludeIds?: string[]; // Optional: user IDs to hide from the list (e.g. the task's assigned user)
    placeholder?: string;
    className?: string;
    disabled?: boolean;
    initialSelectedUser?: { id: string, name: string } | null;
}

export function ClientSelect({
    value,
    onChange,
    roles,
    excludeIds = [],
    placeholder = "Select client...",
    className,
    disabled,
    initialSelectedUser
}: ClientSelectProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");

    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const [baselineUsers, setBaselineUsers] = useState<any[]>([]);
    const { fetchClients } = useClientStore();

    // Provide a way to resolve the selected user's name if they are selected
    // and aren't in the current search results hook. We can fetch them individually
    // or just rely on the parent component mapping. For simplicity, we'll keep
    // the currently selected user object if we find it.
    const [selectedUserObj, setSelectedUserObj] = useState<any | null>(null);

    // Initial setup for selected user
    useEffect(() => {
        if (value && !selectedUserObj && initialSelectedUser && initialSelectedUser.id === value) {
            setSelectedUserObj(initialSelectedUser);
        }
    }, [value, initialSelectedUser, selectedUserObj]);

    // 1. Handle Debounce
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search);
        }, DEBOUNCE_MS);

        return () => clearTimeout(timer);
    }, [search]);

    // 2. Fetch Users on open or when debouncedSearch changes
    useEffect(() => {
        if (!open) return; // Only fetch when popover is open

        // OPTIMIZATION: If search is empty and we already have baseline users, 
        // just instantly show them instead of fetching again.
        if (debouncedSearch === '' && baselineUsers.length > 0) {
            setUsers(baselineUsers);
            return;
        }

        let isMounted = true;

        const loadUsers = async () => {
            setLoading(true);
            try {
                // Determine query params
                const params: any = {
                    limit: 10,
                    search: debouncedSearch || undefined,
                };

                if (roles && roles.length > 0) {
                    params.type = roles[0]; // Map the first role if any to `type` (e.g., 'CLIENT' or 'SERVICE') or keep as roles. We will pass it as roles for backend safety.
                    params.roles = roles.join(',');
                }

                const response = await api.get('/fetchClients', { params });

                if (isMounted) {
                    const fetched = response.data?.data || (Array.isArray(response.data) ? response.data : []);
                    setUsers(fetched);
                    // Cache the initial empty-search request
                    if (debouncedSearch === '') {
                        setBaselineUsers(fetched);
                    }
                }
            } catch (err) {
                console.error("Failed to fetch clients for combobox", err);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        loadUsers();

        return () => { isMounted = false; };
    }, [open, debouncedSearch, roles, baselineUsers]);

    // 3. Keep the selected user object updated so we can display their name
    useEffect(() => {
        if (!value) {
            setSelectedUserObj(null);
            return;
        }

        // If the user we have is already the selected one, don't overwrite it
        if (selectedUserObj?.id === value) return;

        // Try to find the user in the current fetched list
        const found = users.find(u => u.id === value);
        if (found) {
            setSelectedUserObj(found);
        }
        // If not found in current list, it's fine, we might just show ID or leave it. 
        // In a real perfect world, passing `initialUser` prop is best for initial load, 
        // but often if `value` changes in a standard form, it changes from our interaction.
    }, [value, users, selectedUserObj]);

    const selectedDisplayName = useMemo(() => {
        if (!value) return placeholder;
        // if in future we want to show role, uncomment the below line
        // if (selectedUserObj) return `${selectedUserObj.name} (${selectedUserObj.workflow_role || selectedUserObj.platform_role})`;
        if (selectedUserObj) return `${selectedUserObj.name}`;

        return "Loading Client..."; // Fallback if we have an ID but no object yet
    }, [value, selectedUserObj, placeholder, initialSelectedUser]);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    role="combobox"
                    aria-expanded={open}
                    disabled={disabled}
                    className={cn(
                        "flex items-center justify-between gap-3 px-4 py-2 text-sm font-medium transition-all duration-200 border border-border rounded-xl bg-background hover:bg-accent/10 active:scale-[0.98] w-full shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-muted/30 disabled:hover:bg-muted/30 disabled:active:scale-100",
                        !value && "text-muted-foreground",
                        className
                    )}
                >
                    <div className="flex items-center gap-2.5 truncate">
                        <span className="truncate">
                            {selectedDisplayName}
                        </span>
                    </div>
                    <ChevronDown className="h-4 w-4 shrink-0 opacity-40" />
                </button>
            </PopoverTrigger>
            <PopoverContent className="p-0 z-99999" align="start">
                <Command>
                    {/* The CommandInput handles local state vs native input perfectly. 
                        We intercept the change to update our debounced state */}
                    <div className="flex items-center px-3 pb-2 pt-3 border-b border-border">
                        <UserIcon className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                        <input
                            placeholder="Type a name or email..."
                            className="flex h-8 w-full rounded-md bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 border-0"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    <CommandList>
                        {loading && (
                            <div className="flex items-center justify-center p-4 text-sm text-muted-foreground gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>Searching...</span>
                            </div>
                        )}
                        {!loading && users.length === 0 && (
                            <CommandEmpty className="py-4 text-center text-sm text-muted-foreground">
                                No clients found.
                            </CommandEmpty>
                        )}
                        <CommandGroup>
                            {!loading && users.filter(u => !excludeIds.includes(u.id)).map((user) => (
                                <CommandItem
                                    key={user.id}
                                    value={user.name} // This is just for Shadcn's internal strict matching which we bypassed with our own input
                                    onSelect={() => {
                                        onChange(user.id);
                                        setSelectedUserObj(user);
                                        setOpen(false);
                                    }}
                                    className="gap-2 cursor-pointer text-xs"
                                >
                                    <Check
                                        className={cn(
                                            "h-3.5 w-3.5 shrink-0",
                                            value === user.id ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    <div className="flex flex-col">
                                        <span className="font-medium">{user.name}</span>
                                        {/* {(user.workflow_role === 'interim_manager' || user.workflow_role === 'reviewer') && <span className="text-[10px] text-muted-foreground">{user.workflow_role}</span>} */}
                                        {/* <span className="text-[10px] text-muted-foreground">{user.workflow_role || user.platform_role}</span> */}
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

