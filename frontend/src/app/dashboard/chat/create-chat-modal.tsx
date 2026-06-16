'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserSelect } from '@/components/ui/user-select';
import { useUserStore } from '@/lib/zustand/user/addUser';
import { useChatStore } from '@/lib/zustand/chat/chat';
import { Check, Search, User as UserIcon, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CreateChatModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function CreateChatModal({ open, onOpenChange }: CreateChatModalProps) {
    const [type, setType] = useState<'direct' | 'group'>('direct');
    const [groupName, setGroupName] = useState('');
    const [selectedUserId, setSelectedUserId] = useState(''); // For Direct
    const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]); // For Group
    const [searchQuery, setSearchQuery] = useState('');
    
    const { users, loading, fetchUsers } = useUserStore();
    const { createChannel, createDirectChannel, setActiveChannel } = useChatStore();
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (open && type === 'group') {
            fetchUsers({ limit: 100 });
        }
    }, [open, type]);

    const handleCreate = async () => {
        setIsSubmitting(true);
        let channelId: string | null = null;

        if (type === 'direct') {
            if (!selectedUserId) return;
            channelId = await createDirectChannel(selectedUserId);
        } else {
            if (!groupName.trim() || selectedMemberIds.length === 0) return;
            channelId = await createChannel(groupName, selectedMemberIds);
        }

        if (channelId) {
            setActiveChannel(channelId);
            onOpenChange(false);
            // Reset
            setGroupName('');
            setSelectedUserId('');
            setSelectedMemberIds([]);
        }
        setIsSubmitting(false);
    };

    const toggleMember = (userId: string) => {
        setSelectedMemberIds(prev => 
            prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
        );
    };

    const filteredUsers = users.filter(u => 
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        u.email?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px] p-0 overflow-hidden border-none shadow-2xl bg-background">
                <DialogHeader className="p-6 bg-slate-50 border-b border-border">
                    <DialogTitle className="text-xl font-bold">New Conversation</DialogTitle>
                </DialogHeader>

                <div className="p-0">
                    {/* Tabs */}
                    <div className="flex border-b border-border bg-slate-50/50">
                        <button
                            onClick={() => setType('direct')}
                            className={cn(
                                "flex-1 py-3 text-sm font-medium transition-colors relative",
                                type === 'direct' ? "text-primary" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            Direct Message
                            {type === 'direct' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
                        </button>
                        <button
                            onClick={() => setType('group')}
                            className={cn(
                                "flex-1 py-3 text-sm font-medium transition-colors relative",
                                type === 'group' ? "text-primary" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            Group Chat
                            {type === 'group' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
                        </button>
                    </div>

                    <div className="p-6 space-y-4 max-h-[400px] overflow-y-auto">
                        {type === 'direct' ? (
                            <div className="space-y-4">
                                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Select User</Label>
                                <UserSelect 
                                    value={selectedUserId} 
                                    onChange={setSelectedUserId} 
                                    placeholder="Search by name or email..."
                                    className="h-10 text-sm"
                                />
                                <p className="text-xs text-muted-foreground italic">
                                    Start a private 1-on-1 conversation with a teammate.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Group Name</Label>
                                    <Input 
                                        placeholder="e.g. Project Alpha Team" 
                                        value={groupName} 
                                        onChange={(e) => setGroupName(e.target.value)}
                                        className="h-10"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Add Members ({selectedMemberIds.length})</Label>
                                    <div className="relative mb-2">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input 
                                            placeholder="Find teammates..." 
                                            className="pl-9 h-9 text-sm"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                        />
                                    </div>
                                    <div className="grid gap-1 mt-2">
                                        {loading ? (
                                            <div className="flex items-center justify-center p-4">
                                                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                            </div>
                                        ) : filteredUsers.length === 0 ? (
                                            <p className="text-center py-4 text-sm text-muted-foreground">No users found.</p>
                                        ) : (
                                            filteredUsers.map(user => (
                                                <div 
                                                    key={user.id} 
                                                    onClick={() => toggleMember(user.id)}
                                                    className={cn(
                                                        "flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors",
                                                        selectedMemberIds.includes(user.id) ? "bg-primary/5 border border-primary/20" : "hover:bg-slate-50 border border-transparent"
                                                    )}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 uppercase">
                                                            {user.name.charAt(0)}
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-medium">{user.name}</span>
                                                            <span className="text-[10px] text-muted-foreground uppercase">{user.workflow_role || user.platform_role}</span>
                                                        </div>
                                                    </div>
                                                    {selectedMemberIds.includes(user.id) && (
                                                        <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                                                            <Check className="h-3 w-3 text-white" />
                                                        </div>
                                                    )}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter className="p-6 bg-slate-50 border-t border-border flex flex-row items-center justify-end gap-3">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} className="px-6">Cancel</Button>
                    <Button 
                        onClick={handleCreate} 
                        disabled={isSubmitting || (type === 'direct' ? !selectedUserId : (!groupName.trim() || selectedMemberIds.length === 0))}
                        className="px-8 shadow-lg shadow-primary/20"
                    >
                        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        {type === 'direct' ? 'Start Chat' : 'Create Group'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
