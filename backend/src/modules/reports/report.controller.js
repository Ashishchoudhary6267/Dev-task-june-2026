import { getSupabase } from '../../config/supabase.js';

export const getUserActivityReport = async (c) => {
    try {
        const { user_id, range, from, to } = c.req.query();

        if (!user_id) return c.json({ message: 'user_id is required' }, 400);

        let fromISO, toISO, label;
        const now = new Date();

        if (range === 'custom') {
            fromISO = from ? new Date(from).toISOString() : new Date(0).toISOString();
            const toDate = to ? new Date(to) : now;
            toDate.setHours(23, 59, 59, 999);
            toISO = toDate.toISOString();
            label = 'Custom_Range';
        } else {
            let days = 7;
            if (range === 'last_month') { days = 30; label = 'Last_Month (30 Days)'; }
            else if (range === '6_months') { days = 180; label = 'Last_6_Months'; }
            else { label = 'Last_7_Days'; }

            const fromDate = new Date(now);
            fromDate.setDate(now.getDate() - days);
            fromDate.setHours(0, 0, 0, 0);
            fromISO = fromDate.toISOString();
            toISO = now.toISOString();
        }

        const supabase = getSupabase(c.env);
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id, name, email, platform_role, workflow_role')
            .eq('id', user_id)
            .eq('company_id', c.get("user").company_id)
            .single();

        if (userError || !user) return c.json({ message: 'User not found' }, 404);

        // Worker Completed
        const { data: perfLogs, error: perfError } = await supabase
            .from('task_performance_logs')
            .select(`
                task_id, task_title, instance_name, project_name, status,
                assigned_at, submitted_at, approved_at, actual_working_minutes, estimated_minutes
            `)
            .eq('user_id', user_id)
            .gte('submitted_at', fromISO)
            .lte('submitted_at', toISO)
            .order('submitted_at', { ascending: false });

        if (perfError) return c.json({ message: perfError.message }, 400);

        // Worker Active
        const { data: activeTasks, error: activeError } = await supabase
            .from('tasks')
            .select(`
                id, title, status, assigned_at, submitted_at, due_date,
                instance:instance_id(id, name, status, project:project_id(id, name))
            `)
            .eq('assigned_user_id', user_id)
            .not('status', 'in', '("COMPLETED","LOCKED")')
            // Exclude tasks from paused instances — stale due_dates would inflate overdue counts
            .not('instance_id.status', 'eq', 'PAUSED')
            .order('due_date', { ascending: true });

        if (activeError) return c.json({ message: activeError.message }, 400);

        // Reviewer Active (Pending Approvals)
        const { data: approvalLevels, error: appErr } = await supabase
            .from('task_approval_levels')
            .select(`
                approver_id,
                level_number,
                task:task_id(
                    id, title, status, assigned_at, submitted_at, due_date,
                    current_level,
                    instance:instance_id(id, name, status, project:project_id(id, name))
                )
            `)
            .eq('approver_id', user_id)
            .eq('status', 'PENDING');

        if (appErr) return c.json({ message: appErr.message }, 400);

        // Reviewer Completed
        const { data: completedReviewerTasks, error: reviewerErr } = await supabase
            .from('task_approval_history')
            .select(`
                actor_id,
                created_at,
                task:task_id(
                    id, title, status, assigned_at, submitted_at, due_date,
                    instance:instance_id(id, name, status, project:project_id(id, name))
                )
            `)
            .eq('actor_id', user_id)
            .eq('action', 'APPROVED')
            .gte('created_at', fromISO)
            .lte('created_at', toISO);

        if (reviewerErr) return c.json({ message: reviewerErr.message }, 400);

        const completedWorkerRows = (perfLogs || []).map(log => ({
            taskTitle: log.task_title || '—',
            instance: log.instance_name || '—',
            project: log.project_name || '—',
            status: log.status === 'On-time' ? 'Completed (On-time)' : 'Completed (Late)',
            assignedAt: log.assigned_at ? new Date(log.assigned_at).toLocaleString() : '—',
            submittedAt: log.submitted_at ? new Date(log.submitted_at).toLocaleString() : '—',
            approvedAt: log.approved_at ? new Date(log.approved_at).toLocaleString() : '—',
            estimatedMinutes: log.estimated_minutes || 0,
            actualWorkingMinutes: log.actual_working_minutes || 0,
            role: 'Worker',
        }));

        const completedReviewerRows = (completedReviewerTasks || [])
            .filter(r => r.task && r.task.instance?.status !== 'paused')
            .map(r => {
                const task = r.task;
                const actedAt = new Date(r.created_at);
                const dueDate = task.due_date ? new Date(task.due_date) : null;
                const onTime = !dueDate || actedAt <= dueDate;
                return {
                    taskTitle: (task.title || '—') + ' (Approval Required)',
                    instance: task.instance?.name || '—',
                    project: task.instance?.project?.name || '—',
                    status: onTime ? 'Completed (On-time)' : 'Completed (Late)',
                    assignedAt: task.assigned_at ? new Date(task.assigned_at).toLocaleString() : '—',
                    submittedAt: task.submitted_at ? new Date(task.submitted_at).toLocaleString() : '—',
                    approvedAt: r.created_at ? new Date(r.created_at).toLocaleString() : '—',
                    estimatedMinutes: 0,
                    actualWorkingMinutes: 0,
                    role: 'Reviewer',
                };
            });

        const activeWorkerRows = (activeTasks || [])
            .filter(t => t.instance?.status !== 'paused')
            .map(task => {
                const isPastDue = task.due_date && new Date(task.due_date) < now;
                const statusLabel =
                    task.status === 'IN_PROGRESS' && isPastDue ? 'Overdue'
                        : task.status === 'IN_PROGRESS' ? 'In Progress'
                            : task.status === 'PENDING_APPROVAL' ? 'Pending Approval'
                                : task.status === 'REJECTED' ? 'Rejected (Rework)'
                                    : task.status;

                return {
                    taskTitle: task.title || '—',
                    instance: task.instance?.name || '—',
                    project: task.instance?.project?.name || '—',
                    status: statusLabel,
                    assignedAt: task.assigned_at ? new Date(task.assigned_at).toLocaleString() : '—',
                    submittedAt: task.submitted_at ? new Date(task.submitted_at).toLocaleString() : '—',
                    approvedAt: '—',
                    estimatedMinutes: 0,
                    actualWorkingMinutes: 0,
                    role: 'Worker',
                };
            });

        const activeReviewerRows = (approvalLevels || [])
            .filter(l =>
                l.task &&
                l.task.status === 'PENDING_APPROVAL' &&
                l.task.current_level === l.level_number &&
                l.task.instance?.status !== 'paused'
            )
            .map(l => {
                const task = l.task;
                return {
                    taskTitle: (task.title || '—') + ' (Approval Required)',
                    instance: task.instance?.name || '—',
                    project: task.instance?.project?.name || '—',
                    status: 'Pending Approval',
                    assignedAt: task.assigned_at ? new Date(task.assigned_at).toLocaleString() : '—',
                    submittedAt: task.submitted_at ? new Date(task.submitted_at).toLocaleString() : '—',
                    approvedAt: '—',
                    estimatedMinutes: 0,
                    actualWorkingMinutes: 0,
                    role: 'Reviewer',
                };
            });

        const activityRows = [
            ...completedWorkerRows,
            ...completedReviewerRows,
            ...activeWorkerRows,
            ...activeReviewerRows,
        ];

        const { data: allUserTasks } = await supabase
            .from('tasks').select('id, instance_id')
            .eq('assigned_user_id', user_id).gte('assigned_at', fromISO);

        const reviewerInstanceIds = [
            ...(approvalLevels || []).map(l => l.task?.instance_id || l.task?.instance?.id),
            ...(completedReviewerTasks || []).map(r => r.task?.instance_id || r.task?.instance?.id),
        ].filter(Boolean);

        const workerInstanceIds = (allUserTasks || []).map(t => t.instance_id).filter(Boolean);
        const instanceIds = [...new Set([...workerInstanceIds, ...reviewerInstanceIds])];

        let instanceRows = [];
        if (instanceIds.length > 0) {
            const { data: instances } = await supabase
                .from('instances')
                .select(`id, name, status, created_at, project:project_id(id, name), client:client_id(id, name)`)
                .in('id', instanceIds);

            const { data: taskStats } = await supabase
                .from('tasks').select('instance_id, status').in('instance_id', instanceIds);

            const statsMap = {};
            (taskStats || []).forEach(t => {
                if (!statsMap[t.instance_id]) statsMap[t.instance_id] = { total: 0, completed: 0 };
                statsMap[t.instance_id].total++;
                if (t.status === 'COMPLETED') statsMap[t.instance_id].completed++;
            });

            instanceRows = (instances || []).map(inst => ({
                instanceName: inst.name || '—',
                project: inst.project?.name || '—',
                client: inst.client?.name || '—',
                instanceStatus: inst.status || '—',
                createdAt: inst.created_at ? new Date(inst.created_at).toLocaleDateString() : '—',
                totalTasks: statsMap[inst.id]?.total || 0,
                completedTasks: statsMap[inst.id]?.completed || 0,
            }));
        }

        const allTaskIds = [
            ...(perfLogs || []).map(l => l.task_id),
            ...(activeTasks || []).map(t => t.id),
            ...(approvalLevels || []).map(l => l.task?.id),
            ...(completedReviewerTasks || []).map(r => r.task?.id),
        ].filter(Boolean);

        let approvalRows = [];
        if (allTaskIds.length > 0) {
            const { data: approvalHistory } = await supabase
                .from('task_approval_history')
                .select(`task_id, action, comment, created_at, actor:actor_id(id, name), task:task_id(id, title)`)
                .in('task_id', allTaskIds)
                .order('created_at', { ascending: true });

            const taskGroups = {};
            (approvalHistory || []).forEach(row => {
                const tid = row.task_id;
                if (!taskGroups[tid]) {
                    taskGroups[tid] = { taskTitle: row.task?.title || '—', rejections: [], approvals: [] };
                }
                if (row.action === 'REJECTED') {
                    taskGroups[tid].rejections.push({
                        reason: row.comment || '(no reason given)',
                        by: row.actor?.name || '—',
                        at: row.created_at ? new Date(row.created_at).toLocaleString() : '—',
                    });
                } else if (row.action === 'APPROVED') {
                    taskGroups[tid].approvals.push({
                        by: row.actor?.name || '—',
                        at: row.created_at ? new Date(row.created_at).toLocaleString() : '—',
                    });
                }
            });

            approvalRows = Object.values(taskGroups).map(group => ({
                taskTitle: group.taskTitle,
                finalStatus: group.approvals.length > 0 ? 'Approved' : group.rejections.length > 0 ? 'Rejected' : 'Pending',
                totalRejections: group.rejections.length,
                rejectionReasons: group.rejections.map((r, i) => `#${i + 1}: "${r.reason}" — by ${r.by} on ${r.at}`).join(' → ') || '—',
                approvedBy: group.approvals.map(a => a.by).join(', ') || '—',
                approvedAt: group.approvals.length > 0 ? group.approvals[group.approvals.length - 1].at : '—',
            }));
        }

        return c.json({
            user: { name: user.name, email: user.email, role: user.platform_role, workflowRole: user.workflow_role },
            range: { from: fromISO, to: toISO, label },
            activityRows, instanceRows, approvalRows,
        }, 200);

    } catch (error) {
        return c.json({ message: error.message }, 500);
    }
};

export const getTaskPerformanceReport = async (c) => {
    try {
        const { range, from, to } = c.req.query();

        let fromISO, toISO, label;
        const now = new Date();

        if (range === 'custom') {
            fromISO = from ? new Date(from).toISOString() : new Date(0).toISOString();
            const toDate = to ? new Date(to) : now;
            toDate.setHours(23, 59, 59, 999);
            toISO = toDate.toISOString();
            label = 'Custom_Range';
        } else {
            let days = 7;
            if (range === 'last_month') { days = 30; label = 'Last_Month (30 Days)'; }
            else if (range === '6_months') { days = 180; label = 'Last_6_Months'; }
            else { label = 'Last_7_Days'; }

            const fromDate = new Date(now);
            fromDate.setDate(now.getDate() - days);
            fromDate.setHours(0, 0, 0, 0);
            fromISO = fromDate.toISOString();
            toISO = now.toISOString();
        }

        const companyId = c.get("user").company_id;
        if (!companyId) return c.json({ message: 'Could not determine company for this admin' }, 400);

        const supabase = getSupabase(c.env);
        const { data: members, error: membersError } = await supabase
            .from('users').select('id, name, email, platform_role, workflow_role')
            .eq('company_id', companyId).eq('platform_role', 'member').eq('is_active', true);

        if (membersError) return c.json({ message: membersError.message }, 400);

        const memberIds = (members || []).map(m => m.id);
        const memberMap = {};
        (members || []).forEach(m => { memberMap[m.id] = m; });

        const { data: perfLogs, error: perfError } = await supabase
            .from('task_performance_logs')
            .select(`task_id, user_id, task_title, instance_name, project_name, status, assigned_at, submitted_at, approved_at, estimated_minutes, actual_working_minutes, approver_comments`)
            .eq('company_id', companyId)
            .gte('submitted_at', fromISO).lte('submitted_at', toISO)
            .order('submitted_at', { ascending: false });

        if (perfError) return c.json({ message: perfError.message }, 400);

        const { data: activeTasks, error: activeError } = await supabase
            .from('tasks')
            .select('id, title, status, assigned_user_id, due_date, assigned_at, instance:instance_id(name, status, project:project_id(name))')
            .in('assigned_user_id', memberIds.length > 0 ? memberIds : ['none'])
            .not('status', 'in', '("COMPLETED","LOCKED")')
            // Exclude tasks from paused instances — stale due_dates would inflate overdue counts
            .not('instance_id.status', 'eq', 'PAUSED');

        if (activeError) return c.json({ message: activeError.message }, 400);

        // Reviewer Active (Pending Approvals)
        const { data: approvalLevels, error: appErr } = await supabase
            .from('task_approval_levels')
            .select(`
                approver_id,
                level_number,
                task:task_id(
                    id, title, status, assigned_at, submitted_at, due_date,
                    current_level,
                    instance:instance_id(id, name, status, project:project_id(id, name))
                )
            `)
            .in('approver_id', memberIds.length > 0 ? memberIds : ['none'])
            .eq('status', 'PENDING');

        if (appErr) return c.json({ message: appErr.message }, 400);

        // Reviewer Completed
        const { data: completedReviewerTasks, error: reviewerErr } = await supabase
            .from('task_approval_history')
            .select(`
                actor_id,
                created_at,
                task:task_id(
                    id, title, status, assigned_at, submitted_at, due_date,
                    instance:instance_id(id, name, status, project:project_id(id, name))
                )
            `)
            .in('actor_id', memberIds.length > 0 ? memberIds : ['none'])
            .eq('action', 'APPROVED')
            .gte('created_at', fromISO)
            .lte('created_at', toISO);

        if (reviewerErr) return c.json({ message: reviewerErr.message }, 400);

        const summaryRows = (members || []).map(member => {
            // Worker completed
            const workerLogs = (perfLogs || []).filter(l => l.user_id === member.id);
            const workerCompletedCount = workerLogs.length;
            const workerOnTimeCount = workerLogs.filter(l => l.status === 'On-time').length;
            const workerLateCount = workerLogs.filter(l => l.status === 'Overdue').length;

            // Reviewer completed
            const reviewerApprovals = (completedReviewerTasks || [])
                .filter(r => r.actor_id === member.id && r.task && r.task.instance?.status !== 'paused');
            const reviewerCompletedCount = reviewerApprovals.length;
            const reviewerOnTimeCount = reviewerApprovals.filter(r => {
                if (!r.task?.due_date || !r.created_at) return false;
                return new Date(r.created_at) <= new Date(r.task.due_date);
            }).length;
            const reviewerLateCount = reviewerCompletedCount - reviewerOnTimeCount;

            // Combined completed
            const completedCount = workerCompletedCount + reviewerCompletedCount;
            const onTimeCount = workerOnTimeCount + reviewerOnTimeCount;
            const lateCount = workerLateCount + reviewerLateCount;

            // Worker active
            const workerActive = (activeTasks || [])
                .filter(t => t.assigned_user_id === member.id && t.instance?.status !== 'paused');

            // Reviewer active
            const reviewerActive = (approvalLevels || [])
                .filter(l =>
                    l.approver_id === member.id &&
                    l.task &&
                    l.task.status === 'PENDING_APPROVAL' &&
                    l.task.current_level === l.level_number &&
                    l.task.instance?.status !== 'paused'
                );

            const activeCombined = [
                ...workerActive.map(t => ({ id: t.id, status: t.status, due_date: t.due_date })),
                ...reviewerActive.map(l => ({ id: l.task.id, status: 'PENDING_APPROVAL', due_date: l.task.due_date }))
            ];
            // Deduplicate active tasks
            const activeDeduplicated = Array.from(new Map(activeCombined.map(t => [t.id, t])).values());

            const inProgressCount = activeDeduplicated.filter(t => ['IN_PROGRESS', 'PENDING_APPROVAL', 'REJECTED'].includes(t.status)).length;
            const overdueCount = activeDeduplicated.filter(t => t.due_date && new Date(t.due_date) < now).length;
            const lockedCount = activeDeduplicated.filter(t => t.status === 'LOCKED').length;

            const totalTasks = completedCount + activeDeduplicated.length;
            const onTimeDelivery = completedCount > 0 ? Math.round((onTimeCount / completedCount) * 100) : 0;

            const totalActual = workerLogs.reduce((sum, l) => sum + (l.actual_working_minutes || 0), 0);
            const avgActualMins = workerCompletedCount > 0 ? Math.round(totalActual / workerCompletedCount) : 0;

            return {
                name: member.name, email: member.email, role: member.workflow_role || member.platform_role,
                totalTasks, completed: completedCount, inProgress: inProgressCount, overdue: overdueCount,
                upcoming: lockedCount, completedOnTime: onTimeCount, completedLate: lateCount,
                onTimeDeliveryPct: `${onTimeDelivery}%`, avgActualWorkingMins: avgActualMins,
            };
        });

        const completedWorkerDetails = (perfLogs || []).map(log => {
            const member = memberMap[log.user_id];
            const submittedAt = log.submitted_at ? new Date(log.submitted_at) : null;
            const approvedAt = log.approved_at ? new Date(log.approved_at) : null;
            const assignedAt = log.assigned_at ? new Date(log.assigned_at) : null;

            let cycleTimeHrs = '—', approvalTimeHrs = '—';
            if (assignedAt && submittedAt) cycleTimeHrs = ((submittedAt - assignedAt) / 3600000).toFixed(1) + ' hrs';
            if (submittedAt && approvedAt) approvalTimeHrs = ((approvedAt - submittedAt) / 3600000).toFixed(1) + ' hrs';

            return {
                memberName: member?.name || '—', memberRole: member?.workflow_role || member?.platform_role || '—',
                taskTitle: log.task_title || '—', instance: log.instance_name || '—', project: log.project_name || '—',
                performanceStatus: log.status || '—',
                assignedAt: assignedAt ? assignedAt.toLocaleString() : '—', submittedAt: submittedAt ? submittedAt.toLocaleString() : '—',
                approvedAt: approvedAt ? approvedAt.toLocaleString() : '—',
                cycleTime: cycleTimeHrs, approvalTime: approvalTimeHrs,
                estimatedMins: log.estimated_minutes || 0, actualWorkingMins: log.actual_working_minutes || 0,
                approverComments: log.approver_comments || '—',
            };
        });

        const completedReviewerDetails = (completedReviewerTasks || [])
            .filter(r => r.task && r.task.instance?.status !== 'paused')
            .map(r => {
                const member = memberMap[r.actor_id];
                const task = r.task;
                const submittedAt = task.submitted_at ? new Date(task.submitted_at) : null;
                const approvedAt = r.created_at ? new Date(r.created_at) : null;
                const assignedAt = task.assigned_at ? new Date(task.assigned_at) : null;

                let cycleTimeHrs = '—', approvalTimeHrs = '—';
                if (assignedAt && submittedAt) cycleTimeHrs = ((submittedAt - assignedAt) / 3600000).toFixed(1) + ' hrs';
                if (submittedAt && approvedAt) approvalTimeHrs = ((approvedAt - submittedAt) / 3600000).toFixed(1) + ' hrs';

                const dueDate = task.due_date ? new Date(task.due_date) : null;
                const onTime = !dueDate || approvedAt <= dueDate;

                return {
                    memberName: member?.name || '—', memberRole: 'Reviewer',
                    taskTitle: (task.title || '—') + ' (Approval Required)',
                    instance: task.instance?.name || '—',
                    project: task.instance?.project?.name || '—',
                    performanceStatus: onTime ? 'On-time' : 'Overdue',
                    assignedAt: assignedAt ? assignedAt.toLocaleString() : '—',
                    submittedAt: submittedAt ? submittedAt.toLocaleString() : '—',
                    approvedAt: approvedAt ? approvedAt.toLocaleString() : '—',
                    cycleTime: cycleTimeHrs,
                    approvalTime: approvalTimeHrs,
                    estimatedMins: 0,
                    actualWorkingMins: 0,
                    approverComments: '—',
                };
            });

        const detailRows = [
            ...completedWorkerDetails,
            ...completedReviewerDetails
        ];

        return c.json({
            range: { from: fromISO, to: toISO, label },
            summaryRows, detailRows,
        }, 200);

    } catch (error) {
        return c.json({ message: error.message }, 500);
    }
};
