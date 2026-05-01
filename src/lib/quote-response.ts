export interface QuotePromotion {
  name: string;
  type: string;
}

export interface QuotePricing {
  nights: number;
  accommodation: number;
  accommodationAdjusted: number;
  cleaning: number;
  taxes: number;
  total: number;
  days: Array<{ date: string; price: number }>;
  invoiceItems?: Array<{ title: string; amount: number; type: string }>;
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
    return {
      nights: Number(quoteResponse.pricing.nights || 0),
      accommodation: Number(quoteResponse.pricing.accommodation || 0),
      accommodationAdjusted: Number(
        quoteResponse.pricing.accommodationAdjusted || 0
      ),
      cleaning: Number(quoteResponse.pricing.cleaning || 0),
      taxes: Number(quoteResponse.pricing.taxes || 0),
      total: Number(quoteResponse.pricing.total || 0),
      days: Array.isArray(quoteResponse.pricing.days)
        ? quoteResponse.pricing.days
        : [],
      invoiceItems: Array.isArray(quoteResponse.pricing.invoiceItems)
        ? quoteResponse.pricing.invoiceItems
        : undefined,
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

  return {
    nights: days.length,
    accommodation: Number(money.fareAccommodation || 0),
    accommodationAdjusted: Number(money.fareAccommodationAdjusted || 0),
    cleaning: Number(money.fareCleaning || 0),
    taxes: Number(money.totalTaxes || 0),
    total: Number(money.hostPayout || 0),
    days,
    invoiceItems: Array.isArray(money.invoiceItems)
      ? money.invoiceItems
      : undefined,
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
