'use client'
import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/zustand/user/user';
import { useChatStore } from '@/lib/zustand/chat/chat';
import { useUserStore } from '@/lib/zustand/user/addUser';
import { createClient } from '@supabase/supabase-js';
// import { api } from '@/lib/api';

import api from '@/lib/api';
import { CreateChatModal } from './create-chat-modal';
import { Search, MessageSquare, Plus, Send, MoreVertical, Hash, Trash2, Users } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

// Make sure to use environment variables for this in an actual project
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

type TabId = 'direct' | 'group';

export default function ChatPage() {
    const { user } = useAuthStore();
    const {
        channels,
        activeChannelId,
        messages,
        loadingChannels,
        loadingMessages,
        activeChannelMembers,
        fetchChannels,
        setActiveChannel,
        sendMessage,
        receiveRealtimeMessage,
        fetchChannelMembers,
        deleteChannel
    } = useChatStore();

    const [activeTab, setActiveTab] = useState<TabId>('direct');
    const [searchQuery, setSearchQuery] = useState('');
    const [messageInput, setMessageInput] = useState('');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isMembersDialogOpen, setIsMembersDialogOpen] = useState(false);
    const [isAddMembersDialogOpen, setIsAddMembersDialogOpen] = useState(false);
    const [searchMemberQuery, setSearchMemberQuery] = useState('');
    const [selectedNewMembers, setSelectedNewMembers] = useState<string[]>([]);
    const { users, fetchUsers: fetchAllUsers } = useUserStore();

    useEffect(() => {
        // Initial Fetch
        fetchChannels();

        // Setup Realtime Subscription
        const channel = supabase
            .channel('chat_messages_channel')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'chat_messages' },
                (payload) => {
                    // Send to Zustand to decide what to do (append or mark unread)
                    receiveRealtimeMessage(payload.new as any);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // Also fetch messages whenever active channel changes
    useEffect(() => {
        if (activeChannelId) {
            // Messages fetched automatically by setActiveChannel inside zustand
        }
    }, [activeChannelId]);

    useEffect(() => {
        if (isMembersDialogOpen && activeChannelId) {
            fetchChannelMembers(activeChannelId);
        }
    }, [isMembersDialogOpen, activeChannelId]);

    useEffect(() => {
        if (isAddMembersDialogOpen) {
            fetchAllUsers({ limit: 100 });
        }
    }, [isAddMembersDialogOpen]);


    const handleSend = async () => {
        if (!messageInput.trim() || !activeChannelId) return;
        const msg = messageInput;
        setMessageInput('');
        await sendMessage(msg);
    };

    const handleDeleteChannel = async () => {
        if (!activeChannelId) return;
        if (window.confirm('Are you sure you want to delete this group? This will remove all messages and members.')) {
            const success = await deleteChannel(activeChannelId);
            if (success) {
                // Channel removed from store automatically
            }
        }
    };

    const handleAddMembers = async () => {
        if (!activeChannelId || selectedNewMembers.length === 0) return;
        try {
            await api.post(`/chat/channels/${activeChannelId}/members`, { user_ids: selectedNewMembers });
            setIsAddMembersDialogOpen(false);
            setSelectedNewMembers([]);
            fetchChannelMembers(activeChannelId);
        } catch (err) {
            alert('Failed to add members');
        }
    };

    const getInitials = (name: string) => name ? name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'U';

    const filteredChannels = channels.filter(ch =>
        ch.type === activeTab &&
        (ch.display_name?.toLowerCase() || ch.name?.toLowerCase() || '').includes(searchQuery.toLowerCase())
    );

    const activeChannel = channels.find(ch => ch.id === activeChannelId);
    const activeChannelName = activeChannel?.display_name || activeChannel?.name || 'Loading...';
    // const isOwner = activeChannel?.created_by === user?.id;

    return (
        <div className="flex h-[calc(100vh-2rem)] bg-background border border-border rounded-xl overflow-hidden m-4 shadow-sm">
            {/* Sidebar (Channels List) */}
            <div className="w-[320px] flex flex-col border-r border-border bg-card">
                <div className="p-4 border-b border-border space-y-4">
                    <h2 className="text-xl font-bold flex items-center justify-between">
                        Messages
                        <button
                            onClick={() => setIsCreateModalOpen(true)}
                            className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center hover:bg-primary/20 transition-colors"
                        >
                            <Plus className="h-4 w-4" />
                        </button>
                    </h2>

                    {/* Custom Tabs */}
                    <div className="flex p-1 bg-muted rounded-lg">
                        <button
                            onClick={() => setActiveTab('direct')}
                            className={`flex-1 text-sm py-1.5 rounded-md transition-colors font-medium ${activeTab === 'direct' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            Direct
                        </button>
                        <button
                            onClick={() => setActiveTab('group')}
                            className={`flex-1 text-sm py-1.5 rounded-md transition-colors font-medium ${activeTab === 'group' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            Groups
                        </button>
                    </div>

                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search chats..."
                            className="w-full pl-9 pr-4 py-2 bg-muted/50 border-transparent rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto">
                    {loadingChannels ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">Loading chats...</div>
                    ) : filteredChannels.length === 0 ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">No chats found.</div>
                    ) : (
                        filteredChannels?.map(chat => (
                            <div
                                key={chat.id}
                                onClick={() => setActiveChannel(chat.id)}
                                className={`p-3 mx-2 my-1 rounded-lg cursor-pointer flex items-center gap-3 transition-colors ${activeChannelId === chat.id ? 'bg-primary/10' : 'hover:bg-muted/50'}`}
                            >
                                {activeTab === 'direct' ? (
                                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-sm text-primary shrink-0 relative">
                                        {getInitials(chat.display_name || chat.name || 'User')}
                                    </div>
                                ) : (
                                    // <div className="h-10 w-10 rounded-xl bg-purple-100 flex items-center justify-center font-bold text-sm text-purple-700 shrink-0">
                                    //     <Hash className="h-5 w-5" />
                                    // </div>
                                    ""
                                )}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                        <h4 className="font-semibold text-sm truncate">{chat.display_name || chat.name || 'Chat'}</h4>
                                        <span className="text-xs text-muted-foreground">
                                            {new Date(chat.last_message_at || chat.created_at).toLocaleTimeString([], { timeStyle: 'short' })}
                                        </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground truncate">{chat.last_message || 'Start a conversation...'}</p>
                                </div>
                                {(chat.unread_count || 0) > 0 && (
                                    <div className="h-5 w-5 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-[10px] font-bold">
                                        {chat.unread_count}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Main Chat Area */}
            {activeChannelId ? (
                <div className="flex-1 flex flex-col bg-card relative">
                    {/* Header */}
                    <div className="h-16 flex items-center justify-between px-6 border-b border-border shadow-sm z-10 bg-card">
                        <div className="flex items-center gap-3">
                            {/* <div className="h-10 w-10 text-white rounded-full bg-slate-800 flex items-center justify-center font-bold text-sm shrink-0">
                                {activeTab === 'group' ? <Hash className="h-5 w-5" /> : getInitials(activeChannelName)}
                            </div> */}
                            <div>
                                <h3 className="font-semibold">{activeChannelName}</h3>
                            </div>
                        </div>

                        <DropdownMenu>
                            <DropdownMenuTrigger className="p-2 text-muted-foreground hover:bg-muted rounded-full transition-colors">
                                <MoreVertical className="h-5 w-5" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem onClick={() => setIsMembersDialogOpen(true)} className="gap-2">
                                    <Users className="h-4 w-4" />
                                    View Members
                                </DropdownMenuItem>
                                {/* {isOwner && activeTab === 'group' && (
                                    <>
                                        <DropdownMenuItem onClick={() => setIsAddMembersDialogOpen(true)} className="gap-2">
                                            <Plus className="h-4 w-4" />
                                            Add Members
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={handleDeleteChannel} className="gap-2 text-destructive focus:text-destructive">
                                            <Trash2 className="h-4 w-4" />
                                            Delete Group
                                        </DropdownMenuItem>
                                    </>
                                )} */}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    {/* Messages Feed */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50 flex flex-col">
                        {loadingMessages ? (
                            <div className="text-center text-sm text-muted-foreground my-auto">Loading messages...</div>
                        ) : messages.length === 0 ? (
                            <div className="text-center text-sm text-muted-foreground my-auto flex flex-col items-center gap-2">
                                <MessageSquare className="h-8 w-8 opacity-20" />
                                <p>No messages yet. Start the conversation!</p>
                            </div>
                        ) : (
                            messages.map(msg => {
                                const isMe = msg.isMe || msg.sender_id === user?.id;
                                return (
                                    <div key={msg.id} className={`flex gap-3 max-w-[80%] ${isMe ? 'ml-auto flex-row-reverse' : ''}`}>
                                        {/* {!isMe && (
                                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-[10px] text-primary shrink-0 mt-1">
                                                {getInitials(msg.sender?.name || msg.sender_name || 'U')}
                                            </div>
                                        )} */}
                                        <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>

                                            {!isMe ? <span className="text-[10px] mb-1 ml-1">{msg.sender?.name || msg.sender_name}</span> : <span className="text-[10px] mb-1 ml-1">You</span>}
                                            <div className={`px-4 py-2.5 rounded-2xl text-sm ${isMe ? 'bg-slate-800 text-white rounded-br-none' : 'bg-white border border-border shadow-sm rounded-bl-none'}`}>
                                                {msg.content}
                                            </div>
                                            <span className="text-[10px] text-muted-foreground mt-1.5 px-1">
                                                {new Date(msg.created_at).toLocaleTimeString([], { timeStyle: 'short' })}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Input Area */}
                    <div className="p-4 bg-card border-t border-border">
                        <div className="flex items-end gap-2 bg-muted/40 border border-border rounded-xl p-2 focus-within:ring-2 focus-within:ring-primary/50 focus-within:border-transparent transition-all">
                            <button className="p-2.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors mb-0.5">
                                <Plus className="h-5 w-5" />
                            </button>
                            <textarea
                                className="flex-1 bg-transparent border-0 resize-none max-h-32 min-h-[44px] py-3 text-sm focus:outline-none placeholder:text-muted-foreground"
                                placeholder="Type a message..."
                                value={messageInput}
                                onChange={(e) => setMessageInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSend();
                                    }
                                }}
                            />
                            <button
                                onClick={handleSend}
                                disabled={!messageInput.trim()}
                                className="p-2.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors mb-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Send className="h-4 w-4" />
                            </button>
                        </div>
                        <p className="text-[10px] text-muted-foreground text-center mt-2">
                            Press Enter to send, Shift + Enter for new line.
                        </p>
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex flex-col bg-card/50 items-center justify-center">
                    <div className="h-24 w-24 bg-primary/5 rounded-full flex items-center justify-center mb-6">
                        <MessageSquare className="h-10 w-10 text-primary/40" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2 text-foreground/80">Your Messages</h3>
                    <p className="text-sm text-muted-foreground max-w-sm text-center">Select a chat from the sidebar to start messaging, or create a new conversation.</p>
                </div>
            )}

            <CreateChatModal
                open={isCreateModalOpen}
                onOpenChange={setIsCreateModalOpen}
            />

            {/* Members Dialog */}
            <Dialog open={isMembersDialogOpen} onOpenChange={setIsMembersDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">

                    {/* Header */}
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <span>
                                {activeTab === 'group' ? 'Group Members' : 'Contact Info'}
                            </span>

                            {activeTab === 'group' && (
                                <span className="text-sm font-normal text-muted-foreground">
                                    ({activeChannelMembers?.length || 0} Members)
                                </span>
                            )}
                        </DialogTitle>
                    </DialogHeader>

                    {/* Body */}
                    <div className="py-4 space-y-4">
                        {activeChannelMembers?.length === 0 ? (
                            <div className="text-center text-sm text-muted-foreground py-8">
                                Loading members...
                            </div>
                        ) : (
                            <div className="space-y-3 overflow-y-auto h-64 custom-scrollbar">
                                {activeChannelMembers?.map((m: any) => (
                                    <div
                                        key={m.user_id}
                                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50"
                                    >
                                        {/* Avatar */}
                                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-sm text-primary">
                                            {getInitials(m.users?.name)}
                                        </div>

                                        {/* Info */}
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium">
                                                {m.users?.name} {m.user_id === user?.id && '(You)'}
                                            </span>
                                            <span className="text-[10px] text-muted-foreground uppercase">
                                                {m.role}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setIsMembersDialogOpen(false)}
                        >
                            Close
                        </Button>
                    </DialogFooter>

                </DialogContent>
            </Dialog>
            {/* Add Members Dialog */}
            <Dialog open={isAddMembersDialogOpen} onOpenChange={setIsAddMembersDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Add Members</DialogTitle>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Search teammates..."
                                className="w-full pl-9 pr-4 py-2 bg-muted/50 border-transparent rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                value={searchMemberQuery}
                                onChange={(e) => setSearchMemberQuery(e.target.value)}
                            />
                        </div>
                        <div className="max-h-[300px] overflow-y-auto space-y-2">
                            {users
                                .filter(u => u.name.toLowerCase().includes(searchMemberQuery.toLowerCase()) && !activeChannelMembers.some(m => m.user_id === u.id))
                                .map(user => (
                                    <div
                                        key={user.id}
                                        onClick={() => {
                                            setSelectedNewMembers(prev =>
                                                prev.includes(user.id) ? prev.filter(id => id !== user.id) : [...prev, user.id]
                                            );
                                        }}
                                        className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${selectedNewMembers.includes(user.id) ? 'bg-primary/10 border border-primary/20' : 'hover:bg-muted/50'}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-[10px] text-primary">
                                                {getInitials(user.name)}
                                            </div>
                                            <span className="text-sm">{user.name}</span>
                                        </div>
                                        {selectedNewMembers.includes(user.id) && <Plus className="h-4 w-4 text-primary rotate-45" />}
                                    </div>
                                ))}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddMembersDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleAddMembers} disabled={selectedNewMembers.length === 0}>Add ({selectedNewMembers.length})</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
