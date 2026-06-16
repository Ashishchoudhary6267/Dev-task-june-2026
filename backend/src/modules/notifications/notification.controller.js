import { getSupabase } from '../../config/supabase.js';
import { sendNotification } from "../../utils/notify.js";

/**
 * POST /api/notifications/send
 * Controller manually sends a notification to a team member.
 * Body: { user_id, type, title, message, task_id?, instance_id? }
 * Auth: c.get("user") (the controller who is sending)
 */
export const sendControllerNotification = async (c) => {
    try {
        const { user_id, user_ids, type, title, message, task_id, instance_id } = await c.req.json();
        const sent_by = c.get("user")?.id;
        const company_id = c.get("user").company_id;

        const targetUsers = Array.isArray(user_ids) && user_ids.length > 0
            ? user_ids
            : (user_id ? [user_id] : []);

        if (targetUsers.length === 0 || !type || !title) {
            return c.json({ message: 'user_id(s), type, and title are required' }, 400);
        }

        const supabase = getSupabase(c.env);

        const insertData = targetUsers.map(uid => ({
            user_id: uid,
            type,
            title,
            message: message || null,
            task_id: task_id || null,
            instance_id: instance_id || null,
            sent_by: sent_by || null,
            company_id
        }));

        await sendNotification(insertData, c);

        return c.json({ message: 'Notifications sent successfully' }, 201);
    } catch (error) {
        return c.json({ message: error.message }, 500);
    }
};

/**
 * GET /api/notifications/all
 * Controller fetches ALL notifications across all users (for overview).
 * Joins with users table to get sender and recipient names.
 */
export const getAllNotifications = async (c) => {
    try {
        const supabase = getSupabase(c.env);
        const { data, error } = await supabase
            .from('notifications')
            .select(`
                *,
                recipient:user_id ( id, name, email, workflow_role ),
                sender:sent_by ( id, name, email )
            `)
            .eq('company_id', c.get("user").company_id)
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) return c.json({ message: error.message }, 400);
        return c.json(data, 200);
    } catch (error) {
        return c.json({ message: error.message }, 500);
    }
};
