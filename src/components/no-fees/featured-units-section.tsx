import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { type Listing } from "@/lib/supabase";
import { searchCardListingsCached } from "@/lib/guesty-beapi";
import { mapBeapiToListing, type BeapiListingResult } from "@/lib/listing-utils";
import { enrichListingsWithReviewAverages } from "@/lib/reviews";
import { ServerPropertyCard } from "@/components/properties/server-property-card";

/**
 * Server-rendered "available units" strip for building landing pages
 * (Grand Lodge, The Plaza, Lodge at Mountaineer Square, …).
 *
 * Why this exists: GA4 funnel analysis (2026-06-03) showed ~86% of visitors
 * who land on the Grand Lodge marketing page leave WITHOUT ever opening a
 * bookable unit — the single biggest conversion leak. This surfaces real
 * units + prices immediately and gives a one-click path into the
 * date-filtered availability list, so high-intent (esp. GBP) visitors don't
 * dead-end on an empty search.
 *
 * Fetches the top units for a Guesty tag from BEAPI (the live source — the
 * Supabase `listings` table is empty by design) and only renders when there's
 * at least one priced unit. The BEAPI call is cached at the fetch layer
 * (revalidate 300s); any failure makes this a silent no-op.
 */
export async function FeaturedUnitsSection({
  tag,
  heading,
  subheading,
  availabilityHref,
  ctaLabel = "See all available units",
  limit = 4,
}: {
  tag: string;
  heading: string;
  subheading?: string;
  availabilityHref: string;
  ctaLabel?: string;
  limit?: number;
}) {
  let units: Listing[] = [];
  try {
    const data = await searchCardListingsCached({ tags: [tag], limit: 40 }, 300);
    const results = (data.results || []) as BeapiListingResult[];
    units = results
      .filter((r) => !!(r.prices?.basePrice && r.prices.basePrice > 0))
      .map(mapBeapiToListing);
    await enrichListingsWithReviewAverages(units);
    // Best-reviewed first; undated base price already on each card.
    units.sort((a, b) => (b.reviewAvg ?? 0) - (a.reviewAvg ?? 0));
    units = units.slice(0, limit);
  } catch {
    units = [];
  }

  if (units.length === 0) return null;

  return (
    <section className="mx-auto max-w-[1280px] px-4 pt-10 pb-12 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground sm:text-3xl">
            {heading}
          </h2>
          {subheading && (
            <p className="mt-1 text-sm text-muted-foreground sm:text-base">
              {subheading}
            </p>
          )}
        </div>
        <Link
          href={availabilityHref}
          className="hidden items-center gap-1.5 text-sm font-semibold text-primary hover:underline sm:inline-flex"
        >
          {ctaLabel}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-4 sm:gap-y-8 lg:grid-cols-4">
        {units.map((listing, i) => (
          <ServerPropertyCard
            key={listing.guesty_id}
            listing={listing}
            photoWidth={800}
            priority={i < 4}
          />
        ))}
      </div>

      <div className="mt-8 flex justify-center">
        <Link
          href={availabilityHref}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          {ctaLabel}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
