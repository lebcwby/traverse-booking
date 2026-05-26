import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { searchListingsCached } from "@/lib/guesty-beapi";
import { getLandingPagePath } from "@/lib/landing-page-paths";
import { mapBeapiToListing } from "@/lib/listing-utils";
import { getPhotoUrl } from "@/lib/utils";
import { getListingPricingCache, type Listing } from "@/lib/supabase";
import { shouldSkipCiBeapiFetches } from "@/lib/build-environment";
import { rankListings } from "@/lib/ranking";
import { PropertyCard } from "@/components/properties/property-card";
import { FloatingSearchBar } from "@/components/home/floating-search-bar";
import {
  Wifi,
  UtensilsCrossed,
  PawPrint,
  WashingMachine,
  Lock,
  Wind,
  Tv,
  Car,
  Coffee,
  Flame,
} from "lucide-react";

const FALLBACK_HERO = "/images/portland-skyline-hero.jpg";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "The Pomeroy | Boutique Suites on NW 23rd — Portland, Oregon",
  description:
    "The Pomeroy offers boutique suites in a historic NW 23rd Ave building in Portland, Oregon. 1-6 bedroom configurations, pet-friendly, self check-in. Book direct and save.",
  openGraph: {
    title: "The Pomeroy | Boutique Suites on NW 23rd — Portland, Oregon",
    description:
      "The Pomeroy offers boutique suites in a historic NW 23rd Ave building in Portland, Oregon. 1-6 bedroom configurations, pet-friendly, self check-in. Book direct and save.",
    url: "https://www.booktraverse.com/the-pomeroy",
    type: "website",
    images: [{ url: "/og-image-v2.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "The Pomeroy | Boutique Suites on NW 23rd — Portland, Oregon",
    description:
      "The Pomeroy offers boutique suites in a historic NW 23rd Ave building in Portland, Oregon. 1-6 bedroom configurations, pet-friendly, self check-in. Book direct and save.",
    images: ["/og-image-v2.png"],
  },
  alternates: {
    canonical: "https://www.booktraverse.com/the-pomeroy",
  },
};

const AMENITIES = [
  { icon: Wifi, label: "High-Speed WiFi" },
  { icon: UtensilsCrossed, label: "Full Kitchen" },
  { icon: PawPrint, label: "Pet-Friendly" },
  { icon: WashingMachine, label: "Washer & Dryer" },
  { icon: Lock, label: "Smart Lock Check-In" },
  { icon: Wind, label: "Air Conditioning" },
  { icon: Tv, label: "Smart TV" },
  { icon: Car, label: "Street Parking" },
  { icon: Coffee, label: "Coffee & Tea" },
  { icon: Flame, label: "Heating" },
];

const FAQS = [
  {
    question: "How does check-in work at The Pomeroy?",
    answer:
      "All Pomeroy suites feature smart lock self check-in. You'll receive a unique access code and detailed instructions 24 hours before your arrival. No need to coordinate with anyone — just arrive and let yourself in. Check-in is at 4 PM and check-out is at 11 AM.",
  },
  {
    question: "Is parking available?",
    answer:
      "Free street parking is available throughout the neighborhood. NW 23rd Avenue has 2-hour metered parking during the day, but residential side streets (including NW Raleigh) offer unrestricted parking. Most guests find parking within a block of their suite.",
  },
  {
    question: "Are pets allowed at The Pomeroy?",
    answer:
      "Yes! The Pomeroy is pet-friendly. Well-behaved dogs are welcome in most suites. A one-time pet fee applies to your reservation. Please let us know at booking so we can confirm your specific suite accommodates pets.",
  },
  {
    question: "Can I book multiple suites for a group?",
    answer:
      "Absolutely. The Pomeroy is ideal for group travel — book adjacent suites across our historic buildings for family reunions, wedding parties, or corporate retreats. Contact us directly for group rates and coordinated bookings across multiple units.",
  },
];

async function fetchPomeroyListings(): Promise<Listing[]> {
  if (shouldSkipCiBeapiFetches()) {
    return [];
  }

  try {
    const data = await searchListingsCached(
      { tags: ["NW Pomeroy"], limit: 100 },
      revalidate
    );
    const results = data?.results || data || [];

    let listings: Listing[] = results
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((r: any) => r.prices?.basePrice > 0)
      .map(mapBeapiToListing);

    const pricingCache = await getListingPricingCache();
    listings = listings.map((l) => {
      const cached = pricingCache.get(l.guesty_id);
      if (cached) {
        return {
          ...l,
          totalPrice: cached.estimatedTotal,
          nightCount: cached.nightCount,
          cachedCheckIn: cached.checkIn,
          cachedCheckOut: cached.checkOut,
        };
      }
      return l;
    });

    return rankListings(listings, "browse");
  } catch (error) {
    console.error("Failed to fetch Pomeroy listings:", error);
    return [];
  }
}

export default async function ThePomeroyPage() {
  const listings = await fetchPomeroyListings();

  const heroImage = listings[0]?.picture
    ? getPhotoUrl(listings[0].picture, 1600)
    : FALLBACK_HERO;

  // JSON-LD structured data — all content from static config and listing data (safe)
  const lodgingLd = {
    "@context": "https://schema.org",
    "@type": "LodgingBusiness",
    name: "The Pomeroy",
    description:
      "Boutique suites on NW 23rd in Portland, Oregon. Historic buildings with fully equipped kitchens, smart lock check-in, and pet-friendly accommodations.",
    url: "https://www.booktraverse.com/the-pomeroy",
    address: {
      "@type": "PostalAddress",
      streetAddress: "NW 23rd Ave & NW Raleigh St",
      addressLocality: "Portland",
      addressRegion: "OR",
      postalCode: "97210",
      addressCountry: "US",
    },
    telephone: "+1-720-759-2013",
    priceRange: "$119 - $699",
    amenityFeature: AMENITIES.map((a) => ({
      "@type": "LocationFeatureSpecification",
      name: a.label,
      value: true,
    })),
    numberOfRooms: listings.length,
    petsAllowed: true,
    parentOrganization: { "@id": "https://www.booktraverse.com/#organization" },
  };

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
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
        name: "The Pomeroy",
        item: "https://www.booktraverse.com/the-pomeroy",
      },
    ],
  };

  return (
    <>
      {/* JSON-LD — content from static config and listing data, not user input */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(lodgingLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />

      {/* Hero */}
      <section className="relative flex min-h-[420px] items-center justify-center px-4 py-16 sm:min-h-[500px] sm:py-20">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url('${heroImage}')` }}
        />
        <div className="absolute inset-0 bg-primary/50" />
        <div className="relative z-10 mx-auto w-full max-w-3xl text-center">
          <h1 className="text-4xl font-bold text-white sm:text-5xl lg:text-6xl">
            The Pomeroy
          </h1>
          <p className="mt-3 text-lg text-white/90 sm:text-xl">
            Boutique Suites on NW 23rd
          </p>
          <p className="mt-1 text-base text-white/75">Portland, Oregon</p>
        </div>
      </section>

      {/* Search Bar */}
      <Suspense>
        <FloatingSearchBar compact initialTag="NW Pomeroy" />
      </Suspense>

      {/* About */}
      <section className="py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <h2 className="mb-6 text-2xl font-bold text-foreground">
            About The Pomeroy
          </h2>
          <p className="mb-6 text-lg leading-relaxed text-muted-foreground">
            The Pomeroy is a collection of boutique suites nestled across
            historic buildings at the corner of NW 23rd Avenue and NW Raleigh
            Street — the heart of Portland&apos;s beloved Nob Hill neighborhood.
            Each suite has been thoughtfully restored to blend period charm with
            modern comfort, offering guests a boutique hotel experience with the
            space and privacy of a home.
          </p>
          <p className="mb-6 text-lg leading-relaxed text-muted-foreground">
            Every suite comes fully equipped with a kitchen, high-speed WiFi,
            smart TV, washer and dryer, and climate control. Our smart lock
            system means you check in on your own schedule — no front desk, no
            waiting. Whether you&apos;re visiting for a weekend getaway, a
            business trip, or an extended stay, The Pomeroy offers flexible
            configurations from cozy studios to spacious multi-bedroom suites
            that can accommodate groups of all sizes.
          </p>
          <p className="text-lg leading-relaxed text-muted-foreground">
            Step outside your door and you&apos;re on one of Portland&apos;s
            most walkable streets — lined with restaurants, coffee shops,
            boutiques, and bars. The Pomeroy is pet-friendly, because we believe
            the best trips include every member of the family. Book direct with
            Book Traverse and save — no service fees, lowest price guaranteed.
          </p>
        </div>
      </section>

      {/* Our Suites */}
      {listings.length > 0 && (
        <section className="bg-secondary/30 py-16">
          <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-10">
            <h2 className="mb-8 text-2xl font-bold text-foreground">
              Our Suites
            </h2>
            <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:gap-x-4 sm:gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {listings.map((listing, i) => (
                <PropertyCard
                  key={listing.guesty_id}
                  listing={listing}
                  hideCity
                  photoWidth={800}
                  lazyCarousel={i >= 6}
                  priority={i < 4}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Amenities */}
      <section className="py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <h2 className="mb-8 text-2xl font-bold text-foreground">Amenities</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
            {AMENITIES.map((amenity) => (
              <div
                key={amenity.label}
                className="flex flex-col items-center gap-2 rounded-lg border border-border bg-muted/30 p-4 text-center"
              >
                <amenity.icon className="h-6 w-6 text-primary" />
                <span className="text-sm font-medium text-foreground">
                  {amenity.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The Neighborhood */}
      <section className="bg-secondary/30 py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <h2 className="mb-6 text-2xl font-bold text-foreground">
            The Neighborhood
          </h2>
          <p className="mb-6 text-lg leading-relaxed text-muted-foreground">
            NW 23rd Avenue — known locally as &quot;Trendy-Third&quot; — is one
            of Portland&apos;s most walkable and vibrant streets. From your
            doorstep you can explore dozens of restaurants, from casual brunch
            spots to upscale dining. Grab coffee at one of the neighborhood
            cafés, browse independent boutiques, or pick up groceries at the
            nearby New Seasons Market — all without getting in a car.
          </p>
          <p className="mb-6 text-lg leading-relaxed text-muted-foreground">
            The Nob Hill neighborhood sits between Forest Park — the largest
            urban forest in the country — and the Pearl District. You&apos;re a
            short walk from the Portland Streetcar, minutes from downtown, and
            close to Washington Park, the Oregon Zoo, and the International Rose
            Test Garden. It&apos;s the perfect home base for exploring
            everything Portland has to offer.
          </p>
          <Link
            href={getLandingPagePath("nw-23rd")}
            className="inline-flex items-center text-sm font-semibold text-primary hover:underline"
          >
            Explore more NW 23rd properties &rarr;
          </Link>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <h2 className="mb-8 text-2xl font-bold text-foreground">
            Frequently Asked Questions
          </h2>
          <div className="space-y-6">
            {FAQS.map((faq) => (
              <div key={faq.question}>
                <h3 className="text-lg font-semibold text-foreground">
                  {faq.question}
                </h3>
                <p className="mt-2 leading-relaxed text-muted-foreground">
                  {faq.answer}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Book Direct CTA */}
      <section className="bg-primary py-16 text-center">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">
            Book Direct &amp; Save
          </h2>
          <p className="mt-3 text-lg text-white/80">
            No service fees. Lowest price guaranteed. Book directly with Stay
            Portland for the best rate on your Pomeroy suite.
          </p>
          <Link
            href="/properties?filterTag=NW+Pomeroy"
            className="mt-6 inline-flex items-center rounded-full bg-white px-8 py-3 text-sm font-semibold text-primary transition-colors hover:bg-white/90"
          >
            Search Available Suites
          </Link>
        </div>
      </section>
    </>
  );
}
