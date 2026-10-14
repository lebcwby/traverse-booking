// Cross-session Meta identifier persistence.
//
// Cookies alone are enough for the common case (ad-blocker user inside one
// browser session). This table is the fallback for two longer-term cases:
//   1. User clears _fbp/_fbc but keeps _sp_visitor_id — we can rehydrate.
//   2. User books with email later — we link email_hash so retargeting and
//      lookalike audiences stitch across devices via Meta's user graph.
//
// Writes are fire-and-forget from CAPI route handlers (Node runtime). The
// edge middleware does NOT write here — DB calls from edge are slow and
// would block every request. Middleware only sets cookies; the route
// handlers persist after the CAPI call completes.

import { getSupabaseAdmin } from "@/lib/supabase-admin";

interface VisitorMetaIds {
  visitorId: string;
  fbp?: string;
  fbc?: string;
  fbclid?: string;
  fbclidTs?: number;
  emailHash?: string;
}

export async function upsertMetaVisitor(ids: VisitorMetaIds): Promise<void> {
  if (!ids.visitorId) return;

  try {
    const supabase = getSupabaseAdmin();

    // Send ONLY the fields we actually have on this event.
    //
    // PostgREST derives both the INSERT column list and the
    // `ON CONFLICT DO UPDATE SET` clause from the keys present in the payload,
    // so an omitted key leaves the stored value untouched while an explicit
    // `null` overwrites it. This used to send every column with `?? null`,
    // which quietly erased identifiers on each later event:
    //
    //   - `email_hash` arrives only on the one event where the guest supplied
    //     an email. It is the join key Meta's graph uses for cross-device
    //     stitching — the reason this table exists — and the visitor's very
    //     next anonymous PageView wiped it.
    //   - `fbc` carries the ad-click attribution and is absent from most
    //     later events, so ad-originated visits lost their click id.
    //
    // Same class of bug as the Guesty `customFields` and
    // `publicDescription.notes` wipes: a field-selective write that replaces
    // wholesale. Keep this additive — never reintroduce `?? null` here.
    const row: Record<string, unknown> = {
      visitor_id: ids.visitorId,
      last_seen_at: new Date().toISOString(),
    };
    if (ids.fbp) row.fbp = ids.fbp;
    if (ids.fbc) row.fbc = ids.fbc;
    if (ids.fbclid) row.fbclid = ids.fbclid;
    if (typeof ids.fbclidTs === "number" && Number.isFinite(ids.fbclidTs)) {
      row.fbclid_ts = ids.fbclidTs;
    }
    if (ids.emailHash) row.email_hash = ids.emailHash;

    const { error } = await supabase
      .from("sp_meta_visitors")
      .upsert(row, { onConflict: "visitor_id" });
    if (error) {
      console.error("[Meta Visitor Store] upsert error:", error.message);
    }
  } catch (err) {
    console.error("[Meta Visitor Store] upsert threw:", err);
  }
}

/**
 * Fetch stored Meta identifiers for a visitor, used as a fallback when the
 * client cookies are missing on a request. Returns null if no row exists or
 * the lookup fails.
 */
export async function lookupMetaVisitor(visitorId: string): Promise<{
  fbp?: string;
  fbc?: string;
  fbclid?: string;
  fbclidTs?: number;
} | null> {
  if (!visitorId) return null;

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("sp_meta_visitors")
      .select("fbp, fbc, fbclid, fbclid_ts")
      .eq("visitor_id", visitorId)
      .maybeSingle();

    if (error || !data) return null;
    return {
      fbp: (data.fbp as string | null) ?? undefined,
      fbc: (data.fbc as string | null) ?? undefined,
      fbclid: (data.fbclid as string | null) ?? undefined,
      fbclidTs: (data.fbclid_ts as number | null) ?? undefined,
    };
  } catch (err) {
    console.error("[Meta Visitor Store] lookup threw:", err);
    return null;
  }
}
