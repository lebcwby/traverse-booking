// Shared schema.org structured data utilities for Book Traverse
// All JSON-LD generation should use these helpers for consistent @id references
// and entity definitions across the site.

const SITE_URL = "https://www.booktraverse.com";

export const SCHEMA_IDS = {
  organization: `${SITE_URL}/#organization`,
  website: `${SITE_URL}/#website`,
} as const;

/**
 * Full organization entity — rendered on homepage only.
 * All other pages reference via { "@id": SCHEMA_IDS.organization }.
 */
export function getOrganizationSchema(aggregateRating?: {
  ratingValue: string;
  reviewCount: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "LodgingBusiness",
    "@id": SCHEMA_IDS.organization,
    name: "Book Traverse",
    url: SITE_URL,
    logo: `${SITE_URL}/book-traverse-icon.png`,
    description:
      "Colorado's local vacation rental company. 189 homes across Crested Butte, Leadville, Vail, Avon, Granby, and Twin Lakes — pet-friendly, luxury, family, and extended stays. No booking fees.",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Crested Butte",
      addressRegion: "CO",
      addressCountry: "US",
    },
    areaServed: [
      { "@type": "City", name: "Crested Butte" },
      { "@type": "City", name: "Leadville" },
      { "@type": "City", name: "Vail" },
      { "@type": "City", name: "Avon" },
      { "@type": "City", name: "Granby" },
      { "@type": "City", name: "Twin Lakes" },
    ],
    telephone: "+1-720-759-2013",
    email: "bookings@traversehospitality.com",
    image: `${SITE_URL}/og-image-v2.png`,
    sameAs: [
      "https://www.instagram.com/booktraverse",
      "https://www.facebook.com/booktraverse",
      "https://share.google/mxXxrTA4c6XSK5Gh0",
    ],
    ...(aggregateRating
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: aggregateRating.ratingValue,
            reviewCount: aggregateRating.reviewCount,
            bestRating: "5",
            worstRating: "1",
          },
        }
      : {}),
  };
}

/** WebSite entity with SearchAction — rendered on homepage only. */
export function getWebSiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": SCHEMA_IDS.website,
    name: "Book Traverse",
    url: SITE_URL,
    publisher: { "@id": SCHEMA_IDS.organization },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/properties?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

/** Lightweight @id reference to the organization entity. */
export function getOrgRef() {
  return { "@id": SCHEMA_IDS.organization };
}

/** Standard breadcrumb builder. */
export function getBreadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/** FAQ schema builder from question/answer pairs. */
export function getFaqSchema(faqs: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}

/** Renders a JSON-LD script tag. Use in server components. */
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export { SITE_URL };
