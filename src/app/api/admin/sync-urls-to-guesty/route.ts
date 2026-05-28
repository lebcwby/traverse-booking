/**
 * Push booktraverse.com listing URLs into the "Book Direct Link" custom
 * field on each Guesty listing. Built 2026-05-20 so the team doesn't have
 * to manually copy/paste URLs into each listing.
 *
 * SEMANTICS — IMPORTANT
 *   `patchListingCustomField` does read-modify-write: GET the listing's
 *   current customFields, swap in our entry, PUT the merged whole. Guesty's
 *   PUT REPLACES the entire customFields array — see
 *   docs/incidents/2026-05-20-customfields-wipe.md for the (painful) history.
 *
 * USAGE (browser, while logged in as an admin email):
 *
 *   /api/admin/sync-urls-to-guesty
 *     → DRY RUN. Returns what would be updated without writing anything.
 *       Safe to run anytime; nothing changes in Guesty.
 *
 *   /api/admin/sync-urls-to-guesty?limit=1&dryRun=false
 *     → REQUIRED FIRST STEP before any batch run. Patches exactly one
 *       listing, then manually verify in Guesty admin that ALL its other
 *       customFields (welcome message, phone, door codes, etc.) are still
 *       present. Only then proceed to the full sync.
 *
 *   /api/admin/sync-urls-to-guesty?dryRun=false
 *     → Patches all 366 listings' "Book Direct Link" custom field with
 *       their canonical booktraverse.com URL. ONLY run after the limit=1
 *       smoke test passes.
 *
 *   /api/admin/sync-urls-to-guesty?fieldName=Some+Other+Field
 *     → Override the default field name. Defaults to "Book Direct Link".
 *
 * Auth: same admin allowlist as reservation-tools (Supabase session for
 *       nadim@/ngtannous@/alex@/sabrina@ or Bearer CRON_SECRET).
 */

import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  authorizeAdminRequest,
  unauthorizedAdminResponse,
} from "@/lib/admin-auth";
import { getOpenAPIListingsPage } from "@/lib/guesty-openapi";
import { getListingSlug } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 min — 366 listings × ~500ms = ~3 min

const SITE_URL = "https://www.booktraverse.com";
// Default to the variable-key form (snake_case) since the user confirmed
// the field is referenced as `{{book_direct_link}}` in Guesty templates.
// The matcher also handles the display-name form ("Book Direct Link") and
// the template-syntax form (`{{book_direct_link}}`) — see normalizeName.
const DEFAULT_FIELD_NAME = "book_direct_link";

async function getOpenAPITokenForProbe(): Promise<string> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("guesty_tokens")
    .select("access_token")
    .eq("token_type", "openapi")
    .single();
  if (error || !data?.access_token) {
    throw new Error("OpenAPI token lookup failed");
  }
  return data.access_token;
}

/**
 * Find the Guesty custom-field _id for a given field name (e.g.
 * "Book Direct Link"). Discovery strategy:
 *
 *   1. Sample the first batch of listings (which include their full
 *      `customFields` array).
 *   2. Walk each listing's customFields entries and match on
 *      `field.name === fieldName` (Guesty embeds the field definition
 *      inline on each listing).
 *
 * Why not just hit GET /v1/custom-fields? Guesty's OpenAPI does NOT expose
 * a standalone "list custom fields" endpoint — the field definitions only
 * surface as embedded objects on listings. (Confirmed 2026-05-20: that
 * endpoint returns 404 "Cannot GET /api/v2/custom-fields".)
 *
 * If you already know the field ID (from the Guesty UI URL when editing
 * the field, e.g. `.../custom-fields/68abc...`), you can skip discovery
 * entirely by passing it as `?fieldId=<id>` on the route.
 */
/**
 * Normalize a field name/identifier for comparison.
 *   - strips `{{` and `}}` (Guesty's template-variable syntax)
 *   - lowercases
 *   - collapses spaces + underscores + hyphens to a single "_"
 *   - trims surrounding whitespace
 *
 * So all of these become "book_direct_link":
 *   "Book Direct Link"
 *   "book_direct_link"
 *   "{{book_direct_link}}"
 *   "book-direct-link"
 *   " Book  Direct  Link "
 */
function normalizeName(raw: string): string {
  return raw
    .replace(/[{}]+/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s\-_]+/g, "_");
}

async function findCustomFieldIdByScan(
  listings: GuestyListingForSync[],
  fieldName: string
): Promise<{ id: string; raw: Record<string, unknown> } | null> {
  const wanted = normalizeName(fieldName);
  for (const listing of listings) {
    if (!Array.isArray(listing.customFields)) continue;
    for (const cf of listing.customFields) {
      if (!cf || typeof cf !== "object") continue;
      const raw = cf as Record<string, unknown>;
      // Guesty's customField entry shapes seen in the wild:
      //   - { fieldId: "...", value: "...", field: { name, type } }
      //   - { _id: "...", value: "...", field: { name, type } }
      //   - { fieldId: "...", name: "...", value: "..." }  (older docs)
      const fieldMeta =
        (raw.field as Record<string, unknown> | undefined) || raw;
      // Try every plausible property where Guesty might store the name —
      // display name, key, internal name, variable, etc.
      const candidates: string[] = [];
      for (const src of [fieldMeta, raw]) {
        for (const key of ["name", "key", "internalName", "variable", "tag"]) {
          const v = (src as Record<string, unknown>)[key];
          if (typeof v === "string") candidates.push(v);
        }
      }
      const matches = candidates.some((c) => normalizeName(c) === wanted);
      if (!matches) continue;
      const id =
        (typeof raw.fieldId === "string" && raw.fieldId) ||
        (typeof raw._id === "string" && raw._id) ||
        (typeof fieldMeta._id === "string" && fieldMeta._id) ||
        null;
      if (id) return { id, raw };
    }
  }
  return null;
}

/**
 * Walk every listing's customFields and tabulate the distinct field
 * names + IDs we see. Useful for "I have no idea what my fields are
 * called in the API" debugging — call via ?action=list-fields.
 */
function listAllCustomFields(listings: GuestyListingForSync[]) {
  const seen = new Map<
    string,
    { name: string; id: string | null; count: number; sampleEntry: unknown }
  >();
  for (const listing of listings) {
    if (!Array.isArray(listing.customFields)) continue;
    for (const cf of listing.customFields) {
      if (!cf || typeof cf !== "object") continue;
      const raw = cf as Record<string, unknown>;
      const fieldMeta =
        (raw.field as Record<string, unknown> | undefined) || raw;
      const name =
        (typeof fieldMeta.name === "string" && fieldMeta.name) ||
        (typeof raw.name === "string" && raw.name) ||
        (typeof (fieldMeta as Record<string, unknown>).key === "string" &&
          ((fieldMeta as Record<string, unknown>).key as string)) ||
        "(no name)";
      const id =
        (typeof raw.fieldId === "string" && raw.fieldId) ||
        (typeof raw._id === "string" && raw._id) ||
        (typeof fieldMeta._id === "string" && fieldMeta._id) ||
        null;
      const key = `${name}|${id ?? "?"}`;
      const existing = seen.get(key);
      if (existing) {
        existing.count++;
      } else {
        seen.set(key, { name, id, count: 1, sampleEntry: cf });
      }
    }
  }
  return Array.from(seen.values()).sort((a, b) => b.count - a.count);
}

interface GuestyListingForSync {
  _id?: string;
  nickname?: string;
  title?: string;
  customFields?: Array<{ fieldId?: string; _id?: string; value?: unknown }>;
}

async function fetchAllListings(): Promise<GuestyListingForSync[]> {
  const out: GuestyListingForSync[] = [];
  const pageSize = 100;
  let skip = 0;
  for (let page = 0; page < 50; page++) {
    const response = (await getOpenAPIListingsPage({
      fields: "_id nickname title customFields",
      limit: pageSize,
      skip,
    })) as { results?: GuestyListingForSync[]; count?: number };
    const batch = Array.isArray(response?.results) ? response.results : [];
    if (batch.length === 0) break;
    out.push(...batch);
    skip += batch.length;
    if (batch.length < pageSize) break;
    if (typeof response.count === "number" && skip >= response.count) break;
  }
  return out;
}

/**
 * Read whatever value is currently stored on a listing's matching custom
 * field. Guesty stores customFields as `[{fieldId, value}]`. Some older
 * docs reference `_id` instead of `fieldId` — we accept both.
 */
function readExistingValue(
  listing: GuestyListingForSync,
  fieldId: string
): string | null {
  if (!Array.isArray(listing.customFields)) return null;
  for (const cf of listing.customFields) {
    const matchingId = cf.fieldId ?? cf._id;
    if (matchingId === fieldId) {
      return typeof cf.value === "string" ? cf.value : null;
    }
  }
  return null;
}

function buildListingUrl(listing: GuestyListingForSync): string | null {
  if (!listing._id) return null;
  const slug = getListingSlug(
    listing.title || listing.nickname || null,
    listing._id
  );
  return `${SITE_URL}/properties/${slug}`;
}

// Guesty's OpenAPI rate-limits at roughly 5 req/s burst. We throttle each
// PUT to ~3.3 req/s (300ms gap) to stay comfortably under the cliff. With
// 366 listings × ~500ms (network + 300ms gap) the full sync takes ~3 min.
const PUT_THROTTLE_MS = 300;

// Backoff schedule for 429 retries: 1s, 2s, 4s. After all three fail, give up
// on that listing — the re-run is idempotent so the next invocation will
// pick it up.
const RETRY_BACKOFFS_MS = [1000, 2000, 4000];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch the CURRENT customFields array for a single listing. Used by
 * patchListingCustomField to do read-modify-write so we don't clobber other
 * customFields.
 *
 * Why a fresh GET rather than reusing the bulk-fetched listing object?
 * The bulk fetch happens once at the top of the request; if a teammate edits
 * the listing in Guesty admin mid-run, the bulk data goes stale. A targeted
 * per-listing GET right before each PUT keeps the merge correct.
 */
async function fetchListingCustomFields(
  token: string,
  listingId: string
): Promise<Array<{ fieldId?: string; _id?: string; value?: unknown }>> {
  const res = await fetch(
    `https://open-api.guesty.com/v1/listings/${listingId}?fields=customFields`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Guesty GET failed for ${listingId}: ${res.status} ${text}`
    );
  }
  const json = (await res.json()) as { customFields?: unknown };
  return Array.isArray(json.customFields)
    ? (json.customFields as Array<{
        fieldId?: string;
        _id?: string;
        value?: unknown;
      }>)
    : [];
}

async function patchListingCustomField(
  token: string,
  listingId: string,
  fieldId: string,
  value: string
): Promise<void> {
  // Read-modify-write. Guesty's PUT /v1/listings/{id} REPLACES the entire
  // `customFields` array — it does NOT partial-merge by fieldId. (Confirmed
  // the hard way on 2026-05-20 — see docs/incidents/2026-05-20-customfields-wipe.md.)
  // So we always GET the current array, swap in our entry, and PUT the
  // merged whole.
  const existing = await fetchListingCustomFields(token, listingId);
  // Defensive: if any existing entry has no recognizable id, abort rather
  // than silently drop it on the PUT. Better to surface "unexpected shape"
  // than to repeat the 2026-05-20 wipe.
  const unidentified = existing.filter((cf) => !cf.fieldId && !cf._id);
  if (unidentified.length > 0) {
    throw new Error(
      `Aborting PUT for ${listingId}: ${unidentified.length} existing customField entries have no fieldId or _id; refusing to write a merge that would drop them.`
    );
  }
  const others = existing
    .map((cf) => ({
      fieldId: (cf.fieldId ?? cf._id) as string,
      value: cf.value,
    }))
    .filter((cf) => cf.fieldId !== fieldId);
  const merged = [...others, { fieldId, value }];

  for (let attempt = 0; attempt <= RETRY_BACKOFFS_MS.length; attempt++) {
    const res = await fetch(
      `https://open-api.guesty.com/v1/listings/${listingId}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ customFields: merged }),
      }
    );
    if (res.ok) return;
    // Retry on 429 (rate limit) and 5xx (transient server errors).
    const shouldRetry = res.status === 429 || res.status >= 500;
    const text = await res.text();
    if (!shouldRetry || attempt === RETRY_BACKOFFS_MS.length) {
      throw new Error(
        `Guesty PUT failed for ${listingId}: ${res.status} ${text}`
      );
    }
    const delay = RETRY_BACKOFFS_MS[attempt];
    console.warn(
      `[sync-urls] ${listingId} ${res.status} — retrying in ${delay}ms (attempt ${attempt + 1}/${RETRY_BACKOFFS_MS.length})`
    );
    await sleep(delay);
  }
}

export async function GET(request: Request) {
  if (!(await authorizeAdminRequest(request))) {
    return unauthorizedAdminResponse();
  }

  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dryRun") !== "false"; // SAFE DEFAULT
  const fieldName = url.searchParams.get("fieldName") || DEFAULT_FIELD_NAME;
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam ? Number(limitParam) : undefined;
  if (limitParam && (!Number.isFinite(limit) || limit! <= 0)) {
    return NextResponse.json(
      { error: "Invalid ?limit; must be a positive integer" },
      { status: 400 }
    );
  }

  let token: string;
  try {
    token = await getOpenAPITokenForProbe();
  } catch (err) {
    return NextResponse.json(
      {
        error: "OpenAPI token lookup failed",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }

  // 1) Enumerate listings first — we need them either way, and the field
  //    discovery scan walks their customFields arrays.
  let listings: GuestyListingForSync[];
  try {
    listings = await fetchAllListings();
  } catch (err) {
    return NextResponse.json(
      {
        error: "Failed to enumerate listings",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }

  // LIST-FIELDS MODE — return every distinct custom field name + ID we
  // found across all listings, sorted by frequency. Use this to confirm
  // the correct field name before running the sync.
  if (url.searchParams.get("action") === "list-fields") {
    return NextResponse.json({
      action: "list-fields",
      totalListings: listings.length,
      listingsWithCustomFields: listings.filter(
        (l) => Array.isArray(l.customFields) && l.customFields.length > 0
      ).length,
      fields: listAllCustomFields(listings),
    });
  }

  // INSPECT MODE — dump the customFields structure from the first few
  // listings that have any. Lets us see the actual shape Guesty returns,
  // so we can locate the field ID for "Book Direct Link" by eye.
  if (url.searchParams.get("action") === "inspect") {
    const sample = listings
      .filter((l) => Array.isArray(l.customFields) && l.customFields.length > 0)
      .slice(0, 5)
      .map((l) => ({
        listingId: l._id,
        nickname: l.nickname,
        title: l.title,
        customFields: l.customFields,
      }));
    return NextResponse.json({
      action: "inspect",
      totalListings: listings.length,
      listingsWithCustomFields: listings.filter(
        (l) => Array.isArray(l.customFields) && l.customFields.length > 0
      ).length,
      sample,
    });
  }

  // 2) Resolve the field ID — either from the explicit query param, or by
  //    scanning the listings we just fetched.
  let fieldId: string | null = url.searchParams.get("fieldId");
  let fieldMeta: Record<string, unknown> | null = null;
  if (!fieldId) {
    const found = await findCustomFieldIdByScan(listings, fieldName);
    if (!found) {
      return NextResponse.json(
        {
          error: `Custom field "${fieldName}" not found on any listing's customFields`,
          hint:
            "Either no listing has a value set for this field yet, or the field name doesn't match. " +
            "Run /api/admin/sync-urls-to-guesty?action=inspect to see the actual customFields structure, " +
            "then either fix the field name or pass ?fieldId=<id> explicitly.",
          listingsScanned: listings.length,
        },
        { status: 404 }
      );
    }
    fieldId = found.id;
    fieldMeta = found.raw;
  }

  if (limit !== undefined) listings = listings.slice(0, limit);

  // 3) For each, decide what to do
  type ResultRow = {
    listingId: string;
    nickname: string;
    title: string;
    desiredUrl: string;
    currentValue: string | null;
    action:
      | "skip-no-id"
      | "skip-already-correct"
      | "would-update"
      | "updated"
      | "error";
    error?: string;
  };

  const results: ResultRow[] = [];
  let updatedCount = 0;
  let skippedAlreadyCorrect = 0;
  let errorCount = 0;

  for (const listing of listings) {
    const id = listing._id;
    const nickname = listing.nickname ?? "";
    const title = listing.title ?? "";
    if (!id) {
      results.push({
        listingId: "(no _id)",
        nickname,
        title,
        desiredUrl: "",
        currentValue: null,
        action: "skip-no-id",
      });
      continue;
    }
    const desiredUrl = buildListingUrl(listing);
    if (!desiredUrl) {
      results.push({
        listingId: id,
        nickname,
        title,
        desiredUrl: "",
        currentValue: null,
        action: "skip-no-id",
      });
      continue;
    }
    const currentValue = readExistingValue(listing, fieldId);
    if (currentValue === desiredUrl) {
      skippedAlreadyCorrect++;
      results.push({
        listingId: id,
        nickname,
        title,
        desiredUrl,
        currentValue,
        action: "skip-already-correct",
      });
      continue;
    }

    if (dryRun) {
      results.push({
        listingId: id,
        nickname,
        title,
        desiredUrl,
        currentValue,
        action: "would-update",
      });
      continue;
    }

    try {
      await patchListingCustomField(token, id, fieldId, desiredUrl);
      updatedCount++;
      results.push({
        listingId: id,
        nickname,
        title,
        desiredUrl,
        currentValue,
        action: "updated",
      });
    } catch (err) {
      errorCount++;
      results.push({
        listingId: id,
        nickname,
        title,
        desiredUrl,
        currentValue,
        action: "error",
        error: err instanceof Error ? err.message : String(err),
      });
    }
    // Throttle between writes so we don't pound Guesty's rate limit. The
    // delay is inside the loop, after the request, so the last listing
    // doesn't have a trailing wait we don't need.
    await sleep(PUT_THROTTLE_MS);
  }

  return NextResponse.json({
    dryRun,
    fieldName,
    fieldId,
    fieldMeta: fieldMeta
      ? {
          name: fieldMeta.name,
          type: fieldMeta.type ?? fieldMeta.fieldType,
          objectType: fieldMeta.objectType,
        }
      : {
          source:
            "?fieldId query param (manual override, metadata not fetched)",
        },
    totalListings: listings.length,
    updatedCount,
    skippedAlreadyCorrect,
    wouldUpdateCount: results.filter((r) => r.action === "would-update").length,
    errorCount,
    results,
  });
}
