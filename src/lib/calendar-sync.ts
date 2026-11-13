/**
 * Guesty (Open API) → Supabase `calendar_days` sync.
 *
 * Built 2026-10-12 as phase 5 of docs/phase2-ai-agent-booking.md. The
 * `calendar_days` table has existed for months with exactly the right schema
 * — a unique (listing_id, date) key, indexes on date and status — and
 * **zero rows**. Two consumers already read it and have therefore always
 * returned nothing:
 *
 *   - /api/feeds/microsoft-price-feed, which skips any day without a
 *     positive `price`, so the Bing/Microsoft travel price feed has been
 *     empty its whole life.
 *   - the YoY-rates alert enrichment in lib/alerts.ts, which reads it from a
 *     separate "dashboard" project via DASHBOARD_SUPABASE_URL — a var that is
 *     not set in production, so that path is inert too.
 *
 * Same shape of bug as the `listings` mirror before PR #25: a table nothing
 * populated, silently emptying every surface that read it.
 *
 * ── Why the Open API and not BEAPI ──────────────────────────────────────
 *
 * The obvious source is BEAPI's calendar, which the site already uses. It
 * cannot work: **the BEAPI calendar carries no price.** Verified against
 * production on 2026-10-12 over a 46-day window — every day returns exactly
 * {date, status, minNights, isBaseMinNights, cta, ctd, maxNights, allotment,
 * blocks} and nothing price-shaped. Filling `calendar_days` from BEAPI would
 * leave `price` NULL and the price feed would stay empty, which is most of
 * the point of doing this.
 *
 * Guesty's Open API availability-pricing calendar returns the nightly rate
 * alongside the same availability fields, and `/api/health/openapi` reports
 * healthy in production (CLAUDE.md's note that those credentials are missing
 * is stale — it was corrected on 2026-10-12). So this reads the Open API.
 *
 * ── Rate limits and run shape ───────────────────────────────────────────
 *
 * Guesty allows ~15 req/s burst and 120 req/min sustained, shared across
 * everything we do. One listing-year is one request, so the whole catalogue
 * is ~208 requests — which would be fine on its own but is not something to
 * fire in a tight loop next to live quote traffic.
 *
 * Instead each run takes a bounded slice of the STALEST listings and paces
 * itself. Run hourly, `LISTINGS_PER_RUN` at a time, and the catalogue rolls
 * over continuously; a listing is never more than a few hours stale and a
 * failed run simply means the next one picks the same listings up again. No
 * cursor to persist and nothing to reset by hand.
 */
import { getOpenAPIListingCalendar } from "./guesty-openapi";
import { getSupabaseAdmin } from "./supabase-admin";

/** How far ahead to mirror. Beyond a year, rates are rarely loaded anyway. */
const WINDOW_DAYS = 365;

/**
 * Listings per invocation. 40 listings ≈ 40 requests ≈ 60s at the pacing
 * below, which keeps a run far inside the route's maxDuration even when
 * Guesty is slow. Hourly × 40 refreshes all 208 roughly every 5 hours.
 */
const LISTINGS_PER_RUN = 40;

/**
 * ~0.67 requests/second.
 *
 * ⚠️ This was 500ms, with a comment claiming "an order of magnitude under
 * Guesty's sustained cap". It was not: 2/s IS 120/min, which is the cap
 * itself, so this job spent ~20 seconds of every hour pinned to the ceiling
 * with no headroom for anything else on the account.
 *
 * The damage was measurable. Of ~580 terminal 429s in the week to
 * 2026-10-28, 248 — more than two in five — fell in minutes :25–:29, and
 * this job's cron is `25 * * * *`. The paths that recorded the 429s were
 * ordinary page renders fetching listing detail: they were the victims, not
 * the cause. The `guesty-429-burst` alert meanwhile told the reader "Do not
 * assume this site caused it", which had been true in October and had
 * quietly stopped being true.
 *
 * 1500ms puts a run at roughly a third of the account budget, so a guest
 * quote or a page render landing inside the window still has room.
 */
const REQUEST_SPACING_MS = 1500;

/** Postgres upsert batch. A listing-year is ~365 rows, so this is ~3 batches. */
const UPSERT_CHUNK = 500;

/** A day as Guesty's availability-pricing calendar returns it. */
interface GuestyCalendarDay {
  date?: string;
  currency?: string;
  price?: number;
  isBasePrice?: boolean;
  minNights?: number;
  isBaseMinNights?: boolean;
  status?: string;
  blocks?: Record<string, boolean>;
  cta?: boolean;
  ctd?: boolean;
  allotment?: number;
}

/** A row as `calendar_days` stores it. */
interface CalendarDayRow {
  listing_id: string;
  date: string;
  price: number | null;
  currency: string | null;
  is_base_price: boolean | null;
  min_nights: number | null;
  is_base_min_nights: boolean | null;
  status: string | null;
  raw_status: string | null;
  blocks: Record<string, boolean> | null;
  cta: boolean | null;
  ctd: boolean | null;
  allotment: number | null;
  last_synced_at: number;
}

/**
 * Pull the day array out of whatever envelope Guesty used.
 *
 * Deliberately permissive: this endpoint has no existing caller in the repo,
 * so the exact envelope is unverified here. It has been observed as
 * `{data: {days: [...]}}`, and `{days: [...]}` and a bare array are cheap to
 * accept. Returning [] rather than throwing means an unexpected shape shows
 * up as "0 days" in the run summary instead of taking the whole sync down.
 */
export function extractCalendarDays(payload: unknown): GuestyCalendarDay[] {
  if (Array.isArray(payload)) return payload as GuestyCalendarDay[];
  if (!payload || typeof payload !== "object") return [];
  const obj = payload as Record<string, unknown>;
  if (Array.isArray(obj.days)) return obj.days as GuestyCalendarDay[];
  const data = obj.data;
  if (Array.isArray(data)) return data as GuestyCalendarDay[];
  if (data && typeof data === "object") {
    const inner = (data as Record<string, unknown>).days;
    if (Array.isArray(inner)) return inner as GuestyCalendarDay[];
  }
  return [];
}

/**
 * Normalise Guesty's status to the vocabulary `calendar_days` consumers
 * expect. The price feed tests `status !== "available"`, so anything we are
 * not certain is bookable must NOT be called available. `raw_status` keeps
 * Guesty's own word so nothing is lost by this narrowing.
 */
function normalizeStatus(raw: string | undefined): string {
  const s = (raw || "").toLowerCase();
  if (s === "available") return "available";
  if (s === "booked" || s === "reserved") return "booked";
  if (s === "unavailable" || s === "blocked") return "unavailable";
  return s || "unknown";
}

export function mapCalendarDay(
  listingId: string,
  day: GuestyCalendarDay,
  syncedAt: number
): CalendarDayRow | null {
  const date = (day.date || "").slice(0, 10);
  // Without a date there is no unique key, so the row is unusable.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;

  // Only a positive, finite number is a price. The price feed treats a
  // non-number as "skip this day", and writing 0 or NaN would be worse than
  // writing nothing.
  const price =
    typeof day.price === "number" && Number.isFinite(day.price) && day.price > 0
      ? day.price
      : null;

  return {
    listing_id: listingId,
    date,
    price,
    currency: typeof day.currency === "string" ? day.currency : null,
    is_base_price:
      typeof day.isBasePrice === "boolean" ? day.isBasePrice : null,
    min_nights:
      typeof day.minNights === "number" && Number.isFinite(day.minNights)
        ? day.minNights
        : null,
    is_base_min_nights:
      typeof day.isBaseMinNights === "boolean" ? day.isBaseMinNights : null,
    status: normalizeStatus(day.status),
    raw_status: typeof day.status === "string" ? day.status : null,
    blocks: day.blocks && typeof day.blocks === "object" ? day.blocks : null,
    cta: typeof day.cta === "boolean" ? day.cta : null,
    ctd: typeof day.ctd === "boolean" ? day.ctd : null,
    allotment:
      typeof day.allotment === "number" && Number.isFinite(day.allotment)
        ? day.allotment
        : null,
    last_synced_at: syncedAt,
  };
}

/** kv_store key holding {guestyId: lastSyncedAtMs} for the staleness ordering. */
const WATERMARK_KEY = "calendar_sync_watermarks";

type SupabaseAdmin = ReturnType<typeof getSupabaseAdmin>;

async function readWatermarks(
  supabase: SupabaseAdmin
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  try {
    const { data } = await supabase
      .from("kv_store")
      .select("value")
      .eq("key", WATERMARK_KEY)
      .single();
    const value = data?.value;
    if (value && typeof value === "object") {
      for (const [id, ts] of Object.entries(value as Record<string, unknown>)) {
        if (typeof ts === "number" && Number.isFinite(ts)) map.set(id, ts);
      }
    }
  } catch {
    // Treat as "nothing synced yet" — see the caller.
  }
  return map;
}

/**
 * Merge this run's listings into the watermark blob.
 *
 * Read-modify-write, so a run that handled 40 listings does not erase the
 * other 168. Best-effort: losing a watermark update costs a redundant refresh
 * next run, never data.
 */
async function writeWatermarks(
  supabase: SupabaseAdmin,
  existing: Map<string, number>,
  listingIds: string[],
  syncedAt: number
): Promise<void> {
  try {
    const merged: Record<string, number> = {};
    for (const [id, ts] of existing) merged[id] = ts;
    for (const id of listingIds) merged[id] = syncedAt;
    await supabase
      .from("kv_store")
      .upsert({ key: WATERMARK_KEY, value: merged }, { onConflict: "key" });
  } catch {
    // best effort
  }
}

export function windowDates(from = new Date()): { start: string; end: string } {
  const start = new Date(from);
  const end = new Date(from);
  end.setUTCDate(end.getUTCDate() + WINDOW_DAYS);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

export interface CalendarSyncResult {
  listingsProcessed: number;
  daysUpserted: number;
  daysWithPrice: number;
  errors: string[];
  dryRun: boolean;
  /** Only populated on a dry run — the first raw day, for shape verification. */
  sample?: unknown;
}

/**
 * Sync the stalest `limit` listings.
 *
 * `dryRun` fetches and maps but writes nothing, and returns the first raw day
 * so the Guesty envelope can be confirmed against production before this is
 * ever allowed to write. Use it the first time:
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *     "https://www.booktraverse.com/api/cron/sync-calendar?dryRun=1&limit=1"
 */
export async function syncCalendarDays(opts?: {
  limit?: number;
  dryRun?: boolean;
  listingId?: string;
}): Promise<CalendarSyncResult> {
  const limit = opts?.limit ?? LISTINGS_PER_RUN;
  const dryRun = opts?.dryRun ?? false;
  const supabase = getSupabaseAdmin();
  const errors: string[] = [];
  const result: CalendarSyncResult = {
    listingsProcessed: 0,
    daysUpserted: 0,
    daysWithPrice: 0,
    errors,
    dryRun,
  };

  // Staleness watermarks, read once and reused for both the ordering below
  // and the merge at the end of the run.
  //
  // Kept in a single kv_store row rather than derived from calendar_days
  // itself. Deriving it would mean reading listing_id + last_synced_at for the
  // whole table — ~76,000 rows once the year-long window is filled for 208
  // listings — on every hourly run, just to compute a max per listing. One
  // small JSON blob does the same job in one row.
  //
  // A missing or unreadable watermark is not an error: every listing then
  // sorts as never-synced, which is exactly right on the first run and merely
  // redundant later.
  const watermarks = await readWatermarks(supabase);

  // Which listings to refresh this run. Stalest first, using the mirror's own
  // notion of what is active so a delisted listing stops being refreshed.
  let listingIds: string[];
  if (opts?.listingId) {
    listingIds = [opts.listingId];
  } else {
    const { data, error } = await supabase
      .from("listings")
      .select("guesty_id")
      .eq("active", true)
      .limit(1000);
    if (error) {
      errors.push(`listing lookup failed: ${error.message}`);
      return result;
    }
    const allIds = (data ?? [])
      .map((r) => (r as { guesty_id: string }).guesty_id)
      .filter(Boolean);

    listingIds = allIds
      .sort((a, b) => (watermarks.get(a) ?? 0) - (watermarks.get(b) ?? 0))
      .slice(0, limit);
  }

  const { start, end } = windowDates();
  const syncedAt = Date.now();
  /** Listings this run actually wrote, so only those advance the watermark. */
  const synced: string[] = [];

  for (let i = 0; i < listingIds.length; i++) {
    const listingId = listingIds[i];
    // Pace the calls. Spacing BEFORE each request after the first keeps us at
    // a steady rate rather than bursting and then idling.
    if (i > 0) {
      await new Promise((r) => setTimeout(r, REQUEST_SPACING_MS));
    }

    let payload: unknown;
    try {
      payload = await getOpenAPIListingCalendar({
        listingId,
        startDate: start,
        endDate: end,
      });
    } catch (err) {
      errors.push(
        `${listingId}: ${err instanceof Error ? err.message : String(err)}`
      );
      continue;
    }

    const days = extractCalendarDays(payload);
    if (dryRun && result.sample === undefined) {
      result.sample = days[0] ?? payload;
    }
    if (days.length === 0) {
      errors.push(`${listingId}: calendar returned no days`);
      continue;
    }

    const rows = days
      .map((d) => mapCalendarDay(listingId, d, syncedAt))
      .filter((r): r is CalendarDayRow => r !== null);
    result.listingsProcessed++;
    result.daysWithPrice += rows.filter((r) => r.price != null).length;

    if (dryRun) {
      result.daysUpserted += rows.length;
      continue;
    }

    let wroteCleanly = true;
    for (let j = 0; j < rows.length; j += UPSERT_CHUNK) {
      const chunk = rows.slice(j, j + UPSERT_CHUNK);
      const { error, count } = await supabase
        .from("calendar_days")
        .upsert(chunk, { onConflict: "listing_id,date", count: "exact" });
      if (error) {
        errors.push(`${listingId} upsert: ${error.message}`);
        wroteCleanly = false;
        break;
      }
      result.daysUpserted += count ?? chunk.length;
    }
    // Only a listing whose whole window landed counts as synced. A partial
    // write leaves the watermark alone so the listing stays at the front of
    // the queue and is retried next run.
    if (wroteCleanly) synced.push(listingId);
  }

  if (!dryRun && synced.length > 0) {
    await writeWatermarks(supabase, watermarks, synced, syncedAt);
  }

  return result;
}
