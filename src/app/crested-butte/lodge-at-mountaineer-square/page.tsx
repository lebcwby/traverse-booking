import type { Metadata } from "next";
import { pageContent, schemaBlocks } from "./content";
import "./page.css";

export const metadata: Metadata = {
  title: "Lodge at Mountaineer Square | Luxury Ski-In Condos | Traverse Hospitality",
  description: "Lodge at Mountaineer Square — luxury condos steps from the lifts at CBMR. Pool, hot tub, sauna, A/C, heated parking. From $95/night.",
  alternates: { canonical: "https://www.booktraverse.com/crested-butte/lodge-at-mountaineer-square/" },
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
