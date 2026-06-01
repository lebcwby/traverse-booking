import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { LANDING_PAGES } from "@/lib/landing-pages";
import { isRetiredLandingSlug } from "@/lib/landing-page-paths";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();

  if (!q || q.length < 2) {
    return NextResponse.json({ cities: [], listings: [], landingPages: [] });
  }

  const lower = q.toLowerCase();

  // Match landing pages by title, slug, or tagline.
  // Skip retired Portland-era slugs — those URLs 301 to /properties via
  // next.config.ts, so surfacing them in autocomplete would dead-end the
  // user and leak Portland-named labels into the dropdown.
  const landingPages = LANDING_PAGES.filter(
    (p) =>
      !isRetiredLandingSlug(p.slug) &&
      (p.title.toLowerCase().includes(lower) ||
        p.slug.replace(/-/g, " ").includes(lower) ||
        p.tagline.toLowerCase().includes(lower))
  )
    .slice(0, 4)
    .map((p) => ({ title: p.title, slug: p.slug }));

  // Sanitize search input to prevent PostgREST filter injection
  const sanitized = q.replace(/[%,{}()."\\]/g, "");
  if (!sanitized || sanitized.length < 2) {
    return NextResponse.json({ cities: [], listings: [], landingPages });
  }

  const { data } = await getSupabaseAdmin()
    .from("listings")
    .select("title, nickname, address")
    .eq("active", true)
    .eq("is_listed", true)
    .or(
      `title.ilike.%${sanitized}%,nickname.ilike.%${sanitized}%,address->>city.ilike.%${sanitized}%`
    )
    .limit(50);

  // Collect matching cities
  const citySet = new Set<string>();
  for (const listing of data || []) {
    const city = listing.address?.city;
    if (city && city.toLowerCase().includes(lower)) {
      citySet.add(city);
    }
  }
  const cities = Array.from(citySet).slice(0, 3);

  // Collect matching listing names
  const seen = new Set<string>();
  const listings: string[] = [];
  for (const listing of data || []) {
    const name = listing.title || listing.nickname;
    if (name && !seen.has(name)) {
      const nameMatch = name.toLowerCase().includes(lower);
      if (nameMatch) {
        seen.add(name);
        listings.push(name);
      }
    }
  }

  return NextResponse.json({
    cities: cities.slice(0, 3),
    listings: listings.slice(0, 5),
    landingPages,
  });
}
