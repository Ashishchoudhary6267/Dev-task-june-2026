import { getSupabase } from "../../config/supabase.js";
import { getSupabaseAdmin } from "../../config/supabaseAdmin.js";

export const loginUser = async (email, password, env) => {
    const supabase = getSupabase(env);
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (error) throw new Error(error.message);

    return data;
};

export const resetPasswordForEmail = async (email, redirectTo, env) => {
    const supabase = getSupabase(env);
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
    });

    if (error) throw new Error(error.message);

    return data;
};

export const updatePassword = async (userId, newPassword, env) => {
    const supabaseAdmin = getSupabaseAdmin(env);
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        { password: newPassword }
    );

    if (error) throw new Error(error.message);

    return data;
};
