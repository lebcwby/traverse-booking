import type { Metadata } from "next";
import { pageContent, schemaBlocks } from "./content";
import { NoFeesHeader } from "@/components/no-fees/no-fees-header";
import "../../no-fees/no-fees.css";
import "./page.css";

export const metadata: Metadata = {
  title: "Things to Do in Leadville Colorado",
  description:
    "Summer hiking and fishing, winter skiing and dog sledding, year-round museums and downtown — local-favorite things to do in Leadville, Colorado.",
  alternates: {
    canonical: "https://www.booktraverse.com/leadville/things-to-do",
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
