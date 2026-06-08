import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { type Listing } from "@/lib/supabase";
import { fetchUnitsForTag } from "@/lib/building-units";
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
 * Units come from BEAPI via `fetchUnitsForTag` (live availability + pricing;
 * the Supabase `listings` mirror backs SEO/feed surfaces, not this live card),
 * cached at the fetch layer. Pass `units` to reuse a
 * fetch the page already did (e.g. for the hero rating). When `checkIn`/
 * `checkOut` are given, each card deep-links into the unit with those dates so
 * the detail page opens on a live quote instead of an empty picker.
 */
export async function FeaturedUnitsSection({
  tag,
  heading,
  subheading,
  availabilityHref,
  ctaLabel = "See all available units",
  limit = 4,
  units: providedUnits,
  checkIn,
  checkOut,
  guests,
}: {
  tag: string;
  heading: string;
  subheading?: string;
  availabilityHref: string;
  ctaLabel?: string;
  limit?: number;
  /** Pre-fetched units (skips the fetch). */
  units?: Listing[];
  /** Dates to carry into each unit-card link. */
  checkIn?: string;
  checkOut?: string;
  guests?: number;
}) {
  const all = providedUnits ?? (await fetchUnitsForTag(tag));
  const units = all.slice(0, limit);

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
            checkIn={checkIn}
            checkOut={checkOut}
            guests={guests}
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
