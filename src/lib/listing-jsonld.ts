/**
 * Structured-data builders shared by the catalogue and listing pages.
 *
 * Phase 2 of docs/phase2-ai-agent-booking.md. Phase 1 fixed what was wrong in
 * the listing JSON-LD; this adds what was missing.
 *
 * The price rule from phase 1 carries over everywhere here: a listing's price
 * is published ONLY when it comes from the pricing cache's real quoted rate.
 * `listings.prices.basePrice` is a $95 placeholder on roughly 40% of the
 * catalogue, and a confidently wrong price is worse than no price.
 */

export const SITE_ORIGIN = "https://www.booktraverse.com";

/**
 * Buildings we have a dedicated page for, keyed by the Guesty tag its units
 * carry. Lets a unit's structured data say which building it belongs to and
 * point at that building's page.
 *
 * Tags must match Guesty exactly — they are listed in CLAUDE.md under "Guesty
 * BEAPI Tags (CORRECT VALUES)" and a typo here silently drops the link rather
 * than failing loudly.
 */
export const BUILDINGS: Array<{ tag: string; name: string; path: string }> = [
  {
    tag: "The Grand Lodge Crested Butte",
    name: "The Grand Lodge Crested Butte",
    path: "/crested-butte/grand-lodge",
  },
  {
    tag: "The Plaza Crested Butte",
    name: "The Plaza Condominiums",
    path: "/crested-butte/the-plaza",
  },
  {
    tag: "The Lodge at Mountaineer Square",
    name: "The Lodge at Mountaineer Square",
    path: "/crested-butte/lodge-at-mountaineer-square",
  },
];

export function findBuildingForTags(
  tags: string[] | null | undefined
): { name: string; url: string } | null {
  if (!Array.isArray(tags) || tags.length === 0) return null;
  const match = BUILDINGS.find((b) => tags.includes(b.tag));
  return match
    ? { name: match.name, url: `${SITE_ORIGIN}${match.path}` }
    : null;
}

/**
 * `isPartOf` for a unit inside one of our buildings.
 *
 * An `ApartmentComplex` is the schema.org type for a building containing
 * individually bookable units, and linking to the building page gives both
 * crawlers and assistants the "50 units in this one building" relationship
 * that is otherwise only expressible as a tag.
 */
export function buildIsPartOf(tags: string[] | null | undefined) {
  const building = findBuildingForTags(tags);
  if (!building) return undefined;
  return {
    "@type": "ApartmentComplex",
    name: building.name,
    url: building.url,
  };
}

interface ItemListListing {
  guesty_id: string;
  title: string | null;
  nickname: string | null;
  picture: string | null;
  bedrooms: number | null;
  accommodates: number | null;
}

/**
 * An `ItemList` of the listings a catalogue page is showing.
 *
 * `/properties` emitted `CollectionPage` + `BreadcrumbList` and nothing about
 * its actual contents, so a crawler reading the catalogue page learned that a
 * collection existed but not one thing that was in it. Each entry is a
 * `ListItem` wrapping a minimal `VacationRental` — enough to identify and
 * follow, with the full object living on the listing page itself.
 *
 * `nightlyFromById` carries the real cached rate; a listing absent from it
 * gets no `offers` rather than the placeholder.
 */
export function buildListingItemList(params: {
  listings: ItemListListing[];
  nightlyFromById?: Map<string, number | undefined>;
  getUrl: (listing: ItemListListing) => string;
  name: string;
  url: string;
}) {
  const items = params.listings
    .filter((l) => l.guesty_id)
    .map((listing, index) => {
      const nightly = params.nightlyFromById?.get(listing.guesty_id);
      const listingUrl = params.getUrl(listing);
      const name = (listing.title || listing.nickname || "").trim();
      return {
        "@type": "ListItem",
        position: index + 1,
        item: {
          "@type": "VacationRental",
          "@id": `${listingUrl}#rental`,
          name: name || undefined,
          url: listingUrl,
          ...(listing.picture ? { image: listing.picture } : {}),
          ...(listing.bedrooms ? { numberOfBedrooms: listing.bedrooms } : {}),
          ...(listing.accommodates
            ? {
                occupancy: {
                  "@type": "QuantitativeValue",
                  value: listing.accommodates,
                },
              }
            : {}),
          ...(typeof nightly === "number" && nightly > 0
            ? {
                offers: {
                  "@type": "Offer",
                  price: nightly,
                  priceCurrency: "USD",
                  unitCode: "DAY",
                  availability: "https://schema.org/InStock",
                  url: listingUrl,
                },
              }
            : {}),
        },
      };
    });

  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: params.name,
    url: params.url,
    numberOfItems: items.length,
    itemListElement: items,
  };
}

/**
 * `WebSite` with a `SearchAction`, so search engines and assistants know the
 * site has its own search and how to call it. Pairs with the existing
 * `Organization` block rather than replacing it.
 */
export function buildWebSiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_ORIGIN}/#website`,
    url: SITE_ORIGIN,
    name: "Traverse Hospitality",
    publisher: { "@id": `${SITE_ORIGIN}/#organization` },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_ORIGIN}/properties?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}
