import { createClient } from "@supabase/supabase-js";

// Admin client (service role) for privileged operations like updating auth users.
export function getSupabaseAdmin(env) {
    return createClient(
        env.SUPABASE_URL,
        env.SUPABASE_SERVICE_ROLE_KEY,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        }
    );
}
