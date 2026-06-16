import { getSupabase } from "../../config/supabase.js";

/**
 * Fetch all permissions for a specific user
 */
export const getPermissionsByUser = async (c) => {
    try {
        const userId = c.req.param('user_id');
        const user = c.get("user");
        const companyId = user.company_id;

        if (!userId) return c.json({ message: "User ID is required" }, 400);

        const supabase = getSupabase(c.env);
        const { data, error } = await supabase
            .from("controller_permissions")
            .select("*")
            .eq("user_id", userId)
            .eq("company_id", companyId);

        if (error) return c.json({ message: error.message }, 400);

        return c.json({ data }, 200);
    } catch (err) {
        console.error("Get Permissions Error:", err);
        return c.json({ message: "Internal server error" }, 500);
    }
};

/**
 * Update (Upsert) permissions for a user and module
 */
export const updatePermissions = async (c) => {
    try {
        const { user_id, module, can_read, can_write, can_delete } = await c.req.json();
        const user = c.get("user");
        const companyId = user.company_id;

        if (!user_id || !module) {
            return c.json({ message: "User ID and Module are required" }, 400);
        }

        const supabase = getSupabase(c.env);
        
        const { data, error } = await supabase
            .from("controller_permissions")
            .upsert({
                user_id,
                module,
                company_id: companyId,
                can_read,
                can_write,
                can_delete,
                updated_at: new Date().toISOString()
            }, { 
                onConflict: 'user_id, module' 
            })
            .select()
            .single();

        if (error) return c.json({ message: error.message }, 400);

        return c.json({ message: "Permissions updated successfully", data }, 200);
    } catch (err) {
        console.error("Update Permissions Error:", err);
        return c.json({ message: "Internal server error" }, 500);
    }
};
