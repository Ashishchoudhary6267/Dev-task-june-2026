'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Check, ChevronsUpDown, Loader2, Search, User as UserIcon, XCircle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import api from '@/lib/api';

// Adjust debounce timing if you like
const DEBOUNCE_MS = 300;

interface UserSelectProps {
    value: string;
    onChange: (value: string) => void;
    roles?: string[]; // Optional: restrict users to certain roles (e.g. ['copywriter', 'reviewer'])
    excludeIds?: string[]; // Optional: user IDs to hide from the list (e.g. the task's assigned user)
    placeholder?: string;
    className?: string;
    disabled?: boolean;
    initialSelectedUser?: { id: string, name: string } | null;
}

export function UserSelect({
    value,
    onChange,
    roles,
    excludeIds = [],
    placeholder = "Select user...",
    className,
    disabled,
    initialSelectedUser
}: UserSelectProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");

    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const [baselineUsers, setBaselineUsers] = useState<any[]>([]);

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
                    params.roles = roles.join(',');
                }

                const res = await api.get('/fetchallusers', { params });

                if (isMounted) {
                    const fetched = res.data.data || [];
                    setUsers(fetched);
                    // Cache the initial empty-search request
                    if (debouncedSearch === '') {
                        setBaselineUsers(fetched);
                    }
                }
            } catch (err) {
                console.error("Failed to fetch users for combobox", err);
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

        return "Loading User..."; // Fallback if we have an ID but no object yet
    }, [value, selectedUserObj, placeholder, initialSelectedUser]);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    disabled={disabled}
                    className={cn(
                        "w-full justify-between h-8 text-xs font-normal",
                        !value && "text-muted-foreground",
                        className
                    )}
                >
                    <span className="truncate">
                        {selectedDisplayName}
                    </span>
                    <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0 z-9999" align="start">
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
                                No users found.
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

// ─── MultiUserSelect ──────────────────────────────────────────────────────────
// A multi-select variant that works with a pre-loaded users array (no API fetch).
// Usage:
//   <MultiUserSelect
//       users={[...]}          // full array to pick from
//       selectedUsers={[id1]}  // array of selected IDs
//       onSelect={(user) => …} // called when a user is added
//       onRemove={(user) => …} // called when a user chip is removed
//   />

interface MultiUserSelectProps {
    users: any[];
    selectedUsers: string[];
    onSelect: (user: any) => void;
    onRemove: (user: any) => void;
    placeholder?: string;
}

export function MultiUserSelect({
    users,
    selectedUsers,
    onSelect,
    onRemove,
    placeholder = 'Search members…',
}: MultiUserSelectProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');

    const selectedObjects = useMemo(
        () => users.filter(u => selectedUsers.includes(u.id)),
        [users, selectedUsers]
    );

    const unselected = useMemo(() => {
        const q = search.toLowerCase();
        return users.filter(
            u =>
                !selectedUsers.includes(u.id) &&
                (u.name?.toLowerCase().includes(q) ||
                    u.email?.toLowerCase().includes(q) ||
                    u.workflow_role?.toLowerCase().includes(q))
        );
    }, [users, selectedUsers, search]);

    const handleSelectAll = () => {
        unselected.forEach(u => onSelect(u));
    };

    const handleDeselectAll = () => {
        selectedObjects.forEach(u => onRemove(u));
    };

    return (
        <div className="space-y-3">
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        className="w-full justify-between h-10 text-sm font-normal bg-background"
                    >
                        <div className="flex items-center gap-2 truncate">
                            <UserIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                            {selectedUsers.length === 0 ? (
                                <span className="text-muted-foreground">Select recipients...</span>
                            ) : (
                                <span className="font-medium text-foreground">
                                    {selectedUsers.length} recipient{selectedUsers.length !== 1 ? 's' : ''} selected
                                </span>
                            )}
                        </div>
                        <ChevronsUpDown className="h-4 w-4 text-muted-foreground shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[300px] sm:w-[350px]" align="start">
                    <div className="flex flex-col">
                        {/* Search */}
                        <div className="flex items-center px-3 py-2 border-b border-border">
                            <Search className="h-4 w-4 text-muted-foreground shrink-0 mr-2" />
                            <input
                                type="text"
                                placeholder={placeholder}
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="flex-1 bg-transparent border-none outline-none text-sm py-1 placeholder:text-muted-foreground"
                                autoFocus
                            />
                        </div>

                        {/* Bulk actions */}
                        <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-b border-border text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            <span>Members ({users.length})</span>
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={handleSelectAll}
                                    className="text-primary hover:underline"
                                    disabled={unselected.length === 0}
                                >
                                    Select All
                                </button>
                                <button
                                    type="button"
                                    onClick={handleDeselectAll}
                                    className="text-primary hover:underline"
                                    disabled={selectedUsers.length === 0}
                                >
                                    Deselect All
                                </button>
                            </div>
                        </div>

                        {/* List */}
                        <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                            {users.length === 0 ? (
                                <div className="p-8 text-center">
                                    <UserIcon className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                                    <p className="text-xs text-muted-foreground italic">No members available.</p>
                                </div>
                            ) : unselected.length === 0 && search ? (
                                <div className="p-8 text-center">
                                    <Search className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                                    <p className="text-xs text-muted-foreground italic">No members match your search.</p>
                                </div>
                            ) : (
                                <div className="py-1">
                                    {/* Already Selected (shown with check) */}
                                    {selectedObjects.length > 0 && !search && (
                                        <div className="border-b border-border/40 pb-1 mb-1">
                                            {selectedObjects.map(u => (
                                                <button
                                                    key={u.id}
                                                    type="button"
                                                    onClick={() => onRemove(u)}
                                                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/50 transition-colors text-left group"
                                                >
                                                    <div className="flex items-center gap-2.5 min-w-0">
                                                        <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0 border border-primary/20 group-hover:bg-primary group-hover:text-white transition-colors">
                                                            {u.name?.slice(0, 2).toUpperCase()}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-xs font-semibold text-foreground truncate">{u.name}</p>
                                                            <p className="text-[10px] text-muted-foreground capitalize truncate">{u.workflow_role || u.platform_role}</p>
                                                        </div>
                                                    </div>
                                                    <Check className="h-4 w-4 text-primary shrink-0" />
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {/* Available to select */}
                                    {unselected.map(u => (
                                        <button
                                            key={u.id}
                                            type="button"
                                            onClick={() => onSelect(u)}
                                            className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-muted/50 transition-colors text-left group"
                                        >
                                            <div className="h-7 w-7 rounded-lg bg-muted text-muted-foreground flex items-center justify-center text-[10px] font-bold shrink-0 border border-border group-hover:bg-primary/10 group-hover:text-primary group-hover:border-primary/20 transition-colors">
                                                {u.name?.slice(0, 2).toUpperCase()}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-xs font-medium text-foreground truncate">{u.name}</p>
                                                <p className="text-[10px] text-muted-foreground capitalize truncate">{u.workflow_role || u.platform_role}</p>
                                            </div>
                                        </button>
                                    ))}

                                    {unselected.length === 0 && !search && selectedUsers.length > 0 && (
                                        <div className="px-3 py-4 text-center">
                                            <span className="text-[10px] text-muted-foreground italic">All members selected</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </PopoverContent>
            </Popover>

            {/* ── Quick Chips ── */}
            {selectedObjects.length > 0 && (
                <div className="flex flex-wrap gap-1.5 max-h-[100px] overflow-y-auto p-1 custom-scrollbar">
                    {selectedObjects.map(u => (
                        <div
                            key={u.id}
                            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-semibold bg-primary/5 text-primary border border-primary/10 animate-in fade-in zoom-in duration-200"
                        >
                            <span className="truncate max-w-[120px]">{u.name}</span>
                            <button
                                type="button"
                                onClick={() => onRemove(u)}
                                className="group/btn h-3.5 w-3.5 flex items-center justify-center rounded-full hover:bg-primary/10 transition-colors"
                            >
                                <XCircle className="h-3 w-3 text-primary/60 group-hover/btn:text-primary" />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

