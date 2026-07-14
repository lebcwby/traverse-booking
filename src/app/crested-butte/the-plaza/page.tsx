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

const PLAZA_TAG = "The Plaza Crested Butte";
// Crested Butte guest line (project convention for CB-area pages).
const CB_PHONE_TEL = "+19704382241";
const CB_PHONE_DISPLAY = "(970) 438-2241";

export const metadata: Metadata = {
  title: "The Plaza Condominiums Crested Butte | Spacious Ski-In Condos",
  description: "The Plaza Condominiums — spacious 2 and 3-bedroom ski-in condos. Hot tubs, sauna, Iron Horse Tap, tennis & pickleball. Book direct, no fees.",
  alternates: { canonical: "https://www.booktraverse.com/crested-butte/the-plaza" },
};

export default async function Page() {
  const { checkIn, checkOut, label } = nextWeekend();
  const availabilityHref = `/properties?${new URLSearchParams({
    tag: PLAZA_TAG,
    checkIn,
    checkOut,
    guests: "2",
  }).toString()}`;

  // Fetch once: drives both the hero aggregate rating and the units grid.
  const units = await fetchUnitsForTag(PLAZA_TAG);
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
        bgImage="https://assets.guesty.com/image/upload/h_600/v1756514170/production/55935b4b5d6bcf0e0084abd6/cerpq3hoexjezuum0b4j.jpg"
        eyebrow="11 Snowmass Road · Mt. Crested Butte, CO 81225"
        title="The Plaza Condominiums."
        titleEm="Space to spread out."
        lede="Spacious 2 and 3-bedroom ski-in condos at the base of Crested Butte Mountain Resort — 100 yards from the Silver Queen lift. Full kitchens, fireplaces, hot tubs, Iron Horse Tap on-site, and the Traverse Hospitality office right at the entrance. Book direct — no booking fees."
        lockedDestination={{
          tag: PLAZA_TAG,
          label: "The Plaza",
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
                label: "across Plaza units",
              }
            : undefined
        }
      />
      <BookableUnitsGrid
        heading="Available units at The Plaza"
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
        callSource="the-plaza"
      />
    </div>
  );
}
