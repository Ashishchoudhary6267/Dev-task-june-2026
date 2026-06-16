import { createUser } from "./user.service.js";
import { getSupabase } from "../../config/supabase.js";
import { checkSubscriptionLimits } from "../../utils/subscription.js";

export const createNewUser = async (c) => {
    try {
        const company_id = c.get("user").company_id;
        const supabase = getSupabase(c.env);

        await checkSubscriptionLimits(supabase, company_id, "users");

        const result = await createUser(company_id, await c.req.json(), c.env);
        return c.json(result, 201);
    } catch (error) {
        return c.json({ message: error.message }, error.status || 400);
    }
};

export const getallusers = async (c) => {
    try {
        const { search, roles, page, limit } = c.req.query();
        const supabase = getSupabase(c.env);

        let query = supabase
            .from("users")
            .select("*", { count: "exact" })
            .eq("is_active", true)
            .eq("company_id", c.get("user").company_id)
            .order("created_at", { ascending: false });

        if (search) query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
        if (roles) {
            const roleArray = roles.split(",").map((r) => r.trim());
            const platformRoles = ['admin', 'controller', 'member', 'superadmin'];

            // If any of the requested roles are platform roles, check that column
            const containsPlatformRole = roleArray.some(r => platformRoles.includes(r.toLowerCase()));

            if (containsPlatformRole) {
                query = query.in("platform_role", roleArray);
            } else {
                query = query.in("workflow_role", roleArray);
            }
        }
        if (page && limit) {
            const from = (parseInt(page, 10) - 1) * parseInt(limit, 10);
            const to = from + parseInt(limit, 10) - 1;
            query = query.range(from, to);
        }

        const { data, count, error } = await query;
        if (error) return c.json({ message: error.message }, 400);
        return c.json({ data, userCount: count }, 200);
    } catch (error) {
        return c.json({ message: error.message }, 400);
    }
};

export const addUser = async (c) => {
    try {
        const { name, email, password, platform_role, workflow_role } = await c.req.json();
        const company_id = c.get("user").company_id;

        if (!name || !email || !password || !platform_role) {
            return c.json({ message: "Required fields missing" }, 400);
        }

        const supabase = getSupabase(c.env);

        await checkSubscriptionLimits(supabase, company_id, "users");

        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
        });
        if (authError) return c.json({ message: authError.message }, 400);

        const userId = authData.user.id;
        const { data, error } = await supabase
            .from("users")
            .insert({
                id: userId,
                company_id,
                name,
                email,
                platform_role,
                workflow_role: platform_role === "member" ? workflow_role : null,
                is_active: true,
                login_count: 0,
            })
            .select().single();
        if (error) return c.json({ message: error.message }, 400);
        return c.json(data, 201);
    } catch (error) {
        return c.json({ message: error.message }, 500);
    }
};

export const updateuser = async (c) => {
    try {
        const { userId, name, email, platform_role, workflow_role } = await c.req.json();
        if (!userId) return c.json({ message: "userId is required" }, 400);

        const supabase = getSupabase(c.env);
        const { data, error } = await supabase
            .from("users")
            .update({ name, email, platform_role, workflow_role: platform_role === "member" ? workflow_role : null })
            .eq("id", userId).eq("company_id", c.get("user").company_id).select().single();
        if (error) return c.json({ message: error.message }, 400);

        if (email) {
            const { error: authError } = await supabase.auth.admin.updateUserById(userId, { email, email_confirm: true });
            if (authError) return c.json({ message: `Auth update failed: ${authError.message}` }, 400);
        }
        return c.json(data, 200);
    } catch (error) {
        return c.json({ message: error.message }, 500);
    }
};

export const deactivateuser = async (c) => {
    try {
        const { userId } = await c.req.json();
        const supabase = getSupabase(c.env);
        const { data, error } = await supabase
            .from("users").update({ is_active: false })
            .eq("id", userId).eq("company_id", c.get("user").company_id).select().single();
        if (error) return c.json({ message: error.message }, 400);
        return c.json(data, 200);
    } catch (error) {
        return c.json({ message: error.message }, 500);
    }
};
