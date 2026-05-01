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
  title: "Best Places to Stay in Portland, Oregon — Top Rated",
  description:
    "Discover the best places to stay in Portland. 8,300+ reviews, 87% 5-star. Top-rated vacation homes with full kitchens and no booking fees. Book direct.",
  robots: { index: false, follow: true },
  alternates: { canonical: "/best-places-to-book-traverse" },
  openGraph: {
    title: "Best Places to Stay in Portland, Oregon — Top Rated",
    description:
      "8,300+ reviews, 87% 5-star. Portland's highest-rated vacation homes. Book direct and save 15.5% vs. Airbnb.",
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

const EXCLUDED_IDS = new Set([
  "68389f8417becf00103dad64",
  "68389faf0ec1470039373db8",
  "68389f9faaccdd001022c4ff",
  "68389f88f99d5b0011c57bc5",
]);

export default async function BestPlacesToStayPage() {
  const listings = (await fetchListings()).filter(
    (l) => !EXCLUDED_IDS.has(l.guesty_id)
  );
  const ranked = rankListings(listings, "browse");

  // Highest rated: strict review quality
  const highestRated = [...listings]
    .filter(
      (l) =>
        l.reviewTotal && l.reviewTotal >= 30 && (l.reviewAvg || 0) / 2 >= 4.8
    )
    .sort((a, b) => (b.reviewAvg || 0) / 2 - (a.reviewAvg || 0) / 2)
    .slice(0, 8);

  // Most reviewed: social proof
  const mostReviewed = [...listings]
    .filter((l) => l.reviewTotal && l.reviewTotal >= 40)
    .sort((a, b) => (b.reviewTotal || 0) - (a.reviewTotal || 0))
    .slice(0, 8);

  // Luxury collection
  const luxury = ranked
    .filter((l) => l.tags?.some((t) => t.toLowerCase().includes("luxury")))
    .slice(0, 8);

  // Fallback: if luxury is empty, use top-ranked 3BR+
  const thirdSection =
    luxury.length >= 4
      ? luxury
      : ranked.filter((l) => (l.bedrooms || 0) >= 3).slice(0, 8);

  const config: PpcPageConfig = {
    slug: "best-places-to-book-traverse",
    h1: "Best Places to Stay in Portland",
    subtext:
      "8,300+ guest reviews. 87% 5-star. Portland's highest-rated vacation homes.",
    heroImage: "/images/home/home-kearney-cover.jpg",
    canonical: "/best-places-to-book-traverse",
    schemaName: "Best Places to Stay in Portland, Oregon",
    schemaDescription:
      "Portland's highest-rated vacation homes. 8,300+ reviews, 87% 5-star. Book direct for the lowest price.",
    trustSignals: [
      {
        icon: "star",
        title: "4.8 average, 87% 5-star",
        description:
          "Our guest satisfaction consistently exceeds Portland hotel averages. 35% of guests come back for another stay.",
      },
      {
        icon: "sliders",
        title: "Every home is quality-checked",
        description:
          "Professional cleaning, hotel-quality linens, fully stocked kitchens, and responsive local support. Properties below our standards are removed.",
      },
      {
        icon: "calendar",
        title: "15.5% less than Airbnb",
        description:
          "Same homes, same dates. Book direct on BookTraverse.com and skip the Airbnb service fee entirely.",
      },
    ],
    sections: [
      {
        title: "Highest Rated in Portland",
        description: "4.8+ stars with 30+ reviews — the best of the best.",
        listings: highestRated,
        exploreHref: "/properties",
      },
      {
        title: "Most Reviewed Homes",
        description:
          "Proven favorites with the most guest reviews — you're in good company.",
        listings: mostReviewed,
        exploreHref: "/properties",
      },
      {
        title:
          luxury.length >= 4 ? "Luxury Collection" : "Homes with More Space",
        description:
          luxury.length >= 4
            ? "Designer interiors, premium amenities, and prime locations."
            : "3+ bedrooms — one home beats three hotel rooms.",
        listings: thirdSection,
        exploreHref:
          luxury.length >= 4 ? "/s/luxury" : "/properties?bedrooms=3",
      },
    ],
    faqs: [
      {
        question: "How are these properties rated so highly?",
        answer:
          "We maintain strict quality standards — professional cleaning, hotel-quality linens, fully stocked kitchens, and responsive local support. Properties that fall below our standards are removed. Our 4.8 average comes from 8,300+ verified guest reviews across all booking platforms.",
      },
      {
        question: "Are these the same properties listed on Airbnb?",
        answer:
          "Yes — many of our properties are also on Airbnb, VRBO, and Booking.com. When you book direct on BookTraverse.com, you get the same property at a lower price because Airbnb's 15.5% service fee disappears.",
      },
      {
        question: "How does Book Traverse compare to Portland hotels?",
        answer:
          "Our guest satisfaction (4.8 stars, 87% 5-star) consistently exceeds Portland hotel averages. Guests cite more space, full kitchens, neighborhood locations, and better value as the primary reasons they prefer us.",
      },
      {
        question: "How does check-in work?",
        answer:
          "Each property uses a secure keypad or smart lock. You receive a unique access code the day before arrival. Check in anytime — no front desk wait, no credit card hold.",
      },
    ],
  };

  return <PpcLandingPage config={config} />;
}
