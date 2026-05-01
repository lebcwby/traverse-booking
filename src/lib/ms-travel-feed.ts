/**
 * Microsoft Advertising Travel Center property feed builder.
 *
 * Emits the XML schema expected by Microsoft's Travel Center for Property
 * Promotion Ads. One <listing> element per live BookTraverse property.
 */

import type { Listing } from "@/lib/supabase";

interface GuestyPublicDescription {
  summary?: string;
  space?: string;
  neighborhood?: string;
  notes?: string;
  access?: string;
  transit?: string;
  interactionWithGuests?: string;
  houseRules?: string;
}

interface GuestyPicture {
  _id?: string;
  caption?: string;
  original?: string;
  thumbnail?: string;
}

interface GuestyRaw {
  propertyType?: string;
  roomType?: string;
  accommodates?: number;
  bedrooms?: number;
  bathrooms?: number;
  beds?: number;
  areaSquareFeet?: number;
  amenities?: string[];
  publicDescription?: GuestyPublicDescription;
  pictures?: GuestyPicture[];
  defaultCheckInTime?: string;
  defaultCheckOutTime?: string;
  terms?: {
    minNights?: number;
    maxNights?: number;
  };
}

export interface FeedListing extends Listing {
  contact_phone?: string | null;
  computed_review_avg?: number | null;
  computed_review_count?: number | null;
  raw?: GuestyRaw | null;
}

export interface FeedReview {
  listing_guesty_id: string;
  author: string;
  body: string;
  rating: number;
  reviewed_at: string;
}

const SITE = "https://www.booktraverse.com";
const MAX_PHOTOS = 6;
const MAX_REVIEWS_PER_LISTING = 2;
const MAX_BODY_CHARS = 900;

const PROPERTY_TYPE_TO_CATEGORY: Record<string, string> = {
  House: "vacation_rental|house",
  Apartment: "vacation_rental|apartment",
  Studio: "vacation_rental|apartment",
  Townhouse: "vacation_rental|townhouse",
  "Tiny house": "vacation_rental|cottage",
  "Guest suite": "vacation_rental|apartment",
  Loft: "vacation_rental|apartment",
  Cottage: "vacation_rental|cottage",
  Cabin: "vacation_rental|cabin",
  Villa: "vacation_rental|villa",
  Bungalow: "vacation_rental|cottage",
  Condominium: "vacation_rental|apartment",
};

const KNOWN_NEIGHBORHOOD_TAGS = new Set([
  "Alberta",
  "Hawthorne Belmont",
  "Pearl District",
  "Mississippi",
  "NW 23rd",
  "Downtown",
  "Sellwood",
  "Division",
  "Hollywood",
  "Laurelhurst",
  "Irvington",
  "Kerns",
  "Buckman",
  "Woodstock",
  "Montavilla",
  "St. Johns",
  "Overlook",
  "Kenton",
  "Foster Powell",
  "Goose Hollow",
  "Old Town",
  "Boise",
  "Richmond",
  "Eliot",
  "Slabtown",
  "Northwest District",
  "Mt. Tabor",
]);

const AMENITY_TO_ATTR: Record<string, { name: string; value: string }> = {
  wifi: { name: "wifi_type", value: "Free" },
  "free wifi": { name: "wifi_type", value: "Free" },
  internet: { name: "wifi_type", value: "Free" },
  kitchen: { name: "kitchen", value: "Yes" },
  "full kitchen": { name: "kitchen", value: "Yes" },
  heating: { name: "heating", value: "Yes" },
  "air conditioning": { name: "air_conditioned", value: "Yes" },
  ac: { name: "air_conditioned", value: "Yes" },
  washer: { name: "washer_dryer", value: "Yes" },
  dryer: { name: "washer_dryer", value: "Yes" },
  tv: { name: "tv", value: "Yes" },
  microwave: { name: "microwave", value: "Yes" },
  oven: { name: "oven_stove", value: "Yes" },
  stove: { name: "oven_stove", value: "Yes" },
  "free parking": { name: "parking_type", value: "Free" },
  "free parking on premises": { name: "parking_type", value: "Free" },
  "paid parking": { name: "parking_type", value: "Paid" },
  "pets allowed": { name: "pets_allowed", value: "Yes" },
  "pets live on this property": { name: "pets_allowed", value: "Yes" },
  patio: { name: "patio", value: "Yes" },
  balcony: { name: "balcony", value: "Yes" },
  "outdoor grill": { name: "outdoor_grill", value: "Yes" },
  bbq: { name: "outdoor_grill", value: "Yes" },
  fireplace: { name: "fire_place", value: "Yes" },
  "indoor fireplace": { name: "fire_place", value: "Yes" },
  elevator: { name: "elevator", value: "Yes" },
  "hot tub": { name: "hot_tub", value: "Yes" },
  "gym / fitness center": { name: "fitness_equipment", value: "Yes" },
  gym: { name: "fitness_equipment", value: "Yes" },
  "wheelchair accessible": { name: "wheelchair_accessible", value: "Yes" },
  "step-free access": { name: "wheelchair_accessible", value: "Yes" },
  crib: { name: "crib", value: "Yes" },
  "pack n play/travel crib": { name: "crib", value: "Yes" },
  iron: { name: "ironing_board", value: "Yes" },
  "smoke alarm": { name: "smoke_free_property", value: "Yes" },
};

/** XML-safe escape for text content. */
export function xmlEscape(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function stripControlChars(s: string): string {
  return s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
}

function clean(text: string | null | undefined, max = 2000): string {
  if (!text) return "";
  const trimmed = stripControlChars(text).replace(/\s+/g, " ").trim();
  return trimmed.length > max ? trimmed.slice(0, max - 1) + "…" : trimmed;
}

function mapPropertyTypeToCategory(propertyType: string | null): string {
  if (propertyType && PROPERTY_TYPE_TO_CATEGORY[propertyType]) {
    return PROPERTY_TYPE_TO_CATEGORY[propertyType];
  }
  return "vacation_rental|home";
}

function pickNeighborhood(tags: string[] | null): string | null {
  if (!tags) return null;
  for (const tag of tags) {
    if (KNOWN_NEIGHBORHOOD_TAGS.has(tag)) return tag;
  }
  return null;
}

function buildDescription(pd: GuestyPublicDescription | undefined): string {
  if (!pd) return "";
  const parts = [pd.summary, pd.space, pd.neighborhood]
    .filter((p): p is string => Boolean(p && p.trim()))
    .map((p) => clean(p, 600));
  const combined = parts.join(" ");
  return clean(combined, MAX_BODY_CHARS);
}

function normalizePhone(phone: string | null | undefined): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1-${digits.slice(1, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `+1-${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

function buildAmenityAttrs(amenities: string[] | null): string[] {
  if (!amenities) return [];
  const attrs = new Map<string, string>();
  for (const a of amenities) {
    const key = a.toLowerCase().trim();
    const mapped = AMENITY_TO_ATTR[key];
    if (mapped && !attrs.has(mapped.name)) {
      attrs.set(mapped.name, mapped.value);
    }
  }
  return Array.from(attrs.entries()).map(
    ([name, value]) =>
      `        <attr name="${xmlEscape(name)}">${xmlEscape(value)}</attr>`
  );
}

function buildPhotos(pictures: GuestyPicture[] | undefined): string[] {
  if (!pictures?.length) return [];
  return pictures
    .slice(0, MAX_PHOTOS)
    .map((p) => p.original)
    .filter((url): url is string => Boolean(url))
    .map((url) => `      <image type="photo" url="${xmlEscape(url)}" />`);
}

function buildReviewBlocks(
  reviews: FeedReview[],
  listingUrl: string
): string[] {
  return reviews.slice(0, MAX_REVIEWS_PER_LISTING).map((r) => {
    const date = r.reviewed_at.slice(0, 10);
    return [
      `      <review type="user">`,
      `        <author>${xmlEscape(r.author)}</author>`,
      `        <body>${xmlEscape(clean(r.body, 500))}</body>`,
      `        <date>${xmlEscape(date)}</date>`,
      `        <link>${xmlEscape(listingUrl)}</link>`,
      `        <rating>${r.rating.toFixed(1)}</rating>`,
      `      </review>`,
    ].join("\n");
  });
}

/** Build the XML for a single listing. Returns empty string if missing required fields. */
export function buildListingXml(
  listing: FeedListing,
  reviews: FeedReview[]
): string {
  const addr = listing.address;
  if (!addr?.lat || !addr?.lng || !addr.street || !addr.city || !addr.state) {
    return "";
  }
  const raw = listing.raw || undefined;
  const pd = raw?.publicDescription;

  const url = `${SITE}/properties/${listing.guesty_id}`;
  const name = clean(listing.title || listing.nickname || "", 150);
  if (!name) return "";

  const body = buildDescription(pd);
  if (!body) return "";

  const category = mapPropertyTypeToCategory(listing.property_type);
  const neighborhood = pickNeighborhood(listing.tags);
  const phone = normalizePhone(listing.contact_phone);
  const reviewAvg = listing.computed_review_avg ?? null;
  const reviewCount = listing.computed_review_count ?? 0;

  const attrLines: string[] = [];
  const pushAttr = (
    name: string,
    value: string | number | null | undefined
  ) => {
    if (value === null || value === undefined || value === "") return;
    attrLines.push(
      `        <attr name="${xmlEscape(name)}">${xmlEscape(String(value))}</attr>`
    );
  };

  pushAttr("rating", reviewAvg ? reviewAvg.toFixed(1) : null);
  pushAttr("star_rating", reviewAvg ? reviewAvg.toFixed(1) : null);
  pushAttr("num_reviews", reviewCount > 0 ? reviewCount : null);
  pushAttr("number_of_bedrooms", listing.bedrooms);
  pushAttr("number_of_beds", listing.beds);
  pushAttr("number_of_bathrooms", listing.bathrooms);
  pushAttr("number_of_rooms", listing.bedrooms);
  pushAttr("capacity", listing.accommodates);
  pushAttr(
    "room_type",
    raw?.roomType === "Entire home/apt"
      ? "FullHouse"
      : raw?.roomType === "Private room"
        ? "Private"
        : raw?.roomType === "Shared room"
          ? "Shared"
          : null
  );
  pushAttr("area_sq_ft", listing.area_square_feet);
  pushAttr("check_in_time", listing.default_check_in_time);
  pushAttr("check_out_time", listing.default_check_out_time);
  pushAttr("minimum_night_stay", raw?.terms?.minNights);
  pushAttr("max_night_stay", raw?.terms?.maxNights);
  pushAttr("instant_bookable", "Yes");
  pushAttr("smoke_free_property", "Yes");
  attrLines.push(...buildAmenityAttrs(listing.amenities));

  const photos = buildPhotos(raw?.pictures);
  if (photos.length === 0) return "";

  const reviewBlocks = buildReviewBlocks(reviews, url);

  const lines: string[] = [
    `  <listing>`,
    `    <id>${xmlEscape(listing.guesty_id)}</id>`,
    `    <name>${xmlEscape(name)}</name>`,
    `    <address>`,
    `      <component name="addr1">${xmlEscape(addr.street)}</component>`,
    `      <component name="city">${xmlEscape(addr.city)}</component>`,
    `      <component name="province">${xmlEscape(addr.state)}</component>`,
    `      <component name="postal_code">${xmlEscape(addr.zipcode || "")}</component>`,
    `    </address>`,
    `    <country>${xmlEscape(addr.country === "United States" ? "US" : addr.country || "US")}</country>`,
    `    <latitude>${addr.lat}</latitude>`,
    `    <longitude>${addr.lng}</longitude>`,
  ];
  if (phone) {
    lines.push(`    <phone type="main">${xmlEscape(phone)}</phone>`);
  }
  lines.push(`    <category>${xmlEscape(category)}</category>`);
  lines.push(`    <content>`);
  lines.push(`      <text type="description">`);
  lines.push(`        <link>${xmlEscape(url)}</link>`);
  lines.push(`        <title>${xmlEscape(name)}</title>`);
  lines.push(`        <body>${xmlEscape(body)}</body>`);
  lines.push(`      </text>`);
  if (reviewBlocks.length) {
    lines.push(reviewBlocks.join("\n"));
  }
  if (attrLines.length) {
    lines.push(`      <attributes>`);
    lines.push(attrLines.join("\n"));
    lines.push(`      </attributes>`);
  }
  lines.push(photos.join("\n"));
  if (neighborhood) {
    lines.push(`      <neighborhood>${xmlEscape(neighborhood)}</neighborhood>`);
  }
  lines.push(`    </content>`);
  lines.push(`  </listing>`);

  return lines.join("\n");
}

export function wrapFeed(listingXml: string): string {
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<listings xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">`,
    `  <language>en</language>`,
    listingXml,
    `</listings>`,
    ``,
  ].join("\n");
}
