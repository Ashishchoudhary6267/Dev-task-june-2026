import { createClient } from '@supabase/supabase-js';

// Setup Supabase instance using Cloudflare environment variables
const getSupabase = (c) => {
    return createClient(
        c.env.SUPABASE_URL,
        c.env.SUPABASE_SERVICE_ROLE_KEY
    );
};

// Toggle Notifications Globally
export const toggleGlobalPush = async (c) => {
    try {
        const user = c.get('user');
        if (!user) return c.json({ error: 'Unauthorized' }, 401);

        const { enabled } = await c.req.json();
        const supabase = getSupabase(c);

        const { error } = await supabase
            .from('users')
            .update({ push_notifications_enabled: !!enabled })
            .eq('id', user.id);

        if (error) throw error;

        return c.json({ message: 'Push notifications setting updated', enabled: !!enabled }, 200);
    } catch (error) {
        console.error('Error toggling push:', error);
        return c.json({ error: 'Failed to update push settings' }, 500);
    }
};

// Subscribe a Browser Endpoint
export const subscribeEndpoint = async (c) => {
    try {
        const user = c.get('user');
        if (!user) return c.json({ error: 'Unauthorized' }, 401);

        const { subscription } = await c.req.json();
        
        if (!subscription || !subscription.endpoint || !subscription.keys) {
             return c.json({ error: 'Invalid subscription object' }, 400);
        }

        const supabase = getSupabase(c);

        const { error } = await supabase
            .from('push_subscriptions')
            .upsert({
                user_id: user.id,
                endpoint: subscription.endpoint,
                p256dh: subscription.keys.p256dh,
                auth: subscription.keys.auth
            }, { onConflict: 'user_id, endpoint' });

        if (error) throw error;

        // Auto-enable notifications when they subscribe a new device
        await supabase.from('users').update({ push_notifications_enabled: true }).eq('id', user.id);

        return c.json({ message: 'Subscription saved' }, 201);
    } catch (error) {
        console.error('Error saving subscription:', error);
        return c.json({ error: 'Failed to save subscription' }, 500);
    }
};

// Unsubscribe a Browser Endpoint
export const unsubscribeEndpoint = async (c) => {
    try {
        const user = c.get('user');
        if (!user) return c.json({ error: 'Unauthorized' }, 401);

        const { endpoint } = await c.req.json();
        if (!endpoint) return c.json({ error: 'Endpoint required' }, 400);

        const supabase = getSupabase(c);
        const { error } = await supabase
            .from('push_subscriptions')
            .delete()
            .eq('user_id', user.id)
            .eq('endpoint', endpoint);

        if (error) throw error;

        return c.json({ message: 'Subscription removed' }, 200);
    } catch (error) {
        console.error('Error removing subscription:', error);
        return c.json({ error: 'Failed to remove subscription' }, 500);
    }
};
