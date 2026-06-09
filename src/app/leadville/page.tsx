import type { Metadata } from "next";
import { pageContent, schemaBlocks } from "./content";
import { NoFeesHeader } from "@/components/no-fees/no-fees-header";
import { NoFeesHeroSection } from "@/components/no-fees/no-fees-hero-section";
import "../no-fees/no-fees.css";
import "./page.css";

export const metadata: Metadata = {
  title: "Leadville Colorado Vacation Rentals | Cabins, Homes & Hot Tubs",
  description: "70+ locally managed vacation rentals in Leadville, Colorado — America's highest city. Cabins, historic homes, hot tub rentals near Ski Cooper, Vail & Copper Mountain.",
  alternates: { canonical: "https://www.booktraverse.com/leadville" },
};

export default function Page() {
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
        bgImage="/markets/leadville.jpg"
        eyebrow="Lake County · Elevation 10,152 ft · America's Highest City"
        title="Leadville,"
        titleEm="Colorado."
        lede="70+ locally managed vacation rentals across America's highest city — historic Victorian homes on Harrison Ave, mountain cabins, and hot-tub retreats. Twenty minutes from Ski Cooper, an hour from Copper, Vail, and Beaver Creek."
        lockedDestination={{
          city: "Leadville",
          label: "Leadville",
        }}
        directionsHref="#location"
      />
      <div
        className="traverse-page"
        dangerouslySetInnerHTML={{ __html: pageContent }}
      />
    </div>
  );
}
