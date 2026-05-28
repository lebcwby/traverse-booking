// src/components/plan/trip-plan-schema.tsx
// Emits JSON-LD for a pre-seeded trip plan page. Uses schema.org TouristTrip
// with an ItemList of TouristAttraction entries (one per POI), anchored to
// our LodgingBusiness (Book Traverse). Travel schema has modest rich-result
// upside but it's cheap; crawlers use it as a topical signal either way.

import type { Itinerary } from "@/lib/plan/schema";
import type { Poi } from "@/lib/pois/types";
import type { PlanSlugEntry } from "@/lib/plan/slug-map";
import { getSlugContent } from "@/lib/plan/slug-content";

interface TripPlanSchemaProps {
  entry: PlanSlugEntry;
  itinerary: Itinerary;
  poisById: Record<string, Poi>;
}

export function TripPlanSchema({
  entry,
  itinerary,
  poisById,
}: TripPlanSchemaProps) {
  const canonical = `https://www.booktraverse.com/plan/${entry.slug}`;

  // Flatten every itinerary POI into ordered ItemList entries. Dedup so a
  // place that appears twice (coffee → same neighborhood) doesn't double-count.
  const seen = new Set<string>();
  const attractions: object[] = [];
  let position = 0;
  for (const day of itinerary.days) {
    for (const item of day.items) {
      const poi = poisById[item.poiId];
      if (!poi) continue;
      if (seen.has(poi.id)) continue;
      seen.add(poi.id);
      position += 1;
      attractions.push({
        "@type": "ListItem",
        position,
        item: {
          "@type": "TouristAttraction",
          name: poi.name,
          address: poi.address
            ? {
                "@type": "PostalAddress",
                streetAddress: poi.address,
                addressRegion: "CO",
                addressCountry: "US",
              }
            : undefined,
          geo:
            poi.lat && poi.lng
              ? {
                  "@type": "GeoCoordinates",
                  latitude: poi.lat,
                  longitude: poi.lng,
                }
              : undefined,
        },
      });
    }
  }

  const content = getSlugContent(entry.slug);
  const graph: object[] = [
    {
      "@type": "TouristTrip",
      "@id": `${canonical}#trip`,
      name: entry.h1,
      description: entry.metaDescription,
      url: canonical,
      touristType: entry.idealFor,
      provider: {
        "@type": "LodgingBusiness",
        "@id": "https://www.booktraverse.com/#lodging",
        name: "Book Traverse",
        url: "https://www.booktraverse.com",
      },
      itinerary: {
        "@type": "ItemList",
        numberOfItems: attractions.length,
        itemListElement: attractions,
      },
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Book Traverse",
          item: "https://www.booktraverse.com",
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Trip Plans",
          item: "https://www.booktraverse.com/plan",
        },
        {
          "@type": "ListItem",
          position: 3,
          name: entry.h1,
          item: canonical,
        },
      ],
    },
  ];

  if (content && content.faqs.length > 0) {
    graph.push({
      "@type": "FAQPage",
      "@id": `${canonical}#faq`,
      mainEntity: content.faqs.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: faq.answer,
        },
      })),
    });
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": graph,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
