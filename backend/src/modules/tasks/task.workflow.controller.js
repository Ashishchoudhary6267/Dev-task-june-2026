import { getSupabase } from "../../config/supabase.js";
import { calculateWorkingMinutes, addWorkingMinutes } from "../../utils/businessCalendar.js";
import { sendNotification } from "../../utils/notify.js";
import { unlockNextTask } from "./task.helper.js";

export const submitTask = async (c) => {
    try {
        const taskId = c.req.param('id');
        const user = c.get("user");
        const userId = user.id;
        const companyId = user.company_id;
        const { links } = await c.req.json();
        const supabase = getSupabase(c.env);

        const { data: task, error: taskError } = await supabase
            .from("tasks").select("id,assigned_at,last_rejected_at,total_working_minutes,assigned_user_id,status,approval_required,title,instance_id,worker_allocated_minutes,turnaround_minutes,due_date,original_due_date")
            .eq("id", taskId).single();

        if (taskError || !task) return c.json({ message: "Task not found" }, 404);

        let cycleMinutes = 0;
        const startTime = task.last_rejected_at || task.assigned_at;
        if (startTime) {
            const companyId = user.company_id;
            if (companyId) {
                const { data: company } = await supabase.from('companies').select('*').eq('id', companyId).single();
                const { data: holidays } = await supabase.from('company_holidays').select('holiday_date').eq('company_id', companyId);

                cycleMinutes = calculateWorkingMinutes(
                    startTime, new Date().toISOString(), company || {}, holidays || []
                );
            }
        }

        const newTotalMinutes = (task.total_working_minutes || 0) + cycleMinutes;
        if (task.assigned_user_id !== userId) return c.json({ message: "You are not assigned to this task" }, 403);
        if (task.status !== "IN_PROGRESS" && task.status !== "REJECTED") return c.json({ message: `Cannot submit task with status: ${task.status}` }, 400);

        await supabase.from("tasks").update({
            links, submitted_at: new Date().toISOString(), total_working_minutes: newTotalMinutes
        }).eq("id", taskId);



        if (task.approval_required) {
            await supabase.from("task_approval_levels").update({ status: "PENDING", acted_at: null, comment: null }).eq("task_id", taskId);

            const { data: level1 } = await supabase.from('task_approval_levels').select('allocated_minutes, used_minutes').eq('task_id', taskId).eq('level_number', 1).single();
            const level1Allocated = level1?.allocated_minutes || 0;
            const level1Used = level1?.used_minutes || 0;
            const remainingMinutes = Math.max(0, level1Allocated - level1Used);

            let dueDate = null;
            if (remainingMinutes > 0) {
                dueDate = await addWorkingMinutes(new Date(), remainingMinutes, companyId, c.env);
            } else if (level1Used > 0) {
                dueDate = new Date().toISOString();
            }

            // Preserve the worker's original due_date before replacing it with the reviewer's deadline.
            // original_due_date is only set once — on the very first submission.
            const workerOriginalDueDate = task.original_due_date || task.due_date;

            const { data: updated, error: updateError } = await supabase
                .from("tasks")
                .update({
                    status: "PENDING_APPROVAL",
                    current_level: 1,
                    last_rejection_comment: null,
                    last_rejected_by: null,
                    last_rejected_at: null,
                    // Do NOT overwrite due_date — it stays as the worker's SLA deadline.
                    // The reviewer's deadline is stored per-level in task_approval_levels.due_date.
                    original_due_date: workerOriginalDueDate,
                })
                .eq("id", taskId).select().single();

            // Also update the approval level's due date
            await supabase.from("task_approval_levels").update({ due_date: dueDate }).eq("task_id", taskId).eq("level_number", 1);

            if (updateError) return c.json({ message: updateError.message }, 400);

            c.executionCtx.waitUntil((async () => {
                const { data: level1Approvers } = await supabase.from('task_approval_levels').select('approver_id').eq('task_id', taskId).eq('level_number', 1);
                const submitter = await supabase.from('users').select('name').eq('id', userId).single();
                const submitterName = submitter?.data?.name || 'A team member';

                if (level1Approvers && level1Approvers.length > 0) {
                    const notifRows = level1Approvers.map(a => ({
                        user_id: a.approver_id, type: 'submitted_for_review', title: 'Task submitted for your review',
                        message: `${submitterName} submitted "${task.title}" for approval. Please review it.`,
                        task_id: taskId, instance_id: task.instance_id || null,
                        company_id: companyId, sent_by: userId,
                    }));
                    await sendNotification(notifRows, c.env);
                }

                if (task.instance_id) {
                    const { data: inst } = await supabase.from('instances').select('created_by').eq('id', task.instance_id).single();
                    if (inst?.created_by) {
                        await sendNotification({
                            user_id: inst.created_by, type: 'submitted_for_review', title: `Task submitted for review`,
                            message: `${submitterName} submitted "${task.title}" for approval.`,
                            task_id: taskId, instance_id: task.instance_id,
                            company_id: companyId, sent_by: userId,
                        }, c.env);
                    }
                }
            })().catch(err => console.error("Background notification error in submitTask:", err)));

            return c.json({ message: "Task submitted for approval", task: updated }, 200);
        } else {
            // No approval required — mark directly as COMPLETED
            const completedAt = new Date().toISOString();
            const { data: updated, error: updateError } = await supabase
                .from("tasks")
                .update({ status: "COMPLETED", approved_at: completedAt })
                .eq("id", taskId)
                .select(`*, project:project_id(id, name), instance:instance_id(id, name), assigned_user:assigned_user_id(id, name, email)`)
                .single();

            if (updateError) return c.json({ message: updateError.message }, 400);

            // Fire notifications + performance log in the background
            c.executionCtx.waitUntil((async () => {
                const submitter = await supabase.from('users').select('name').eq('id', userId).single();
                const submitterName = submitter?.data?.name || 'A team member';

                // Notify the instance creator / controller
                if (task.instance_id) {
                    const { data: inst, error: insterror } = await supabase
                        .from('instances')
                        .select('created_by, client:client_id(name)')
                        .eq('id', task.instance_id)
                        .single();

                    if (insterror) {
                        console.log("error", insterror);

                    }

                    if (inst?.created_by && inst.created_by !== userId) {
                        const { data, error } = await sendNotification({
                            user_id: inst.created_by,
                            type: 'task_completed',
                            title: 'Task completed ✅',
                            message: `${submitterName} completed "${task.title}"${inst.client?.name ? ` for client "${inst.client.name}"` : ''}.`,
                            task_id: taskId,
                            instance_id: task.instance_id,
                            company_id: companyId,
                            sent_by: userId,
                        }, c.env);
                        if (error) {
                            console.log("error inserting notification", error)
                        }
                    }

                }

                // Performance log
                try {
                    const submissionTime = updated.submitted_at ? new Date(updated.submitted_at) : new Date(completedAt);
                    const deadlineTime = updated.due_date ? new Date(updated.due_date) : null;
                    const graceMinutes = updated.grace_period_minutes || 0;

                    let perfStatus = 'On-time';
                    if (deadlineTime) {
                        const effectiveDeadline = new Date(deadlineTime.getTime() + graceMinutes * 60000);
                        if (submissionTime > effectiveDeadline) perfStatus = 'Overdue';
                    }

                    await supabase.from('task_performance_logs').insert({
                        task_id: updated.id,
                        user_id: updated.assigned_user_id,
                        company_id: companyId,
                        project_name: updated.project?.name,
                        instance_name: updated.instance?.name,
                        task_title: updated.title,
                        assigned_at: updated.assigned_at,
                        submitted_at: updated.submitted_at,
                        approved_at: completedAt,
                        estimated_minutes: updated.estimated_minutes,
                        actual_working_minutes: newTotalMinutes,
                        status: perfStatus,
                        approver_comments: null,
                        deliverable_links: updated.links,
                    });
                } catch (snapError) {
                    console.error("Performance Snapshot Error (no-approval path):", snapError);
                }
            })().catch(err => console.error("Background notification error in submitTask (no-approval):", err)));

            await unlockNextTask(updated, c.env);
            return c.json({ message: "Task completed!", task: updated }, 200);
        }
    } catch (error) {
        return c.json({ message: error.message }, 500);
    }
};


export const approveTask = async (c) => {
    try {
        const user = c.get("user");
        const taskId = c.req.param("id");
        const body = await c.req.json().catch(() => ({}));
        const { comment, checklist_updates, requiresClientApproval } = body;
        const userId = user.id;
        const companyId = user.company_id;
        const supabase = getSupabase(c.env);


        const { data: task, error: taskError } = await supabase.from("tasks").select("title,status,current_level,approval_levels,company_id,submitted_at").eq("id", taskId).single();

        if (taskError || !task) return c.json({ message: "Task not found" }, 404);
        if (task.status !== "PENDING_APPROVAL") return c.json({ message: "Task is not pending approval" }, 400);

        const { data: levelRow, error: levelError } = await supabase
            .from("task_approval_levels").select("id,approver_id,used_minutes").eq("task_id", taskId).eq("level_number", task.current_level).single();

        if (levelError || !levelRow) return c.json({ message: "Approval level not found" }, 404);
        if (levelRow.approver_id !== userId) return c.json({ message: "You are not the approver for this level" }, 403);

        let startTimeForReview = task.submitted_at;
        if (task.current_level > 1) {
            const { data: prevLevel } = await supabase.from('task_approval_levels')
                .select('acted_at')
                .eq('task_id', taskId)
                .eq('level_number', task.current_level - 1)
                .single();
            startTimeForReview = prevLevel?.acted_at || task.submitted_at;
        }

        let reviewCycleMinutes = 0;
        if (startTimeForReview) {
            const { data: company } = await supabase.from('companies').select('*').eq('id', companyId).single();
            const { data: holidays } = await supabase.from('company_holidays').select('holiday_date').eq('company_id', companyId);
            reviewCycleMinutes = calculateWorkingMinutes(
                startTimeForReview, new Date().toISOString(), company || {}, holidays || []
            );
        }
        const newUsedMinutes = (levelRow.used_minutes || 0) + reviewCycleMinutes;

        await supabase.from('task_approval_history').insert({
            task_id: taskId, level_number: task.current_level, actor_id: userId, action: 'APPROVED', comment: comment || null,
        });

        await supabase.from("task_approval_levels").update({ status: "APPROVED", acted_at: new Date().toISOString(), used_minutes: newUsedMinutes, comment: comment || null }).eq("id", levelRow.id);

        const nextLevel = task.current_level + 1;
        const isLastLevel = nextLevel > task.approval_levels;
        console.log("current level", task.current_level);
        console.log("approval levels", task.approval_levels);
        console.log("next level", nextLevel);
        console.log("is last level", isLastLevel);


        if (isLastLevel) {
            const approvedAt = new Date().toISOString();
            const { data: updated, error: updateError } = await supabase
                .from("tasks").update({ status: "COMPLETED", approved_at: approvedAt }).eq("id", taskId)
                .select(`*, project:project_id(id, name), instance:instance_id(id, name), assigned_user:assigned_user_id(id, name, email)`)
                .single();

            if (updateError) return c.json({ message: updateError.message }, 400);

            // ── Check if client approval was explicitly requested ─────────────────
            const isClientMessageTask = requiresClientApproval === true;

            if (isClientMessageTask && updated.instance_id) {
                // 1. Create a client_approval record
                const { error: caError } = await supabase.from('client_approvals').insert({
                    instance_id: updated.instance_id,
                    task_id: taskId,
                    company_id: companyId,
                    status: 'PENDING',
                });
                if (caError) console.error('Error creating client_approval:', caError.message);

                // Invalidate dashboard stats cache so the stat card updates immediately
                await c.env.FMS_CACHE?.delete(`dashboard_stats_${companyId}`);

                // 2. Pause the instance and flag it as awaiting client approval
                await supabase.from('instances').update({
                    is_paused: true,
                    pending_client_approval: true,
                    client_approval_task_id: taskId,
                    pause_reason: 'Awaiting client approval',
                    paused_date: approvedAt,
                    status: 'PAUSED',
                }).eq('id', updated.instance_id);

                // 3. Notify the controller (instance creator) in the background
                c.executionCtx.waitUntil((async () => {
                    const { data: inst } = await supabase.from('instances').select('created_by, client:client_id(name)').eq('id', updated.instance_id).single();
                    if (inst?.created_by) {
                        await sendNotification({
                            user_id: inst.created_by,
                            type: 'task_completed',
                            title: '📬 Awaiting Client Approval',
                            message: `"${updated.title}" has been internally approved. The instance is now paused pending client feedback. Please log the client\'s decision in the Client Approvals tab.`,
                            task_id: taskId,
                            instance_id: updated.instance_id,
                            company_id: companyId,
                            sent_by: userId,
                        }, c.env);
                    }
                    // Notify the task assignee too
                    if (updated.assigned_user_id) {
                        await sendNotification({
                            user_id: updated.assigned_user_id,
                            type: 'task_completed',
                            title: 'Task approved ✅ — Awaiting client',
                            message: `"${updated.title}" has been fully approved. The instance is now paused while we await client feedback. You may be asked to send a follow-up.`,
                            task_id: taskId,
                            instance_id: updated.instance_id,
                            company_id: companyId,
                            sent_by: userId,
                        }, c.env);
                    }
                })().catch(err => console.error('Client approval pause notification error:', err)));

                return c.json({ message: 'Task approved. Instance paused — awaiting client approval.', task: updated, awaitingClientApproval: true }, 200);
            }
            // ── End client message task check ─────────────────────────────────

            c.executionCtx.waitUntil((async () => {
                if (updated.assigned_user_id) {
                    await sendNotification({
                        user_id: updated.assigned_user_id, type: 'task_completed', title: 'Your task has been approved ✅',
                        message: `"${updated.title}" has been fully approved and marked complete.`,
                        task_id: taskId, instance_id: updated.instance_id || null,
                        company_id: companyId, sent_by: userId,
                    }, c.env);
                }

                if (updated.instance_id) {
                    const { data: inst } = await supabase.from('instances').select('created_by, client:client_id(name)').eq('id', updated.instance_id).single();
                    if (inst?.created_by) {
                        await sendNotification({
                            user_id: inst.created_by, type: 'task_completed', title: 'Task fully approved & completed',
                            // Guard against null client with optional chaining
                            message: `Task "${updated.title}" of client "${inst.client?.name ?? 'N/A'}" for instance "${updated.instance?.name ?? ''}" has been fully approved by all levels and is now complete.`,
                            task_id: taskId, instance_id: updated.instance_id,
                            company_id: companyId, sent_by: userId,
                        }, c.env);
                    }
                }

                try {
                    const { data: approvalHistory } = await supabase.from('task_approval_history').select('comment, actor:actor_id(name)').eq('task_id', taskId).order('created_at', { ascending: true });
                    const combinedComments = (approvalHistory || []).filter(h => h.comment).map(h => `${h.actor?.name}: ${h.comment}`).join(' | ');

                    const actualWorkingMinutes = updated.total_working_minutes || 0;
                    const submissionTime = updated.submitted_at ? new Date(updated.submitted_at) : new Date(approvedAt);
                    const deadlineTime = updated.due_date ? new Date(updated.due_date) : null;
                    const graceMinutes = updated.grace_period_minutes || 0;

                    let perfStatus = 'On-time';
                    if (deadlineTime) {
                        const effectiveDeadline = new Date(deadlineTime.getTime() + graceMinutes * 60000);
                        if (submissionTime > effectiveDeadline) perfStatus = 'Overdue';
                    }

                    await supabase.from('task_performance_logs').insert({
                        task_id: updated.id, user_id: updated.assigned_user_id, company_id: companyId,
                        project_name: updated.project?.name, instance_name: updated.instance?.name,
                        task_title: updated.title, assigned_at: updated.assigned_at,
                        submitted_at: updated.submitted_at, approved_at: approvedAt,
                        estimated_minutes: updated.estimated_minutes,
                        actual_working_minutes: actualWorkingMinutes, status: perfStatus,
                        approver_comments: combinedComments, deliverable_links: updated.links
                    });
                } catch (snapError) { console.error("Performance Snapshot Error:", snapError); }
            })().catch(err => console.error("Background approval processing error:", err)));

            await unlockNextTask(updated, c);
            return c.json({ message: "Task fully approved and completed!", task: updated }, 200);
        } else {
            const { data: nextLevelRow } = await supabase.from('task_approval_levels').select('allocated_minutes, used_minutes').eq('task_id', taskId).eq('level_number', nextLevel).single();
            const nextAllocated = nextLevelRow?.allocated_minutes || 0;
            const nextUsed = nextLevelRow?.used_minutes || 0;
            const remainingMinutes = Math.max(0, nextAllocated - nextUsed);
            
            let dueDate = null;
            if (remainingMinutes > 0) {
                dueDate = await addWorkingMinutes(new Date(), remainingMinutes, companyId, c.env);
            } else if (nextUsed > 0) {
                dueDate = new Date().toISOString();
            }

            const { data: updated, error: updateError } = await supabase
                .from("tasks").update({ current_level: nextLevel, due_date: dueDate }).eq("id", taskId).select().single();

            // Also update the next approval level's due date
            await supabase.from("task_approval_levels").update({ due_date: dueDate }).eq("task_id", taskId).eq("level_number", nextLevel);

            if (updateError) return c.json({ message: updateError.message }, 400);

            c.executionCtx.waitUntil((async () => {
                const { data: nextLevelApprovers } = await supabase.from('task_approval_levels').select('approver_id').eq('task_id', taskId).eq('level_number', nextLevel);
                if (nextLevelApprovers && nextLevelApprovers.length > 0) {
                    const approver = await supabase.from('users').select('name').eq('id', userId).single();
                    const approverName = approver?.data?.name || 'An approver';
                    const notifRows = nextLevelApprovers.map(a => ({
                        user_id: a.approver_id, type: 'submitted_for_review', title: `Task awaiting your approval (Level ${nextLevel})`,
                        message: `${approverName} approved Level ${task.current_level} for "${task.title}". It now needs your Level ${nextLevel} approval.`,
                        task_id: taskId, instance_id: task.instance_id || null,
                        company_id: companyId, sent_by: userId,
                    }));
                    await sendNotification(notifRows, c.env);
                }

                // Also notify the instance controller so they see live progress
                if (task.instance_id) {
                    const { data: inst } = await supabase.from('instances').select('created_by').eq('id', task.instance_id).single();
                    if (inst?.created_by && inst.created_by !== userId) {
                        const approver = await supabase.from('users').select('name').eq('id', userId).single();
                        const approverName = approver?.data?.name || 'An approver';
                        await sendNotification({
                            user_id: inst.created_by,
                            type: 'submitted_for_review',
                            title: `Approval Level ${task.current_level} completed`,
                            message: `${approverName} approved Level ${task.current_level} of "${task.title}". Now awaiting Level ${nextLevel} approval.`,
                            task_id: taskId, instance_id: task.instance_id,
                            company_id: companyId, sent_by: userId,
                        }, c.env);
                    }
                }
            })().catch(err => console.error("Background notification error in middle approval:", err)));


            return c.json({ message: `Level ${task.current_level} approved. Awaiting Level ${nextLevel} approval.`, task: updated }, 200);
        }
    } catch (error) {
        return c.json({ message: error.message }, 500);
    }
};

export const rejectTask = async (c) => {
    try {
        const taskId = c.req.param('id');
        const user = c.get("user");
        const userId = user.id;
        const companyId = user.company_id;
        const { comment } = await c.req.json();
        const supabase = getSupabase(c.env);

        if (!comment || comment.trim().length === 0) {
            return c.json({ message: "Rejection comment is required" }, 400);
        }

        const { data: task, error: taskError } = await supabase.from("tasks").select("id,status,current_level,assigned_user_id,instance_id,title,rejection_count,worker_allocated_minutes,total_working_minutes,submitted_at,due_date,original_due_date").eq("id", taskId).single();

        if (taskError || !task) return c.json({ message: "Task not found" }, 404);
        if (task.status !== "PENDING_APPROVAL") return c.json({ message: "Task is not pending approval" }, 400);

        const { data: levelRow } = await supabase.from("task_approval_levels").select("id,approver_id,used_minutes").eq("task_id", taskId).eq("level_number", task.current_level).single();

        if (!levelRow || levelRow.approver_id !== userId) return c.json({ message: "You are not the approver for this level" }, 403);

        let startTimeForReview = task.submitted_at;
        if (task.current_level > 1) {
            const { data: prevLevel } = await supabase.from('task_approval_levels')
                .select('acted_at')
                .eq('task_id', taskId)
                .eq('level_number', task.current_level - 1)
                .single();
            startTimeForReview = prevLevel?.acted_at || task.submitted_at;
        }

        let reviewCycleMinutes = 0;
        if (startTimeForReview) {
            const { data: company } = await supabase.from('companies').select('*').eq('id', companyId).single();
            const { data: holidays } = await supabase.from('company_holidays').select('holiday_date').eq('company_id', companyId);
            reviewCycleMinutes = calculateWorkingMinutes(
                startTimeForReview, new Date().toISOString(), company || {}, holidays || []
            );
        }
        const newUsedMinutes = (levelRow.used_minutes || 0) + reviewCycleMinutes;

        await supabase.from('task_approval_history').insert({
            task_id: taskId, level_number: task.current_level, actor_id: userId, action: 'REJECTED', comment: comment || null,
        });

        await supabase.from("task_approval_levels").update({ status: "REJECTED", acted_at: new Date().toISOString(), used_minutes: newUsedMinutes, comment: comment }).eq("id", levelRow.id);

        const rejectionInfo = { last_rejection_comment: comment || null, last_rejected_by: userId, last_rejected_at: new Date().toISOString() };

        await supabase.from("task_approval_levels").update({ status: "PENDING", acted_at: null, comment: null }).eq("task_id", taskId);

        const workerRemaining = Math.max(0, (task.worker_allocated_minutes || task.turnaround_minutes || 0) - (task.total_working_minutes || 0));
        let dueDate = task.original_due_date;
        if (workerRemaining > 0) {
            dueDate = await addWorkingMinutes(new Date(), workerRemaining, companyId, c.env);
        } else if ((task.total_working_minutes || 0) > 0) {
            dueDate = new Date().toISOString();
        }

        const { data: updated, error: updateError } = await supabase
            .from("tasks").update({ 
                status: "IN_PROGRESS", 
                current_level: 1, 
                submitted_at: null,
                due_date: dueDate, 
                rejection_count: (task.rejection_count || 0) + 1, 
                ...rejectionInfo 
            }).eq("id", taskId).select().single();

        if (updateError) return c.json({ message: updateError.message }, 400);

        c.executionCtx.waitUntil((async () => {
            if (task.assigned_user_id) {
                const rejecter = await supabase.from('users').select('name').eq('id', userId).single();
                const rejecterName = rejecter?.data?.name || 'An approver';
                await sendNotification({
                    user_id: task.assigned_user_id, type: 'task_rejected', title: 'Your task was returned ↩',
                    message: `${rejecterName} returned "${task.title}" with feedback. Please review the comments and resubmit.`,
                    task_id: taskId, instance_id: task.instance_id || null,
                    company_id: companyId, sent_by: userId,
                }, c.env);
            }

            if (task.instance_id) {
                const { data: inst } = await supabase.from('instances').select('created_by').eq('id', task.instance_id).single();
                const rejecter = await supabase.from('users').select('name').eq('id', userId).single();
                const rejecterName = rejecter?.data?.name || 'An approver';
                if (inst?.created_by) {
                    await sendNotification({
                        user_id: inst.created_by, type: 'task_rejected', title: 'Task returned to worker',
                        message: `${rejecterName} rejected "${task.title}" and sent it back to the assignee for rework.`,
                        task_id: taskId, instance_id: task.instance_id,
                        company_id: companyId, sent_by: userId,
                    }, c.env);
                }
            }
        })().catch(err => console.error("Background rejection notification error:", err)));

        return c.json({ message: "Task rejected. Sent back to worker.", task: updated }, 200);
    } catch (error) {
        return c.json({ message: error.message }, 500);
    }
}

export const toggleChecklistItem = async (c) => {
    try {
        const taskId = c.req.param('id');
        const itemId = c.req.param('itemId');
        const { is_checked, input_value, status, reviewer_comments } = await c.req.json();
        const supabase = getSupabase(c.env);

        const updatePayload = {};
        if (is_checked !== undefined) updatePayload.is_checked = is_checked;
        if (input_value !== undefined) updatePayload.input_value = input_value;
        if (status !== undefined) updatePayload.status = status;
        if (reviewer_comments !== undefined) updatePayload.reviewer_comments = reviewer_comments;

        const { data, error } = await supabase
            .from("task_checklist_progress").update(updatePayload).eq("id", itemId).eq("task_id", taskId).select().single();

        if (error) return c.json({ message: error.message }, 400);
        return c.json(data, 200);
    } catch (error) {
        return c.json({ message: error.message }, 500);
    }
};