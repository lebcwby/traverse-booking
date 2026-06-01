import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import {
  getLandingPage,
  getAllSlugs,
  type LandingPageConfig,
} from "@/lib/landing-pages";
import {
  getLandingPagePath,
  landingPageHasCanonicalOverride,
} from "@/lib/landing-page-paths";
import { getListingSlug, getPhotoUrl } from "@/lib/utils";
import {
  getListingPricingCache,
  getListings,
  type Listing,
} from "@/lib/supabase";
import { shouldSkipCiBeapiFetches } from "@/lib/build-environment";
import { rankListings } from "@/lib/ranking";
import { enrichListingsWithReviewAverages } from "@/lib/reviews";
import { ServerPropertyCard } from "@/components/properties/server-property-card";
import { FloatingSearchBar } from "@/components/home/floating-search-bar";
import { BehaviorTracker } from "@/components/behavior-tracker";

const FALLBACK_HERO = "/markets/crested-butte.jpg";

export const revalidate = 300;

export function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const config = getLandingPage(slug);
  if (!config) return {};

  const canonical = `https://www.booktraverse.com${getLandingPagePath(config.slug)}`;
  const shouldNoIndex = landingPageHasCanonicalOverride(config.slug);

  return {
    title: config.title,
    description: config.metaDescription,
    robots: shouldNoIndex ? { index: false, follow: true } : undefined,
    openGraph: {
      title: config.title,
      description: config.metaDescription,
      url: `https://www.booktraverse.com/s/${config.slug}`,
      type: "website",
      images: [{ url: "/og-image-v2.png", width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: config.title,
      description: config.metaDescription,
      images: ["/og-image-v2.png"],
    },
    alternates: {
      canonical,
    },
  };
}

function normalizeAmenityValue(value: string): string {
  return value.toLowerCase().replace(/[_-]+/g, " ");
}

function hasMatchingAmenity(
  amenities: string[] | null | undefined,
  needle: string
): boolean {
  if (!amenities?.length) return false;
  const normalizedNeedle = normalizeAmenityValue(needle);
  return amenities.some((amenity) =>
    normalizeAmenityValue(amenity).includes(normalizedNeedle)
  );
}

async function fetchLandingPageListings(
  config: LandingPageConfig
): Promise<Listing[]> {
  if (shouldSkipCiBeapiFetches()) {
    return [];
  }

  try {
    let listings = await getListings({ limit: 1000 });
    listings = listings.filter(
      (listing) => (listing.prices?.basePrice ?? 0) > 0
    );

    if (config.filters.tags?.length) {
      listings = listings.filter((listing) =>
        config.filters.tags!.every((tag) =>
          listing.tags?.some(
            (listingTag) => listingTag.toLowerCase() === tag.toLowerCase()
          )
        )
      );
    }

    if (config.filters.petsAllowed) {
      listings = listings.filter(
        (listing) =>
          listing.tags?.some((tag) => tag.toLowerCase().includes("pet")) ||
          listing.amenities?.some((amenity) => /(pet|dog)/i.test(amenity))
      );
    }

    if (config.filters.amenities?.length) {
      listings = listings.filter((listing) =>
        config.filters.amenities!.every((amenity) =>
          hasMatchingAmenity(listing.amenities, amenity)
        )
      );
    }

    if (config.filters.minOccupancy != null) {
      listings = listings.filter(
        (listing) => (listing.accommodates ?? 0) >= config.filters.minOccupancy!
      );
    }

    if (
      config.filters.minLat != null ||
      config.filters.maxLat != null ||
      config.filters.minLng != null ||
      config.filters.maxLng != null
    ) {
      listings = listings.filter((listing) => {
        const lat = listing.address?.lat;
        const lng = listing.address?.lng;
        if (lat == null || lng == null) return false;
        if (config.filters.minLat != null && lat < config.filters.minLat)
          return false;
        if (config.filters.maxLat != null && lat > config.filters.maxLat)
          return false;
        if (config.filters.minLng != null && lng < config.filters.minLng)
          return false;
        if (config.filters.maxLng != null && lng > config.filters.maxLng)
          return false;
        return true;
      });
    }

    // Post-filter by amenityStrings if specified
    if (config.filters.amenityStrings?.length) {
      listings = listings.filter((listing) => {
        if (!listing.amenities) return false;
        return config.filters.amenityStrings!.every((needle) => {
          const lower = needle.toLowerCase();
          return listing.amenities!.some((a) =>
            a.toLowerCase().includes(lower)
          );
        });
      });
    }

    // Post-filter by bedroom count if specified
    if (
      config.filters.minBedrooms != null ||
      config.filters.maxBedrooms != null
    ) {
      listings = listings.filter((listing) => {
        const beds = listing.bedrooms ?? 0;
        if (
          config.filters.minBedrooms != null &&
          beds < config.filters.minBedrooms
        )
          return false;
        if (
          config.filters.maxBedrooms != null &&
          beds > config.filters.maxBedrooms
        )
          return false;
        return true;
      });
    }

    // Merge pricing cache
    const pricingCache = await getListingPricingCache();
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

    // Enrich with computed review averages
    await enrichListingsWithReviewAverages(listings);

    // Rank and limit
    listings = rankListings(listings, "browse");
    return listings.slice(0, 20);
  } catch (error) {
    console.error("Failed to fetch landing page listings:", error);
    return [];
  }
}

function buildViewAllHref(config: LandingPageConfig): string {
  const params = new URLSearchParams();

  if (config.filters.tags) {
    for (const tag of config.filters.tags) {
      params.append("filterTag", tag);
    }
  }
  if (config.filters.petsAllowed) {
    params.set("pets", "true");
  }
  if (config.filters.amenities) {
    params.set("amenities", config.filters.amenities.join(","));
  }
  if (config.filters.minOccupancy) {
    params.set("guests", String(config.filters.minOccupancy));
  }
  if (config.filters.minBedrooms != null) {
    params.set("bedrooms", String(config.filters.minBedrooms));
  }

  const qs = params.toString();
  return `/properties${qs ? `?${qs}` : ""}`;
}

function deriveShortName(title: string): string {
  return title
    .replace(/\s+in Portland$/i, "")
    .replace(/\s+in\s+Portland,?\s*Oregon$/i, "")
    .replace(/^Vacation Rentals\s+in\s+/i, "")
    .replace(/^Vacation Rentals\s+/i, "")
    .replace(/^Portland\s*/i, "")
    .replace(/\s+Vacation Rentals$/i, "")
    .replace(/\s+Rentals$/i, "")
    .replace(/^with\s+/i, "")
    .replace(/^near\s+/i, "")
    .replace(/,\s*Oregon$/i, "")
    .trim();
}

export default async function LandingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const config = getLandingPage(slug);
  if (!config) notFound();

  const listings = await fetchLandingPageListings(config);
  const viewAllHref = buildViewAllHref(config);

  // Resolve related page configs for cross-links
  const relatedPages = config.relatedSlugs
    .map((s) => getLandingPage(s))
    .filter((p): p is LandingPageConfig => !!p);

  // JSON-LD structured data — uses only our own config strings and listing data (safe, same pattern as layout.tsx)
  // Only include numberOfItems + itemListElement when listings are populated (avoids 0/empty during CI build)
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: config.title,
    description: config.metaDescription,
    url: `https://www.booktraverse.com/s/${config.slug}`,
    provider: { "@id": "https://www.booktraverse.com/#organization" },
    ...(listings.length > 0
      ? {
          numberOfItems: listings.length,
          mainEntity: {
            "@type": "ItemList",
            itemListElement: listings.slice(0, 20).map((listing, i) => ({
              "@type": "ListItem",
              position: i + 1,
              url: `https://www.booktraverse.com/properties/${getListingSlug(listing.title || listing.nickname, listing.guesty_id)}`,
              name: listing.title || listing.nickname,
              image: listing.picture
                ? getPhotoUrl(listing.picture, 800)
                : undefined,
            })),
          },
        }
      : {}),
  });

  const breadcrumbLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Book Traverse",
        item: "https://www.booktraverse.com",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: config.title,
        item: `https://www.booktraverse.com/s/${config.slug}`,
      },
    ],
  });

  const faqJsonLd =
    config.bottomContent.length > 0
      ? JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: config.bottomContent.map((faq) => ({
            "@type": "Question",
            name: faq.question,
            acceptedAnswer: {
              "@type": "Answer",
              text: faq.answer,
            },
          })),
        })
      : null;

  return (
    <>
      {/* JSON-LD structured data — content is from our own static config and listing data, not user input */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: breadcrumbLd }}
      />
      {faqJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: faqJsonLd }}
        />
      )}

      {/* Hero */}
      <section className="relative flex min-h-[360px] items-center justify-center px-4 py-12 sm:min-h-[420px] sm:py-16">
        <div
          className="absolute inset-0 bg-cover bg-[center_70%]"
          style={{
            backgroundImage: `url('${config.heroImage || FALLBACK_HERO}')`,
          }}
        />
        <div className="absolute inset-0 bg-primary/40" />
        <div className="relative z-10 mx-auto w-full max-w-3xl text-center">
          <h1 className="text-3xl font-bold text-[#3b82f6] drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)] sm:text-4xl lg:text-5xl">
            {config.title}
          </h1>
          <p className="mt-3 text-base text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] sm:text-lg">
            {config.tagline}
          </p>
          <p className="mt-2 text-sm font-medium text-accent drop-shadow-[0_1px_6px_rgba(0,0,0,0.45)]">
            No Booking Fees · Save 10–15% vs. Airbnb.
          </p>
        </div>
      </section>

      {/* Search Bar — pre-filled with tag so guests can add dates/guests */}
      <Suspense>
        <FloatingSearchBar compact initialTag={config.filters.tags?.[0]} />
      </Suspense>

      {/* Property Grid — first so properties shine */}
      {listings.length > 0 && (
        <section className="mx-auto max-w-[1600px] px-4 pt-6 pb-12 sm:px-6 lg:px-10">
          <h2 className="mb-6 text-2xl font-bold text-foreground">
            {listings.length}{" "}
            {listings.length === 1 ? "Property" : "Properties"}
          </h2>
          <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:gap-x-4 sm:gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {listings.map((listing, i) => (
              <ServerPropertyCard
                key={listing.guesty_id}
                listing={listing}
                photoWidth={800}
                priority={i < 4}
              />
            ))}
          </div>

          <div className="mt-10 flex justify-center">
            <Link
              href={viewAllHref}
              className="inline-flex items-center rounded-full border border-border bg-muted/50 px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
            >
              View all {listings.length}+ properties
            </Link>
          </div>
        </section>
      )}

      {/* Intro Content — below properties for SEO depth */}
      <section className="bg-secondary/30 py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <h2 className="mb-6 text-2xl font-bold text-foreground">
            About {deriveShortName(config.title)} Stays
          </h2>
          {config.introContent.map((paragraph, i) => (
            <p
              key={i}
              className="mb-6 text-lg leading-relaxed text-muted-foreground last:mb-0"
            >
              {paragraph}
            </p>
          ))}
        </div>
      </section>

      {/* FAQ Section */}
      {config.bottomContent.length > 0 && (
        <section className="py-16">
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <h2 className="mb-8 text-2xl font-bold text-foreground">
              Frequently Asked Questions
            </h2>
            <div className="space-y-6">
              {config.bottomContent.map((faq, i) => (
                <div key={i}>
                  <h3 className="text-lg font-semibold text-foreground">
                    {faq.question}
                  </h3>
                  <p className="mt-2 leading-relaxed text-muted-foreground">
                    {faq.answer}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Cross-links */}
      {relatedPages.length > 0 && (
        <section className="bg-secondary/30 py-12">
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <h2 className="mb-6 text-lg font-semibold text-foreground">
              You Might Also Like
            </h2>
            <div className="flex flex-wrap gap-3">
              {relatedPages.map((page) => (
                <Link
                  key={page.slug}
                  href={getLandingPagePath(page.slug)}
                  className="rounded-full border border-border bg-white px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                >
                  {deriveShortName(page.title)}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <BehaviorTracker
        eventType="landing_page_view"
        properties={{ slug, title: config.title }}
      />
    </>
  );
}
