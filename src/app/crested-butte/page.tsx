import type { Metadata } from "next";
import { pageContent, schemaBlocks } from "./content";
import "./page.css";

export const metadata: Metadata = {
  title: "Crested Butte Vacation Rentals & Lodging | Traverse Hospitality",
  description: "Slope-side condos and locally managed vacation rentals at Crested Butte Mountain Resort. Browse the Grand Lodge, Lodge at Mountaineer Square, and Plaza Condominiums.",
  alternates: { canonical: "https://www.booktraverse.com/crested-butte/" },
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
