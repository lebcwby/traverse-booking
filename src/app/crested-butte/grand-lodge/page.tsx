import type { Metadata } from "next";
import { pageContent, schemaBlocks } from "./content";
import { NoFeesHeader } from "@/components/no-fees/no-fees-header";
import { NoFeesHeroSection } from "@/components/no-fees/no-fees-hero-section";
import { FeaturedUnitsSection } from "@/components/no-fees/featured-units-section";
import { MobileCallBar } from "@/components/no-fees/mobile-call-bar";
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
  title: "The Grand Lodge Crested Butte | Slope-Side Condos | Traverse Hospitality",
  description: "The Grand Lodge Crested Butte — slope-side condo building. Indoor/outdoor pool, hot tub, steam room. 50+ Traverse-managed units from $95/night.",
  alternates: { canonical: "https://www.booktraverse.com/crested-butte/grand-lodge/" },
};

/**
 * Upcoming Friday → Sunday (2 nights). Used to seed the hero search and the
 * "see availability" CTA so high-intent visitors land on a date-filtered,
 * real-availability list instead of a blank search. Always a future weekend.
 */
function nextWeekend(): { checkIn: string; checkOut: string; label: string } {
  const now = new Date();
  let daysUntilFriday = (5 - now.getDay() + 7) % 7;
  if (daysUntilFriday === 0) daysUntilFriday = 7; // never "this" Friday — always next
  const fri = new Date(now);
  fri.setHours(0, 0, 0, 0);
  fri.setDate(now.getDate() + daysUntilFriday);
  const sun = new Date(fri);
  sun.setDate(fri.getDate() + 2);
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
  const label = `${fri.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })}–${sun.toLocaleDateString("en-US", { day: "numeric" })}`;
  return { checkIn: iso(fri), checkOut: iso(sun), label };
}

export default function Page() {
  const { checkIn, checkOut, label } = nextWeekend();
  const availabilityHref = `/properties?${new URLSearchParams({
    tag: GRAND_LODGE_TAG,
    checkIn,
    checkOut,
    guests: "2",
  }).toString()}`;

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
        lede="A slope-side condominium building at the foot of Crested Butte Mountain Resort — 200 yards from the Silver Queen Gondola. Heated pool, hot tub, steam room, on-site breakfast & lunch, and 50+ Traverse-managed units starting from $95/night."
        lockedDestination={{
          tag: GRAND_LODGE_TAG,
          label: "The Grand Lodge",
        }}
        directionsHref="#location"
        initialCheckIn={checkIn}
        initialCheckOut={checkOut}
        trustBadge="No booking fees · Best rate, direct · Save 10–15% vs. Airbnb"
      />
      <FeaturedUnitsSection
        tag={GRAND_LODGE_TAG}
        heading="Available units at The Grand Lodge"
        subheading={`Book direct & save — no booking fees. Showing availability for this weekend (${label}).`}
        availabilityHref={availabilityHref}
        ctaLabel={`See all units available ${label}`}
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
