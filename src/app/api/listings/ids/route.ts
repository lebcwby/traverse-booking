// /api/listings/ids
//
// The set of Guesty ids that currently resolve to a real listing page, as a
// flat list. Exists for one caller: the listing-URL validator in src/proxy.ts,
// which has to decide at the edge whether /properties/<slug> is real BEFORE
// the page starts streaming.
//
// Why an endpoint rather than querying Supabase from the edge: the `listings`
// mirror is readable only with the service-role key (anon is blocked by RLS),
// and the proxy runs on every request. Keeping the credential here and letting
// the CDN cache the result means the edge holds no secret and the lookup costs
// one cached fetch per instance per TTL.
//
// Nothing here is private — every one of these ids already appears in the
// public sitemap as part of a /properties/<slug> URL.

import { NextResponse } from "next/server";
import { getListings } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const listings = await getListings({ limit: 1000 });
    const ids = listings.map((l) => l.guesty_id).filter(Boolean);
    return NextResponse.json(
      { count: ids.length, ids },
      {
        headers: {
          // Cached hard: the validator fails open, so a slightly stale list
          // can only ever let a dead URL through for a few minutes — never
          // 404 a live listing that was added since.
          "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600",
        },
      }
    );
  } catch (err) {
    console.error("[listings/ids] failed:", err);
    // 503 rather than an empty 200: an empty list is indistinguishable from
    // "no listings exist", and the validator must treat it as unknown and let
    // traffic through rather than 404 the whole catalogue.
    return NextResponse.json(
      { error: "listing ids unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
