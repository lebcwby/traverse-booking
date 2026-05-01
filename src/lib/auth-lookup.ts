import { getAuthAdmin } from "./supabase-auth-admin";

export interface AuthUserLookup {
  exists: boolean;
  /**
   * Provider strings from the user's identities (e.g. "email", "google").
   * "email" indicates the account has a password set; "google" means it was
   * created or linked via Google OAuth. Used to drive which sign-in options
   * to surface in the welcome-back UI.
   */
  providers: string[];
}

const EMPTY_LOOKUP: AuthUserLookup = { exists: false, providers: [] };

export async function lookupAuthUserByEmail(
  email: string
): Promise<AuthUserLookup> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return EMPTY_LOOKUP;

  try {
    const admin = getAuthAdmin();

    // The admin.auth.admin.listUsers email filter is unreliable — it returns
    // fuzzy/wrong matches. Use a SECURITY DEFINER function that queries
    // auth.users directly for an exact email match.
    const { data: rpcRows, error: rpcError } = await admin.rpc(
      "lookup_user_by_email",
      { lookup_email: normalized }
    );

    if (rpcError || !Array.isArray(rpcRows) || !rpcRows.length)
      return EMPTY_LOOKUP;

    const userId = (rpcRows[0] as { id: string }).id;

    const { data: detailData, error: detailError } =
      await admin.auth.admin.getUserById(userId);

    if (detailError || !detailData?.user) {
      return { exists: true, providers: [] };
    }

    const identities = (detailData.user.identities ?? []) as Array<{
      provider?: string;
    }>;
    const providers = Array.from(
      new Set(
        identities
          .map((identity) => identity.provider)
          .filter((p): p is string => typeof p === "string" && p.length > 0)
      )
    );

    return { exists: true, providers };
  } catch {
    return EMPTY_LOOKUP;
  }
}

/**
 * Thin compatibility wrapper. Prefer `lookupAuthUserByEmail` when you also
 * need provider info.
 */
export async function userExistsByEmail(email: string): Promise<boolean> {
  return (await lookupAuthUserByEmail(email)).exists;
}
