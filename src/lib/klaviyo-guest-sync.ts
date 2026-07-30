/**
 * Guesty → Klaviyo guest-email sync.
 *
 * WHY: guests hand us their personal email + marketing permission through the
 * SuiteOp guest portal, and that writes back to Guesty. Measured 2026-07-29,
 * ~47% of recent Guesty reservations carry a clean personal email — including
 * OTA guests (VRBO 100%, Airbnb ~34%) — while Klaviyo had **16 subscribers**.
 * The emails were already earned; nothing was moving them into Klaviyo. This
 * closes that gap and keeps it closed (nightly).
 *
 * SOURCE OF TRUTH IS GUESTY, NOT THE CRM. The CRM `guests` mirror shows only
 * ~12.7% email coverage — a sync defect, not reality. Read Guesty directly.
 *
 * ENUMERATION: via **reservations**, not `/v1/guests` — the guests list
 * endpoint doesn't populate emails in list view (verified: `emails: []` even
 * with an explicit `fields` request), while reservations reliably carry
 * `guest.email` AND the booking context we need for segmentation (source,
 * listing, dates, value).
 *
 * ⚠️ OTA-masked relays (@guest.booking.com, Airbnb relays, …) are NEVER mailable
 * and must never reach Klaviyo. Hard-filtered below.
 */

import { getOpenAPIReservationsPage } from "./guesty-openapi";
import { getSupabaseAdmin } from "./supabase-admin";

/** Marketing list ("Email List") — same list the newsletter signup uses. */
const KLAVIYO_LIST_ID = "S9Ezba";
const KLAVIYO_REVISION = "2025-04-15";
/** Klaviyo's bulk subscribe job accepts up to 100 profiles per request. */
const KLAVIYO_BATCH = 100;
/** The bulk IMPORT job allows far more; 1,000 keeps payloads sane. */
const KLAVIYO_IMPORT_BATCH = 1000;

/**
 * OTA relay/masked addresses. These are per-booking aliases owned by the
 * channel — mailing them is undeliverable at best and a policy problem at
 * worst. Matches the alias domains, not the guest's real mailbox.
 */
const OTA_EMAIL_RE =
  /(@|\.)((guest\.)?booking\.com|airbnb\.com|m\.airbnb\.com|reply\.airbnb\.com|expedia(group)?\.com|vrbo\.com|homeaway\.com|tripadvisor\.com|guest\.[a-z0-9-]+\.com)$/i;
/** Belt-and-braces: some relays put the channel in the local part. */
const OTA_LOCALPART_RE = /(airbnb|vrbo|homeaway|expedia|booking)/i;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isMailableEmail(raw: string | null | undefined): boolean {
  const email = (raw || "").trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) return false;
  if (OTA_EMAIL_RE.test(email)) return false;
  const [local, domain] = email.split("@");
  // Only treat a channel word in the local part as OTA when the domain is also
  // channel-ish — otherwise we'd drop a legit "airbnbhost@gmail.com".
  if (OTA_LOCALPART_RE.test(local) && OTA_LOCALPART_RE.test(domain)) return false;
  return true;
}

interface GuestAggregate {
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  stayCount: number;
  firstStay?: string;
  lastStay?: string;
  markets: Set<string>;
  sources: Set<string>;
  totalValue: number;
}

export interface GuestSyncResult {
  reservationsScanned: number;
  reportedTotal: number;
  truncated: boolean;
  withEmail: number;
  otaFiltered: number;
  uniqueMailable: number;
  /** Profiles whose attributes/properties were imported (step 1). */
  imported: number;
  /** Profiles granted marketing consent + added to the list (step 2). */
  subscribed: number;
  failedImportBatches: number;
  failedBatches: number;
  dryRun: boolean;
  errors: string[];
}

/** listingId → market/city, for segmentation. Best-effort. */
async function buildListingMarketMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from("listings")
      .select("guesty_id, address")
      .limit(2000);
    for (const row of (data || []) as Array<{
      guesty_id: string;
      address: { city?: string } | null;
    }>) {
      const city = row.address?.city;
      if (row.guesty_id && city) map.set(row.guesty_id, city);
    }
  } catch {
    // Segmentation properties are a nice-to-have; never fail the sync on this.
  }
  return map;
}

/**
 * Klaviyo needs TWO calls — verified against the live API 2026-07-30:
 *
 *  - `profile-subscription-bulk-create-jobs` sets marketing consent + list
 *    membership but its profile schema accepts ONLY `email`/`phone_number`/
 *    `subscriptions`. Passing `first_name` or `properties` 400s
 *    ("'first_name' is not a valid field for the resource 'profile'").
 *  - `profile-bulk-import-jobs` accepts the rich attributes (names, custom
 *    properties) but does not grant marketing consent.
 *
 * So: import attributes first, then subscribe. Both upsert by email, so the
 * whole sync stays idempotent and safe to re-run.
 */
async function importProfileBatch(
  apiKey: string,
  batch: GuestAggregate[]
): Promise<void> {
  const profiles = batch.map((g) => ({
    type: "profile" as const,
    attributes: {
      email: g.email,
      ...(g.firstName ? { first_name: g.firstName } : {}),
      ...(g.lastName ? { last_name: g.lastName } : {}),
      properties: {
        // Records WHERE permission came from, so the opt-in is auditable.
        consent_source: "suiteop_portal",
        guesty_stay_count: g.stayCount,
        ...(g.firstStay ? { guesty_first_stay: g.firstStay } : {}),
        ...(g.lastStay ? { guesty_last_stay: g.lastStay } : {}),
        ...(g.markets.size
          ? { guesty_markets: Array.from(g.markets).sort() }
          : {}),
        ...(g.sources.size
          ? { guesty_booking_sources: Array.from(g.sources).sort() }
          : {}),
        ...(g.totalValue > 0
          ? { guesty_total_value: Math.round(g.totalValue) }
          : {}),
        guesty_is_repeat_guest: g.stayCount > 1,
      },
    },
  }));

  const res = await fetch("https://a.klaviyo.com/api/profile-bulk-import-jobs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Klaviyo-API-Key ${apiKey}`,
      revision: KLAVIYO_REVISION,
    },
    body: JSON.stringify({
      data: {
        type: "profile-bulk-import-job",
        attributes: { profiles: { data: profiles } },
      },
    }),
  });

  if (!res.ok) {
    throw new Error(
      `Klaviyo profile import failed (${res.status}): ${(await res.text()).slice(0, 300)}`
    );
  }
}

/** Grant email-marketing consent + add to the marketing list. */
async function subscribeBatch(
  apiKey: string,
  batch: GuestAggregate[]
): Promise<void> {
  const profiles = batch.map((g) => ({
    type: "profile" as const,
    attributes: {
      email: g.email,
      subscriptions: { email: { marketing: { consent: "SUBSCRIBED" } } },
    },
  }));

  const res = await fetch(
    "https://a.klaviyo.com/api/profile-subscription-bulk-create-jobs",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Klaviyo-API-Key ${apiKey}`,
        revision: KLAVIYO_REVISION,
      },
      body: JSON.stringify({
        data: {
          type: "profile-subscription-bulk-create-job",
          attributes: {
            profiles: { data: profiles },
            historical_import: false,
          },
          relationships: {
            list: { data: { type: "list", id: KLAVIYO_LIST_ID } },
          },
        },
      }),
    }
  );

  if (!res.ok) {
    throw new Error(
      `Klaviyo subscribe failed (${res.status}): ${(await res.text()).slice(0, 300)}`
    );
  }
}

/**
 * Pull guests from Guesty and subscribe the mailable ones to Klaviyo.
 *
 * @param sinceISO  Only reservations with check-in on/after this date. Use an
 *                  old date for the initial backfill, a short window nightly.
 * @param dryRun    Collect + report, but don't write to Klaviyo. Always do a
 *                  dry run first — this writes to a live marketing list.
 */
export async function syncGuestsToKlaviyo(options: {
  sinceISO: string;
  dryRun?: boolean;
  /** Max pages PER date slice (100 reservations/page). */
  maxPages?: number;
  /**
   * Days per date slice. Guesty's deep pagination fails past ~12k records, so
   * the range is walked in slices to keep `skip` shallow. ~90 days ≈ 4k
   * reservations in peak season — comfortably under the limit.
   */
  sliceDays?: number;
}): Promise<GuestSyncResult> {
  const { sinceISO, dryRun = false, maxPages = 200 } = options;
  const result: GuestSyncResult = {
    reservationsScanned: 0,
    reportedTotal: 0,
    truncated: false,
    withEmail: 0,
    otaFiltered: 0,
    uniqueMailable: 0,
    imported: 0,
    subscribed: 0,
    failedImportBatches: 0,
    failedBatches: 0,
    dryRun,
    errors: [],
  };

  const apiKey = (process.env.KLAVIYO_PRIVATE_KEY || "").trim();
  if (!apiKey && !dryRun) {
    throw new Error("KLAVIYO_PRIVATE_KEY is not set");
  }

  const marketMap = await buildListingMarketMap();
  const byEmail = new Map<string, GuestAggregate>();

  const fields = [
    "guest.email",
    "guest.firstName",
    "guest.lastName",
    "guest.phone",
    "source",
    "status",
    "checkInDateLocalized",
    "listingId",
    "money.hostPayout",
  ].join(" ");

  // Guesty's deep pagination dies past roughly 12k records ("multiplanner ...
  // operation exceeded time limit" — a deep-$skip cost problem), so we can't
  // page a multi-year window in one pass. Instead walk the range in bounded
  // date SLICES, newest first: each slice keeps `skip` shallow. Explicit
  // filters are also REQUIRED regardless — the unfiltered endpoint returns a
  // capped default subset and would silently miss most of the history.
  const limit = 100;
  const sliceDays = options.sliceDays ?? 90;
  const startMs = Date.parse(`${sinceISO}T00:00:00Z`);
  const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

  const slices: Array<{ from: string; to: string }> = [];
  // Walk backwards from tomorrow (include future/upcoming stays) to sinceISO.
  let cursorMs = Date.now() + 86400_000;
  while (cursorMs > startMs && slices.length < 200) {
    const fromMs = Math.max(startMs, cursorMs - sliceDays * 86400_000);
    slices.push({ from: iso(fromMs), to: iso(cursorMs) });
    cursorMs = fromMs - 86400_000;
  }

  outer: for (const slice of slices) {
    const filters = [
      { field: "checkInDateLocalized", operator: "$gte", value: slice.from },
      { field: "checkInDateLocalized", operator: "$lte", value: slice.to },
    ];
    for (let page = 0; page < maxPages; page++) {
      const { results, count } = await getOpenAPIReservationsPage({
        fields,
        limit,
        skip: page * limit,
        sort: "-checkInDateLocalized",
        filters,
      });
      if (page === 0) result.reportedTotal += count;
      if (!results.length) break;
      result.reservationsScanned += results.length;

      for (const raw of results) {
      const r = raw as {
        guest?: {
          email?: string;
          firstName?: string;
          lastName?: string;
          phone?: string;
        };
        source?: string;
        status?: string;
        checkInDateLocalized?: string;
        listingId?: string;
        money?: { hostPayout?: number };
      };
      // Skip cancellations — a cancelled stay isn't a guest relationship.
      const status = String(r.status || "").toLowerCase();
      if (status === "canceled" || status === "cancelled" || status === "declined")
        continue;

      const email = (r.guest?.email || "").trim().toLowerCase();
      if (!email) continue;
      result.withEmail += 1;
      if (!isMailableEmail(email)) {
        result.otaFiltered += 1;
        continue;
      }

      const existing = byEmail.get(email);
      const checkIn = r.checkInDateLocalized || undefined;
      const market = r.listingId ? marketMap.get(r.listingId) : undefined;
      const agg: GuestAggregate = existing || {
        email,
        firstName: r.guest?.firstName?.trim() || undefined,
        lastName: r.guest?.lastName?.trim() || undefined,
        phone: r.guest?.phone?.trim() || undefined,
        stayCount: 0,
        markets: new Set<string>(),
        sources: new Set<string>(),
        totalValue: 0,
      };
      agg.stayCount += 1;
      agg.totalValue += Number(r.money?.hostPayout) || 0;
      if (market) agg.markets.add(market);
      if (r.source) agg.sources.add(String(r.source));
      if (checkIn) {
        if (!agg.firstStay || checkIn < agg.firstStay) agg.firstStay = checkIn;
        if (!agg.lastStay || checkIn > agg.lastStay) agg.lastStay = checkIn;
      }
        byEmail.set(email, agg);
      }

      if (results.length < limit) break;
      if (page === maxPages - 1) {
        result.truncated = true;
        break outer;
      }
    }
  }

  // Detect the capped-endpoint trap: if Guesty reports far more than we paged.
  if (
    result.reportedTotal > 0 &&
    result.reservationsScanned < result.reportedTotal
  ) {
    result.truncated = true;
  }

  const guests = Array.from(byEmail.values());
  result.uniqueMailable = guests.length;
  if (dryRun) return result;

  // Step 1: import attributes (names + segmentation properties).
  for (let i = 0; i < guests.length; i += KLAVIYO_IMPORT_BATCH) {
    const batch = guests.slice(i, i + KLAVIYO_IMPORT_BATCH);
    try {
      await importProfileBatch(apiKey, batch);
      result.imported += batch.length;
    } catch (err) {
      result.failedImportBatches += 1;
      const msg = err instanceof Error ? err.message : String(err);
      if (result.errors.length < 5) result.errors.push(msg);
    }
  }

  // Step 2: grant marketing consent + add to the list. Runs even if an import
  // batch failed — consent is the part that matters; attributes can be
  // re-imported on the next nightly run.
  for (let i = 0; i < guests.length; i += KLAVIYO_BATCH) {
    const batch = guests.slice(i, i + KLAVIYO_BATCH);
    try {
      await subscribeBatch(apiKey, batch);
      result.subscribed += batch.length;
    } catch (err) {
      result.failedBatches += 1;
      const msg = err instanceof Error ? err.message : String(err);
      if (result.errors.length < 5) result.errors.push(msg);
    }
  }

  return result;
}
