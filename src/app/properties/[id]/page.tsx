export const revalidate = 300; // cache pages for 5 minutes

import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound, permanentRedirect } from "next/navigation";
import {
  Bed,
  Bath,
  Users,
  Maximize,
  Shield,
  Star,
  CalendarX2,
  KeyRound,
  ShieldCheck,
  DoorOpen,
  PawPrint,
} from "lucide-react";
import Link from "next/link";
import {
  getListing,
  getListingByTitleSlug,
  getSimilarListings,
} from "@/lib/supabase";
import { getListingDetail } from "@/lib/guesty-beapi";
import {
  extractIdFromSlug,
  getListingSlug,
  getPhotoUrl,
  clampReviewAvg,
} from "@/lib/utils";
import {
  getNeighborhoodFromTags,
  getNeighborhoodTag,
} from "@/lib/neighborhoods";
import { getNearbyPois } from "@/lib/portland-pois";
import { Separator } from "@/components/ui/separator";
import { PhotoGallery } from "@/components/properties/property-detail/photo-gallery";
import { AmenitiesGrid } from "@/components/properties/property-detail/amenities-grid";
import { PropertyDescription } from "@/components/properties/property-detail/property-description";
import { WhereYoullSleep } from "@/components/properties/property-detail/where-youll-sleep";
import { BookingSidebar } from "@/components/properties/property-detail/booking-sidebar";
import { AvailabilityCalendar } from "@/components/properties/property-detail/availability-calendar";
import { DateRangeProvider } from "@/components/properties/property-detail/date-range-context";
// PageLoader removed — splash screen was blocking LCP by 1.5-2s
import { MobileBottomBar } from "@/components/properties/property-detail/mobile-bottom-bar";
import { MobilePriceComparison } from "@/components/properties/property-detail/mobile-price-comparison";
import { FloatingSearchBar } from "@/components/home/floating-search-bar";
import { ReviewsSection } from "@/components/properties/property-detail/reviews-section";
import { WhereYoullBe } from "@/components/properties/property-detail/where-youll-be-section";
import { StickyNav } from "@/components/properties/property-detail/sticky-nav";
import { NeighborhoodSection } from "@/components/properties/property-detail/neighborhood-section";
import { SimilarProperties } from "@/components/properties/property-detail/similar-properties";
import {
  PropertyFaq,
  generatePropertyFaqs,
} from "@/components/properties/property-detail/property-faq";
import { getListingReviews } from "@/lib/reviews";
import { WishlistButton } from "@/components/wishlist-button";
import { ShareButton } from "@/components/share-dialog";
import { InlineChatCta } from "@/components/chat/inline-chat-cta";
import { TrackViewedListing } from "./track-viewed-listing";
import { RareFindBadge } from "@/components/properties/property-detail/rare-find-badge";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    checkIn?: string;
    checkOut?: string;
    guests?: string;
    pointofsale?: string;
  }>;
}

function formatTime(time: string | null | undefined): string {
  if (!time) return "";
  const match = time.match(/^(\d{1,2}):(\d{2})/);
  if (match) {
    const h = parseInt(match[1]);
    const m = match[2];
    const suffix = h >= 12 ? "PM" : "AM";
    const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${h12}:${m} ${suffix}`;
  }
  return time;
}

function getCancellationText(policy: string | undefined): string {
  if (!policy) return "";
  switch (policy) {
    case "flexible":
      return "Free cancellation up to 24 hours before check-in.";
    case "semi_flexible":
      return "Free cancellation up to 48 hours before check-in. After that, the reservation is non-refundable.";
    case "moderate":
      return "Free cancellation up to 5 days before check-in.";
    case "firm":
      return "Free cancellation up to 30 days before check-in.";
    case "strict":
      return "Free cancellation up to 60 days before check-in. 50% refund up to 30 days.";
    case "super_strict":
      return "Non-refundable. No cancellation.";
    default:
      return `Cancellation policy: ${policy.replace(/_/g, " ")}`;
  }
}

function getCancellationTitle(policy: string | undefined): string {
  if (!policy) return "Cancellation policy";
  switch (policy) {
    case "flexible":
      return "Flexible cancellation";
    case "semi_flexible":
      return "Semi-flexible cancellation";
    case "moderate":
      return "Moderate cancellation";
    case "firm":
    case "strict":
      return "Strict cancellation";
    case "super_strict":
      return "Non-refundable";
    default:
      return "Cancellation policy";
  }
}

function normalizeStructuredDataTime(
  time: string | null | undefined
): string | undefined {
  if (!time) return undefined;
  const normalized = time.trim();
  if (/^\d{2}:\d{2}$/.test(normalized)) return `${normalized}:00`;
  if (/^\d{2}:\d{2}:\d{2}$/.test(normalized)) return normalized;
  return normalized || undefined;
}

function toIsoCountryCode(
  country: string | null | undefined
): string | undefined {
  if (!country) return undefined;
  const normalized = country.trim().toLowerCase();
  if (
    normalized === "us" ||
    normalized === "usa" ||
    normalized === "united states" ||
    normalized === "united states of america"
  ) {
    return "US";
  }
  return country.trim() || undefined;
}

function getVacationRentalAdditionalType(
  propertyType: string | null | undefined
): string {
  const normalized = (propertyType || "").toLowerCase();
  if (normalized.includes("bungalow")) return "Bungalow";
  if (normalized.includes("cabin")) return "Cabin";
  if (normalized.includes("chalet")) return "Chalet";
  if (normalized.includes("cottage")) return "Cottage";
  if (normalized.includes("villa")) return "Villa";
  if (
    normalized.includes("apartment") ||
    normalized.includes("condo") ||
    normalized.includes("loft") ||
    normalized.includes("studio")
  ) {
    return "Apartment";
  }
  return "House";
}

function getAccommodationAdditionalType(
  roomType: string | null | undefined
): "EntirePlace" | "PrivateRoom" | "SharedRoom" {
  const normalized = (roomType || "").toLowerCase();
  if (normalized.includes("shared")) return "SharedRoom";
  if (normalized.includes("private")) return "PrivateRoom";
  return "EntirePlace";
}

function hasMatchingAmenity(
  amenityNames: string[],
  matches: string[]
): boolean {
  return amenityNames.some((amenity) =>
    matches.some((match) => amenity.includes(match))
  );
}

function buildGoogleAmenityFeatures(
  amenityNames: string[],
  petsAllowed: boolean
) {
  const features: Array<{
    "@type": "LocationFeatureSpecification";
    name: string;
    value: boolean | string;
  }> = [];

  const addFeature = (name: string, value: boolean | string) => {
    if (features.some((feature) => feature.name === name)) return;
    features.push({
      "@type": "LocationFeatureSpecification",
      name,
      value,
    });
  };

  if (hasMatchingAmenity(amenityNames, ["air conditioning", " a/c", " ac"]))
    addFeature("ac", true);
  if (
    hasMatchingAmenity(amenityNames, [
      "family/kid friendly",
      "suitable for children",
      "high chair",
      "children",
    ])
  ) {
    addFeature("childFriendly", true);
  }
  if (hasMatchingAmenity(amenityNames, ["crib", "pack", "travel crib"]))
    addFeature("crib", true);
  if (hasMatchingAmenity(amenityNames, ["fireplace"]))
    addFeature("fireplace", true);
  if (hasMatchingAmenity(amenityNames, ["heating"]))
    addFeature("heating", true);
  if (hasMatchingAmenity(amenityNames, ["hot tub"])) addFeature("hotTub", true);
  if (hasMatchingAmenity(amenityNames, ["iron"]))
    addFeature("ironingBoard", true);
  if (hasMatchingAmenity(amenityNames, ["kitchen"]))
    addFeature("kitchen", true);
  if (hasMatchingAmenity(amenityNames, ["microwave"]))
    addFeature("microwave", true);
  if (hasMatchingAmenity(amenityNames, ["patio", "balcony", "deck"]))
    addFeature("patio", true);
  if (hasMatchingAmenity(amenityNames, ["tv"])) addFeature("tv", true);
  if (hasMatchingAmenity(amenityNames, ["washer", "dryer", "laundry"])) {
    addFeature("washerDryer", true);
  }
  if (
    hasMatchingAmenity(amenityNames, [
      "wifi",
      "wi-fi",
      "wireless internet",
      "internet",
    ])
  ) {
    addFeature("wifi", true);
    addFeature("internetType", "Free");
  }
  if (hasMatchingAmenity(amenityNames, ["parking", "garage", "carport"])) {
    addFeature("parkingType", "Free");
  }
  if (petsAllowed) addFeature("petsAllowed", true);

  return features;
}

const GOOGLE_BED_TYPE_MAP: Record<string, string> = {
  CALIFORNIA_KING_BED: "CaliforniaKing",
  KING_BED: "King",
  QUEEN_BED: "Queen",
  FULL_BED: "Full",
  DOUBLE_BED: "Double",
  SEMI_DOUBLE_BED: "SemiDouble",
  SINGLE_BED: "Single",
  SOFA_BED: "SofaBed",
  BUNK_BED: "BunkBed",
  AIR_MATTRESS: "AirMattress",
  FLOOR_MATTRESS: "FloorMattress",
  TODDLER_BED: "ToddlerBed",
  CRIB: "Crib",
};

function buildStructuredDataBedDetails(
  bedArrangements:
    | {
        bedrooms?: Array<{ beds?: Record<string, number> }>;
      }
    | null
    | undefined,
  totalBeds: number | null | undefined
) {
  const detailedBeds =
    bedArrangements?.bedrooms?.flatMap((room) =>
      Object.entries(room?.beds || {}).flatMap(([type, quantity]) => {
        const count = Number(quantity);
        if (!Number.isFinite(count) || count <= 0) return [];

        const bedDetails: {
          "@type": "BedDetails";
          numberOfBeds: number;
          typeOfBed?: string;
        } = {
          "@type": "BedDetails",
          numberOfBeds: count,
        };

        const mappedType = GOOGLE_BED_TYPE_MAP[type];
        if (mappedType) bedDetails.typeOfBed = mappedType;

        return [bedDetails];
      })
    ) || [];

  if (detailedBeds.length > 0) return detailedBeds;
  if (totalBeds && totalBeds > 0) {
    return [
      {
        "@type": "BedDetails" as const,
        numberOfBeds: totalBeds,
      },
    ];
  }

  return undefined;
}

/** Build a unique meta description from listing data instead of truncating Guesty text. */
function buildMetaDescription(
  listing: {
    bedrooms: number | null;
    accommodates: number | null;
    prices: { basePrice: number } | null;
    tags: string[] | null;
    amenities: string[] | null;
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  beapiListing: any
): string {
  const neighborhood = getNeighborhoodFromTags(listing.tags);
  const amenities = (beapiListing?.amenities || listing.amenities || []).map(
    (a: string) => a.toLowerCase()
  );

  // Build parts
  const parts: string[] = [];

  // Bedrooms + location
  const bedroomStr = listing.bedrooms ? `${listing.bedrooms}-bedroom` : "";
  const locationStr = neighborhood
    ? ` in ${neighborhood.name}`
    : " in Colorado";
  parts.push(`${bedroomStr || "Vacation"} rental${locationStr}.`);

  // Key amenities (pick the most compelling 2-3)
  const highlights: string[] = [];
  if (amenities.some((a: string) => a.includes("kitchen")))
    highlights.push("full kitchen");
  if (
    amenities.some((a: string) => a.includes("parking") || a.includes("garage"))
  )
    highlights.push("free parking");
  if (amenities.some((a: string) => a.includes("hot tub")))
    highlights.push("hot tub");
  if (
    amenities.some((a: string) => a.includes("washer") || a.includes("laundry"))
  )
    highlights.push("in-unit laundry");
  if (amenities.some((a: string) => a.includes("pet") || a.includes("dog")))
    highlights.push("pet-friendly");
  if (highlights.length > 0) {
    parts.push(
      highlights
        .slice(0, 3)
        .map((h) => h.charAt(0).toUpperCase() + h.slice(1))
        .join(", ") + "."
    );
  }

  // Capacity
  if (listing.accommodates) {
    parts.push(`Sleeps ${listing.accommodates}.`);
  }

  // Price
  if (listing.prices?.basePrice) {
    parts.push(`From $${Math.round(listing.prices.basePrice)}/night.`);
  }

  // CTA
  parts.push("Book direct and save.");

  // Join and trim to 160 chars
  let result = parts.join(" ");
  if (result.length > 160) {
    // Drop CTA first, then price
    result = parts.slice(0, -1).join(" ");
    if (result.length > 160) {
      result = parts.slice(0, -2).join(" ");
    }
    if (result.length > 160) {
      result = result.slice(0, 157) + "...";
    }
  }

  return result;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const listingId = extractIdFromSlug(id);
  const [listing, beapiListing] = await Promise.all([
    getListing(listingId).catch(() => null),
    getListingDetail(listingId).catch(() => null),
  ]);

  const b = beapiListing as Record<string, unknown> | null;
const fallbackListing = b ? {
  guesty_id: (b._id || b.id || id.split("-").pop()) as string,
  title: (b.title as string) || null,
  nickname: (b.nickname as string) || null,
  picture: ((b.pictures as Array<{original: string}>)?.[0]?.original) || null,
  bedrooms: (b.bedrooms as number) ?? null,
  accommodates: (b.accommodates as number) ?? null,
  prices: b.prices
    ? { basePrice: ((b.prices as Record<string, unknown>).basePrice as number) ?? 0 }
    : null,
  tags: (b.tags as string[]) ?? null,
  amenities: (b.amenities as string[]) ?? null,
} : null;
  if (!resolvedListing) return {};

  const listingName = resolvedListing.title || resolvedListing.nickname || "Vacation Rental";
  const title = `${listingName} — Colorado Vacation Rental`;
  const description = buildMetaDescription(resolvedListing, beapiListing);
  const slug = getListingSlug(
    resolvedListing.title || resolvedListing.nickname,
    resolvedListing.guesty_id
  );
  const url = `https://www.booktraverse.com/properties/${slug}`;

  const firstPhoto = beapiListing?.pictures?.[0]?.original || resolvedListing.picture;
  const ogImage = firstPhoto ? getPhotoUrl(firstPhoto, 1200) : undefined;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      images: ogImage
        ? [{ url: ogImage, width: 1200, height: 630 }]
        : undefined,
    },
    twitter: {
      title,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

export default async function PropertyDetailPage({
  params,
  searchParams,
}: Props) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const listingId = extractIdFromSlug(id);
  const [initialListing, beapiListing, reviewsData] = await Promise.all([
    getListing(listingId).catch(() => null),
    getListingDetail(listingId).catch(() => null),
    getListingReviews(listingId).catch(() => ({
      reviews: [],
      categoryAverages: {
        cleanliness: null,
        accuracy: null,
        checkin: null,
        communication: null,
        location: null,
        value: null,
      },
      totalCount: 0,
    })),
  ]);

  // Fallback: try matching by slugified title (handles old Guesty booking engine slugs)
  let listing = initialListing;
  if (!listing && beapiListing) {
    // Convert BEAPI response to Listing format for rendering
    const b = beapiListing as Record<string, unknown>;
    const addr = b.address as Record<string, unknown> | undefined;
    const prices = b.prices as Record<string, unknown> | undefined;
    listing = {
      id: 0,
      guesty_id: (b._id || b.id || id.split("-").pop()) as string,
      title: (b.title as string) || null,
      nickname: (b.nickname as string) || null,
      property_type: (b.propertyType as string) || null,
      room_type: (b.roomType as string) || null,
      bedrooms: (b.bedrooms as number) || null,
      bathrooms: (b.bathrooms as number) || null,
      beds: (b.beds as number) || null,
      accommodates: (b.accommodates as number) || null,
      area_square_feet: null,
      address: addr ? {
        lat: (addr.lat as number) || 0,
        lng: (addr.lng as number) || 0,
        city: (addr.city as string) || "",
        full: (addr.full as string) || "",
        state: (addr.state as string) || "",
        street: (addr.street as string) || "",
        country: (addr.country as string) || "",
        zipcode: (addr.zipcode as string) || "",
      } : null,
      prices: prices ? {
        currency: (prices.currency as string) || "USD",
        basePrice: (prices.basePrice as number) || 0,
        cleaningFee: (prices.cleaningFee as number) || null,
        extraPersonFee: (prices.extraPersonFee as number) || null,
        weeklyPriceFactor: (prices.weeklyPriceFactor as number) || null,
        monthlyPriceFactor: (prices.monthlyPriceFactor as number) || null,
        securityDepositFee: (prices.securityDepositFee as number) || null,
      } : null,
      active: true,
      is_listed: true,
      picture: ((b.pictures as Array<{original: string}>)?.[0]?.original) || null,
      picture_count: (b.pictures as unknown[])?.length || null,
      amenities: (b.amenities as string[]) || null,
      tags: (b.tags as string[]) || null,
      default_check_in_time: (b.defaultCheckInTime as string) || null,
      default_check_out_time: (b.defaultCheckOutTime as string) || null,
      terms: (b.terms as Record<string, unknown>) || null,
    } as typeof initialListing & Record<string, unknown>;
  }
  if (!listing) {
    listing = await getListingByTitleSlug(id).catch(() => null);
    if (listing) {
      // Redirect to canonical URL
      const canonicalSlug = getListingSlug(
        listing.title || listing.nickname,
        listing.guesty_id
      );
      permanentRedirect(`/properties/${canonicalSlug}`);
    }
  }

  if (!listing) notFound();

  // 308 redirect non-canonical URLs (bare ID or wrong slug) to the canonical slug URL
  const canonicalSlug = getListingSlug(
    listing.title || listing.nickname,
    listing.guesty_id
  );
  if (id !== canonicalSlug) {
    const qs = new URLSearchParams();
    if (sp.checkIn) qs.set("checkIn", sp.checkIn);
    if (sp.checkOut) qs.set("checkOut", sp.checkOut);
    if (sp.guests) qs.set("guests", sp.guests);
    if (sp.pointofsale) qs.set("pointofsale", sp.pointofsale);
    const qsStr = qs.toString();
    permanentRedirect(
      `/properties/${canonicalSlug}${qsStr ? `?${qsStr}` : ""}`
    );
  }

  // Photos from BEAPI or Supabase fallback
  let photos: { original: string; thumbnail: string; caption?: string }[] = [];
  if (beapiListing?.pictures?.length) {
    photos = beapiListing.pictures.map(
      (p: {
        original?: string;
        large?: string;
        regular?: string;
        thumbnail?: string;
        caption?: string;
      }) => ({
        original: p.original || p.large || p.regular || p.thumbnail || "",
        thumbnail: p.thumbnail || p.regular || p.original || "",
        caption: p.caption,
      })
    );
  } else if (listing.picture) {
    photos = [{ original: listing.picture, thumbnail: listing.picture }];
  }

  const description = beapiListing?.publicDescription || {};
  const amenities = beapiListing?.amenities || listing.amenities || [];
  const checkInTime =
    beapiListing?.defaultCheckInTime || listing.default_check_in_time;
  const checkOutTime =
    beapiListing?.defaultCheckOutTime || listing.default_check_out_time;
  const cancellationPolicy = beapiListing?.terms?.cancellation;
  const houseRules = beapiListing?.unitTypeHouseRules?.houseRules;
  // Compute displayRating from actual individual review scores for genuine
  // decimal precision. BEAPI's reviews.avg has 1-decimal precision on a 10-point
  // scale — dividing by 2 makes the second decimal always 0 or 5, looking fake.
  const ratedReviews = reviewsData.reviews.filter(
    (r) => r.overall_rating != null
  );
  const computedAvg =
    ratedReviews.length > 0
      ? ratedReviews.reduce((sum, r) => sum + r.overall_rating!, 0) /
        ratedReviews.length
      : null;
  const reviewAvg = clampReviewAvg(beapiListing?.reviews?.avg ?? null);
  const reviewTotal =
    reviewsData.totalCount || beapiListing?.reviews?.total || null;
  // Prefer computed average (already on 1-5 scale); fall back to BEAPI / 2
  const beapiRating = reviewAvg ? reviewAvg / 2 : null;
  const displayRating = computedAvg ?? beapiRating;
  const isRareFind = listing.occupancy_stats?.is_rare_find === true;

  const initialDateRange =
    sp.checkIn && sp.checkOut
      ? {
          from: new Date(sp.checkIn + "T12:00:00"),
          to: new Date(sp.checkOut + "T12:00:00"),
        }
      : undefined;
  const initialGuests = sp.guests ? Number(sp.guests) : undefined;

  // Neighborhood + similar listings
  const neighborhood = getNeighborhoodFromTags(listing.tags);
  const neighborhoodTag = getNeighborhoodTag(listing.tags);
  const similarListings = await getSimilarListings(
    listing.guesty_id,
    neighborhoodTag,
    listing.bedrooms
  ).catch(() => []);

  // Neighborhood context line for the description
  const neighborhoodContext = neighborhood
    ? `Located in ${neighborhood.name}${neighborhood.landmarks.length > 0 ? `, steps from ${neighborhood.landmarks.slice(0, 3).join(", ")}` : ""}.`
    : null;

  // JSON-LD structured data
  const slug = getListingSlug(
    listing.title || listing.nickname,
    listing.guesty_id
  );
  const amenityNames = amenities.map((a: string) => a.toLowerCase());
  const petsAllowed = amenityNames.some(
    (a: string) => a.includes("pet") || a.includes("dog")
  );
  const propertyUrl = `https://www.booktraverse.com/properties/${slug}`;
  const normalizedCheckInTime = normalizeStructuredDataTime(checkInTime);
  const normalizedCheckOutTime = normalizeStructuredDataTime(checkOutTime);
  const structuredDataDescription = beapiListing?.publicDescription?.summary
    ? beapiListing.publicDescription.summary
        .replace(
          /[\u2700-\u27BF\uE000-\uF8FF]|[\uD83C-\uDBFF][\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|\uD83E[\uDD00-\uDDFF\uDE00-\uDEFF]/g,
          ""
        )
        .trim()
    : undefined;
  const imageUrls = photos
    .map((photo) => getPhotoUrl(photo.original, 1200))
    .filter(Boolean);
  const latitude =
    typeof listing.address?.lat === "number" ? listing.address.lat : undefined;
  const longitude =
    typeof listing.address?.lng === "number" ? listing.address.lng : undefined;
  const googleAmenityFeatures = buildGoogleAmenityFeatures(
    amenityNames,
    petsAllowed
  );
  const bedDetails = buildStructuredDataBedDetails(
    beapiListing?.bedArrangements,
    listing.beds
  );

  // Floor size: only include if > 100 sqft (filters out bad data like "1")
  const validFloorSize =
    listing.area_square_feet && Number(listing.area_square_feet) > 100
      ? Number(listing.area_square_feet)
      : undefined;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "VacationRental",
    additionalType: getVacationRentalAdditionalType(
      beapiListing?.propertyType || listing.property_type
    ),
    "@id": `${propertyUrl}#rental`,
    identifier: listing.guesty_id || slug,
    name: listing.title || listing.nickname,
    url: propertyUrl,
    description: structuredDataDescription,
    image: imageUrls,
    brand: { "@type": "Brand", name: "Traverse Hospitality" },
    address: listing.address
      ? {
          "@type": "PostalAddress",
          streetAddress: listing.address.street,
          addressLocality: listing.address.city,
          addressRegion: listing.address.state,
          postalCode: listing.address.zipcode,
          addressCountry: toIsoCountryCode(listing.address.country),
        }
      : undefined,
    latitude,
    longitude,
    geo:
      latitude != null && longitude != null
        ? {
            "@type": "GeoCoordinates",
            latitude,
            longitude,
          }
        : undefined,
    containedInPlace: { "@type": "City", name: "Colorado" },
    // Google requires containsPlace with an Accommodation for VacationRental rich results
    containsPlace: {
      "@type": "Accommodation",
      additionalType: getAccommodationAdditionalType(
        beapiListing?.roomType || listing.room_type
      ),
      numberOfBedrooms: listing.bedrooms || undefined,
      numberOfBathroomsTotal: listing.bathrooms || undefined,
      bed: bedDetails,
      occupancy: {
        "@type": "QuantitativeValue",
        value: listing.accommodates || 2,
      },
      floorSize: validFloorSize
        ? {
            "@type": "QuantitativeValue",
            value: validFloorSize,
            unitCode: "FTK",
          }
        : undefined,
      amenityFeature:
        googleAmenityFeatures.length > 0 ? googleAmenityFeatures : undefined,
      petsAllowed,
    },
    numberOfBedrooms: listing.bedrooms || undefined,
    numberOfBathroomsTotal: listing.bathrooms || undefined,
    occupancy: {
      "@type": "QuantitativeValue",
      value: listing.accommodates || 2,
    },
    floorSize: validFloorSize
      ? {
          "@type": "QuantitativeValue",
          value: validFloorSize,
          unitCode: "FTK",
        }
      : undefined,
    petsAllowed,
    checkinTime: normalizedCheckInTime,
    checkoutTime: normalizedCheckOutTime,
    offers: listing.prices?.basePrice
      ? {
          "@type": "Offer",
          price: listing.prices.basePrice,
          priceCurrency: listing.prices.currency || "USD",
          unitCode: "DAY",
          availability: "https://schema.org/InStock",
          url: propertyUrl,
        }
      : undefined,
    ...(cancellationPolicy
      ? { cancellationPolicy: getCancellationText(cancellationPolicy) }
      : {}),
    // Aggregate rating: reviewAvg is on 0-10 scale from BEAPI, divide by 2 for 5-star schema
    ...(displayRating != null && reviewTotal
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: Math.min(5, Math.max(1, +displayRating!.toFixed(2))),
            reviewCount: reviewTotal,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
    // Individual reviews: overall_rating is already on 1-5 scale from Supabase — do NOT divide by 2
    // Only include reviews with all required fields to pass Google's Review snippet validation
    ...(() => {
      const validReviews = reviewsData.reviews
        .filter(
          (r) =>
            r.reviewer_name &&
            r.review_date &&
            r.public_review &&
            r.overall_rating
        )
        .slice(0, 10);
      return validReviews.length > 0
        ? {
            review: validReviews.map((r) => ({
              "@type": "Review",
              author: { "@type": "Person", name: r.reviewer_name },
              reviewRating: {
                "@type": "Rating",
                ratingValue: Math.min(5, Math.max(1, r.overall_rating!)),
                bestRating: 5,
                worstRating: 1,
              },
              datePublished: new Date(r.review_date!)
                .toISOString()
                .split("T")[0],
              reviewBody: r.public_review,
            })),
          }
        : {};
    })(),
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Traverse Hospitality",
        item: "https://www.booktraverse.com",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Properties",
        item: "https://www.booktraverse.com/properties",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: listing.title || listing.nickname,
        item: propertyUrl,
      },
    ],
  };

  // Generate property-specific FAQs
  const propertyName = listing.title || listing.nickname || "This property";
  const faqs = generatePropertyFaqs({
    propertyName,
    bedrooms: listing.bedrooms,
    bathrooms: listing.bathrooms,
    accommodates: listing.accommodates,
    petsAllowed,
    checkInTime: formatTime(checkInTime),
    checkOutTime: formatTime(checkOutTime),
    cancellationText: getCancellationText(cancellationPolicy),
    neighborhoodName: neighborhood?.name || null,
    hasKitchen: amenityNames.some((a: string) => a.includes("kitchen")),
    hasWifi: amenityNames.some(
      (a: string) => a.includes("wifi") || a.includes("wi-fi")
    ),
    hasParking: amenityNames.some(
      (a: string) => a.includes("parking") || a.includes("garage")
    ),
    hasWasherDryer: amenityNames.some(
      (a: string) => a.includes("washer") || a.includes("laundry")
    ),
  });

  const faqLd =
    faqs.length > 0
      ? {
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
        }
      : null;

  // Build internal links for "Browse More" section
  const browseMoreLinksAll: { href: string; label: string }[] = [];
  if (petsAllowed)
    browseMoreLinksAll.push({
      href: "/s/pet-friendly",
      label: "Pet-Friendly Stays",
    });
  if (listing.tags?.includes("Luxury Collection"))
    browseMoreLinksAll.push({ href: "/s/luxury", label: "Luxury Stays" });
  if (
    listing.tags?.includes("Group Getaways") ||
    (listing.accommodates && listing.accommodates >= 8)
  )
    browseMoreLinksAll.push({
      href: "/s/large-groups",
      label: "Large Group Stays",
    });
  if (listing.tags?.includes("Family Friendly"))
    browseMoreLinksAll.push({
      href: "/s/family-friendly",
      label: "Family-Friendly Stays",
    });
  if (listing.tags?.includes("Extended Stay"))
    browseMoreLinksAll.push({
      href: "/s/extended-stay",
      label: "Extended Stays",
    });
  if (neighborhood?.slug)
    browseMoreLinksAll.push({
      href: `/s/${neighborhood.slug}`,
      label: `More in ${neighborhood.name}`,
    });
  if (
    neighborhood?.quadrantSlug &&
    neighborhood.quadrantSlug !== neighborhood.slug
  )
    browseMoreLinksAll.push({
      href: `/s/${neighborhood.quadrantSlug}`,
      label: `More in ${neighborhood.quadrant}`,
    });
  if (amenityNames.some((a: string) => a.includes("hot tub")))
    browseMoreLinksAll.push({
      href: "/s/hot-tubs",
      label: "Homes with Hot Tubs",
    });
  if (amenityNames.some((a: string) => a.includes("fireplace")))
    browseMoreLinksAll.push({
      href: "/s/fireplace",
      label: "Homes with Fireplaces",
    });
  if (
    amenityNames.some(
      (a: string) => a.includes("parking") || a.includes("garage")
    )
  )
    browseMoreLinksAll.push({ href: "/s/free-parking", label: "Free Parking" });
  if (
    listing.bedrooms != null &&
    listing.bedrooms >= 0 &&
    listing.bedrooms <= 3
  )
    browseMoreLinksAll.push({
      href: `/s/${Math.max(1, listing.bedrooms)}-bedroom`,
      label: `${Math.max(1, listing.bedrooms)}-Bedroom Homes`,
    });
  else if (listing.bedrooms != null && listing.bedrooms >= 4)
    browseMoreLinksAll.push({
      href: "/s/4-bedroom-plus",
      label: "4+ Bedroom Homes",
    });
  // Deduplicate by href and limit to 6
  const browseMoreLinks = browseMoreLinksAll
    .filter((link, i, arr) => arr.findIndex((l) => l.href === link.href) === i)
    .slice(0, 6);

  return (
    <DateRangeProvider
      initialDateRange={initialDateRange}
      initialGuests={initialGuests}
    >
      {/* JSON-LD — content from our own database, not user input */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      {faqLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
        />
      )}
      <Suspense>
        <FloatingSearchBar compact desktopOnly />
      </Suspense>
      <StickyNav
        displayRating={displayRating}
        reviewTotal={reviewTotal}
        basePrice={listing.prices?.basePrice || 0}
      />
      <h1 className="sr-only">{listing.title || listing.nickname}</h1>
      <div className="mx-auto max-w-7xl px-4 pt-0 pb-24 sm:px-6 sm:py-5 lg:px-8 lg:pb-8">
        {/* Desktop: title above gallery */}
        <div className="hidden sm:flex mb-4 items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Colorado</p>
            <p className="mt-1 text-2xl font-bold text-foreground">
              {listing.title || listing.nickname}
            </p>
          </div>
          <div className="mt-2 flex shrink-0 items-center gap-4">
            <ShareButton
              title={listing.title || listing.nickname || "Vacation Rental"}
              description=""
              photo={photos[0]?.original || listing.picture}
              bedrooms={listing.bedrooms}
              beds={listing.beds}
              bathrooms={listing.bathrooms}
            />
            <WishlistButton listingId={listing.guesty_id} variant="text" />
          </div>
        </div>

        {/* Gallery: negative margins on mobile for edge-to-edge, normal on desktop */}
        <div id="photos" className="-mx-4 sm:mx-0">
          <PhotoGallery
            photos={photos}
            altPrefix={`${listing.title || listing.nickname || "Vacation rental"} in ${neighborhood?.name || "Colorado"}`}
            mobileActions={
              <>
                <ShareButton
                  title={listing.title || listing.nickname || "Vacation Rental"}
                  description=""
                  photo={photos[0]?.original || listing.picture}
                  bedrooms={listing.bedrooms}
                  beds={listing.beds}
                  bathrooms={listing.bathrooms}
                  variant="icon"
                />
                <WishlistButton listingId={listing.guesty_id} variant="icon" />
              </>
            }
          />
        </div>

        {/* Mobile: compact title block */}
        <div className="sm:hidden mt-2 px-1">
          <p className="text-lg font-bold text-foreground leading-snug text-center">
            {listing.title || listing.nickname}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground text-center">
            Colorado
          </p>
          <div className="mt-0.5 flex flex-wrap items-center justify-center gap-2.5 text-xs text-muted-foreground">
            {listing.accommodates && (
              <span className="inline-flex items-center gap-1">
                <Users className="h-3 w-3" />
                {listing.accommodates} guests
              </span>
            )}
            {(listing.bedrooms || listing.beds) && (
              <span className="inline-flex items-center gap-1">
                <Bed className="h-3 w-3" />
                {[
                  listing.bedrooms &&
                    listing.bedrooms > 0 &&
                    `${listing.bedrooms} ${listing.bedrooms === 1 ? "bedroom" : "bedrooms"}`,
                  listing.beds &&
                    `${listing.beds} ${listing.beds === 1 ? "bed" : "beds"}`,
                ]
                  .filter(Boolean)
                  .join(", ")}
              </span>
            )}
            {listing.bathrooms && (
              <span className="inline-flex items-center gap-1">
                <Bath className="h-3 w-3" />
                {listing.bathrooms}{" "}
                {Number(listing.bathrooms) === 1 ? "bath" : "baths"}
              </span>
            )}
          </div>

          {/* Rating row — Airbnb-style three columns on mobile */}
          {displayRating != null && reviewTotal ? (
            <div className="mt-4 flex items-center justify-center sm:hidden">
              <div className="flex items-center">
                {/* Rating */}
                <div className="flex flex-col items-center px-5">
                  <p className="text-base font-semibold text-foreground leading-tight tracking-tight">
                    {displayRating!.toFixed(2)}
                  </p>
                  <div className="flex items-center gap-px mt-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`h-[9px] w-[9px] ${i < Math.round(displayRating!) ? "fill-current text-foreground" : "fill-muted text-muted"}`}
                      />
                    ))}
                  </div>
                </div>

                {/* Traverse badge (center) — rose stems flanking tier text */}
                {displayRating! >= 4.8 ? (
                  <>
                    <div className="h-10 w-px bg-border" />
                    <div className="flex items-center gap-1 px-2">
                      {/* Left rose stem */}
                      <img
                        src={`/badges/rose-b-${displayRating! >= 4.95 ? "gold" : displayRating! >= 4.85 ? "silver" : "bronze"}-left.png`}
                        alt=""
                        className="h-[30px] w-auto shrink-0"
                        aria-hidden="true"
                      />
                      <span className="text-[13px] font-semibold text-foreground text-center leading-tight">
                        {displayRating! >= 4.95 ? (
                          <>
                            Colorado{"\u2019"}s<br />
                            Best
                          </>
                        ) : displayRating! >= 4.85 ? (
                          <>
                            Colorado
                            <br />
                            Favorite
                          </>
                        ) : (
                          <>
                            Guest
                            <br />
                            Approved
                          </>
                        )}
                      </span>
                      {/* Right rose stem */}
                      <img
                        src={`/badges/rose-b-${displayRating! >= 4.95 ? "gold" : displayRating! >= 4.85 ? "silver" : "bronze"}-right.png`}
                        alt=""
                        className="h-[30px] w-auto shrink-0"
                        aria-hidden="true"
                      />
                    </div>
                    <div className="h-10 w-px bg-border" />
                  </>
                ) : (
                  <div className="h-10 w-px bg-border" />
                )}

                {/* Reviews */}
                <div className="flex flex-col items-center px-5">
                  <p className="text-base font-semibold text-foreground leading-tight tracking-tight">
                    {reviewTotal}
                  </p>
                  <p className="mt-1 text-[9px] font-medium text-foreground">
                    Reviews
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Mobile: Rare find badge */}
        {isRareFind && (
          <div className="sm:hidden mt-3 mx-2">
            <RareFindBadge />
          </div>
        )}

        {/* Mobile price comparison — shown below title when dates produce a quote */}
        <MobilePriceComparison />

        <div className="mt-4 sm:mt-5 grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
          {/* Booking sidebar — desktop only */}
          <div id="booking-sidebar" className="hidden lg:block lg:order-last">
            <BookingSidebar
              listingId={listing.guesty_id}
              listingTitle={listing.title || listing.nickname || ""}
              basePrice={listing.prices?.basePrice || 0}
              pointofsale={sp.pointofsale}
              picture={listing.picture}
              isRareFind={isRareFind}
              cancellationPolicy={cancellationPolicy}
              reviewRating={displayRating ?? undefined}
              reviewCount={reviewTotal ?? undefined}
              bedrooms={listing.bedrooms ?? undefined}
              bathrooms={listing.bathrooms ?? undefined}
              accommodates={listing.accommodates ?? undefined}
              amenities={amenities}
              listingSlug={slug}
              city={
                listing.address?.city
                  ? `${listing.address.city}, ${listing.address?.state || "Oregon"}`
                  : undefined
              }
            />
          </div>

          {/* Main content */}
          <div className="lg:col-span-2">
            {/* Stats row — desktop only */}
            <div className="hidden sm:flex mt-3 flex-wrap items-center gap-5 text-base text-foreground">
              {listing.accommodates && (
                <span className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  {listing.accommodates} guests
                </span>
              )}
              {(listing.bedrooms || listing.beds) && (
                <span className="flex items-center gap-2">
                  <Bed className="h-5 w-5" />
                  {[
                    listing.bedrooms &&
                      listing.bedrooms > 0 &&
                      `${listing.bedrooms} ${listing.bedrooms === 1 ? "bedroom" : "bedrooms"}`,
                    listing.beds &&
                      `${listing.beds} ${listing.beds === 1 ? "bed" : "beds"}`,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </span>
              )}
              {listing.bathrooms && (
                <span className="flex items-center gap-2">
                  <Bath className="h-5 w-5" />
                  {listing.bathrooms}{" "}
                  {Number(listing.bathrooms) === 1 ? "bathroom" : "bathrooms"}
                </span>
              )}
              {listing.area_square_feet &&
                Number(listing.area_square_feet) > 100 && (
                  <span className="flex items-center gap-2">
                    <Maximize className="h-5 w-5" />
                    {Math.round(
                      Number(listing.area_square_feet)
                    ).toLocaleString()}{" "}
                    sqft
                  </span>
                )}
            </div>
            {/* Traverse callout card (desktop) — Airbnb-style */}
            {displayRating && reviewTotal && displayRating >= 4.8 ? (
              <div className="mt-4 hidden sm:flex items-center rounded-xl border border-border p-4 gap-4">
                {/* Rose stems + tier text */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <img
                    src={`/badges/rose-b-${displayRating >= 4.95 ? "gold" : displayRating >= 4.85 ? "silver" : "bronze"}-left.png`}
                    alt=""
                    className="h-10 w-auto shrink-0"
                    aria-hidden="true"
                  />
                  <span className="text-base font-semibold text-foreground text-center leading-tight">
                    {displayRating >= 4.95
                      ? "Top Rated"
                      : displayRating >= 4.85
                        ? "Traverse Favorite"
                        : "Guest Approved"}
                  </span>
                  <img
                    src={`/badges/rose-b-${displayRating >= 4.95 ? "gold" : displayRating >= 4.85 ? "silver" : "bronze"}-right.png`}
                    alt=""
                    className="h-10 w-auto shrink-0"
                    aria-hidden="true"
                  />
                </div>
                {/* Description */}
                <p className="text-sm text-muted-foreground flex-1">
                  {displayRating >= 4.95
                    ? "One of the highest-rated stays in Colorado, according to guests."
                    : displayRating >= 4.85
                      ? "One of the most loved homes in Colorado, according to guests."
                      : "Well-reviewed by guests — consistently rated above average."}
                </p>
                {/* Rating + Reviews */}
                <div className="flex items-center gap-4 pl-4 border-l border-border shrink-0">
                  <div className="text-center">
                    <p className="text-lg font-semibold text-foreground">
                      {displayRating.toFixed(2)}
                    </p>
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`h-2.5 w-2.5 ${i < Math.round(displayRating) ? "fill-current text-foreground" : "fill-muted text-muted"}`}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="h-10 w-px bg-border" />
                  <div className="text-center">
                    <p className="text-lg font-semibold text-foreground">
                      {reviewTotal}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {reviewTotal === 1 ? "Review" : "Reviews"}
                    </p>
                  </div>
                </div>
              </div>
            ) : displayRating && reviewTotal ? (
              <div className="hidden sm:flex mt-3 items-center gap-2 text-base text-foreground">
                <Star className="h-4 w-4 fill-current text-foreground" />
                <span className="font-semibold">
                  {displayRating.toFixed(2)}
                </span>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">
                  {reviewTotal} {reviewTotal === 1 ? "review" : "reviews"}
                </span>
              </div>
            ) : null}

            <Separator className="my-6" />

            {/* Property highlights */}
            {(() => {
              const highlights: {
                icon: React.ReactNode;
                title: string;
                desc: string;
              }[] = [];

              // Traverse Favorite highlight
              if (displayRating && displayRating >= 4.8) {
                const tierTitle =
                  displayRating >= 4.95
                    ? "Top Rated"
                    : displayRating >= 4.85
                      ? "Traverse Favorite"
                      : "Guest Approved";
                const tierIcon =
                  displayRating >= 4.95 ? (
                    <img
                      src="/badges/bridge.png"
                      alt=""
                      className="h-5 w-5"
                      aria-hidden="true"
                    />
                  ) : displayRating >= 4.85 ? (
                    <svg
                      viewBox="0 0 128 128"
                      className="h-5 w-5"
                      aria-hidden="true"
                    >
                      <path
                        fill="#307D31"
                        d="M56.81,85.29l21.86,0.17c0,0-1.74,5.65-3.18,7.87c-2.35,3.6-3.52,5.44-4.52,9.13c-1.55,5.68-1.42,10.05-1.42,10.05s1.21-0.42,2.68,0c1.79,0.51,2.76,1.7,2.6,2.43c-0.15,0.65-2.14,0.21-3.52,1.59c-1.09,1.09-1.51,3.02-1.68,4.27c-0.17,1.26-0.34,2.85-2.68,3.18c-2.35,0.34-5.86,0.59-6.62-0.59c-0.75-1.17-0.34-21.61-0.34-21.61L56.81,85.29z"
                      />
                      <path
                        fill="#5C9823"
                        d="M56.56,80.76c-0.42,0.75-10.32,2.53-10.32,2.53s-3.31,1.77-4.56,7.55c-0.68,3.13-0.53,9.47-1.12,11.69c-0.84,3.18-4.36,5.03-4.19,5.78c0.17,0.75,3.24,0.7,5.61-0.34c5.36-2.35,6.3-7.21,8.04-11.39c1.68-4.02,4.86-6.13,4.86-6.13s-0.75,2.92-0.43,6.14c0.27,2.77,1.14,6.3,0,9.73c-1.09,3.27-2.62,5.24-2.01,5.54c0.46,0.22,5.92-0.33,8.1-5.11c2.41-5.28,2.58-9.61,4.02-12.71c1.59-3.43,4.62-4.89,4.62-4.89s2.15,1.26,4.78,4.94c2.93,4.1,5.38,7.55,6.96,9.67c3.7,4.98,8.83,6.55,8.99,5.71c0.25-1.34-2.47-3.49-3.02-6.11c-1.35-6.45,0.5-9.54-1.03-14.49c-2.2-7.15-7.39-7.28-9.19-7.62C76.25,81.19,56.56,80.76,56.56,80.76z"
                      />
                      <path
                        fill="#96010C"
                        d="M47.31,44.34c-1.13-1.01-17.87-13.21-17.87-13.21l-0.25-7.42c0,0-4.1-7.75,0.62-13.52c4.1-5.01,9.57-3.59,9.57-3.59s2.74-3.45,7.52-3.69c6.11-0.31,9.09,4.83,9.09,4.83l27.55,4.53l15.47,10.06c0,0,2.29-0.74,4.19,0.6c1.98,1.39,1.33,4.31,1.11,5.62c-0.21,1.25-20.65,17.56-20.65,17.56l2.14,31.96l-7.14,7.97c0,0-1,0.98-3.05,1.24c-1.19,0.15-2.72-0.33-2.72-0.33l-4.45-12.78L47.31,44.34z"
                      />
                      <path
                        fill="#AF0C1B"
                        d="M83.15,6.86l-3.72,0.28l-2.61,2.19l0.93,4.21c0,0,0.12,3.15-2.36,4.66c-2.48,1.51-7.35,3.99-7.35,3.99l-3.36,5.56c0,0-2.16-0.71-5.68-2.52c-3.29-1.7-7.5-5.58-7.5-5.58l-7.53-0.51c0,0-1.44-0.13-2.65,1.15c-1.74,1.86-1.12,5.8,2.29,9.41c3.28,3.47,10.38,7.7,11.96,8.87c1.58,1.17,3.99,2.67,5.36,3.44c1.32,0.74,2.9,1.8,3.59,1.67c0.69-0.14,1.71-2.49,4.94-4.76c3.23-2.27,6.39-4.19,11.55-5.98c5.16-1.79,10.11-3.85,11.62-4.81c1.51-0.96-0.55-7.49-2.41-11.48S83.28,6.45,83.15,6.86z"
                      />
                      <path
                        fill="#DB132C"
                        d="M65.07,23.98c-1.27,1.68-1.03,3.64-1.03,3.64s2.77,1.66,5.5,2.61c4.95,1.72,16.09,1.24,21.45-1.17s7.98-4.49,8.8-7.01c0.96-2.96,1.76-8.94-4-13.55c-6.6-5.29-16.56-2.4-16.56-1.02s3.99,0.28,3.99,5.29s-4.4,8.04-8.87,8.66C69.88,22.05,66.99,21.43,65.07,23.98z"
                      />
                      <path
                        fill="#F71538"
                        d="M42.24,19.65c0,0-0.51-2.02,1.17-3.64c2.54-2.48,5.78-3.78,7.63-5.78s4.48-5.79,10.93-6.67c9.56-1.31,15.74,2.27,17.12,6.67s-1.24,5.91-3.92,5.98c-2.68,0.07-4.17-1.19-9.08-0.34c-8.32,1.44-11.21,5.91-11.96,6.33c-0.76,0.41-3.23-1.03-6.6-1.93C45.1,19.62,43.34,19.78,42.24,19.65z"
                      />
                      <path
                        fill="#CD0E1F"
                        d="M69.62,48.38c0,0,1.7-5.65,7.25-9.23c5.56-3.58,9.61-3.67,16.68-6.88s9.51-5.32,10.64-6.06c1.16-0.76,2.21-1.45,3.02-0.12c0.52,0.86-0.38,4.38-2.77,7.8c-2.44,3.49-4.84,5.41-6.66,11.42c-2.41,7.93,2.22,15.14-2.72,27.88c-1.6,4.12-5.35,7.89-8.84,10.34c-3.49,2.45-8.52,3-8.52,3s1.79-1.25,2.77-5.85c0.48-2.26,1.2-6.27,0.65-10.54C79.55,57.93,69.62,48.38,69.62,48.38z"
                      />
                      <path
                        fill="#E2122D"
                        d="M31.74,46.68c0.12,2.68-1.14,12.43,0.49,20.26c1.28,6.16,7.62,17.05,19.49,20.25c10.92,2.95,22.61-0.09,22.61-0.09s4.41-7.45,2.18-18.31c-2.43-11.84-14.26-20.64-27.9-27.38c-16.39-8.1-19.36-17.86-19.36-17.86s-5.39-1.41-6.74,3.44C20.44,34.43,31.56,42.63,31.74,46.68z"
                      />
                    </svg>
                  ) : (
                    <img
                      src="/badges/fir.png"
                      alt=""
                      className="h-5 w-5"
                      aria-hidden="true"
                    />
                  );
                highlights.push({
                  icon: tierIcon,
                  title: tierTitle,
                  desc:
                    displayRating >= 4.95
                      ? "Guests love this place. One of the highest-rated stays in Colorado."
                      : displayRating >= 4.85
                        ? "A guest favorite for comfort, location, and overall experience."
                        : "Well-reviewed by guests — consistently rated above average.",
                });
              }

              // Rare find
              if (isRareFind) {
                highlights.push({
                  icon: (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      className="h-5 w-5"
                      aria-hidden="true"
                    >
                      <path
                        d="M12 1l2.5 7.5L22 12l-7.5 2.5L12 23l-2.5-8.5L2 12l7.5-2.5z"
                        fill="#f2c070"
                      />
                      <path
                        d="M12 6l1.2 3.8L17 12l-3.8 1.2L12 18l-1.2-4.8L7 12l3.8-1.2z"
                        fill="#fff"
                        opacity="0.45"
                      />
                    </svg>
                  ),
                  title: "Rare find",
                  desc: "This place is usually booked. It's been reserved for most of the past year.",
                });
              }

              // Self check-in
              highlights.push({
                icon: <DoorOpen className="h-5 w-5 text-foreground" />,
                title: "Self check-in",
                desc: "Check yourself in with the smart lock.",
              });

              // Flexible check-in & out
              if (checkInTime || checkOutTime) {
                highlights.push({
                  icon: <KeyRound className="h-5 w-5 text-foreground" />,
                  title: "Flexible check-in & out",
                  desc: [
                    checkInTime && `Check-in after ${formatTime(checkInTime)}`,
                    checkOutTime &&
                      `Check-out before ${formatTime(checkOutTime)}`,
                  ]
                    .filter(Boolean)
                    .join(" · "),
                });
              }

              // Pet friendly
              if (
                amenities.some(
                  (a: string) =>
                    a.toLowerCase().includes("pet") ||
                    a.toLowerCase().includes("dog")
                )
              ) {
                highlights.push({
                  icon: <PawPrint className="h-5 w-5 text-foreground" />,
                  title: "Pet friendly",
                  desc: "Bring your furry friends along for the trip.",
                });
              }

              // Cancellation policy
              if (cancellationPolicy) {
                highlights.push({
                  icon: <Shield className="h-5 w-5 text-foreground" />,
                  title: getCancellationTitle(cancellationPolicy),
                  desc: getCancellationText(cancellationPolicy),
                });
              }

              if (highlights.length === 0) return null;

              return (
                <>
                  <div className="space-y-1">
                    {highlights.map((h, i) => (
                      <div
                        key={i}
                        className={`flex items-start gap-4 py-4 ${i < highlights.length - 1 ? "border-b border-border" : ""}`}
                      >
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted">
                          {h.icon}
                        </div>
                        <div className="min-w-0 pt-0.5">
                          <h3 className="text-[15px] font-semibold text-foreground leading-snug">
                            {h.title}
                          </h3>
                          <p className="mt-0.5 text-sm text-muted-foreground leading-relaxed">
                            {h.desc}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Separator className="my-6" />
                </>
              );
            })()}

            {/* About this property */}
            {description.summary && (
              <>
                <PropertyDescription
                  summary={description.summary}
                  space={description.space}
                  neighborhoodContext={neighborhoodContext || undefined}
                />
                <Separator className="my-6" />
              </>
            )}

            {/* Inline chat CTA — mobile only, right after description */}
            <InlineChatCta
              listingId={listing.guesty_id}
              listingTitle={listing.title || listing.nickname || ""}
            />
            <Separator className="my-6 lg:hidden" />

            {/* Mobile: Reviews section (between description and sleep) */}
            <div className="sm:hidden">
              <div id="reviews-mobile">
                <ReviewsSection
                  reviews={reviewsData.reviews}
                  categoryAverages={reviewsData.categoryAverages}
                  totalCount={reviewsData.totalCount}
                  displayRating={displayRating}
                  summary={listing.review_summary}
                />
              </div>
              <Separator className="my-6" />
            </div>

            {/* Where you'll sleep */}
            {beapiListing?.bedArrangements?.bedrooms?.length > 0 && (
              <>
                <WhereYoullSleep
                  bedArrangements={beapiListing.bedArrangements}
                />
                <Separator className="my-6" />
              </>
            )}

            {/* Amenities */}
            {amenities.length > 0 && (
              <div id="amenities">
                <h2 className="mb-4 text-xl font-semibold">
                  What this place offers
                </h2>
                <AmenitiesGrid amenities={amenities} />
                <Separator className="my-6" />
              </div>
            )}

            {/* The Neighborhood */}
            {neighborhood && (
              <>
                <NeighborhoodSection neighborhood={neighborhood} />
                <Separator className="my-6" />
              </>
            )}

            {/* Availability Calendar — desktop only (mobile has calendar in booking sidebar) */}
            <div id="availability-calendar" className="hidden lg:block">
              <AvailabilityCalendar listingId={listing.guesty_id} />
            </div>
          </div>
        </div>

        {/* Full-width sections below the grid (sidebar doesn't extend here) */}

        {/* Reviews — desktop only (mobile shows above "Where you'll sleep") */}
        <Separator className="my-6 hidden sm:block" />
        <div id="reviews" className="hidden sm:block">
          <ReviewsSection
            reviews={reviewsData.reviews}
            categoryAverages={reviewsData.categoryAverages}
            totalCount={reviewsData.totalCount}
            displayRating={displayRating}
            summary={listing.review_summary}
          />
        </div>

        {/* Where you'll be */}
        {listing.address && (
          <div id="location">
            <Separator className="my-6" />
            <WhereYoullBe
              lat={listing.address.lat}
              lng={listing.address.lng}
              listingId={listing.guesty_id}
              city={listing.address.city}
              state={listing.address.state}
              country={listing.address.country}
              neighborhood={description.neighborhood || ""}
              transit={description.transit || ""}
              nearbyPois={
                listing.address.lat && listing.address.lng
                  ? getNearbyPois(listing.address.lat, listing.address.lng)
                  : undefined
              }
            />
          </div>
        )}
        {/* Availability Calendar — mobile only (1 month) */}
        <div className="block lg:hidden">
          <Separator className="my-6" />
          <AvailabilityCalendar
            listingId={listing.guesty_id}
            numberOfMonths={1}
          />
        </div>

        {/* Things to know */}
        <Separator className="my-8" />
        <div id="policies" className="pb-4">
          <h2 className="text-xl font-semibold text-foreground">
            Things to know
          </h2>
          <div className="mt-6 grid grid-cols-1 gap-8 sm:grid-cols-3">
            <div>
              <CalendarX2 className="h-6 w-6 text-foreground mb-3" />
              <h3 className="font-medium text-foreground">
                Cancellation policy
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {cancellationPolicy
                  ? getCancellationText(cancellationPolicy)
                  : "Free cancellation up to 48 hours before check-in. After that, the reservation is non-refundable."}
              </p>
              <Link
                href="/cancellation"
                className="mt-2 inline-block text-sm underline text-foreground hover:text-muted-foreground"
              >
                Learn more
              </Link>
            </div>
            <div>
              <KeyRound className="h-6 w-6 text-foreground mb-3" />
              <h3 className="font-medium text-foreground">House rules</h3>
              <div className="mt-1 space-y-0.5 text-sm text-muted-foreground">
                {checkInTime && <p>Check-in after {formatTime(checkInTime)}</p>}
                {checkOutTime && (
                  <p>Checkout before {formatTime(checkOutTime)}</p>
                )}
                {listing.accommodates && (
                  <p>{listing.accommodates} guests maximum</p>
                )}
                {houseRules?.smokingAllowed?.enabled === false && (
                  <p>No smoking</p>
                )}
                {houseRules?.suitableForEvents?.enabled === false && (
                  <p>No parties or events</p>
                )}
                {houseRules?.petsAllowed?.enabled ? (
                  <p>Pets allowed</p>
                ) : houseRules?.petsAllowed?.enabled === false ? (
                  <p>No pets</p>
                ) : null}
                {houseRules?.quietBetween?.enabled &&
                  houseRules.quietBetween.hours && (
                    <p>
                      Quiet hours{" "}
                      {formatTime(houseRules.quietBetween.hours.start)}–
                      {formatTime(houseRules.quietBetween.hours.end)}
                    </p>
                  )}
              </div>
            </div>
            <div>
              <ShieldCheck className="h-6 w-6 text-foreground mb-3" />
              <h3 className="font-medium text-foreground">Safety & property</h3>
              <div className="mt-1 space-y-0.5 text-sm text-muted-foreground">
                {amenities.some((a: string) =>
                  a.toLowerCase().includes("carbon monoxide")
                ) && <p>Carbon monoxide alarm</p>}
                {amenities.some(
                  (a: string) =>
                    a.toLowerCase().includes("smoke detector") ||
                    a.toLowerCase().includes("smoke alarm")
                ) && <p>Smoke alarm</p>}
                {!amenities.some(
                  (a: string) =>
                    a.toLowerCase().includes("carbon monoxide") ||
                    a.toLowerCase().includes("smoke detector") ||
                    a.toLowerCase().includes("smoke alarm")
                ) && <p>Safety devices installed</p>}
              </div>
            </div>
          </div>
        </div>

        {/* Similar Properties */}
        {similarListings.length > 0 && (
          <>
            <Separator className="my-8" />
            <SimilarProperties
              listings={similarListings}
              neighborhoodName={neighborhood?.name || "Colorado"}
            />
          </>
        )}

        {/* Browse More — internal links to landing pages */}
        {browseMoreLinks.length >= 2 && (
          <>
            <Separator className="my-8" />
            <div>
              <h2 className="text-xl font-semibold text-foreground">
                Browse More Colorado Stays
              </h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {browseMoreLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="rounded-full border border-border bg-muted/50 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}

        {/* FAQ */}
        {faqs.length > 0 && (
          <>
            <Separator className="my-8" />
            <PropertyFaq faqs={faqs} />
          </>
        )}
      </div>

      <TrackViewedListing
        id={listing.guesty_id}
        title={listing.title || listing.nickname || ""}
        propertyType={listing.property_type ?? undefined}
        city={listing.address?.city}
        basePrice={listing.prices?.basePrice}
        bedrooms={listing.bedrooms ?? undefined}
        bathrooms={listing.bathrooms ? Number(listing.bathrooms) : undefined}
        imageUrl={photos[0]?.original}
      />

      {/* Mobile sticky bottom bar + calendar modal */}
      <MobileBottomBar
        listingId={listing.guesty_id}
        listingTitle={listing.title || listing.nickname || ""}
        basePrice={listing.prices?.basePrice || 0}
        pointofsale={sp.pointofsale}
        picture={listing.picture}
        maxGuests={listing.accommodates || undefined}
        cancellationPolicy={cancellationPolicy}
        reviewRating={displayRating ?? undefined}
        reviewCount={reviewTotal ?? undefined}
      />
    </DateRangeProvider>
  );
}
