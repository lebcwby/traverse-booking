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
  title: "Where to Stay in Portland, Oregon — 275+ Homes",
  description:
    "Find the best place to stay in Portland. 275+ vacation homes in walkable neighborhoods — Hawthorne, Alberta, NW 23rd, Pearl District. Full kitchens, no fees. Book direct.",
  robots: { index: false, follow: true },
  alternates: { canonical: "/where-to-stay-in-portland" },
  openGraph: {
    title: "Where to Stay in Portland, Oregon — 275+ Homes",
    description:
      "Walkable neighborhoods, full kitchens, no booking fees. 8,300+ reviews, 87% 5-star. Book direct and save 15.5% vs. Airbnb.",
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

export default async function WhereToStayPage() {
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

  const groupHomes = ranked.filter((l) => (l.bedrooms || 0) >= 3).slice(0, 8);

  const config: PpcPageConfig = {
    slug: "where-to-stay-in-portland",
    h1: "Where to Stay in Portland",
    subtext:
      "275+ homes in Hawthorne, Alberta, NW 23rd, Pearl District, and more. From $99/night, no booking fees.",
    heroImage: "/images/home/hero-ne26th.jpg",
    canonical: "/where-to-stay-in-portland",
    schemaName: "Where to Stay in Portland, Oregon",
    schemaDescription:
      "275+ vacation homes in Portland's best walkable neighborhoods. Book direct for the lowest price.",
    trustSignals: [
      {
        icon: "star",
        title: "4.8 stars from 8,300+ reviews",
        description:
          "87% 5-star. Find homes you'll love based on real guest experiences across all platforms.",
      },
      {
        icon: "sliders",
        title: "Real neighborhoods, not hotel districts",
        description:
          "Hawthorne, Alberta, NW 23rd, Mississippi, Pearl District — stay where the restaurants and shops are.",
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
        title: "Guest Favorites in Portland",
        description:
          "The most loved homes based on ratings, reviews, and reliability.",
        listings: topRated,
        exploreHref: "/properties",
      },
      {
        title: "Best Value Stays",
        description:
          "Highly rated homes at great prices — all with full kitchens and no fees.",
        listings: bestValue,
        exploreHref: "/properties",
      },
      {
        title: "Homes with More Space",
        description: "3+ bedrooms — one home beats three hotel rooms.",
        listings: groupHomes,
        exploreHref: "/properties?bedrooms=3",
      },
    ],
    faqs: [
      {
        question: "Where should I stay in Portland, Oregon?",
        answer:
          "The best neighborhoods for visitors are NW 23rd/Nob Hill (boutique shopping), Hawthorne/Division (food carts, vintage shops), Alberta (art galleries, diverse dining), Mississippi (breweries, live music), and the Pearl District (galleries, fine dining). All are walkable and 10–20 minutes from downtown.",
      },
      {
        question: "Is a vacation rental better than a Portland hotel?",
        answer:
          "For most visitors, yes. A Book Traverse home averages 1,200 sq ft with a full kitchen — vs. a 300 sq ft hotel room at $180–350/night. Our homes are in the neighborhoods where Portland's best restaurants and shops are, not in the downtown hotel district.",
      },
      {
        question: "How does check-in work?",
        answer:
          "Each property uses a secure keypad or smart lock. You receive a unique access code the day before arrival. Check in anytime — no front desk wait.",
      },
      {
        question: "Why book direct instead of Airbnb?",
        answer:
          "These same homes are listed on Airbnb with a 15.5% service fee. Booking direct on BookTraverse.com removes that fee entirely. Same property, same dates — lower price.",
      },
    ],
  };

  return <PpcLandingPage config={config} />;
}
