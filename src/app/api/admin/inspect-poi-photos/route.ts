/**
 * Admin endpoint to diagnose /plan activity-image breakage.
 *
 * Built 2026-05-27 after Nadim noticed POI activity photos weren't
 * rendering on freshly-generated itineraries. The image src is
 * /api/plan/poi-photo?id=<poiId> which proxies to sp_pois.photo_url
 * (Google Places URL with embedded API key). If the upstream fetch
 * fails, the <img> shows broken.
 *
 * This endpoint reports sp_pois health:
 *   - total row count
 *   - rows with photo_url vs null
 *   - tries an upstream fetch on the most recent row with a photo_url
 *     and returns the status code + key fingerprint (so we can spot a
 *     stale/wrong key without exposing it)
 *
 * USAGE:
 *   /api/admin/inspect-poi-photos
 *   /api/admin/inspect-poi-photos?id=<specific-poi-id>
 *
 * Auth: admin email Supabase session OR Bearer CRON_SECRET.
 */

import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { createServerSupabaseClient } from "@/lib/supabase-auth-server";

export const dynamic = "force-dynamic";

const ADMIN_EMAILS = new Set([
  "nadim@traversehospitality.com",
  "ngtannous@gmail.com",
  "alex@traversehospitality.com",
  "sabrina@traversehospitality.com",
]);

async function authorize(request: Request): Promise<boolean> {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && auth === `Bearer ${secret}`) return true;
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.email && ADMIN_EMAILS.has(user.email.toLowerCase())) return true;
  } catch {
    /* fall through */
  }
  return false;
}

function keyFingerprint(url: string): string | null {
  const m = url.match(/[?&]key=([^&]+)/);
  if (!m) return null;
  const key = m[1];
  if (key.length < 6) return "(short)";
  return `${key.slice(0, 4)}…${key.slice(-2)} (len=${key.length})`;
}

async function probePhotoUrl(photoUrl: string) {
  try {
    const res = await fetch(photoUrl, { redirect: "follow" });
    let bodyPreview: string | null = null;
    if (!res.ok) {
      bodyPreview = (await res.text()).slice(0, 300);
    }
    return {
      status: res.status,
      ok: res.ok,
      contentType: res.headers.get("content-type"),
      contentLength: res.headers.get("content-length"),
      bodyPreview,
    };
  } catch (err) {
    return {
      status: 0,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function GET(request: Request) {
  if (!(await authorize(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const idParam = url.searchParams.get("id");
  const supabase = getSupabaseAdmin();

  if (idParam) {
    const { data, error } = await supabase
      .from("sp_pois")
      .select("id, name, photo_url, town, category")
      .eq("id", idParam)
      .maybeSingle();
    if (error || !data) {
      return NextResponse.json(
        { error: error?.message || "POI not found", id: idParam },
        { status: 404 }
      );
    }
    const probe = data.photo_url ? await probePhotoUrl(data.photo_url) : null;
    return NextResponse.json({
      id: data.id,
      name: data.name,
      town: data.town,
      category: data.category,
      hasPhotoUrl: !!data.photo_url,
      keyFingerprint: data.photo_url
        ? keyFingerprint(data.photo_url)
        : null,
      upstreamProbe: probe,
    });
  }

  // Health-check mode.
  const totalResp = await supabase
    .from("sp_pois")
    .select("id", { count: "exact", head: true });
  const withPhotoResp = await supabase
    .from("sp_pois")
    .select("id", { count: "exact", head: true })
    .not("photo_url", "is", null);
  const sampleResp = await supabase
    .from("sp_pois")
    .select("id, name, photo_url, town")
    .not("photo_url", "is", null)
    .limit(1);

  const sample = sampleResp.data?.[0];
  const probe = sample?.photo_url
    ? await probePhotoUrl(sample.photo_url)
    : null;

  return NextResponse.json({
    counts: {
      total: totalResp.count ?? null,
      withPhotoUrl: withPhotoResp.count ?? null,
      withoutPhotoUrl:
        totalResp.count != null && withPhotoResp.count != null
          ? totalResp.count - withPhotoResp.count
          : null,
    },
    sample: sample
      ? {
          id: sample.id,
          name: sample.name,
          town: sample.town,
          keyFingerprint: keyFingerprint(sample.photo_url),
          upstreamProbe: probe,
        }
      : null,
    nextSteps: [
      "If counts.withPhotoUrl is 0, the seed never populated photo_url — re-run pois seed.",
      "If sample.upstreamProbe.status is 403, the Google Places API key is rejected — check key restrictions / billing in Google Cloud Console.",
      "If sample.upstreamProbe.status is 200 but the browser still shows broken images, the issue is downstream (CSP, /api/plan/poi-photo route, or component render).",
      "Pass ?id=<poiId> to test a specific POI from a broken plan.",
    ],
  });
}
