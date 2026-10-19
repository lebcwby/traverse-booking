/**
 * Read-only public API for AI agents. Phase 6 of
 * docs/phase2-ai-agent-booking.md.
 *
 * Everything here is served from Postgres — the `listings` mirror and the
 * `calendar_days` cache populated in #79. Guesty is NOT called. That is the
 * whole design: a catalogue-wide search would otherwise be one Guesty request
 * per listing, 208 against a 120/minute ceiling, so a single agent search
 * would rate-limit the booking site for two minutes.
 *
 * ── What is deliberately NOT exposed ────────────────────────────────────
 *
 * The `listings` mirror has columns sitting next to the ones we serve that
 * would be damaging to publish, so this uses an explicit ALLOW-LIST
 * (AGENT_LISTING_COLUMNS) rather than selecting everything and removing a few.
 * A deny-list silently leaks whatever column someone adds next.
 *
 *   - `owners`, `financials`, `custom_fields`, `wheelhouse_data`,
 *     `occupancy_stats` — owner identities and money. Obvious.
 *   - `host_name`, `contact_phone` — personal contact details.
 *   - `nickname` — internal operational codes ("CB:GL:101", "LEAD:625E11th").
 *   - `tags` — ⚠️ looks harmless and is not. Live values include "REMAX",
 *     "H&V", "Lake County Zone" and "google review": owner/vendor names and
 *     internal routing. Building membership is derived from the known-building
 *     map instead, which exposes only what the public building pages already
 *     say.
 *   - `cleaning_status`, `integrations` — operational state.
 *
 * Street address and coordinates ARE exposed, because every listing page
 * already publishes both in its VacationRental JSON-LD. This adds no new
 * exposure; withholding them here would be inconsistent rather than safer.
 *
 * ── Why availability requires dates ─────────────────────────────────────
 *
 * There is no endpoint that dumps the catalogue's rates or a long calendar in
 * one call. Day-level availability polled over time reconstructs our occupancy
 * curve, and with prices attached, an estimate of revenue per unit — which is
 * commercially sensitive in a way neither field is alone. Requiring dates and
 * capping the calendar window does not stop a determined scraper, but it does
 * mean the easy path gives an agent exactly what a guest asked for and nothing
 * more.
 */
import { getPool } from "./db";
import { findBuildingForTags, SITE_ORIGIN } from "./listing-jsonld";
import { getListingSlug } from "./utils";
import { normalizeStateCode, resolveLocality } from "./listing-address";
import { isPetFriendly, PET_POLICY_NOTE } from "./pet-policy";

/** Hard cap on an availability window, in days. See the header. */
export const MAX_AVAILABILITY_DAYS = 90;

/** Hard cap on search results per request. */
export const MAX_SEARCH_RESULTS = 50;

/** Longest stay we will price in one request. */
export const MAX_STAY_NIGHTS = 30;

/**
 * Columns this API may read from `listings`. Explicit allow-list — see header.
 * ⚠️ Per feedback_traverse_listings_mirror_sync, a select() naming a column
 * that does not exist makes Postgres 42703 the whole query, so this list is
 * also load-bearing for correctness, not only for privacy.
 */
export const AGENT_LISTING_COLUMNS = [
  "guesty_id",
  "title",
  "property_type",
  "room_type",
  "bedrooms",
  "bathrooms",
  "beds",
  "accommodates",
  "address",
  "picture",
  "amenities",
  "default_check_in_time",
  "default_check_out_time",
  "timezone",
  // Needed to derive building membership without exposing raw tags.
  "tags",
] as const;

export interface PublicListing {
  id: string;
  name: string;
  url: string;
  propertyType: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  beds: number | null;
  maxGuests: number | null;
  location: {
    city: string | null;
    state: string | null;
    postalCode: string | null;
    country: string | null;
    latitude: number | null;
    longitude: number | null;
  };
  building: { name: string; url: string } | null;
  amenities: string[];
  checkInTime: string | null;
  checkOutTime: string | null;
  photo: string | null;
  /**
   * Whether the home accepts pets at all. The website charges NOTHING for
   * pets — a guest discloses the pet and pays any fee through the guest
   * portal after booking — so this never affects a price. See PET_POLICY.
   *
   * ⚠️ Derived from the mirror's tags and amenities only; the BEAPI
   * house-rules flag is not mirrored. isPetFriendly treats any positive
   * signal as pet-friendly, so a listing whose only signal is the house-rules
   * flag will read false here.
   */
  petsAllowed: boolean;
}

/** Published alongside every listing so an agent states the policy correctly. */
export const PET_POLICY = {
  chargedAtBooking: false,
  note: PET_POLICY_NOTE,
} as const;

interface ListingRow {
  guesty_id: string;
  title: string | null;
  property_type: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  beds: number | null;
  accommodates: number | null;
  address: Record<string, unknown> | null;
  picture: string | null;
  amenities: string[] | null;
  default_check_in_time: string | null;
  default_check_out_time: string | null;
  tags: string[] | null;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v ? v : null;
}
function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function toPublicListing(row: ListingRow): PublicListing {
  const a = row.address ?? {};
  const name = (row.title || "").replace(/\s+/g, " ").trim();
  const zip = str(a.zipcode);
  return {
    id: row.guesty_id,
    name,
    url: `${SITE_ORIGIN}/properties/${getListingSlug(row.title, row.guesty_id)}`,
    propertyType: row.property_type,
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    beds: row.beds,
    maxGuests: row.accommodates,
    location: {
      // Same postcode-based correction the listing pages use, so the API and
      // the structured data cannot disagree about which town a unit is in.
      city: resolveLocality(str(a.city), zip) ?? null,
      state: normalizeStateCode(str(a.state)) ?? null,
      postalCode: zip,
      country: str(a.country),
      latitude: num(a.lat),
      longitude: num(a.lng),
    },
    building: findBuildingForTags(row.tags),
    petsAllowed: isPetFriendly({ tags: row.tags, amenities: row.amenities }),
    amenities: Array.isArray(row.amenities) ? row.amenities : [],
    checkInTime: row.default_check_in_time,
    checkOutTime: row.default_check_out_time,
    photo: row.picture,
  };
}

export interface StayQuoteSummary {
  checkIn: string;
  checkOut: string;
  nights: number;
  /**
   * Sum of the cached nightly rates for the stay. Accommodation only —
   * excludes cleaning, taxes and any fees, which only a live quote knows.
   * Callers must present it as indicative, never as the amount payable.
   */
  nightlyTotal: number;
  averageNightly: number;
  currency: string;
  minimumStay: number | null;
}

export interface SearchResult extends PublicListing {
  stay: StayQuoteSummary;
}

export interface SearchParams {
  checkIn: string;
  checkOut: string;
  guests?: number;
  bedrooms?: number;
  city?: string;
  limit?: number;
}

/** yyyy-mm-dd, and a real date (rejects 2027-02-31). */
export function isValidDate(value: string | null | undefined): boolean {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  const a = Date.parse(`${checkIn}T00:00:00Z`);
  const b = Date.parse(`${checkOut}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

const COLUMN_LIST = AGENT_LISTING_COLUMNS.map((c) => `l."${c}"`).join(", ");

/**
 * Listings that can actually take the whole stay.
 *
 * "Available" here means every night in [checkIn, checkOut) is status
 * 'available' with a positive cached price, the arrival night is not
 * closed-to-arrival, and the stay is at least as long as the arrival night's
 * minimum. Those are the same rules the booking calendar enforces, so a result
 * here should survive a real quote — but availability is cached (refreshed on
 * a ~5h rolling cycle), so checkout re-validates against Guesty and is the
 * authority.
 */
export async function searchAvailableListings(
  params: SearchParams
): Promise<SearchResult[]> {
  const nights = nightsBetween(params.checkIn, params.checkOut);
  const limit = Math.min(params.limit ?? 20, MAX_SEARCH_RESULTS);

  const sql = `
    WITH stay AS (
      SELECT
        c.listing_id,
        COUNT(*) FILTER (
          WHERE c.status = 'available' AND c.price IS NOT NULL AND c.price > 0
        ) AS bookable_nights,
        SUM(c.price) FILTER (WHERE c.status = 'available') AS nightly_total,
        MAX(c.min_nights) FILTER (WHERE c.date::date = $1::date) AS arrival_min_nights,
        BOOL_OR(c.cta) FILTER (WHERE c.date::date = $1::date) AS closed_to_arrival
      FROM calendar_days c
      WHERE c.date::date >= $1::date
        AND c.date::date <  $2::date
      GROUP BY c.listing_id
    )
    SELECT ${COLUMN_LIST}, s.nightly_total, s.arrival_min_nights
    FROM stay s
    JOIN listings l ON l.guesty_id = s.listing_id
    WHERE s.bookable_nights = $3
      AND COALESCE(s.closed_to_arrival, false) = false
      AND COALESCE(s.arrival_min_nights, 1) <= $3
      AND l.active = true
      AND l.is_listed = true
      AND l.beapi_enabled = true
      AND ($4::int IS NULL OR l.accommodates >= $4::int)
      AND ($5::int IS NULL OR l.bedrooms  >= $5::int)
      AND ($6::text IS NULL OR lower(l.address->>'city') = lower($6::text))
    ORDER BY s.nightly_total ASC
    LIMIT $7::int
  `;

  const { rows } = await getPool().query(sql, [
    params.checkIn,
    params.checkOut,
    nights,
    params.guests ?? null,
    params.bedrooms ?? null,
    params.city ?? null,
    limit,
  ]);

  return rows.map(
    (
      row: ListingRow & {
        nightly_total: string | number;
        arrival_min_nights: number | null;
      }
    ) => {
      // pg returns numeric as a string; Number() it exactly once, here.
      const total = Number(row.nightly_total) || 0;
      return {
        ...toPublicListing(row),
        stay: {
          checkIn: params.checkIn,
          checkOut: params.checkOut,
          nights,
          nightlyTotal: Math.round(total * 100) / 100,
          averageNightly: Math.round((total / nights) * 100) / 100,
          currency: "USD",
          minimumStay: row.arrival_min_nights ?? null,
        },
      };
    }
  );
}

export async function getPublicListing(
  listingId: string
): Promise<PublicListing | null> {
  const { rows } = await getPool().query(
    `SELECT ${COLUMN_LIST} FROM listings l
     WHERE l.guesty_id = $1 AND l.active = true AND l.is_listed = true
     LIMIT 1`,
    [listingId]
  );
  return rows[0] ? toPublicListing(rows[0] as ListingRow) : null;
}

export interface AvailabilityDay {
  date: string;
  available: boolean;
  nightlyRate: number | null;
  minimumStay: number | null;
  closedToArrival: boolean;
  closedToDeparture: boolean;
}

export async function getAvailability(
  listingId: string,
  from: string,
  to: string
): Promise<AvailabilityDay[]> {
  const { rows } = await getPool().query(
    `SELECT date, status, price, min_nights, cta, ctd
     FROM calendar_days
     WHERE listing_id = $1 AND date::date >= $2::date AND date::date <= $3::date
     ORDER BY date::date ASC`,
    [listingId, from, to]
  );
  return rows.map(
    (r: {
      date: string;
      status: string | null;
      price: string | number | null;
      min_nights: number | null;
      cta: boolean | null;
      ctd: boolean | null;
    }) => ({
      date: String(r.date).slice(0, 10),
      available: r.status === "available",
      nightlyRate: r.price == null ? null : Number(r.price),
      minimumStay: r.min_nights,
      closedToArrival: r.cta === true,
      closedToDeparture: r.ctd === true,
    })
  );
}
