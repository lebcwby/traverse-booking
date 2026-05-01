import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Auth admin client — connects to the book-traverse Supabase project
// for auth operations only (createUser, deleteUser, etc.).
// All data operations use the shared DB via supabase-admin.ts.

let _authAdmin: SupabaseClient | null = null;

export function getAuthAdmin(): SupabaseClient {
  if (!_authAdmin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error(
        "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set"
      );
    }
    _authAdmin = createClient(url, key);
  }
  return _authAdmin;
}
