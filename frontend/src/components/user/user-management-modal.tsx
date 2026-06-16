'use client';

import React, { useEffect, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useUserStore } from '@/lib/zustand/user/addUser';
import { AddUserModal } from './add-user-modal';
import { Plus, Search, User as UserIcon } from 'lucide-react';
import { Input, Avatar, AvatarFallback, Badge } from '@/components/ui';

interface UserManagementModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function UserManagementModal({ open, onOpenChange }: UserManagementModalProps) {
    const { users, fetchUsers, loading, usercount, userpage, usertotalpages } = useUserStore();
    const [isAddUserOpen, setIsAddUserOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(1);
    const limit = 10;
    console.log("users", users);


    useEffect(() => {
        if (!open) return;
        const timer = setTimeout(() => {
            fetchUsers({ page, limit, search: searchQuery || undefined });
        }, 300);
        return () => clearTimeout(timer);
    }, [open, page, searchQuery]);

    useEffect(() => {
        setPage(1);
    }, [searchQuery]);

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-[800px] h-[80vh] flex flex-col p-0 gap-0">
                    <DialogHeader className="px-6 py-4 border-b border-border">
                        <div className="flex items-center justify-between">
                            <div>
                                <DialogTitle className="text-xl">User Management</DialogTitle>
                                <DialogDescription className="mt-1">
                                    Manage users and their permissions.
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-border bg-muted/20">
                        <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder="Search users by name or email..."
                                className="pl-9 bg-background"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className="flex flex-row items-center gap-2 whitespace-nowrap shrink-0">
                            <Button onClick={() => setIsAddUserOpen(true)} size="sm">
                                <Plus className="h-4 w-4" /> Add User
                            </Button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6">
                        {loading && users.length === 0 ? (
                            <div className="flex items-center justify-center py-10 text-muted-foreground">
                                Loading users...
                            </div>
                        ) : users?.length > 0 ? (
                            <div className="grid grid-cols-1 gap-4">
                                {users?.map((user) => (
                                    <div
                                        key={user.id || Math.random()} // Fallback key
                                        className="flex items-center justify-between p-4 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors"
                                    >
                                        <div className="flex items-center gap-4">
                                            <Avatar>
                                                <AvatarFallback className="bg-primary/10 text-primary">
                                                    {user.name?.slice(0, 2).toUpperCase() || 'U'}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <div className="font-medium text-foreground">
                                                    {user?.name || 'Unknown Name'}
                                                </div>
                                                <div className="text-sm text-muted-foreground">
                                                    {user?.email || 'No Email'}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <Badge variant="outline" className="capitalize">
                                                {user?.platform_role || 'Member'}
                                            </Badge>
                                            {/* Future actions like Edit/Delete could go here */}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                                <UserIcon className="h-12 w-12 mb-4 opacity-20" />
                                <p>No users found matching your search.</p>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-between p-4 border-t border-border bg-muted/20">
                        <div className="text-sm text-muted-foreground">
                            Showing page {userpage || 1} of {usertotalpages || 1} ({usercount} total users)
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={(userpage || 1) <= 1 || loading}
                            >
                                Prev
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(p => Math.min(usertotalpages || 1, p + 1))}
                                disabled={(userpage || 1) >= (usertotalpages || 1) || loading}
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <AddUserModal open={isAddUserOpen} onOpenChange={setIsAddUserOpen} />
        </>
    );
}
