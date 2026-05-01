import type { Listing } from "./supabase";

export type SearchMode = "browse" | "dated" | "guests" | "dated_guests";

interface WeightProfile {
  review: number;
  capacity: number;
  price: number;
  freshness: number;
  conversion: number;
  diversity: number;
}

interface RankingConfig {
  weights: Record<SearchMode, WeightProfile>;
  bayesianC: number;
  capacityIdealMax: number;
  priceSweet: number;
}

const DEFAULT_CONFIG: RankingConfig = {
  weights: {
    browse: {
      review: 0.35,
      capacity: 0.0,
      price: 0.15,
      freshness: 0.2,
      conversion: 0.15,
      diversity: 0.15,
    },
    dated: {
      review: 0.25,
      capacity: 0.0,
      price: 0.3,
      freshness: 0.1,
      conversion: 0.25,
      diversity: 0.1,
    },
    guests: {
      review: 0.25,
      capacity: 0.35,
      price: 0.15,
      freshness: 0.1,
      conversion: 0.1,
      diversity: 0.05,
    },
    dated_guests: {
      review: 0.2,
      capacity: 0.3,
      price: 0.25,
      freshness: 0.05,
      conversion: 0.2,
      diversity: 0.0,
    },
  },
  bayesianC: 10,
  capacityIdealMax: 1.3,
  priceSweet: 0.35,
};

// --- Individual scoring functions ---

/** Bayesian average normalized to 0-1. Guesty reviews are 0-10 scale. */
export function scoreReview(
  reviewAvg: number | null | undefined,
  reviewTotal: number | null | undefined,
  portfolioMean: number,
  C: number
): number {
  const avg = reviewAvg ?? 0;
  const total = reviewTotal ?? 0;
  if (total === 0 && avg === 0) return 0;
  const bayesian = (C * portfolioMean + avg * total) / (C + total);
  return bayesian / 10; // normalize 0-10 → 0-1
}

/**
 * Capacity fit score. Returns 0-1.
 * - No guest search → 1.0
 * - Under capacity → 0
 * - 100-130% fit → 1.0
 * - 130-200% → 0.7
 * - 200%+ → 0.3
 * Bedroom bonus: ideal = ceil(guests/2), penalty if fewer bedrooms.
 */
export function scoreCapacity(
  accommodates: number | null | undefined,
  bedrooms: number | null | undefined,
  searchedGuests: number | undefined
): number {
  if (!searchedGuests) return 1.0;
  const cap = accommodates ?? 0;
  if (cap < searchedGuests) return 0;

  const ratio = cap / searchedGuests;
  let score: number;
  if (ratio <= 1.3) {
    score = 1.0;
  } else if (ratio <= 2.0) {
    score = 0.7;
  } else {
    score = 0.3;
  }

  // Bedroom-to-guest ratio bonus
  const idealBedrooms = Math.ceil(searchedGuests / 2);
  const actualBedrooms = bedrooms ?? 0;
  if (actualBedrooms > 0 && actualBedrooms < idealBedrooms) {
    score *= 0.85; // 15% penalty for fewer bedrooms than ideal
  }

  return score;
}

/**
 * Price score based on percentile within bedroom cohort.
 * Sweet spot at 35th percentile. Single-item cohorts get 0.8.
 */
export function scorePrice(
  price: number | null | undefined,
  bedroomCount: number | null | undefined,
  cohortPrices: Map<number, number[]>
): number {
  const p = price ?? 0;
  if (p <= 0) return 0.5;

  const key = bedroomCount ?? 0;
  const cohort = cohortPrices.get(key);
  if (!cohort || cohort.length <= 1) return 0.8;

  // Compute percentile
  const sorted = cohort; // already sorted in buildPriceCohorts
  const rank = sorted.filter((x) => x < p).length;
  const percentile = rank / (sorted.length - 1);

  // Sweet spot at 35th percentile
  return Math.max(0, 1.0 - Math.abs(percentile - 0.35));
}

/**
 * Freshness proxy: more reviews = more recently active.
 * 0 reviews → 0.5 (neutral), scales up with review count.
 */
export function scoreFreshness(reviewTotal: number | null | undefined): number {
  const total = reviewTotal ?? 0;
  if (total === 0) return 0.5;
  // Logarithmic scale, caps around 100 reviews
  return Math.min(1.0, 0.5 + Math.log10(total + 1) / 4);
}

/** Placeholder: returns 0.5 for all listings until conversion data is available. */
export function scoreConversion(): number {
  return 0.5;
}

// --- Helpers ---

function computePortfolioMean(listings: Listing[]): number {
  let sum = 0;
  let count = 0;
  for (const l of listings) {
    if (l.reviewAvg && l.reviewTotal && l.reviewTotal > 0) {
      sum += l.reviewAvg;
      count++;
    }
  }
  return count > 0 ? sum / count : 5.0; // default to mid-scale
}

function buildPriceCohorts(
  listings: Listing[],
  dated: boolean
): Map<number, number[]> {
  const cohorts = new Map<number, number[]>();
  for (const l of listings) {
    const price =
      dated && l.totalPrice && l.nightCount
        ? l.totalPrice / l.nightCount
        : (l.prices?.basePrice ?? 0);
    if (price <= 0) continue;
    const key = l.bedrooms ?? 0;
    const arr = cohorts.get(key) ?? [];
    arr.push(price);
    cohorts.set(key, arr);
  }
  // Sort each cohort
  cohorts.forEach((arr, key) => {
    cohorts.set(
      key,
      arr.sort((a, b) => a - b)
    );
  });
  return cohorts;
}

function getListingPrice(l: Listing, dated: boolean): number {
  if (dated && l.totalPrice && l.nightCount) {
    return l.totalPrice / l.nightCount;
  }
  return l.prices?.basePrice ?? 0;
}

/** Get a neighborhood key for diversity checks. Uses street prefix or zipcode. */
function getNeighborhood(l: Listing): string {
  if (l.address?.zipcode) return l.address.zipcode;
  if (l.address?.street) return l.address.street.slice(0, 10);
  return "unknown";
}

/**
 * Diversity reranking: scan top positions and break up runs of 3+ consecutive
 * listings with the same neighborhood or bedroom count.
 */
function applyDiversityReranking(listings: Listing[], topN: number): Listing[] {
  if (listings.length <= 3) return listings;

  const top = listings.slice(0, topN);
  const rest = listings.slice(topN);

  for (let i = 2; i < top.length; i++) {
    const prev1 = top[i - 1];
    const prev2 = top[i - 2];
    const curr = top[i];

    const sameNeighborhood =
      getNeighborhood(prev2) === getNeighborhood(prev1) &&
      getNeighborhood(prev1) === getNeighborhood(curr);
    const sameBedrooms =
      prev2.bedrooms === prev1.bedrooms && prev1.bedrooms === curr.bedrooms;

    if (sameNeighborhood || sameBedrooms) {
      // Find next item in top that differs
      let swapIdx = -1;
      for (let j = i + 1; j < top.length; j++) {
        const candidate = top[j];
        const diffNeighborhood =
          getNeighborhood(candidate) !== getNeighborhood(prev1);
        const diffBedrooms = candidate.bedrooms !== prev1.bedrooms;
        if (diffNeighborhood || diffBedrooms) {
          swapIdx = j;
          break;
        }
      }
      if (swapIdx !== -1) {
        [top[i], top[swapIdx]] = [top[swapIdx], top[i]];
      }
    }
  }

  return [...top, ...rest];
}

// --- Main entry point ---

export function rankListings(
  listings: Listing[],
  mode: SearchMode,
  options?: { searchedGuests?: number; debug?: boolean }
): Listing[] {
  if (listings.length === 0) return listings;

  const config = DEFAULT_CONFIG;
  const weights = config.weights[mode];
  const portfolioMean = computePortfolioMean(listings);
  const dated = mode === "dated" || mode === "dated_guests";
  const priceCohorts = buildPriceCohorts(listings, dated);

  const scored = listings.map((listing) => {
    const review = scoreReview(
      listing.reviewAvg,
      listing.reviewTotal,
      portfolioMean,
      config.bayesianC
    );
    const capacity = scoreCapacity(
      listing.accommodates,
      listing.bedrooms,
      options?.searchedGuests
    );
    const price = scorePrice(
      getListingPrice(listing, dated),
      listing.bedrooms,
      priceCohorts
    );
    const freshness = scoreFreshness(listing.reviewTotal);
    const conversion = scoreConversion();

    const finalScore =
      review * weights.review +
      capacity * weights.capacity +
      price * weights.price +
      freshness * weights.freshness +
      conversion * weights.conversion;

    if (options?.debug) {
      console.log(
        `[ranking] ${listing.nickname || listing.guesty_id}: ` +
          `review=${review.toFixed(3)} capacity=${capacity.toFixed(3)} price=${price.toFixed(3)} ` +
          `freshness=${freshness.toFixed(3)} conversion=${conversion.toFixed(3)} → ${finalScore.toFixed(4)}`
      );
    }

    return { listing, finalScore };
  });

  // Filter out zero-capacity matches when guests are specified
  const filtered = options?.searchedGuests
    ? scored.filter(
        (s) =>
          s.finalScore > 0 ||
          scoreCapacity(
            s.listing.accommodates,
            s.listing.bedrooms,
            options.searchedGuests
          ) > 0
      )
    : scored;

  // Sort descending by score
  filtered.sort((a, b) => b.finalScore - a.finalScore);

  let result = filtered.map((s) => s.listing);

  // Diversity reranking for modes that have diversity weight > 0
  if (weights.diversity > 0) {
    result = applyDiversityReranking(result, 15);
  }

  return result;
}
