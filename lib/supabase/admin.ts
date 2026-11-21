import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client with the SERVICE ROLE key. It bypasses Row Level Security,
 * so it is ONLY used on the server by the Retell webhook and the cron job,
 * never in anything sent to the browser.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
