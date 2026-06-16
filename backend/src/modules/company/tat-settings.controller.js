import { getSupabase } from '../../config/supabase.js';
// import { runOverdueCheck } from './sla-extension.scheduler.js';
import { runOverdueCheck } from '../sla-extension/sla-extension.scheduler.js';

/**
 * GET /api/companies/tat-settings
 * Returns the TAT review window hours for the caller's company.
 * Defaults to 4 hours if no row exists yet.
 */
export const getTatSettings = async (c) => {
    try {
        const authUser = c.get('user');
        if (!authUser) return c.json({ message: 'Unauthorized' }, 401);

        const supabase = getSupabase(c.env);
        const { data, error } = await supabase
            .from('company_tat_settings')
            .select('*')
            .eq('company_id', authUser.company_id)
            .maybeSingle();

        if (error) return c.json({ message: error.message }, 500);

        // Return defaults if no row exists yet
        return c.json(data ?? { company_id: authUser.company_id, tat_review_deadline_hours: 4 }, 200);
    } catch (err) {
        return c.json({ message: 'Internal Server Error', error: err.message }, 500);
    }
};

/**
 * PATCH /api/companies/tat-settings
 * Upserts the TAT review window hours for the caller's company.
 * Body: { tat_review_deadline_hours: number }
 * Only controllers and admins can update.
 */
export const updateTatSettings = async (c) => {
    try {
        const authUser = c.get('user');
        if (!authUser) return c.json({ message: 'Unauthorized' }, 401);

        const allowed = ['controller', 'admin', 'superadmin'];
        if (!allowed.includes(authUser.platform_role)) {
            return c.json({ message: 'Forbidden — only controllers and admins can update TAT settings' }, 403);
        }

        const { tat_review_deadline_hours } = await c.req.json();

        if (
            tat_review_deadline_hours === undefined ||
            typeof tat_review_deadline_hours !== 'number' ||
            !Number.isInteger(tat_review_deadline_hours) ||
            tat_review_deadline_hours < 1 ||
            tat_review_deadline_hours > 168 // max 1 week
        ) {
            return c.json({ message: 'tat_review_deadline_hours must be an integer between 1 and 168' }, 400);
        }

        const supabase = getSupabase(c.env);
        const { data, error } = await supabase
            .from('company_tat_settings')
            .upsert(
                {
                    company_id: authUser.company_id,
                    tat_review_deadline_hours,
                    updated_at: new Date().toISOString(),
                },
                { onConflict: 'company_id' }
            )
            .select()
            .single();

        if (error) return c.json({ message: error.message }, 500);
        return c.json(data, 200);
    } catch (err) {
        return c.json({ message: 'Internal Server Error', error: err.message }, 500);
    }
};

/**
 * POST /api/internal/check-overdue-tasks
 * Secured endpoint called by Cloudflare scheduled() or Supabase pg_cron.
 * Validates x-cron-secret header before running the overdue check.
 */
export const checkOverdueTasksHandler = async (c) => {
    try {
        const secret = c.req.header('x-cron-secret');
        const expectedSecret = c.env.CRON_SECRET;

        if (!expectedSecret || secret !== expectedSecret) {
            return c.json({ message: 'Unauthorized (invalid cron secret)' }, 403);
        }

        const result = await runOverdueCheck(c.env);
        return c.json({ ok: true, ...result }, 200);
    } catch (err) {
        console.error('[check-overdue] Error:', err.message);
        return c.json({ message: 'Internal Server Error', error: err.message }, 500);
    }
};
