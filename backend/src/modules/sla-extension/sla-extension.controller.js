import { getSupabase } from "../../config/supabase.js";
// import { createNotification } from "../notifications/notification.controller.js";
import { sendNotification } from "../../utils/notify.js";

// Member requests SLA extension for an overdue task
export const requestSLAExtension = async (c) => {
  const supabase = getSupabase(c.env);

  try {
    const task_id = c.req.param("id");
    const { reason, suggested_new_deadline } = await c.req.json();
    const user = c.get("user");

    if (!reason || reason.trim().length < 20) {
      return c.json({ message: "Reason must be at least 20 characters" }, 400);
    }

    // Fetch task details
    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .select("*")
      .eq("id", task_id)
      .single();

    if (taskError || !task) {
      return c.json({ message: "Task not found", error: taskError?.message }, 404);
    }

    // --- Level-aware overdue check ---
    // Determine whether this user is acting as a WORKER or an APPROVER
    // and validate overdue against their specific due_date.
    let extended_for_role = null;   // 'WORKER' | 'APPROVER'
    let approval_level_id = null;
    let activeDueDate = null;

    if (task.status === "IN_PROGRESS" && task.assigned_user_id === user.id) {
      // User is the worker currently working on the task
      extended_for_role = "WORKER";
      activeDueDate = task.due_date;

    } else if (task.status === "PENDING_APPROVAL") {
      // Task is with an approver — find the current active level
      const { data: activeLevel } = await supabase
        .from("task_approval_levels")
        .select("id, approver_id, due_date, level_number, status")
        .eq("task_id", task_id)
        .eq("approver_id", user.id)
        .eq("status", "PENDING")
        .order("level_number", { ascending: true })
        .limit(1)
        .single();

      if (!activeLevel) {
        return c.json({ message: "You are not the active approver for this task" }, 403);
      }

      extended_for_role = "APPROVER";
      approval_level_id = activeLevel.id;
      // Use the approver-level due_date if set, otherwise fall back to task-level
      activeDueDate = activeLevel.due_date || task.due_date;

    } else {
      // Neither worker nor active approver
      return c.json({ message: "You are not the active assignee for this task" }, 403);
    }

    // Check if the active due_date is actually overdue
    if (!activeDueDate || new Date(activeDueDate) >= new Date()) {
      return c.json({ message: "Your deadline is not overdue yet" }, 400);
    }

    // Check existing requests count for this task (cap at 2 per task)
    const { data: existingRequests, error: countError } = await supabase
      .from("task_sla_extension_requests")
      .select("id")
      .eq("task_id", task_id);

    if (countError) {
      return c.json({ message: "Error checking existing requests" }, 500);
    }

    // Removed: 2-per-task limit (auto-generated requests are now the primary flow)
    // if (existingRequests && existingRequests.length >= 2) {
    //   return c.json(
    //     { message: "Maximum 2 extension requests allowed per task" },
    //     400,
    //   );
    // }

    // Check if there's already a pending request for this task from this user
    const { data: pendingRequest } = await supabase
      .from("task_sla_extension_requests")
      .select("id")
      .eq("task_id", task_id)
      .eq("requested_by", user.id)
      .eq("status", "PENDING")
      .single();

    if (pendingRequest) {
      return c.json(
        { message: "A pending extension request already exists for this task" },
        400,
      );
    }

    // Create the extension request — now with level context
    const { data: request, error: insertError } = await supabase
      .from("task_sla_extension_requests")
      .insert({
        task_id,
        requested_by: user.id,
        reason: reason.trim(),
        suggested_new_deadline,
        company_id: user.company_id,
        status: "PENDING",
        approval_level_id,          // null for WORKER, uuid for APPROVER
        extended_for_role,          // 'WORKER' | 'APPROVER'
      })
      .select()
      .single();

    if (insertError) {
      return c.json({ message: "Failed to create extension request", error: insertError.message }, 500);
    }

    // Notify all controllers in the company
    const { data: controllers } = await supabase
      .from("users")
      .select("id")
      .eq("company_id", user.company_id)
      .eq("platform_role", "controller");

    const roleLabel = extended_for_role === "APPROVER" ? "(as Approver)" : "(as Worker)";
    if (controllers && controllers.length > 0) {
      for (const controller of controllers) {
        await sendNotification({
          user_id: controller.id,
          type: "sla_extension_requested",
          title: "New SLA Extension Request",
          message: `${user.name} requested SLA extension ${roleLabel} for task: ${task.title}`,
          task_id: task_id,
          instance_id: task.instance_id,
          sent_by: user.id,
        }, c);
      }
    }

    return c.json(
      {
        message: "SLA extension request submitted successfully",
        data: request,
      },
      201,
    );
  } catch (error) {
    console.error("Request SLA Extension Error:", error);
    return c.json({ message: "Internal server error" }, 500);
  }
};

// Get all SLA extension requests (for controller dashboard)
export const getSLAExtensionRequests = async (c) => {
  const supabase = getSupabase(c.env);

  try {
    const user = c.get("user");
    const status = c.req.query("status") || "PENDING";
    const page = parseInt(c.req.query("page")) || 1;
    const limit = parseInt(c.req.query("limit")) || 20;
    const offset = (page - 1) * limit;

    // Filter parameters
    const search = c.req.query("search");
    const member = c.req.query("member");
    const dateFrom = c.req.query("dateFrom");
    const dateTo = c.req.query("dateTo");
    const overdue = c.req.query("overdue");

    // Sorting parameters
    const sortBy = c.req.query("sortBy") || "requested_at";
    const sortOrder = c.req.query("sortOrder") || "desc";

    // Only controllers and admins can view requests
    if (user.platform_role !== "controller" && user.platform_role !== "admin" && user.workflow_role !== "interim_manager") {
      return c.json({ message: "Unauthorized" }, 403);
    }

    // First, try a simple query to check if table exists
    const { data: testData, error: testError } = await supabase
      .from("task_sla_extension_requests")
      .select("*")
      .limit(1);

    console.log("Test query result:", { testData, testError });

    if (testError) {
      console.error("Table access error:", testError);
      return c.json({
        message: "Failed to access SLA extension requests table",
        error: testError.message,
        hint: "Please ensure the table exists by running schema_sla_extension_requests.sql"
      }, 500);
    }

    // Scope to the logged-in controller's assigned requests only
    let query = supabase
      .from("task_sla_extension_requests")
      .select(
        `
                *,
                tasks!task_sla_extension_requests_task_id_fkey(id, title, due_date, status, instance_id),
                requested_by_user:users!task_sla_extension_requests_requested_by_fkey(id, name, email),
                reviewed_by_user:users!task_sla_extension_requests_reviewed_by_fkey(id, name, email)
            `,
        { count: "exact" },
      )
      .eq("company_id", user.company_id)
      .or(`controller_id.eq.${user.id},controller_id.is.null`);  // Scoped to this controller, plus legacy/manual requests

    // Apply status filter
    if (status && status !== "ALL") {
      query = query.eq("status", status);
    }

    // Apply member filter
    if (member) {
      query = query.eq("requested_by", member);
    }

    // Apply date range filters
    if (dateFrom) {
      query = query.gte("requested_at", dateFrom);
    }
    if (dateTo) {
      const endDate = new Date(dateTo);
      endDate.setHours(23, 59, 59, 999);
      query = query.lte("requested_at", endDate.toISOString());
    }

    // Apply sorting
    const sortMapping = {
      'requested_at': 'requested_at',
      'task': 'tasks.title',
      'member': 'requested_by_user.name',
      'due_date': 'tasks.due_date',
      'status': 'status'
    };

    const sortColumn = sortMapping[sortBy] || 'requested_at';
    const ascending = sortOrder === 'asc';

    // For nested fields, we'll sort after fetching
    if (sortBy === 'task' || sortBy === 'member' || sortBy === 'due_date') {
      query = query.order("requested_at", { ascending: false });
    } else {
      query = query.order(sortColumn, { ascending });
    }

    const {
      data: requests,
      error,
      count,
    } = await query.range(offset, offset + limit - 1);

    if (error) {
      console.error("Get SLA Extension Requests Query Error:", error);
      return c.json({ message: "Failed to fetch requests", error: error.message }, 500);
    }

    // Enrich with instance and project data
    let enrichedRequests = requests || [];
    if (enrichedRequests.length > 0) {
      const instanceIds = [...new Set(enrichedRequests.map(r => r.tasks?.instance_id).filter(Boolean))];

      if (instanceIds.length > 0) {
        const { data: instances } = await supabase
          .from("instances")
          .select("id, name, project_id, projects!instances_project_id_fkey(id, name)")
          .in("id", instanceIds);

        if (instances) {
          enrichedRequests = enrichedRequests.map(req => {
            if (req.tasks?.instance_id) {
              const instance = instances.find(i => i.id === req.tasks.instance_id);
              if (instance) {
                req.tasks.instances = instance;
              }
            }
            return req;
          });
        }
      }
    }

    let filteredRequests = enrichedRequests;

    // Apply search filter (client-side for nested fields)
    if (search && search.trim()) {
      const searchLower = search.toLowerCase().trim();
      filteredRequests = filteredRequests.filter(req =>
        req.tasks?.title?.toLowerCase().includes(searchLower) ||
        req.reason?.toLowerCase().includes(searchLower)
      );
    }

    // Apply overdue filter
    if (overdue === 'yes') {
      filteredRequests = filteredRequests.filter(req => {
        if (!req.tasks?.due_date) return false;
        return new Date(req.tasks.due_date) < new Date();
      });
    } else if (overdue === 'no') {
      filteredRequests = filteredRequests.filter(req => {
        if (!req.tasks?.due_date) return true;
        return new Date(req.tasks.due_date) >= new Date();
      });
    }

    // Apply client-side sorting for nested fields
    if (sortBy === 'task') {
      filteredRequests.sort((a, b) => {
        const aVal = a.tasks?.title || '';
        const bVal = b.tasks?.title || '';
        return ascending ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      });
    } else if (sortBy === 'member') {
      filteredRequests.sort((a, b) => {
        const aVal = a.requested_by_user?.name || '';
        const bVal = b.requested_by_user?.name || '';
        return ascending ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      });
    } else if (sortBy === 'due_date') {
      filteredRequests.sort((a, b) => {
        const aVal = a.tasks?.due_date ? new Date(a.tasks.due_date).getTime() : 0;
        const bVal = b.tasks?.due_date ? new Date(b.tasks.due_date).getTime() : 0;
        return ascending ? aVal - bVal : bVal - aVal;
      });
    }

    return c.json({
      data: filteredRequests,
      count: filteredRequests.length,
      totalCount: count || 0,
      page,
      totalPages: Math.ceil((count || 0) / limit),
    });
  } catch (error) {
    console.error("Get SLA Extension Requests Error:", error);
    return c.json({ message: "Internal server error", error: error.message }, 500);
  }
};

// Controller approves SLA extension request
export const approveSLAExtensionRequest = async (c) => {
  const supabase = getSupabase(c.env);

  try {
    const request_id = c.req.param("id");
    const { new_deadline, reason, comment } = await c.req.json();
    const user = c.get("user");

    if (user.platform_role !== "controller" && user.platform_role !== "admin") {
      return c.json({ message: "Unauthorized" }, 403);
    }

    if (!new_deadline) {
      return c.json({ message: "New deadline is required" }, 400);
    }

    // Fetch the request (include approval_level_id and extended_for_role)
    const { data: request, error: requestError } = await supabase
      .from("task_sla_extension_requests")
      .select("*, tasks!task_sla_extension_requests_task_id_fkey(*)")
      .eq("id", request_id)
      .single();

    if (requestError || !request) {
      console.error("Approve Request fetch error:", requestError);
      return c.json({ message: "Request not found" }, 404);
    }

    if (request.status !== "PENDING") {
      return c.json({ message: "Request has already been reviewed" }, 400);
    }

    // Update the request status
    const { error: updateRequestError } = await supabase
      .from("task_sla_extension_requests")
      .update({
        status: "APPROVED",
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        reviewer_comment: comment,
        final_new_deadline: new_deadline,
      })
      .eq("id", request_id);

    if (updateRequestError) {
      return c.json({ message: "Failed to approve request" }, 500);
    }

    // --- Level-aware deadline update ---
    if (request.extended_for_role === "APPROVER" && request.approval_level_id) {
      // Apply new deadline to the specific approval level row
      const { data: currentLevel } = await supabase
        .from("task_approval_levels")
        .select("due_date, original_due_date")
        .eq("id", request.approval_level_id)
        .single();

      const approvalUpdatePayload = {
        due_date: new_deadline,
        // Preserve original_due_date on first extension
        ...(!currentLevel?.original_due_date && { original_due_date: currentLevel?.due_date }),
      };

      const { error: approvalUpdateError } = await supabase
        .from("task_approval_levels")
        .update(approvalUpdatePayload)
        .eq("id", request.approval_level_id);

      if (approvalUpdateError) {
        return c.json({ message: "Failed to update approver deadline" }, 500);
      }

      // Also push the overall task due_date forward by the same delta
      // so the task doesn't immediately show as overdue at the task level
      const oldApproverDeadline = currentLevel?.due_date
        ? new Date(currentLevel.due_date)
        : new Date(request.tasks.due_date);
      const delta = new Date(new_deadline).getTime() - oldApproverDeadline.getTime();
      const newTaskDueDate = new Date(new Date(request.tasks.due_date).getTime() + delta);

      await supabase
        .from("tasks")
        .update({ due_date: newTaskDueDate.toISOString(), updated_at: new Date().toISOString() })
        .eq("id", request.task_id);

    } else {
      // WORKER level — update task's due_date directly
      const { data: currentTask } = await supabase
        .from("tasks")
        .select("due_date, original_due_date")
        .eq("id", request.task_id)
        .single();

      const taskUpdatePayload = {
        due_date: new_deadline,
        updated_at: new Date().toISOString(),
        // Preserve original_due_date on first extension
        ...(!currentTask?.original_due_date && { original_due_date: currentTask?.due_date }),
      };

      const { error: updateTaskError } = await supabase
        .from("tasks")
        .update(taskUpdatePayload)
        .eq("id", request.task_id);

      if (updateTaskError) {
        return c.json({ message: "Failed to update task deadline" }, 500);
      }
    }

    // Log in task_sla_extensions table
    await supabase.from("task_sla_extensions").insert({
      task_id: request.task_id,
      old_deadline: request.tasks.due_date,
      new_deadline: new_deadline,
      reason: reason || comment || request.reason,
      requested_by: user.id,
      approval_level_id: request.approval_level_id || null,
      extended_for_role: request.extended_for_role || "WORKER",
    });

    // Auto-complete the linked controller review task
    if (request.controller_task_id) {
      await supabase
        .from('tasks')
        .update({ status: 'COMPLETED', approved_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', request.controller_task_id);
    }

    // Notify the member
    await sendNotification({
      user_id: request.requested_by,
      type: "sla_extension_approved",
      title: "SLA Extension Approved",
      message: `Your SLA extension request for "${request.tasks.title}" has been approved. New deadline: ${new Date(new_deadline).toLocaleDateString()}`,
      task_id: request.task_id,
      instance_id: request.tasks.instance_id,
      sent_by: user.id,
    }, c);

    return c.json({
      message: "SLA extension request approved successfully",
    });
  } catch (error) {
    console.error("Approve SLA Extension Error:", error);
    return c.json({ message: "Internal server error" }, 500);
  }
};

// Controller rejects SLA extension request
export const rejectSLAExtensionRequest = async (c) => {
  try {
    const request_id = c.req.param("id");
    const { comment } = await c.req.json();
    const user = c.get("user");

    if (user.platform_role !== "controller" && user.platform_role !== "admin") {
      return c.json({ message: "Unauthorized" }, 403);
    }

    if (!comment || comment.trim().length < 10) {
      return c.json(
        { message: "Rejection comment must be at least 10 characters" },
        400,
      );
    }
    const supabase = getSupabase(c.env);

    // Fetch the request
    const { data: request, error: requestError } = await supabase
      .from("task_sla_extension_requests")
      .select("*, tasks!task_sla_extension_requests_task_id_fkey(*)")
      .eq("id", request_id)
      .single();

    if (requestError || !request) {
      console.error("Reject Request fetch error:", requestError);
      return c.json({ message: "Request not found" }, 404);
    }

    if (request.status !== "PENDING") {
      return c.json({ message: "Request has already been reviewed" }, 400);
    }

    // Update the request status
    const { error: updateError } = await supabase
      .from("task_sla_extension_requests")
      .update({
        status: "REJECTED",
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        reviewer_comment: comment.trim(),
      })
      .eq("id", request_id);

    if (updateError) {
      return c.json({ message: "Failed to reject request" }, 500);
    }

    // Auto-complete the linked controller review task
    if (request.controller_task_id) {
      await supabase
        .from('tasks')
        .update({ status: 'COMPLETED', approved_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', request.controller_task_id);
    }

    // Notify the member
    await sendNotification({
      user_id: request.requested_by,
      type: "sla_extension_rejected",
      title: "SLA Extension Request Rejected",
      message: `Your SLA extension request for "${request.tasks.title}" was rejected. Reason: ${comment.trim()}`,
      task_id: request.task_id,
      instance_id: request.tasks.instance_id,
      sent_by: user.id,
    }, c);

    return c.json({
      message: "SLA extension request rejected successfully",
    });
  } catch (error) {
    console.error("Reject SLA Extension Error:", error);
    return c.json({ message: "Internal server error" }, 500);
  }
};

// Get SLA extension request history for a specific task
export const getTaskSLAExtensionHistory = async (c) => {
  try {
    const task_id = c.req.param("id");
    const user = c.get("user");
    const supabase = getSupabase(c.env);

    const { data: requests, error } = await supabase
      .from("task_sla_extension_requests")
      .select(
        `
                *,
                requested_by_user:users!task_sla_extension_requests_requested_by_fkey(id, name, email),
                reviewed_by_user:users!task_sla_extension_requests_reviewed_by_fkey(id, name, email)
            `,
      )
      .eq("task_id", task_id)
      .order("requested_at", { ascending: false });

    if (error) {
      return c.json({ message: "Failed to fetch request history" }, 500);
    }

    return c.json({
      data: requests || [],
    });
  } catch (error) {
    console.error("Get Task SLA Extension History Error:", error);
    return c.json({ message: "Internal server error" }, 500);
  }
};

// Get SLA extension requests for the current authenticated user (member)
export const getMySLAExtensionRequests = async (c) => {
  const supabase = getSupabase(c.env);

  try {
    const user = c.get("user");
    const status = c.req.query("status") || "ALL";
    const page = parseInt(c.req.query("page")) || 1;
    const limit = parseInt(c.req.query("limit")) || 20;
    const offset = (page - 1) * limit;

    // Filter parameters
    const search = c.req.query("search");
    const dateFrom = c.req.query("dateFrom");
    const dateTo = c.req.query("dateTo");

    // Sorting parameters
    const sortBy = c.req.query("sortBy") || "requested_at";
    const sortOrder = c.req.query("sortOrder") || "desc";

    // Build query - filter by requested_by and company_id
    let query = supabase
      .from("task_sla_extension_requests")
      .select(
        `
                *,
                tasks!task_sla_extension_requests_task_id_fkey(id, title, due_date, status, instance_id),
                requested_by_user:users!task_sla_extension_requests_requested_by_fkey(id, name, email),
                reviewed_by_user:users!task_sla_extension_requests_reviewed_by_fkey(id, name, email)
            `,
        { count: "exact" },
      )
      .eq("company_id", user.company_id)
      .eq("requested_by", user.id);

    // Apply status filter
    if (status && status !== "ALL") {
      query = query.eq("status", status);
    }

    // Apply date range filters
    if (dateFrom) {
      query = query.gte("requested_at", dateFrom);
    }
    if (dateTo) {
      const endDate = new Date(dateTo);
      endDate.setHours(23, 59, 59, 999);
      query = query.lte("requested_at", endDate.toISOString());
    }

    // Apply sorting
    const sortMapping = {
      'requested_at': 'requested_at',
      'task': 'tasks.title',
      'due_date': 'tasks.due_date',
      'status': 'status'
    };

    const sortColumn = sortMapping[sortBy] || 'requested_at';
    const ascending = sortOrder === 'asc';

    // For nested fields, sort client-side, else sort in database
    if (sortBy === 'task' || sortBy === 'due_date') {
      query = query.order("requested_at", { ascending: false });
    } else {
      query = query.order(sortColumn, { ascending });
    }

    const {
      data: requests,
      error,
      count,
    } = await query.range(offset, offset + limit - 1);

    if (error) {
      console.error("Get My SLA Extension Requests Query Error:", error);
      return c.json({ message: "Failed to fetch requests", error: error.message }, 500);
    }

    // Enrich with instance and project data
    let enrichedRequests = requests || [];
    if (enrichedRequests.length > 0) {
      const instanceIds = [...new Set(enrichedRequests.map(r => r.tasks?.instance_id).filter(Boolean))];

      if (instanceIds.length > 0) {
        const { data: instances } = await supabase
          .from("instances")
          .select("id, name, project_id, projects!instances_project_id_fkey(id, name)")
          .in("id", instanceIds);

        if (instances) {
          enrichedRequests = enrichedRequests.map(req => {
            if (req.tasks?.instance_id) {
              const instance = instances.find(i => i.id === req.tasks.instance_id);
              if (instance) {
                req.tasks.instances = instance;
              }
            }
            return req;
          });
        }
      }
    }

    let filteredRequests = enrichedRequests;

    // Apply search filter (client-side for nested fields)
    if (search && search.trim()) {
      const searchLower = search.toLowerCase().trim();
      filteredRequests = filteredRequests.filter(req =>
        req.tasks?.title?.toLowerCase().includes(searchLower) ||
        req.reason?.toLowerCase().includes(searchLower)
      );
    }

    // Apply client-side sorting for nested fields
    if (sortBy === 'task') {
      filteredRequests.sort((a, b) => {
        const aVal = a.tasks?.title || '';
        const bVal = b.tasks?.title || '';
        return ascending ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      });
    } else if (sortBy === 'due_date') {
      filteredRequests.sort((a, b) => {
        const aVal = a.tasks?.due_date ? new Date(a.tasks.due_date).getTime() : 0;
        const bVal = b.tasks?.due_date ? new Date(b.tasks.due_date).getTime() : 0;
        return ascending ? aVal - bVal : bVal - aVal;
      });
    }

    return c.json({
      data: filteredRequests,
      count: filteredRequests.length,
      totalCount: count || 0,
      page,
      totalPages: Math.ceil((count || 0) / limit),
    });
  } catch (error) {
    console.error("Get My SLA Extension Requests Error:", error);
    return c.json({ message: "Internal server error", error: error.message }, 500);
  }
};

