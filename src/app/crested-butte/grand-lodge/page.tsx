import type { Metadata } from "next";
import { pageContent, schemaBlocks } from "./content";
import { NoFeesHeader } from "@/components/no-fees/no-fees-header";
import { NoFeesHeroSection } from "@/components/no-fees/no-fees-hero-section";
import "../../no-fees/no-fees.css";
import "./page.css";

export const metadata: Metadata = {
  title: "The Grand Lodge Crested Butte | Slope-Side Condos | Traverse Hospitality",
  description: "The Grand Lodge Crested Butte — slope-side condo building. Indoor/outdoor pool, hot tub, steam room. 50+ Traverse-managed units from $95/night.",
  alternates: { canonical: "https://www.booktraverse.com/crested-butte/grand-lodge/" },
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
        bgImage="https://assets.guesty.com/image/upload/v1733288825/production/55935b4b5d6bcf0e0084abd6/asquumcidfz8caddn1al.jpg"
        eyebrow="6 Emmons Loop · Mt. Crested Butte, CO 81225"
        title="The Grand Lodge"
        titleEm="Crested Butte."
        lede="A slope-side condominium building at the foot of Crested Butte Mountain Resort — 200 yards from the Silver Queen Gondola. Heated pool, hot tub, steam room, on-site breakfast & lunch, and 50+ Traverse-managed units starting from $95/night."
        lockedDestination={{
          tag: "The Grand Lodge Crested Butte",
          label: "The Grand Lodge",
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
