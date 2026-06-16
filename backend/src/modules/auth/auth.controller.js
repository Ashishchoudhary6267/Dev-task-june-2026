import { loginUser, updatePassword } from "./auth.service.js";
import { getSupabase } from "../../config/supabase.js";
import { sendPasswordResetEmail, sendAdminChangePasswordEmail } from "../../utils/email.js";
import { sendNotification } from "../../utils/notify.js";

export const login = async (c) => {
    try {
        const { email, password } = await c.req.json();
        const data = await loginUser(email, password, c.env);

        const id = data.user.id;
        const supabase = getSupabase(c.env);

        // Fetch user data first to get current login_count
        const { data: userData, error: userError } = await supabase
            .from("users")
            .select("*")
            .eq("id", id)
            .maybeSingle();

        if (userError) throw new Error(userError.message);
        if (!userData) return c.json({ message: "User profile not found" }, 404);

        if (userData?.is_active === false) {
            return c.json({ message: "Your account has been deactivated. Please contact your administrator." }, 400);
        }

        // Increment login_count and mark first_login_completed on first login
        const isFirstLogin = (userData.login_count || 0) === 0;
        const newLoginCount = (userData.login_count || 0) + 1;
        
        await supabase
            .from("users")
            .update({ 
                login_count: newLoginCount,
                last_seen_at: new Date().toISOString()
            })
            .eq("id", id);

        // Update local userData object for the response
        userData.login_count = newLoginCount;
        userData.is_first_login = isFirstLogin;

        if (userData?.platform_role === 'controller' || userData?.workflow_role === 'interim_manager') {
            const { data: permissions, error: permissionsError } = await supabase
                .from("controller_permissions")
                .select("*")
                .eq("user_id", id);
            if (permissionsError) throw new Error(permissionsError.message);
            if (!permissions) return c.json({ message: "Permissions not found" }, 404);
            userData.permissions = permissions;
        }
        if (userError) throw new Error(userError.message);

        return c.json({ message: "Login successful", authData: data, userData }, 200);
    } catch (error) {
        return c.json({ message: error.message }, 400);
    }
};

export const forgotPassword = async (c) => {
    try {
        const { email } = await c.req.json();
        if (!email) return c.json({ message: "Email is required" }, 400);

        const supabase = getSupabase(c.env);
        const { data: user, error } = await supabase.from("users").select("*").eq("email", email).maybeSingle();
        if (error) throw new Error(error.message);
        if (!user) return c.json({ message: "User with this email not found" }, 404);
        if (user.is_active === false) {
            return c.json({ message: "Your account has been deactivated. Please contact your administrator." }, 400);
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 2);

        const { error: insertError } = await supabase
            .from("password_resets")
            .insert([{ user_id: user.id, email, otp, expires_at: expiresAt.toISOString() }]);

        if (insertError) throw new Error(insertError.message);

        await sendPasswordResetEmail(email, otp, c.env);

        return c.json({ message: "A 6-digit verification code has been sent to your email" }, 200);
    } catch (error) {
        return c.json({ message: error.message }, 400);
    }
};

export const resetPassword = async (c) => {
    try {
        const { email, otp, newPassword } = await c.req.json();
        if (!email || !otp || !newPassword) {
            return c.json({ message: "Email, OTP, and new password are required" }, 400);
        }

        const supabase = getSupabase(c.env);
        const { data: resetRecord, error: fetchError } = await supabase
            .from("password_resets")
            .select("*")
            .eq("email", email)
            .eq("otp", String(otp))
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (fetchError) throw new Error(fetchError.message);
        if (!resetRecord) return c.json({ message: "Invalid verification code" }, 400);
        if (new Date(resetRecord.expires_at) < new Date()) {
            return c.json({ message: "Verification code has expired" }, 400);
        }

        await updatePassword(resetRecord.user_id, newPassword, c.env);
        await supabase.from("password_resets").delete().eq("id", resetRecord.id);

        return c.json({ message: "Password updated successfully" }, 200);
    } catch (error) {
        return c.json({ message: error.message }, 400);
    }
};


export const changePasswordByAdmin = async (c) => {
    try {
        const { id, password } = await c.req.json();
        console.log(id, password);
        const supabase = getSupabase(c.env);

        const { data: user, error: fetchError } = await supabase.from("users").select("*").eq("id", id).maybeSingle();
        if (!user) return c.json({ message: "User not found" }, 404);

        if (!password) {
            return c.json({ message: "Password is required" }, 400);
        }

        if (fetchError) throw new Error(fetchError.message);

        await updatePassword(user.id, password, c.env);

        const { data: updatedPass, error: updateError } = await supabase.from("users").update({ password_changed_by_admin: true }).eq("id", user.id)
        if (updateError) throw new Error(updateError.message);

        // Notify user via email and system notification
        try {
            await sendAdminChangePasswordEmail(user.email, c.env);
            await sendNotification({
                user_id: user.id,
                type: 'Password Changed',
                title: 'Security Alert: Password Changed',
                message: 'Your password has been changed by an administrator. Please contact them for your new credentials.',
                company_id: user.company_id || null,
            }, c);
        } catch (notifyErr) {
            console.error("Failed to send admin password change notifications:", notifyErr);
        }

        return c.json({ message: "Password changed successfully", updatedPass }, 200);
    } catch (error) {
        return c.json({ message: error.message }, 400);
    }
};

export const googleLogin = async (c) => {
    try {
        const authHeader = c.req.header("authorization");
        const token = authHeader?.split(" ")[1];

        if (!token) {
            return c.json({ message: "No token provided" }, 401);
        }

        const supabase = getSupabase(c.env);
        const { data: authData, error: authError } = await supabase.auth.getUser(token);

        if (authError || !authData.user) {
            return c.json({ message: "Invalid Google session", error: authError?.message }, 401);
        }

        const userEmail = authData.user.email;
        const userId = authData.user.id;

        // 1. Check if user exists in our database
        const { data: userData, error: userError } = await supabase
            .from("users")
            .select("*")
            .eq("id", userId)
            .maybeSingle();

        if (userData) {
            // User exists - complete login
            if (userData.is_active === false) {
                return c.json({
                    status: 'DEACTIVATED',
                    message: "Your account has been deactivated. Please contact your administrator."
                }, 403);
            }

            // Increment login_count and mark first_login_completed on first login
            const isFirstLogin = (userData.login_count || 0) === 0;
            const newLoginCount = (userData.login_count || 0) + 1;
            
            await supabase
                .from("users")
                .update({ 
                    login_count: newLoginCount,
                    last_seen_at: new Date().toISOString()
                })
                .eq("id", userId);
            
            userData.login_count = newLoginCount;
            userData.is_first_login = isFirstLogin;

            // Fetch permissions if needed
            if (userData.platform_role === 'controller' || userData.workflow_role === 'interim_manager') {
                const { data: permissions } = await supabase
                    .from("controller_permissions")
                    .select("*")
                    .eq("user_id", userId);
                userData.permissions = permissions || [];
            }

            return c.json({
                status: 'LOGGED_IN',
                message: "Login successful",
                userData,
                authData: { user: authData.user, session: { access_token: token } } // Minimal auth data for store
            }, 200);
        }

        // 2. User doesn't exist in 'users' table, check onboarding_requests
        const { data: requestData } = await supabase
            .from("onboarding_requests")
            .select("*")
            .eq("contact_email", userEmail)
            .maybeSingle();

        if (requestData) {
            if (requestData.status === 'pending') {
                return c.json({
                    status: 'PENDING_APPROVAL',
                    message: "Your registration request is pending approval.",
                    request: requestData
                }, 200);
            }
            if (requestData.status === 'rejected') {
                return c.json({
                    status: 'NOT_REGISTERED',
                    message: "Your previous request was rejected. You can submit a new one.",
                    googleUser: {
                        email: userEmail,
                        name: authData.user.user_metadata?.full_name || authData.user.user_metadata?.name || ""
                    }
                }, 200);
            }
        }

        // 3. No record found at all
        return c.json({
            status: 'NOT_REGISTERED',
            message: "User not found in our records.",
            googleUser: {
                email: userEmail,
                name: authData.user.user_metadata?.full_name || authData.user.user_metadata?.name || ""
            }
        }, 200);

    } catch (error) {
        return c.json({ message: "Internal Server Error", error: error.message }, 500);
    }
};