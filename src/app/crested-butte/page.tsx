import type { Metadata } from "next";
import { ListingLinkList } from "@/components/seo/listing-link-list";
import { getMarketListings } from "@/lib/market-listings";
import { pageContent, schemaBlocks } from "./content";
import { NoFeesHeader } from "@/components/no-fees/no-fees-header";
import { NoFeesHeroSection } from "@/components/no-fees/no-fees-hero-section";
import "../no-fees/no-fees.css";
import "./page.css";

// Listings come from the nightly-synced mirror, so an hour-stale page is
// fine and this keeps the fetch off the per-request path.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Crested Butte Vacation Rentals & Lodging",
  description:
    "Slope-side condos and locally managed vacation rentals at Crested Butte Mountain Resort. Browse the Grand Lodge, Lodge at Mountaineer Square, and Plaza Condominiums.",
  alternates: { canonical: "https://www.booktraverse.com/crested-butte" },
};

export default async function Page() {
  const listings = await getMarketListings("Crested Butte");

  return (
    <div data-no-fees-layout={true}>
      {schemaBlocks.map((schema: Record<string, unknown>, i: number) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
      <NoFeesHeader />
      <NoFeesHeroSection
        bgImage="/markets/the-plaza.jpg"
        eyebrow="Gunnison County · Elevation 9,375 ft"
        title="Crested Butte,"
        titleEm="Colorado."
        lede="A historic mining town turned alpine retreat — steep terrain, summer wildflowers, and a downtown that hasn't lost its soul. Traverse manages slope-side condos and locally rooted vacation rentals at the base of the mountain."
        lockedDestination={{
          city: "Crested Butte",
          label: "Crested Butte, CO",
        }}
        directionsHref="#buildings"
        directionsLabel="Browse Buildings"
      />
      <div
        className="traverse-page"
        dangerouslySetInnerHTML={{ __html: pageContent }}
      />
      <ListingLinkList
        units={listings}
        heading="All vacation rentals in Crested Butte"
        description="Every Traverse-managed home and condo in this market. Open any one for photos, amenities and live availability."
      />
    </div>
  );
}
