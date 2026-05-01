import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import {
  getNeighborhoodPage,
  getAllNeighborhoodSlugs,
} from "@/lib/seo-content";
import {
  getListingPricingCache,
  getListingsForBrowseRender,
  type Listing,
} from "@/lib/supabase";
import { shouldSkipCiBeapiFetches } from "@/lib/build-environment";
import { rankListings } from "@/lib/ranking";
import { enrichListingsWithReviewAverages } from "@/lib/reviews";
import { ServerPropertyCard } from "@/components/properties/server-property-card";
import { FloatingSearchBar } from "@/components/home/floating-search-bar";
import { MarkdownContent } from "@/components/seo/markdown-content";
import { BehaviorTracker } from "@/components/behavior-tracker";
import { getPlansForNeighborhood } from "@/lib/plan/neighborhood-plan-links";

export const revalidate = 3600;

export async function generateStaticParams() {
  const slugs = await getAllNeighborhoodSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await getNeighborhoodPage(slug);
  if (!page) return {};

  return {
    title: page.meta_title,
    description: page.meta_description,
    openGraph: {
      title: page.meta_title,
      description: page.meta_description,
      url: `https://www.booktraverse.com/neighborhoods/${page.slug}`,
      type: "website",
      images: [{ url: "/og-image.png", width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: page.meta_title,
      description: page.meta_description,
    },
    alternates: {
      canonical: `/neighborhoods/${page.slug}`,
    },
  };
}

async function fetchListingsForNeighborhood(
  guestyTag: string
): Promise<Listing[]> {
  if (shouldSkipCiBeapiFetches()) return [];

  try {
    // Tag-filter at query time (was: pull all 298 active rows + filter in
    // JS, which dumped ~14MB per page and truncated the PostgREST response
    // during SSG). Uses the browse-render projection to skip ~42KB/row of
    // JSONB we never render.
    let listings = await getListingsForBrowseRender({
      tag: guestyTag,
      limit: 100,
    });
    listings = listings.filter(
      (listing) => (listing.prices?.basePrice ?? 0) > 0
    );
    if (listings.length === 0) return [];

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

    await enrichListingsWithReviewAverages(listings);
    return rankListings(listings, "browse").slice(0, 20);
  } catch (error) {
    console.error("Failed to fetch neighborhood listings:", error);
    return [];
  }
}

export default async function NeighborhoodPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = await getNeighborhoodPage(slug);
  if (!page) notFound();

  const listings = await fetchListingsForNeighborhood(page.guesty_tag);

  // JSON-LD: content is from our own AI-generated DB records, not user input — safe pattern matching existing /s/[slug]
  const schemaLd = page.schema_markup
    ? JSON.stringify(page.schema_markup)
    : null;

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
        name: "Neighborhoods",
        item: "https://www.booktraverse.com/neighborhoods",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: page.neighborhood_name,
        item: `https://www.booktraverse.com/neighborhoods/${page.slug}`,
      },
    ],
  });

  return (
    <>
      {/* JSON-LD — content sourced from our own DB (AI-generated, not user input) */}
      {schemaLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: schemaLd }}
        />
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: breadcrumbLd }}
      />

      {/* Hero */}
      <section className="relative flex min-h-[360px] items-center justify-center px-4 py-12 sm:min-h-[420px] sm:py-16">
        <div
          className="absolute inset-0 bg-cover bg-[center_70%]"
          style={{
            backgroundImage: "url('/images/portland-skyline-hero.jpg')",
          }}
        />
        <div className="absolute inset-0 bg-primary/40" />
        <div className="relative z-10 mx-auto w-full max-w-3xl text-center">
          <h1 className="text-3xl font-bold text-white sm:text-4xl lg:text-5xl">
            {page.headline}
          </h1>
          <p className="mt-2 text-sm font-medium text-accent">
            No Fees. Lowest Price Guaranteed.
          </p>
        </div>
      </section>

      {/* Search Bar */}
      <Suspense>
        <FloatingSearchBar compact initialTag={page.guesty_tag} />
      </Suspense>

      {/* Listings Grid */}
      {listings.length > 0 && (
        <section className="mx-auto max-w-[1600px] px-4 pt-6 pb-12 sm:px-6 lg:px-10">
          <h2 className="mb-6 text-2xl font-bold text-foreground">
            {listings.length}{" "}
            {listings.length === 1 ? "Property" : "Properties"} in{" "}
            {page.neighborhood_name}
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
              href={`/properties?filterTag=${encodeURIComponent(page.guesty_tag)}`}
              className="inline-flex items-center rounded-full border border-border bg-muted/50 px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
            >
              View all {page.neighborhood_name} properties
            </Link>
          </div>
        </section>
      )}

      {/* Intro Content */}
      <section className="bg-secondary/30 py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <MarkdownContent content={page.intro_content_markdown} />
        </div>
      </section>

      {/* Highlights */}
      {page.highlights && page.highlights.length > 0 && (
        <section className="py-16">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <h2 className="mb-8 text-center text-2xl font-bold text-foreground">
              Why Stay in {page.neighborhood_name}
            </h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {page.highlights.map((h, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-border bg-white p-6"
                >
                  <span className="text-2xl">{h.icon}</span>
                  <h3 className="mt-2 font-semibold text-foreground">
                    {h.label}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {h.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Main Content Sections */}
      <section className="bg-secondary/30 py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <MarkdownContent content={page.content_sections_markdown} />
        </div>
      </section>

      {/* Related trip plans */}
      {(() => {
        const plans = getPlansForNeighborhood(slug);
        if (plans.length === 0) return null;
        return (
          <section className="bg-white py-12">
            <div className="mx-auto max-w-5xl px-4 sm:px-6">
              <h2 className="mb-2 text-center text-2xl font-bold text-foreground">
                See a trip built around {page.neighborhood_name}
              </h2>
              <p className="mx-auto mb-6 max-w-2xl text-center text-sm text-muted-foreground">
                Day-by-day Portland itineraries that feature{" "}
                {page.neighborhood_name} — each with a map, real places, and
                matching vacation rentals.
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {plans.map((plan) => (
                  <Link
                    key={plan.slug}
                    href={`/plan/${plan.slug}`}
                    className="group rounded-xl border border-border bg-white p-4 transition hover:border-primary/40 hover:shadow-sm"
                  >
                    <h3 className="text-sm font-semibold text-foreground">
                      {plan.h1}
                    </h3>
                    <p className="mt-1.5 line-clamp-2 text-xs leading-snug text-muted-foreground">
                      {plan.subtitle}
                    </p>
                    <span className="mt-2 inline-block text-xs font-semibold text-primary">
                      Read itinerary →
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        );
      })()}

      {/* CTA */}
      <section className="py-16">
        <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
          <h2 className="mb-4 text-2xl font-bold text-foreground">
            Ready to Book Your {page.neighborhood_name} Stay?
          </h2>
          <p className="mb-6 text-muted-foreground">
            Browse our full collection of vacation rentals in{" "}
            {page.neighborhood_name}. Book direct and save on fees.
          </p>
          <Link
            href={`/properties?filterTag=${encodeURIComponent(page.guesty_tag)}`}
            className="inline-flex items-center rounded-full bg-primary px-8 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
          >
            Browse {page.neighborhood_name} Rentals
          </Link>
        </div>
      </section>

      <BehaviorTracker
        eventType="landing_page_view"
        properties={{ slug, title: page.headline, type: "neighborhood" }}
      />
    </>
  );
}
