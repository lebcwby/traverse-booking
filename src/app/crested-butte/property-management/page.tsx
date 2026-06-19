import type { Metadata } from "next";
import { pageContent, schemaBlocks } from "./content";
import { NoFeesHeader } from "@/components/no-fees/no-fees-header";
import "../../no-fees/no-fees.css";
// Reuse the where-to-stay guide's styles (hero-full, prose-section, callout,
// faq-section) so this owner page is visually consistent with no new CSS.
import "../guides/where-to-stay/page.css";

export const metadata: Metadata = {
  title: "Crested Butte Property Management for Vacation Rental Owners",
  description:
    "Full-service Crested Butte & Mt. Crested Butte short-term rental management — local team, dynamic pricing, marketing across every channel plus commission-free direct booking, housekeeping, maintenance, and 24/7 guest support.",
  alternates: {
    canonical: "https://www.booktraverse.com/crested-butte/property-management",
  },
};

export default function Page() {
  return (
    <div data-no-fees-layout={true}>
      {schemaBlocks.map((schema: Record<string, unknown>, i: number) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
      <NoFeesHeader />
      <div
        className="traverse-page"
        dangerouslySetInnerHTML={{ __html: pageContent }}
      />
    </div>
  );
}
