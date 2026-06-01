// Multi-listing cart coupon application. BEAPI's addCouponToQuote is
// per-quote, so we apply in parallel across all cart lines and return
// per-line success/failure. UI shows partial application gracefully
// (e.g., "$X off applied to 3 of 4 stays") so guests can decide whether
// to keep the coupon or remove items the code doesn't cover.
//
// Returns the per-line breakdown WITHOUT modifying the cart payment intent.
// The UI re-creates the PI with the new totals once the user confirms,
// because PI amount changes mid-flight require a fresh confirm call anyway.

import { NextRequest, NextResponse } from "next/server";
import { addCouponToQuote, getQuote } from "@/lib/guesty-beapi";

interface ApplyCouponLine {
  lineId: string;
  quoteId: string;
}

interface CouponLineResult {
  lineId: string;
  ok: boolean;
  /** Old hostPayout before the coupon (if applied successfully). */
  hostPayoutBefore?: number;
  /** New hostPayout after the coupon. */
  hostPayoutAfter?: number;
  /** Quote ID may have rotated server-side (Guesty sometimes versions). */
  quoteId?: string;
  ratePlanId?: string;
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { coupon, lines } = body as {
      coupon?: string;
      lines?: ApplyCouponLine[];
    };
    if (!coupon || !Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json(
        { error: "coupon and lines are required" },
        { status: 400 }
      );
    }

    // Apply in parallel — partial-success is the expected case.
    const results: CouponLineResult[] = await Promise.all(
      lines.map(async (line): Promise<CouponLineResult> => {
        try {
          // Snapshot the pre-coupon total.
          const before = await getQuote(line.quoteId);
          const beforePayout =
            before?.rates?.ratePlans?.[0]?.ratePlan?.money?.hostPayout;

          await addCouponToQuote(line.quoteId, coupon);
          const after = await getQuote(line.quoteId);
          const ratePlan = after?.rates?.ratePlans?.[0]?.ratePlan;
          const afterPayout = ratePlan?.money?.hostPayout;

          return {
            lineId: line.lineId,
            ok: true,
            hostPayoutBefore:
              typeof beforePayout === "number" ? beforePayout : undefined,
            hostPayoutAfter:
              typeof afterPayout === "number" ? afterPayout : undefined,
            quoteId: (after?._id as string) || line.quoteId,
            ratePlanId: (ratePlan?._id as string) || undefined,
          };
        } catch (e) {
          const raw = e instanceof Error ? e.message : String(e);
          // Friendly mapping for the most common Guesty failure.
          const codeMatch = raw.match(/"code"\s*:\s*"([^"]+)"/);
          const code = codeMatch?.[1];
          let friendly = "Coupon could not be applied to this listing.";
          if (code === "INVALID_COUPON" || raw.includes("400")) {
            friendly = "This coupon doesn't apply to this listing.";
          }
          return { lineId: line.lineId, ok: false, error: friendly };
        }
      })
    );

    const okCount = results.filter((r) => r.ok).length;
    const totalSavings = results.reduce((sum, r) => {
      if (
        r.ok &&
        typeof r.hostPayoutBefore === "number" &&
        typeof r.hostPayoutAfter === "number"
      ) {
        return sum + Math.max(0, r.hostPayoutBefore - r.hostPayoutAfter);
      }
      return sum;
    }, 0);

    return NextResponse.json({
      coupon,
      appliedCount: okCount,
      totalLines: results.length,
      totalSavings,
      results,
    });
  } catch (error) {
    console.error(
      "[CartCoupons] Error:",
      error instanceof Error ? error.message : error
    );
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to apply coupon to cart",
      },
      { status: 500 }
    );
  }
}
