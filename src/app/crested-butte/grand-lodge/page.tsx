import type { Metadata } from "next";
import { pageContent, schemaBlocks } from "./content";
import "./page.css";

export const metadata: Metadata = {
  title: "The Grand Lodge Crested Butte | Slope-Side Condos | Traverse Hospitality",
  description: "The Grand Lodge Crested Butte — slope-side condo building. Indoor/outdoor pool, hot tub, steam room. 50+ Traverse-managed units from $95/night.",
  alternates: { canonical: "https://www.booktraverse.com/crested-butte/grand-lodge/" },
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
