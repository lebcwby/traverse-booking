import type { MetadataRoute } from "next";
import { getListings } from "@/lib/supabase";
import { getListingSlug } from "@/lib/utils";
import { getAllSlugs } from "@/lib/landing-pages";
import {
  landingPageHasCanonicalOverride,
  isRetiredLandingSlug,
} from "@/lib/landing-page-paths";
import {
  getAllNeighborhoodSlugs,
  getAllUseCaseSlugs,
  getAllEventSlugs,
} from "@/lib/seo-content";
import { shouldSkipCiSupabaseFetches } from "@/lib/build-environment";
import { BLOG_POSTS } from "./blog/posts";

const BASE = "https://www.booktraverse.com";

type ChangeFreq = NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>;

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

// Core, always-present pages (no Supabase dependency). Excludes the legal
// pages (/terms, /privacy, /cancellation, /accessibility) — those set
// robots:{index:false}, so advertising them in the sitemap sends a mixed
// signal. NOTE: URLs are canonical no-trailing-slash (the trailing-slash
// variant 308-redirects to these).
const CORE_PAGES: { path: string; changeFrequency: ChangeFreq; priority: number }[] =
  [
    { path: "", changeFrequency: "weekly", priority: 1 },
    { path: "/properties", changeFrequency: "daily", priority: 0.9 },
    { path: "/reviews", changeFrequency: "weekly", priority: 0.8 },
    { path: "/plan", changeFrequency: "weekly", priority: 0.8 },
    { path: "/property-management", changeFrequency: "monthly", priority: 0.8 },
    { path: "/contact", changeFrequency: "monthly", priority: 0.5 },
    { path: "/blog", changeFrequency: "weekly", priority: 0.7 },
  ];

// Statically-rendered, indexable content pages — market hubs, building pages,
// and guides. These are real app-router routes that were previously in NO
// sitemap segment, so Google could only discover them via internal links.
const CONTENT_PAGES: { path: string; changeFrequency: ChangeFreq; priority: number }[] =
  [
    // Market hubs
    { path: "/crested-butte", changeFrequency: "weekly", priority: 0.85 },
    { path: "/leadville", changeFrequency: "weekly", priority: 0.85 },
    { path: "/vail", changeFrequency: "weekly", priority: 0.8 },
    { path: "/avon", changeFrequency: "weekly", priority: 0.8 },
    { path: "/granby", changeFrequency: "weekly", priority: 0.8 },
    { path: "/twin-lakes", changeFrequency: "weekly", priority: 0.8 },
    // Buildings (Crested Butte base area)
    { path: "/crested-butte/grand-lodge", changeFrequency: "weekly", priority: 0.8 },
    { path: "/crested-butte/the-plaza", changeFrequency: "weekly", priority: 0.8 },
    {
      path: "/crested-butte/lodge-at-mountaineer-square",
      changeFrequency: "weekly",
      priority: 0.8,
    },
    // Guides
    {
      path: "/crested-butte/guides/where-to-stay",
      changeFrequency: "monthly",
      priority: 0.7,
    },
    { path: "/crested-butte/things-to-do", changeFrequency: "monthly", priority: 0.7 },
    {
      path: "/crested-butte/things-to-do/winter-activities",
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      path: "/crested-butte/things-to-do/summer-activities",
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      path: "/crested-butte/things-to-do/all-year-round-activities",
      changeFrequency: "monthly",
      priority: 0.6,
    },
    { path: "/leadville/things-to-do", changeFrequency: "monthly", priority: 0.7 },
    {
      path: "/leadville/things-to-do/winter-activities",
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      path: "/leadville/things-to-do/summer-activities",
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      path: "/leadville/things-to-do/all-year-round-activities",
      changeFrequency: "monthly",
      priority: 0.6,
    },
  ];

export default async function sitemap(props: {
  id: Promise<string>;
}): Promise<MetadataRoute.Sitemap> {
  const id = await props.id;

  if (id === "static") {
    return [...CORE_PAGES, ...CONTENT_PAGES].map((p) => ({
      url: `${BASE}${p.path}`,
      changeFrequency: p.changeFrequency,
      priority: p.priority,
    }));
  }

  if (id === "landing-pages") {
    return getAllSlugs()
      .filter(
        (slug) =>
          !landingPageHasCanonicalOverride(slug) && !isRetiredLandingSlug(slug)
      )
      .map((slug) => ({
        url: `${BASE}/s/${slug}`,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      }));
  }

  if (id === "guides") {
    // /guide root + legacy /guide/portland-* slugs are all redirect-only as of
    // 2026-05-27 (see next.config.ts). Emit nothing so they de-index.
    return [];
  }

  if (id === "neighborhoods") {
    if (shouldSkipCiSupabaseFetches()) return [];
    try {
      const slugs = await getAllNeighborhoodSlugs();
      return slugs.map((slug) => ({
        url: `${BASE}/neighborhoods/${slug}`,
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
        url: `${BASE}/stays/${slug}`,
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
        url: `${BASE}/events/${slug}`,
        changeFrequency: "monthly" as const,
        priority: 0.7,
      }));
    } catch {
      return [];
    }
  }

  if (id === "blog") {
    // Source from the live, statically-defined posts (`src/app/blog/posts.ts`)
    // — the canonical list rendered at /blog/[slug]. The previous version
    // queried an empty Supabase table and emitted /guide/{slug} URLs (which
    // 301-redirect to /plan), so all ~24 real posts were missing from the
    // sitemap entirely.
    return BLOG_POSTS.map((post) => ({
      url: `${BASE}/blog/${post.slug}`,
      lastModified: post.date ? new Date(post.date) : undefined,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    }));
  }

  // id === "properties"
  if (shouldSkipCiSupabaseFetches()) return [];

  try {
    const listings = await getListings({ limit: 1000 });
    return listings.map((listing) => ({
      url: `${BASE}/properties/${getListingSlug(listing.title || listing.nickname, listing.guesty_id)}`,
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
