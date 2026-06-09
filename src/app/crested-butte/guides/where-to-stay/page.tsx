import type { Metadata } from "next";
import { pageContent, schemaBlocks } from "./content";
import { NoFeesHeader } from "@/components/no-fees/no-fees-header";
import "../../../no-fees/no-fees.css";
import "./page.css";

export const metadata: Metadata = {
  title: "Where to Stay in Crested Butte: A Local Guide (2026)",
  description: "An honest comparison of slope-side lodging at Crested Butte — Grand Lodge vs. Lodge at Mountaineer Square vs. the Plaza.",
  alternates: { canonical: "https://www.booktraverse.com/crested-butte/guides/where-to-stay" },
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
