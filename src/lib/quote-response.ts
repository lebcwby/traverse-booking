export interface QuotePromotion {
  name: string;
  type: string;
}

export interface QuoteTaxLineItem {
  /** Display label (e.g. "STATE TAX", "TRANSIENT OCCUPANCY TAX"). */
  name: string;
  /** Dollar amount for this specific tax on this stay. */
  amount: number;
}

export interface QuotePricing {
  nights: number;
  accommodation: number;
  accommodationAdjusted: number;
  cleaning: number;
  taxes: number;
  /**
   * Per-tax breakdown extracted from the BEAPI invoice items
   * (e.g. state tax, transient occupancy tax, county tax). Surfaced in the
   * checkout PriceBreakdown so guests can see exactly which taxes apply.
   * Added 2026-05-20.
   */
  taxBreakdown?: QuoteTaxLineItem[];
  total: number;
  days: Array<{ date: string; price: number }>;
  invoiceItems?: Array<{ title: string; amount: number; type: string; isTax?: boolean; normalType?: string }>;
}

/**
 * Plain-English mapping for the tax titles Guesty hands us. Keyed by the
 * lowercased+collapsed form so STATE_TAX, "State Tax", and "STATE TAX" all
 * hit the same entry. Unknown titles fall through to title-casing.
 */
const FRIENDLY_TAX_LABELS: Record<string, string> = {
  state_tax: "State sales tax",
  st: "State sales tax",
  county_tax: "County tax",
  cot: "County tax",
  city_tax: "City tax",
  local_tax: "City tax",
  lt: "City tax",
  transient_occupancy_tax: "Lodging tax (transient occupancy)",
  tot: "Lodging tax (transient occupancy)",
  occupancy_tax: "Lodging tax (transient occupancy)",
  tourism_tax: "Tourism tax",
  sales_tax: "Sales tax",
};

/**
 * Convert Guesty's UPPER_SNAKE_CASE tax titles into a friendlier display
 * label. Tries the FRIENDLY_TAX_LABELS dictionary first; falls back to
 * Title Case (e.g. "TRANSIENT_OCCUPANCY_TAX" → "Transient Occupancy Tax").
 */
function humanizeTaxLabel(raw: string): string {
  if (!raw) return "Tax";
  const key = raw
    .replace(/[^a-zA-Z0-9_\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (FRIENDLY_TAX_LABELS[key]) return FRIENDLY_TAX_LABELS[key];
  return raw
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Pull individual tax line items out of an invoiceItems array. Recognizes
 * Guesty's `isTax: true` flag, the explicit `type: "TAX"`, and tax
 * `normalType` codes (TOT, ST, COT). Returns null when no tax items found
 * so the breakdown UI can fall back to the flat `taxes` total.
 */
function extractTaxBreakdown(
  invoiceItems: unknown[] | undefined
): QuoteTaxLineItem[] | undefined {
  if (!Array.isArray(invoiceItems)) return undefined;
  const TAX_NORMAL_TYPES = new Set(["TOT", "ST", "COT", "LT", "TAX"]);
  const items: QuoteTaxLineItem[] = [];
  for (const raw of invoiceItems) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const isTax =
      item.isTax === true ||
      item.type === "TAX" ||
      (typeof item.normalType === "string" &&
        TAX_NORMAL_TYPES.has(item.normalType));
    if (!isTax) continue;
    const amount = Number(item.amount ?? 0);
    if (!Number.isFinite(amount) || amount === 0) continue;
    const title = typeof item.title === "string" ? item.title : "Tax";
    items.push({ name: humanizeTaxLabel(title), amount });
  }
  return items.length > 0 ? items : undefined;
}

function normalizePromotion(raw: unknown): QuotePromotion | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || typeof value !== "object") return undefined;

  const promotion = value as Record<string, unknown>;
  const name =
    typeof promotion.name === "string"
      ? promotion.name
      : typeof promotion.code === "string"
        ? promotion.code
        : typeof promotion.title === "string"
          ? promotion.title
          : null;

  if (!name) return undefined;

  return {
    name,
    type:
      typeof promotion.type === "string"
        ? promotion.type
        : typeof promotion.discountType === "string"
          ? promotion.discountType
          : "",
  };
}

export function extractQuotePricing(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  quoteResponse: any
): QuotePricing & { promotion?: QuotePromotion } {
  if (quoteResponse?.pricing) {
    const invoiceItems = Array.isArray(quoteResponse.pricing.invoiceItems)
      ? quoteResponse.pricing.invoiceItems
      : undefined;
    return {
      nights: Number(quoteResponse.pricing.nights || 0),
      accommodation: Number(quoteResponse.pricing.accommodation || 0),
      accommodationAdjusted: Number(
        quoteResponse.pricing.accommodationAdjusted || 0
      ),
      cleaning: Number(quoteResponse.pricing.cleaning || 0),
      taxes: Number(quoteResponse.pricing.taxes || 0),
      taxBreakdown: extractTaxBreakdown(invoiceItems),
      total: Number(quoteResponse.pricing.total || 0),
      days: Array.isArray(quoteResponse.pricing.days)
        ? quoteResponse.pricing.days
        : [],
      invoiceItems,
      promotion: normalizePromotion(
        quoteResponse.promotion ?? quoteResponse.promotions
      ),
    };
  }

  const rp = quoteResponse?.rates?.ratePlans?.[0];
  if (!rp?.ratePlan?.money) {
    throw new Error("No rate plan in quote response");
  }

  const money = rp.ratePlan.money;
  const days = Array.isArray(rp.days) ? rp.days : [];

  const invoiceItems = Array.isArray(money.invoiceItems)
    ? money.invoiceItems
    : undefined;
  return {
    nights: days.length,
    accommodation: Number(money.fareAccommodation || 0),
    accommodationAdjusted: Number(money.fareAccommodationAdjusted || 0),
    cleaning: Number(money.fareCleaning || 0),
    taxes: Number(money.totalTaxes || 0),
    taxBreakdown: extractTaxBreakdown(invoiceItems),
    total: Number(money.hostPayout || 0),
    days,
    invoiceItems,
    promotion: normalizePromotion(quoteResponse.promotions),
  };
}

export function getQuoteIdentifiers(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  quoteResponse: any
) {
  return {
    quoteId: String(
      quoteResponse?.quoteId || quoteResponse?._id || quoteResponse?.id || ""
    ),
    ratePlanId: String(
      quoteResponse?.ratePlanId ||
        quoteResponse?.pricing?.ratePlanId ||
        quoteResponse?.rates?.ratePlans?.[0]?.ratePlan?._id ||
        ""
    ),
  };
}

export function buildNormalizedQuoteResponse(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  quoteResponse: any,
  listing?: {
    title?: string | null;
    nickname?: string | null;
    picture?: string | null;
    pictures?: string[] | null;
    property_type?: string | null;
    address?: { city?: string | null } | null;
  } | null
) {
  const { promotion, ...pricing } = extractQuotePricing(quoteResponse);
  const { quoteId, ratePlanId } = getQuoteIdentifiers(quoteResponse);

  return {
    quoteId,
    ratePlanId,
    listingId: String(
      quoteResponse?.listingId || quoteResponse?.unitTypeId || ""
    ),
    listingTitle: listing?.title || listing?.nickname || "",
    listingNickname: listing?.nickname || null,
    picture: listing?.picture || listing?.pictures?.[0] || null,
    propertyType: listing?.property_type || null,
    city: listing?.address?.city || null,
    checkIn: String(
      quoteResponse?.checkIn || quoteResponse?.checkInDateLocalized || ""
    ),
    checkOut: String(
      quoteResponse?.checkOut || quoteResponse?.checkOutDateLocalized || ""
    ),
    guests: Number(quoteResponse?.guests || quoteResponse?.guestsCount || 0),
    pricing,
    promotion,
  };
}
