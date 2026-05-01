import type { Metadata } from "next";
import { pageContent, schemaBlocks } from "./content";
import "./page.css";

export const metadata: Metadata = {
  title: "Where to Stay in Crested Butte: A Local Guide (2026) | Traverse Hospitality",
  description: "An honest comparison of slope-side lodging at Crested Butte — Grand Lodge vs. Lodge at Mountaineer Square vs. the Plaza.",
  alternates: { canonical: "https://www.booktraverse.com/crested-butte/guides/where-to-stay/" },
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
