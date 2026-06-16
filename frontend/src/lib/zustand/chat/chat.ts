import { create } from 'zustand';
import api from '@/lib/api';

// Example types for Chat
export type ChatChannel = {
    id: string;
    type: 'direct' | 'group';
    name?: string;
    display_name?: string; // Added from backend
    project_id?: string;
    created_at: string;
    last_message_at?: string; // Added from backend
    unread_count?: number;
    last_message?: string;
};

export type ChatMessage = {
    id: string;
    channel_id: string;
    sender_id: string;
    content: string;
    created_at: string;
    sender_name?: string;
    sender?: { id: string; name: string }; // Added from backend relation
    isMe?: boolean;
};

interface ChatState {
    channels: ChatChannel[];
    activeChannelId: string | null;
    messages: ChatMessage[];
    loadingChannels: boolean;
    loadingMessages: boolean;
    error: string | null;
    activeChannelMembers: any[]; // Added for members list

    fetchChannels: () => Promise<void>;
    fetchMessages: (channelId: string) => Promise<void>;
    setActiveChannel: (channelId: string) => void;
    sendMessage: (content: string) => Promise<boolean>;
    createChannel: (name: string, memberIds: string[], projectId?: string) => Promise<string | null>;
    createDirectChannel: (targetUserId: string) => Promise<string | null>;
    fetchChannelMembers: (channelId: string) => Promise<void>; // Added
    deleteChannel: (channelId: string) => Promise<boolean>; // Added
    receiveRealtimeMessage: (message: ChatMessage) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
    channels: [],
    activeChannelId: null,
    messages: [],
    loadingChannels: false,
    loadingMessages: false,
    error: null,
    activeChannelMembers: [],

    fetchChannels: async () => {
        set({ loadingChannels: true, error: null });
        try {
            const { data } = await api.get('/chat/channels');
            set({ channels: data.data || [], loadingChannels: false });
        } catch (err: any) {
            set({ error: err.response?.data?.message || 'Failed to fetch channels', loadingChannels: false });
        }
    },

    fetchMessages: async (channelId: string) => {
        if (!channelId) return;
        set({ loadingMessages: true, error: null });
        try {
            const { data } = await api.get(`/chat/channels/${channelId}/messages`);
            
            // Identify standard messages (exclude optimistic ones getting replaced)
            set({ messages: data.data || [], loadingMessages: false });
        } catch (err: any) {
            set({ error: err.response?.data?.message || 'Failed to fetch messages', loadingMessages: false });
        }
    },

    setActiveChannel: (channelId: string) => {
        set({ activeChannelId: channelId });
        get().fetchMessages(channelId);
    },

    sendMessage: async (content: string) => {
        const { activeChannelId } = get();
        if (!activeChannelId || !content.trim()) return false;

        // Optimistic Update
        const tempId = `temp-${Date.now()}`;
        const newMsg: ChatMessage = {
            id: tempId,
            channel_id: activeChannelId,
            sender_id: 'me', // Will be replaced by server
            content,
            created_at: new Date().toISOString(),
            isMe: true,
            sender_name: 'You'
        };
        
        set(state => ({ messages: [...state.messages, newMsg] }));

        try {
            const { data } = await api.post(`/chat/channels/${activeChannelId}/messages`, { content });
            
            // Replace optimistic message with actual server message
            set(state => ({
                messages: state.messages.map(m => m.id === tempId ? { ...data, isMe: true } : m)
            }));
            
            return true;
        } catch (err) {
            // Revert optimistic if failed
            set(state => ({ messages: state.messages.filter(m => m.id !== tempId) }));
            return false;
        }
    },

    createChannel: async (name, memberIds, projectId) => {
        try {
            const { data } = await api.post('/chat/channels', { name, project_id: projectId, member_ids: memberIds });
            await get().fetchChannels();
            return data.id;
        } catch (err) {
            return null;
        }
    },

    createDirectChannel: async (targetUserId) => {
        try {
            const { data } = await api.post('/chat/channels/direct', { target_user_id: targetUserId });
            await get().fetchChannels();
            return data.id;
        } catch (err) {
            return null;
        }
    },

    fetchChannelMembers: async (channelId) => {
        try {
            const { data } = await api.get(`/chat/channels/${channelId}/members`);
            set({ activeChannelMembers: data.data || [] });
        } catch (err) {
            set({ activeChannelMembers: [] });
        }
    },

    deleteChannel: async (channelId) => {
        try {
            await api.delete(`/chat/channels/${channelId}`);
            set(state => ({
                channels: state.channels.filter(ch => ch.id !== channelId),
                activeChannelId: state.activeChannelId === channelId ? null : state.activeChannelId
            }));
            return true;
        } catch (err) {
            return false;
        }
    },

    receiveRealtimeMessage: (message: ChatMessage) => {
        const { activeChannelId, messages } = get();
        
        // Prevent duplicate append if it's our own message coming back via socket
        if (messages.find(m => m.id === message.id)) return;
        
        if (message.channel_id === activeChannelId) {
             set(state => ({ messages: [...state.messages, message] }));
        } else {
             // Increment unread count & set last message
             set(state => ({
                 channels: state.channels.map(ch => 
                    ch.id === message.channel_id 
                        ? { ...ch, unread_count: (ch.unread_count || 0) + 1, last_message: message.content } 
                        : ch
                 )
             }));
        }
    }
}));
