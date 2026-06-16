import { getSupabase } from "../../config/supabase.js";

function buildDateRange(query) {
  const now = new Date();
  let from = query.from
    ? new Date(query.from)
    : new Date(now.getFullYear(), now.getMonth(), 1);
  let to = query.to ? new Date(query.to) : now;
  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);
  return { from: from.toISOString(), to: to.toISOString() };
}

// Weighted quality score per task based on how many times it was rejected.
// 0 rejections = 100 (first-pass approved)
// 1 rejection  = 75  (needed one rework)
// 2 rejections = 50  (needed two reworks)
// 3+ rejections = 25 (frequently rejected)
function taskQualityScore(rejections) {
  if (rejections === 0) return 100;
  if (rejections === 1) return 75;
  if (rejections === 2) return 50;
  return 25;
}

export const getTeamPerformance = async (c) => {
  try {
    const { from, to } = buildDateRange(c.req.query());
    const companyId = c.get("user").company_id;
    if (!companyId)
      return c.json(
        { message: "Could not determine company for this user" },
        400,
      );

    const supabase = getSupabase(c.env);
    const { data: members, error: membersError } = await supabase
      .from("users")
      .select("id, name, platform_role, workflow_role, is_active")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .in("platform_role", ["member", "controller"]);

    if (membersError) return c.json({ message: membersError.message }, 400);
    if (!members || members.length === 0) return c.json({ data: [] }, 200);

    const memberIds = members.map((m) => m.id);

    // Query 1: Completed tasks as WORKER (from performance logs)
    const { data: perfLogs, error: perfError } = await supabase
      .from("task_performance_logs")
      .select("user_id, status, submitted_at, task_id, actual_working_minutes")
      .in("user_id", memberIds)
      .gte("submitted_at", from)
      .lte("submitted_at", to);

    if (perfError) return c.json({ message: perfError.message }, 400);

    // Query 2: Completed tasks as REVIEWER (from approval history)
    const { data: completedApprovals, error: appHistoryErr } = await supabase
      .from("task_approval_history")
      .select("actor_id, action, created_at, task_id, task:task_id(due_date, instance:instance_id(status))")
      .in("actor_id", memberIds)
      .eq("action", "APPROVED")
      .gte("created_at", from)
      .lte("created_at", to);

    if (appHistoryErr) return c.json({ message: appHistoryErr.message }, 400);

    const { data: activeTasks, error: activeError } = await supabase
      .from("tasks")
      .select(
        `
                id, assigned_user_id, status, due_date, assigned_at,
                instance:instance_id(status)
            `,
      )
      .in("assigned_user_id", memberIds)
      .not("status", "in", '("COMPLETED","LOCKED")');

    if (activeError) return c.json({ message: activeError.message }, 400);

    const { data: approvalLevels, error: appErr } = await supabase
      .from("task_approval_levels")
      .select(
        `
                approver_id,
                level_number,
                task:task_id(
                    id, assigned_user_id, status, due_date, assigned_at,
                    current_level,
                    instance:instance_id(status)
                )
            `,
      )
      .in("approver_id", memberIds)
      .eq("status", "PENDING");

    if (appErr) return c.json({ message: appErr.message }, 400);

    // Filter out tasks from paused instances
    const filteredActiveTasks = (activeTasks || []).filter(
      (t) => t.instance?.status?.toUpperCase() !== "PAUSED",
    );

    // Fetch rejection counts for all completed tasks in the period
    const completedTaskIds = (perfLogs || []).map((l) => l.task_id);
    const rejectionsByTask = {};

    if (completedTaskIds.length > 0) {
      const { data: approvalHistory, error: historyError } = await supabase
        .from("task_approval_history")
        .select("task_id, action")
        .in("task_id", completedTaskIds)
        .eq("action", "REJECTED");

      if (!historyError && approvalHistory) {
        for (const row of approvalHistory) {
          rejectionsByTask[row.task_id] =
            (rejectionsByTask[row.task_id] || 0) + 1;
        }
      }
    }

    const now = new Date();

    const result = members.map((member) => {
      // Worker tasks completed (from performance logs)
      const workerLogs = (perfLogs || []).filter((l) => l.user_id === member.id);
      const workerCompletedCount = workerLogs.length;
      const workerOnTimeCount = workerLogs.filter((l) => l.status === "On-time").length;
      const workerLateCount = workerLogs.filter((l) => l.status === "Overdue").length;

      // Reviewer tasks completed (from approval history)
      const reviewerApprovals = (completedApprovals || [])
        .filter((a) => a.actor_id === member.id && a.task?.instance?.status?.toUpperCase() !== "PAUSED")
        .map((a) => ({
          task_id: a.task_id,
          due_date: a.task?.due_date,
          acted_at: a.created_at,
        }));

      const reviewerCompletedCount = reviewerApprovals.length;
      const reviewerOnTimeCount = reviewerApprovals.filter((a) => {
        if (!a.due_date || !a.acted_at) return false;
        return new Date(a.acted_at) <= new Date(a.due_date);
      }).length;
      const reviewerLateCount = reviewerApprovals.filter((a) => {
        if (!a.due_date || !a.acted_at) return false;
        return new Date(a.acted_at) > new Date(a.due_date);
      }).length;

      // Combined completed count
      const completedCount = workerCompletedCount + reviewerCompletedCount;
      const onTimeCount = workerOnTimeCount + reviewerOnTimeCount;
      const lateCount = workerLateCount + reviewerLateCount;

      const memberActiveTasks = (filteredActiveTasks || []).filter(
        (t) => t.assigned_user_id === member.id,
      );

      const pendingApprovals = (approvalLevels || [])
        .filter(
          (l) =>
            l.approver_id === member.id &&
            l.task &&
            l.task.status === "PENDING_APPROVAL" &&
            l.task.current_level === l.level_number &&
            l.task.instance?.status?.toUpperCase() !== "PAUSED",
        )
        .map((l) => ({ ...l.task, is_approval_task: true }));

      const combinedPool = [...memberActiveTasks, ...pendingApprovals];
      const deduplicatedActiveTasks = Array.from(
        new Map(combinedPool.map((t) => [t.id, t])).values(),
      );

      const inProgressCount = deduplicatedActiveTasks.filter(
        (t) =>
          t.status === "IN_PROGRESS" ||
          t.status === "PENDING_APPROVAL" ||
          t.status === "REJECTED",
      ).length;

      const overdueTasksList = deduplicatedActiveTasks.filter(
        (t) => t.due_date && new Date(t.due_date) < now,
      );
      const overdueCount = overdueTasksList.length;

      const pendingCount = deduplicatedActiveTasks.filter(
        (t) => t.status === "LOCKED",
      ).length;

      const totalTasks = completedCount + deduplicatedActiveTasks.length;

      const onTimeDelivery =
        completedCount > 0
          ? Math.round((onTimeCount / completedCount) * 100)
          : 0;

      const badTasks = lateCount + overdueCount;
      const taskEfficiency =
        totalTasks > 0 ? Math.round(-(badTasks / totalTasks) * 100) : 0;

      // Quality Score: average weighted score across all completed tasks (worker only)
      // Reviewer quality is measured differently (approval accuracy, not rejection count)
      let qualityScore = null;
      if (workerCompletedCount > 0) {
        const totalQuality = workerLogs.reduce((sum, log) => {
          const rejections = rejectionsByTask[log.task_id] || 0;
          return sum + taskQualityScore(rejections);
        }, 0);
        qualityScore = Math.round(totalQuality / workerCompletedCount);
      }

      let totalWorkingMinutes = 0;
      workerLogs.forEach((l) => {
        totalWorkingMinutes += l.actual_working_minutes || 0;
      });
      const avgReviewTime = workerLogs.length > 0 ? Number((totalWorkingMinutes / workerLogs.length / 60).toFixed(1)) : 0;

      return {
        id: member.id,
        name: member.name,
        role: member.workflow_role || member.platform_role,
        totalTasks,
        completed: completedCount,
        inProgress: inProgressCount,
        pending: pendingCount,
        late: lateCount,
        overdue: overdueCount,
        onTimeDelivery,
        taskEfficiency,
        qualityScore,
        avgReviewTime,
      };
    });

    return c.json({ data: result }, 200);
  } catch (err) {
    return c.json({ message: err.message }, 500);
  }
};

/**
 * GET /performance/workload
 * Query params: date (single day, e.g. 2026-04-27) or from/to (range)
 *
 * Returns per-member workload data including:
 * - Task count and completion progress
 * - Total turnaround minutes (workload)
 * - Per-task time delta (saved or delayed)
 */
export const getWorkloadData = async (c) => {
  try {
    const companyId = c.get("user").company_id;
    if (!companyId)
      return c.json({ message: "Could not determine company" }, 400);

    const query = c.req.query();
    const supabase = getSupabase(c.env);

    // Build date range
    let fromDate, toDate;
    if (query.date) {
      // Single day mode
      const d = new Date(query.date);
      fromDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      toDate = new Date(
        d.getFullYear(),
        d.getMonth(),
        d.getDate(),
        23,
        59,
        59,
        999,
      );
    } else {
      fromDate = query.from ? new Date(query.from) : new Date();
      toDate = query.to ? new Date(query.to) : new Date();
      fromDate.setHours(0, 0, 0, 0);
      toDate.setHours(23, 59, 59, 999);
    }

    const fromISO = fromDate.toISOString();
    const toISO = toDate.toISOString();

    const { data: members, error: membersError } = await supabase
      .from("users")
      .select("id, name, platform_role, workflow_role, is_active")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .in("platform_role", ["member", "controller"]);

    if (membersError) return c.json({ message: membersError.message }, 400);
    if (!members || members.length === 0) return c.json({ data: [] }, 200);

    const memberIds = members.map((m) => m.id);

    // Query 1: All active tasks for these members (IN_PROGRESS, PENDING_APPROVAL, REJECTED)
    const { data: activeTasks, error: activeErr } = await supabase
      .from("tasks")
      .select(
        `
                id, title, status, assigned_user_id,
                turnaround_minutes, estimated_minutes, total_working_minutes,
                assigned_at, due_date, submitted_at, approved_at, task_order,
                instance:instance_id(id, name, status, client:client_id(id, name))
            `,
      )
      .eq("company_id", companyId)
      .in("assigned_user_id", memberIds)
      .in("status", ["IN_PROGRESS", "PENDING_APPROVAL", "REJECTED"]);

    if (activeErr) return c.json({ message: activeErr.message }, 400);

    // Query 2: Tasks with due_date in the selected range (includes LOCKED, COMPLETED, etc.)
    const { data: dueDateTasks, error: dueErr } = await supabase
      .from("tasks")
      .select(
        `
                id, title, status, assigned_user_id,
                turnaround_minutes, estimated_minutes, total_working_minutes,
                assigned_at, due_date, submitted_at, approved_at, task_order,
                instance:instance_id(id, name, status, client:client_id(id, name))
            `,
      )
      .eq("company_id", companyId)
      .in("assigned_user_id", memberIds)
      .gte("due_date", fromISO)
      .lte("due_date", toISO);

    if (dueErr) return c.json({ message: dueErr.message }, 400);

    // Query 3: Tasks completed in this range (submitted_at falls in range)
    const { data: completedInRange, error: compErr } = await supabase
      .from("tasks")
      .select(
        `
                id, title, status, assigned_user_id,
                turnaround_minutes, estimated_minutes, total_working_minutes,
                assigned_at, due_date, submitted_at, approved_at, task_order,
                instance:instance_id(id, name, status, client:client_id(id, name))
            `,
      )
      .eq("company_id", companyId)
      .in("assigned_user_id", memberIds)
      .in("status", ["COMPLETED", "APPROVED"])
      .gte("submitted_at", fromISO)
      .lte("submitted_at", toISO);

    if (compErr) return c.json({ message: compErr.message }, 400);

    // Query 4: Tasks where these members are currently required to approve
    const { data: approvalLevels, error: appErr } = await supabase
      .from("task_approval_levels")
      .select(
        `
                approver_id,
                level_number,
                task:task_id(
                    id, title, status, assigned_user_id, current_level,
                    turnaround_minutes, estimated_minutes, total_working_minutes,
                    assigned_at, due_date, submitted_at, approved_at, task_order,
                    instance:instance_id(id, name, status, client:client_id(id, name))
                )
            `,
      )
      .in("approver_id", memberIds)
      .eq("status", "PENDING");

    if (appErr) return c.json({ message: appErr.message }, 400);

    // Query 5: Completed reviewer tasks in the date range
    const { data: completedReviewerTasks, error: reviewerErr } = await supabase
      .from("task_approval_history")
      .select(
        `
                actor_id,
                created_at,
                task:task_id(
                    id, title, status, assigned_user_id,
                    turnaround_minutes, estimated_minutes, total_working_minutes,
                    assigned_at, due_date, submitted_at, approved_at, task_order,
                    instance:instance_id(id, name, status, client:client_id(id, name))
                )
            `,
      )
      .in("actor_id", memberIds)
      .eq("action", "APPROVED")
      .gte("created_at", fromISO)
      .lte("created_at", toISO);

    if (reviewerErr) return c.json({ message: reviewerErr.message }, 400);

    // Merge and deduplicate by task id for general pool
    const allTasksMap = new Map();
    [
      ...(activeTasks || []),
      ...(dueDateTasks || []),
      ...(completedInRange || []),
      ...(completedReviewerTasks || []).map(r => r.task).filter(Boolean),
    ].forEach((t) => {
      // Only include tasks where the instance is NOT paused
      if (t.instance?.status?.toUpperCase() !== "PAUSED") {
        allTasksMap.set(t.id, t);
      }
    });
    const tasks = Array.from(allTasksMap.values());

    const now = new Date();

    // Group tasks by member
    const result = members.map((member) => {
      // Tasks directly assigned to this member as a worker
      const memberTasks = (tasks || []).filter(
        (t) => t.assigned_user_id === member.id,
      );

      // Tasks where this member is the current approver (filter out paused instances)
      const pendingApprovals = (approvalLevels || [])
        .filter(
          (l) =>
            l.approver_id === member.id &&
            l.task &&
            l.task.status === "PENDING_APPROVAL" &&
            l.task.current_level === l.level_number &&
            l.task.instance?.status?.toUpperCase() !== "PAUSED",
        )
        .map((l) => ({ ...l.task, is_approval_task: true }));

      // Completed reviewer tasks for this member in the date range
      const completedReviewerTasksForMember = (completedReviewerTasks || [])
        .filter((r) => r.actor_id === member.id && r.task && r.task.instance?.status?.toUpperCase() !== "PAUSED")
        .map((r) => ({ ...r.task, is_approval_task: true, reviewer_completed_at: r.created_at }));

      // Combine all sets
      const combinedPool = [...memberTasks, ...pendingApprovals, ...completedReviewerTasksForMember];
      const deduplicated = Array.from(
        new Map(combinedPool.map((t) => [t.id, t])).values(),
      );

      // Filter tasks relevant to this date range
      const relevantTasks = deduplicated.filter((t) => {
        const dueDate = t.due_date ? new Date(t.due_date) : null;
        const assignedAt = t.assigned_at ? new Date(t.assigned_at) : null;
        const submittedAt = t.submitted_at ? new Date(t.submitted_at) : null;
        const isDone = ["COMPLETED", "APPROVED"].includes(t.status);

        // 1. If task is completed, check relevance based on role
        if (isDone) {
          // For reviewer tasks, check when they approved it
          if (t.is_approval_task && t.reviewer_completed_at) {
            const reviewerCompletedAt = new Date(t.reviewer_completed_at);
            return reviewerCompletedAt >= fromDate && reviewerCompletedAt <= toDate;
          }
          // For worker tasks, check when it was submitted
          return (
            submittedAt && submittedAt >= fromDate && submittedAt <= toDate
          );
        }

        // 2. If it's a pending approval for this person, it's ALWAYS relevant regardless of date range
        // (as long as we are looking at 'Today' or the range includes current active time)
        if (t.is_approval_task) return true;

        // For non-completed tasks (IN_PROGRESS, LOCKED, etc.):
        // 3. Due date falls in range
        if (dueDate && dueDate >= fromDate && dueDate <= toDate) return true;
        // 4. Was assigned during this range
        if (assignedAt && assignedAt >= fromDate && assignedAt <= toDate)
          return true;
        // 5. Is currently active and was assigned before this range (spans into it)
        if (
          assignedAt &&
          assignedAt < fromDate &&
          ["IN_PROGRESS", "PENDING_APPROVAL", "REJECTED"].includes(t.status)
        )
          return true;

        return false;
      });

      const totalTasks = relevantTasks.length;
      const completedTasks = relevantTasks.filter(
        (t) => t.status === "COMPLETED" || t.status === "APPROVED",
      ).length;
      const inProgressTasks = relevantTasks.filter((t) =>
        ["IN_PROGRESS", "PENDING_APPROVAL", "REJECTED"].includes(t.status),
      ).length;
      const lockedTasks = relevantTasks.filter(
        (t) => t.status === "LOCKED",
      ).length;

      // Total workload in minutes (use estimated_minutes = actual work hours, not turnaround SLA)
      const totalMinutes = relevantTasks.reduce(
        (sum, t) => sum + (t.estimated_minutes || 0),
        0,
      );
      const completedMinutes = relevantTasks
        .filter((t) => t.status === "COMPLETED" || t.status === "APPROVED")
        .reduce((sum, t) => sum + (t.estimated_minutes || 0), 0);

      // Shape tasks with time delta
      const shapedTasks = relevantTasks.map((t) => {
        const turnaround = t.turnaround_minutes || t.estimated_minutes || 0;
        const actual = t.total_working_minutes || 0;
        let timeDelta = null; // in minutes

        if (t.status === "COMPLETED" || t.status === "APPROVED") {
          if (turnaround > 0) {
            timeDelta = actual - turnaround; // negative = saved, positive = delayed
          } else if (t.due_date && t.submitted_at) {
            // Fallback: compare due_date vs submitted_at
            const diff =
              new Date(t.submitted_at).getTime() -
              new Date(t.due_date).getTime();
            timeDelta = Math.round(diff / (1000 * 60));
          }
        }

        return {
          id: t.id,
          title: t.title + (t.is_approval_task ? " (Approval Required)" : ""),
          instance: t.instance?.name || "—",
          client: t.instance?.client?.name || "—",
          status: t.status,
          estimated_minutes: t.estimated_minutes || 0,
          turnaround_minutes: turnaround,
          total_working_minutes: actual,
          assigned_at: t.assigned_at,
          due_date: t.due_date,
          submitted_at: t.submitted_at,
          timeDelta, // negative = saved time, positive = delayed
        };
      });

      // Sort: overdue first, then by due_date
      shapedTasks.sort((a, b) => {
        const aOverdue =
          a.due_date &&
          new Date(a.due_date) < now &&
          !["COMPLETED", "APPROVED"].includes(a.status)
        new Date(a.due_date) < now &&
          !["COMPLETED", "APPROVED"].includes(a.status)
          ? 0
          : 1;
        const bOverdue =
          b.due_date &&
          new Date(b.due_date) < now &&
          !["COMPLETED", "APPROVED"].includes(b.status)
        new Date(b.due_date) < now &&
          !["COMPLETED", "APPROVED"].includes(b.status)
          ? 0
          : 1;
        if (aOverdue !== bOverdue) return aOverdue - bOverdue;
        return (a.due_date || "").localeCompare(b.due_date || "");
      });

      return {
        id: member.id,
        name: member.name,
        role: member.workflow_role || member.platform_role,
        totalTasks,
        completedTasks,
        inProgressTasks,
        lockedTasks,
        totalMinutes,
        completedMinutes,
        tasks: shapedTasks,
      };
    });

    // Sort members by workload (most tasks first)
    result.sort((a, b) => b.totalTasks - a.totalTasks);

    return c.json({ data: result }, 200);
  } catch (err) {
    return c.json({ message: err.message }, 500);
  }
};

export const getMemberTasks = async (c) => {
  try {
    const companyId = c.get("user").company_id;
    const supabase = getSupabase(c.env);
    const userId = c.req.param("userId");
    const { from, to } = buildDateRange(c.req.query());



    const { data: completedLogs, error: logsError } = await supabase
      .from("task_performance_logs")
      .select(
        `
                task_id, task_title, instance_name, project_name, status,
                assigned_at, submitted_at, approved_at, deliverable_links,
                task:task_id(id, title, due_date, original_due_date)
            `,
      )
      .eq("user_id", userId)
      .eq("company_id", companyId)
      .gte("submitted_at", from)
      .lte("submitted_at", to)

      .order("submitted_at", { ascending: false });

    if (logsError) return c.json({ message: logsError.message }, 400);

    const { data: activeTasks, error: activeError } = await supabase
      .from("tasks")
      .select(
        `
                id, title, status, due_date, original_due_date, assigned_at,
                instance:instance_id(id, name, status, client:client_id(id, name))
            `,
      )
      .eq("assigned_user_id", userId)
      .eq("company_id", companyId)
      .in("status", ["IN_PROGRESS", "REJECTED", "PENDING_APPROVAL"])
      .order("due_date", { ascending: true });

    if (activeError) return c.json({ message: activeError.message }, 400);


    const { data: approvalLevels_raw, error: appErr } = await supabase
      .from("task_approval_levels")
      .select(
        `
                approver_id,
                level_number,
                task:task_id(
                    id, title, status, due_date, original_due_date, assigned_at, current_level,
                    instance:instance_id(id, name, status, client:client_id(id, name))
                )
            `,
      )
      .eq("approver_id", userId)
      .eq("status", "PENDING");

    if (appErr) return c.json({ message: appErr.message }, 400);

    // JS-filter approval levels to exclude paused instances (PostgREST can't filter on nested FK columns)
    const filteredApprovalLevels = (approvalLevels_raw || []).filter(
      (l) => l.task && l.task.instance?.status?.toUpperCase() !== "PAUSED"
    );

    const { data: approvalHistory_raw, error: historyErr } = await supabase
      .from("task_approval_history")
      .select(`
          actor_id, created_at, task_id,
          task:task_id(
              id, title, due_date, original_due_date, assigned_at,
              instance:instance_id(id, name, status, client:client_id(id, name))
          )
      `)
      .eq("actor_id", userId)
      .eq("action", "APPROVED")
      .gte("created_at", from)
      .lte("created_at", to);

    if (historyErr) return c.json({ message: historyErr.message }, 400);

    // JS-filter approval history to exclude paused instances
    const filteredApprovalHistory = (approvalHistory_raw || []).filter(
      (h) => h.task && h.task.instance?.status?.toUpperCase() !== "PAUSED"
    );

    const now = new Date();

    const completedShaped = (completedLogs || [])
      .map((log) => {
        const task = log.task;
        const dueDate = task?.due_date || null;
        const submittedAt = log.submitted_at || log.approved_at;

        let overdueDays = null;
        if (log.status === "Overdue" && dueDate && submittedAt) {
          const diff = new Date(submittedAt) - new Date(dueDate);
          overdueDays = Math.ceil(diff / (1000 * 60 * 60 * 24));
        }

        return {
          id: log.task_id,
          taskName: log.task_title || task?.title || "—",
          instance: task?.instance?.name || log.instance_name || "—",
          client: task?.instance?.client?.name || "—",
          status: "completed",
          assigned: log.assigned_at
            ? new Date(log.assigned_at).toISOString()
            : null,
          dueDate: dueDate ? new Date(dueDate).toISOString() : null,
          completedDate: submittedAt
            ? new Date(submittedAt).toISOString()
            : null,
          overdueDays,
          onTime: log.status === "On-time",
        };
      });

    const reviewerCompletedShaped = (filteredApprovalHistory || [])
      .map((history) => {
        const task = history.task;
        const dueDate = task?.due_date || null;
        const submittedAt = history.created_at;

        let overdueDays = null;
        let onTime = true;
        if (dueDate && submittedAt) {
          if (new Date(submittedAt) > new Date(dueDate)) {
            onTime = false;
            const diff = new Date(submittedAt).getTime() - new Date(dueDate).getTime();
            overdueDays = Math.ceil(diff / (1000 * 60 * 60 * 24));
          }
        }

        return {
          id: task?.id || history.task_id,
          taskName: (task?.title || "—") + " (Approval Required)",
          instance: task?.instance?.name || "—",
          client: task?.instance?.client?.name || "—",
          status: "completed",
          assigned: task?.assigned_at
            ? new Date(task.assigned_at).toLocaleDateString()
            : "—",
          dueDate: dueDate ? new Date(dueDate).toLocaleDateString() : "—",
          completedDate: submittedAt
            ? new Date(submittedAt).toLocaleDateString()
            : null,
          overdueDays,
          onTime,
        };
      });

    const pendingApprovals = (filteredApprovalLevels || [])
      .filter(
        (l) =>
          l.task &&
          l.task.status === "PENDING_APPROVAL" &&
          l.task.current_level === l.level_number &&
          l.task.instance?.status?.toUpperCase() !== "PAUSED",
      )
      .map((l) => ({ ...l.task, is_approval_task: true }));

    const filteredActiveTasks = (activeTasks || []).filter(
      (t) => t.instance?.status?.toUpperCase() !== "PAUSED",
    );
    const combinedPool = [...filteredActiveTasks, ...pendingApprovals];
    const deduplicatedActiveTasks = Array.from(
      new Map(combinedPool.map((t) => [t.id, t])).values(),
    );

    const activeShaped = deduplicatedActiveTasks.map((task) => {
      const dueDate = task.due_date ? new Date(task.due_date) : null;
      const isPastDue = dueDate && dueDate < now;

      let uiStatus = isPastDue ? "overdue" : "in_progress";

      let overdueDays = null;
      if (isPastDue) {
        const diff = now - dueDate;
        overdueDays = Math.ceil(diff / (1000 * 60 * 60 * 24));
      }

      const taskName =
        (task.title || "—") +
        (task.is_approval_task ? " (Approval Required)" : "");

      return {
        id: task.id,
        taskName,
        instance: task.instance?.name || "—",
        client: task.instance?.client?.name || "—",
        status: uiStatus,
        assigned: task.assigned_at
          ? new Date(task.assigned_at).toISOString()
          : null,
        dueDate: dueDate ? dueDate.toISOString() : null,
        completedDate: null,
        overdueDays,
        onTime: null,
      };
    });

    const statusOrder = { overdue: 0, in_progress: 1, pending: 2 };
    activeShaped.sort(
      (a, b) => (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9),
    );

    return c.json({ data: [...completedShaped, ...reviewerCompletedShaped, ...activeShaped] }, 200);
  } catch (err) {
    return c.json({ message: err.message }, 500);
  }
};

/**
 * GET /performance/rejections/summary
 * Returns rejection summary for all team members
 */
export const getRejectionSummary = async (c) => {
  try {
    const { from, to } = buildDateRange(c.req.query());
    const companyId = c.get("user").company_id;
    if (!companyId)
      return c.json({ message: "Could not determine company" }, 400);

    const supabase = getSupabase(c.env);

    // Get all members
    const { data: members, error: membersError } = await supabase
      .from("users")
      .select("id, name, workflow_role, platform_role")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .in("platform_role", ["member", "controller"]);

    if (membersError) return c.json({ message: membersError.message }, 400);
    if (!members || members.length === 0) return c.json({ data: [] }, 200);

    const memberIds = members.map((m) => m.id);

    // Get rejection history for all members in date range
    const { data: rejections, error: rejectionsError } = await supabase
      .from("task_approval_history")
      .select("user_id, task_id")
      .in("user_id", memberIds)
      .eq("action", "REJECTED")
      .gte("created_at", from)
      .lte("created_at", to);

    if (rejectionsError)
      return c.json({ message: rejectionsError.message }, 400);

    // Aggregate by user
    const userStats = {};
    members.forEach((m) => {
      userStats[m.id] = {
        user_id: m.id,
        user_name: m.name,
        user_role: m.workflow_role || m.platform_role,
        total_rejected_tasks: 0,
        total_rejection_events: 0,
        task_ids: new Set(),
      };
    });

    (rejections || []).forEach((r) => {
      if (userStats[r.user_id]) {
        userStats[r.user_id].total_rejection_events++;
        userStats[r.user_id].task_ids.add(r.task_id);
      }
    });

    const result = Object.values(userStats).map((stat) => ({
      user_id: stat.user_id,
      user_name: stat.user_name,
      user_role: stat.user_role,
      total_rejected_tasks: stat.task_ids.size,
      total_rejection_events: stat.total_rejection_events,
    }));

    return c.json({ data: result }, 200);
  } catch (err) {
    return c.json({ message: err.message }, 500);
  }
};

/**
 * GET /performance/member/:userId/rejections
 * Returns detailed rejection history for a specific member
 */
export const getMemberRejections = async (c) => {
  try {
    const userId = c.req.param("userId");
    const { from, to } = buildDateRange(c.req.query());
    const companyId = c.get("user").company_id;

    const supabase = getSupabase(c.env);

    // Get rejection history with task details
    const { data: rejectionHistory, error: historyError } = await supabase
      .from("task_approval_history")
      .select(
        `
                task_id,
                comment,
                created_at,
                actor:actor_id(id, name),
                task:task_id(
                    id, title, status, rejection_count,
                    last_rejection_comment, last_rejected_at,
                    instance:instance_id(name, client:client_id(name))
                )
            `,
      )
      .eq("user_id", userId)
      .eq("action", "REJECTED")
      .gte("created_at", from)
      .lte("created_at", to)
      .order("created_at", { ascending: false });

    if (historyError) return c.json({ message: historyError.message }, 400);

    // Group by task and count rejections
    const taskMap = {};
    (rejectionHistory || []).forEach((h) => {
      if (!taskMap[h.task_id]) {
        taskMap[h.task_id] = {
          task_id: h.task_id,
          title: h.task?.title || "—",
          status: h.task?.status || "—",
          rejection_count: h.task?.rejection_count || 0,
          last_rejection_comment: h.comment || h.task?.last_rejection_comment,
          last_rejected_at: h.created_at || h.task?.last_rejected_at,
          total_rejection_events: 0,
          instance_name: h.task?.instance?.name,
          client_name: h.task?.instance?.client?.name,
          rejector_name: h.actor?.name,
        };
      }
      taskMap[h.task_id].total_rejection_events++;
      // Keep the most recent rejection details
      if (
        !taskMap[h.task_id].last_rejected_at ||
        h.created_at > taskMap[h.task_id].last_rejected_at
      ) {
        taskMap[h.task_id].last_rejected_at = h.created_at;
        taskMap[h.task_id].last_rejection_comment = h.comment;
        taskMap[h.task_id].rejector_name = h.actor?.name;
      }
    });

    const result = Object.values(taskMap);
    return c.json({ data: result }, 200);
  } catch (err) {
    return c.json({ message: err.message }, 500);
  }
};

/**
 * GET /performance/task/:taskId/rejection-details
 * Returns all rejection events for a specific task with full details
 * Also includes reviewer comments from task_checklist_progress
 */
export const getTaskRejectionDetails = async (c) => {
  try {
    const taskId = c.req.param("taskId");
    const supabase = getSupabase(c.env);

    // Get all rejection events for this task
    const { data: rejectionHistory, error: historyError } = await supabase
      .from("task_approval_history")
      .select(
        `
                id,
                level_number,
                comment,
                created_at,
                actor:actor_id(id, name, workflow_role, platform_role)
            `,
      )
      .eq("task_id", taskId)
      .eq("action", "REJECTED")
      .order("created_at", { ascending: false });

    if (historyError) return c.json({ message: historyError.message }, 400);

    // Get reviewer comments from task_checklist_progress
    const { data: checklistProgress, error: checklistError } = await supabase
      .from("task_checklist_progress")
      .select("id, item_text, reviewer_comments")
      .eq("task_id", taskId)
      .not("reviewer_comments", "is", null);

    if (checklistError) {
      console.error(
        "Error fetching checklist progress:",
        checklistError.message,
      );
    }

    const checklistProgressData =
      checklistProgress?.filter(
        (item) =>
          Array.isArray(item.reviewer_comments) &&
          item.reviewer_comments.length > 0,
      ) ?? [];

    // Format the response
    const result = (rejectionHistory || []).map((h) => ({
      id: h.id,
      level_number: h.level_number,
      actor_name: h.actor?.name || "Unknown",
      actor_role: h.actor?.workflow_role || h.actor?.platform_role,
      comment: h.comment,
      created_at: h.created_at,
      reviewer_comments: checklistProgressData || [],
    }));

    return c.json({ data: result }, 200);
  } catch (err) {
    return c.json({ message: err.message }, 500);
  }
};
