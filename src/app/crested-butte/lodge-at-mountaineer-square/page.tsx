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

const LODGE_TAG = "The Lodge at Mountaineer Square";
// Crested Butte guest line (project convention for CB-area pages).
const CB_PHONE_TEL = "+19704382241";
const CB_PHONE_DISPLAY = "(970) 438-2241";

export const metadata: Metadata = {
  title: "Lodge at Mountaineer Square | Luxury Ski-In Condos",
  description: "Lodge at Mountaineer Square — luxury condos steps from the lifts at CBMR. Pool, hot tub, sauna, A/C, heated parking. Book direct, no fees.",
  alternates: { canonical: "https://www.booktraverse.com/crested-butte/lodge-at-mountaineer-square" },
};

export default async function Page() {
  const { checkIn, checkOut, label } = nextWeekend();
  const availabilityHref = `/properties?${new URLSearchParams({
    tag: LODGE_TAG,
    checkIn,
    checkOut,
    guests: "2",
  }).toString()}`;

  // Fetch once: drives both the hero aggregate rating and the units grid.
  const units = await fetchUnitsForTag(LODGE_TAG);
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
        bgImage="https://assets.guesty.com/image/upload/h_600/v1756701721/production/55935b4b5d6bcf0e0084abd6/t4zry2uqrxhw17mg2jhb.jpg"
        eyebrow="620 Gothic Road · Mt. Crested Butte, CO 81225"
        title="Lodge at Mountaineer Square."
        titleEm="Steps from the lifts."
        lede="Crested Butte's newest luxury condo building — adjacent to the Red Lady Express and Silver Queen lifts. Front desk and concierge, indoor/outdoor pool, sauna, air conditioning, and heated underground parking. Book direct — no booking fees."
        lockedDestination={{
          tag: LODGE_TAG,
          label: "Lodge at Mountaineer Square",
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
                label: "across Lodge units",
              }
            : undefined
        }
      />
      <BookableUnitsGrid
        heading="Available units at the Lodge at Mountaineer Square"
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
        callSource="lodge-at-mountaineer-square"
      />
    </div>
  );
}
