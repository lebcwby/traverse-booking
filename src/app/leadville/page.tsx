import type { Metadata } from "next";
import { pageContent, schemaBlocks } from "./content";
import "./page.css";

export const metadata: Metadata = {
  title: "Leadville Colorado Vacation Rentals | Cabins, Homes & Hot Tubs | Traverse Hospitality",
  description: "70+ locally managed vacation rentals in Leadville, Colorado — America's highest city. Cabins, historic homes, hot tub rentals near Ski Cooper, Vail & Copper Mountain.",
  alternates: { canonical: "https://www.booktraverse.com/leadville/" },
};

export default function Page() {
  return (
    <>
      {schemaBlocks.map((schema: Record<string, unknown>, i: number) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
      <div
        className="traverse-page"
        dangerouslySetInnerHTML={{ __html: pageContent }}
      />
    </>
  );
}
