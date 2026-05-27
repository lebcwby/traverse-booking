import type { Metadata } from "next";
import { pageContent, schemaBlocks } from "./content";
import { NoFeesHeader } from "@/components/no-fees/no-fees-header";
import { NoFeesHeroSection } from "@/components/no-fees/no-fees-hero-section";
import "../../no-fees/no-fees.css";
import "./page.css";

export const metadata: Metadata = {
  title: "Lodge at Mountaineer Square | Luxury Ski-In Condos | Traverse Hospitality",
  description: "Lodge at Mountaineer Square — luxury condos steps from the lifts at CBMR. Pool, hot tub, sauna, A/C, heated parking. From $95/night.",
  alternates: { canonical: "https://www.booktraverse.com/crested-butte/lodge-at-mountaineer-square/" },
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
        bgImage="https://assets.guesty.com/image/upload/h_600/v1756701721/production/55935b4b5d6bcf0e0084abd6/t4zry2uqrxhw17mg2jhb.jpg"
        eyebrow="620 Gothic Road · Mt. Crested Butte, CO 81225"
        title="Lodge at Mountaineer Square."
        titleEm="Steps from the lifts."
        lede="Crested Butte's newest luxury condo building — adjacent to the Red Lady Express and Silver Queen lifts. Front desk and concierge, indoor/outdoor pool, sauna, air conditioning, and heated underground parking. Traverse-managed units from $95/night."
        lockedDestination={{
          tag: "The Lodge at Mountaineer Square",
          label: "Lodge at Mountaineer Square",
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
