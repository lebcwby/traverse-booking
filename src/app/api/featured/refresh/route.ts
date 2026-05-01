import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { searchListings, getListingCalendar } from "@/lib/guesty-beapi";
import type {
  BeapiListingPhoto,
  BeapiListingResult,
} from "@/lib/listing-utils";
import { clampReviewAvg } from "@/lib/utils";
import { format, addDays } from "date-fns";

export const maxDuration = 300;

const supabase = createClient(
  process.env.SHARED_SUPABASE_URL!,
  process.env.SHARED_SUPABASE_SERVICE_ROLE_KEY!
);

// --- Scoring weights (0-100 composite) ---
const W_REVIEW_QUALITY = 0.3;
const W_DEMAND = 0.3;
const W_REVIEW_VOLUME = 0.2;
const W_BOOKABILITY = 0.2;
const RARE_FIND_BONUS = 10;

// Minimum thresholds
const MIN_REVIEWS = 15;
const MIN_AVAILABLE_DAYS = 3;

// Diversity targets (minimum per category in final set)
const TARGET_SIZE = 40;
const MIN_APARTMENTS = 8;
const MIN_HOUSES = 8;

function normalizeReviewAvg(avg: number): number {
  // 9.0–10.0 → 0–100 (BEAPI uses 10-point scale; below 9.0 gets 0)
  return Math.max(0, Math.min(100, (avg - 9.0) * 100));
}

function normalizeReviewVolume(total: number): number {
  // Log-scaled: 15→0, ~50→50, ~150→80, 500+→100
  if (total <= MIN_REVIEWS) return 0;
  return Math.min(
    100,
    ((Math.log(total) - Math.log(MIN_REVIEWS)) /
      (Math.log(500) - Math.log(MIN_REVIEWS))) *
      100
  );
}

function normalizeOccupancy(pct: number): number {
  // 0-100% maps to 0-100 (linear — higher occupancy = more popular)
  return Math.min(100, Math.max(0, pct));
}

function normalizeBookability(availableDays: number): number {
  // 3–20+ days → 0–100 (diminishing returns past 20)
  if (availableDays < MIN_AVAILABLE_DAYS) return 0;
  return Math.min(100, ((availableDays - MIN_AVAILABLE_DAYS) / 17) * 100);
}

function computeScore(
  reviewAvg: number,
  reviewTotal: number,
  occupancyPct: number,
  availableDays: number,
  isRareFind: boolean
): number {
  const score =
    normalizeReviewAvg(reviewAvg) * W_REVIEW_QUALITY +
    normalizeOccupancy(occupancyPct) * W_DEMAND +
    normalizeReviewVolume(reviewTotal) * W_REVIEW_VOLUME +
    normalizeBookability(availableDays) * W_BOOKABILITY +
    (isRareFind ? RARE_FIND_BONUS : 0);
  return Math.round(score * 10) / 10;
}

type ScoredListing = BeapiListingResult & {
  availableDays: number;
  occupancyPct: number;
  isRareFind: boolean;
  score: number;
};

function applyDiversity(scored: ScoredListing[]): ScoredListing[] {
  const isHouse = (r: ScoredListing) =>
    r.propertyType === "House" || r.propertyType === "Townhouse";

  const apartments = scored.filter((r) => !isHouse(r));
  const houses = scored.filter((r) => isHouse(r));

  const result: ScoredListing[] = [];
  const used = new Set<string>();

  // Guarantee minimums for each type
  for (const apt of apartments.slice(0, MIN_APARTMENTS)) {
    result.push(apt);
    used.add(apt._id);
  }
  for (const house of houses.slice(0, MIN_HOUSES)) {
    result.push(house);
    used.add(house._id);
  }

  // Fill remaining slots from overall ranked list
  for (const r of scored) {
    if (result.length >= TARGET_SIZE) break;
    if (!used.has(r._id)) {
      result.push(r);
      used.add(r._id);
    }
  }

  // Re-sort final set by score so display order is best-first
  result.sort((a, b) => b.score - a.score);
  return result;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Fetch ALL BEAPI listings (paginate through everything)
    let allResults: BeapiListingResult[] = [];
    const data = await searchListings({ limit: 100 });
    allResults = (data.results || []) as BeapiListingResult[];
    let cursor = data.pagination?.cursor?.next;
    while (cursor && allResults.length < 1000) {
      const more = await searchListings({ limit: 100, cursor });
      allResults = allResults.concat(
        (more.results || []) as BeapiListingResult[]
      );
      cursor = more.pagination?.cursor?.next;
    }

    // 2. Exclude "Small" listings
    const nonSmall = allResults.filter((r) => {
      const nick = (r.nickname || "").toLowerCase();
      return !nick.includes("small");
    });

    // 3. Review gate: must have enough reviews with a decent rating
    const withReviews = nonSmall.filter(
      (r) => (r.reviews?.total ?? 0) >= MIN_REVIEWS && (r.reviews?.avg ?? 0) > 0
    );

    // 4. Pull occupancy_stats from Supabase for all candidates
    const guestyIds = withReviews.map((r) => r._id);
    const { data: occRows } = await supabase
      .from("listings")
      .select("guesty_id, occupancy_stats")
      .in("guesty_id", guestyIds);

    const occMap = new Map<
      string,
      { occupancy_pct: number; is_rare_find: boolean }
    >();
    for (const row of occRows || []) {
      if (row.occupancy_stats) {
        occMap.set(row.guesty_id, {
          occupancy_pct: row.occupancy_stats.occupancy_pct ?? 0,
          is_rare_find: row.occupancy_stats.is_rare_find ?? false,
        });
      }
    }

    // 5. Pre-score by review + demand to limit calendar fetches
    //    Only fetch calendars for the top ~80 candidates (saves BEAPI calls)
    const preSorted = withReviews
      .map((r) => {
        const occ = occMap.get(r._id);
        const preScore =
          normalizeReviewAvg(clampReviewAvg(r.reviews?.avg || 0) ?? 0) *
            (W_REVIEW_QUALITY + W_BOOKABILITY) +
          normalizeOccupancy(occ?.occupancy_pct ?? 0) * W_DEMAND +
          normalizeReviewVolume(r.reviews?.total ?? 0) * W_REVIEW_VOLUME +
          (occ?.is_rare_find ? RARE_FIND_BONUS : 0);
        return { listing: r, preScore, occ };
      })
      .sort((a, b) => b.preScore - a.preScore)
      .slice(0, 80);

    // 6. Fetch calendar vacancy for next 30 days (batched)
    const today = new Date();
    const fromDate = format(today, "yyyy-MM-dd");
    const toDate = format(addDays(today, 30), "yyyy-MM-dd");

    const BATCH_SIZE = 5;
    const BATCH_DELAY = 1500;
    const scored: ScoredListing[] = [];

    for (let i = 0; i < preSorted.length; i += BATCH_SIZE) {
      const batch = preSorted.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map(async ({ listing: r, occ }) => {
          let availableDays = 0;
          try {
            const calendar = await getListingCalendar(r._id, fromDate, toDate);
            availableDays = calendar.filter(
              (d: { status: string }) => d.status === "available"
            ).length;
          } catch {
            // If calendar fetch fails, assume 0 available days
          }

          const occupancyPct = occ?.occupancy_pct ?? 0;
          const isRareFind = occ?.is_rare_find ?? false;
          const reviewAvg = clampReviewAvg(r.reviews?.avg || 0) ?? 0;
          const reviewTotal = r.reviews?.total ?? 0;

          return {
            ...r,
            availableDays,
            occupancyPct,
            isRareFind,
            score: computeScore(
              reviewAvg,
              reviewTotal,
              occupancyPct,
              availableDays,
              isRareFind
            ),
          } as ScoredListing;
        })
      );

      // Only include listings with enough availability to actually book
      scored.push(
        ...results.filter((r) => r.availableDays >= MIN_AVAILABLE_DAYS)
      );

      if (i + BATCH_SIZE < preSorted.length) {
        await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY));
      }
    }

    // 7. Sort by score and apply diversity constraints
    scored.sort((a, b) => b.score - a.score);
    const final = applyDiversity(scored);

    // 8. Transform and cache
    const getPrimaryPicture = (
      picture: BeapiListingResult["picture"],
      pictures: BeapiListingResult["pictures"]
    ) => {
      if (typeof picture === "string") return picture;
      if (picture) return picture.original || picture.regular || null;
      const firstPicture = pictures?.[0];
      return typeof firstPicture === "string"
        ? firstPicture
        : firstPicture?.original || firstPicture?.regular || null;
    };

    const featured = final.map((r) => ({
      guesty_id: r._id,
      title: r.title || r.nickname || "",
      nickname: r.nickname || "",
      property_type: r.propertyType || null,
      bedrooms: r.bedrooms,
      bathrooms: r.bathrooms,
      beds: r.beds,
      accommodates: r.accommodates,
      picture: getPrimaryPicture(r.picture, r.pictures),
      pictures: r.pictures?.length
        ? r.pictures
            .slice(0, 8)
            .map((p: string | BeapiListingPhoto) =>
              typeof p === "string"
                ? p
                : p.original || p.large || p.regular || p.thumbnail || ""
            )
            .filter(Boolean)
        : null,
      address: r.address || null,
      prices: r.prices || null,
      review_avg: clampReviewAvg(r.reviews?.avg || 0) || 0,
      review_total: r.reviews?.total || 0,
      score: r.score,
      occupancy_pct: r.occupancyPct,
      is_rare_find: r.isRareFind,
    }));

    await supabase.from("kv_store").upsert(
      {
        key: "featured_listings",
        value: featured,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );

    return NextResponse.json({
      ok: true,
      count: featured.length,
      listings: featured.map(
        (f) =>
          `[${f.score}] ${f.review_avg}★ ${f.review_total}rv ${f.occupancy_pct}%occ ${f.is_rare_find ? "🔥" : ""} - ${f.title}`
      ),
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to refresh featured",
      },
      { status: 500 }
    );
  }
}
