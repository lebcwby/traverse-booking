import type { Metadata } from "next";
import { pageContent, schemaBlocks } from "./content";
import { NoFeesHeader } from "@/components/no-fees/no-fees-header";
import { NoFeesHeroSection } from "@/components/no-fees/no-fees-hero-section";
import "../no-fees/no-fees.css";
import "../leadville/page.css";

export const metadata: Metadata = {
  title:
    "Granby Colorado Vacation Rentals | Rocky Mountain National Park & Winter Park | Traverse Hospitality",
  description:
    "Locally managed vacation rentals in Granby, Colorado — basecamp for the quieter west side of Rocky Mountain National Park, Winter Park Resort (25 min), Lake Granby, and Grand Lake. ~90 minutes from Denver via US-40 over Berthoud Pass.",
  alternates: { canonical: "https://www.booktraverse.com/granby/" },
};

export default function GranbyPage() {
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
        bgImage="/property-management/markets/granby.jpg"
        eyebrow="Grand County · Western Gateway to Rocky Mountain National Park"
        title="Granby,"
        titleEm="Colorado."
        lede="Riverfront cabins on the Fraser, three large lakes (Granby, Grand, Shadow Mountain), Granby Ranch ski area, and the western entrance to Rocky Mountain National Park. Locally managed pet-friendly retreats with hot tubs and fishing access. Book direct and save up to 15%."
        lockedDestination={{ city: "Granby", label: "Granby, CO" }}
        directionsHref="#overview"
        directionsLabel="Explore Granby"
      />
      <div
        className="traverse-page"
        dangerouslySetInnerHTML={{ __html: pageContent }}
      />
    </div>
  );
}
