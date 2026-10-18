/**
 * Live quote + checkout handoff for AI agents. Phase 7 of
 * docs/phase2-ai-agent-booking.md.
 *
 * ── How this differs from every other /agent/v1 endpoint ────────────────
 *
 * Phases 6 and 8 read Postgres and never touch Guesty. THIS ONE CALLS GUESTY.
 * It is the only agent endpoint that spends our ~120 req/min BEAPI budget, so
 * it is gated harder than the read endpoints: a known-listing check before the
 * call, a tighter edge rate limit, and a stay-length cap.
 *
 * The numbers it returns are also categorically different. A search result is
 * an accommodation-only figure from a ~5h-old cache. A quote is a real, all-in
 * total that Guesty computed just now, including cleaning and taxes — so it
 * must NOT carry AGENT_DISCLOSURE, which says the opposite. QUOTE_TERMS below
 * is the honest contract for a live quote.
 *
 * ── The agent never takes payment ───────────────────────────────────────
 *
 * We return a `checkoutUrl` and stop. The guest opens it, and the existing
 * Stripe checkout and finalizer run exactly as they do for a human — no change
 * to checkout, payment-intent creation, finalizeReservation or payment
 * recording. Given this project's money-path history, that property is the
 * point, not an accident.
 *
 * ── Attribution rides the existing utm pipeline, deliberately ───────────
 *
 * The design sketch proposed `?src=agent&agent=<slug>`, which nothing in the
 * app reads. Instead the checkout URL carries real `utm_*` params, because
 * proxy.ts already captures those into the `_sp_attribution` cookie, which
 * already flows into `pending_checkouts.tracking`, GA4 and the `reservations`
 * row. So agent attribution works end to end with ZERO new columns.
 *
 * That also sidesteps a known trap: per
 * feedback_guesty_webhook_drops_source_column, the Guesty webhook upsert
 * enumerates columns by hand and silently dropped `source` for 402 rows. A new
 * attribution column would have had to be added to both branches of that
 * upsert. Reusing utm means there is no new column to drop.
 */
import { SITE_ORIGIN } from "./listing-jsonld";
import { extractQuotePricing, getQuoteIdentifiers } from "./quote-response";
import type { PublicListing } from "./agent-api";

/** Longest stay we will quote in one request. Mirrors MAX_STAY_NIGHTS. */
export const MAX_QUOTE_NIGHTS = 30;

/** Most guests we will accept before treating the input as nonsense. */
export const MAX_QUOTE_GUESTS = 50;

/**
 * What a live quote actually promises.
 *
 * Distinct from AGENT_DISCLOSURE on purpose: that one disclaims a cached,
 * accommodation-only estimate. This figure is all-in and was computed by
 * Guesty seconds ago, so an agent may quote it to a traveller — with the two
 * caveats that it expires, and that checkout recomputes it.
 */
export const QUOTE_TERMS = {
  priceBasis: "all-in",
  includes: ["accommodation", "cleaning fee", "taxes"],
  // No pet fee. The website charges nothing for pets as of 2026-10-17 —
  // guests disclose and pay any fee through the guest portal after booking,
  // so an agent quote is complete without one.
  excludes: ["optional extras selected at checkout"],
  authoritative: true,
  authoritativeUntil: "expiresAt",
  petPolicy:
    "No pet fee is charged by this API or at checkout. Bringing a pet? The guest discloses it and pays any pet fee through their guest portal after booking, and pets are only allowed at pet-friendly homes (see petsAllowed on the listing).",
  note: "This is a live quote from the property management system, including cleaning and taxes, and is the amount payable if the guest checks out before it expires. The checkout page re-fetches the quote and is the final authority: if rates moved in between, the guest pays the re-fetched price. Send the guest to checkoutUrl — this API cannot take payment.",
} as const;

/**
 * An agent identifier is allowed into `utm_source`, so keep it boring:
 * lowercase, digits, and separators. URLSearchParams encodes the value anyway,
 * so this is about not poisoning GA4 reports with junk dimensions rather than
 * about injection.
 */
const AGENT_SLUG = /^[a-z0-9][a-z0-9._-]{0,39}$/;

export function isValidAgentSlug(slug: string): boolean {
  return AGENT_SLUG.test(slug);
}

/**
 * Where we send the guest. `utm_source` identifies the assistant when it told
 * us who it is, and falls back to a generic marker so agent traffic is still
 * separable in GA4 from an unattributed direct visit.
 */
export function buildCheckoutUrl(quoteId: string, agentSlug?: string): string {
  const url = new URL(`/book/${encodeURIComponent(quoteId)}`, SITE_ORIGIN);
  url.searchParams.set("utm_source", agentSlug || "ai-agent");
  url.searchParams.set("utm_medium", "ai_agent");
  url.searchParams.set("utm_campaign", "agent_api");
  return url.toString();
}

/**
 * Read the quote's expiry.
 *
 * Measured against the live API on 2026-10-13: BEAPI returns a top-level
 * `expiresAt`, exactly 24h after `createdAt`. Earlier notes in the design doc
 * claimed no expiry field existed — that was inferred from our own normalizer
 * dropping it, not from the API, and it was wrong.
 *
 * Still parsed defensively: if Guesty ever stops sending it we omit the field
 * rather than publish a computed guess, because an agent holding a quote it
 * believes is valid for 24h is worse than one that was told nothing.
 */
export function readQuoteExpiry(
  quote: Record<string, unknown>,
  now = Date.now()
): { expiresAt: string; expiresInSeconds: number } | null {
  const raw = quote.expiresAt;
  if (typeof raw !== "string" || !raw) return null;
  const ms = Date.parse(raw);
  if (!Number.isFinite(ms)) return null;
  return {
    expiresAt: new Date(ms).toISOString(),
    // Floor at zero: a negative TTL would read as a huge unsigned value to a
    // careless client, and "already expired" is the useful signal.
    expiresInSeconds: Math.max(0, Math.round((ms - now) / 1000)),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Surface a discount when a promotion reduced the fare.
 *
 * Worth publishing: on a verified quote a 10% early-bird promotion took the
 * accommodation fare from $337.20 to $303.48, and an agent that cannot see it
 * cannot tell the traveller they are getting a deal.
 *
 * ⚠️ The promotion's NAME is deliberately withheld. Guesty promo names are
 * internal strings ("EB - All Units"), and the same reasoning that keeps
 * `tags` out of the listing payload — live values include owner and vendor
 * names — applies here. The amount is the useful part and carries no
 * internal detail.
 */
function discountFields(
  fare: number,
  adjusted: number
): { accommodationBeforeDiscount?: number; discount?: number } {
  // Only when there is a real reduction. Guesty leaves `adjusted` at 0 when no
  // promotion applied, and a promotion can never increase the fare.
  if (!adjusted || !fare || adjusted >= fare) return {};
  return {
    accommodationBeforeDiscount: round2(fare),
    discount: round2(fare - adjusted),
  };
}

/** Currency lives on the rate plan's money object; USD everywhere today. */
function readCurrency(quote: Record<string, unknown>): string {
  const rates = quote.rates as
    | { ratePlans?: Array<{ ratePlan?: { money?: { currency?: unknown } } }> }
    | undefined;
  const c = rates?.ratePlans?.[0]?.ratePlan?.money?.currency;
  return typeof c === "string" && c ? c : "USD";
}

export interface AgentQuote {
  quoteId: string;
  listingId: string;
  listingName: string;
  listingUrl: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  currency: string;
  /**
   * Every member reconciles: accommodation + cleaning + taxes = total.
   *
   * ⚠️ Deliberately does NOT carry a per-night array. BEAPI's `days[].price`
   * is the PUBLISHED nightly rate (what the calendar and /availability show),
   * not a breakdown of the accommodation fare — on a verified quote the nights
   * summed to $284 while the accommodation fare was $337.20 before a discount.
   * Nesting a non-summing array inside this object would invite an agent to
   * present "$92 + $96 + $96" beside an accommodation figure of $303.48 and
   * leave a traveller asking which is real. Per-night detail belongs to
   * /agent/v1/listings/{id}/availability, which is labelled indicative.
   */
  price: {
    accommodation: number;
    /** Pre-discount fare. Present only when a promotion applied. */
    accommodationBeforeDiscount?: number;
    /** Amount knocked off the fare. Present only when a promotion applied. */
    discount?: number;
    cleaning: number;
    taxes: number;
    total: number;
  };
  expiresAt?: string;
  expiresInSeconds?: number;
  checkoutUrl: string;
  terms: typeof QUOTE_TERMS;
}

/**
 * Shape a BEAPI quote for public consumption.
 *
 * Reuses extractQuotePricing — the same function the website's own checkout
 * reads — so an agent and a human are shown numbers derived identically. The
 * raw quote is NOT passed through: it carries accountId, unitTypeId, internal
 * rate-plan structures and invoice-item metadata that no agent needs.
 */
export function toAgentQuote(
  raw: unknown,
  listing: PublicListing,
  agentSlug?: string,
  now = Date.now()
): AgentQuote {
  const quote = (raw ?? {}) as Record<string, unknown>;
  const pricing = extractQuotePricing(quote);
  const { quoteId } = getQuoteIdentifiers(quote);
  const expiry = readQuoteExpiry(quote, now);

  return {
    quoteId,
    listingId: listing.id,
    listingName: listing.name,
    listingUrl: listing.url,
    checkIn: String(quote.checkInDateLocalized ?? quote.checkIn ?? ""),
    checkOut: String(quote.checkOutDateLocalized ?? quote.checkOut ?? ""),
    nights: pricing.nights,
    guests: Number(quote.guestsCount ?? quote.numberOfGuests ?? 0),
    currency: readCurrency(quote),
    price: {
      // accommodationAdjusted is post-promotion and is what the guest pays;
      // fall back to the unadjusted figure when no promotion applied.
      accommodation: round2(
        pricing.accommodationAdjusted || pricing.accommodation
      ),
      ...discountFields(pricing.accommodation, pricing.accommodationAdjusted),
      cleaning: round2(pricing.cleaning),
      taxes: round2(pricing.taxes),
      total: round2(pricing.total),
    },
    ...(expiry ?? {}),
    checkoutUrl: buildCheckoutUrl(quoteId, agentSlug),
    terms: QUOTE_TERMS,
  };
}
