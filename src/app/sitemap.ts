import type { MetadataRoute } from "next";
import { getListings } from "@/lib/supabase";
import { getListingSlug } from "@/lib/utils";
import { getAllSlugs } from "@/lib/landing-pages";
import { landingPageHasCanonicalOverride } from "@/lib/landing-page-paths";
import { getAllGuideSlugs } from "@/lib/guide-content";
import {
  getAllNeighborhoodSlugs,
  getAllUseCaseSlugs,
  getAllEventSlugs,
  getAllBlogSlugs,
} from "@/lib/seo-content";
import { allRecommendSlugs } from "@/lib/plan/recommend-slug-map";
import { shouldSkipCiSupabaseFetches } from "@/lib/build-environment";

// Generate sitemap index with segments
export async function generateSitemaps() {
  return [
    { id: "static" },
    { id: "landing-pages" },
    { id: "guides" },
    { id: "neighborhoods" },
    { id: "stays" },
    { id: "events" },
    { id: "blog" },
    { id: "properties" },
  ];
}

const SITE_LAUNCH = new Date("2026-02-23");

export default async function sitemap(props: {
  id: Promise<string>;
}): Promise<MetadataRoute.Sitemap> {
  const id = await props.id;

  if (id === "static") {
    return [
      {
        url: "https://www.booktraverse.com",
        changeFrequency: "weekly",
        priority: 1,
      },
      {
        url: "https://www.booktraverse.com/properties",
        changeFrequency: "daily",
        priority: 0.9,
      },
      {
        url: "https://www.booktraverse.com/neighborhoods",
        changeFrequency: "monthly",
        priority: 0.8,
      },
      {
        url: "https://www.booktraverse.com/portland-neighborhoods",
        changeFrequency: "monthly",
        priority: 0.8,
      },
      {
        url: "https://www.booktraverse.com/reviews",
        changeFrequency: "weekly",
        priority: 0.8,
      },
      {
        url: "https://www.booktraverse.com/plan",
        changeFrequency: "weekly",
        priority: 0.8,
      },
      {
        url: "https://www.booktraverse.com/portland-recommendations",
        changeFrequency: "weekly",
        priority: 0.8,
      },
      ...allRecommendSlugs().map((entry) => ({
        url: `https://www.booktraverse.com/portland-recommendations/${entry.slug}`,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
      {
        url: "https://www.booktraverse.com/plan/portland-food-itinerary",
        changeFrequency: "weekly",
        priority: 0.8,
      },
      {
        url: "https://www.booktraverse.com/plan/portland-outdoors-itinerary",
        changeFrequency: "weekly",
        priority: 0.8,
      },
      {
        url: "https://www.booktraverse.com/plan/portland-neighborhoods-tour",
        changeFrequency: "weekly",
        priority: 0.8,
      },
      {
        url: "https://www.booktraverse.com/plan/portland-weekend-itinerary",
        changeFrequency: "weekly",
        priority: 0.8,
      },
      {
        url: "https://www.booktraverse.com/plan/portland-with-kids-itinerary",
        changeFrequency: "weekly",
        priority: 0.8,
      },
      {
        url: "https://www.booktraverse.com/portland-apartments-vs-hotels",
        changeFrequency: "monthly",
        priority: 0.7,
      },
      {
        url: "https://www.booktraverse.com/portland-homes-vs-hotels",
        changeFrequency: "monthly",
        priority: 0.7,
      },
      {
        url: "https://www.booktraverse.com/book-direct",
        changeFrequency: "monthly",
        priority: 0.7,
      },
      {
        url: "https://www.booktraverse.com/the-pomeroy",
        changeFrequency: "monthly",
        priority: 0.7,
      },
      {
        url: "https://www.booktraverse.com/contact",
        changeFrequency: "monthly",
        priority: 0.5,
      },
      {
        url: "https://www.booktraverse.com/terms",
        lastModified: SITE_LAUNCH,
        changeFrequency: "yearly",
        priority: 0.3,
      },
      {
        url: "https://www.booktraverse.com/privacy",
        lastModified: SITE_LAUNCH,
        changeFrequency: "yearly",
        priority: 0.3,
      },
      {
        url: "https://www.booktraverse.com/cancellation",
        lastModified: SITE_LAUNCH,
        changeFrequency: "yearly",
        priority: 0.3,
      },
      {
        url: "https://www.booktraverse.com/accessibility",
        lastModified: SITE_LAUNCH,
        changeFrequency: "yearly",
        priority: 0.3,
      },
    ];
  }

  if (id === "landing-pages") {
    return getAllSlugs()
      .filter((slug) => !landingPageHasCanonicalOverride(slug))
      .map((slug) => ({
        url: `https://www.booktraverse.com/s/${slug}`,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      }));
  }

  if (id === "guides") {
    return [
      {
        url: "https://www.booktraverse.com/guide",
        changeFrequency: "weekly" as const,
        priority: 0.8,
      },
      ...getAllGuideSlugs().map((slug) => ({
        url: `https://www.booktraverse.com/guide/${slug}`,
        changeFrequency: "monthly" as const,
        priority: 0.7,
      })),
    ];
  }

  if (id === "neighborhoods") {
    if (shouldSkipCiSupabaseFetches()) return [];
    try {
      const slugs = await getAllNeighborhoodSlugs();
      return slugs.map((slug) => ({
        url: `https://www.booktraverse.com/neighborhoods/${slug}`,
        changeFrequency: "monthly" as const,
        priority: 0.7,
      }));
    } catch {
      return [];
    }
  }

  if (id === "stays") {
    if (shouldSkipCiSupabaseFetches()) return [];
    try {
      const slugs = await getAllUseCaseSlugs();
      return slugs.map((slug) => ({
        url: `https://www.booktraverse.com/stays/${slug}`,
        changeFrequency: "monthly" as const,
        priority: 0.7,
      }));
    } catch {
      return [];
    }
  }

  if (id === "events") {
    if (shouldSkipCiSupabaseFetches()) return [];
    try {
      const slugs = await getAllEventSlugs();
      return slugs.map((slug) => ({
        url: `https://www.booktraverse.com/events/${slug}`,
        changeFrequency: "monthly" as const,
        priority: 0.7,
      }));
    } catch {
      return [];
    }
  }

  if (id === "blog") {
    if (shouldSkipCiSupabaseFetches()) return [];
    try {
      const slugs = await getAllBlogSlugs();
      return slugs.map((slug) => ({
        url: `https://www.booktraverse.com/guide/${slug}`,
        changeFrequency: "monthly" as const,
        priority: 0.7,
      }));
    } catch {
      return [];
    }
  }

  // id === "properties"
  if (shouldSkipCiSupabaseFetches()) return [];

  try {
    const listings = await getListings({ limit: 1000 });
    return listings.map((listing) => ({
      url: `https://www.booktraverse.com/properties/${getListingSlug(listing.title || listing.nickname, listing.guesty_id)}`,
      lastModified: listing.guesty_updated_at
        ? new Date(listing.guesty_updated_at)
        : undefined,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));
  } catch (error) {
    console.warn("Failed to load property URLs for sitemap:", error);
    return [];
  }
}
