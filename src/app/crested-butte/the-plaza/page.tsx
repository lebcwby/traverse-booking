import type { Metadata } from "next";
import { pageContent, schemaBlocks } from "./content";
import "./page.css";

export const metadata: Metadata = {
  title: "The Plaza Condominiums Crested Butte | Spacious Ski-In Condos | Traverse Hospitality",
  description: "The Plaza Condominiums — spacious 2 and 3-bedroom ski-in condos. Hot tubs, sauna, Iron Horse Tap, tennis & pickleball. From $95/night.",
  alternates: { canonical: "https://www.booktraverse.com/crested-butte/the-plaza/" },
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
