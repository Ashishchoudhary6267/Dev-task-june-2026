import { Hono } from 'hono';
import { authenticate } from '../../middleware/auth.middleware.js';
import { getSupabase } from '../../config/supabase.js';

const router = new Hono();

// POST /api/heartbeat — called by the client every 30s to mark the user online
router.post('/heartbeat', authenticate, async (c) => {
    const authUser = c.get('user');
    if (!authUser) return c.json({ message: 'Unauthorized' }, 401);

    const supabase = getSupabase(c.env);

    const { error } = await supabase
        .from('users')
        .update({
            last_seen_at: new Date().toISOString(),
            is_online: true,
        })
        .eq('id', authUser.id);

    if (error) {
        console.error('[heartbeat] update error:', error.message);
        return c.json({ error: error.message }, 500);
    }

    return c.json({ ok: true });
});

// GET /api/heartbeat/admin/active-users — list users seen in the last 60s
router.get('/heartbeat/admin/active-users', authenticate, async (c) => {
    const authUser = c.get('user');
    if (!authUser) return c.json({ message: 'Unauthorized' }, 401);

    // Only controllers, admins and superadmins can call this
    const allowedRoles = ['controller', 'admin', 'superadmin'];
    if (!allowedRoles.includes(authUser.platform_role)) {
        return c.json({ message: 'Forbidden' }, 403);
    }

    const supabase = getSupabase(c.env);
    const thresholdMs = Number(c.req.query('threshold_ms') || 60_000);
    const since = new Date(Date.now() - thresholdMs).toISOString();

    const { data, error } = await supabase
        .from('users')
        .select('id, name, email, last_seen_at, is_online, platform_role, company_id')
        .eq('company_id', authUser.company_id)
        .gt('last_seen_at', since)
        .order('last_seen_at', { ascending: false });

    if (error) return c.json({ error: error.message }, 500);
    return c.json({ users: data });
});

// POST /api/heartbeat/admin/sync-offline — mark stale users as offline
// Call this from a scheduled job or cron endpoint
router.post('/heartbeat/admin/sync-offline', authenticate, async (c) => {
    const authUser = c.get('user');
    if (!authUser) return c.json({ message: 'Unauthorized' }, 401);

    const allowedRoles = ['controller', 'admin', 'superadmin'];
    if (!allowedRoles.includes(authUser.platform_role)) {
        return c.json({ message: 'Forbidden' }, 403);
    }

    const supabase = getSupabase(c.env);
    const thresholdMs = Number(c.req.query('threshold_ms') || 60_000);
    const cutoff = new Date(Date.now() - thresholdMs).toISOString();

    const { error } = await supabase
        .from('users')
        .update({ is_online: false })
        .lt('last_seen_at', cutoff)
        .eq('is_online', true); // only update those currently marked online (reduces writes)

    if (error) return c.json({ error: error.message }, 500);
    return c.json({ ok: true });
});

export default router;
