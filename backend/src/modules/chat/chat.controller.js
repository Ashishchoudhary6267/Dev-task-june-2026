import { getSupabase } from '../../config/supabase.js';

// ─── GET /api/chat/channels ───────────────────────────────────────────────────
// Returns all channels (direct + group) this user is a participant in.
export const getChannels = async (c) => {
    try {
        const user = c.get('user');
        const supabase = getSupabase(c.env);

        // Get all channels this user belongs to via chat_participants
        const { data, error } = await supabase
            .from('chat_participants')
            .select(`
                channel_id,
                last_read_at,
                chat_channels (
                    id, type, name, project_id, created_by, created_at
                )
            `)
            .eq('user_id', user.id);

        if (error) return c.json({ message: error.message }, 400);

        // For each channel get the latest message and unread count
        const channels = (data || []).map(row => ({
            ...row.chat_channels,
            last_read_at: row.last_read_at,
        }));

        // Bulk fetch last message per channel
        const channelIds = channels.map(ch => ch.id);
        if (channelIds.length === 0) return c.json({ data: [] }, 200);

        // For each channel, fetch the last message (use a subquery via RPC or JS loop on small data)
        const { data: lastMsgs } = await supabase
            .from('chat_messages')
            .select('channel_id, content, created_at, sender_id')
            .in('channel_id', channelIds)
            .order('created_at', { ascending: false });

        // Fetch participant names for direct channels
        const { data: participants } = await supabase
            .from('chat_participants')
            .select('channel_id, user_id, users(id, name)')
            .in('channel_id', channelIds)
            .neq('user_id', user.id);

        // Build enriched list
        const enriched = channels.map(ch => {
            const lastMsg = (lastMsgs || []).find(m => m.channel_id === ch.id);
            const unreadCount = (lastMsgs || []).filter(
                m => m.channel_id === ch.id && new Date(m.created_at) > new Date(ch.last_read_at || 0)
            ).length;

            // For DMs, derive name from the other participant
            let displayName = ch.name;
            if (ch.type === 'direct') {
                const other = (participants || []).find(p => p.channel_id === ch.id);
                displayName = other?.users?.name || 'Direct Message';
            }

            return {
                ...ch,
                display_name: displayName,
                last_message: lastMsg?.content || null,
                last_message_at: lastMsg?.created_at || ch.created_at,
                unread_count: unreadCount,
            };
        });

        return c.json({ data: enriched }, 200);
    } catch (error) {
        return c.json({ message: error.message }, 500);
    }
};

// ─── POST /api/chat/channels ──────────────────────────────────────────────────
// Create a new group channel (admin/controller only).
export const createChannel = async (c) => {
    try {
        const user = c.get('user');
        const { name, project_id, member_ids = [] } = await c.req.json();

        if (!name) return c.json({ message: 'Group name is required' }, 400);

        const supabase = getSupabase(c.env);

        // 1. Create channel
        const { data: channel, error: channelError } = await supabase
            .from('chat_channels')
            .insert({
                company_id: user.company_id,
                type: 'group',
                name,
                project_id: project_id || null,
                created_by: user.id,
            })
            .select()
            .single();

        if (channelError) return c.json({ message: channelError.message }, 400);

        // 2. Add creator + all members as participants
        const allMemberIds = [...new Set([user.id, ...member_ids])];
        const participantRows = allMemberIds.map(uid => ({
            channel_id: channel.id,
            user_id: uid,
            role: uid === user.id ? 'admin' : 'member',
        }));

        await supabase.from('chat_participants').insert(participantRows);

        return c.json(channel, 201);
    } catch (error) {
        return c.json({ message: error.message }, 500);
    }
};

// ─── POST /api/chat/channels/direct ───────────────────────────────────────────
// Start or retrieve a 1-on-1 DM channel.
export const getOrCreateDirectChannel = async (c) => {
    try {
        const user = c.get('user');
        const { target_user_id } = await c.req.json();

        if (!target_user_id) return c.json({ message: 'target_user_id is required' }, 400);
        if (target_user_id === user.id) return c.json({ message: 'Cannot create DM with yourself' }, 400);

        const supabase = getSupabase(c.env);

        // Check if a direct channel already exists between these two users
        const { data: existing } = await supabase
            .from('chat_participants')
            .select('channel_id, chat_channels!inner(id, type)')
            .eq('user_id', user.id)
            .eq('chat_channels.type', 'direct');

        if (existing && existing.length > 0) {
            const myChannelIds = existing.map(e => e.channel_id);
            const { data: shared } = await supabase
                .from('chat_participants')
                .select('channel_id')
                .eq('user_id', target_user_id)
                .in('channel_id', myChannelIds);

            if (shared && shared.length > 0) {
                const { data: ch } = await supabase
                    .from('chat_channels')
                    .select('*')
                    .eq('id', shared[0].channel_id)
                    .single();
                return c.json(ch, 200);
            }
        }

        // None found — create a new direct channel
        const { data: channel, error } = await supabase
            .from('chat_channels')
            .insert({ company_id: user.company_id, type: 'direct', created_by: user.id })
            .select()
            .single();

        if (error) return c.json({ message: error.message }, 400);

        await supabase.from('chat_participants').insert([
            { channel_id: channel.id, user_id: user.id, role: 'member' },
            { channel_id: channel.id, user_id: target_user_id, role: 'member' },
        ]);

        return c.json(channel, 201);
    } catch (error) {
        return c.json({ message: error.message }, 500);
    }
};

// ─── GET /api/chat/channels/:channelId/messages ───────────────────────────────
export const getMessages = async (c) => {
    try {
        const user = c.get('user');
        const channelId = c.req.param('channelId');
        const supabase = getSupabase(c.env);

        // Verify user is a participant
        const { data: access } = await supabase
            .from('chat_participants')
            .select('channel_id')
            .eq('channel_id', channelId)
            .eq('user_id', user.id)
            .single();

        if (!access) return c.json({ message: 'Access denied' }, 403);

        const { data, error } = await supabase
            .from('chat_messages')
            .select('*, sender:sender_id(id, name)')
            .eq('channel_id', channelId)
            .is('parent_id', null) // Only top-level messages (not thread replies)
            .order('created_at', { ascending: true })
            .limit(100);

        if (error) return c.json({ message: error.message }, 400);

        // Mark as read
        await supabase.from('chat_participants')
            .update({ last_read_at: new Date().toISOString() })
            .eq('channel_id', channelId)
            .eq('user_id', user.id);

        return c.json({ data: data || [] }, 200);
    } catch (error) {
        return c.json({ message: error.message }, 500);
    }
};

// ─── POST /api/chat/channels/:channelId/messages ──────────────────────────────
export const sendMessage = async (c) => {
    try {
        const user = c.get('user');
        const channelId = c.req.param('channelId');
        const { content, parent_id } = await c.req.json();

        if (!content?.trim()) return c.json({ message: 'content is required' }, 400);

        // Verify user is a participant
        const supabase = getSupabase(c.env);
        const { data: access } = await supabase
            .from('chat_participants')
            .select('channel_id')
            .eq('channel_id', channelId)
            .eq('user_id', user.id)
            .single();

        if (!access) return c.json({ message: 'Access denied' }, 403);

        const { data, error } = await supabase
            .from('chat_messages')
            .insert({
                channel_id: channelId,
                sender_id: user.id,
                content: content.trim(),
                parent_id: parent_id || null,
            })
            .select('*, sender:sender_id(id, name)')
            .single();

        if (error) return c.json({ message: error.message }, 400);
        return c.json(data, 201);
    } catch (error) {
        return c.json({ message: error.message }, 500);
    }
};

// ─── GET /api/chat/channels/:channelId/members ────────────────────────────────
export const getChannelMembers = async (c) => {
    try {
        const channelId = c.req.param('channelId');
        const supabase = getSupabase(c.env);

        const { data, error } = await supabase
            .from('chat_participants')
            .select('user_id, role, joined_at, users(id, name, email)')
            .eq('channel_id', channelId);

        if (error) return c.json({ message: error.message }, 400);
        return c.json({ data: data || [] }, 200);
    } catch (error) {
        return c.json({ message: error.message }, 500);
    }
};

// ─── POST /api/chat/channels/:channelId/members ───────────────────────────────
export const addChannelMember = async (c) => {
    try {
        const channelId = c.req.param('channelId');
        const { user_ids = [] } = await c.req.json();
        const supabase = getSupabase(c.env);

        const rows = user_ids.map(uid => ({
            channel_id: channelId,
            user_id: uid,
            role: 'member',
        }));

        const { error } = await supabase.from('chat_participants').upsert(rows);
        if (error) return c.json({ message: error.message }, 400);
        return c.json({ message: 'Members added' }, 200);
    } catch (error) {
        return c.json({ message: error.message }, 500);
    }
};

// ─── DELETE /api/chat/channels/:channelId ─────────────────────────────────────
export const deleteChannel = async (c) => {
    try {
        const user = c.get('user');
        const channelId = c.req.param('channelId');
        const supabase = getSupabase(c.env);

        // 1. Verify user is the creator or an admin of the channel
        const { data: channel } = await supabase
            .from('chat_channels')
            .select('created_by')
            .eq('id', channelId)
            .single();

        if (!channel) return c.json({ message: 'Channel not found' }, 404);
        if (channel.created_by !== user.id) return c.json({ message: 'Only the creator can delete this channel' }, 403);

        // 2. Delete in order (Supabase RLS/Constraints might handle this, but explicit is safer)
        await supabase.from('chat_messages').delete().eq('channel_id', channelId);
        await supabase.from('chat_participants').delete().eq('channel_id', channelId);
        const { error } = await supabase.from('chat_channels').delete().eq('id', channelId);

        if (error) return c.json({ message: error.message }, 400);
        return c.json({ message: 'Channel deleted' }, 200);
    } catch (error) {
        return c.json({ message: error.message }, 500);
    }
};
