import type { Metadata } from "next";
import { ListingLinkList } from "@/components/seo/listing-link-list";
import { getMarketListings } from "@/lib/market-listings";
import { pageContent, schemaBlocks } from "./content";
import { NoFeesHeader } from "@/components/no-fees/no-fees-header";
import { NoFeesHeroSection } from "@/components/no-fees/no-fees-hero-section";
import "../no-fees/no-fees.css";
import "../leadville/page.css";

// Listings come from the nightly-synced mirror, so an hour-stale page is
// fine and this keeps the fetch off the per-request path.
export const revalidate = 3600;

export const metadata: Metadata = {
  title:
    "Vail Colorado Vacation Rentals | Slope-Side Condos & Back Bowls Access | Traverse Hospitality",
  description:
    "Locally managed vacation rentals in Vail, Colorado — at the base of North America's largest single ski resort (5,317 acres). Vail Village + Lionshead pedestrian villages, Back Bowls, Blue Sky Basin, Bravo! Vail summer music festival. ~2 hours from Denver via I-70.",
  alternates: { canonical: "https://www.booktraverse.com/vail" },
};

export default async function VailPage() {
  const listings = await getMarketListings("Vail");

  return (
    <div data-no-fees-layout={true}>
      {schemaBlocks.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
      <NoFeesHeader />
      <NoFeesHeroSection
        bgImage="/property-management/markets/vail.jpg"
        eyebrow="Eagle County · Elevation 8,150 ft"
        title="Vail,"
        titleEm="Colorado."
        lede="World-class skiing at Vail Mountain Resort, summer hiking through Gore Range trails, and a pedestrian village built around mountain alpine charm. Locally managed vacation rentals just steps from the lifts. Book direct and save up to 15%."
        lockedDestination={{ city: "Vail", label: "Vail, CO" }}
        directionsHref="#overview"
        directionsLabel="Explore Vail"
      />
      <div
        className="traverse-page"
        dangerouslySetInnerHTML={{ __html: pageContent }}
      />
      <ListingLinkList
        units={listings}
        heading="All vacation rentals in Vail"
        description="Every Traverse-managed home and condo in this market. Open any one for photos, amenities and live availability."
      />
    </div>
  );
}
