const WHEELHOUSE_RM_API_BASE = "https://api.usewheelhouse.com/ss_api/v1";
const DEFAULT_PAGE_SIZE = 100;

type QueryValue =
  | string
  | number
  | boolean
  | Array<string | number | boolean>
  | undefined;

export interface WheelhouseListingPreference extends Record<string, unknown> {
  listing_id?: number;
  partner_listing_id?: string;
  automatic_rate_posting_enabled?: boolean;
  base_price?: number;
  base_price_adjustment?: number;
  monthly_discount?: number;
  weekly_discount?: number;
  currency?: string;
  nickname?: string;
  weekend_factor?: number;
  last_minute_discount?: Record<string, unknown> | null;
  far_future_premium?: Record<string, unknown> | null;
  seasonality_adjustment?: Record<string, unknown> | null;
  day_of_week?: Record<string, unknown> | null;
  gap_night?: Record<string, unknown> | null;
  minimum_stay_rules_v3?: unknown[];
  min_stays_enabled?: boolean;
  minimum_price_rules_v3?: unknown[];
  maximum_price_rules_v3?: unknown[];
  checkin_checkout?: string;
  long_term_discounts?: Record<string, unknown> | null;
  occupancy_pacing?: Record<string, unknown> | null;
  demand_sensitivity_rules?: unknown[];
  historical_anchoring_rules?: unknown[];
  custom_date_ranges?: unknown[];
  min_min_price?: number;
  min_min_stay?: number;
  notes?: unknown[];
  onboarding_finished?: boolean;
  update_from?: string;
  update_from_id?: number;
  created_at?: string;
  updated_at?: string;
  valid_until?: string;
}

export interface WheelhouseListing extends Record<string, unknown> {
  id: string;
  wheelhouse_id?: number;
  base_min_night_stay?: number;
  currency?: string;
  title?: string;
  owner_name?: string;
  description?: string;
  nickname?: string;
  num_bathrooms?: number;
  num_bedrooms?: number;
  room_type?: string;
  property_type?: string;
  channel?: string;
  is_active?: boolean;
  channel_ids?: Record<string, string>;
  location?: Record<string, unknown> | null;
  amenities?: string[];
  num_beds?: number;
  num_reviews?: number;
  star_rating?: number;
  num_photos?: number;
  security_deposit?: number;
  source_user_id?: number;
  thumb_url?: string;
  listing_preferences?: WheelhouseListingPreference | null;
  meta?: Record<string, unknown> | null;
  market_id?: number;
  links?: Record<string, unknown> | null;
  wheelhouse_created_at?: string;
  in_market?: boolean;
}

export interface WheelhouseListingSnapshot extends Record<string, unknown> {
  synced_at: string;
  partner_listing_id: string;
  guesty_id: string | null;
  wheelhouse_id: number | null;
  channel: string | null;
  channel_ids: Record<string, string> | null;
  currency: string | null;
  links: Record<string, unknown> | null;
  base_price: number | null;
  base_price_adjustment: number | null;
  monthly_discount: number | null;
  weekly_discount: number | null;
  weekend_factor: number | null;
  min_min_price: number | null;
  min_min_stay: number | null;
  min_stays_enabled: boolean | null;
  automatic_rate_posting_enabled: boolean | null;
  checkin_checkout: string | null;
  long_term_discounts: Record<string, unknown> | null;
  minimum_price_rules_v3: unknown[] | null;
  maximum_price_rules_v3: unknown[] | null;
  minimum_stay_rules_v3: unknown[] | null;
  occupancy_pacing: Record<string, unknown> | null;
  demand_sensitivity_rules: unknown[] | null;
  historical_anchoring_rules: unknown[] | null;
  custom_date_ranges: unknown[] | null;
  last_minute_discount: Record<string, unknown> | null;
  far_future_premium: Record<string, unknown> | null;
  seasonality_adjustment: Record<string, unknown> | null;
  day_of_week: Record<string, unknown> | null;
  gap_night: Record<string, unknown> | null;
  update_from: string | null;
  update_from_id: number | null;
  created_at: string | null;
  updated_at: string | null;
  valid_until: string | null;
  listing: Record<string, unknown>;
  preferences: WheelhouseListingPreference | null;
}

function nullable<T>(value: T | null | undefined): T | null {
  return value === null || value === undefined ? null : value;
}

function getWheelhouseAuthHeaders(): Record<string, string> {
  const integrationKey = process.env.WHEELHOUSE_RM_API_KEY;
  if (integrationKey) {
    return { "X-Integration-Api-Key": integrationKey };
  }

  const userApiKey = process.env.WHEELHOUSE_USER_API_KEY;
  const userAccessKey = process.env.WHEELHOUSE_USER_ACCESS_KEY;
  if (userApiKey && userAccessKey) {
    return {
      "X-User-Api-Key": userApiKey,
      "X-User-Access-Key": userAccessKey,
    };
  }

  throw new Error(
    "Wheelhouse auth not configured: set WHEELHOUSE_RM_API_KEY, or WHEELHOUSE_USER_API_KEY + WHEELHOUSE_USER_ACCESS_KEY"
  );
}

function buildWheelhouseUrl(path: string, query?: Record<string, QueryValue>) {
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
  const url = new URL(normalizedPath, `${WHEELHOUSE_RM_API_BASE}/`);

  if (!query) return url;

  for (const [key, rawValue] of Object.entries(query)) {
    if (rawValue === undefined) continue;

    if (Array.isArray(rawValue)) {
      for (const item of rawValue) {
        url.searchParams.append(key, String(item));
      }
      continue;
    }

    url.searchParams.set(key, String(rawValue));
  }

  return url;
}

async function wheelhouseFetch<T>(
  path: string,
  query?: Record<string, QueryValue>,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(buildWheelhouseUrl(path, query), {
    ...init,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      ...getWheelhouseAuthHeaders(),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Wheelhouse RM API request failed: ${response.status} ${body}`
    );
  }

  return response.json() as Promise<T>;
}

export function chunkArray<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items];

  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function normalizeChannelIds(
  channelIds: unknown
): Record<string, string> | null {
  if (
    !channelIds ||
    typeof channelIds !== "object" ||
    Array.isArray(channelIds)
  ) {
    return null;
  }

  const normalized = Object.fromEntries(
    Object.entries(channelIds).flatMap(([key, value]) => {
      if (typeof value === "string" && value.trim()) return [[key, value]];
      if (typeof value === "number") return [[key, String(value)]];
      return [];
    })
  );

  return Object.keys(normalized).length > 0 ? normalized : null;
}

function findChannelId(
  channelIds: Record<string, string> | null,
  channelName: string
) {
  if (!channelIds) return null;

  const matchedEntry = Object.entries(channelIds).find(
    ([key, value]) =>
      key.toLowerCase() === channelName.toLowerCase() && value.trim()
  );

  return matchedEntry?.[1] ?? null;
}

export function getWheelhouseGuestyId(listing: WheelhouseListing) {
  const channelIds = normalizeChannelIds(listing.channel_ids);
  return findChannelId(channelIds, "guesty") ?? listing.id ?? null;
}

export async function listAllWheelhouseListings(options?: {
  excludeInactive?: boolean;
  perPage?: number;
  maxListings?: number;
}) {
  const perPage = options?.perPage ?? DEFAULT_PAGE_SIZE;
  const listings: WheelhouseListing[] = [];
  let offset = 0;

  while (true) {
    const page = await wheelhouseFetch<WheelhouseListing[]>("/listings", {
      exclude_inactive: options?.excludeInactive ?? false,
      per_page: perPage,
      offset,
    });

    listings.push(...page);

    if (options?.maxListings && listings.length >= options.maxListings) {
      return listings.slice(0, options.maxListings);
    }

    if (page.length < perPage) {
      return listings;
    }

    offset += page.length;
  }
}

export async function getWheelhousePreferencesByListingIds(
  listingIds: string[],
  batchSize = DEFAULT_PAGE_SIZE
) {
  const dedupedIds = Array.from(new Set(listingIds.filter(Boolean)));
  const preferenceMap = new Map<string, WheelhouseListingPreference>();

  for (const batch of chunkArray(dedupedIds, batchSize)) {
    if (batch.length === 0) continue;

    const preferences = await wheelhouseFetch<WheelhouseListingPreference[]>(
      "/preferences",
      {
        "listing_ids[]": batch,
      }
    );

    for (const preference of preferences) {
      const partnerListingId = preference.partner_listing_id;
      if (partnerListingId) {
        preferenceMap.set(partnerListingId, preference);
      }
    }
  }

  return preferenceMap;
}

export function buildWheelhouseSnapshot(
  listing: WheelhouseListing,
  preference?: WheelhouseListingPreference | null,
  syncedAt = new Date().toISOString()
): WheelhouseListingSnapshot {
  const resolvedPreferences = preference ?? listing.listing_preferences ?? null;
  const channelIds = normalizeChannelIds(listing.channel_ids);

  return {
    synced_at: syncedAt,
    partner_listing_id: listing.id,
    guesty_id: getWheelhouseGuestyId(listing),
    wheelhouse_id: nullable(listing.wheelhouse_id),
    channel: nullable(listing.channel),
    channel_ids: channelIds,
    currency: nullable(resolvedPreferences?.currency ?? listing.currency),
    links: nullable(listing.links),
    base_price: nullable(resolvedPreferences?.base_price),
    base_price_adjustment: nullable(resolvedPreferences?.base_price_adjustment),
    monthly_discount: nullable(resolvedPreferences?.monthly_discount),
    weekly_discount: nullable(resolvedPreferences?.weekly_discount),
    weekend_factor: nullable(resolvedPreferences?.weekend_factor),
    min_min_price: nullable(resolvedPreferences?.min_min_price),
    min_min_stay: nullable(resolvedPreferences?.min_min_stay),
    min_stays_enabled: nullable(resolvedPreferences?.min_stays_enabled),
    automatic_rate_posting_enabled: nullable(
      resolvedPreferences?.automatic_rate_posting_enabled
    ),
    checkin_checkout: nullable(resolvedPreferences?.checkin_checkout),
    long_term_discounts: nullable(resolvedPreferences?.long_term_discounts),
    minimum_price_rules_v3: nullable(
      resolvedPreferences?.minimum_price_rules_v3
    ),
    maximum_price_rules_v3: nullable(
      resolvedPreferences?.maximum_price_rules_v3
    ),
    minimum_stay_rules_v3: nullable(resolvedPreferences?.minimum_stay_rules_v3),
    occupancy_pacing: nullable(resolvedPreferences?.occupancy_pacing),
    demand_sensitivity_rules: nullable(
      resolvedPreferences?.demand_sensitivity_rules
    ),
    historical_anchoring_rules: nullable(
      resolvedPreferences?.historical_anchoring_rules
    ),
    custom_date_ranges: nullable(resolvedPreferences?.custom_date_ranges),
    last_minute_discount: nullable(resolvedPreferences?.last_minute_discount),
    far_future_premium: nullable(resolvedPreferences?.far_future_premium),
    seasonality_adjustment: nullable(
      resolvedPreferences?.seasonality_adjustment
    ),
    day_of_week: nullable(resolvedPreferences?.day_of_week),
    gap_night: nullable(resolvedPreferences?.gap_night),
    update_from: nullable(resolvedPreferences?.update_from),
    update_from_id: nullable(resolvedPreferences?.update_from_id),
    created_at: nullable(resolvedPreferences?.created_at),
    updated_at: nullable(resolvedPreferences?.updated_at),
    valid_until: nullable(resolvedPreferences?.valid_until),
    listing: {
      title: nullable(listing.title),
      nickname: nullable(listing.nickname),
      owner_name: nullable(listing.owner_name),
      description: nullable(listing.description),
      property_type: nullable(listing.property_type),
      room_type: nullable(listing.room_type),
      num_bedrooms: nullable(listing.num_bedrooms),
      num_bathrooms: nullable(listing.num_bathrooms),
      num_beds: nullable(listing.num_beds),
      base_min_night_stay: nullable(listing.base_min_night_stay),
      num_reviews: nullable(listing.num_reviews),
      star_rating: nullable(listing.star_rating),
      num_photos: nullable(listing.num_photos),
      security_deposit: nullable(listing.security_deposit),
      source_user_id: nullable(listing.source_user_id),
      thumb_url: nullable(listing.thumb_url),
      market_id: nullable(listing.market_id),
      is_active: nullable(listing.is_active),
      in_market: nullable(listing.in_market),
      location: nullable(listing.location),
      amenities: nullable(listing.amenities),
      wheelhouse_created_at: nullable(listing.wheelhouse_created_at),
    },
    preferences: resolvedPreferences,
  };
}
