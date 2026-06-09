import type { Metadata } from "next";
import { pageContent, schemaBlocks } from "./content";
import { NoFeesHeader } from "@/components/no-fees/no-fees-header";
import { NoFeesHeroSection } from "@/components/no-fees/no-fees-hero-section";
import "../no-fees/no-fees.css";
import "../leadville/page.css";

export const metadata: Metadata = {
  title:
    "Avon Colorado Vacation Rentals | Beaver Creek Gondola & Vail Valley | Traverse Hospitality",
  description:
    "Locally managed vacation rentals in Avon, Colorado — at the base of Beaver Creek Resort with the Riverfront Express gondola in town. Ten minutes east of Vail, ~2 hours from Denver. Condos, townhouses, and family homes near Nottingham Park.",
  alternates: { canonical: "https://www.booktraverse.com/avon" },
};

export default function AvonPage() {
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
        bgImage="/property-management/markets/avon.jpg"
        eyebrow="Eagle County · Gateway to Beaver Creek"
        title="Avon,"
        titleEm="Colorado."
        lede="At the base of Beaver Creek Resort and minutes from Vail — Avon is the quieter side of the Vail Valley. Locally managed townhouses and condos near the gondola, golf, and Nottingham Lake. Book direct and save up to 15%."
        lockedDestination={{ city: "Avon", label: "Avon, CO" }}
        directionsHref="#overview"
        directionsLabel="Explore Avon"
      />
      <div
        className="traverse-page"
        dangerouslySetInnerHTML={{ __html: pageContent }}
      />
    </div>
  );
}
