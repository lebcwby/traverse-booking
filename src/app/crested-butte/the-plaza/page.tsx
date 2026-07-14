import type { Metadata } from "next";
import { pageContent, schemaBlocks } from "./content";
import { NoFeesHeader } from "@/components/no-fees/no-fees-header";
import { NoFeesHeroSection } from "@/components/no-fees/no-fees-hero-section";
import "../../no-fees/no-fees.css";
import "./page.css";

export const metadata: Metadata = {
  title: "The Plaza Condominiums Crested Butte | Spacious Ski-In Condos",
  description: "The Plaza Condominiums — spacious 2 and 3-bedroom ski-in condos. Hot tubs, sauna, Iron Horse Tap, tennis & pickleball. Book direct, no fees.",
  alternates: { canonical: "https://www.booktraverse.com/crested-butte/the-plaza" },
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
        bgImage="https://assets.guesty.com/image/upload/h_600/v1756514170/production/55935b4b5d6bcf0e0084abd6/cerpq3hoexjezuum0b4j.jpg"
        eyebrow="11 Snowmass Road · Mt. Crested Butte, CO 81225"
        title="The Plaza Condominiums."
        titleEm="Space to spread out."
        lede="Spacious 2 and 3-bedroom ski-in condos at the base of Crested Butte Mountain Resort — 100 yards from the Silver Queen lift. Full kitchens, fireplaces, hot tubs, Iron Horse Tap on-site, and the Traverse Hospitality office right at the entrance. Book direct — no booking fees."
        lockedDestination={{
          tag: "The Plaza Crested Butte",
          label: "The Plaza",
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
