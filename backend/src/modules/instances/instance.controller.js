import { getSupabase } from '../../config/supabase.js';
import { calculateWorkingMinutes, addWorkingMinutes } from '../../utils/businessCalendar.js';
import { sendNotification } from '../../utils/notify.js';
import { checkSubscriptionLimits } from '../../utils/subscription.js';

export const createInstance = async (c) => {
    try {
        const { project_id, client_id, name, scheduled_at, task_assignments, recurrence_interval, recurrence_end_date } = await c.req.json();
        const user = c.get("user");
        const controllerId = user.id;
        const company_id = user.company_id;
        const supabase = getSupabase(c.env);

        if (!project_id || !name) return c.json({ message: 'project_id and name are required' }, 400);
        if (!Array.isArray(task_assignments) || task_assignments.length === 0) return c.json({ message: 'task_assignments array is required' }, 400);

        await checkSubscriptionLimits(supabase, company_id, "instances");

        const isScheduled = !!(scheduled_at && new Date(scheduled_at) > new Date());
        const instanceStatus = isScheduled ? 'SCHEDULED' : 'ONGOING';

        // Recurrence is only meaningful if the instance will recur
        const hasRecurrence = !!(recurrence_interval);

        const { data: instance, error: instanceError } = await supabase
            .from('instances')
            .insert({
                project_id, client_id: client_id || null, company_id: company_id || null,
                name, status: instanceStatus, is_scheduled: isScheduled, scheduled_at: scheduled_at || null, created_by: controllerId,
                recurrence_interval: hasRecurrence ? recurrence_interval : null,
                recurrence_end_date: (hasRecurrence && recurrence_end_date) ? recurrence_end_date : null,
            })
            .select().single();

        if (instanceError) return c.json({ message: instanceError.message }, 400);

        await supabase.from("projects").update({ client_id: client_id }).eq("id", project_id);

        const createdTasks = [];
        for (let i = 0; i < task_assignments.length; i++) {
            const assignment = task_assignments[i];
            const { template_task_id, assigned_user_id, effort_minutes, turnaround_minutes, approvers = [], worker_time_percentage } = assignment;

            const { data: tmplTask, error: tmplError } = await supabase
                .from('template_tasks').select('*').eq('id', template_task_id).single();
            if (tmplError || !tmplTask) continue;

            const isFirstTask = (i === 0);
            const taskStatus = isScheduled ? 'LOCKED' : (isFirstTask ? 'IN_PROGRESS' : 'LOCKED');
            const workerAllocated = turnaround_minutes > 0 ? turnaround_minutes : 0;

            let totalApproverAllocated = 0;
            if (approvers && approvers.length > 0) {
                approvers.forEach(a => {
                    totalApproverAllocated += (a.allocated_minutes || 240); // default 4 hours if not passed
                });
            }

            const overallTurnaround = workerAllocated + totalApproverAllocated;

            const dueDate = (taskStatus === 'IN_PROGRESS' && workerAllocated > 0)
                ? await addWorkingMinutes(new Date(), workerAllocated, company_id, c.env)
                : null;
            const overallDueDate = (taskStatus === 'IN_PROGRESS' && overallTurnaround > 0)
                ? await addWorkingMinutes(new Date(), overallTurnaround, company_id, c.env)
                : null;

            const actualApprovalLevels = (tmplTask.approval_required && approvers.length > 0) ? approvers.length : (tmplTask.approval_levels || 1);

            const { data: task, error: taskError } = await supabase
                .from('tasks')
                .insert({
                    project_id, instance_id: instance.id, task_order: i + 1, title: tmplTask.title, description: tmplTask.description || null,
                    assigned_role: tmplTask.assigned_role || '', assigned_user_id: assigned_user_id || null, approval_required: tmplTask.approval_required || false,
                    approval_levels: actualApprovalLevels, current_level: 1, status: taskStatus, assigned_at: taskStatus === 'IN_PROGRESS' ? new Date().toISOString() : null,
                    estimated_minutes: effort_minutes || tmplTask.estimated_minutes, turnaround_minutes: workerAllocated, due_date: dueDate || null, company_id: company_id,
                    worker_time_percentage: null, worker_allocated_minutes: workerAllocated, overall_due_date: overallDueDate || null
                }).select().single();

            if (task && task.due_date) await supabase.from('tasks').update({ original_due_date: task.due_date }).eq('id', task.id);
            if (taskError) return c.json({ message: taskError.message }, 400);

            if (tmplTask.approval_required && approvers.length > 0) {
                const approvalRows = approvers.map(a => ({ task_id: task.id, level_number: a.level, approver_id: a.approver_id || null, status: 'PENDING', allocated_minutes: a.allocated_minutes || 240 }));
                await supabase.from('task_approval_levels').insert(approvalRows);
            }

            const { data: checklistItems } = await supabase
                .from('template_task_checklist_items').select('*').eq('template_task_id', template_task_id).order('sort_order', { ascending: true });

            if (checklistItems && checklistItems.length > 0) {
                const progressRows = checklistItems.map(item => ({ task_id: task.id, item_text: item.item_text, sort_order: item.sort_order, is_checked: false, requires_input: item.requires_input || false, input_label: item.input_label || null, input_placeholder: item.input_placeholder || null }));
                await supabase.from('task_checklist_progress').insert(progressRows);
            }

            if (task && task.status === 'IN_PROGRESS' && assigned_user_id) {
                await sendNotification({
                    user_id: assigned_user_id, type: 'task_assigned', title: 'New task assigned to you',
                    message: `"${tmplTask.title}" is now active in instance "${name}". Please start working on it.`,
                    task_id: task.id, instance_id: instance.id,
                    company_id: company_id, sent_by: controllerId,
                }, c);
            }
            createdTasks.push(task);
        }

        return c.json({ instance, tasks: createdTasks, count: createdTasks.length }, 201);
    } catch (error) {
        return c.json({ message: error.message }, 500);
    }
};

export const fetchInstances = async (c) => {
    try {
        const query_company_id = c.req.query('company_id');
        const user = c.get("user");
        const company_id = (user.platform_role === 'superadmin' && query_company_id) ? query_company_id : user.company_id;

        // ── Query Parameters ──────────────────────────────────────────────
        const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
        const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || '10', 10)));
        const offset = (page - 1) * limit;
        const search = (c.req.query('search') || '').trim().toLowerCase();
        const client_id = c.req.query('client_id') || null;
        const project_id = c.req.query('project_id') || null;
        const status = c.req.query('status') || null; // 'active' | 'scheduled' | 'paused' | 'completed'
        const from_date = c.req.query('from_date') || null;
        const to_date = c.req.query('to_date') || null;
        const has_rejected_task = c.req.query('has_rejected_task') === 'true';

        const supabase = getSupabase(c.env);

        let rejectedInstanceIds = null;
        if (has_rejected_task) {
            // Find instances that have at least one task with a rejection count > 0
            const { data: rejectedTasks } = await supabase.from('tasks').select('instance_id').eq('company_id', company_id).gt('rejection_count', 0);
            rejectedInstanceIds = [...new Set((rejectedTasks || []).map(t => t.instance_id))];
            
            if (rejectedInstanceIds.length === 0) {
                return c.json({
                    data: [], count: 0, page, limit, totalPages: 0,
                    statusCounts: { active: 0, scheduled: 0, paused: 0, completed: 0 }
                }, 200);
            }
        }

        // ── Helper: build a base query with all non-pagination filters ────
        const buildBaseQuery = (q) => {
            q = q.eq('company_id', company_id);

            // Status / sub-tab filter
            if (!search) {
                if (status === 'active') {
                    q = q.eq('status', 'ONGOING');
                } else if (status === 'scheduled') {
                    q = q.eq('status', 'SCHEDULED');
                } else if (status === 'paused') {
                    q = q.eq('is_paused', true);
                } else if (status === 'completed') {
                    q = q.eq('status', 'COMPLETED');
                }
            }

            // Client filter
            if (client_id) q = q.eq('client_id', client_id);

            // Project / template filter
            if (project_id) q = q.eq('project_id', project_id);

            // Date-range filter
            if (from_date) q = q.gte('created_at', new Date(from_date).toISOString());
            if (to_date) {
                const to = new Date(to_date);
                to.setHours(23, 59, 59, 999);
                q = q.lte('created_at', to.toISOString());
            }

            // Rejected tasks filter
            if (rejectedInstanceIds) {
                q = q.in('id', rejectedInstanceIds);
            }

            return q;
        };

        // ── Text search: resolve matching IDs first ───────────────────────
        // Supabase PostgREST doesn't support cross-table OR ilike in one step,
        // so we do a lightweight search query and collect instance IDs.
        let searchInstanceIds = null;
        if (search) {
            // Search by instance name directly
            const nameQ = buildBaseQuery(
                supabase.from('instances').select('id').ilike('name', `%${search}%`)
            );
            const { data: nameMatches } = await nameQ;
            const nameIds = (nameMatches || []).map(r => r.id);

            // Search by client name
            const { data: clientMatches } = await supabase.from('clients').select('id').ilike('name', `%${search}%`);
            const matchingClientIds = (clientMatches || []).map(r => r.id);
            let clientInstanceIds = [];
            if (matchingClientIds.length > 0) {
                const cQ = buildBaseQuery(
                    supabase.from('instances').select('id').in('client_id', matchingClientIds)
                );
                const { data: cd } = await cQ;
                clientInstanceIds = (cd || []).map(r => r.id);
            }

            // Search by project/template name
            const { data: projectMatches } = await supabase.from('projects').select('id').ilike('name', `%${search}%`);
            const matchingProjectIds = (projectMatches || []).map(r => r.id);
            let projectInstanceIds = [];
            if (matchingProjectIds.length > 0) {
                const pQ = buildBaseQuery(
                    supabase.from('instances').select('id').in('project_id', matchingProjectIds)
                );
                const { data: pd } = await pQ;
                projectInstanceIds = (pd || []).map(r => r.id);
            }

            // Union all matched IDs
            searchInstanceIds = [...new Set([...nameIds, ...clientInstanceIds, ...projectInstanceIds])];
            // If nothing matched, return empty result immediately
            if (searchInstanceIds.length === 0) {
                return c.json({
                    data: [], count: 0, page, limit, totalPages: 0,
                    statusCounts: { active: 0, scheduled: 0, paused: 0, completed: 0 }
                }, 200);
            }
        }

        // ── Count query (for total pages) ─────────────────────────────────
        let countQ = buildBaseQuery(supabase.from('instances').select('id', { count: 'exact', head: true }));
        if (searchInstanceIds) countQ = countQ.in('id', searchInstanceIds);
        const { count: totalCount, error: countError } = await countQ;
        if (countError) return c.json({ message: countError.message }, 400);

        // ── Status counts (for sub-tab badges) ───────────────────────────
        // Run 4 lightweight count queries; apply search filter if active
        const countFor = async (filterFn) => {
            let q = supabase.from('instances').select('id', { count: 'exact', head: true }).eq('company_id', company_id);
            q = filterFn(q);
            if (client_id) q = q.eq('client_id', client_id);
            if (project_id) q = q.eq('project_id', project_id);
            if (from_date) q = q.gte('created_at', new Date(from_date).toISOString());
            if (to_date) {
                const to = new Date(to_date); to.setHours(23, 59, 59, 999);
                q = q.lte('created_at', to.toISOString());
            }
            if (searchInstanceIds) q = q.in('id', searchInstanceIds);
            if (rejectedInstanceIds) q = q.in('id', rejectedInstanceIds);
            const { count } = await q;
            return count || 0;
        };

        const [activeCount, scheduledCount, pausedCount, completedCount] = await Promise.all([
            countFor(q => q.eq('status', 'ONGOING')),
            countFor(q => q.eq('status', 'SCHEDULED')),
            countFor(q => q.eq('is_paused', true)),
            countFor(q => q.eq('status', 'COMPLETED')),
        ]);

        // ── Sorting ──────────────────────────────────────────────────────
        const sortBy = c.req.query('sort_by') || 'created_at';
        const sortOrder = c.req.query('sort_order') || 'desc';
        const ascending = sortOrder === 'asc';

        // ── Main data query ───────────────────────────────────────────────
        let dataQ = buildBaseQuery(
            supabase.from('instances').select(`*, project:project_id(id, name), client:client_id(id, name), creator:created_by(id, name)`)
        );

        let paginatedProgressIds = null;

        if (sortBy === 'progress') {
            // Fetch all matching instance IDs to compute progress and sort in memory
            let allIdsQ = buildBaseQuery(supabase.from('instances').select('id'));
            if (searchInstanceIds) allIdsQ = allIdsQ.in('id', searchInstanceIds);
            
            const { data: allIdsData, error: allIdsError } = await allIdsQ;
            if (allIdsError) return c.json({ message: allIdsError.message }, 400);

            const allIds = (allIdsData || []).map(r => r.id);
            
            if (allIds.length === 0) {
                return c.json({
                    data: [], count: totalCount, page, limit, totalPages: Math.ceil(totalCount / limit),
                    statusCounts: { active: activeCount, scheduled: scheduledCount, paused: pausedCount, completed: completedCount }
                }, 200);
            }

            // Fetch task stats for all these IDs
            const { data: allTaskData } = await supabase
                .from('tasks').select('instance_id, status').in('instance_id', allIds);

            const statsMapProgress = {};
            allIds.forEach(id => statsMapProgress[id] = { total: 0, completed: 0 });

            (allTaskData || []).forEach(t => {
                if (statsMapProgress[t.instance_id]) {
                    statsMapProgress[t.instance_id].total++;
                    if (t.status === 'COMPLETED') statsMapProgress[t.instance_id].completed++;
                }
            });

            // Calculate progress and sort
            const progressArray = allIds.map(id => {
                const stats = statsMapProgress[id];
                const progress = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0;
                return { id, progress };
            });

            progressArray.sort((a, b) => {
                if (ascending) {
                    return a.progress - b.progress;
                } else {
                    return b.progress - a.progress;
                }
            });

            paginatedProgressIds = progressArray.map(item => item.id).slice(offset, offset + limit);
            
            if (paginatedProgressIds.length === 0) {
                return c.json({
                    data: [], count: totalCount, page, limit, totalPages: Math.ceil(totalCount / limit),
                    statusCounts: { active: activeCount, scheduled: scheduledCount, paused: pausedCount, completed: completedCount }
                }, 200);
            }
            
            dataQ = dataQ.in('id', paginatedProgressIds);

        } else {
            if (sortBy === 'template') {
                dataQ = dataQ.order('name', { foreignTable: 'project', ascending });
            } else if (sortBy === 'client') {
                dataQ = dataQ.order('name', { foreignTable: 'client', ascending });
            } else {
                // name, created_at, scheduled_at
                dataQ = dataQ.order(sortBy, { ascending });
            }

            dataQ = dataQ.range(offset, offset + limit - 1);
            if (searchInstanceIds) dataQ = dataQ.in('id', searchInstanceIds);
        }

        const { data, error } = await dataQ;
        if (error) return c.json({ message: error.message }, 400);

        let finalData = data || [];
        
        // If sorting by progress, re-order the fetched data to match paginatedProgressIds
        if (sortBy === 'progress' && paginatedProgressIds) {
             finalData.sort((a, b) => paginatedProgressIds.indexOf(a.id) - paginatedProgressIds.indexOf(b.id));
        }

        // ── Enrich with task stats ────────────────────────────────────────
        const instanceIds = finalData.map(i => i.id);
        let statsMap = {};
        if (instanceIds.length > 0) {
            const { data: taskData } = await supabase
                .from('tasks').select('instance_id, status').in('instance_id', instanceIds);

            (taskData || []).forEach(t => {
                if (!statsMap[t.instance_id]) statsMap[t.instance_id] = { total: 0, completed: 0 };
                statsMap[t.instance_id].total++;
                if (t.status === 'COMPLETED') statsMap[t.instance_id].completed++;
            });
        }

        const enriched = finalData.map(inst => ({ ...inst, task_stats: statsMap[inst.id] || { total: 0, completed: 0 } }));

        return c.json({
            data: enriched,
            count: totalCount,
            page,
            limit,
            totalPages: Math.ceil(totalCount / limit),
            statusCounts: { active: activeCount, scheduled: scheduledCount, paused: pausedCount, completed: completedCount }
        }, 200);
    } catch (error) {
        return c.json({ message: error.message }, 500);
    }
};


export const fetchInstanceById = async (c) => {
    try {
        const id = c.req.param('id');
        const user = c.get("user");
        const supabase = getSupabase(c.env);

        const { data: instance, error: instError } = await supabase
            .from('instances').select(`*, project:project_id(id, name), client:client_id(id, name), creator:created_by(id, name)`)
            .eq('id', id).eq('company_id', user.company_id).single();

        if (instError || !instance) return c.json({ message: 'Instance not found' }, 404);

        const { data: tasks, error: tasksError } = await supabase
            .from('tasks').select(`
                *, assigned_user:assigned_user_id(id, name, email), task_approval_levels(*, approver:approver_id(id, name, email)),
                task_checklist_progress(*), task_approval_history(*, actor:actor_id(id, name, email)),
                task_bypass_logs(id, action, from_step, to_step, reason, created_at, performer:performed_by(id, name)),
                task_reassignments(id, reason, created_at, from_user:from_user_id(id, name), to_user:to_user_id(id, name), reassigner:reassigned_by(id, name)),
                task_sla_extensions(id, old_deadline, new_deadline, reason, created_at, requester:requested_by(id, name))
            `)
            .eq('instance_id', id).order('task_order', { ascending: true });

        if (tasksError) return c.json({ message: tasksError.message }, 400);

        return c.json({ instance, tasks: (tasks || []).filter(t => !t.is_manual) }, 200);
    } catch (error) {
        return c.json({ message: error.message }, 500);
    }
};

export const fetchInstanceByTaskId = async (c) => {
    try {
        const task_id = c.req.param('task_id');
        const supabase = getSupabase(c.env);

        const { data, error } = await supabase.from('tasks').select(`*`).eq('id', task_id).single();
        if (error || !data) return c.json({ message: 'Task not found' }, 404);

        const { data: instance, error: instError } = await supabase
            .from('instances').select(`*, project:project_id(id, name), client:client_id(id, name), creator:created_by(id, name)`)
            .eq('id', data.instance_id).eq('company_id', c.get("user").company_id).single();

        if (instError || !instance) return c.json({ message: 'Instance not found' }, 404);

        const { data: tasks, error: tasksError } = await supabase
            .from('tasks').select(`
                *, assigned_user:assigned_user_id(id, name, email), task_approval_levels(*, approver:approver_id(id, name, email)),
                task_checklist_progress(*), task_approval_history(*, actor:actor_id(id, name, email))
            `)
            .eq('instance_id', data.instance_id).order('task_order', { ascending: true });

        return c.json({ instance, tasks: (tasks || []).filter(t => !t.is_manual) }, 200);
    } catch (error) {
        return c.json({ message: error.message }, 500);
    }
}

export const pauseInstance = async (c) => {
    try {
        const id = c.req.param('id');
        const { reason } = await c.req.json();
        const user = c.get("user");
        const supabase = getSupabase(c.env);

        const { data: instance, error: fetchError } = await supabase
            .from('instances').select('id, status, is_paused').eq('id', id).eq('company_id', user.company_id).single();

        if (fetchError || !instance) return c.json({ message: 'Instance not found' }, 404);
        if (instance.is_paused === true) return c.json({ message: 'Instance is already paused' }, 400);
        if (instance.status === 'COMPLETED') return c.json({ message: 'Cannot pause a completed instance' }, 400);

        const { error: updateError } = await supabase
            .from('instances').update({ is_paused: true, pause_reason: reason || null, status: 'PAUSED', paused_date: new Date().toISOString() }).eq('id', id);

        if (updateError) return c.json({ message: updateError.message }, 400);

        // Pause all tasks that are active (not COMPLETED or LOCKED/PAUSED)
        // They will be set to LOCKED status so they can be resumed later
        const { data: tasks, error: tasksError } = await supabase
            .from('tasks')
            .update({ status: 'LOCKED' })
            .eq('instance_id', id)
            .neq('status', 'COMPLETED')
            .eq('status', 'IN_PROGRESS');

        if (tasksError) return c.json({ message: tasksError.message }, 400);

        return c.json({ message: 'Instance paused successfully' }, 200);
    } catch (error) {
        return c.json({ message: error.message }, 500);
    }
};


export const resumeInstance = async (c) => {
    try {
        const id = c.req.param('id');
        const supabase = getSupabase(c.env);
        const user = c.get("user");
        const company_id = user.company_id;

        const { data: instance, error: fetchError } = await supabase
            .from('instances').select('id, name, status, is_paused').eq('id', id).eq('company_id', company_id).single();

        if (fetchError || !instance) return c.json({ message: 'Instance not found' }, 404);

        const isScheduled = instance.status === 'SCHEDULED';

        // Find the first task that is currently LOCKED
        const { data: firstTask, error: taskError } = await supabase
            .from('tasks')
            .select('*')
            .eq('instance_id', id)
            .eq('status', 'LOCKED')
            .order('task_order', { ascending: true })
            .limit(1)
            .single();

        // Update instance status
        await supabase.from('instances').update({
            is_paused: false,
            pause_reason: null,
            paused_date: null,
            status: "ONGOING",
            is_scheduled: false,
            scheduled_at: null
        }).eq('id', id);


        if (firstTask) {
            // Calculate due date for the first task
            const finalTurnaround = firstTask.turnaround_minutes > 0 ? firstTask.turnaround_minutes : 0;
            const workerAllocated = firstTask.worker_allocated_minutes ?? finalTurnaround;
            const dueDate = (workerAllocated > 0)
                ? await addWorkingMinutes(new Date(), workerAllocated, company_id, c.env)
                : null;
            const overallDueDate = (finalTurnaround > 0)
                ? await addWorkingMinutes(new Date(), finalTurnaround, company_id, c.env)
                : null;

            // Set the first locked task to IN_PROGRESS
            const { error: updateError } = await supabase.from('tasks').update({
                status: "IN_PROGRESS",
                assigned_at: new Date().toISOString(),
                due_date: dueDate,
                original_due_date: firstTask.original_due_date || dueDate,
                overall_due_date: firstTask.overall_due_date || overallDueDate
            }).eq('id', firstTask.id);

            if (updateError) return c.json({ message: updateError.message }, 400);

            // Notification for the assigned user
            if (firstTask.assigned_user_id) {
                await sendNotification({
                    user_id: firstTask.assigned_user_id,
                    type: isScheduled ? 'task_assigned' : 'instance_resumed',
                    title: isScheduled ? 'New task assigned to you' : 'Instance resumed',
                    message: isScheduled
                        ? `"${firstTask.title}" is now active in instance "${instance.name}". Please start working on it.`
                        : `Instance "${instance.name}" has been resumed. Your task "${firstTask.title}" is now active again.`,
                    task_id: firstTask.id,
                    instance_id: id,
                    company_id: company_id,
                    sent_by: user.id,
                }, c);
            }
        }


        return c.json({ message: isScheduled ? 'Instance activated successfully' : 'Instance resumed successfully' }, 200);
    } catch (error) {
        return c.json({ message: error.message }, 500);
    }
};


export const setInstanceActive = resumeInstance;

export const cloneInstance = async (c) => {
    try {
        const sourceInstanceId = c.req.param('id');
        const { newName, newClientId } = await c.req.json();
        const user = c.get("user");
        const company_id = user.company_id;
        const supabase = getSupabase(c.env);

        if (!newName) return c.json({ message: 'New instance name is required' }, 400);

        // 1. Fetch source instance
        const { data: sourceInstance, error: sourceError } = await supabase
            .from('instances').select('*').eq('id', sourceInstanceId).single();
        if (sourceError || !sourceInstance) return c.json({ message: 'Source instance not found' }, 404);

        // 2. Insert new instance
        const { data: newInstance, error: newError } = await supabase
            .from('instances')
            .insert({
                project_id: sourceInstance.project_id,
                client_id: newClientId || sourceInstance.client_id,
                company_id: company_id,
                name: newName,
                status: 'ONGOING',
                is_scheduled: false,
                created_by: user.id
            })
            .select().single();

        if (newError) return c.json({ message: newError.message }, 400);

        // 3. Get all tasks from source instance
        const { data: sourceTasks, error: tasksError } = await supabase
            .from('tasks')
            .select('*')
            .eq('instance_id', sourceInstanceId)
            .order('task_order', { ascending: true });

        if (tasksError) return c.json({ message: tasksError.message }, 400);

        // 4. Clone tasks
        const createdTasks = [];
        for (let i = 0; i < sourceTasks.length; i++) {
            const st = sourceTasks[i];
            const isFirst = (i === 0);
            const taskStatus = isFirst ? 'IN_PROGRESS' : 'LOCKED';
            const finalTurnaround = st.turnaround_minutes > 0 ? st.turnaround_minutes : 0;
            const workerAllocated = st.worker_allocated_minutes ?? finalTurnaround;
            const dueDate = (taskStatus === 'IN_PROGRESS' && workerAllocated > 0)
                ? await addWorkingMinutes(new Date(), workerAllocated, company_id, c.env)
                : null;
            const overallDueDate = (taskStatus === 'IN_PROGRESS' && finalTurnaround > 0)
                ? await addWorkingMinutes(new Date(), finalTurnaround, company_id, c.env)
                : null;

            const { data: newTask, error: newTaskError } = await supabase
                .from('tasks')
                .insert({
                    project_id: st.project_id,
                    instance_id: newInstance.id,
                    task_order: st.task_order,
                    title: st.title,
                    description: st.description,
                    assigned_role: st.assigned_role,
                    assigned_user_id: st.assigned_user_id,
                    approval_required: st.approval_required,
                    approval_levels: st.approval_levels,
                    current_level: 1,
                    status: taskStatus,
                    assigned_at: taskStatus === 'IN_PROGRESS' ? new Date().toISOString() : null,
                    estimated_minutes: st.estimated_minutes,
                    turnaround_minutes: finalTurnaround,
                    due_date: dueDate,
                    company_id: company_id,
                    worker_time_percentage: st.worker_time_percentage || 70,
                    worker_allocated_minutes: st.worker_allocated_minutes,
                    overall_due_date: overallDueDate
                })
                .select().single();

            if (newTaskError || !newTask) continue;

            if (newTask.due_date) await supabase.from('tasks').update({ original_due_date: newTask.due_date }).eq('id', newTask.id);

            // Fetch source checklist progress for this task
            const { data: stChecklists } = await supabase.from('task_checklist_progress').select('*').eq('task_id', st.id);
            if (stChecklists && stChecklists.length > 0) {
                const checkRows = stChecklists.map(item => ({
                    task_id: newTask.id,
                    item_text: item.item_text,
                    sort_order: item.sort_order,
                    is_checked: false,
                    requires_input: item.requires_input || false,
                    input_label: item.input_label || null,
                    input_placeholder: item.input_placeholder || null
                }));
                await supabase.from('task_checklist_progress').insert(checkRows);
            }

            // Fetch source approval levels for this task
            const { data: stApprovals } = await supabase.from('task_approval_levels').select('*').eq('task_id', st.id);
            if (stApprovals && stApprovals.length > 0) {
                const appRows = stApprovals.map(a => ({
                    task_id: newTask.id,
                    level_number: a.level_number,
                    approver_id: a.approver_id,
                    status: 'PENDING',
                    allocated_minutes: a.allocated_minutes
                }));
                await supabase.from('task_approval_levels').insert(appRows);
            }

            if (taskStatus === 'IN_PROGRESS' && newTask.assigned_user_id) {
                await sendNotification({
                    user_id: newTask.assigned_user_id, type: 'task_assigned', title: 'New task assigned to you',
                    message: `"${newTask.title}" is now active in cloned instance "${newName}". Please start working on it.`,
                    task_id: newTask.id, instance_id: newInstance.id,
                    company_id: company_id, sent_by: user.id,
                }, c);
            }
            createdTasks.push(newTask);
        }

        return c.json({ message: 'Instance cloned successfully', instance: newInstance, tasksCount: createdTasks.length }, 201);
    } catch (error) {
        return c.json({ message: error.message }, 500);
    }
};



export const updateInstanceName = async (c) => {
    try {
        const id = c.req.param('id');
        const { name } = await c.req.json();
        const user = c.get("user");
        const company_id = user.company_id;
        const supabase = getSupabase(c.env);

        if (!name) return c.json({ message: 'Instance name is required' }, 400);

        const { error } = await supabase
            .from('instances')
            .update({ name: name, updated_at: new Date().toISOString() })
            .eq('id', id)
            .eq('company_id', company_id);

        if (error) return c.json({ message: error.message }, 400);

        return c.json({ message: 'Instance name updated successfully' }, 200);
    } catch (error) {
        return c.json({ message: error.message }, 500);
    }
};