// Batch quoting for the multi-listing cart. Hits BEAPI's createQuote in
// parallel for every cart line and returns:
//  - per-line quote results (or per-line error if a single quote failed)
//  - aggregated totals across all successful quotes
//
// Single-line failures are not fatal — the cart UI shows a per-line error
// state (e.g., "Dates unavailable for Plaza 233") and the user can fix or
// remove that line without losing the rest of the cart.
//
// Phase 2 (real checkout) will re-quote one more time right before charging
// to catch any "dates went unavailable in the last 60 seconds" race.

import { NextRequest, NextResponse } from "next/server";
import { createQuote } from "@/lib/guesty-beapi";

interface BatchQuoteLine {
  /** Cart-line id from the client; echoed back so the client can correlate. */
  lineId: string;
  listingId: string;
  checkIn: string;
  checkOut: string;
  guestsCount: number;
  pointofsale?: string;
}

interface BatchQuoteRequest {
  lines?: BatchQuoteLine[];
  pointofsale?: string;
}

// Trimmed quote shape — we only forward the bits the cart UI needs to
// render. Full quote details come back in Phase 2 at /cart/checkout time.
// `ratePlanId` is included so Phase 2's reservation-creation flow can
// pass it straight to BEAPI's createReservationInstant without a re-quote.
interface PublicQuoteSummary {
  quoteId: string;
  ratePlanId: string;
  hostPayout: number;
  fareAccommodation: number;
  fareCleaning: number;
  totalTaxes: number;
  currency: string;
  nights: number;
}

interface BatchQuoteLineResult {
  lineId: string;
  ok: boolean;
  quote?: PublicQuoteSummary;
  /** Trimmed BEAPI error string when ok=false. The cart UI sniffs this for
   * substrings like LISTING_IS_NOT_AVAILABLE / WRONG_REQUEST_PARAMETERS to
   * pick a friendly message — same pattern the single-listing booking
   * sidebar already uses. */
  error?: string;
}

interface BatchQuoteResponse {
  results: BatchQuoteLineResult[];
  /** Aggregated totals across successful quotes only. */
  totals: {
    hostPayout: number;
    fareAccommodation: number;
    fareCleaning: number;
    totalTaxes: number;
    nights: number;
    currency: string;
    successCount: number;
    failureCount: number;
  };
}

function nightsBetween(checkIn: string, checkOut: string): number {
  const a = new Date(`${checkIn}T12:00:00Z`).getTime();
  const b = new Date(`${checkOut}T12:00:00Z`).getTime();
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

// Shape mirrors what the single-listing booking sidebar reads —
// `rates.ratePlans[0].ratePlan.money` (note the nested .ratePlan step;
// money is NOT directly under the ratePlans entry). Same for `days[]`,
// which is the authoritative night count from BEAPI.
interface RawQuote {
  _id?: string;
  id?: string;
  rates?: {
    ratePlans?: Array<{
      ratePlan?: {
        _id?: string;
        money?: {
          hostPayout?: number;
          fareAccommodation?: number;
          fareAccommodationAdjusted?: number;
          fareCleaning?: number;
          totalTaxes?: number;
          currency?: string;
        };
      };
      days?: unknown[];
    }>;
  };
}

function summarizeQuote(
  raw: RawQuote,
  fallbackNights: number
): (PublicQuoteSummary & { ratePlanId: string }) | null {
  const rp = raw.rates?.ratePlans?.[0];
  if (!rp) return null;
  const m = rp.ratePlan?.money ?? {};
  const quoteId = (raw._id || raw.id || "") as string;
  if (!quoteId) return null;
  return {
    quoteId,
    ratePlanId: rp.ratePlan?._id ?? "",
    hostPayout: m.hostPayout ?? 0,
    fareAccommodation:
      m.fareAccommodationAdjusted ?? m.fareAccommodation ?? 0,
    fareCleaning: m.fareCleaning ?? 0,
    totalTaxes: m.totalTaxes ?? 0,
    currency: m.currency || "USD",
    nights: Array.isArray(rp.days) ? rp.days.length : fallbackNights,
  };
}

export async function POST(req: NextRequest) {
  let body: BatchQuoteRequest;
  try {
    body = (await req.json()) as BatchQuoteRequest;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const lines = Array.isArray(body.lines) ? body.lines : [];
  if (lines.length === 0) {
    return NextResponse.json(
      { error: "lines is required and must be a non-empty array" },
      { status: 400 }
    );
  }
  if (lines.length > 10) {
    // Hard cap. Group bookings of >10 units should call the team — both for
    // operational complexity and to prevent a runaway batch from hammering
    // BEAPI quota.
    return NextResponse.json(
      {
        error:
          "Too many cart lines — please call our team for groups of more than 10 units.",
      },
      { status: 400 }
    );
  }

  // Validate each line shape before firing parallel BEAPI calls. Saves a
  // round-trip on obviously-malformed input.
  for (const line of lines) {
    if (
      !line.lineId ||
      !line.listingId ||
      !line.checkIn ||
      !line.checkOut ||
      typeof line.guestsCount !== "number"
    ) {
      return NextResponse.json(
        { error: "each line requires lineId, listingId, checkIn, checkOut, guestsCount" },
        { status: 400 }
      );
    }
    if (line.checkOut <= line.checkIn) {
      return NextResponse.json(
        { error: `checkOut must be after checkIn for line ${line.lineId}` },
        { status: 400 }
      );
    }
  }

  // Quote each line in parallel. We swallow per-line errors and report them
  // as ok=false in the response so a single bad listing doesn't blow up the
  // whole cart.
  const results = await Promise.all(
    lines.map(async (line): Promise<BatchQuoteLineResult> => {
      try {
        const raw = (await createQuote({
          listingId: line.listingId,
          checkIn: line.checkIn,
          checkOut: line.checkOut,
          guestsCount: line.guestsCount,
          // BEAPI's `pointofsale` only accepts [google, findrentals]; it is
          // NOT a generic channel tag. Forward only when the caller sets it
          // for one of those integrations.
          pointofsale: line.pointofsale ?? body.pointofsale,
        })) as RawQuote;
        const nights = nightsBetween(line.checkIn, line.checkOut);
        const summary = summarizeQuote(raw, nights);
        if (!summary || !summary.quoteId) {
          return {
            lineId: line.lineId,
            ok: false,
            error: "Quote returned without rate plan data",
          };
        }
        return { lineId: line.lineId, ok: true, quote: summary };
      } catch (e) {
        return {
          lineId: line.lineId,
          ok: false,
          error: e instanceof Error ? e.message : String(e),
        };
      }
    })
  );

  // Aggregate successful quotes.
  const successes = results.filter((r): r is BatchQuoteLineResult & { quote: PublicQuoteSummary } =>
    r.ok && r.quote !== undefined
  );
  const totals = {
    hostPayout: successes.reduce((s, r) => s + r.quote.hostPayout, 0),
    fareAccommodation: successes.reduce(
      (s, r) => s + r.quote.fareAccommodation,
      0
    ),
    fareCleaning: successes.reduce((s, r) => s + r.quote.fareCleaning, 0),
    totalTaxes: successes.reduce((s, r) => s + r.quote.totalTaxes, 0),
    nights: successes.reduce((s, r) => s + r.quote.nights, 0),
    currency: successes[0]?.quote.currency || "USD",
    successCount: successes.length,
    failureCount: results.length - successes.length,
  };

  const response: BatchQuoteResponse = { results, totals };
  return NextResponse.json(response);
}
