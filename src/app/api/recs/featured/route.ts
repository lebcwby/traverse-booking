// src/app/api/recs/featured/route.ts
// Read-only endpoint that returns the same admin-curated featured listings
// the home page renders (kv_store.featured_listings — written by the
// /api/featured/refresh cron). Trimmed to the fields the recommend-chat
// CTA cards need so the response stays small.
//
// Anonymous + edge-cached. The data is non-sensitive (public listing info)
// and changes infrequently — the writer cron runs every 6 hours.

import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getListingSlug } from "@/lib/utils";

export const runtime = "nodejs";
export const revalidate = 300;

interface CachedListing {
  guesty_id?: string;
  title?: string | null;
  nickname?: string | null;
  picture?: string | null;
  pictures?: string[] | null;
  bedrooms?: number | null;
  accommodates?: number | null;
  prices?: { basePrice?: number | null; currency?: string | null } | null;
  property_type?: string | null;
}

interface CardListing {
  guesty_id: string;
  slug: string;
  title: string;
  picture: string | null;
  bedrooms: number | null;
  accommodates: number | null;
  basePrice: number | null;
  property_type: string | null;
}

function shape(r: CachedListing): CardListing | null {
  if (!r.guesty_id) return null;
  return {
    guesty_id: r.guesty_id,
    slug: getListingSlug(r.title ?? null, r.guesty_id),
    title: r.title ?? r.nickname ?? "Book Traverse home",
    picture: r.picture ?? r.pictures?.[0] ?? null,
    bedrooms: r.bedrooms ?? null,
    accommodates: r.accommodates ?? null,
    basePrice: r.prices?.basePrice ?? null,
    property_type: r.property_type ?? null,
  };
}

export async function GET() {
  try {
    const { data } = await getSupabaseAdmin()
      .from("kv_store")
      .select("value")
      .eq("key", "featured_listings")
      .maybeSingle();

    const raw = (data?.value ?? []) as CachedListing[];
    const listings = raw.map(shape).filter((l): l is CardListing => l !== null);

    return NextResponse.json(
      { listings },
      {
        headers: {
          // 5-minute browser cache + edge stale-while-revalidate. The
          // upstream cache rotates every 6 hours so 5 min is plenty fresh.
          "Cache-Control":
            "public, max-age=300, s-maxage=300, stale-while-revalidate=900",
        },
      }
    );
  } catch (e) {
    console.error("[recs/featured] failed:", (e as Error).message);
    return NextResponse.json({ listings: [] }, { status: 200 });
  }
}
