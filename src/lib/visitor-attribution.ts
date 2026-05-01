import { getSupabaseAdmin } from "@/lib/supabase-admin";

interface AttributionData {
  gclid?: string;
  gbraid?: string;
  wbraid?: string;
  fbclid?: string;
  fbclid_ts?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
}

/**
 * Persist visitor attribution keyed by email for cross-device bridging.
 * First-touch is written once (preserved on subsequent calls).
 * Last-touch is always updated.
 * Fire-and-forget — never throws.
 */
export async function persistVisitorAttribution(
  email: string,
  cookies: { attribution?: string; firstTouch?: string }
): Promise<void> {
  try {
    let lastTouch: AttributionData | null = null;
    let firstTouch: AttributionData | null = null;

    if (cookies.attribution) {
      try {
        lastTouch = JSON.parse(cookies.attribution);
      } catch {
        /* ignore */
      }
    }
    if (cookies.firstTouch) {
      try {
        firstTouch = JSON.parse(cookies.firstTouch);
      } catch {
        /* ignore */
      }
    }

    if (!lastTouch && !firstTouch) return;

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.rpc("upsert_visitor_attribution", {
      p_email: email.toLowerCase().trim(),
      p_first_touch: firstTouch || lastTouch,
      p_last_touch: lastTouch || firstTouch,
    });

    if (error) {
      console.error("[VisitorAttribution] Upsert error:", error.message);
    }
  } catch (err) {
    console.error("[VisitorAttribution] Error:", err);
  }
}

/**
 * Look up first-touch attribution by email. Used as a fallback when
 * the first-touch cookie is missing (cross-device scenario).
 */
export async function lookupFirstTouchAttribution(
  email: string
): Promise<AttributionData | null> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("visitor_attribution")
      .select("first_touch")
      .eq("email", email.toLowerCase().trim())
      .single();

    if (error || !data?.first_touch) return null;
    return data.first_touch as AttributionData;
  } catch {
    return null;
  }
}
