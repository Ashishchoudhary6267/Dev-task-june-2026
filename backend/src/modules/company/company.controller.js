import { getSupabase } from "../../config/supabase.js";

export const updateCompany = async (c) => {
    try {
        const authUser = c.get("user");
        if (!authUser) return c.json({ message: "Unauthorized" }, 401);
        // if (authUser.platform_role !== "admin" || authUser.platform_role !== "superadmin" || authUser.platform_role !== "controller") {
        //     return c.json({ message: "Only admin can update company" }, 403);
        // }

        const {
            id,
            name, email, phone, address, website, description,
            working_days, work_start_time, work_end_time,
            team_size, industry, purpose,
            tier, subscription_start_date, subscription_end_date
        } = await c.req.json();
        const companyId = authUser.company_id;
        const supabase = getSupabase(c.env);
        const { data: existingCompany, error: companyError } = await supabase
            .from("companies").select("*").eq("id", id).maybeSingle();
        if (companyError || !existingCompany) return c.json({ message: "Company not found" }, 404);


        const updateData = {
            name, email, phone, address, website, description,
            working_days, work_start_time, work_end_time,
            team_size, industry, purpose,
            updated_at: new Date()
        };

        // Only superadmin can change tier and subscription dates
        if (authUser.platform_role === "superadmin") {
            if (tier !== undefined) updateData.tier = tier;
            if (subscription_start_date !== undefined) updateData.subscription_start_date = subscription_start_date;
            if (subscription_end_date !== undefined) updateData.subscription_end_date = subscription_end_date;
        }

        const { data: updatedCompany, error: updateError } = await supabase
            .from("companies")
            .update(updateData)
            .eq("id", id).select().maybeSingle();
        if (updateError) return c.json({ message: updateError.message }, 500);
        return c.json(updatedCompany, 200);
    } catch (error) {
        return c.json({ message: "Internal Server Error", error: error.message }, 500);
    }
};

export const getCompanyInfo = async (c) => {
    try {
        const authUser = c.get("user");
        if (!authUser) return c.json({ message: "Unauthorized" }, 401);
        const supabase = getSupabase(c.env);
        const company_id_param = c.req.query("company_id");
        let company_id = null;
        if (authUser.platform_role === "superadmin" && company_id_param) {
            company_id = company_id_param;
        } else {
            company_id = authUser.company_id;
        }

        const { data: existingCompany, error: companyError } = await supabase
            .from("companies").select("*").eq("id", company_id).single();
        if (companyError || !existingCompany) return c.json({ message: "Company not found" }, 404);
        return c.json(existingCompany, 200);
    } catch (error) {
        return c.json({ message: "Internal Server Error", error: error.message }, 500);
    }
};



export const updateCompanySettings = async (c) => {
    try {
        const authUser = c.get("user");
        if (!authUser) return c.json({ message: "Unauthorized" }, 401);
        const companyId = authUser.company_id;
        const supabase = getSupabase(c.env);
        const { data: existingCompany, error: companyError } = await supabase
            .from("companies").select("*").eq("id", companyId).single();
        if (companyError || !existingCompany) return c.json({ message: "Company not found" }, 404);

        const { working_days, work_start_time, work_end_time } = await c.req.json();
        const { data: updatedCompany, error: updateError } = await supabase
            .from("companies")
            .update({ working_days, work_start_time, work_end_time, updated_at: new Date() })
            .eq("id", companyId).select().maybeSingle();
        if (updateError) return c.json({ message: updateError.message }, 500);
        return c.json(updatedCompany, 200);
    } catch (error) {
        return c.json({ message: "Internal Server Error", error: error.message }, 500);
    }
};

export const getCompanySettings = async (c) => {
    try {
        const authUser = c.get("user");
        if (!authUser) return c.json({ message: "Unauthorized" }, 401);
        const company_id_param = c.req.query("company_id");
        let company_id = null;
        if (authUser.platform_role === "superadmin" && company_id_param) {
            company_id = company_id_param;
        } else {
            company_id = authUser.company_id;
        }

        console.log("companyid", company_id);

        const supabase = getSupabase(c.env);
        const { data: existingCompany, error: companyError } = await supabase
            .from("companies").select("*").eq("id", company_id).single();
        if (companyError || !existingCompany) return c.json({ message: "Company not found" }, 404);
        return c.json(existingCompany, 200);
    } catch (error) {
        return c.json({ message: "Internal Server Error", error: error.message }, 500);
    }
};

// ─── Notification Settings ────────────────────────────────────────────────────

const NOTIFICATION_DEFAULTS = {
    task_assigned: true,
    task_submitted: true,
    task_approved: false,
    task_rejected: true,
    task_completed: true,
};

/**
 * GET /api/companies/notification-settings
 * Returns the notification toggle state for the caller's company.
 * If no row exists yet, returns the defaults.
 */
export const getNotificationSettings = async (c) => {
    try {
        const authUser = c.get("user");
        if (!authUser) return c.json({ message: "Unauthorized" }, 401);

        const supabase = getSupabase(c.env);
        const { data, error } = await supabase
            .from("company_notification_settings")
            .select("*")
            .eq("company_id", authUser.company_id)
            .maybeSingle();

        if (error) return c.json({ message: error.message }, 500);

        // If no row exists yet, return defaults so the UI shows sensible values
        return c.json(data ?? { ...NOTIFICATION_DEFAULTS, company_id: authUser.company_id }, 200);
    } catch (error) {
        return c.json({ message: "Internal Server Error", error: error.message }, 500);
    }
};

/**
 * PATCH /api/companies/notification-settings
 * Upserts one or more boolean flags for the caller's company.
 * Body: { task_assigned?, task_submitted?, task_approved?, task_rejected?, task_completed? }
 */
export const updateNotificationSettings = async (c) => {
    try {
        const authUser = c.get("user");
        if (!authUser) return c.json({ message: "Unauthorized" }, 401);

        // Only controllers and admins can change company-wide settings
        const allowed = ["controller", "admin", "superadmin"];
        if (!allowed.includes(authUser.platform_role)) {
            return c.json({ message: "Forbidden" }, 403);
        }

        const body = await c.req.json();
        const validKeys = Object.keys(NOTIFICATION_DEFAULTS);

        // Only pick recognised boolean keys from the body
        const patch = {};
        for (const key of validKeys) {
            if (typeof body[key] === "boolean") patch[key] = body[key];
        }

        if (Object.keys(patch).length === 0) {
            return c.json({ message: "No valid fields to update" }, 400);
        }

        patch.updated_at = new Date().toISOString();

        const supabase = getSupabase(c.env);
        const { data, error } = await supabase
            .from("company_notification_settings")
            .upsert({ company_id: authUser.company_id, ...patch }, { onConflict: "company_id" })
            .select()
            .single();

        if (error) return c.json({ message: error.message }, 500);
        return c.json(data, 200);
    } catch (error) {
        return c.json({ message: "Internal Server Error", error: error.message }, 500);
    }
};

