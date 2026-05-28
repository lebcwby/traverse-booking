/**
 * Admin endpoint for triggering Guesty → reviews-table sync.
 *
 * Built 2026-05-19 alongside `src/lib/guesty-reviews-sync.ts`.
 *
 * USAGE (browser, while logged in as an admin email):
 *   /api/admin/reviews-sync?action=count
 *     → Returns current row count + per-listing distribution. Use to
 *       verify backfill progress.
 *
 *   /api/admin/reviews-sync?action=sync-one&listingId=<guesty_id>
 *     → Sync reviews for a single listing. Useful for smoke-testing.
 *
 *   /api/admin/reviews-sync?action=backfill-all&limit=<n>
 *     → Sync all listings (or first N). Initial backfill = `&limit=189`
 *       or omit `limit`. Takes ~2-5 minutes for 189 listings depending
 *       on review volume. Returns per-listing breakdown.
 *
 * Auth: Bearer CRON_SECRET OR Supabase session for admin emails
 *       (nadim@traversehospitality.com, ngtannous@gmail.com, alex@..., sabrina@...).
 */

import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  authorizeAdminRequest,
  unauthorizedAdminResponse,
} from "@/lib/admin-auth";
import {
  syncReviewsForListing,
  syncAllListingReviews,
} from "@/lib/guesty-reviews-sync";

// Fetches the cached OpenAPI token from Supabase. Used by the `inspect`
// action below to probe multiple Guesty endpoint shapes directly, since the
// `openapiFetch` wrapper is private in guesty-openapi.ts.
async function getOpenAPITokenForProbe(): Promise<string> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("guesty_tokens")
    .select("access_token")
    .eq("token_type", "openapi")
    .single();
  if (error || !data?.access_token) {
    throw new Error("OpenAPI token lookup failed");
  }
  return data.access_token;
}

export const dynamic = "force-dynamic";
// Vercel Pro allows up to 800s. Backfilling ~10 years of reviews across 366
// listings can take >5 min if any listings have hundreds of reviews. The
// route also supports `?skip=N&limit=N` to resume in batches if a single run
// can't finish.
export const maxDuration = 800;

export async function GET(request: Request) {
  if (!(await authorizeAdminRequest(request))) {
    return unauthorizedAdminResponse();
  }

  const url = new URL(request.url);
  const action = url.searchParams.get("action") || "count";

  // ─── COUNT — quick health check ─────────────────────────────────
  if (action === "count") {
    try {
      const pool = getPool();
      const { rows } = await pool.query(
        `SELECT
           COUNT(*)::int AS total_reviews,
           COUNT(DISTINCT listing_id)::int AS listings_with_reviews,
           COUNT(*) FILTER (WHERE public_review IS NOT NULL
                            AND LENGTH(public_review) > 0)::int AS with_text,
           ROUND(AVG(overall_rating)::numeric, 2)::float8 AS avg_rating,
           STRING_AGG(DISTINCT channel, ', ') AS channels,
           MIN(review_date) AS oldest,
           MAX(review_date) AS newest,
           MAX(last_synced_at) AS last_sync_epoch_ms
         FROM reviews`
      );
      return NextResponse.json({ action, ...rows[0] });
    } catch (err) {
      return NextResponse.json(
        { action, error: err instanceof Error ? err.message : String(err) },
        { status: 500 }
      );
    }
  }

  // ─── INSPECT — peek at Guesty's raw reviews response shape ──────
  // Fetches a small unfiltered sample + (optionally) a filtered sample so we
  // can verify the filter parameter actually works and dump the field names
  // we need to map into our `reviews` table. Useful when sync returns 0.
  if (action === "inspect") {
    try {
      const listingId =
        url.searchParams.get("listingId") || "5bfeee0b58f87a0048ed93f6";

      // Probe four candidate endpoints; Guesty's API has shifted shapes
      // across versions and the docs don't agree with reality on all paths.
      const tokenResp = await getOpenAPITokenForProbe();
      const probes: Record<string, { url: string; result: unknown }> = {};

      const candidates: Array<{ name: string; path: string }> = [
        // v1 flat-collection patterns
        {
          name: "v1_reviews_query_listingId",
          path: `/v1/reviews?listingId=${listingId}&limit=3`,
        },
        {
          name: "v1_reviews_query_listing",
          path: `/v1/reviews?listing=${listingId}&limit=3`,
        },
        {
          name: "v1_reviews_nested_listings",
          path: `/v1/reviews/listings/${listingId}?limit=3`,
        },
        // listing-nested
        {
          name: "v1_listings_id_reviews",
          path: `/v1/listings/${listingId}/reviews?limit=3`,
        },
        // unfiltered baseline
        { name: "v1_reviews_unfiltered", path: `/v1/reviews?limit=3` },
      ];

      for (const c of candidates) {
        try {
          const resp = await fetch(`https://open-api.guesty.com${c.path}`, {
            headers: { Authorization: `Bearer ${tokenResp}` },
          });
          const text = await resp.text();
          let body: unknown;
          try {
            body = JSON.parse(text);
          } catch {
            body = text.slice(0, 500);
          }
          probes[c.name] = {
            url: c.path,
            result: {
              status: resp.status,
              ok: resp.ok,
              body,
            },
          };
        } catch (err) {
          probes[c.name] = {
            url: c.path,
            result: { error: err instanceof Error ? err.message : String(err) },
          };
        }
      }

      return NextResponse.json({ action, listingId, probes });
    } catch (err) {
      return NextResponse.json(
        { action, error: err instanceof Error ? err.message : String(err) },
        { status: 500 }
      );
    }
  }

  // ─── SYNC-ONE — sync a single listing ───────────────────────────
  if (action === "sync-one") {
    const listingId = url.searchParams.get("listingId");
    if (!listingId) {
      return NextResponse.json(
        { error: "Missing ?listingId=<guesty_id>" },
        { status: 400 }
      );
    }
    try {
      const result = await syncReviewsForListing(listingId);
      return NextResponse.json({ action, ...result });
    } catch (err) {
      return NextResponse.json(
        { action, error: err instanceof Error ? err.message : String(err) },
        { status: 500 }
      );
    }
  }

  // ─── BACKFILL-ALL — iterate all listings (optional ?skip / ?limit) ─
  if (action === "backfill-all") {
    const limitParam = url.searchParams.get("limit");
    const skipParam = url.searchParams.get("skip");
    const limit = limitParam ? Number(limitParam) : undefined;
    const skip = skipParam ? Number(skipParam) : undefined;
    if (limitParam && (!Number.isFinite(limit) || limit! <= 0)) {
      return NextResponse.json(
        { error: "Invalid ?limit; must be a positive integer" },
        { status: 400 }
      );
    }
    if (skipParam && (!Number.isFinite(skip) || skip! < 0)) {
      return NextResponse.json(
        { error: "Invalid ?skip; must be a non-negative integer" },
        { status: 400 }
      );
    }
    try {
      const startedAt = Date.now();
      const result = await syncAllListingReviews({ limit, skip });
      return NextResponse.json({
        action,
        durationMs: Date.now() - startedAt,
        ...result,
      });
    } catch (err) {
      return NextResponse.json(
        { action, error: err instanceof Error ? err.message : String(err) },
        { status: 500 }
      );
    }
  }

  return NextResponse.json(
    {
      error: `Unknown action: ${action}`,
      validActions: ["count", "sync-one", "backfill-all"],
    },
    { status: 400 }
  );
}
