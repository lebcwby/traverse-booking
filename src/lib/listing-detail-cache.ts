/**
 * Postgres cache for BEAPI listing detail.
 *
 * See supabase/migrations/20261107120000_listing_details_cache.sql for the
 * measurement behind this: 96.8% of terminal Guesty 429s were the BEAPI
 * listing-detail call, driven by crawlers sweeping the catalogue and finding
 * every ISR entry stale at once. Reads here cost Guesty nothing; the cron
 * below is the only thing that spends budget.
 *
 * Same architecture as `calendar_days`, which already makes the agent API and
 * the MCP server free.
 */
import { getSupabaseAdmin } from "./supabase-admin";
import { getListingDetail, LISTING_DETAIL_FIELDS } from "./guesty-beapi";

/** How many listings one cron invocation refreshes. */
const LISTINGS_PER_RUN = 40;

/**
 * Matches calendar-sync's pacing, and for the same reason.
 *
 * ~0.67 req/s is about a third of Guesty's ~120/min account budget, which is
 * shared with the CRM, PriceLabs and Conduit. The point of this whole module
 * is to stop bursts against that ceiling, so the refresher must not become
 * one itself.
 */
const REQUEST_SPACING_MS = 1500;

/**
 * One of BEAPI's house rules.
 *
 * `enabled` is a tri-state and the page renders all three differently: true
 * is "allowed", false is an explicit "not allowed", and null/absent means the
 * owner never answered, so the page says nothing rather than guessing.
 */
interface HouseRule {
  enabled?: boolean | null;
  hours?: { start?: string; end?: string };
  [key: string]: unknown;
}

/**
 * What /properties/[id] reads off a BEAPI detail payload.
 *
 * Every field is optional and loosely typed on purpose: this is a cache of
 * someone else's response, not a schema we control, and a missing field must
 * render as an absent section rather than throw. The previous call site got
 * `any` from the untyped BEAPI helper, so this is strictly more checking than
 * there was — it is not a promise that Guesty sends all of it.
 *
 * Keep in step with LISTING_DETAIL_FIELDS.
 */
/**
 * One tax as Guesty has it CONFIGURED on the listing — the authoritative rate.
 *
 * This is the thing a quote does not carry. A quote gives dollar amounts and
 * never says what they were levied on, which is why the checkout breakdown
 * used to derive a percentage by division and got Crested Butte wrong for
 * months (see the note in price-breakdown.tsx). Here Guesty states both:
 * `amount` + `units` is the rate, and `appliedOnFees` is the base it applies
 * to — and that base genuinely differs by jurisdiction, e.g.
 *
 *   Crested Butte  TOT 9.9%  appliedOnFees: [AF, CF, SERVICE, DAMAGE_WAIVER]
 *   Leadville      TOT 5.42% appliedOnFees: [AF, CF]
 *
 * which is exactly why no single formula could ever have worked.
 */
export interface ListingTax {
  _id?: string;
  /** e.g. "TRANSIENT_OCCUPANCY_TAX", "COUNTY_TAX", "STATE_TAX". */
  type?: string;
  /** "PERCENTAGE" | "FIXED" — a rate is only meaningful for PERCENTAGE. */
  units?: string;
  /** The rate itself when units is PERCENTAGE (9.9 means 9.9%). */
  amount?: number;
  quantifier?: string;
  /** Fee codes this tax is levied on, e.g. ["AF","CF","SERVICE"]. */
  appliedOnFees?: string[];
  appliedToAllFees?: boolean;
  [key: string]: unknown;
}

export interface BeapiListingDetail {
  _id?: string;
  id?: string;
  title?: string;
  nickname?: string;
  /** Guesty's configured taxes for this listing. See ListingTax. */
  taxes?: ListingTax[];
  address?: Record<string, unknown>;
  accommodates?: number;
  bedrooms?: number;
  bathrooms?: number;
  beds?: number;
  amenities?: string[];
  tags?: string[];
  pictures?: Array<{
    original?: string;
    thumbnail?: string;
    caption?: string;
    [key: string]: unknown;
  }>;
  prices?: Record<string, unknown>;
  propertyType?: string;
  roomType?: string;
  publicDescription?: {
    summary?: string;
    space?: string;
    access?: string;
    neighborhood?: string;
    transit?: string;
    notes?: string;
    interactionWithGuests?: string;
    [key: string]: unknown;
  };
  terms?: { cancellation?: string; [key: string]: unknown };
  reviews?: { avg?: number; total?: number; [key: string]: unknown };
  bedArrangements?: {
    bedrooms?: Array<{
      name?: string;
      type?: string;
      roomNumber?: number;
      beds?: Record<string, number>;
    }>;
  };
  // Each rule is {enabled: boolean | null} — `false` means explicitly
  // disallowed and `null`/absent means unset, which the page renders
  // differently, so the tri-state has to survive into the type.
  unitTypeHouseRules?: {
    houseRules?: {
      petsAllowed?: HouseRule;
      smokingAllowed?: HouseRule;
      suitableForEvents?: HouseRule;
      quietBetween?: HouseRule;
      [key: string]: HouseRule | undefined;
    };
    [key: string]: unknown;
  };
  defaultCheckInTime?: string;
  defaultCheckOutTime?: string;
  [key: string]: unknown;
}

/** A row as `listing_details` stores it. */
interface ListingDetailRow {
  listing_id: string;
  payload: unknown;
  fields: string;
  fetched_at: string;
}

export interface ListingDetailSyncResult {
  listingsProcessed: number;
  rowsWritten: number;
  errors: string[];
  dryRun: boolean;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Read one listing's cached detail, or null.
 *
 * Returns null — rather than throwing — for a miss, a stale field set, or any
 * database trouble. Every caller already handles a null detail by falling
 * back to the `listings` mirror, so a cache problem degrades the page instead
 * of breaking it.
 *
 * ⚠️ Deliberately does NOT fall back to Guesty. A fallback here would
 * reintroduce exactly the stampede this cache exists to prevent: 105 cache
 * misses inside one crawler sweep would become 105 BEAPI calls. The cron
 * fills the table; a miss renders from the mirror and is fixed within one
 * refresh cycle.
 */
export async function readCachedListingDetail(
  listingId: string
): Promise<BeapiListingDetail | null> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("listing_details")
      .select("payload, fields")
      .eq("listing_id", listingId)
      .maybeSingle();

    if (error || !data) return null;
    // A payload fetched under a different field list is missing whatever was
    // added since. Treat it as a miss so the page uses the mirror rather than
    // rendering a half-populated section that looks deliberate.
    if (data.fields !== LISTING_DETAIL_FIELDS) return null;
    return (data.payload as BeapiListingDetail) ?? null;
  } catch {
    return null;
  }
}

/** Write one listing's detail through to the cache. Best-effort. */
async function writeCachedListingDetail(
  listingId: string,
  payload: unknown
): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const row: ListingDetailRow = {
    listing_id: listingId,
    payload,
    fields: LISTING_DETAIL_FIELDS,
    fetched_at: new Date().toISOString(),
  };
  const { error } = await supabase
    .from("listing_details")
    .upsert(row, { onConflict: "listing_id" });
  return !error;
}

/**
 * Refresh the cache, stalest first.
 *
 * Hourly × 40 covers all ~208 active listings roughly every five hours, which
 * is the same freshness `calendar_days` runs at and well inside what this
 * data needs — photos, descriptions, amenities and house rules do not move.
 */
export async function syncListingDetails(opts?: {
  limit?: number;
  dryRun?: boolean;
  listingId?: string;
}): Promise<ListingDetailSyncResult> {
  const limit = opts?.limit ?? LISTINGS_PER_RUN;
  const dryRun = opts?.dryRun ?? false;
  const errors: string[] = [];
  const result: ListingDetailSyncResult = {
    listingsProcessed: 0,
    rowsWritten: 0,
    errors,
    dryRun,
  };

  const supabase = getSupabaseAdmin();

  let listingIds: string[];
  if (opts?.listingId) {
    listingIds = [opts.listingId];
  } else {
    // Active and listed only, read from the mirror — the same gate
    // calendar-sync uses, so a delisted listing stops being refreshed rather
    // than spending budget forever. See
    // feedback_crm_listing_sync_never_created for why `active && isListed` is
    // the filter that matters.
    const { data, error } = await supabase
      .from("listings")
      .select("guesty_id")
      .eq("active", true)
      .eq("is_listed", true);

    if (error) {
      errors.push(`listings read failed: ${error.message}`);
      return result;
    }

    const allIds = (data || []).map((r) => r.guesty_id as string);

    // Stalest first. A listing with no cached row sorts ahead of every cached
    // one, so a newly added listing is picked up on the next run.
    const { data: cached } = await supabase
      .from("listing_details")
      .select("listing_id, fetched_at");

    const fetchedAt = new Map<string, number>();
    for (const row of cached || []) {
      const t = Date.parse(row.fetched_at as string);
      if (Number.isFinite(t)) fetchedAt.set(row.listing_id as string, t);
    }

    listingIds = allIds
      .sort((a, b) => (fetchedAt.get(a) ?? 0) - (fetchedAt.get(b) ?? 0))
      .slice(0, limit);
  }

  for (let i = 0; i < listingIds.length; i++) {
    const listingId = listingIds[i];
    // Space the calls, not just the batches. Sleeping BEFORE each request
    // after the first keeps the rate even rather than firing a burst and then
    // idling, which is the shape that trips the account ceiling.
    if (i > 0) await sleep(REQUEST_SPACING_MS);

    try {
      const payload = await getListingDetail(listingId);
      result.listingsProcessed += 1;
      if (dryRun) continue;
      if (await writeCachedListingDetail(listingId, payload)) {
        result.rowsWritten += 1;
      } else {
        errors.push(`${listingId}: upsert failed`);
      }
    } catch (err) {
      // One listing failing must not abandon the other 39 — a 429 or a
      // delisted id is expected occasionally, and the next run retries it
      // first because it is now the stalest.
      errors.push(
        `${listingId}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return result;
}
