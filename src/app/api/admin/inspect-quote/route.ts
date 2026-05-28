/**
 * Admin endpoint to inspect a BEAPI quote.
 *
 * Built 2026-05-21 to diagnose why the checkout tax breakdown dropdown
 * isn't rendering. extractTaxBreakdown in src/lib/quote-response.ts looks
 * for invoiceItems with isTax/type/normalType — if real BEAPI quotes use
 * a different shape, this endpoint surfaces it so the matcher can be
 * widened.
 *
 * USAGE (browser, while logged in as an admin email):
 *   /api/admin/inspect-quote?quoteId=<id>
 *     → returns the raw BEAPI quote response, the normalized response,
 *       and the extracted tax breakdown (or null) for side-by-side diff.
 *
 * Auth: same admin allowlist as reservation-tools.
 */

import { NextResponse } from "next/server";
import { getQuote } from "@/lib/guesty-beapi";
import {
  buildNormalizedQuoteResponse,
  extractQuotePricing,
} from "@/lib/quote-response";
import { getListingWithBeapiFallback } from "@/lib/listing-utils";
import {
  authorizeAdminRequest,
  unauthorizedAdminResponse,
} from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await authorizeAdminRequest(request))) {
    return unauthorizedAdminResponse();
  }

  const url = new URL(request.url);
  const quoteId = url.searchParams.get("quoteId");
  if (!quoteId) {
    return NextResponse.json(
      { error: "Missing required ?quoteId=<id>" },
      { status: 400 }
    );
  }

  try {
    const raw = await getQuote(quoteId);
    const listing = await getListingWithBeapiFallback(raw?.unitTypeId);
    const normalized = buildNormalizedQuoteResponse(raw, listing);

    // Pull all the candidate locations BEAPI might put tax line items.
    // The goal is to see, for ONE real quote, which keys exist and what
    // shape they take so we can broaden extractTaxBreakdown without
    // guessing.
    const pricingInvoiceItems = raw?.pricing?.invoiceItems;
    const ratePlanMoney = raw?.rates?.ratePlans?.[0]?.ratePlan?.money;
    const ratePlanInvoiceItems = ratePlanMoney?.invoiceItems;

    return NextResponse.json({
      quoteId,
      summary: {
        taxesTotal: raw?.pricing?.taxes,
        normalizedTaxes: normalized.pricing.taxes,
        normalizedTaxBreakdown: normalized.pricing.taxBreakdown ?? null,
        // Re-extract using the same exported helper so we see what the
        // current matcher returns (should match normalizedTaxBreakdown).
        rerunExtract: extractQuotePricing(raw).taxBreakdown ?? null,
      },
      candidatePaths: {
        "raw.pricing.invoiceItems (length)": Array.isArray(pricingInvoiceItems)
          ? pricingInvoiceItems.length
          : "not-an-array",
        "raw.rates.ratePlans[0].ratePlan.money.invoiceItems (length)":
          Array.isArray(ratePlanInvoiceItems)
            ? ratePlanInvoiceItems.length
            : "not-an-array",
        // Other places Guesty has historically stuffed tax data:
        "raw.pricing.taxesItems": raw?.pricing?.taxesItems ?? null,
        "raw.pricing.taxBreakdown": raw?.pricing?.taxBreakdown ?? null,
        "raw.taxes": raw?.taxes ?? null,
      },
      pricingInvoiceItems: pricingInvoiceItems ?? null,
      ratePlanInvoiceItems: ratePlanInvoiceItems ?? null,
      // Last-resort dump for any field we missed — the full raw response.
      // Big, but useful when nothing else surfaces a tax breakdown.
      raw,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
