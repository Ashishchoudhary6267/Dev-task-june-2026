import { getSupabase } from '../../config/supabase.js';
import { sendNotification } from '../../utils/notify.js';
import { addWorkingMinutes } from '../../utils/businessCalendar.js';

/**
 * Auto TAT Extension Scheduler
 *
 * Finds all overdue tasks (worker & approver levels) and creates
 * TAT extension requests + controller review tasks automatically.
 *
 * Called every 5 minutes via Cloudflare scheduled() handler.
 */
export async function runOverdueCheck(env) {
    try {
        const supabase = getSupabase(env);
        console.log('[tat-scheduler] Starting overdue check...');

        let processed = 0;
        let skipped = 0;

        // ── 1. Find overdue WORKER tasks (IN_PROGRESS, due_date < now) ────────
        const { data: overdueTasks, error: taskError } = await supabase
            .from('tasks')
            .select('id, title, assigned_user_id, instance_id, project_id, company_id, due_date')
            .eq('status', 'IN_PROGRESS')
            .lt('due_date', new Date().toISOString())
            .not('assigned_user_id', 'is', null);

        if (taskError) {
            console.error('[tat-scheduler] Error fetching overdue worker tasks:', taskError.message);
        }

        // ── 2. Find overdue APPROVER levels (PENDING, due_date < now) ─────────
        const { data: overdueApprovals, error: approvalError } = await supabase
            .from('task_approval_levels')
            .select('id, task_id, approver_id, due_date, level_number')
            .eq('status', 'PENDING')
            .lt('due_date', new Date().toISOString())
            .not('approver_id', 'is', null)
            .not('due_date', 'is', null);

        if (approvalError) {
            console.error('[tat-scheduler] Error fetching overdue approval levels:', approvalError.message);
        }

        // ── 3. Process overdue worker tasks ───────────────────────────────────
        for (const task of (overdueTasks || [])) {
            try {
                const result = await processOverdueItem({
                    supabase,
                    env,
                    task_id: task.id,
                    task_title: task.title,
                    requested_by: task.assigned_user_id,
                    instance_id: task.instance_id,
                    project_id: task.project_id,
                    company_id: task.company_id,
                    extended_for_role: 'WORKER',
                    approval_level_id: null,
                });
                if (result === 'processed') processed++;
                else skipped++;
            } catch (err) {
                console.error(`[tat-scheduler] Error processing worker task ${task.id}:`, err.message);
            }
        }

        // ── 4. Process overdue approver levels ────────────────────────────────
        // Fetch parent task details for approver levels
        const approvalTaskIds = [...new Set((overdueApprovals || []).map(a => a.task_id))];
        let approvalTaskMap = {};
        if (approvalTaskIds.length > 0) {
            const { data: approvalTasks } = await supabase
                .from('tasks')
                .select('id, title, instance_id, project_id, company_id')
                .in('id', approvalTaskIds);
            if (approvalTasks) {
                approvalTaskMap = Object.fromEntries(approvalTasks.map(t => [t.id, t]));
            }
        }

        for (const level of (overdueApprovals || [])) {
            try {
                const parentTask = approvalTaskMap[level.task_id];
                if (!parentTask) continue;

                const result = await processOverdueItem({
                    supabase,
                    env,
                    task_id: level.task_id,
                    task_title: parentTask.title,
                    requested_by: level.approver_id,
                    instance_id: parentTask.instance_id,
                    project_id: parentTask.project_id,
                    company_id: parentTask.company_id,
                    extended_for_role: 'APPROVER',
                    approval_level_id: level.id,
                });
                if (result === 'processed') processed++;
                else skipped++;
            } catch (err) {
                console.error(`[tat-scheduler] Error processing approver level ${level.id}:`, err.message);
            }
        }

        console.log(`[tat-scheduler] Done. Processed: ${processed}, Skipped: ${skipped}`);
        return { processed, skipped };
    } catch (err) {
        console.error('[tat-scheduler] Fatal error:', err.message);
        return { processed: 0, skipped: 0 };
    }
}

/**
 * Process a single overdue task or approval level.
 * Returns 'processed' if a new request was created, 'skipped' if deduplication hit.
 */
async function processOverdueItem({
    supabase, env,
    task_id, task_title, requested_by,
    instance_id, project_id, company_id,
    extended_for_role, approval_level_id,
}) {
    // ── Deduplication: skip if PENDING auto-request already exists ────────────
    const { data: existingRequest } = await supabase
        .from('task_sla_extension_requests')
        .select('id')
        .eq('task_id', task_id)
        .eq('is_auto_generated', true)
        .eq('status', 'PENDING')
        .maybeSingle();

    if (existingRequest) {
        return 'skipped'; // Already pending, do nothing
    }

    // ── Get instance creator (the specific controller) ────────────────────────
    if (!instance_id) {
        console.warn(`[tat-scheduler] Task ${task_id} has no instance_id, skipping.`);
        return 'skipped';
    }

    const { data: instance } = await supabase
        .from('instances')
        .select('id, created_by')
        .eq('id', instance_id)
        .maybeSingle();

    if (!instance?.created_by) {
        console.warn(`[tat-scheduler] Instance ${instance_id} has no created_by, skipping.`);
        return 'skipped';
    }

    const controller_id = instance.created_by;

    // ── Get TAT review window from company settings ───────────────────────────
    const { data: tatSettings } = await supabase
        .from('company_tat_settings')
        .select('tat_review_deadline_hours')
        .eq('company_id', company_id)
        .maybeSingle();

    const reviewHours = tatSettings?.tat_review_deadline_hours ?? 4;
    const reviewMinutes = reviewHours * 60;

    // ── Calculate controller_deadline (working hours only) ────────────────────
    const controller_deadline = await addWorkingMinutes(
        new Date().toISOString(),
        reviewMinutes,
        company_id,
        env
    );

    // ── Insert TAT extension request ─────────────────────────────────────────
    const { data: newRequest, error: insertRequestError } = await supabase
        .from('task_sla_extension_requests')
        .insert({
            task_id,
            requested_by,
            reason: 'Auto-generated: Task is overdue',
            suggested_new_deadline: null, // Controller sets this after discussing
            company_id,
            status: 'PENDING',
            is_auto_generated: true,
            controller_id,
            controller_deadline,
            approval_level_id: approval_level_id || null,
            extended_for_role,
        })
        .select()
        .single();

    if (insertRequestError || !newRequest) {
        console.error(`[tat-scheduler] Failed to insert request for task ${task_id}:`, insertRequestError?.message);
        return 'skipped';
    }

    // ── Create controller review task in tasks table ──────────────────────────
    const { data: controllerTask, error: taskInsertError } = await supabase
        .from('tasks')
        .insert({
            title: `Review TAT Extension: ${task_title}`,
            description: `Auto-generated review task. A team member's task is overdue and requires your decision on a TAT extension.`,
            assigned_user_id: controller_id,
            due_date: controller_deadline,
            instance_id: null, // Keep it standalone so it doesn't clutter the instance pipeline
            project_id: null,
            company_id,
            status: 'IN_PROGRESS',
            is_manual: true,
            task_order: 1,
            assigned_at: new Date().toISOString(),
            estimated_minutes: reviewMinutes,
            turnaround_minutes: reviewMinutes,
            worker_allocated_minutes: reviewMinutes,
            overall_due_date: controller_deadline,
        })
        .select()
        .single();

    if (taskInsertError) {
        console.error(`[tat-scheduler] Failed to create controller task for request ${newRequest.id}:`, taskInsertError?.message);
        // Don't abort — request was created, just link is missing
    }

    // ── Link controller task to the request ──────────────────────────────────
    if (controllerTask?.id) {
        await supabase
            .from('task_sla_extension_requests')
            .update({ controller_task_id: controllerTask.id })
            .eq('id', newRequest.id);
    }

    // ── Notify the controller (only this controller, not all) ─────────────────
    const roleLabel = extended_for_role === 'APPROVER' ? '(Approver)' : '(Worker)';
    await sendNotification({
        user_id: controller_id,
        type: 'sla_extension_requested',
        title: '⚠️ TAT Extension Review Required',
        message: `A task "${task_title}" ${roleLabel} is overdue and requires your review. You have ${reviewHours} working hours to act.`,
        task_id,
        instance_id: instance_id || null,
        sent_by: requested_by,
        company_id,
    }, env);

    console.log(`[tat-scheduler] Created auto-request for task ${task_id} → controller ${controller_id}`);
    return 'processed';
}
