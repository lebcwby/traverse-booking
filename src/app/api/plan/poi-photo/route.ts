// src/app/api/plan/poi-photo/route.ts
// Proxies POI photos so the Google Places API key stays server-side.
// sp_pois.photo_url rows embed ?key=... in the URL; we never ship that to the
// browser. Clients only see /api/plan/poi-photo?id={poiId} — this route
// resolves the row and streams upstream bytes back with long cache headers.

import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "edge";

const PHOTO_CACHE_HEADER =
  "public, max-age=2592000, s-maxage=2592000, stale-while-revalidate=86400";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const { data, error } = await getSupabaseAdmin()
    .from("sp_pois")
    .select("photo_url")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data?.photo_url) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  try {
    const upstream = await fetch(data.photo_url, { redirect: "follow" });
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        { error: "upstream failed" },
        { status: upstream.status || 502 }
      );
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") ?? "image/jpeg",
        "Cache-Control": PHOTO_CACHE_HEADER,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
