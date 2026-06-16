import { getSupabase } from "../../config/supabase.js";
import { checkSubscriptionLimits } from "../../utils/subscription.js";

export const addProject = async (c) => {
    try {
        const { name, description, start_date, category, template_type, company_id: bodyCompanyId } = await c.req.json();
        const user = c.get("user");
        let company_id = user.company_id;

        if (user.platform_role === 'superadmin') {
            if (bodyCompanyId === 'null' || bodyCompanyId === 'global' || bodyCompanyId === null) {
                company_id = null;
            } else if (bodyCompanyId) {
                company_id = bodyCompanyId;
            }
        }

        if (!name || !start_date) {
            return c.json({ message: "Required fields missing" }, 400);
        }

        const supabase = getSupabase(c.env);

        if (company_id) {
            await checkSubscriptionLimits(supabase, company_id, "projects");
        }
        // 🔗 2️⃣ Insert Profile (Use SAME ID)
        const { data, error } = await supabase
            .from("projects")
            .insert({
                company_id,
                name,
                description,
                start_date,
                status: 'active',
                category,
                type: template_type
            })
            .select()
            .single();

        if (error) {
            return c.json({ message: error.message }, 400);
        }

        return c.json(data, 201);
    } catch (error) {
        return c.json({ message: error.message }, 500);
    }
};

export const updateProject = async (c) => {
    try {
        const id = c.req.param("id");
        const { name, category, description, status, start_date, type } = await c.req.json();
        const user = c.get("user");

        const supabase = getSupabase(c.env);

        // Build the update payload dynamically based on provided fields
        const updatePayload = {};
        if (name !== undefined) updatePayload.name = name;
        if (category !== undefined) updatePayload.category = category;
        if (description !== undefined) updatePayload.description = description;
        if (status !== undefined) updatePayload.status = status;
        if (start_date !== undefined) updatePayload.start_date = start_date;
        if (type !== undefined) updatePayload.type = type;

        let query = supabase
            .from("projects")
            .update(updatePayload)
            .eq("id", id);

        if (user.platform_role !== 'superadmin') {
            query = query.eq("company_id", user.company_id);
        }

        const { data, error } = await query
            .select()
            .single();

        if (error) {
            return c.json({ message: error.message }, 400);
        }

        return c.json(data, 200);
    } catch (error) {
        return c.json({ message: error.message }, 500);
    }
};

export const fetchprojects = async (c) => {
    try {
        const {
            page = 1,
            limit = 10,
            search,
            type,
            status,
            category,
            sortBy = 'recently_created',
            company_id: query_company_id
        } = c.req.query();

        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const from = (pageNum - 1) * limitNum;
        const to = from + limitNum - 1;

        // Superadmins can specify a company_id, others use their own
        const user = c.get("user");
        let company_id = user.company_id;
        let fetchGlobal = false;

        if (user.platform_role === 'superadmin') {
            if (query_company_id === 'global' || query_company_id === 'null' || query_company_id === '') {
                fetchGlobal = true;
                company_id = null;
            } else if (query_company_id !== undefined) {
                company_id = query_company_id;
            }
        }

        const supabase = getSupabase(c.env);
        let query = supabase
            .from("projects")
            .select(`
                *,
                clients (
                    id,
                    name
                )
            `, { count: 'exact' });

        if (fetchGlobal || company_id === null) {
            query = query.is("company_id", null);
        } else {
            query = query.eq("company_id", company_id);
        }

        if (search) {
            query = query.ilike("name", `%${search}%`);
        }
        if (type && type !== 'all') {
            query = query.eq("type", type);
        }
        if (status && status !== 'all') {
            query = query.eq("status", status);
        }
        if (category && category !== 'all') {
            query = query.eq("category", category);
        }

        // Handle sorting
        switch (sortBy) {
            case 'name_asc':
                query = query.order('name', { ascending: true });
                break;
            case 'name_desc':
                query = query.order('name', { ascending: false });
                break;
            case 'recently_updated':
                query = query.order('updated_at', { ascending: false });
                break;
            case 'recently_created':
            default:
                query = query.order('created_at', { ascending: false });
                break;
        }

        const { data, count, error } = await query.range(from, to);

        if (error) {
            return c.json({ message: error.message }, 400);
        }

        // Flatten client name
        const returndata = data.map((project) => ({
            ...project,
            client_name: project.clients?.name || 'No Client',
        }));

        return c.json({
            data: returndata,
            count: count || 0,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil((count || 0) / limitNum)
        }, 200);

    } catch (error) {
        return c.json({ message: error.message }, 500);
    }
};

export const fetchprojectbyid = async (c) => {
    try {
        const id = c.req.param("id");
        const user = c.get("user");
        const supabase = getSupabase(c.env);
        
        let query = supabase
            .from("projects")
            .select("*")
            .eq("id", id);
            
        if (user.platform_role !== 'superadmin') {
            query = query.eq("company_id", user.company_id);
        }
        
        const { data, error } = await query;
        if (error) {
            return c.json({ message: error.message }, 400);
        }
        return c.json({ data }, 200);
    } catch (error) {
        return c.json({ message: error.message }, 500);
    }
};

// ─── TEMPLATE TASK CRUD ─────────────────────────────────────────────────────

/**
 * POST /api/template-tasks
 * Admin adds a task to a template (project).
 */
export const addTemplateTask = async (c) => {
    try {
        const payload = await c.req.json();

        // Allow passing a single object or an array of objects
        const tasks = Array.isArray(payload) ? payload : (payload.tasks || [payload]);

        if (!tasks || tasks.length === 0) {
            return c.json({ message: 'No tasks provided' }, 400);
        }

        const user = c.get("user");
        const project_id = tasks[0].project_id; // Assume all belong to the same template

        const supabase = getSupabase(c.env);

        // Fetch project first to verify company_id of the project template
        const { data: project, error: projErr } = await supabase
            .from("projects")
            .select("company_id")
            .eq("id", project_id)
            .single();
            
        if (projErr || !project) {
            return c.json({ message: "Parent template (project) not found" }, 404);
        }

        if (user.platform_role !== 'superadmin' && project.company_id !== user.company_id) {
            return c.json({ message: "Unauthorized access to template" }, 403);
        }

        const target_company_id = project.company_id;

        // Format task rows, adding id only if it exists (for update)
        const taskRows = tasks.map(t => {
            const row = {
                id: t.id || crypto.randomUUID(), // Include ID always to prevent PostgREST from inferring NULL on mixed bulk upserts
                project_id: t.project_id || project_id,
                company_id: target_company_id,
                title: t.title,
                description: t.description || null,
                step_order: t.step_order || 1,
                estimated_minutes: t.estimated_minutes || 60,
                turnaround_minutes: t.turnaround_minutes || 0,
                approval_required: t.approval_required || false,
                approval_levels: t.approval_levels || 1,
                assigned_role: t.assigned_role || "",
                approver_turnaround_minutes: t.approver_turnaround_minutes !== undefined ? t.approver_turnaround_minutes : 240,
            };
            return row;
        });

        // Bulk upsert the tasks
        const { data: upsertedTasks, error } = await supabase
            .from('template_tasks')
            .upsert(taskRows)
            .select();

        if (error) return c.json({ message: error.message }, 400);

        const taskIds = upsertedTasks.map(t => t.id);

        // Delete all old checklist items for these tasks to prevent duplicates
        if (taskIds.length > 0) {
            await supabase.from('template_task_checklist_items').delete().in('template_task_id', taskIds);
        }

        // Gather all new checklist items
        const checklistRows = [];
        tasks.forEach(t => {
            if (t.checklist_items && Array.isArray(t.checklist_items) && t.checklist_items.length > 0) {
                // Match the task to the upserted one
                const upsertedTask = t.id
                    ? upsertedTasks.find(ut => ut.id === t.id)
                    : upsertedTasks.find(ut => ut.title === t.title && ut.step_order === t.step_order);

                if (upsertedTask) {
                    const validItems = t.checklist_items
                        .filter(item => (typeof item === 'string' ? item.trim() : (item?.item_text?.trim() || item?.title?.trim())));

                    validItems.forEach((item, idx) => {
                        checklistRows.push({
                            template_task_id: upsertedTask.id,
                            company_id: target_company_id,
                            item_text: typeof item === 'string' ? item : (item.title || item.item_text),
                            sort_order: idx,
                            requires_input: typeof item === 'object' ? (item.requires_input || false) : false,
                            input_label: typeof item === 'object' ? (item.input_label || null) : null,
                            input_placeholder: typeof item === 'object' ? (item.input_placeholder || null) : null,
                        });
                    });
                }
            }
        });

        if (checklistRows.length > 0) {
            await supabase.from('template_task_checklist_items').insert(checklistRows);
        }

        return c.json(upsertedTasks, 201);
    } catch (error) {
        return c.json({ message: error.message }, 500);
    }
};

export const fetchTemplateTasks = async (c) => {
    try {
        const project_id = c.req.param("project_id");
        const user = c.get("user");
        const supabase = getSupabase(c.env);

        // Fetch project first to verify company_id of the project template
        const { data: project, error: projErr } = await supabase
            .from("projects")
            .select("company_id")
            .eq("id", project_id)
            .single();
            
        if (projErr || !project) {
            return c.json({ message: "Parent template (project) not found" }, 404);
        }

        if (user.platform_role !== 'superadmin' && project.company_id !== user.company_id) {
            return c.json({ message: "Unauthorized access to template tasks" }, 403);
        }

        const { data, error } = await supabase
            .from('template_tasks')
            .select(`*, checklist_items:template_task_checklist_items(*)`)
            .eq('project_id', project_id)
            .order('step_order', { ascending: true });

        if (error) return c.json({ message: error.message }, 400);
        return c.json({ data, count: data.length }, 200);
    } catch (error) {
        return c.json({ message: error.message }, 500);
    }
};

export const updateTemplateTask = async (c) => {
    try {
        const id = c.req.param("id");
        const { title, description, step_order, estimated_minutes, turnaround_minutes, approval_required, approval_levels, assigned_role, checklist_items, approver_turnaround_minutes } = await c.req.json();

        const supabase = getSupabase(c.env);
        const user = c.get("user");

        // Fetch task first to check its project's company_id
        const { data: existingTask, error: taskErr } = await supabase
            .from('template_tasks')
            .select('*, projects(company_id)')
            .eq('id', id)
            .single();

        if (taskErr || !existingTask) return c.json({ message: 'Template task not found' }, 404);

        const project_company_id = existingTask.projects?.company_id;

        if (user.platform_role !== 'superadmin' && project_company_id !== user.company_id) {
            return c.json({ message: "Unauthorized access to template task" }, 403);
        }

        const updatePayload = { title, description, step_order, estimated_minutes, turnaround_minutes, approval_required, approval_levels, assigned_role };
        if (approver_turnaround_minutes !== undefined) updatePayload.approver_turnaround_minutes = approver_turnaround_minutes;

        const { data, error } = await supabase
            .from('template_tasks')
            .update(updatePayload)
            .eq('id', id)
            .select()
            .single();

        if (error) return c.json({ message: error.message }, 400);

        // Safe upsert checklist items — preserves requires_input, input_label, etc. for existing rows
        if (checklist_items !== undefined && Array.isArray(checklist_items)) {
            const validItems = checklist_items.filter(item =>
                typeof item === 'string' ? item.trim() : (item?.title?.trim() || item?.item_text?.trim())
            );

            // Collect IDs of incoming items that already exist in the DB
            const incomingIds = validItems.map(item => item?.id).filter(Boolean);

            // Delete rows that are no longer in the list
            const { data: existingRows } = await supabase
                .from('template_task_checklist_items')
                .select('id')
                .eq('template_task_id', id);

            const existingIds = (existingRows || []).map(r => r.id);
            const toDelete = existingIds.filter(eid => !incomingIds.includes(eid));
            if (toDelete.length > 0) {
                await supabase.from('template_task_checklist_items').delete().in('id', toDelete);
            }

            // Upsert all valid items — sort_order = array index (0-based)
            const rows = validItems.map((item, idx) => {
                const isExisting = typeof item === 'object' && item?.id;
                return {
                    ...(isExisting ? { id: item.id } : {}),
                    template_task_id: id,
                    company_id: project_company_id,
                    item_text: typeof item === 'string' ? item : (item.title || item.item_text),
                    sort_order: idx,
                    requires_input: typeof item === 'object' ? (item.requires_input ?? false) : false,
                    input_label: typeof item === 'object' ? (item.input_label ?? null) : null,
                    input_placeholder: typeof item === 'object' ? (item.input_placeholder ?? null) : null,
                };
            });

            if (rows.length > 0) {
                await supabase.from('template_task_checklist_items').upsert(rows);
            }
        }

        return c.json(data, 200);
    } catch (error) {
        return c.json({ message: error.message }, 500);
    }
};

export const deleteTemplateTask = async (c) => {
    try {
        const id = c.req.param("id");
        const user = c.get("user");
        const supabase = getSupabase(c.env);

        // Fetch task to check permissions
        const { data: existingTask, error: taskErr } = await supabase
            .from('template_tasks')
            .select('*, projects(company_id)')
            .eq('id', id)
            .single();

        if (taskErr || !existingTask) return c.json({ message: 'Template task not found' }, 404);

        if (user.platform_role !== 'superadmin' && existingTask.projects?.company_id !== user.company_id) {
            return c.json({ message: "Unauthorized access to template task" }, 403);
        }

        const { error } = await supabase
            .from('template_tasks')
            .delete()
            .eq('id', id);

        if (error) return c.json({ message: error.message }, 400);
        return c.json({ message: 'Template task deleted' }, 200);
    } catch (error) {
        return c.json({ message: error.message }, 500);
    }
};

// ─── CHECKLIST ITEM CRUD ─────────────────────────────────────────────────────

/**
 * POST /api/template-tasks/:id/checklist
 * Admin adds a checklist item at a specified 1-based position.
 * DB stores 0-based sort_order. All items at >= target position are shifted +1.
 * If sort_order is omitted, item is appended at the end.
 */
export const addChecklistItem = async (c) => {
    try {
        const template_task_id = c.req.param("id");
        const { item_text, sort_order, requires_input, input_label, input_placeholder } = await c.req.json();

        if (!item_text) return c.json({ message: 'item_text is required' }, 400);

        const supabase = getSupabase(c.env);
        const user = c.get("user");

        // Fetch task first to check its project's company_id
        const { data: task, error: taskErr } = await supabase
            .from('template_tasks')
            .select('*, projects(company_id)')
            .eq('id', template_task_id)
            .single();

        if (taskErr || !task) return c.json({ message: 'Template task not found' }, 404);

        const project_company_id = task.projects?.company_id;

        if (user.platform_role !== 'superadmin' && project_company_id !== user.company_id) {
            return c.json({ message: "Unauthorized access to template task" }, 403);
        }

        // Fetch all existing items for this task
        const { data: existing, error: fetchErr } = await supabase
            .from('template_task_checklist_items')
            .select('id, sort_order')
            .eq('template_task_id', template_task_id)
            .order('sort_order', { ascending: true });

        if (fetchErr) return c.json({ message: fetchErr.message }, 400);

        const totalItems = (existing || []).length;

        // Convert user-facing 1-based sort_order to 0-based DB index
        // If not provided, append at end
        let targetOrder;
        if (sort_order === undefined || sort_order === null) {
            targetOrder = totalItems; // append at end
        } else {
            targetOrder = Math.max(0, parseInt(sort_order) - 1);
            targetOrder = Math.min(targetOrder, totalItems); // clamp to valid range
        }

        // Shift all existing items at >= targetOrder upward by 1
        const itemsToShift = (existing || []).filter(item => item.sort_order >= targetOrder);
        if (itemsToShift.length > 0) {
            const shiftedRows = itemsToShift.map(item => ({
                id: item.id,
                sort_order: item.sort_order + 1,
            }));
            await supabase.from('template_task_checklist_items').upsert(shiftedRows);
        }

        // Insert the new item at the target position
        const { data, error } = await supabase
            .from('template_task_checklist_items')
            .insert({
                template_task_id,
                company_id: project_company_id,
                item_text,
                sort_order: targetOrder,
                requires_input: requires_input ?? false,
                input_label: input_label ?? null,
                input_placeholder: input_placeholder ?? null,
            })
            .select()
            .single();

        if (error) return c.json({ message: error.message }, 400);
        return c.json(data, 201);
    } catch (error) {
        return c.json({ message: error.message }, 500);
    }
};

export const editChecklistItem = async (c) => {
    try {
        const template_task_id = c.req.param("id");
        const itemId = c.req.param("itemId");
        const { item_text, sort_order, requires_input, input_label, input_placeholder } = await c.req.json();

        const supabase = getSupabase(c.env);
        const user = c.get("user");

        // Fetch task first to check its project's company_id
        const { data: task, error: taskErr } = await supabase
            .from('template_tasks')
            .select('*, projects(company_id)')
            .eq('id', template_task_id)
            .single();

        if (taskErr || !task) return c.json({ message: 'Template task not found' }, 404);

        if (user.platform_role !== 'superadmin' && task.projects?.company_id !== user.company_id) {
            return c.json({ message: "Unauthorized access to template task" }, 403);
        }

        // Fetch the current item to get its current sort_order
        const { data: currentItem, error: itemErr } = await supabase
            .from('template_task_checklist_items')
            .select('id, sort_order')
            .eq('id', itemId)
            .eq('template_task_id', template_task_id)
            .single();

        if (itemErr || !currentItem) return c.json({ message: 'Checklist item not found' }, 404);

        // Build the update payload (only fields that were passed)
        const updatePayload = {};
        if (item_text !== undefined) updatePayload.item_text = item_text;
        if (requires_input !== undefined) updatePayload.requires_input = requires_input;
        if (input_label !== undefined) updatePayload.input_label = input_label;
        if (input_placeholder !== undefined) updatePayload.input_placeholder = input_placeholder;

        // Handle sort_order reordering if a new position was provided
        if (sort_order !== undefined && sort_order !== null) {
            const oldOrder = currentItem.sort_order;
            // Convert 1-based user input to 0-based DB index
            const newOrder = Math.max(0, parseInt(sort_order) - 1);

            if (newOrder !== oldOrder) {
                // Fetch all sibling items (excluding the one being moved)
                const { data: siblings, error: sibErr } = await supabase
                    .from('template_task_checklist_items')
                    .select('id, sort_order')
                    .eq('template_task_id', template_task_id)
                    .neq('id', itemId)
                    .order('sort_order', { ascending: true });

                if (sibErr) return c.json({ message: sibErr.message }, 400);

                let itemsToShift = [];

                if (newOrder < oldOrder) {
                    // Moving UP: items between [newOrder, oldOrder-1] shift DOWN by +1
                    itemsToShift = (siblings || []).filter(
                        s => s.sort_order >= newOrder && s.sort_order < oldOrder
                    ).map(s => ({ id: s.id, sort_order: s.sort_order + 1 }));
                } else {
                    // Moving DOWN: items between [oldOrder+1, newOrder] shift UP by -1
                    itemsToShift = (siblings || []).filter(
                        s => s.sort_order > oldOrder && s.sort_order <= newOrder
                    ).map(s => ({ id: s.id, sort_order: s.sort_order - 1 }));
                }

                if (itemsToShift.length > 0) {
                    await supabase.from('template_task_checklist_items').upsert(itemsToShift);
                }

                updatePayload.sort_order = newOrder;
            }
        }

        // Apply the update to the target item
        const { data, error } = await supabase
            .from('template_task_checklist_items')
            .update(updatePayload)
            .eq('id', itemId)
            .eq('template_task_id', template_task_id)
            .select()
            .single();

        if (error) return c.json({ message: error.message }, 400);
        return c.json(data, 200);
    } catch (error) {
        return c.json({ message: error.message }, 500);
    }
};

export const deleteChecklistItem = async (c) => {
    try {
        const template_task_id = c.req.param("id");
        const itemId = c.req.param("itemId");
        const supabase = getSupabase(c.env);
        const user = c.get("user");

        // Fetch task first to check permissions
        const { data: task, error: taskErr } = await supabase
            .from('template_tasks')
            .select('*, projects(company_id)')
            .eq('id', template_task_id)
            .single();

        if (taskErr || !task) return c.json({ message: 'Template task not found' }, 404);

        if (user.platform_role !== 'superadmin' && task.projects?.company_id !== user.company_id) {
            return c.json({ message: "Unauthorized access to template task" }, 403);
        }

        // Get the item's sort_order before deleting
        const { data: item } = await supabase
            .from('template_task_checklist_items')
            .select('sort_order')
            .eq('id', itemId)
            .eq('template_task_id', template_task_id)
            .single();

        const { error } = await supabase
            .from('template_task_checklist_items')
            .delete()
            .eq('id', itemId)
            .eq('template_task_id', template_task_id);

        if (error) return c.json({ message: error.message }, 400);

        // Close the gap: shift all items after the deleted one down by -1
        if (item) {
            const { data: subsequent } = await supabase
                .from('template_task_checklist_items')
                .select('id, sort_order')
                .eq('template_task_id', template_task_id)
                .gt('sort_order', item.sort_order);

            if (subsequent && subsequent.length > 0) {
                const shifted = subsequent.map(s => ({ id: s.id, sort_order: s.sort_order - 1 }));
                await supabase.from('template_task_checklist_items').upsert(shifted);
            }
        }

        return c.json({ message: 'Checklist item deleted' }, 200);
    } catch (error) {
        return c.json({ message: error.message }, 500);
    }
};

/**
 * POST /api/tasks/:id/checklist
 * Admin adds an item to a LIVE task's checklist instance.
 */
export const addLiveChecklistItem = async (c) => {
    try {
        const task_id = c.req.param("id");
        const { item_text, sort_order, requires_input, input_label, input_placeholder } = await c.req.json();
        const supabase = getSupabase(c.env);

        // Use requested sort_order (1-based) or append to end
        let targetOrder;
        if (sort_order !== undefined && sort_order !== null) {
            targetOrder = Math.max(0, parseInt(sort_order) - 1);
        } else {
            const { data: countData } = await supabase
                .from('task_checklist_progress')
                .select('sort_order')
                .eq('task_id', task_id);
            targetOrder = countData?.length || 0;
        }

        // Shift existing items if inserting in middle
        const { data: existing } = await supabase
            .from('task_checklist_progress')
            .select('id, sort_order')
            .eq('task_id', task_id)
            .gte('sort_order', targetOrder);

        if (existing && existing.length > 0) {
            const shiftedRows = existing.map(item => ({
                id: item.id,
                sort_order: item.sort_order + 1,
            }));
            await supabase.from('task_checklist_progress').upsert(shiftedRows);
        }

        const { data, error } = await supabase
            .from('task_checklist_progress')
            .insert({
                task_id,
                item_text,
                sort_order: targetOrder,
                requires_input: requires_input ?? false,
                input_label: input_label ?? null,
                input_placeholder: input_placeholder ?? null,
                is_checked: false
            })
            .select()
            .single();

        if (error) return c.json({ message: error.message }, 400);
        return c.json(data, 201);
    } catch (error) {
        return c.json({ message: error.message }, 500);
    }
};

/**
 * PUT /api/tasks/:id/checklist/:itemId
 * Admin edits a live checklist item.
 */
export const editLiveChecklistItem = async (c) => {
    try {
        const task_id = c.req.param("id");
        const itemId = c.req.param("itemId");
        const { item_text, sort_order, requires_input, input_label, input_placeholder, is_checked } = await c.req.json();
        const supabase = getSupabase(c.env);

        const { data: currentItem, error: itemErr } = await supabase
            .from('task_checklist_progress')
            .select('id, sort_order')
            .eq('id', itemId)
            .eq('task_id', task_id)
            .single();

        if (itemErr || !currentItem) return c.json({ message: 'Checklist item not found' }, 404);

        const updatePayload = {};
        if (item_text !== undefined) updatePayload.item_text = item_text;
        if (requires_input !== undefined) updatePayload.requires_input = requires_input;
        if (input_label !== undefined) updatePayload.input_label = input_label;
        if (input_placeholder !== undefined) updatePayload.input_placeholder = input_placeholder;
        if (is_checked !== undefined) updatePayload.is_checked = is_checked;

        if (sort_order !== undefined && sort_order !== null) {
            const oldOrder = currentItem.sort_order;
            const newOrder = Math.max(0, parseInt(sort_order) - 1);

            if (newOrder !== oldOrder) {
                const { data: siblings } = await supabase
                    .from('task_checklist_progress')
                    .select('id, sort_order')
                    .eq('task_id', task_id)
                    .neq('id', itemId)
                    .order('sort_order', { ascending: true });

                let itemsToShift = [];
                if (newOrder < oldOrder) {
                    itemsToShift = (siblings || []).filter(s => s.sort_order >= newOrder && s.sort_order < oldOrder)
                        .map(s => ({ id: s.id, sort_order: s.sort_order + 1 }));
                } else {
                    itemsToShift = (siblings || []).filter(s => s.sort_order > oldOrder && s.sort_order <= newOrder)
                        .map(s => ({ id: s.id, sort_order: s.sort_order - 1 }));
                }
                if (itemsToShift.length > 0) await supabase.from('task_checklist_progress').upsert(itemsToShift);
                updatePayload.sort_order = newOrder;
            }
        }

        const { data, error } = await supabase
            .from('task_checklist_progress')
            .update(updatePayload)
            .eq('id', itemId)
            .eq('task_id', task_id)
            .select()
            .single();

        if (error) return c.json({ message: error.message }, 400);
        return c.json(data, 200);
    } catch (error) {
        return c.json({ message: error.message }, 500);
    }
};

/**
 * DELETE /api/tasks/:id/checklist/:itemId
 */
export const deleteLiveChecklistItem = async (c) => {
    try {
        const task_id = c.req.param("id");
        const itemId = c.req.param("itemId");
        const supabase = getSupabase(c.env);

        const { data: item } = await supabase
            .from('task_checklist_progress')
            .select('sort_order')
            .eq('id', itemId)
            .eq('task_id', task_id)
            .single();

        const { error } = await supabase.from('task_checklist_progress').delete().eq('id', itemId).eq('task_id', task_id);
        if (error) return c.json({ message: error.message }, 400);

        if (item) {
            const { data: subsequent } = await supabase
                .from('task_checklist_progress')
                .select('id, sort_order')
                .eq('task_id', task_id)
                .gt('sort_order', item.sort_order);

            if (subsequent && subsequent.length > 0) {
                const shifted = subsequent.map(s => ({ id: s.id, sort_order: s.sort_order - 1 }));
                await supabase.from('task_checklist_progress').upsert(shifted);
            }
        }
        return c.json({ message: 'Live checklist item deleted' }, 200);
    } catch (error) {
        return c.json({ message: error.message }, 500);
    }
};

/**
 * DELETE /api/deleteproject/:id
 * Manually deletes in FK dependency order:
 * task children → tasks → instance children → instances → template task children → template_tasks → project
 */
export const deleteProject = async (c) => {
    try {
        const id = c.req.param("id");
        const user = c.get("user");
        const supabase = getSupabase(c.env);

        // Fetch project to check permissions
        const { data: project, error: projErr } = await supabase
            .from('projects')
            .select('company_id')
            .eq('id', id)
            .single();

        if (projErr || !project) return c.json({ message: 'Project not found' }, 404);

        if (user.platform_role !== 'superadmin' && project.company_id !== user.company_id) {
            return c.json({ message: "Unauthorized access to project" }, 403);
        }

        // ── 1. Collect all live task IDs belonging to this project ──────────
        const { data: taskRows } = await supabase
            .from('tasks')
            .select('id')
            .eq('project_id', id);
        const taskIds = (taskRows || []).map(t => t.id);

        // ── 2. Collect all instance IDs belonging to this project ───────────
        const { data: instanceRows } = await supabase
            .from('instances')
            .select('id')
            .eq('project_id', id);
        const instanceIds = (instanceRows || []).map(i => i.id);

        // ── 3. Collect all template task IDs ────────────────────────────────
        const { data: tmplRows } = await supabase
            .from('template_tasks')
            .select('id')
            .eq('project_id', id);
        const tmplIds = (tmplRows || []).map(t => t.id);

        // ── 4. Delete task-level children (deepest first) ───────────────────
        if (taskIds.length > 0) {
            await supabase.from('task_checklist_progress').delete().in('task_id', taskIds);
            await supabase.from('task_approval_levels').delete().in('task_id', taskIds);
            await supabase.from('task_approval_history').delete().in('task_id', taskIds);
            await supabase.from('task_performance_logs').delete().in('task_id', taskIds);
            await supabase.from('notifications').delete().in('task_id', taskIds);
        }

        // ── 5. Delete live tasks ─────────────────────────────────────────────
        await supabase.from('tasks').delete().eq('project_id', id);

        // ── 6. Delete instance-level notifications then instances ────────────
        if (instanceIds.length > 0) {
            await supabase.from('notifications').delete().in('instance_id', instanceIds);
        }
        await supabase.from('instances').delete().eq('project_id', id);

        // ── 7. Delete template task children then template tasks ─────────────
        if (tmplIds.length > 0) {
            await supabase.from('template_task_checklist_items').delete().in('template_task_id', tmplIds);
        }
        await supabase.from('template_tasks').delete().eq('project_id', id);

        // ── 8. Finally delete the project itself ─────────────────────────────
        const { error } = await supabase.from('projects').delete().eq('id', id);
        if (error) return c.json({ message: error.message }, 400);

        return c.json({ message: 'Project and all related data deleted successfully.' }, 200);
    } catch (error) {
        return c.json({ message: error.message }, 500);
    }
};

export const copyTemplate = async (c) => {
    try {
        const id = c.req.param("id");
        const user = c.get("user");
        const supabase = getSupabase(c.env);

        // Fetch original project
        const { data: original, error: projErr } = await supabase
            .from('projects')
            .select('*')
            .eq('id', id)
            .single();

        if (projErr || !original) return c.json({ message: 'Project not found' }, 404);

        if (user.platform_role !== 'superadmin' && original.company_id !== user.company_id) {
            return c.json({ message: "Unauthorized access to project template" }, 403);
        }

        if (user.company_id) {
            await checkSubscriptionLimits(supabase, user.company_id, "projects");
        }

        const target_company_id = user.company_id;

        // Insert copy
        const { data: copy, error: copyErr } = await supabase
            .from('projects')
            .insert({
                company_id: target_company_id,
                name: `${original.name} (Copy)`,
                description: original.description,
                type: original.type,
                category: original.category,
                start_date: original.start_date,
                status: 'active',
            })
            .select()
            .single();
        if (copyErr) return c.json({ message: copyErr.message }, 400);

        // Fetch template tasks of original
        const { data: tasks } = await supabase
            .from('template_tasks')
            .select('*')
            .eq('project_id', id)
            .order('step_order', { ascending: true });

        if (tasks && tasks.length > 0) {
            const taskRows = tasks.map(t => ({
                project_id: copy.id,
                company_id: target_company_id,
                title: t.title,
                description: t.description,
                step_order: t.step_order,
                estimated_minutes: t.estimated_minutes,
                turnaround_minutes: t.turnaround_minutes,
                approval_required: t.approval_required,
                approval_levels: t.approval_levels,
                assigned_role: t.assigned_role,
            }));
            const { data: copiedTasks } = await supabase.from('template_tasks').insert(taskRows).select();

            // Copy checklist items for each task
            if (copiedTasks && copiedTasks.length > 0) {
                for (let i = 0; i < tasks.length; i++) {
                    const { data: checklistItems } = await supabase
                        .from('template_task_checklist_items')
                        .select('*')
                        .eq('template_task_id', tasks[i].id)
                        .order('sort_order', { ascending: true });

                    if (checklistItems && checklistItems.length > 0) {
                        const clRows = checklistItems.map(ci => ({
                            template_task_id: copiedTasks[i].id,
                            company_id: target_company_id,
                            item_text: ci.item_text,
                            sort_order: ci.sort_order,
                            requires_input: ci.requires_input || false,
                            input_label: ci.input_label || null,
                            input_placeholder: ci.input_placeholder || null,
                        }));
                        await supabase.from('template_task_checklist_items').insert(clRows);
                    }
                }
            }
        }

        return c.json({ ...copy, client_name: null }, 201);
    } catch (error) {
        return c.json({ message: error.message }, 500);
    }
};