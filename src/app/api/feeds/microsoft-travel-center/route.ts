import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getPool } from "@/lib/db";
import {
  buildListingXml,
  wrapFeed,
  type FeedListing,
  type FeedReview,
} from "@/lib/ms-travel-feed";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const LISTING_COLUMNS = [
  "guesty_id",
  "title",
  "nickname",
  "property_type",
  "room_type",
  "bedrooms",
  "bathrooms",
  "beds",
  "accommodates",
  "area_square_feet",
  "address",
  "prices",
  "active",
  "is_listed",
  "picture",
  "picture_count",
  "contact_phone",
  "amenities",
  "tags",
  "default_check_in_time",
  "default_check_out_time",
  "terms",
  // Removed phantom columns that don't exist on the table and were never
  // read here — selecting them 42703'd the whole feed: `computed_review_avg`,
  // `computed_review_count`, and `raw`. Verified vs information_schema 2026-06-07.
].join(",");

async function loadReviews(
  guestyIds: string[]
): Promise<Map<string, FeedReview[]>> {
  if (guestyIds.length === 0) return new Map();
  const pool = getPool();
  const { rows } = await pool.query<{
    listing_id: string;
    public_review: string;
    overall_rating: number;
    reviewed_at: string;
    first_name: string | null;
  }>(
    `
    WITH ranked AS (
      SELECT
        r.listing_id,
        r.public_review,
        r.overall_rating,
        r.reviewed_at,
        (res.guest->>'firstName') AS first_name,
        row_number() OVER (
          PARTITION BY r.listing_id
          ORDER BY r.reviewed_at DESC
        ) AS rn
      FROM reviews r
      LEFT JOIN reservations res ON res.guesty_id = r.reservation_id
      WHERE r.listing_id = ANY($1::text[])
        AND r.public_review IS NOT NULL
        AND length(r.public_review) > 40
        AND r.overall_rating >= 4
        AND (res.guest->>'firstName') IS NOT NULL
    )
    SELECT listing_id, public_review, overall_rating, reviewed_at, first_name
    FROM ranked
    WHERE rn <= 2
    ORDER BY listing_id, reviewed_at DESC
    `,
    [guestyIds]
  );

  const byListing = new Map<string, FeedReview[]>();
  for (const row of rows) {
    const arr = byListing.get(row.listing_id) ?? [];
    arr.push({
      listing_guesty_id: row.listing_id,
      author: row.first_name || "Guest",
      body: row.public_review,
      rating: Number(row.overall_rating),
      reviewed_at: String(row.reviewed_at),
    });
    byListing.set(row.listing_id, arr);
  }
  return byListing;
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("listings")
      .select(LISTING_COLUMNS)
      .eq("active", true)
      .eq("is_listed", true)
      .eq("beapi_enabled", true)
      .order("guesty_id", { ascending: true });

    if (error) throw error;
    const listings = (data || []) as unknown as FeedListing[];

    const reviewsByListing = await loadReviews(
      listings.map((l) => l.guesty_id)
    );

    const blocks: string[] = [];
    let skipped = 0;
    for (const l of listings) {
      const xml = buildListingXml(l, reviewsByListing.get(l.guesty_id) ?? []);
      if (xml) blocks.push(xml);
      else skipped += 1;
    }

    const body = wrapFeed(blocks.join("\n"));

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        "X-Feed-Listings-Included": String(blocks.length),
        "X-Feed-Listings-Skipped": String(skipped),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?>\n<error>${message}</error>`,
      {
        status: 500,
        headers: { "Content-Type": "application/xml; charset=utf-8" },
      }
    );
  }
}
