import { getSupabaseAdmin } from "../../config/supabaseAdmin.js";
import { getSupabase } from "../../config/supabase.js";

export const createUser = async (companyId, payload, env) => {
    const { name, email, password, platformRole, workflowRoleId } = payload;
    const supabaseAdmin = getSupabaseAdmin(env);
    const supabase = getSupabase(env);

    const { data: authData, error: authError } =
        await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
        });

    if (authError) throw authError;

    const userId = authData.user.id;

    const { error: profileError } = await supabase
        .from("users")
        .insert({
            id: userId,
            company_id: companyId,
            name,
            platform_role: platformRole,
            workflow_role_id: workflowRoleId || null,
            login_count: 0,
        });

    if (profileError) throw profileError;

    return { message: "User created successfully" };
};
