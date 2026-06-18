import { getSupabase } from "../../config/supabase.js";
import { unlockNextTask } from "./task.helper.js";
import { calculateWorkingMinutes, addWorkingMinutes } from "../../utils/businessCalendar.js";
import { sendNotification } from "../../utils/notify.js";

export const bypassTaskController = async (c) => {
    try {
        const taskId = c.req.param('id');
        const { reason, action } = await c.req.json();
        const user = c.get("user");
        const controllerId = user.id;
        const company_id = user.company_id;

        if (!reason) return c.json({ message: "Reason is required" }, 400);

        const supabase = getSupabase(c.env);
        const { data: task, error: taskError } = await supabase
            .from("tasks")
            .select("*")
            .eq("id", taskId)
            .eq("company_id", company_id)
            .single();

        if (taskError || !task) return c.json({ message: "Task not found" }, 404);

        const { data: updated, error: updateError } = await supabase
            .from("tasks")
            .update({ status: "COMPLETED" })
            .eq("id", taskId)
            .select()
            .single();

        if (updateError) return c.json({ message: updateError.message }, 400);

        await unlockNextTask(updated, c);

        const { error: logError } = await supabase.from("task_bypass_logs").insert({
            task_id: taskId,
            action: action || "BYPASS",
            from_user_id: task.assigned_user_id,
            from_step: task.task_order,
            to_step: task.task_order + 1,
            performed_by: controllerId,
            reason: reason,
            company_id: company_id,
        });

        if (logError) console.error("Error writing to task_bypass_logs:", logError);

        return c.json({ message: "Task bypassed and marked complete", task: updated }, 200);
    } catch (err) {
        console.error("Bypass Error:", err);
        return c.json({ message: "Internal Server Error" }, 500);
    }
};

export const reassigntaskbycontroller = async (c) => {
    try {
        const taskId = c.req.param('id');
        const { assignee_id, reason, applyToAll } = await c.req.json();
        const user = c.get("user");
        const controllerId = user.id;
        const company_id = user.company_id;

        if (!assignee_id) return c.json({ message: "assignee_id is required" }, 400);
        if (!reason) return c.json({ message: "reason is required" }, 400);

        const supabase = getSupabase(c.env);
        const { data: task, error: taskError } = await supabase
            .from("tasks")
            .select("*")
            .eq("id", taskId)
            .eq("company_id", company_id)
            .single();

        if (taskError || !task) return c.json({ message: "Task not found" }, 404);
        if (task.assigned_user_id === assignee_id) return c.json({ message: "Cannot reassign to the same person" }, 400);

        const targetTasks = [task];
        if (applyToAll && task.project_id) {
            const { data: otherTasks } = await supabase.from('tasks')
                .select('*')
                .eq('company_id', company_id)
                .eq('project_id', task.project_id)
                .eq('title', task.title)
                .in('status', ['LOCKED'])
                .neq('id', taskId);
            
            if (otherTasks && otherTasks.length > 0) {
                targetTasks.push(...otherTasks);
            }
        }

        const reassignmentLogs = [];
        const taskIds = [];

        for (const t of targetTasks) {
            const oldAssignee = t.assigned_user_id;

            const { data: updated, error } = await supabase
                .from("tasks")
                .update({ assigned_user_id: assignee_id })
                .eq("id", t.id)
                .select()
                .single();

            if (error) {
                console.error(`Failed to reassign task ${t.id}:`, error);
                continue;
            }

            taskIds.push(t.id);

            const { error: logError } = await supabase.from("task_reassignments").insert({
                task_id: t.id,
                from_user_id: oldAssignee,
                to_user_id: assignee_id,
                reassigned_by: controllerId,
                reason: reason,
                company_id: company_id,
            });

            if (logError) console.error("Error writing to task_reassignments:", logError);

            reassignmentLogs.push({
                task_id: t.id,
                task_title: t.title,
                from_user_id: oldAssignee,
                to_user_id: assignee_id,
                status: t.status,
            });
        }

        // Log controller action for project-level audit trail
        if (task.project_id) {
            const { error: projectLogError } = await supabase.from("project_action_logs").insert({
                project_id: task.project_id,
                action_type: applyToAll ? 'BULK_TASK_REASSIGNMENT' : 'TASK_REASSIGNMENT',
                performed_by: controllerId,
                details: {
                    primary_task_id: taskId,
                    primary_task_title: task.title,
                    from_user_id: task.assigned_user_id,
                    to_user_id: assignee_id,
                    reason: reason,
                    apply_to_all: applyToAll,
                    tasks_affected: reassignmentLogs,
                    total_tasks_updated: targetTasks.length,
                },
                company_id: company_id,
            });

            if (projectLogError) console.error("Error writing to project_action_logs:", projectLogError);
        }

        return c.json({ 
            message: applyToAll 
                ? `Task reassigned across ${targetTasks.length} instance(s)` 
                : "Task reassigned",
            tasksUpdated: targetTasks.length,
            taskIds: taskIds,
        }, 200);
    } catch (err) {
        console.error("Reassign Error:", err);
        return c.json({ message: "Internal server error" }, 500);
    }
};

export const extendTaskSLA = async (c) => {
    try {
        const taskId = c.req.param('id');
        const { new_deadline, reason } = await c.req.json();
        const user = c.get("user");
        const controllerId = user.id;
        const company_id = user.company_id;

        if (!new_deadline) return c.json({ message: "new_deadline is required" }, 400);
        if (!reason || reason.trim().length < 20) return c.json({ message: "reason must be at least 20 characters" }, 400);
        if (new Date(new_deadline) <= new Date()) return c.json({ message: "New deadline must be in the future" }, 400);

        const supabase = getSupabase(c.env);
        const { data: task, error: taskError } = await supabase
            .from("tasks")
            .select("id, due_date, original_due_date, status, assigned_user_id, current_level")
            .eq("id", taskId)
            .eq("company_id", company_id)
            .single();

        if (taskError || !task) return c.json({ message: "Task not found" }, 404);

        let extended_for_role = "WORKER";
        let approval_level_id = null;
        let updated = null;

        if (task.status === "PENDING_APPROVAL") {
            // --- Approver level: find the currently active pending approval level ---
            const currentLevel = task.current_level ?? 1;

            const { data: activeLevel, error: levelError } = await supabase
                .from("task_approval_levels")
                .select("id, due_date, original_due_date, level_number")
                .eq("task_id", taskId)
                .eq("level_number", currentLevel)
                .eq("status", "PENDING")
                .single();

            if (levelError || !activeLevel) {
                return c.json({ message: "No active approval level found for this task" }, 404);
            }

            extended_for_role = "APPROVER";
            approval_level_id = activeLevel.id;

            // Update the approval level's due_date, preserve original_due_date
            const approvalPayload = {
                due_date: new_deadline,
                ...(!activeLevel.original_due_date && { original_due_date: activeLevel.due_date }),
            };

            const { error: approvalUpdateError } = await supabase
                .from("task_approval_levels")
                .update(approvalPayload)
                .eq("id", activeLevel.id);

            if (approvalUpdateError) return c.json({ message: approvalUpdateError.message }, 400);

            // Delta-push the overall task due_date so it stays consistent
            const oldDeadline = activeLevel.due_date ? new Date(activeLevel.due_date) : new Date(task.due_date);
            const delta = new Date(new_deadline).getTime() - oldDeadline.getTime();
            const newTaskDueDate = new Date(new Date(task.due_date).getTime() + delta);

            const { data: updatedTask, error: taskUpdateError } = await supabase
                .from("tasks")
                .update({ due_date: newTaskDueDate.toISOString() })
                .eq("id", taskId)
                .select()
                .single();

            if (taskUpdateError) return c.json({ message: taskUpdateError.message }, 400);
            updated = updatedTask;

        } else {
            // --- Worker level: update task's due_date directly ---
            const updatePayload = {
                due_date: new_deadline,
                ...(!task.original_due_date && { original_due_date: task.due_date }),
            };

            const { data: updatedTask, error: updateError } = await supabase
                .from("tasks")
                .update(updatePayload)
                .eq("id", taskId)
                .select()
                .single();

            if (updateError) return c.json({ message: updateError.message }, 400);
            updated = updatedTask;
        }

        // Audit log
        const { error: logError } = await supabase.from("task_sla_extensions").insert({
            task_id: taskId,
            old_deadline: task.due_date,
            new_deadline: new_deadline,
            reason: reason.trim(),
            requested_by: controllerId,
            company_id: company_id,
            approval_level_id,
            extended_for_role,
        });

        if (logError) throw logError;

        return c.json({ message: "SLA extended successfully", task: updated, extended_for_role }, 200);
    } catch (err) {
        console.error("Extend SLA Error:", err);
        return c.json({ message: "Internal server error" }, 500);
    }
};


// when admin deactivates a user
export const reassignapproverbycontroller = async (c) => {
    try {
        const taskId = c.req.param('id');
        const { old_approver_id, new_approver_id, reason } = await c.req.json();
        const user = c.get("user");
        const controllerId = user.id;
        const company_id = user.company_id;

        if (!old_approver_id || !new_approver_id) return c.json({ message: "Both old_approver_id and new_approver_id are required" }, 400);

        const supabase = getSupabase(c.env);

        // 1. Verify task belongs to company
        const { data: task, error: taskError } = await supabase
            .from("tasks")
            .select("id")
            .eq("id", taskId)
            .eq("company_id", company_id)
            .single();

        if (taskError || !task) return c.json({ message: "Task not found" }, 404);

        // 2. Update task_approval_levels for this specific task and old_approver
        const { data: updated, error: updateError } = await supabase
            .from("task_approval_levels")
            .update({ approver_id: new_approver_id })
            .eq("task_id", taskId)
            .eq("approver_id", old_approver_id)
            .select();

        if (updateError) return c.json({ message: updateError.message }, 400);
        if (!updated || updated.length === 0) return c.json({ message: "Approval level not found for this user and task" }, 404);

        // 3. Log the reassignment
        const { error: logError } = await supabase.from("task_reassignments").insert({
            task_id: taskId,
            from_user_id: old_approver_id,
            to_user_id: new_approver_id,
            reassigned_by: controllerId,
            reason: reason || `Approver reassignment due to user deactivation`,
            company_id: company_id,
        });

        if (logError) console.error("Error writing to task_reassignments (approver):", logError);

        return c.json({ message: "Approver reassigned successfully", data: updated }, 200);
    } catch (err) {
        console.error("Reassign Approver Error:", err);
        return c.json({ message: "Internal server error" }, 500);
    }
};

export const addTaskComment = async (c) => {
    try {

        const taskId = c.req.param('id');
        const { comment } = await c.req.json();
        const user = c.get("user");
        const company_id = user.company_id;



        if (!comment || comment.trim().length === 0) {
            return c.json({ message: "Comment cannot be empty" }, 400);
        }

        const supabase = getSupabase(c.env);

        // 1. Fetch current task to get existing comments
        const { data: task, error: taskError } = await supabase
            .from("tasks")
            .select("comments, company_id")
            .eq("id", taskId)
            .single();

        if (taskError || !task) return c.json({ message: "Task not found" }, 404);

        // Security check: ensure task belongs to user's company
        if (task.company_id !== company_id) return c.json({ message: "Unauthorized access to task" }, 403);

        const currentComments = Array.isArray(task.comments) ? task.comments : [];
        const newComment = {
            id: crypto.randomUUID(),
            text: comment.trim(),
            author_id: user.id,
            author_name: user.name,
            author_role: user.platform_role,
            created_at: new Date().toISOString()
        };

        const { data: updated, error: updateError } = await supabase
            .from("tasks")
            .update({
                comments: [...currentComments, newComment],
                updated_at: new Date().toISOString()
            })
            .eq("id", taskId)
            .select()
            .single();

        if (updateError) return c.json({ message: updateError.message }, 400);

        return c.json({ message: "Comment added successfully", comment: newComment, task: updated }, 200);
    } catch (err) {
        console.error("Add Comment Error:", err);
        return c.json({ message: "Internal server error" }, 500);
    }
};

export const manualUnlockTask = async (c) => {
    try {
        const taskId = c.req.param('id');
        const { reason } = await c.req.json();
        const user = c.get("user");
        const controllerId = user.id;
        const companyId = user.company_id;

        if (!reason) return c.json({ message: "Reason is required" }, 400);

        const supabase = getSupabase(c.env);

        // 1. Fetch task details
        const { data: task, error: taskError } = await supabase
            .from("tasks")
            .select("id, status, turnaround_minutes, assigned_user_id, task_order, instance_id, title")
            .eq("id", taskId)
            .eq("company_id", companyId)
            .single();

        if (taskError || !task) return c.json({ message: "Task not found" }, 404);
        if (task.status !== "LOCKED") return c.json({ message: "Task is not LOCKED. Cannot manually unlock." }, 400);

        // 2. Fetch instance details for calculating due date
        const { data: inst } = await supabase
            .from("instances")
            .select("name")
            .eq("id", task.instance_id)
            .single();

        // 3. Calculate due date
        const dueDate = (task.turnaround_minutes > 0)
            ? await addWorkingMinutes(new Date(), task.turnaround_minutes, companyId, c.env)
            : null;

        const assignedAt = new Date().toISOString();

        // 4. Update Task Status
        const { data: updated, error: updateError } = await supabase
            .from("tasks")
            .update({
                status: "IN_PROGRESS",
                assigned_at: assignedAt,
                due_date: dueDate,
                original_due_date: dueDate,
                total_working_minutes: 0
            })
            .eq("id", taskId)
            .select()
            .single();

        if (updateError) return c.json({ message: updateError.message }, 400);

        // 5. Send Notification
        if (task.assigned_user_id) {
            c.executionCtx.waitUntil((async () => {
                await sendNotification({
                    user_id: task.assigned_user_id,
                    type: 'task_assigned',
                    title: 'Task Unlocked Early',
                    message: `"${task.title}" in "${inst?.name || 'the instance'}" has been manually unlocked. Please start working on it.`,
                    task_id: task.id,
                    instance_id: task.instance_id,
                    company_id: companyId,
                    sent_by: controllerId,
                }, c);
            })().catch(err => console.error("Manual Unlock notification error:", err)));
        }

        // 6. Log to task_bypass_logs (with action = 'UNLOCK')
        const { error: logError } = await supabase.from("task_bypass_logs").insert({
            task_id: taskId,
            action: "UNLOCK",
            from_user_id: task.assigned_user_id,
            from_step: task.task_order,
            to_step: task.task_order, // indicates same step, no bypass
            performed_by: controllerId,
            reason: reason,
            company_id: companyId,
        });

        if (logError) console.error("Error writing to task_bypass_logs (Unlock):", logError);

        return c.json({ message: "Task unlocked successfully", task: updated }, 200);
    } catch (err) {
        console.error("Manual Unlock Error:", err);
        return c.json({ message: "Internal Server Error" }, 500);
    }
};

export const updateTaskApprovalLevels = async (c) => {
    try {
        const taskId = c.req.param('id');
        const { levels, reason, applyToAll } = await c.req.json();
        const user = c.get("user");
        const controllerId = user.id;
        const companyId = user.company_id;

        if (!reason || reason.trim().length === 0) return c.json({ message: "Reason is required" }, 400);
        if (!Array.isArray(levels) || levels.length === 0) return c.json({ message: "At least one approver level is required" }, 400);

        const supabase = getSupabase(c.env);

        // Fetch task
        const { data: task, error: taskError } = await supabase
            .from("tasks")
            .select("*")
            .eq("id", taskId)
            .eq("company_id", companyId)
            .single();

        if (taskError || !task) return c.json({ message: "Task not found" }, 404);

        const targetTasks = [task];
        if (applyToAll && task.project_id) {
            const { data: otherTasks } = await supabase.from('tasks')
                .select('*')
                .eq('company_id', companyId)
                .eq('project_id', task.project_id)
                .eq('title', task.title)
                .neq('status', 'COMPLETED')
                .neq('id', taskId);
            
            if (otherTasks && otherTasks.length > 0) {
                targetTasks.push(...otherTasks);
            }
        }

        // intended sequence by level_number (1-indexed)
        const intendedLevels = levels.sort((a, b) => a.level_number - b.level_number);

        for (const t of targetTasks) {
            // Fetch existing levels for this task
            const { data: existingLevels, error: levelsError } = await supabase
                .from("task_approval_levels")
                .select("*")
                .eq("task_id", t.id)
                .order('level_number', { ascending: true });
                
            if (levelsError) continue;

            const logsToInsert = [];
            const idsToDelete = [];

            // If it's the primary task, we do strict validation (as before)
            if (t.id === taskId) {
                let validationFailed = false;
                for (const approvedLevel of existingLevels.filter(l => l.status === 'APPROVED' || l.status === 'REJECTED')) {
                    const foundInPayload = intendedLevels.find(l => l.level_number === approvedLevel.level_number);
                    if (!foundInPayload) {
                        return c.json({ message: "Cannot delete an already acted upon level" }, 400);
                    }
                    if (foundInPayload.approver_id !== approvedLevel.approver_id) {
                        return c.json({ message: "Cannot change the approver of an already acted upon level" }, 400);
                    }
                }
            }

            // Determine pending levels to delete (ones whose level_number > intended sequence length)
            for (const el of existingLevels) {
                if (el.status === 'PENDING' && el.level_number > intendedLevels.length) {
                    idsToDelete.push(el.id);
                    logsToInsert.push({
                         task_id: t.id,
                         from_user_id: el.approver_id,
                         to_user_id: controllerId,
                         reassigned_by: controllerId,
                         reason: (reason ? reason + ' ' : '') + '(Approval Level Removed)',
                         company_id: companyId,
                    });
                }
            }

            if (idsToDelete.length > 0) {
                await supabase.from("task_approval_levels").delete().in("id", idsToDelete);
            }

            const finalTurnaround = t.turnaround_minutes > 0 ? t.turnaround_minutes : 0;
            const workerAllocated = t.worker_allocated_minutes ?? finalTurnaround;
            let approverAllocated = 0;
            const numLevels = intendedLevels.length;
            if (numLevels > 0) {
                approverAllocated = Math.round((finalTurnaround - workerAllocated) / numLevels);
            }

            // Upsert intended levels
            for (let i = 0; i < intendedLevels.length; i++) {
                const levelPayload = intendedLevels[i];
                const level_number = i + 1;
                
                const existingLevel = existingLevels.find(l => l.level_number === level_number);

                if (existingLevel) {
                    const updatePayload = { allocated_minutes: approverAllocated };
                    if (existingLevel.status === 'PENDING' && existingLevel.approver_id !== levelPayload.approver_id) {
                        logsToInsert.push({
                            task_id: t.id,
                            from_user_id: existingLevel.approver_id,
                            to_user_id: levelPayload.approver_id,
                            reassigned_by: controllerId,
                            reason: reason,
                            company_id: companyId,
                        });
                        updatePayload.approver_id = levelPayload.approver_id;
                    }
                    await supabase.from("task_approval_levels").update(updatePayload).eq("id", existingLevel.id);
                } else {
                    // Insert new level
                    logsToInsert.push({
                        task_id: t.id,
                        from_user_id: controllerId,
                        to_user_id: levelPayload.approver_id,
                        reassigned_by: controllerId,
                        reason: reason || "New approval level added",
                        company_id: companyId,
                    });

                    await supabase.from("task_approval_levels").insert({
                        task_id: t.id,
                        company_id: companyId,
                        level_number: level_number,
                        approver_id: levelPayload.approver_id,
                        status: 'PENDING',
                        allocated_minutes: approverAllocated
                    });
                }
            }

            // Update task's approval_levels count to new length
            await supabase.from("tasks").update({ approval_levels: intendedLevels.length }).eq("id", t.id);

            if (logsToInsert.length > 0) {
                await supabase.from("task_reassignments").insert(logsToInsert);
            }

            // Auto-complete if all remaining levels are approved (e.g. if we deleted the only pending level)
            const { data: finalLevels } = await supabase.from("task_approval_levels").select("*").eq("task_id", t.id);
            const allApproved = finalLevels.length > 0 && finalLevels.every(l => l.status === 'APPROVED');
            
            if (allApproved && t.status === 'PENDING_APPROVAL') {
                await supabase.from("tasks").update({ status: "COMPLETED" }).eq("id", t.id);
                const { data: completedTask } = await supabase.from("tasks").select("*").eq("id", t.id).single();
                
                // Need to import unlockNextTask if it's not available, but it is available in this file.
                await unlockNextTask(completedTask, c);
            }
        }

        return c.json({ message: "Approval levels updated successfully" }, 200);

    } catch (err) {
        console.error("Update Approval Levels Error:", err);
        return c.json({ message: "Internal Server Error" }, 500);
    }
};

/**
 * POST /tasks/:id/reopen-for-revision
 *
 * A Controller can reopen a COMPLETED task when the client requests changes.
 * Effect:
 *  - The target task → IN_PROGRESS (checklist reset, approvals reset to PENDING)
 *  - All tasks with a higher task_order in the same instance → LOCKED
 *  - If the instance was COMPLETED, it is reverted to ONGOING
 *  - An audit entry is written to task_bypass_logs (action = 'CLIENT_REVISION')
 *  - Assigned user is notified
 */
export const reopenTaskForClientRevision = async (c) => {
    try {
        const taskId = c.req.param('id');
        const { reason, client_comment } = await c.req.json();
        const user = c.get('user');
        const controllerId = user.id;
        const company_id = user.company_id;

        if (!reason || reason.trim().length === 0) {
            return c.json({ message: 'Reason is required' }, 400);
        }

        const supabase = getSupabase(c.env);

        // 1. Fetch the target task
        const { data: task, error: taskError } = await supabase
            .from('tasks')
            .select('*')
            .eq('id', taskId)
            .eq('company_id', company_id)
            .single();

        if (taskError || !task) return c.json({ message: 'Task not found' }, 404);
        if (task.status !== 'COMPLETED') {
            return c.json({ message: 'Only COMPLETED tasks can be reopened for client revision' }, 400);
        }

        // 2. Fetch instance info for notification and status reset
        const { data: inst } = await supabase
            .from('instances')
            .select('id, name, status')
            .eq('id', task.instance_id)
            .single();

        // 3. Calculate a fresh due date for the task being reopened
        const dueDate = task.turnaround_minutes > 0
            ? await addWorkingMinutes(new Date(), task.turnaround_minutes, company_id, c.env)
            : null;

        // 4. Reset the target task → IN_PROGRESS
        const { data: updatedTask, error: updateError } = await supabase
            .from('tasks')
            .update({
                status: 'IN_PROGRESS',
                assigned_at: new Date().toISOString(),
                due_date: dueDate,
                submitted_at: null,
                last_rejection_comment: client_comment || null,
                current_level: 1,
                total_working_minutes: 0,
            })
            .eq('id', taskId)
            .select()
            .single();

        if (updateError) return c.json({ message: updateError.message }, 400);

        // 5. Reset all approval levels for this task → PENDING
        await supabase
            .from('task_approval_levels')
            .update({ status: 'PENDING' })
            .eq('task_id', taskId);

        // 6. Reset checklist progress to unchecked
        await supabase
            .from('task_checklist_progress')
            .update({ is_checked: false })
            .eq('task_id', taskId);

        // 7. Lock all downstream tasks (same instance, higher task_order)
        const { data: downstreamTasks } = await supabase
            .from('tasks')
            .select('id, status, task_order')
            .eq('instance_id', task.instance_id)
            .gt('task_order', task.task_order)
            .neq('status', 'LOCKED');

        if (downstreamTasks && downstreamTasks.length > 0) {
            const idsToLock = downstreamTasks.map(t => t.id);
            await supabase
                .from('tasks')
                .update({ status: 'LOCKED', assigned_at: null, due_date: null, submitted_at: null, current_level: 1 })
                .in('id', idsToLock);

            // Reset approval levels for locked downstream tasks
            await supabase
                .from('task_approval_levels')
                .update({ status: 'PENDING' })
                .in('task_id', idsToLock);

            // Reset checklists for locked downstream tasks
            await supabase
                .from('task_checklist_progress')
                .update({ is_checked: false })
                .in('task_id', idsToLock);
        }

        // 8. If the instance was COMPLETED, revert it to ONGOING
        if (inst && inst.status === 'COMPLETED') {
            await supabase
                .from('instances')
                .update({ status: 'ONGOING' })
                .eq('id', task.instance_id);
        }

        // 9. Audit log
        await supabase.from('task_bypass_logs').insert({
            task_id: taskId,
            action: 'CLIENT_REVISION',
            from_user_id: task.assigned_user_id,
            from_step: task.task_order,
            to_step: task.task_order,
            performed_by: controllerId,
            reason: reason.trim(),
            company_id: company_id,
        });

        // 10. Notify the assigned user
        if (task.assigned_user_id) {
            c.executionCtx.waitUntil((async () => {
                await sendNotification({
                    user_id: task.assigned_user_id,
                    type: 'task_assigned',
                    title: 'Task Reopened — Client Revision Required',
                    message: `"${task.title}" in "${inst?.name || 'the instance'}" has been reopened. The client has requested changes. Please restart the task.`,
                    task_id: task.id,
                    instance_id: task.instance_id,
                    company_id: company_id,
                    sent_by: controllerId,
                }, c);
            })().catch(err => console.error('Client revision notification error:', err)));
        }

        return c.json({
            message: 'Task reopened for client revision. All subsequent tasks have been locked.',
            task: updatedTask,
            locked_downstream: downstreamTasks?.length ?? 0,
        }, 200);
    } catch (err) {
        console.error('Client Revision Error:', err);
        return c.json({ message: 'Internal Server Error' }, 500);
    }
};

export const updateTaskNote = async (c) => {
    try {
        const taskId = c.req.param('id');
        const { notes } = await c.req.json();
        const user = c.get("user");
        const company_id = user.company_id;

        const supabase = getSupabase(c.env);

        // 1. Fetch current task to check company_id
        const { data: task, error: taskError } = await supabase
            .from("tasks")
            .select("company_id")
            .eq("id", taskId)
            .single();

        if (taskError || !task) return c.json({ message: "Task not found" }, 404);

        // Security check: ensure task belongs to user's company
        if (task.company_id !== company_id) return c.json({ message: "Unauthorized access to task" }, 403);

        const { data: updated, error: updateError } = await supabase
            .from("tasks")
            .update({
                notes: notes || null,
                updated_at: new Date().toISOString()
            })
            .eq("id", taskId)
            .select()
            .single();

        if (updateError) return c.json({ message: updateError.message }, 400);

        return c.json({ message: "Task notes updated successfully", task: updated }, 200);
    } catch (err) {
        console.error("Update Task Notes Error:", err);
        return c.json({ message: "Internal server error" }, 500);
    }
};

