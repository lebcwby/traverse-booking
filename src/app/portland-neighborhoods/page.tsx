import type { Metadata } from "next";
import { NeighborhoodExplorer } from "@/components/neighborhoods/neighborhood-explorer";
import { getLandingPageUrl } from "@/lib/landing-page-paths";
import { getBreadcrumbSchema, JsonLd } from "@/lib/schema";

export const metadata: Metadata = {
  title: "Portland Neighborhoods Map — Explore Where to Stay",
  description:
    "Interactive map of Portland's best neighborhoods for visitors. Explore restaurants, bars, coffee shops, and vacation rentals in Hawthorne, Alberta, NW 23rd, Mississippi, and more.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/portland-neighborhoods" },
  openGraph: {
    title: "Portland Neighborhoods Map — Explore Where to Stay",
    description:
      "Interactive map of Portland's best neighborhoods. See restaurants, bars, and vacation rentals across Hawthorne, Alberta, NW 23rd, and more.",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
};

const NEIGHBORHOOD_PLACES = [
  {
    name: "Hawthorne",
    slug: "hawthorne-belmont",
    description:
      "Walkable dining, vintage shops, and coffee culture along SE Hawthorne Blvd",
  },
  {
    name: "Alberta Arts District",
    slug: "alberta",
    description:
      "Murals, independent galleries, and Portland's best brunch scene on NE Alberta St",
  },
  {
    name: "Mississippi",
    slug: "mississippi",
    description:
      "String lights, local artisans, and creative bars on N Mississippi Ave",
  },
  {
    name: "Pearl District",
    slug: "pearl-district",
    description:
      "Upscale dining, galleries, and urban walkability in Portland's premier downtown neighborhood",
  },
  {
    name: "Division Street",
    slug: "division-street",
    description:
      "Modern restaurants, craft cocktails, and neighborhood energy along SE Division",
  },
  {
    name: "Northwest Portland",
    slug: "northwest-portland",
    description:
      "NW 23rd Avenue shopping, dining, and walkable streets in the Alphabet District",
  },
  {
    name: "Sellwood",
    slug: "sellwood",
    description:
      "Antique shops, riverside parks, and a charming small-town feel in SE Portland",
  },
  {
    name: "St. Johns",
    slug: "st-johns",
    description:
      "Cathedral Park, local pubs, and authentic North Portland neighborhood character",
  },
];

export default function PortlandNeighborhoodsPage() {
  const itemListSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Portland Neighborhoods for Vacation Rentals",
    description:
      "Portland's best neighborhoods for visitors — each with its own personality, restaurants, and vacation rentals.",
    itemListElement: NEIGHBORHOOD_PLACES.map((n, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "Place",
        name: n.name,
        description: n.description,
        url: getLandingPageUrl(n.slug),
        containedInPlace: { "@type": "City", name: "Portland, Oregon" },
      },
    })),
  };

  const breadcrumbSchema = getBreadcrumbSchema([
    { name: "Book Traverse", url: "https://www.booktraverse.com" },
    {
      name: "Portland Neighborhoods",
      url: "https://www.booktraverse.com/portland-neighborhoods",
    },
  ]);

  return (
    <>
      <JsonLd data={itemListSchema} />
      <JsonLd data={breadcrumbSchema} />
      <NeighborhoodExplorer />
    </>
  );
}
