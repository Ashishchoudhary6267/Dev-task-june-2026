import { getSupabase } from "../config/supabase.js";

/**
 * Middleware to check granular permissions for Controllers
 * @param {string} module - The module name (clients, projects, tasks, etc.)
 * @param {string} action - The action type (read, write, delete)
 */
export const checkPermission = (module, action) => async (c, next) => {
    try {
        const user = c.get("user");

        // Admins always have full access
        if (user.platform_role === 'admin') {
            return await next();
        }

        // Only Controllers are subject to granular permissions in this version
        // Standard members might have even more restricted access (implied)
        if (user.platform_role !== 'controller') {
            return c.json({ message: "Forbidden: Granular permissions are for controllers/admins." }, 403);
        }

        const supabase = getSupabase(c.env);
        const { data: permission, error } = await supabase
            .from("controller_permissions")
            .select(`can_${action}`)
            .eq("user_id", user.id)
            .eq("module", module)
            .maybeSingle();

        if (error) {
            console.error("RBAC Middleware Error:", error);
            return c.json({ message: "Authorization check failed" }, 500);
        }

        // Check the specific action boolean
        if (permission && permission[`can_${action}`]) {
            return await next();
        }

        return c.json({ 
            message: `Forbidden: You do not have '${action}' access to the ${module} module.` 
        }, 403);

    } catch (err) {
        console.error("RBAC Unexpected Error:", err);
        return c.json({ message: "Internal server error" }, 500);
    }
};
