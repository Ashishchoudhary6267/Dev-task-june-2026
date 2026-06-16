import { getSupabase } from '../config/supabase.js';
import { sendNotification } from '../utils/notify.js';
import { addWorkingMinutes } from '../utils/businessCalendar.js';

/**
 * Daily cron handler — runs at 10:00 AM UTC.
 *
 * For every PENDING client_approval that hasn't had a follow-up in the past 23 hours,
 * send a reminder notification to the original task's assignee,
 * telling them to send a follow-up email to the client, and create a duplicate task.
 */
export async function handleFollowUpCron(env) {
    try {
        const supabase = getSupabase(env);

        const twentyThreeHoursAgo = new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString();

        // Fetch all PENDING approvals that are due for a follow-up
        const { data: pendingApprovals, error } = await supabase
            .from('client_approvals')
            .select('id, task_id, instance_id, company_id, follow_up_count, last_follow_up_at')
            .eq('status', 'PENDING')
            .or(`last_follow_up_at.is.null,last_follow_up_at.lt.${twentyThreeHoursAgo}`);

        if (error) {
            console.error('[followup-cron] Error fetching pending approvals:', error.message);
            return;
        }

        if (!pendingApprovals || pendingApprovals.length === 0) {
            console.log('[followup-cron] No pending approvals require follow-up today.');
            return;
        }

        console.log(`[followup-cron] Processing ${pendingApprovals.length} pending client approval(s). Filtering by company working days...`);

        // Group by company_id to fetch company settings and check working days
        const companyIds = [...new Set(pendingApprovals.map(a => a.company_id).filter(Boolean))];
        let companyWorkingDayMap = {};

        if (companyIds.length > 0) {
            const { data: companies } = await supabase
                .from('companies')
                .select('id, working_days')
                .in('id', companyIds);

            const { data: holidays } = await supabase
                .from('company_holidays')
                .select('company_id, holiday_date')
                .in('company_id', companyIds);

            if (companies) {
                const TZ = 'Asia/Kolkata';
                const todayDate = new Date();
                const todayDayName = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: TZ }).format(todayDate);
                const todayDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(todayDate);

                companies.forEach(company => {
                    const workingDays = company.working_days || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
                    const companyHolidays = holidays 
                        ? holidays.filter(h => h.company_id === company.id).map(h => h.holiday_date)
                        : [];
                        
                    const isWorkingDay = workingDays.includes(todayDayName) && !companyHolidays.includes(todayDateStr);
                    companyWorkingDayMap[company.id] = isWorkingDay;
                });
            }
        }

        for (const approval of pendingApprovals) {
            try {
                // Skip if today is not a working day for the company
                if (approval.company_id && companyWorkingDayMap[approval.company_id] === false) {
                    console.log(`[followup-cron] Skipping approval ${approval.id} because today is not a working day for company ${approval.company_id}.`);
                    continue;
                }

                // Get the original task details (instead of the first task)
                const { data: messageTask } = await supabase
                    .from('tasks')
                    .select('id, title, assigned_user_id, approval_required, approval_levels, project_id, estimated_minutes, turnaround_minutes, priority')
                    .eq('id', approval.task_id)
                    .single();

                if (!messageTask || !messageTask.assigned_user_id) {
                    console.warn(`[followup-cron] Original task or assignee not found for approval ${approval.id}, skipping.`);
                    continue;
                }

                const followUpNumber = approval.follow_up_count + 1;

                // Send reminder notification to the task's assignee
                await sendNotification({
                    user_id: messageTask.assigned_user_id,
                    type: 'follow_up_reminder',
                    title: `📧 Client Follow-Up Reminder #${followUpNumber}`,
                    message: `Please send a follow-up email to the client regarding "${messageTask.title || 'the deliverable'}". The client has not yet responded.`,
                    task_id: messageTask.id,
                    instance_id: approval.instance_id,
                    company_id: approval.company_id,
                }, env);

                // Create Ad-hoc Follow-up Task identical to the original
                try {
                    // Get exactly the original approvers
                    let originalApprovers = [];
                    if (messageTask.approval_required) {
                        const { data } = await supabase
                            .from('task_approval_levels')
                            .select('level_number, approver_id')
                            .eq('task_id', approval.task_id)
                            .order('level_number', { ascending: true });
                        if (data) originalApprovers = data;
                    }

                    const newApprovalRequired = originalApprovers.length > 0;
                    const newApprovalLevels = newApprovalRequired ? originalApprovers.length : 1;

                    // Calculate due date using businessCalendar
                    const turnaround = messageTask.turnaround_minutes || 60; // default 1 hour if not set
                    const newDueDate = await addWorkingMinutes(new Date().toISOString(), turnaround, approval.company_id, env);

                    // Create manual task with "Follow-up" category indicator in title
                    const { data: manualTask, error: manualTaskError } = await supabase
                        .from('tasks')
                        .insert({
                            is_manual: true,
                            instance_id: approval.instance_id,
                            company_id: approval.company_id,
                            title: `Follow Up: ${messageTask.title || 'Client'}`,
                            description: `Automated follow-up task. The client has not responded yet.`,
                            assigned_user_id: messageTask.assigned_user_id,
                            priority: messageTask.priority || 'high',
                            estimated_minutes: messageTask.estimated_minutes || 30,
                            turnaround_minutes: turnaround,
                            due_date: newDueDate,
                            approval_required: newApprovalRequired,
                            approval_levels: newApprovalLevels,
                            current_level: 1,
                            status: 'IN_PROGRESS',
                            task_order: 1,
                            assigned_at: new Date().toISOString(),
                            project_id: messageTask.project_id || null
                        })
                        .select().single();

                    if (!manualTaskError && manualTask && newApprovalRequired) {
                        const approvalRows = originalApprovers.map(a => ({
                            task_id: manualTask.id,
                            level_number: a.level_number,
                            approver_id: a.approver_id,
                            status: 'PENDING'
                        }));
                        await supabase.from('task_approval_levels').insert(approvalRows);
                    }
                } catch (taskErr) {
                    console.error('[followup-cron] Error creating duplicate follow-up task:', taskErr.message);
                }

                // Update the follow-up tracking columns
                await supabase
                    .from('client_approvals')
                    .update({
                        follow_up_count: followUpNumber,
                        last_follow_up_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', approval.id);

                console.log(`[followup-cron] Follow-up #${followUpNumber} sent for approval ${approval.id}`);
            } catch (innerErr) {
                console.error(`[followup-cron] Error processing approval ${approval.id}:`, innerErr.message);
            }
        }

        console.log('[followup-cron] Done.');
    } catch (err) {
        console.error('[followup-cron] Fatal error:', err.message);
    }
}
