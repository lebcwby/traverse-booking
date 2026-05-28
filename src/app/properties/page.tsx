export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { Suspense } from "react";
import {
  getAllListingPrices,
  getListingPricingCache,
  type Listing,
} from "@/lib/supabase";
import {
  searchListings,
  type SearchListingsParams,
} from "@/lib/guesty-beapi";
import { rankListings, type SearchMode } from "@/lib/ranking";
import {
  mapBeapiToListing,
  type BeapiListingResult,
} from "@/lib/listing-utils";
import { enrichListingsWithReviewAverages } from "@/lib/reviews";
import { PropertiesLayout } from "@/components/properties/properties-layout";
import { TrackPropertiesList } from "@/components/properties/track-properties-list";
import { FloatingSearchBar } from "@/components/home/floating-search-bar";
import { FiltersDialog } from "@/components/properties/filters-dialog";

interface Props {
  searchParams: Promise<{
    q?: string;
    tag?: string;
    city?: string;
    filterTag?: string | string[];
    checkIn?: string;
    checkOut?: string;
    guests?: string;
    bedrooms?: string;
    beds?: string;
    bathrooms?: string;
    minPrice?: string;
    maxPrice?: string;
    pets?: string;
    /** Legacy alias for `pets` — old links from the header / external sources
     * use `petsAllowed=true`. Treat both as equivalent. */
    petsAllowed?: string;
    propertyType?: string;
    amenities?: string;
    /** Legacy alias for `amenities` — same reason. */
    includeAmenities?: string;
    /** Minimum guest rating filter on a 5-star scale (e.g. "4.5"). Added
     *  2026-05-20. Server-side filtered against `listing.reviewAvg` (0-10
     *  scale internally, so we multiply the filter value by 2). */
    minRating?: string;
  }>;
}

export const metadata: Metadata = {
  title: "Colorado Vacation Rentals — Browse & Book Direct | Traverse Hospitality",
  description:
    "Browse 180+ vacation rentals across Colorado. Filter by dates, guests, neighborhood, and amenities. No booking fees — book direct with Traverse Hospitality and save.",
  alternates: { canonical: "/properties" },
  other: {
    keywords:
      "colorado vacation rentals, crested butte vacation rentals, leadville vacation rentals, vail vacation rentals, book direct colorado",
  },
};

// Static JSON-LD for the properties browse page
const propertiesJsonLd = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "Colorado Vacation Rentals",
  description:
    "Browse and book 190+ vacation rentals across Colorado. From slope-side condos in Crested Butte to cabins in Leadville and homes near Vail.",
  url: "https://www.booktraverse.com/properties",
  provider: { "@id": "https://www.booktraverse.com/#organization" },
});

const propertiesBreadcrumbLd = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: "Traverse Hospitality",
      item: "https://www.booktraverse.com",
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "Properties",
      item: "https://www.booktraverse.com/properties",
    },
  ],
});

// BEAPI paginated search — drains the cursor up to 500 results.
async function paginatedBeapiSearch(
  opts: SearchListingsParams
): Promise<BeapiListingResult[]> {
  const data = await searchListings({ ...opts, limit: 100 });
  let allResults = data.results || [];
  let cursor = data.pagination?.cursor?.next;
  while (cursor && allResults.length < 500) {
    const more = await searchListings({ ...opts, limit: 100, cursor });
    allResults = allResults.concat(more.results || []);
    cursor = more.pagination?.cursor?.next;
  }
  return allResults;
}

// Pet-friendly OR semantics — when ?pets=true, return the union of:
//   (a) listings with houseRules.petsAllowed.enabled === true (BEAPI's
//       petsAllowed=true server filter), AND
//   (b) listings tagged "pet friendly" (case where the host set the tag but
//       hasn't toggled the houseRules flag — common for legacy listings).
// Two parallel BEAPI queries, merged + deduped by _id.
async function searchListingsPetFriendlyOr(
  opts: SearchListingsParams
): Promise<BeapiListingResult[]> {
  if (!opts.petsAllowed) return paginatedBeapiSearch(opts);
  const baseTags = opts.tags || [];
  const [byFlag, byTag] = await Promise.all([
    paginatedBeapiSearch({ ...opts, petsAllowed: true }),
    paginatedBeapiSearch({
      ...opts,
      petsAllowed: undefined,
      tags: [...baseTags, "pet friendly"],
    }),
  ]);
  const seen = new Set<string>();
  const out: BeapiListingResult[] = [];
  for (const r of [...byFlag, ...byTag]) {
    const id = (r as { _id?: string })._id;
    if (id && !seen.has(id)) {
      seen.add(id);
      out.push(r);
    }
  }
  return out;
}

export default async function PropertiesPage({
  searchParams: searchParamsPromise,
}: Props) {
  const searchParams = await searchParamsPromise;
  const hasDateFilter = !!(searchParams.checkIn && searchParams.checkOut);

  // Merge location tag with filter tags
  const allTags: string[] = [];
  if (searchParams.tag) allTags.push(searchParams.tag);
  if (searchParams.filterTag) {
    const filterTags = Array.isArray(searchParams.filterTag)
      ? searchParams.filterTag
      : [searchParams.filterTag];
    allTags.push(...filterTags);
  }

  // Common BEAPI params
  const commonParams = {
    minOccupancy: searchParams.guests ? Number(searchParams.guests) : undefined,
    numberOfBedrooms: searchParams.bedrooms
      ? Number(searchParams.bedrooms)
      : undefined,
    numberOfBathrooms: searchParams.bathrooms
      ? Number(searchParams.bathrooms)
      : undefined,
    propertyType: searchParams.propertyType || undefined,
    petsAllowed:
      searchParams.pets === "true" || searchParams.petsAllowed === "true"
        ? true
        : undefined,
    includeAmenities:
      searchParams.amenities || searchParams.includeAmenities || undefined,
    tags: allTags.length > 0 ? allTags : undefined,
    city: searchParams.city || undefined,
    // BEAPI requires country whenever city is provided.
    country: searchParams.city ? "United States" : undefined,
  };

  let listings: Listing[];

  if (hasDateFilter) {
    // Use BEAPI for real-time availability when dates are selected
    try {
      let allResults = await searchListingsPetFriendlyOr({
        checkIn: searchParams.checkIn,
        checkOut: searchParams.checkOut,
        ...commonParams,
        minPrice: searchParams.minPrice
          ? Number(searchParams.minPrice)
          : undefined,
        maxPrice: searchParams.maxPrice
          ? Number(searchParams.maxPrice)
          : undefined,
      });
      // Filter out listings with no valid rate/pricing for these dates
      allResults = allResults.filter((r) => {
        // When dates provided, must have nightlyRates (valid rate plan for the dates)
        if (r.nightlyRates && typeof r.nightlyRates === "object") {
          const rates = Object.values(r.nightlyRates) as number[];
          if (rates.length > 0) return true;
        }
        return false;
      });

      listings = allResults.map(mapBeapiToListing);

      // Defensive post-filter on city. BEAPI's `city` param is permissive
      // — listings whose address.city doesn't strictly match what the
      // user picked have been observed slipping through (e.g. a "Leadville"
      // search returning Denver-tagged or CB-tagged listings whose
      // metadata differs from their actual market). Enforce a strict
      // case-insensitive equality match here.
      if (searchParams.city) {
        const wanted = searchParams.city.trim().toLowerCase();
        listings = listings.filter(
          (l) => (l.address?.city || "").trim().toLowerCase() === wanted
        );
      }

      // Filter by search query if provided
      if (searchParams.q) {
        const q = searchParams.q.toLowerCase();
        listings = listings.filter(
          (l) =>
            l.title?.toLowerCase().includes(q) ||
            l.nickname?.toLowerCase().includes(q) ||
            l.address?.city?.toLowerCase().includes(q)
        );
      }
    } catch (err) {
      console.error("BEAPI search failed:", err);
      listings = [];
    }
  } else {
    // No dates — still use BEAPI so we only show bookable listings
    try {
      let allResults = await searchListingsPetFriendlyOr({ ...commonParams });
      // Filter out listings with no base price (no valid rate plan)
      allResults = allResults.filter(
        (r) => !!(r.prices?.basePrice && r.prices.basePrice > 0)
      );

      listings = allResults.map(mapBeapiToListing);

      // Defensive post-filter on city (same rationale as the
      // date-filtered branch above).
      if (searchParams.city) {
        const wanted = searchParams.city.trim().toLowerCase();
        listings = listings.filter(
          (l) => (l.address?.city || "").trim().toLowerCase() === wanted
        );
      }

      // Filter by search query if provided
      if (searchParams.q) {
        const q = searchParams.q.toLowerCase();
        listings = listings.filter(
          (l) =>
            l.title?.toLowerCase().includes(q) ||
            l.nickname?.toLowerCase().includes(q) ||
            l.address?.city?.toLowerCase().includes(q)
        );
      }

      // Filter by price range (basePrice) for no-dates browsing
      const filterMin = searchParams.minPrice
        ? Number(searchParams.minPrice)
        : 0;
      const filterMax = searchParams.maxPrice
        ? Number(searchParams.maxPrice)
        : Infinity;
      if (filterMin > 0 || filterMax < Infinity) {
        listings = listings.filter((l) => {
          const price = l.prices?.basePrice || 0;
          return price >= filterMin && price <= filterMax;
        });
      }
    } catch (err) {
      console.error("BEAPI browse failed:", err);
      listings = [];
    }
  }

  // Enrich with computed review averages from individual ratings (genuine precision)
  await enrichListingsWithReviewAverages(listings);

  // Apply minimum-rating filter (added 2026-05-20). Filter values come in on
  // the 5-star scale (e.g. "4.5"); listing.reviewAvg is stored on the BEAPI
  // 0-10 scale, so we double the threshold before comparing. Listings without
  // a review average yet are excluded when a minRating is applied — they have
  // no signal to qualify.
  const minRatingParam = searchParams.minRating
    ? Number(searchParams.minRating)
    : 0;
  if (minRatingParam > 0 && Number.isFinite(minRatingParam)) {
    const minRating10 = minRatingParam * 2;
    listings = listings.filter((l) => {
      const avg = typeof l.reviewAvg === "number" ? l.reviewAvg : 0;
      return avg >= minRating10;
    });
  }

  // Rank listings with weighted composite scoring
  const mode: SearchMode = hasDateFilter
    ? searchParams.guests
      ? "dated_guests"
      : "dated"
    : searchParams.guests
      ? "guests"
      : "browse";

  listings = rankListings(listings, mode, {
    searchedGuests: searchParams.guests
      ? Number(searchParams.guests)
      : undefined,
  });

  // Merge cached pricing for non-dated browsing
  let showCachedPricing = false;
  if (!hasDateFilter) {
    const pricingCache = await getListingPricingCache();
    if (pricingCache.size > 0) {
      showCachedPricing = true;
      listings = listings.map((l) => {
        const cached = pricingCache.get(l.guesty_id);
        if (cached) {
          return {
            ...l,
            totalPrice: cached.estimatedTotal,
            nightCount: cached.nightCount,
            cachedCheckIn: cached.checkIn,
            cachedCheckOut: cached.checkOut,
          };
        }
        return l;
      });
    }
  }

  const allPrices = await getAllListingPrices();

  return (
    <div className="flex h-[calc(100vh-56px)] lg:h-[calc(100vh-64px)] relative overflow-hidden bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: propertiesJsonLd }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: propertiesBreadcrumbLd }}
      />
      <h1 className="sr-only">Colorado Vacation Rentals</h1>
      <p className="sr-only">
        Browse and book 190+ vacation rentals across Colorado. From cozy
        slope-side condos to mountain cabins across Crested Butte, Leadville, Vail, and more.
        Filter by dates, guests, bedrooms, pet-friendly, and more. No booking
        — book direct and save up to 15%.
      </p>
      <TrackPropertiesList listings={listings} />
      <Suspense>
        <FloatingSearchBar compact>
          <FiltersDialog prices={allPrices} />
        </FloatingSearchBar>
      </Suspense>

      <Suspense>
        <PropertiesLayout
          listings={listings}
          dateFiltered={hasDateFilter}
          checkIn={searchParams.checkIn}
          checkOut={searchParams.checkOut}
          showCachedPricing={showCachedPricing}
        />
      </Suspense>
    </div>
  );
}
