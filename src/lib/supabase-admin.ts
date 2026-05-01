import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Data admin client — connects to the data DB for all data operations.
// Auth operations use supabase-auth-admin.ts.

let _supabaseAdmin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (!_supabaseAdmin) {
    const url =
      process.env.SHARED_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key =
      process.env.SHARED_SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error(
        "SHARED_SUPABASE_URL and SHARED_SUPABASE_SERVICE_ROLE_KEY must be set"
      );
    }
    _supabaseAdmin = createClient(url, key);
  }
  return _supabaseAdmin;
}
