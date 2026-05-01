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
  title: "Places to Stay in Portland, Oregon — 275+ Homes",
  description:
    "Find the best places to stay in Portland. 275+ vacation homes with full kitchens and no booking fees. More space than a hotel at a better price. Book direct.",
  robots: { index: false, follow: true },
  alternates: { canonical: "/portland-accommodations" },
  openGraph: {
    title: "Places to Stay in Portland, Oregon — 275+ Homes",
    description:
      "Full kitchens, walkable neighborhoods, no booking fees. 8,300+ reviews, 87% 5-star. Book direct and save 15.5% vs. Airbnb.",
    images: [
      { url: "/images/home/home-kearney-cover.jpg", width: 1200, height: 800 },
    ],
  },
};

async function fetchListings(): Promise<Listing[]> {
  try {
    const data = await searchListings({ limit: 100 });
    let all = data.results || [];
    let cursor = data.pagination?.cursor?.next;
    while (cursor && all.length < 300) {
      const more = await searchListings({ limit: 100, cursor });
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

// Listings to exclude from PPC carousels (e.g., not guest-ready, low quality)
const EXCLUDED_IDS = new Set([
  "68389f8417becf00103dad64", // NE 46TH EP
  "68389faf0ec1470039373db8", // NE 46TH STUDIO (2)
  "68389f9faaccdd001022c4ff", // NE 46TH UP (3026)
  "68389f88f99d5b0011c57bc5", // NE 46TH STUDIO (1)
]);

export default async function PortlandAccommodationsPage() {
  const listings = (await fetchListings()).filter(
    (l) => !EXCLUDED_IDS.has(l.guesty_id)
  );
  const ranked = rankListings(listings, "browse");

  // Top rated: highest review average with decent volume
  const topRated = [...listings]
    .filter((l) => l.reviewTotal && l.reviewTotal >= 20)
    .sort((a, b) => (b.reviewAvg || 0) / 2 - (a.reviewAvg || 0) / 2)
    .slice(0, 8);

  // Best value: lowest price with good reviews
  const bestValue = [...listings]
    .filter(
      (l) =>
        l.prices?.basePrice &&
        l.prices.basePrice > 0 &&
        (l.reviewAvg || 0) / 2 >= 4.83
    )
    .sort((a, b) => (a.prices?.basePrice || 999) - (b.prices?.basePrice || 999))
    .slice(0, 8);

  // Homes for groups: 3+ bedrooms, ranked
  const groupHomes = ranked.filter((l) => (l.bedrooms || 0) >= 3).slice(0, 8);

  const config: PpcPageConfig = {
    slug: "portland-accommodations",
    h1: "Places to Stay in Portland",
    subtext:
      "Entire homes in Portland's best neighborhoods. Full kitchens, no booking fees, and 15.5% less than Airbnb.",
    heroImage: "/images/home/hero-se41st.jpg",
    canonical: "/portland-accommodations",
    schemaName: "Places to Stay in Portland, Oregon",
    schemaDescription:
      "Browse 275+ vacation homes across Portland, Oregon. Full kitchens, walkable neighborhoods. Book direct for the lowest price.",
    sections: [
      {
        title: "Top Rated in Portland",
        description:
          "The most loved homes based on ratings, reviews, and reliability.",
        listings: topRated,
        exploreHref: "/properties",
      },
      {
        title: "Best Value Stays",
        description:
          "Highly rated homes at the best prices — all with full kitchens and no fees.",
        listings: bestValue,
        exploreHref: "/properties",
      },
      {
        title: "Homes for Groups",
        description:
          "3+ bedrooms with space for everyone. One home beats three hotel rooms.",
        listings: groupHomes,
        exploreHref: "/properties?bedrooms=3",
      },
    ],
    faqs: [
      {
        question: "What is Book Traverse and how does it work?",
        answer:
          "Book Traverse manages 275+ vacation homes across Portland, Oregon. Browse properties, select your dates, and book directly on our site. You get an entire home — kitchen, living room, washer/dryer — with keypad check-in and 24/7 local support. No booking fees.",
      },
      {
        question: "Why is the price lower than Airbnb?",
        answer:
          "These same homes are listed on Airbnb with a 15.5% service fee. When you book direct on BookTraverse.com, that fee disappears. Same property, same dates, lower price.",
      },
      {
        question: "How does check-in work without a front desk?",
        answer:
          "Each property uses a secure keypad or smart lock. You receive a unique access code and step-by-step instructions the day before arrival. Check in anytime.",
      },
      {
        question: "What if I need help during my stay?",
        answer:
          "Our guest services team is Portland-based and available 24/7 by phone, text, and email. We live here — not a remote call center.",
      },
    ],
  };

  return <PpcLandingPage config={config} />;
}
