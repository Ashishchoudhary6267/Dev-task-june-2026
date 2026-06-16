import { createClient } from "@supabase/supabase-js";

// Returns a fresh supabase client using env bindings from Cloudflare.
// Call this inside each request handler: const supabase = getSupabase(c.env);
export function getSupabase(env) {
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
