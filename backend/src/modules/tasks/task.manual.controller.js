import { getSupabase } from "../../config/supabase.js";
import { sendNotification } from "../../utils/notify.js";

export const createManualTask = async (c) => {
    try {
        const user = c.get("user");
        const controllerId = user.id;
        const company_id = user.company_id;
        const {
            title, description, assigned_user_id, priority = 'medium',
            estimated_minutes, turnaround_minutes = 0, due_date,
            approval_required = false, approval_levels = 1, approvers = [],
            project_id
        } = await c.req.json();

        if (!title || !assigned_user_id) return c.json({ message: 'title and assigned_user_id are required' }, 400);

        const supabase = getSupabase(c.env);

        const { data: task, error: taskError } = await supabase
            .from('tasks')
            .insert({
                is_manual: true, company_id, title, description: description || null,
                assigned_user_id, priority, estimated_minutes: estimated_minutes || 0,
                turnaround_minutes, due_date: due_date || null, approval_required,
                approval_levels: approval_required ? approval_levels : 1, current_level: 1,
                status: 'IN_PROGRESS', task_order: 1, assigned_at: new Date().toISOString(),
                project_id: project_id,
            })
            .select().single();

        if (taskError) return c.json({ message: taskError.message }, 400);

        if (task.due_date) await supabase.from('tasks').update({ original_due_date: task.due_date }).eq('id', task.id);

        if (approval_required && approvers.length > 0) {
            const approvalRows = approvers.map(a => ({ task_id: task.id, level_number: a.level, approver_id: a.approver_id || null, status: 'PENDING' }));
            await supabase.from('task_approval_levels').insert(approvalRows);
        }


        // Fire notification in the background so the 201 response is not delayed.
        // Cloudflare Workers can kill a request that takes too long in the critical path,
        // so push sending (an outbound HTTP call) must happen via waitUntil.
        c.executionCtx.waitUntil((async () => {
            await sendNotification({
                user_id: assigned_user_id,
                type: 'task_assigned',
                title: 'New task assigned to you',
                message: `You have been assigned a new task: "${title}". Please check your dashboard.`,
                task_id: task.id,
                instance_id: null,
                sent_by: controllerId,
                company_id: company_id,
            }, c.env);
        })().catch(err => console.error('[createManualTask] notification error:', err)));

        return c.json({ message: 'Manual task created', task }, 201);
    } catch (error) {
        return c.json({ message: error.message }, 500);
    }
};

export const fetchManualTasks = async (c) => {
    try {
        const company_id = c.get("user").company_id;
        const supabase = getSupabase(c.env);

        const { data, error } = await supabase
            .from('tasks')
            .select(`*, assigned_user:assigned_user_id(id, name, email), task_approval_levels(*, approver:approver_id(id, name, email)), task_checklist_progress(*)`)
            .eq('is_manual', true).eq('company_id', company_id).order('created_at', { ascending: false });

        if (error) return c.json({ message: error.message }, 400);
        return c.json({ data, count: data.length }, 200);
    } catch (error) {
        return c.json({ message: error.message }, 500);
    }
};

export const updateManualTask = async (c) => {
    try {
        const id = c.req.param('id');
        const { title, description, priority, estimated_minutes, turnaround_minutes, due_date, status } = await c.req.json();

        const updatePayload = {};
        if (title !== undefined) updatePayload.title = title;
        if (description !== undefined) updatePayload.description = description;
        if (priority !== undefined) updatePayload.priority = priority;
        if (estimated_minutes !== undefined) updatePayload.estimated_minutes = estimated_minutes;
        if (turnaround_minutes !== undefined) updatePayload.turnaround_minutes = turnaround_minutes;
        if (due_date !== undefined) updatePayload.due_date = due_date || null;
        if (status !== undefined) updatePayload.status = status;

        const supabase = getSupabase(c.env);
        const { data, error } = await supabase
            .from('tasks').update(updatePayload).eq('id', id).eq('is_manual', true)
            .eq('company_id', c.get("user").company_id).select().single();

        if (error) return c.json({ message: error.message }, 400);
        return c.json({ message: 'Task updated', task: data }, 200);
    } catch (error) {
        return c.json({ message: error.message }, 500);
    }
};

export const deleteManualTask = async (c) => {
    try {
        const id = c.req.param('id');
        const supabase = getSupabase(c.env);
        const { error } = await supabase
            .from('tasks').delete().eq('id', id).eq('is_manual', true).eq('company_id', c.get("user").company_id);

        if (error) return c.json({ message: error.message }, 400);
        return c.json({ message: 'Task deleted' }, 200);
    } catch (error) {
        return c.json({ message: error.message }, 500);
    }
};
