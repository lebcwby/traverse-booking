import { getListing, type Listing } from "@/lib/supabase";
import { getListingDetail } from "@/lib/guesty-beapi";
import { clampReviewAvg } from "@/lib/utils";

export interface BeapiListingPhoto {
  original?: string;
  large?: string;
  regular?: string;
  thumbnail?: string;
}

export interface BeapiListingResult {
  _id: string;
  nickname?: string | null;
  title?: string | null;
  propertyType?: string | null;
  roomType?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  beds?: number | null;
  accommodates?: number | null;
  address?: {
    lat: number;
    lng: number;
    city?: string;
    full?: string;
    state?: string;
    street?: string;
    country?: string;
    zipcode?: string;
  } | null;
  prices?: {
    currency?: string;
    basePrice?: number;
    cleaningFee?: number | null;
    extraPersonFee?: number | null;
    weeklyPriceFactor?: number | null;
    monthlyPriceFactor?: number | null;
  } | null;
  picture?: string | BeapiListingPhoto | null;
  pictures?: Array<string | BeapiListingPhoto> | null;
  amenities?: string[] | null;
  tags?: string[] | null;
  defaultCheckInTime?: string | null;
  defaultCheckOutTime?: string | null;
  terms?: Record<string, unknown> | null;
  nightlyRates?: Record<string, number> | null;
  reviews?: {
    avg?: number | null;
    total?: number | null;
  } | null;
}

export function mapBeapiToListing(r: BeapiListingResult): Listing {
  const primaryPicture =
    typeof r.picture === "string"
      ? r.picture
      : r.picture?.original ||
        r.picture?.regular ||
        (typeof r.pictures?.[0] === "string"
          ? r.pictures[0]
          : r.pictures?.[0]?.original || r.pictures?.[0]?.regular) ||
        null;

  // Compute total from nightlyRates (BEAPI search doesn't return cleaning/taxes)
  let totalPrice: number | null = null;
  let nightCount: number | null = null;
  if (r.nightlyRates && typeof r.nightlyRates === "object") {
    const rates = Object.values(r.nightlyRates) as number[];
    if (rates.length > 0) {
      totalPrice = rates.reduce((sum, rate) => sum + rate, 0);
      nightCount = rates.length;
    }
  }

  return {
    id: 0,
    guesty_id: r._id,
    nickname: r.nickname || null,
    title: r.title || null,
    property_type: r.propertyType || null,
    room_type: r.roomType || null,
    bedrooms: r.bedrooms ?? null,
    bathrooms: r.bathrooms ?? null,
    beds: r.beds ?? null,
    accommodates: r.accommodates ?? null,
    area_square_feet: null,
    address: r.address
      ? {
          lat: r.address.lat,
          lng: r.address.lng,
          city: r.address.city || "",
          full: r.address.full || "",
          state: r.address.state || "",
          street: r.address.street || "",
          country: r.address.country || "",
          zipcode: r.address.zipcode || "",
        }
      : null,
    prices:
      r.prices?.basePrice != null
        ? {
            currency: r.prices.currency || "USD",
            basePrice: r.prices.basePrice,
            cleaningFee: r.prices.cleaningFee ?? null,
            extraPersonFee: r.prices.extraPersonFee ?? null,
            weeklyPriceFactor: r.prices.weeklyPriceFactor ?? null,
            monthlyPriceFactor: r.prices.monthlyPriceFactor ?? null,
            securityDepositFee: null,
          }
        : null,
    active: true,
    is_listed: true,
    picture: primaryPicture,
    pictures: r.pictures?.length
      ? r.pictures
          .slice(0, 8)
          .map(
            (
              p:
                | string
                | {
                    original?: string;
                    large?: string;
                    regular?: string;
                    thumbnail?: string;
                  }
            ) =>
              typeof p === "string"
                ? p
                : p.original || p.large || p.regular || p.thumbnail || ""
          )
          .filter(Boolean)
      : null,
    picture_count: r.pictures?.length ?? null,
    amenities: r.amenities || null,
    tags: r.tags || null,
    default_check_in_time: r.defaultCheckInTime || null,
    default_check_out_time: r.defaultCheckOutTime || null,
    terms: r.terms || null,
    totalPrice,
    nightCount,
    reviewAvg: clampReviewAvg(r.reviews?.avg ?? null),
    reviewTotal: r.reviews?.total ?? null,
  };
}

/**
 * Resolves a listing by Guesty ID.
 *
 * Tries Supabase first (fast, cheap). If the row isn't there yet — e.g.
 * the sync-listings edge function has never run — falls back to a live
 * BEAPI call and converts the response to the same Listing shape.
 *
 * This keeps item_variant populated in GA4 ecommerce events even before
 * the Supabase listings table is seeded.
 */
export async function getListingWithBeapiFallback(
  listingId: string
): Promise<Listing | null> {
  try {
    const row = await getListing(listingId);
    if (row) return row;
  } catch {
    // Supabase miss — fall through to BEAPI
  }
  try {
    const beapiData = await getListingDetail(listingId);
    return mapBeapiToListing(beapiData as BeapiListingResult);
  } catch {
    return null;
  }
}
