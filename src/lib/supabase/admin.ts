import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client for privileged server-side operations
 * (e.g. bulk user creation, running drafts).
 *
 * This client bypasses Row Level Security. Never expose it to the browser.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
