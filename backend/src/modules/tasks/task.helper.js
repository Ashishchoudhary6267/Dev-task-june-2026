import { getSupabase } from "../../config/supabase.js";
import { calculateWorkingMinutes, addWorkingMinutes } from "../../utils/businessCalendar.js";
import { sendNotification } from "../../utils/notify.js";

export async function unlockNextTask(currentTask, cOrEnv) {
    if (!currentTask.instance_id) return;

    const isContext = cOrEnv && typeof cOrEnv.get === 'function' && cOrEnv.env;
    const env = isContext ? cOrEnv.env : (cOrEnv || {});
    const supabase = getSupabase(env);

    const { data: nextTask } = await supabase
        .from("tasks")
        .select("id, status, turnaround_minutes, worker_allocated_minutes, assigned_user_id")
        .eq("instance_id", currentTask.instance_id)
        .eq("task_order", currentTask.task_order + 1)
        .single();

    if (nextTask && nextTask.status === "LOCKED") {
        const { data: inst } = await supabase
            .from("instances")
            .select("company_id, name")
            .eq("id", currentTask.instance_id)
            .single();

        const finalTurnaround = nextTask.turnaround_minutes > 0 ? nextTask.turnaround_minutes : 0;
        const workerAllocated = nextTask.worker_allocated_minutes ?? finalTurnaround;
        
        const dueDate = (workerAllocated > 0)
            ? await addWorkingMinutes(new Date(), workerAllocated, inst?.company_id, env)
            : null;
        
        const overallDueDate = (finalTurnaround > 0)
            ? await addWorkingMinutes(new Date(), finalTurnaround, inst?.company_id, env)
            : null;

        await supabase
            .from("tasks")
            .update({
                status: "IN_PROGRESS",
                assigned_at: new Date().toISOString(),
                due_date: dueDate,
                original_due_date: dueDate,
                overall_due_date: overallDueDate,
                total_working_minutes: 0
            })
            .eq("id", nextTask.id);

        if (nextTask.assigned_user_id) {
            const { data: fullNext } = await supabase
                .from("tasks")
                .select("title")
                .eq("id", nextTask.id)
                .single();

            await sendNotification({
                user_id: nextTask.assigned_user_id,
                type: 'task_assigned',
                title: 'Your next task is now active',
                message: `"${fullNext?.title || 'Your task'}" in "${inst?.name || 'the instance'}" has been unlocked. Please start working on it.`,
                task_id: nextTask.id,
                instance_id: currentTask.instance_id,
                company_id: inst?.company_id || null,
            }, cOrEnv);
        }
    }

    const { data: allTasks } = await supabase
        .from("tasks")
        .select("status")
        .eq("instance_id", currentTask.instance_id);

    if (allTasks && allTasks.every(t => t.status === "COMPLETED")) {
        await supabase
            .from("instances")
            .update({ status: "COMPLETED" })
            .eq("id", currentTask.instance_id);

        // ── Recurrence: spawn the next occurrence on completion ─────────────
        const { data: completedInst } = await supabase
            .from("instances")
            .select("*")
            .eq("id", currentTask.instance_id)
            .single();

        if (completedInst?.recurrence_interval) {
            const intervalDaysMap = {
                '1 week':   7,
                '1 month':  30,
                '3 months': 90,
                '6 months': 180,
            };
            const daysToAdd = intervalDaysMap[completedInst.recurrence_interval] || 30;
            const nextDate = new Date();
            nextDate.setDate(nextDate.getDate() + daysToAdd);
            const nextScheduledAt = nextDate.toISOString().split('T')[0];

            // Respect end date if set
            if (!completedInst.recurrence_end_date || nextScheduledAt <= completedInst.recurrence_end_date) {
                // Clone the instance as SCHEDULED
                const { data: newInst } = await supabase
                    .from("instances")
                    .insert({
                        project_id: completedInst.project_id,
                        client_id: completedInst.client_id,
                        name: completedInst.name,
                        status: 'SCHEDULED',
                        is_scheduled: true,
                        scheduled_at: nextScheduledAt,
                        created_by: completedInst.created_by,
                        company_id: completedInst.company_id,
                        recurrence_interval: completedInst.recurrence_interval,
                        recurrence_end_date: completedInst.recurrence_end_date || null,
                        parent_instance_id: completedInst.id,
                    })
                    .select()
                    .single();

                if (newInst) {
                    // Fetch tasks (with checklist + approvals) from completed instance
                    const { data: originalTasks } = await supabase
                        .from("tasks")
                        .select("*, task_checklist_progress(*), task_approval_levels(*)")
                        .eq("instance_id", completedInst.id)
                        .order("task_order", { ascending: true });

                    for (const t of (originalTasks || [])) {
                        const { data: clonedTask } = await supabase
                            .from("tasks")
                            .insert({
                                project_id: t.project_id,
                                instance_id: newInst.id,
                                task_order: t.task_order,
                                title: t.title,
                                description: t.description || null,
                                assigned_role: t.assigned_role,
                                assigned_user_id: t.assigned_user_id || null,
                                approval_required: t.approval_required,
                                approval_levels: t.approval_levels,
                                current_level: 1,
                                status: 'LOCKED',
                                estimated_minutes: t.estimated_minutes,
                                turnaround_minutes: t.turnaround_minutes,
                                company_id: t.company_id,
                                worker_time_percentage: t.worker_time_percentage || 70,
                                worker_allocated_minutes: t.worker_allocated_minutes
                            })
                            .select()
                            .single();

                        if (clonedTask) {
                            const checklistRows = (t.task_checklist_progress || []).map(item => ({
                                task_id: clonedTask.id,
                                item_text: item.item_text,
                                sort_order: item.sort_order,
                                is_checked: false,
                                requires_input: item.requires_input,
                                input_label: item.input_label || null,
                                input_placeholder: item.input_placeholder || null,
                            }));
                            if (checklistRows.length > 0) {
                                await supabase.from("task_checklist_progress").insert(checklistRows);
                            }

                            const approvalRows = (t.task_approval_levels || []).map(a => ({
                                task_id: clonedTask.id,
                                level_number: a.level_number,
                                approver_id: a.approver_id || null,
                                status: 'PENDING',
                                allocated_minutes: a.allocated_minutes
                            }));
                            if (approvalRows.length > 0) {
                                await supabase.from("task_approval_levels").insert(approvalRows);
                            }
                        }
                    }
                }
            }
        }
        // ── End recurrence ────────────────────────────────────────────────
    }
}