import type { Metadata } from "next";
import { pageContent, schemaBlocks } from "./content";
import { NoFeesHeader } from "@/components/no-fees/no-fees-header";
import "../../no-fees/no-fees.css";
import "../../leadville/things-to-do/page.css";

export const metadata: Metadata = {
  title: "Things to Do in Crested Butte Colorado",
  description:
    "Summer hiking, winter skiing, year-round museums and scenic drives — local-favorite things to do in Crested Butte, Colorado.",
  alternates: {
    canonical: "https://www.booktraverse.com/crested-butte/things-to-do",
  },
};

export default function Page() {
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
      <div
        className="traverse-page"
        dangerouslySetInnerHTML={{ __html: pageContent }}
      />
    </div>
  );
}
