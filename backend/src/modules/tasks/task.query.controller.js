import { getSupabase } from "../../config/supabase.js";

export const fetchTasksByProject = async (c) => {
    try {
        const { project_id, instance_id, page = 1, limit = 10, status, search, assigned_user_id, date_range, company_id: query_company_id } = c.req.query();
        let company_id = null;
        if (c.get("user").platform_role === "superadmin") {
            company_id = query_company_id;
        } else {
            company_id = c.get("user").company_id;
        }

        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);
        const from = (pageNum - 1) * limitNum;
        const to = from + limitNum - 1;

        const supabase = getSupabase(c.env);
        let query = supabase
            .from("tasks")
            .select(`
                *,
                assigned_user:assigned_user_id(id, name, email,workflow_role,platform_role),
                instance:instance_id(id, name, client_id),
                project:project_id(id, name, client_id, client:client_id(id, name)),
                task_approval_levels(*, approver:approver_id(id, name, email,workflow_role,platform_role)),
                task_checklist_progress(*)
            `, { count: 'exact' })
            .order("task_order", { ascending: true });

        if (project_id) query = query.eq("project_id", project_id);
        if (instance_id) query = query.eq("instance_id", instance_id);
        if (company_id) query = query.eq("company_id", company_id);

        if (status) query = query.in("status", status.split(','));
        if (assigned_user_id && assigned_user_id !== 'all') query = query.eq("assigned_user_id", assigned_user_id);

        if (search) {
            // Find users matching search
            const { data: searchUsers } = await supabase.from('users').select('id').ilike('name', `%${search}%`);
            const userIds = searchUsers?.map(u => u.id) || [];

            // Find instances matching search
            const { data: searchInstances } = await supabase.from('instances').select('id').ilike('name', `%${search}%`);
            const instanceIds = searchInstances?.map(i => i.id) || [];

            let orConditions = [`title.ilike.%${search}%`];
            if (userIds.length > 0) orConditions.push(`assigned_user_id.in.(${userIds.join(',')})`);
            if (instanceIds.length > 0) orConditions.push(`instance_id.in.(${instanceIds.join(',')})`);

            query = query.or(orConditions.join(','));
        }

        if (date_range && date_range !== 'All Time') {
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            if (date_range === 'Today') {
                query = query.gte('created_at', today.toISOString());
            } else if (date_range === 'Yesterday') {
                const yesterday = new Date(today);
                yesterday.setDate(yesterday.getDate() - 1);
                query = query.gte('created_at', yesterday.toISOString()).lt('created_at', today.toISOString());
            } else if (date_range === 'Last 7 Days') {
                const last7 = new Date(today);
                last7.setDate(last7.getDate() - 7);
                query = query.gte('created_at', last7.toISOString());
            } else if (date_range === 'Last 30 Days') {
                const last30 = new Date(today);
                last30.setDate(last30.getDate() - 30);
                query = query.gte('created_at', last30.toISOString());
            }
        }

        query = query.range(from, to);

        const { data, count, error } = await query;
        if (error) return c.json({ message: error.message }, 400);

        return c.json({
            data, count, page: pageNum, limit: limitNum, totalPages: Math.ceil((count || 0) / limitNum)
        }, 200);
    } catch (error) {
        return c.json({ message: error.message }, 500);
    }
};

// export const fetchMyTasks = async (c) => {
//     try {
//         const userId = c.get("user").id;
//         const {
//             tab = 'workerTasks',
//             page = 1,
//             limit = 10,
//             search,
//             client_id,
//             project_id,
//             type,
//             date_range,
//             sort_by = 'due_date',
//         } = c.req.query();

//         const pageNum = parseInt(page, 10) || 1;
//         const limitNum = parseInt(limit, 10) || 10;
//         const from = (pageNum - 1) * limitNum;
//         const to = from + limitNum - 1;

//         const supabase = getSupabase(c.env);

//         const applyFilters = (query) => {
//             if (search) query = query.ilike("title", `%${search}%`);
//             if (project_id && project_id !== 'all') query = query.eq("project_id", project_id);
//             if (client_id && client_id !== 'all') {
//                 query = query.eq("instance.client_id", client_id);
//             }
//             if (type && type !== 'all') {
//                 if (type === 'manual') query = query.is('task_order', null);
//                 else if (type === 'workflow') query = query.not('task_order', 'is', null);
//             }
//             if (date_range && date_range !== 'All Time') {
//                 const now = new Date();
//                 const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
//                 if (date_range === 'Today') {
//                     query = query.gte('due_date', today.toISOString());
//                 } else if (date_range === 'Last 7 Days') {
//                     const last7 = new Date(today);
//                     last7.setDate(last7.getDate() - 7);
//                     query = query.gte('due_date', last7.toISOString());
//                 } else if (date_range === 'Last 30 Days') {
//                     const last30 = new Date(today);
//                     last30.setDate(last30.getDate() - 30);
//                     query = query.gte('due_date', last30.toISOString());
//                 }
//             }
//             return query;
//         };

//         const taskSelect = `
//             *,
//             project:project_id(id, name, client_id),
//             instance:instance_id!inner(id, name, client:client_id(id, name)),
//             assigned_user:assigned_user_id(id, name, email),
//             last_rejector:last_rejected_by(id, name, email),
//             task_approval_levels(*, approver:approver_id(id, name, email)),
//             task_checklist_progress(*)
//         `;

//         // 1. Get Counts for all tabs (unpaginated, but filtered)
//         const countQueries = [
//             // workerTasks
//             applyFilters(supabase.from("tasks").select("id", { count: 'exact', head: true }).eq("assigned_user_id", userId).in("status", ["IN_PROGRESS", "REJECTED"])),
//             // approvalTasks (awaiting MY approval)
//             (async () => {
//                 let q = supabase.from("task_approval_levels")
//                     .select("task_id, tasks!inner(status)", { count: 'exact', head: true })
//                     .eq("approver_id", userId)
//                     .eq("status", "PENDING")
//                     .eq("tasks.status", "PENDING_APPROVAL");

//                 // Note: Complex filtering on counts for joined tables in Supabase can be tricky.
//                 // For now, we'll use a simpler count or accept slight over-counting if filters aren't applied to counts perfectly.
//                 // Ideally we'd use an RPC or a very specific view.
//                 return q;
//             })(),
//             // pendingApprovalTasks (submitted by me)
//             applyFilters(supabase.from("tasks").select("id", { count: 'exact', head: true }).eq("assigned_user_id", userId).eq("status", "PENDING_APPROVAL")),
//             // upcomingTasks
//             applyFilters(supabase.from("tasks").select("id", { count: 'exact', head: true }).eq("assigned_user_id", userId).eq("status", "LOCKED")),
//             // completedTasks
//             applyFilters(supabase.from("tasks").select("id", { count: 'exact', head: true }).eq("assigned_user_id", userId).eq("status", "COMPLETED")),
//             // reviewedTasks
//             supabase.from('task_approval_history').select("id", { count: 'exact', head: true }).eq('actor_id', userId)
//         ];

//         const countResults = await Promise.all(countQueries);

//         const counts = {
//             all: (countResults[0].count || 0) + (countResults[2].count || 0) + (countResults[3].count || 0) + (countResults[4].count || 0),
//             workerTasks: countResults[0].count || 0,
//             approvalTasks: countResults[1].count || 0,
//             pendingApprovalTasks: countResults[2].count || 0,
//             upcomingTasks: countResults[3].count || 0,
//             completedTasks: countResults[4].count || 0,
//             reviewedTasks: countResults[5].count || 0,
//         };

//         // 2. Fetch paginated data for the requested tab
//         let dataResult = { data: [], count: 0 };

//         if (tab === 'all') {
//             // All tasks related to me (either as worker or approver)
//             // For simplicity, we'll return all tasks where I'm the assigned user
//             dataResult = await applyFilters(supabase.from("tasks").select(taskSelect, { count: 'exact' }))
//                 .eq("assigned_user_id", userId)
//                 .order("due_date", { ascending: true }).range(from, to);
//         } else if (tab === 'workerTasks') {
//             let q = applyFilters(supabase.from("tasks").select(taskSelect, { count: 'exact' }))
//                 .eq("assigned_user_id", userId).in("status", ["IN_PROGRESS", "REJECTED"]);

//             if (sort_by === 'due_date') q = q.order("due_date", { ascending: true });
//             else if (sort_by === 'due_date_desc') q = q.order("due_date", { ascending: false });
//             else if (sort_by === 'created_at') q = q.order("created_at", { ascending: false });
//             else q = q.order("task_order", { ascending: true });

//             dataResult = await q.range(from, to);
//         } else if (tab === 'approvalTasks') {
//             // Complex join for approval tasks
//             const { data: myLevels } = await supabase.from("task_approval_levels")
//                 .select("task_id, level_number").eq("approver_id", userId).eq("status", "PENDING");

//             if (myLevels && myLevels.length > 0) {
//                 const taskIds = myLevels.map(al => al.task_id);
//                 let q = supabase.from("tasks").select(taskSelect, { count: 'exact' }).in("id", taskIds).eq("status", "PENDING_APPROVAL");
//                 q = applyFilters(q);

//                 // We still need to filter by current_level matches level_number
//                 // This is hard to do in a single .in query with multiple levels per task.
//                 // For now, we'll fetch then filter, but that breaks server-side pagination.
//                 // TODO: Optimize with a view or RPC for true server-side pagination of this tab.
//                 const { data: allPending, count: totalCount } = await q;
//                 const filtered = (allPending || []).filter(task => {
//                     const myLevel = myLevels.find(al => al.task_id === task.id);
//                     return myLevel && myLevel.level_number === task.current_level;
//                 });
//                 dataResult = {
//                     data: filtered.slice(from, to + 1),
//                     count: filtered.length // This might be less than totalCount
//                 };
//             }
//         } else if (tab === 'pendingApprovalTasks') {
//             let q = applyFilters(supabase.from("tasks").select(taskSelect, { count: 'exact' }))
//                 .eq("assigned_user_id", userId).eq("status", "PENDING_APPROVAL");

//             if (sort_by === 'due_date') q = q.order("due_date", { ascending: true });
//             else if (sort_by === 'due_date_desc') q = q.order("due_date", { ascending: false });
//             else if (sort_by === 'created_at') q = q.order("created_at", { ascending: false });
//             else q = q.order("task_order", { ascending: true });

//             dataResult = await q.range(from, to);
//         } else if (tab === 'upcomingTasks') {
//             dataResult = await applyFilters(supabase.from("tasks").select(taskSelect, { count: 'exact' }))
//                 .eq("assigned_user_id", userId).eq("status", "LOCKED")
//                 .order("task_order", { ascending: true }).range(from, to);
//         } else if (tab === 'completedTasks') {
//             dataResult = await applyFilters(supabase.from("tasks").select(taskSelect, { count: 'exact' }))
//                 .eq("assigned_user_id", userId).eq("status", "COMPLETED")
//                 .order("created_at", { ascending: false }).range(from, to);
//         } else if (tab === 'reviewedTasks') {
//             dataResult = await supabase.from('task_approval_history').select(`
//                 id, task_id, level_number, action, comment, created_at,
//                 task:task_id(
//                     id, title, task_order, assigned_role, status,
//                     project:project_id(id, name, client_id, client:client_id(id, name)),
//                     instance:instance_id(id, name, client:client_id(id, name)),
//                     assigned_user:assigned_user_id(id, name, email)
//                 )
//             `, { count: 'exact' }).eq('actor_id', userId).order('created_at', { ascending: false }).range(from, to);
//         }

//         return c.json({
//             data: dataResult.data || [],
//             counts,
//             pagination: {
//                 page: pageNum,
//                 limit: limitNum,
//                 totalCount: dataResult.count || 0,
//                 totalPages: Math.ceil((dataResult.count || 0) / limitNum)
//             }
//         }, 200);
//     } catch (error) {
//         return c.json({ message: error.message }, 500);
//     }
// };




export const fetchMyTasks = async (c) => {
    try {
        const userId = c.get("user").id;

        const {
            tab = 'workerTasks',
            page = 1,
            limit = 10,
            search,
            client_id,
            project_id,
            type,
            date_range,
            sort_by = 'due_date',
        } = c.req.query();

        const pageNum = parseInt(page, 10) || 1;
        const limitNum = parseInt(limit, 10) || 10;
        const from = (pageNum - 1) * limitNum;
        const to = from + limitNum - 1;

        const supabase = getSupabase(c.env);

        if (c.req.query('client_side') === 'true') {
            // date_range defaults to 'Last 30 Days' to limit payload size
            const { date_range = 'Last 30 Days', start_date, end_date, search } = c.req.query();

            const taskSelect = `
                *,
                project:project_id(id, name),
                instance:instance_id(id, name, is_paused, client:client_id(id, name)),
                assigned_user:assigned_user_id(id, name, email),
                last_rejector:last_rejected_by(id, name, email),
                task_approval_levels(*, approver:approver_id(id, name, email)),
                task_checklist_progress(*)
            `;

            // Build created_at cutoff from date_range
            const getCutoff = () => {
                if (date_range === 'All Time') return null;
                const now = new Date();
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                if (date_range === 'Last 30 Days') { const d = new Date(today); d.setDate(d.getDate() - 30); return d.toISOString(); }
                if (date_range === 'Last 7 Days') { const d = new Date(today); d.setDate(d.getDate() - 7); return d.toISOString(); }
                if (date_range === 'Today') return today.toISOString();
                if (date_range === 'Custom' && start_date) return new Date(start_date).toISOString();
                return null;
            };
            const cutoff = getCutoff();
            const customEndIso = (date_range === 'Custom' && end_date)
                ? (() => { const e = new Date(end_date); e.setHours(23, 59, 59, 999); return e.toISOString(); })()
                : null;

            // ── Query 1: ACTIVE tasks — NO date filter (always show tasks you're working on)
            let activeQ = supabase.from("tasks").select(taskSelect)
                .eq("assigned_user_id", userId)
                .not("status", "eq", "COMPLETED");
            if (search) activeQ = activeQ.ilike('title', `%${search}%`);

            // ── Query 2: COMPLETED tasks — WITH date filter on approved_at (always set when task reaches COMPLETED)
            // NOTE: submitted_at is reset to null on rejection and may not reflect completion time.
            //       approved_at is set on both paths: direct completion and final approval.
            let completedQ = supabase.from("tasks").select(taskSelect)
                .eq("assigned_user_id", userId).eq("status", "COMPLETED");
            if (cutoff) completedQ = completedQ.gte('approved_at', cutoff);
            if (customEndIso) completedQ = completedQ.lte('approved_at', customEndIso);
            if (search) completedQ = completedQ.ilike('title', `%${search}%`);

            // ── Query 3: My pending approval levels
            const myLevelsQ = supabase.from("task_approval_levels")
                .select("task_id, level_number, status")
                .eq("approver_id", userId).eq("status", "PENDING");

            // ── Query 4: Reviewed history — WITH date filter
            let rTasksQ = supabase.from('task_approval_history').select(`
                id, task_id, level_number, action, comment, created_at,
                task:task_id(
                    id, title, task_order, assigned_role, status,
                    project:project_id(id, name, client_id, client:client_id(id, name)),
                    instance:instance_id(id, name, is_paused, client:client_id(id, name)),
                    assigned_user:assigned_user_id(id, name, email)
                )
            `).eq('actor_id', userId).order('created_at', { ascending: false });
            if (cutoff) rTasksQ = rTasksQ.gte('created_at', cutoff);
            if (customEndIso) rTasksQ = rTasksQ.lte('created_at', customEndIso);

            // ── Query 5: Upcoming review levels
            const urLevelsQ = supabase.from('task_approval_levels').select(`
                id, task_id, level_number, status,
                task:task_id(
                    id, title, task_order, assigned_role, status, due_date, turnaround_minutes, is_manual,
                    project:project_id(id, name, client_id, client:client_id(id, name)),
                    instance:instance_id(id, name, is_paused, client:client_id(id, name)),
                    assigned_user:assigned_user_id(id, name, email)
                )
            `).eq('approver_id', userId);

            // Run all queries in parallel for speed
            const [activeRes, completedRes, myLevelsRes, rTasksRes, urLevelsRes] = await Promise.all([
                activeQ, completedQ, myLevelsQ, rTasksQ, urLevelsQ,
            ]);

            const activeData = (activeRes.data || []).filter(t => !t.instance?.is_paused);
            const completedData = (completedRes.data || []).filter(t => !t.instance?.is_paused);
            const allAssigned = [...activeData, ...completedData];

            // Load tasks where I'm the current-level approver
            const myLevels = myLevelsRes.data || [];
            let aTasks = [];
            if (myLevels.length > 0) {
                const taskIds = myLevels.map(al => al.task_id);
                const { data } = await supabase.from("tasks").select(taskSelect).in("id", taskIds);
                aTasks = (data || []).filter(t => !t.instance?.is_paused);
            }

            const rTasks = rTasksRes.data || [];
            const urLevels = urLevelsRes.data || [];

            const upcomingReviews = urLevels
                .filter(al => al.task && al.task.status !== 'PENDING_APPROVAL' && al.task.status !== 'COMPLETED' && !al.task?.instance?.is_paused)
                .filter((al, idx, arr) => arr.findIndex(x => x.task_id === al.task_id) === idx)
                .map(al => al.task);

            const reviewedTasks = rTasks.filter(t => !t.task?.instance?.is_paused);
            const workerTasks = allAssigned.filter(t => ['IN_PROGRESS', 'REJECTED'].includes(t.status));
            const pendingApprovalTasks = allAssigned.filter(t => t.status === 'PENDING_APPROVAL');
            const upcomingTasks = allAssigned.filter(t => t.status === 'LOCKED');
            const completedTasks = allAssigned.filter(t => t.status === 'COMPLETED');
            const manualTasks = allAssigned.filter(t => t.is_manual === true);
            const approvalTasks = aTasks.filter(task => {
                if (task.status !== 'PENDING_APPROVAL') return false;
                const myLevel = myLevels.find(al => al.task_id === task.id);
                return myLevel && myLevel.level_number === task.current_level;
            });

            return c.json({
                data: {
                    workerTasks,
                    pendingApprovalTasks,
                    upcomingTasks,
                    completedTasks,
                    approvalTasks,
                    reviewedTasks,
                    manualTasks,
                    upcomingReviews,
                }
            }, 200);
        }

        const applyFilters = (query) => {
            if (search) query = query.ilike("title", `%${search}%`);
            if (project_id && project_id !== 'all') query = query.eq("project_id", project_id);
            if (client_id && client_id !== 'all') {
                query = query.eq("instance.client_id", client_id);
            }
            if (type && type !== 'all') {
                if (type === 'manual') query = query.is('task_order', null);
                else if (type === 'workflow') query = query.not('task_order', 'is', null);
            }
            if (date_range && date_range !== 'All Time') {
                const now = new Date();
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                if (date_range === 'Today') {
                    query = query.gte('due_date', today.toISOString());
                } else if (date_range === 'Last 7 Days') {
                    const last7 = new Date(today);
                    last7.setDate(last7.getDate() - 7);
                    query = query.gte('due_date', last7.toISOString());
                } else if (date_range === 'Last 30 Days') {
                    const last30 = new Date(today);
                    last30.setDate(last30.getDate() - 30);
                    query = query.gte('due_date', last30.toISOString());
                }
            }
            return query;
        };

        const taskSelect = `
            *,
            project:project_id(id, name, client_id),
            instance:instance_id(id, name, client:client_id(id, name)),
            assigned_user:assigned_user_id(id, name, email),
            last_rejector:last_rejected_by(id, name, email),
            task_approval_levels(*, approver:approver_id(id, name, email)),
            task_checklist_progress(*)
        `;

        // 1. Get Counts for all tabs (unpaginated, but filtered)
        const countQueries = [
            // workerTasks
            applyFilters(supabase.from("tasks").select("id", { count: 'exact', head: true }).eq("assigned_user_id", userId).in("status", ["IN_PROGRESS", "REJECTED"])),
            // approvalTasks (awaiting MY approval)
            (async () => {
                let q = supabase.from("task_approval_levels")
                    .select("task_id, tasks!inner(status)", { count: 'exact', head: true })
                    .eq("approver_id", userId)
                    .eq("status", "PENDING")
                    .eq("tasks.status", "PENDING_APPROVAL");

                // Note: Complex filtering on counts for joined tables in Supabase can be tricky.
                // For now, we'll use a simpler count or accept slight over-counting if filters aren't applied to counts perfectly.
                // Ideally we'd use an RPC or a very specific view.
                return q;
            })(),
            // pendingApprovalTasks (submitted by me)
            applyFilters(supabase.from("tasks").select("id", { count: 'exact', head: true }).eq("assigned_user_id", userId).eq("status", "PENDING_APPROVAL")),
            // upcomingTasks
            applyFilters(supabase.from("tasks").select("id", { count: 'exact', head: true }).eq("assigned_user_id", userId).eq("status", "LOCKED")),
            // completedTasks
            applyFilters(supabase.from("tasks").select("id", { count: 'exact', head: true }).eq("assigned_user_id", userId).eq("status", "COMPLETED")),
            // reviewedTasks
            supabase.from('task_approval_history').select("id", { count: 'exact', head: true }).eq('actor_id', userId)
        ];

        const countResults = await Promise.all(countQueries);

        const counts = {
            all: (countResults[0].count || 0) + (countResults[2].count || 0) + (countResults[3].count || 0) + (countResults[4].count || 0),
            workerTasks: countResults[0].count || 0,
            approvalTasks: countResults[1].count || 0,
            pendingApprovalTasks: countResults[2].count || 0,
            upcomingTasks: countResults[3].count || 0,
            completedTasks: countResults[4].count || 0,
            reviewedTasks: countResults[5].count || 0,
        };

        // 2. Fetch paginated data for the requested tab
        let dataResult = { data: [], count: 0 };

        if (tab === 'all') {
            // All tasks related to me (either as worker or approver)
            // For simplicity, we'll return all tasks where I'm the assigned user
            dataResult = await applyFilters(supabase.from("tasks").select(taskSelect, { count: 'exact' }))
                .eq("assigned_user_id", userId)
                .order("due_date", { ascending: true }).range(from, to);
        } else if (tab === 'workerTasks') {
            let q = applyFilters(supabase.from("tasks").select(taskSelect, { count: 'exact' }))
                .eq("assigned_user_id", userId).in("status", ["IN_PROGRESS", "REJECTED"]);

            if (sort_by === 'due_date') q = q.order("due_date", { ascending: true });
            else if (sort_by === 'due_date_desc') q = q.order("due_date", { ascending: false });
            else if (sort_by === 'created_at') q = q.order("created_at", { ascending: false });
            else q = q.order("task_order", { ascending: true });

            dataResult = await q.range(from, to);
        } else if (tab === 'approvalTasks') {
            // Complex join for approval tasks
            const { data: myLevels } = await supabase.from("task_approval_levels")
                .select("task_id, level_number").eq("approver_id", userId).eq("status", "PENDING");

            if (myLevels && myLevels.length > 0) {
                const taskIds = myLevels.map(al => al.task_id);
                let q = supabase.from("tasks").select(taskSelect, { count: 'exact' }).in("id", taskIds).eq("status", "PENDING_APPROVAL");
                q = applyFilters(q);

                // We still need to filter by current_level matches level_number
                // This is hard to do in a single .in query with multiple levels per task.
                // For now, we'll fetch then filter, but that breaks server-side pagination.
                // TODO: Optimize with a view or RPC for true server-side pagination of this tab.
                const { data: allPending, count: totalCount } = await q;
                const filtered = (allPending || []).filter(task => {
                    const myLevel = myLevels.find(al => al.task_id === task.id);
                    return myLevel && myLevel.level_number === task.current_level;
                });
                dataResult = {
                    data: filtered.slice(from, to + 1),
                    count: filtered.length // This might be less than totalCount
                };
            }
        } else if (tab === 'pendingApprovalTasks') {
            let q = applyFilters(supabase.from("tasks").select(taskSelect, { count: 'exact' }))
                .eq("assigned_user_id", userId).eq("status", "PENDING_APPROVAL");

            if (sort_by === 'due_date') q = q.order("due_date", { ascending: true });
            else if (sort_by === 'due_date_desc') q = q.order("due_date", { ascending: false });
            else if (sort_by === 'created_at') q = q.order("created_at", { ascending: false });
            else q = q.order("task_order", { ascending: true });

            dataResult = await q.range(from, to);
        } else if (tab === 'upcomingTasks') {
            dataResult = await applyFilters(supabase.from("tasks").select(taskSelect, { count: 'exact' }))
                .eq("assigned_user_id", userId).eq("status", "LOCKED")
                .order("task_order", { ascending: true }).range(from, to);
        } else if (tab === 'completedTasks') {
            dataResult = await applyFilters(supabase.from("tasks").select(taskSelect, { count: 'exact' }))
                .eq("assigned_user_id", userId).eq("status", "COMPLETED")
                .order("created_at", { ascending: false }).range(from, to);
        } else if (tab === 'reviewedTasks') {
            dataResult = await supabase.from('task_approval_history').select(`
                id, task_id, level_number, action, comment, created_at,
                task:task_id(
                    id, title, task_order, assigned_role, status,
                    project:project_id(id, name, client_id, client:client_id(id, name)),
                    instance:instance_id(id, name, client:client_id(id, name)),
                    assigned_user:assigned_user_id(id, name, email)
                )
            `, { count: 'exact' }).eq('actor_id', userId).order('created_at', { ascending: false }).range(from, to);
        }

        return c.json({
            data: dataResult.data || [],
            counts,
            pagination: {
                page: pageNum,
                limit: limitNum,
                totalCount: dataResult.count || 0,
                totalPages: Math.ceil((dataResult.count || 0) / limitNum)
            }
        }, 200);
    } catch (error) {
        return c.json({ message: error.message }, 500);
    }
};



export const fetchTasksforMember = async (c) => {
    try {
        const { project_id, instance_id, page = 1, limit = 10, search, assigned_user_id } = c.req.query();
        const company_id = c.get("user").company_id;

        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);
        const from = (pageNum - 1) * limitNum;
        const to = from + limitNum - 1;
        const now = new Date().toISOString();

        const supabase = getSupabase(c.env);
        let query = supabase
            .from("tasks")
            .select(`
                *,
                assigned_user:assigned_user_id(id, name, email),
                project:project_id(id, name, client_id, client:client_id(id, name)),
                instance:instance_id!inner(id, name, status, client:client_id(id, name)),
                task_approval_levels(*, approver:approver_id(id, name, email)),
                task_checklist_progress(*)
            `, { count: 'exact' })
            // Exclude tasks whose instance is paused — stale due_dates would cause false overdue
            .not('instance_id.status', 'eq', 'PAUSED')
            .order("due_date", { ascending: true });

        if (project_id) query = query.eq("project_id", project_id);
        if (instance_id) query = query.eq("instance_id", instance_id);
        if (company_id) query = query.eq("company_id", company_id);

        if (assigned_user_id && assigned_user_id !== 'all') {
            const { data: workerTasks } = await supabase
                .from("tasks").select("id").eq("assigned_user_id", assigned_user_id).in("status", ["IN_PROGRESS", "REJECTED"]);
            const { data: approverLevels } = await supabase
                .from("task_approval_levels").select("task_id, level_number").eq("approver_id", assigned_user_id).eq("status", "PENDING");

            let activeTaskIds = workerTasks?.map(t => t.id) || [];

            if (approverLevels && approverLevels.length > 0) {
                const possibleTaskIds = [...new Set(approverLevels.map(l => l.task_id))];
                const { data: pendingTasks } = await supabase
                    .from("tasks").select("id, current_level").in("id", possibleTaskIds).eq("status", "PENDING_APPROVAL");

                const validApproverTaskIds = pendingTasks?.filter(t =>
                    approverLevels.some(l => l.task_id === t.id && l.level_number === t.current_level)
                ).map(t => t.id) || [];
                activeTaskIds = [...activeTaskIds, ...validApproverTaskIds];
            }
            activeTaskIds = [...new Set(activeTaskIds)];
            if (activeTaskIds.length === 0) return c.json({ data: [], count: 0, page: pageNum, limit: limitNum, totalPages: 0 }, 200);

            query = query.in("id", activeTaskIds);
        }

        if (search) {
            // Find users matching search
            const { data: searchUsers } = await supabase.from('users').select('id').ilike('name', `%${search}%`);
            const userIds = searchUsers?.map(u => u.id) || [];

            // Find instances matching search
            const { data: searchInstances } = await supabase.from('instances').select('id').ilike('name', `%${search}%`);
            const instanceIds = searchInstances?.map(i => i.id) || [];

            let orConditions = [`title.ilike.%${search}%`];
            if (userIds.length > 0) orConditions.push(`assigned_user_id.in.(${userIds.join(',')})`);
            if (instanceIds.length > 0) orConditions.push(`instance_id.in.(${instanceIds.join(',')})`);

            query = query.or(orConditions.join(','));
        }

        query = query.or(`status.in.("IN_PROGRESS","PENDING_APPROVAL"),and(due_date.lt.${now},status.not.in.("COMPLETED","APPROVED","REJECTED"))`);
        query = query.range(from, to);

        const { data, count, error } = await query;
        if (error) return c.json({ message: error.message }, 400);

        return c.json({
            data, count, page: pageNum, limit: limitNum, totalPages: Math.ceil((count || 0) / limitNum)
        }, 200);
    } catch (error) {
        return c.json({ message: error.message }, 500);
    }
};

export const fetchOverdueTasksForMember = async (c) => {
    try {
        const {
            project_id, instance_id, page = 1, limit = 100, search,
            assigned_user_id, case: filterCase, dateRange, startDate, endDate
        } = c.req.query();
        if (!assigned_user_id) return c.json({ message: "assigned_user_id is required" }, 400);

        const company_id = c.get("user").company_id;
        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);
        const from = (pageNum - 1) * limitNum;
        const to = from + limitNum - 1;

        const now = new Date();
        const todayEnd = new Date(now);
        todayEnd.setHours(23, 59, 59, 999);
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(23, 59, 59, 999);

        const supabase = getSupabase(c.env);

        // Build date range limits (for created_at / acted_at filtering)
        let fromDate = new Date(0);
        let toDateISO = null;
        if (dateRange && dateRange !== 'All Time' && dateRange !== 'Custom') {
            const todayLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            if (dateRange === 'Today') fromDate = todayLocal;
            else if (dateRange === 'Yesterday') {
                fromDate = new Date(todayLocal); fromDate.setDate(fromDate.getDate() - 1);
                toDateISO = todayLocal.toISOString();
            } else if (dateRange === 'Last 7 Days') {
                fromDate = new Date(todayLocal); fromDate.setDate(fromDate.getDate() - 7);
            } else if (dateRange === 'Last 30 Days') {
                fromDate = new Date(todayLocal); fromDate.setDate(fromDate.getDate() - 30);
            }
        } else if (dateRange === 'Custom' && startDate && endDate) {
            fromDate = new Date(startDate);
            const end = new Date(endDate); end.setHours(23, 59, 59, 999);
            toDateISO = end.toISOString();
        }
        const fromISO = fromDate.toISOString();

        // Helper: check if a date is in the selected range
        const inDateRange = (d) => {
            if (!d) return false;
            const dt = new Date(d);
            if (dateRange === 'All Time') return true;
            if (dt < fromDate) return false;
            if (toDateISO && dt > new Date(toDateISO)) return false;
            return true;
        };

        const taskSelect = `
            *,
            assigned_user:assigned_user_id(id, name, email),
            project:project_id(id, name, client_id, client:client_id(id, name)),
            instance:instance_id!inner(id, name, status, client:client_id(id, name)),
            task_approval_levels(*, approver:approver_id(id, name, email)),
            task_checklist_progress(*)
        `;

        const enrichedData = [];

        if (filterCase === 'late') {
            // ================================================================
            // LATE CASE: tasks that were completed/approved AFTER their deadline
            // ================================================================

            // ── 1. Worker late tasks (existing logic) ──────────────────────────
            let workerLateQ = supabase
                .from("tasks")
                .select(taskSelect)
                .eq("assigned_user_id", assigned_user_id)
                .eq("company_id", company_id)
                .in("status", ["COMPLETED", "APPROVED"])
                .in("instance.status", ["ONGOING", "COMPLETED"])
                .order("due_date", { ascending: true });

            if (project_id && project_id !== 'all') workerLateQ = workerLateQ.eq("project_id", project_id);
            if (instance_id && instance_id !== 'all') workerLateQ = workerLateQ.eq("instance_id", instance_id);

            // Date filter on created_at (matching existing behaviour)
            if (dateRange && dateRange !== 'All Time') {
                workerLateQ = workerLateQ.gte('created_at', fromISO);
                if (toDateISO) workerLateQ = workerLateQ.lte('created_at', toDateISO);
                if (dateRange === 'Yesterday') workerLateQ = workerLateQ.lt('created_at', toDateISO);
            }
            if (search) workerLateQ = workerLateQ.or(`title.ilike.%${search}%`);

            const { data: workerLateTasks } = await workerLateQ;

            (workerLateTasks || []).forEach(task => {
                const dueDateToUse = task.due_date ? new Date(task.due_date) : null;
                const completedAt = task.submitted_at ? new Date(task.submitted_at) : null;
                if (!dueDateToUse || !completedAt || completedAt <= dueDateToUse) return;

                const days_overdue = Math.max(1, Math.floor((completedAt - dueDateToUse) / (1000 * 60 * 60 * 24)));

                enrichedData.push({
                    ...task,
                    due_category: 'OVERDUE',
                    days_overdue,
                    is_review_task: false,
                    reviewer_due_date: null,
                    effective_due_date: task.due_date,
                });
            });

            // ── 2. Reviewer late tasks (NEW) ──────────────────────────────────
            // Approval levels where this member approved AFTER their level due_date.
            // NOTE: No company_id filter — it's nullable in existing records;
            //       approver_id scoping is sufficient.
            // NOTE: No DB-level null guards — JS filter below handles null due_date/acted_at.
            const { data: reviewerLateRaw } = await supabase
                .from('task_approval_levels')
                .select('task_id, level_number, due_date, acted_at')
                .eq('approver_id', assigned_user_id)
                .eq('status', 'APPROVED');

            // Filter: both due_date and acted_at must exist, acted_at > due_date, and in date range
            const reviewerLateLevels = (reviewerLateRaw || []).filter(l => {
                if (!l.due_date || !l.acted_at) return false; // can't determine lateness without both
                const actedAt = new Date(l.acted_at);
                const levelDue = new Date(l.due_date);
                if (actedAt <= levelDue) return false; // not late
                if (!inDateRange(l.acted_at)) return false; // outside selected range
                return true;
            });

            if (reviewerLateLevels.length > 0) {
                const reviewerLateTaskIds = [...new Set(reviewerLateLevels.map(l => l.task_id))];
                let reviewerLateQ = supabase
                    .from("tasks")
                    .select(taskSelect)
                    .in("id", reviewerLateTaskIds)
                    .eq("company_id", company_id);

                if (project_id && project_id !== 'all') reviewerLateQ = reviewerLateQ.eq("project_id", project_id);
                if (instance_id && instance_id !== 'all') reviewerLateQ = reviewerLateQ.eq("instance_id", instance_id);
                if (search) reviewerLateQ = reviewerLateQ.or(`title.ilike.%${search}%`);

                const { data: reviewerLateTasks } = await reviewerLateQ;

                (reviewerLateTasks || []).forEach(task => {
                    const levelInfo = reviewerLateLevels.find(l => l.task_id === task.id);
                    if (!levelInfo) return;

                    const actedAt = new Date(levelInfo.acted_at);
                    const levelDue = new Date(levelInfo.due_date);
                    const days_overdue = Math.max(1, Math.floor((actedAt - levelDue) / (1000 * 60 * 60 * 24)));

                    enrichedData.push({
                        ...task,
                        due_category: 'OVERDUE',
                        days_overdue,
                        is_review_task: true,
                        reviewer_due_date: levelInfo.due_date,
                        effective_due_date: levelInfo.due_date,
                    });
                });
            }

        } else {
            // ================================================================
            // OVERDUE CASE: active tasks past their deadline (not yet done)
            // ================================================================

            // ── 1. Worker task IDs ────────────────────────────────────────────
            const { data: workerTaskIds } = await supabase
                .from("tasks")
                .select("id")
                .eq("assigned_user_id", assigned_user_id)
                .in("status", ["IN_PROGRESS", "REJECTED"]);

            // ── 2. Current reviewer levels for this member ──────────────────────
            // Fetch all PENDING approval levels where this member is the approver.
            // NOTE: No company_id filter — nullable in existing records; approver_id is sufficient.
            const { data: pendingLevels } = await supabase
                .from('task_approval_levels')
                .select('task_id, level_number, due_date')
                .eq('approver_id', assigned_user_id)
                .eq('status', 'PENDING');

            // Among those, find which ones are the current active level
            const reviewerLevelByTaskId = {};
            if (pendingLevels && pendingLevels.length > 0) {
                const possibleTaskIds = pendingLevels.map(l => l.task_id);
                const { data: pendingTasks } = await supabase
                    .from("tasks")
                    .select("id, current_level")
                    .in("id", possibleTaskIds)
                    .eq("status", "PENDING_APPROVAL");

                (pendingTasks || []).forEach(t => {
                    const level = pendingLevels.find(l => l.task_id === t.id && l.level_number === t.current_level);
                    if (level) reviewerLevelByTaskId[t.id] = level;
                });
            }

            // Combine all task IDs (worker + reviewer) for the fetch
            const workerIds = (workerTaskIds || []).map(t => t.id);
            const reviewerIds = Object.keys(reviewerLevelByTaskId);
            const allTaskIds = [...new Set([...workerIds, ...reviewerIds])];

            if (allTaskIds.length === 0) return c.json({ data: [], count: 0, page: pageNum, limit: limitNum, totalPages: 0 }, 200);

            // ── 3. Fetch full task data ──────────────────────────────────────────
            let taskQ = supabase
                .from("tasks")
                .select(taskSelect)
                .in("id", allTaskIds)
                .eq("company_id", company_id)
                .in("instance.status", ["ONGOING", "COMPLETED"])
                .order("due_date", { ascending: true });

            if (project_id && project_id !== 'all') taskQ = taskQ.eq("project_id", project_id);
            if (instance_id && instance_id !== 'all') taskQ = taskQ.eq("instance_id", instance_id);
            if (search) taskQ = taskQ.or(`title.ilike.%${search}%`);

            // Apply date filter on created_at (for worker tasks consistency)
            if (dateRange && dateRange !== 'All Time') {
                taskQ = taskQ.gte('created_at', fromISO);
                if (toDateISO) taskQ = taskQ.lte('created_at', toDateISO);
                if (dateRange === 'Yesterday') taskQ = taskQ.lt('created_at', toDateISO);
            }

            const { data: taskData, error } = await taskQ;
            if (error) return c.json({ message: error.message }, 400);

            // ── 4. Enrich each task with backend-computed fields ────────────────────
            (taskData || []).forEach(task => {
                const isWorkerTask = workerIds.includes(task.id);
                const reviewerLevel = reviewerLevelByTaskId[task.id];
                const isReviewTask = !!reviewerLevel && !isWorkerTask; // prioritise worker classification

                // Use the reviewer's per-level due_date, otherwise fall back to tasks.due_date
                const effectiveDueDateStr = isReviewTask && reviewerLevel.due_date
                    ? reviewerLevel.due_date
                    : task.due_date;

                if (!effectiveDueDateStr) return; // skip tasks with no deadline at all

                const effectiveDueDate = new Date(effectiveDueDateStr);

                // For overdue modal we show: OVERDUE, DUE_TODAY, DUE_TOMORROW
                // Filter: only include tasks due on or before tomorrow end
                if (effectiveDueDate > tomorrow) return;

                let due_category = 'ACTIVE';
                let days_overdue = 0;

                if (effectiveDueDate < now) {
                    due_category = 'OVERDUE';
                    days_overdue = Math.floor((now.getTime() - effectiveDueDate.getTime()) / (1000 * 60 * 60 * 24));
                } else if (effectiveDueDate <= todayEnd) {
                    due_category = 'DUE_TODAY';
                } else {
                    due_category = 'DUE_TOMORROW';
                }

                enrichedData.push({
                    ...task,
                    due_category,
                    days_overdue,
                    is_review_task: isReviewTask,
                    reviewer_due_date: isReviewTask ? reviewerLevel.due_date : null,
                    effective_due_date: effectiveDueDateStr,
                });
            });

            // Sort: overdue first, then by effective_due_date ascending
            enrichedData.sort((a, b) => {
                const order = { OVERDUE: 0, DUE_TODAY: 1, DUE_TOMORROW: 2, ACTIVE: 3 };
                const diff = (order[a.due_category] ?? 4) - (order[b.due_category] ?? 4);
                if (diff !== 0) return diff;
                return new Date(a.effective_due_date) - new Date(b.effective_due_date);
            });
        }

        const totalCount = enrichedData.length;
        const pagedData = enrichedData.slice(from, to + 1);

        return c.json({
            data: pagedData, count: totalCount, page: pageNum, limit: limitNum,
            totalPages: Math.ceil(totalCount / limitNum)
        }, 200);

    } catch (error) {
        return c.json({ message: error.message }, 500);
    }
};

export const fetchusertaskfordeletion = async (c) => {
    try {
        const { user_id } = c.req.param();
        const company_id = c.get("user").company_id;

        const supabase = getSupabase(c.env);

        // 1. Get task IDs where user is worker (assigned_user_id)
        const { data: workerTasks } = await supabase
            .from("tasks")
            .select("id")
            .eq("assigned_user_id", user_id)
            .eq("company_id", company_id)
            .neq("status", "COMPLETED");

        // 2. Get task IDs where user is an approver (in task_approval_levels)
        const { data: approverTasks } = await supabase
            .from("task_approval_levels")
            .select("task_id, tasks!inner(id, company_id, status)")
            .eq("approver_id", user_id)
            .eq("tasks.company_id", company_id)
            .neq("tasks.status", "COMPLETED");

        const taskIds = [...new Set([
            ...(workerTasks?.map(t => t.id) || []),
            ...(approverTasks?.map(t => t.task_id) || [])
        ])];

        if (taskIds.length === 0) return c.json({ data: [], count: 0 }, 200);

        // 3. Fetch full task details
        let query = supabase
            .from("tasks")
            .select(`
                *,
                assigned_user:assigned_user_id(id, name, email),
                project:project_id(id, name, client_id, client:client_id(id, name)),
                instance:instance_id(id, name, client:client_id(id, name)),
                task_approval_levels(*, approver:approver_id(id, name, email)),
                task_checklist_progress(*)
            `, { count: 'exact' })
            .in("id", taskIds)
            .order("due_date", { ascending: true });

        const { data, count, error } = await query;
        if (error) return c.json({ message: error.message }, 400);

        return c.json({ data, count }, 200);
    } catch (error) {
        return c.json({ message: error.message }, 500);
    }
};

export const fetchTaskById = async (c) => {
    try {
        const id = c.req.param("id");
        const supabase = getSupabase(c.env);

        const taskSelect = `
            *,
            project:project_id(id, name),
            instance:instance_id(id, name, is_paused, client:client_id(id, name)),
            assigned_user:assigned_user_id(id, name, email, platform_role, workflow_role),
            last_rejector:last_rejected_by(id, name, email),
            task_approval_levels(*, approver:approver_id(id, name, email)),
            task_checklist_progress(*),
            task_bypass_logs(*, performer:performed_by(id, name)),
            task_reassignments(*, from_user:from_user_id(id, name), to_user:to_user_id(id, name), reassigner:reassigned_by(id, name)),
            task_sla_extensions(*, requester:requested_by(id, name))
        `;

        const { data, error } = await supabase.from("tasks")
            .select(taskSelect)
            .eq("id", id)
            .single();

        if (error) return c.json({ message: error.message }, 400);

        return c.json({ data }, 200);
    } catch (error) {
        return c.json({ message: error.message }, 500);
    }
};