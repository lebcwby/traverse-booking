import type { Metadata } from "next";
import { pageContent, schemaBlocks } from "./content";
import { NoFeesHeader } from "@/components/no-fees/no-fees-header";
import "@/app/no-fees/no-fees.css";
// Same layout system as /crested-butte/property-management (hero-full,
// prose-section, callout, comparison table, faq-section, cta-band).
import "../guides/where-to-stay/page.css";

const URL = "https://www.booktraverse.com/crested-butte/best-property-manager";

export const metadata: Metadata = {
  // Layout title template appends " | Traverse Hospitality".
  title: "How to Choose a Property Manager in Crested Butte",
  description:
    "Six questions to ask any Crested Butte or Mt. Crested Butte property manager, answered with Traverse's own sourced data: comp-set results, pricing, channels, Guest Favorites, operations.",
  alternates: { canonical: URL },
  openGraph: {
    type: "article",
    url: URL,
    title: "Who is the best property manager in Crested Butte? Here is how to check.",
    description:
      "Six questions to ask any manager, answered first with Traverse's own numbers. Homes up 2.7% while nearby listings fell 16%.",
    images: [{ url: "/press/summer-2026-revpar-vs-market.jpg", width: 1200, height: 675 }],
    publishedTime: "2026-10-27",
  },
  twitter: {
    card: "summary_large_image",
    title: "Who is the best property manager in Crested Butte? Here is how to check.",
    description:
      "Six questions to ask any manager, answered first with Traverse's own numbers.",
    images: ["/press/summer-2026-revpar-vs-market.jpg"],
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
