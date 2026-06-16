import { getSupabase } from '../config/supabase.js';
import { buildPushPayload } from '@block65/webcrypto-web-push';

/**
 * Insert a notification row for one or more users.
 * @param {Object|Object[]} opts - notification payload
 * @param {Object} cOrEnv - Hono context `c` OR raw env object
 */
export async function sendNotification(opts, cOrEnv) {
    try {
        // Support both Hono context 'c' and raw 'env'
        const isContext = cOrEnv && typeof cOrEnv.get === 'function' && cOrEnv.env;
        const env = isContext ? cOrEnv.env : (cOrEnv || {});
        const ctx = isContext ? (cOrEnv.executionCtx || null) : null;

        const supabase = getSupabase(env);
        const rows = Array.isArray(opts) ? opts : [opts];

        // ── 0. Gatekeeper: check company_notification_settings ──────────────
        const TYPE_TO_COLUMN = {
            task_assigned: 'task_assigned',
            submitted_for_review: 'task_submitted',
            task_submitted: 'task_submitted',
            task_approved: 'task_approved',
            task_rejected: 'task_rejected',
            task_completed: 'task_completed',
            follow_up_reminder: 'task_assigned', // maps to task_assigned gate
        };

        const notifUserIds = [...new Set(rows.map(r => r.user_id).filter(Boolean))];
        let allowedRows = rows;

        if (notifUserIds.length > 0) {
            const { data: usersData } = await supabase
                .from('users').select('id, company_id').in('id', notifUserIds);
            const userCompanyMap = Object.fromEntries((usersData || []).map(u => [u.id, u.company_id]));
            const companyIds = [...new Set(Object.values(userCompanyMap).filter(Boolean))];

            if (companyIds.length > 0) {
                const { data: settingsData } = await supabase
                    .from('company_notification_settings').select('*').in('company_id', companyIds);
                const settingsMap = Object.fromEntries((settingsData || []).map(s => [s.company_id, s]));

                allowedRows = rows.filter(r => {
                    const companyId = userCompanyMap[r.user_id];
                    if (!companyId) return true;
                    const setting = settingsMap[companyId];
                    if (!setting) return true; // no row → default allow
                    const col = TYPE_TO_COLUMN[r.type];
                    if (!col || !(col in setting)) return true; // unknown type → allow
                    return setting[col] === true;
                });
            }
        }

        if (allowedRows.length === 0) {
            console.log('[notify] all notifications blocked by company settings, skipping');
            return;
        }
        // ────────────────────────────────────────────────────────────────────

        // 1. Insert DB notification
        const { error, data: insertedNotifs } = await supabase.from('notifications').insert(allowedRows).select();

        if (error) {
            console.error('[notify] insert error:', error.message);
            return;
        }

        // 2. Web Push Trigger
        if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
            const userIds = [...new Set(rows.map(r => r.user_id).filter(Boolean))];
            console.log(`[notify] triggering push for users:`, userIds);

            if (userIds.length > 0) {
                const { data: pushUsers } = await supabase
                    .from('users')
                    .select('id, push_notifications_enabled')
                    .in('id', userIds)
                    .eq('push_notifications_enabled', true);

                const enabledUserIds = pushUsers?.map(u => u.id) || [];
                console.log(`[notify] users with push enabled:`, enabledUserIds);

                if (enabledUserIds.length > 0) {
                    const { data: subs } = await supabase
                        .from('push_subscriptions')
                        .select('endpoint, p256dh, auth, user_id')
                        .in('user_id', enabledUserIds);

                    console.log(`[notify] found ${subs?.length || 0} subscriptions for these users`);

                    if (subs && subs.length > 0) {
                        const vapid = {
                            subject: env.VAPID_SUBJECT || 'mailto:admin@example.com',
                            publicKey: env.VAPID_PUBLIC_KEY,
                            privateKey: env.VAPID_PRIVATE_KEY,
                        };

                        const pushPromises = subs.map(async (sub) => {
                            try {
                                const notif = rows.find(r => r.user_id === sub.user_id);
                                if (!notif) return;

                                const message = {
                                    data: JSON.stringify({
                                        title: notif.title,
                                        body: notif.message || 'You have a new notification in FMS',
                                        type: notif.type,
                                        icon: '/icons/icon-192x192.png',
                                        badge: '/icons/badge-72x72.png',
                                        url: '/'
                                    }),
                                    options: {
                                        ttl: 60 * 60 * 24 // 1 day
                                    }
                                };

                                const subscription = {
                                    endpoint: sub.endpoint,
                                    keys: {
                                        p256dh: sub.p256dh,
                                        auth: sub.auth
                                    }
                                };

                                console.log(`[push] building payload for ${sub.user_id} (${sub.endpoint.substring(0, 30)}...)`);
                                const fetchOptions = await buildPushPayload(message, subscription, vapid);

                                console.log(`[push] sending fetch to ${sub.endpoint.substring(0, 30)}...`);
                                const response = await fetch(sub.endpoint, fetchOptions);

                                if (response.ok) {
                                    console.log(`[push] SUCCESS for ${sub.user_id}`);
                                } else {
                                    const status = response.status;
                                    console.error(`[push] FAILED for ${sub.user_id} with status ${status}`);
                                    if (status === 410 || status === 404) {
                                        console.log(`[push] removing dead subscription for ${sub.user_id}`);
                                        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
                                    }
                                }
                            } catch (e) {
                                console.error(`[push] EXCEPTION for ${sub.user_id}:`, e.message);
                            }
                        });

                        // CRITICAL: On Cloudflare Workers, we MUST use waitUntil if we aren't awaiting
                        if (ctx && typeof ctx.waitUntil === 'function') {
                            ctx.waitUntil(Promise.all(pushPromises));
                        } else {
                            await Promise.all(pushPromises);
                        }
                    }
                }
            }
        } else {
            console.warn('[notify] VAPID keys missing in env, skipping push');
        }

    } catch (err) {
        console.error('[notify] unexpected error:', err.message);
    }
}
