import type { Metadata } from "next";
import { pageContent, schemaBlocks } from "./content";
import { NoFeesHeader } from "@/components/no-fees/no-fees-header";
import { NoFeesHeroSection } from "@/components/no-fees/no-fees-hero-section";
import { BookableUnitsGrid } from "@/components/no-fees/bookable-units-grid";
import { MobileCallBar } from "@/components/no-fees/mobile-call-bar";
import {
  fetchUnitsForTag,
  aggregateUnitRating,
  nextWeekend,
} from "@/lib/building-units";
import "../../no-fees/no-fees.css";
import "./page.css";

// Refresh hourly so the seeded "next weekend" dates + featured units stay
// current without forcing a fully dynamic render on every request.
export const revalidate = 3600;

const GRAND_LODGE_TAG = "The Grand Lodge Crested Butte";
// Crested Butte guest line (project convention for CB-area pages).
const CB_PHONE_TEL = "+19704382241";
const CB_PHONE_DISPLAY = "(970) 438-2241";

export const metadata: Metadata = {
  title: "The Grand Lodge Crested Butte | Slope-Side Condos",
  description: "The Grand Lodge Crested Butte — slope-side condo building. Indoor/outdoor pool, hot tub, steam room. 50+ Traverse-managed units, booked direct with no fees.",
  alternates: { canonical: "https://www.booktraverse.com/crested-butte/grand-lodge" },
};

export default async function Page() {
  const { checkIn, checkOut, label } = nextWeekend();
  const availabilityHref = `/properties?${new URLSearchParams({
    tag: GRAND_LODGE_TAG,
    checkIn,
    checkOut,
    guests: "2",
  }).toString()}`;

  // Fetch once: drives both the hero aggregate rating and the units grid.
  const units = await fetchUnitsForTag(GRAND_LODGE_TAG);
  const ratingSummary = aggregateUnitRating(units);

  return (
    <div data-no-fees-layout="hide-chrome">
      {schemaBlocks.map((schema: Record<string, unknown>, i: number) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
      <NoFeesHeader />
      <NoFeesHeroSection
        bgImage="https://assets.guesty.com/image/upload/v1733288825/production/55935b4b5d6bcf0e0084abd6/asquumcidfz8caddn1al.jpg"
        eyebrow="6 Emmons Loop · Mt. Crested Butte, CO 81225"
        title="The Grand Lodge"
        titleEm="Crested Butte."
        lede="A slope-side condominium building at the foot of Crested Butte Mountain Resort — 200 yards from the Silver Queen Gondola. Heated pool, hot tub, steam room, on-site breakfast & lunch, and 50+ Traverse-managed units — see live prices below."
        lockedDestination={{
          tag: GRAND_LODGE_TAG,
          label: "The Grand Lodge",
        }}
        directionsHref="#location"
        initialCheckIn={checkIn}
        initialCheckOut={checkOut}
        trustBadge="No booking fees · Best rate, direct · Save 10–15% vs. Airbnb"
        rating={
          ratingSummary
            ? {
                avg5: ratingSummary.avg5,
                total: ratingSummary.total,
                label: "across Grand Lodge units",
              }
            : undefined
        }
      />
      <BookableUnitsGrid
        heading="Available units at The Grand Lodge"
        subheading={`Pick your dates — see live prices and book direct, no booking fees. Starting with this weekend (${label}).`}
        availabilityHref={availabilityHref}
        ctaLabel={`See all units available ${label}`}
        units={units}
        limit={8}
        initialCheckIn={checkIn}
        initialCheckOut={checkOut}
        initialGuests={2}
      />
      <div
        className="traverse-page"
        dangerouslySetInnerHTML={{ __html: pageContent }}
      />
      <MobileCallBar
        phoneTel={CB_PHONE_TEL}
        phoneDisplay={CB_PHONE_DISPLAY}
        availabilityHref={availabilityHref}
        callSource="grand-lodge"
      />
    </div>
  );
}
