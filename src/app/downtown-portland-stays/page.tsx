export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { type Listing } from "@/lib/supabase";
import { searchListings } from "@/lib/guesty-beapi";
import { rankListings } from "@/lib/ranking";
import { mapBeapiToListing } from "@/lib/listing-utils";
import {
  PpcLandingPage,
  type PpcPageConfig,
} from "@/components/ppc/ppc-landing-page";

export const metadata: Metadata = {
  title: "Downtown Portland Accommodations — Walkable Neighborhoods",
  description:
    "Find accommodations near downtown Portland. Entire homes in NW 23rd, Pearl District, Hawthorne, and more. Full kitchens, no booking fees. Book direct.",
  robots: { index: false, follow: true },
  alternates: { canonical: "/downtown-portland-stays" },
  openGraph: {
    title: "Downtown Portland Accommodations — Walkable Neighborhoods",
    description:
      "Entire homes in Portland's most walkable neighborhoods. 10–20 min from downtown. No booking fees. Book direct and save 15.5% vs. Airbnb.",
    images: [
      { url: "/images/home/home-kearney-cover.jpg", width: 1200, height: 800 },
    ],
  },
};

// Geo bounding box: walkable inner Portland
const GEO = { minLat: 45.5, maxLat: 45.555, minLng: -122.72, maxLng: -122.63 };

async function fetchListings(): Promise<Listing[]> {
  try {
    const data = await searchListings({
      limit: 100,
      minLat: GEO.minLat,
      maxLat: GEO.maxLat,
      minLng: GEO.minLng,
      maxLng: GEO.maxLng,
    });
    let all = data.results || [];
    let cursor = data.pagination?.cursor?.next;
    while (cursor && all.length < 300) {
      const more = await searchListings({
        limit: 100,
        cursor,
        minLat: GEO.minLat,
        maxLat: GEO.maxLat,
        minLng: GEO.minLng,
        maxLng: GEO.maxLng,
      });
      all = all.concat(more.results || []);
      cursor = more.pagination?.cursor?.next;
    }
    return all
      .filter(
        (r: { prices?: { basePrice?: number } }) =>
          r.prices?.basePrice && r.prices.basePrice > 0
      )
      .map(mapBeapiToListing);
  } catch {
    return [];
  }
}

const EXCLUDED_IDS = new Set([
  "68389f8417becf00103dad64",
  "68389faf0ec1470039373db8",
  "68389f9faaccdd001022c4ff",
  "68389f88f99d5b0011c57bc5",
]);

export default async function DowntownPortlandStaysPage() {
  const listings = (await fetchListings()).filter(
    (l) => !EXCLUDED_IDS.has(l.guesty_id)
  );
  const ranked = rankListings(listings, "browse");

  const topRated = [...listings]
    .filter((l) => l.reviewTotal && l.reviewTotal >= 20)
    .sort((a, b) => (b.reviewAvg || 0) / 2 - (a.reviewAvg || 0) / 2)
    .slice(0, 8);

  const bestValue = [...listings]
    .filter(
      (l) =>
        l.prices?.basePrice &&
        l.prices.basePrice > 0 &&
        (l.reviewAvg || 0) / 2 >= 4.83
    )
    .sort((a, b) => (a.prices?.basePrice || 999) - (b.prices?.basePrice || 999))
    .slice(0, 8);

  const walkable = ranked.slice(0, 8);

  const config: PpcPageConfig = {
    slug: "downtown-portland-stays",
    h1: "Downtown Portland Accommodations",
    subtext:
      "Walkable neighborhoods 10–20 min from downtown. NW 23rd, Pearl District, Hawthorne, and more.",
    heroImage: "/images/home/portland-sunset-skyline.jpg",
    searchLocation: "Downtown Portland, Oregon",
    canonical: "/downtown-portland-stays",
    schemaName: "Downtown Portland Accommodations",
    schemaDescription:
      "Vacation homes near downtown Portland in walkable neighborhoods. NW 23rd, Pearl District, Hawthorne, and more.",
    trustSignals: [
      {
        icon: "star",
        title: "4.8 stars from 8,300+ reviews",
        description:
          "87% 5-star. Guests consistently rate us higher than Portland hotels.",
      },
      {
        icon: "sliders",
        title: "Where locals actually go",
        description:
          "Portland's best food, bars, and shops are on Hawthorne, Alberta, NW 23rd, and Mississippi — not in the hotel district.",
      },
      {
        icon: "calendar",
        title: "15.5% less than Airbnb",
        description:
          "Same homes, same dates. Book direct on BookTraverse.com and skip the Airbnb service fee.",
      },
    ],
    sections: [
      {
        title: "Guest Favorites Near Downtown",
        description:
          "The most loved homes in Portland's walkable inner neighborhoods.",
        listings: topRated,
        exploreHref: "/properties",
      },
      {
        title: "Best Value Near Downtown",
        description:
          "Highly rated homes at great prices — all within 20 minutes of downtown.",
        listings: bestValue,
        exploreHref: "/properties",
      },
      {
        title: "Walkable Portland Homes",
        description:
          "Step out your front door and you're already somewhere worth being.",
        listings: walkable,
        exploreHref: "/properties",
      },
    ],
    faqs: [
      {
        question: "How far are these properties from downtown Portland?",
        answer:
          "All properties on this page are within 10–20 minutes of downtown by car, transit, or bike. Many in the Pearl District, NW 23rd, and inner SE are within walking distance. Portland's MAX light rail and streetcar connect most neighborhoods directly to downtown.",
      },
      {
        question: "Why stay in a neighborhood instead of a downtown hotel?",
        answer:
          "Portland's best restaurants, bars, and shops aren't downtown — they're on Hawthorne, Alberta, NW 23rd, Mississippi, and Division. Our homes put you where locals actually spend time, at a fraction of downtown hotel prices.",
      },
      {
        question: "How does check-in work?",
        answer:
          "Each property uses a secure keypad or smart lock. You receive a unique access code the day before arrival. Check in anytime — no front desk wait.",
      },
      {
        question: "Why is the price lower than Airbnb?",
        answer:
          "These same homes are listed on Airbnb with a 15.5% service fee. Booking direct on BookTraverse.com removes that fee entirely. Same property, same dates — lower price.",
      },
    ],
  };

  return <PpcLandingPage config={config} />;
}
