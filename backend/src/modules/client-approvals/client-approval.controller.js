import { getSupabase } from '../../config/supabase.js';
import { sendNotification } from '../../utils/notify.js';
import { unlockNextTask } from '../tasks/task.helper.js';
import { addWorkingMinutes } from '../../utils/businessCalendar.js';

/**
 * GET /api/client-approvals
 * List client approvals for the company (filterable by status)
 */
export const listClientApprovals = async (c) => {
    try {
        const user = c.get('user');
        const companyId = user.company_id;
        const status = c.req.query('status') || 'PENDING';
        const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
        const limit = Math.min(50, Math.max(1, parseInt(c.req.query('limit') || '20', 10)));
        const offset = (page - 1) * limit;

        const supabase = getSupabase(c.env);

        let query = supabase
            .from('client_approvals')
            .select(`
                *,
                instance:instance_id(id, name, client:client_id(id, name)),
                task:task_id(id, title, assigned_user_id, assigned_user:assigned_user_id(id, name, email)),
                decided_by:decision_by(id, name)
            `, { count: 'exact' })
            .eq('company_id', companyId)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (status !== 'ALL') {
            query = query.eq('status', status);
        }

        const { data, count, error } = await query;
        if (error) return c.json({ message: error.message }, 400);

        return c.json({
            data: data || [],
            count: count || 0,
            page,
            limit,
            totalPages: Math.ceil((count || 0) / limit),
        }, 200);
    } catch (err) {
        console.error('List Client Approvals Error:', err);
        return c.json({ message: 'Internal Server Error' }, 500);
    }
};

/**
 * POST /api/client-approvals/:id/resolve
 * Controller logs the client's decision (APPROVED or REJECTED)
 * Body: { action: 'APPROVED' | 'REJECTED', comment?: string }
 */
export const resolveClientApproval = async (c) => {
    try {
        const approvalId = c.req.param('id');
        const user = c.get('user');
        const userId = user.id;
        const companyId = user.company_id;
        const { action, comment } = await c.req.json();

        if (!action || !['APPROVED', 'REJECTED'].includes(action)) {
            return c.json({ message: 'action must be APPROVED or REJECTED' }, 400);
        }
        if (action === 'REJECTED' && (!comment || comment.trim().length === 0)) {
            return c.json({ message: 'A comment is required when rejecting a client approval' }, 400);
        }

        const supabase = getSupabase(c.env);

        // 1. Fetch the client approval record
        const { data: approval, error: approvalError } = await supabase
            .from('client_approvals')
            .select('id, status, instance_id, task_id, company_id')
            .eq('id', approvalId)
            .eq('company_id', companyId)
            .single();

        if (approvalError || !approval) return c.json({ message: 'Client approval not found' }, 404);
        if (approval.status !== 'PENDING') return c.json({ message: `Cannot resolve an approval that is already ${approval.status}` }, 400);

        // 2. Fetch the task
        const { data: task, error: taskError } = await supabase
            .from('tasks')
            .select('id, title, instance_id, task_order, assigned_user_id, turnaround_minutes, status')
            .eq('id', approval.task_id)
            .single();

        if (taskError || !task) return c.json({ message: 'Associated task not found' }, 404);

        // 3. Fetch the instance
        const { data: instance, error: instError } = await supabase
            .from('instances')
            .select('id, name, created_by, client:client_id(id, name)')
            .eq('id', approval.instance_id)
            .single();

        if (instError || !instance) return c.json({ message: 'Associated instance not found' }, 404);

        const now = new Date().toISOString();

        // 4. Update the client_approvals record
        await supabase
            .from('client_approvals')
            .update({
                status: action,
                client_comment: comment?.trim() || null,
                decision_by: userId,
                decision_at: now,
                updated_at: now,
            })
            .eq('id', approvalId);

        // Invalidate dashboard stats cache
        await c.env.FMS_CACHE?.delete(`dashboard_stats_${companyId}`);

        if (action === 'APPROVED') {
            // ── CLIENT APPROVED ───────────────────────────────────────────────
            // Resume instance
            await supabase
                .from('instances')
                .update({
                    is_paused: false,
                    pending_client_approval: false,
                    client_approval_task_id: null,
                    pause_reason: null,
                    paused_date: null,
                    status: 'ONGOING',
                })
                .eq('id', approval.instance_id);

            // Unlock the NEXT task
            await unlockNextTask(task, c);

            // Notify assigned user
            c.executionCtx.waitUntil((async () => {
                if (task.assigned_user_id) {
                    await sendNotification({
                        user_id: task.assigned_user_id,
                        type: 'task_completed',
                        title: 'Client approved! 🎉',
                        message: `The client has approved the deliverable for "${task.title}". The next task is now unlocked.`,
                        task_id: task.id,
                        instance_id: approval.instance_id,
                        company_id: companyId,
                        sent_by: userId,
                    }, c.env);
                }
            })().catch(err => console.error('Client approval notification error:', err)));

        } else {
            // ── CLIENT REJECTED ───────────────────────────────────────────────
            // Calculate a fresh due date for the reopened task
            const dueDate = task.turnaround_minutes > 0
                ? await addWorkingMinutes(new Date(), task.turnaround_minutes, companyId, c.env)
                : null;

            // Re-open the same task → IN_PROGRESS with client comment
            await supabase
                .from('tasks')
                .update({
                    status: 'IN_PROGRESS',
                    assigned_at: now,
                    due_date: dueDate,
                    submitted_at: null,
                    last_rejection_comment: comment?.trim() || 'Client requested changes.',
                    last_rejected_by: userId,
                    last_rejected_at: now,
                    current_level: 1,
                })
                .eq('id', task.id);

            // Reset approval levels for this task
            await supabase
                .from('task_approval_levels')
                .update({ status: 'PENDING', acted_at: null, comment: null })
                .eq('task_id', task.id);

            // Reset checklist
            await supabase
                .from('task_checklist_progress')
                .update({ is_checked: false })
                .eq('task_id', task.id);

            // Resume instance (worker should now start revising)
            await supabase
                .from('instances')
                .update({
                    is_paused: false,
                    pending_client_approval: false,
                    client_approval_task_id: null,
                    pause_reason: null,
                    paused_date: null,
                    status: 'ONGOING',
                })
                .eq('id', approval.instance_id);

            // Notify assigned user with the client's comment
            c.executionCtx.waitUntil((async () => {
                if (task.assigned_user_id) {
                    await sendNotification({
                        user_id: task.assigned_user_id,
                        type: 'task_rejected',
                        title: 'Client requested changes ↩',
                        message: `The client has rejected the deliverable for "${task.title}". Feedback: "${comment?.trim() || 'No comment provided.'}". Please revise and resubmit.`,
                        task_id: task.id,
                        instance_id: approval.instance_id,
                        company_id: companyId,
                        sent_by: userId,
                    }, c.env);
                }
            })().catch(err => console.error('Client rejection notification error:', err)));
        }

        return c.json({
            message: action === 'APPROVED'
                ? 'Client approval recorded. Instance resumed and next task unlocked.'
                : 'Client rejection recorded. Task reopened for revision.',
        }, 200);

    } catch (err) {
        console.error('Resolve Client Approval Error:', err);
        return c.json({ message: 'Internal Server Error' }, 500);
    }
};

/**
 * GET /api/client-approvals/count
 * Lightweight count of PENDING client approvals for the company (for the stats card)
 */
export const countPendingClientApprovals = async (c) => {
    try {
        const companyId = c.get('user').company_id;
        const supabase = getSupabase(c.env);

        const { count, error } = await supabase
            .from('client_approvals')
            .select('id', { count: 'exact', head: true })
            .eq('company_id', companyId)
            .eq('status', 'PENDING');

        if (error) return c.json({ message: error.message }, 400);
        return c.json({ count: count || 0 }, 200);
    } catch (err) {
        return c.json({ message: 'Internal Server Error' }, 500);
    }
};
