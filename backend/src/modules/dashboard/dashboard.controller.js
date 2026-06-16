import { getSupabase } from '../../config/supabase.js';

export const getDashboardStats = async (c) => {
    const supabase = getSupabase(c.env);

    try {
        const companyId = c.get("user").company_id;
        const cacheKey = `dashboard_stats_${companyId}`;
        const cached = await c.env.FMS_CACHE?.get(cacheKey, "json");
        if (cached) return c.json(cached, 200);

        const now = new Date().toISOString();

        const [
            usersCountResult,
            projectsCountResult,
            activeTasksCountResult,
            workerOverdueResult,
            reviewerOverdueResult,
            instancesCountResult,
            pendingClientApprovalsResult
        ] = await Promise.all([
            supabase.from('users').select('*', { count: 'exact', head: true }).eq('company_id', companyId).eq('is_active', true),
            supabase.from('projects').select('*', { count: 'exact', head: true }).eq('company_id', companyId),
            // Active tasks: worker IN_PROGRESS in an ONGOING instance
            supabase.from('tasks').select('id, instance_id!inner(status)', { count: 'exact', head: true })
                .eq('company_id', companyId).eq('status', 'IN_PROGRESS')
                .eq('instance_id.status', 'ONGOING'),
            // Worker overdue: IN_PROGRESS or REJECTED tasks past their due_date in an ONGOING instance
            // PENDING_APPROVAL is excluded — the worker already submitted; overdue shifts to the reviewer.
            supabase.from('tasks').select('id, instance_id!inner(status)', { count: 'exact', head: true })
                .eq('company_id', companyId).in('status', ['IN_PROGRESS', 'REJECTED'])
                .lt('due_date', now)
                .eq('instance_id.status', 'ONGOING'),
            // Reviewer overdue: PENDING approval levels past their per-level due_date,
            // where the task is PENDING_APPROVAL in an ONGOING instance.
            // task_approval_levels has no company_id, so we scope via company's tasks.
            supabase.from('task_approval_levels')
                .select('id, task:task_id!inner(id, company_id, status, instance:instance_id!inner(status))')
                .eq('status', 'PENDING')
                .lt('due_date', now)
                .eq('task.company_id', companyId)
                .eq('task.status', 'PENDING_APPROVAL')
                .eq('task.instance.status', 'ONGOING'),
            supabase.from('instances').select('*', { count: 'exact', head: true }).eq('company_id', companyId).eq('status', 'ONGOING'),
            supabase.from('client_approvals').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('status', 'PENDING'),
        ]);

        // Reviewer overdue: deduplicate by task_id (a task with 2 overdue levels = 1 overdue task)
        const overdueReviewerTaskIds = new Set((reviewerOverdueResult.data || []).map(l => l.task?.id).filter(Boolean));
        const totalOverdue = (workerOverdueResult.count || 0) + overdueReviewerTaskIds.size;

        const result = {
            users: usersCountResult.count || 0,
            projects: projectsCountResult.count || 0,
            activeTasks: activeTasksCountResult.count || 0,
            overdueTasks: totalOverdue,
            instances: instancesCountResult.count || 0,
            pendingClientApprovals: pendingClientApprovalsResult.count || 0,
        };

        // if (c.env.FMS_CACHE) {
        //     await c.env.FMS_CACHE.put(cacheKey, JSON.stringify(result), { expirationTtl: 300 });
        // }

        return c.json(result, 200);

    } catch (error) {
        return c.json({ message: error.message }, 500);
    }
};

export const getTeamPerformance = async (c) => {
    const supabase = getSupabase(c.env);

    try {
        const companyId = c.get("user").company_id;
        const { dateRange, memberId = 'all', startDate, endDate } = c.req.query();

        const cacheKey = `team_perf_${companyId}_${memberId}_${dateRange || 'none'}_${startDate || 'none'}_${endDate || 'none'}`;
        const cached = await c.env.FMS_CACHE?.get(cacheKey, "json");
        if (cached) return c.json(cached, 200);

        const now = new Date();
        let fromDate = new Date(0);
        if (dateRange && dateRange !== 'All Time' && dateRange !== 'Custom') {
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            if (dateRange === 'Today') fromDate = today;
            else if (dateRange === 'Yesterday') {
                const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1); fromDate = yesterday;
            } else if (dateRange === 'Last 7 Days') {
                fromDate = new Date(today); fromDate.setDate(fromDate.getDate() - 7);
            } else if (dateRange === 'Last 30 Days') {
                fromDate = new Date(today); fromDate.setDate(fromDate.getDate() - 30);
            }
        }
        const fromISO = fromDate.toISOString();

        const supabase = getSupabase(c.env);
        let userQuery = supabase
            .from('users').select('id, name, workflow_role, platform_role')
            .eq('company_id', companyId).eq('is_active', true);
        if (memberId !== 'all') userQuery = userQuery.eq('id', memberId);

        const { data: users, error: usersError } = await userQuery;
        if (usersError) throw usersError;

        const userIds = users.map(u => u.id);

        // ── Query 1: Worker tasks (assigned_user_id) ──────────────────────────────
        let taskQuery = supabase
            .from('tasks')
            .select('id, title, status, due_date, submitted_at, created_at, assigned_user_id, instance:instance_id!inner(is_paused)')
            .eq('company_id', companyId)
            .in('instance_id.status', ['ONGOING', 'COMPLETED']);

        if (dateRange === 'Custom' && startDate && endDate) {
            const endOfDay = new Date(endDate);
            endOfDay.setHours(23, 59, 59, 999);
            taskQuery = taskQuery.gte('created_at', new Date(startDate).toISOString()).lte('created_at', endOfDay.toISOString());
        } else if (dateRange !== 'All Time' && dateRange !== 'Yesterday' && dateRange !== 'Custom') {
            taskQuery = taskQuery.gte('created_at', fromISO);
        } else if (dateRange === 'Yesterday') {
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            taskQuery = taskQuery.gte('created_at', fromISO).lt('created_at', today.toISOString());
        }

        if (memberId !== 'all') taskQuery = taskQuery.eq('assigned_user_id', memberId);

        const { data: tasks, error: taskError } = await taskQuery;
        if (taskError) throw taskError;

        // ── Query 2: Reviewer tasks from task_approval_levels ─────────────────────
        // Fetch all approval levels for these members.
        // NOTE: No company_id filter here — task_approval_levels.company_id is nullable in existing
        //       records. Company scope is already guaranteed via .in('approver_id', userIds) since
        //       userIds was built from this company's users only.
        // NOTE: No due_date null filter — null due_date is handled gracefully in the loop below
        //       (reviewer is counted as active even without a due_date, just not overdue).
        let approvalQuery = supabase
            .from('task_approval_levels')
            .select(`
                approver_id, level_number, status, due_date, acted_at, task_id,
                task:task_id(id, status, current_level, instance:instance_id!inner(is_paused, status))
            `)
            .in('approver_id', userIds);

        const { data: approvalLevels } = await approvalQuery;

        // ── Initialise per-member stats ───────────────────────────────────────────
        let active = 0, completed = 0, onTime = 0, late = 0, overdue = 0;
        const userStats = {};
        users.forEach(u => {
            userStats[u.id] = { id: u.id, name: u.name, role: u.workflow_role || u.platform_role || 'member', total: 0, active: 0, completed: 0, onTime: 0, late: 0, overdue: 0, performance: 0 };
        });

        const isTaskActive = (status) => ['IN_PROGRESS', 'PENDING_APPROVAL'].includes(status);
        const isTaskCompleted = (status) => ['COMPLETED', 'APPROVED'].includes(status);

        // ── Process worker tasks (existing logic, unchanged) ──────────────────────
        tasks.forEach(task => {
            const uid = task.assigned_user_id;
            if (!uid || !userStats[uid]) return;

            const tActive = isTaskActive(task.status);
            const tCompleted = isTaskCompleted(task.status);
            let tOnTime = false, tLate = false, tOverdue = false;

            if (task.due_date) {
                if (tCompleted) {
                    const completedAt = task.submitted_at ? new Date(task.submitted_at) : new Date();
                    if (completedAt > new Date(task.due_date)) tLate = true; else tOnTime = true;
                } else if (task.status !== 'REJECTED' && task.status !== 'PENDING_APPROVAL') {
                    // PENDING_APPROVAL: worker has submitted — overdue shifts to the reviewer.
                    // Reviewer overdue is computed separately via the task_approval_levels loop below.
                    if (new Date(task.due_date) < now) tOverdue = true;
                }
            }

            if (tActive) active++; if (tCompleted) completed++; if (tOnTime) onTime++; if (tLate) late++; if (tOverdue) overdue++;
            const us = userStats[uid];
            us.total++; if (tActive) us.active++; if (tCompleted) us.completed++; if (tOnTime) us.onTime++; if (tLate) us.late++; if (tOverdue) us.overdue++;
        });

        // ── Process reviewer tasks (NEW: per-level due_date logic) ─────────────────
        // Each entry in approvalLevels is one level assignment for one reviewer.
        // We use the level's own due_date (not tasks.due_date) for reviewer overdue/late/onTime.
        (approvalLevels || []).forEach(level => {
            const uid = level.approver_id;
            if (!uid || !userStats[uid]) return;

            const task = level.task;
            // Skip if task is missing, instance is paused, or instance is not ONGOING
            if (!task) return;
            if (task.instance?.is_paused || task.instance?.status?.toUpperCase() === 'PAUSED') return;

            const levelDueDate = level.due_date ? new Date(level.due_date) : null;
            const actedAt = level.acted_at ? new Date(level.acted_at) : null;
            const us = userStats[uid];

            if (level.status === 'PENDING') {
                // Only count when this reviewer is the current-level approver
                if (
                    task.status === 'PENDING_APPROVAL' &&
                    task.current_level === level.level_number
                ) {
                    // This is an active review task for this member
                    active++;
                    us.active++;
                    us.total++;

                    // Is the reviewer overdue at their level?
                    if (levelDueDate && levelDueDate < now) {
                        overdue++;
                        us.overdue++;
                    }
                }
            } else if (level.status === 'APPROVED' && levelDueDate && actedAt) {
                // Review is done — compute late vs on-time for the reviewer
                // Apply the same date-range filter as worker tasks: acted_at must be in range
                if (dateRange && dateRange !== 'All Time') {
                    if (dateRange === 'Custom' && startDate && endDate) {
                        const endOfDay = new Date(endDate); endOfDay.setHours(23, 59, 59, 999);
                        if (actedAt < new Date(startDate) || actedAt > endOfDay) return;
                    } else if (dateRange === 'Yesterday') {
                        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                        if (actedAt < fromDate || actedAt >= today) return;
                    } else {
                        if (actedAt < fromDate) return;
                    }
                }

                completed++;
                us.completed++;
                us.total++;

                if (actedAt > levelDueDate) {
                    late++;
                    us.late++;
                } else {
                    onTime++;
                    us.onTime++;
                }
            }
        });

        const slaPercent = (onTime + late) > 0 ? Math.round((onTime / (onTime + late)) * 100) : 0;
        const memberStats = Object.values(userStats).map(m => {
            m.performance = (m.onTime + m.late) > 0 ? Math.round((m.onTime / (m.onTime + m.late)) * 100) : 0;
            return m;
        });
        memberStats.sort((a, b) => b.total - a.total);

        const result = { stats: { total: tasks.length, active, completed, onTime, late, overdue, slaPercent }, memberStats };

        // if (c.env.FMS_CACHE) {
        //     await c.env.FMS_CACHE.put(cacheKey, JSON.stringify(result), { expirationTtl: 60 });
        // }

        return c.json(result, 200);

    } catch (error) {
        return c.json({ message: error.message }, 500);
    }
};
