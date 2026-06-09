import type { Metadata } from "next";
import { pageContent, schemaBlocks } from "./content";
import { NoFeesHeader } from "@/components/no-fees/no-fees-header";
import { NoFeesHeroSection } from "@/components/no-fees/no-fees-hero-section";
import "../no-fees/no-fees.css";
import "../leadville/page.css";

export const metadata: Metadata = {
  title:
    "Twin Lakes Colorado Vacation Rentals | Mt Elbert Basecamp & Lakeside Cabins | Traverse Hospitality",
  description:
    "Locally managed cabins in Twin Lakes, Colorado — at the base of Mount Elbert (14,440 ft, highest 14er in Colorado). Two glacial lakes, Independence Pass to Aspen, 25 min south of Leadville. Pet-friendly stays with hot tubs and wood stoves.",
  alternates: { canonical: "https://www.booktraverse.com/twin-lakes" },
};

export default function TwinLakesPage() {
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
        bgImage="/property-management/markets/twin-lakes.jpg"
        eyebrow="Lake County · Base of Mount Elbert · Elevation 9,200 ft"
        title="Twin Lakes,"
        titleEm="Colorado."
        lede="A glacier-carved alpine valley at the foot of Mount Elbert — Colorado's highest 14er — with two of the state's most scenic high-country lakes. Locally managed cabins with wood stoves, hot tubs, and trailhead-adjacent privacy. Book direct and save up to 15%."
        lockedDestination={{ city: "Twin Lakes", label: "Twin Lakes, CO" }}
        directionsHref="#overview"
        directionsLabel="Explore Twin Lakes"
      />
      <div
        className="traverse-page"
        dangerouslySetInnerHTML={{ __html: pageContent }}
      />
    </div>
  );
}
