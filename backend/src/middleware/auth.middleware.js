import { getSupabase } from "../config/supabase.js";

export const authenticate = async (c, next) => {
    try {
        const authHeader = c.req.header("authorization");
        const token = authHeader?.split(" ")[1];

        if (!token) {
            return c.json({ message: "Unauthorized" }, 401);
        }

        const supabase = getSupabase(c.env);
        const { data: authData, error: authError } = await supabase.auth.getUser(token);

        if (authError) return c.json({ message: "Invalid token" }, 401);

        const { data: profile, error: profileError } = await supabase
            .from("users")
            .select("*")
            .eq("id", authData.user.id)
            .single();

        if (profileError) return c.json({ message: "Invalid token" }, 401);

        // Store user in context for downstream handlers
        const userContext = {
            ...authData.user,
            ...profile,
        };

        // IMPERSONATION LOGIC
        const impersonateId = c.req.header("X-Impersonate-User");
        if (impersonateId && profile.platform_role === 'superadmin') {
            const { data: targetProfile, error: targetError } = await supabase
                .from("users")
                .select("*")
                .eq("id", impersonateId)
                .maybeSingle();

            if (targetProfile && !targetError) {
                // Swap the context to the target user, but keep a reference to the original admin
                c.set("user", {
                    ...targetProfile,
                    isImpersonating: true,
                    originalAdminId: profile.id
                });
            } else {
                c.set("user", userContext);
            }
        } else {
            c.set("user", userContext);
        }

        await next();
    } catch (error) {
        return c.json({ message: "Invalid token" }, 401);
    }
};
