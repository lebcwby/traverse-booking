"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/utils";
import { OTA_SAVINGS_FRACTION } from "@/lib/savings";
import { promoDisplay } from "@/lib/promotions";

const $ = (amount: number) => formatCurrency(amount, { cents: true });

interface PriceBreakdownProps {
  nights: number;
  accommodation: number;
  accommodationAdjusted: number;
  // `cleaning` was removed with the tax-rate percentages — it existed only to
  // build the taxable-base guess described below. Re-adding it to recompute a
  // rate would reintroduce the bug.
  taxes: number;
  /** Per-tax line items (e.g. State Tax, Transient Occupancy Tax,
   *  County Tax). When provided, the Taxes row becomes an expandable
   *  dropdown that reveals the individual breakdown. */
  taxBreakdown?: Array<{ name: string; amount: number; rate?: number }>;
  total: number;
  promotion?: { name: string; type: string };
  upsells?: Array<{ title: string; amount: number }>;
}

export function PriceBreakdown({
  nights,
  accommodation,
  accommodationAdjusted,
  taxes,
  taxBreakdown,
  total,
  promotion,
  upsells,
}: PriceBreakdownProps) {
  const [taxesExpanded, setTaxesExpanded] = useState(false);
  const hasTaxBreakdown =
    Array.isArray(taxBreakdown) && taxBreakdown.length > 0;
  const hasDiscount = accommodationAdjusted < accommodation;
  const grandTotal =
    total + (upsells ? upsells.reduce((s, u) => s + u.amount, 0) : 0);
  const vrboSavings = Math.round(grandTotal * OTA_SAVINGS_FRACTION);

  // Subtotal is derived by SUBTRACTION, not by summing the parts.
  //
  // The fee lines used to be itemised — accommodation, cleaning, then an
  // "Extras" group for upsells (damage waiver, pet fee) — and the displayed
  // rows are now collapsed to Subtotal / Taxes / Total to read the way an OTA
  // does. Adding up components to build that subtotal would mean any fee added
  // later, or any component we forgot, silently drops out of the subtotal and
  // the three rows stop reconciling — the one thing a guest WILL notice on a
  // payment screen. Taking taxes off the grand total cannot desync: whatever
  // the total is made of, subtotal + taxes === total by construction.
  const subtotal = grandTotal - taxes;

  // The percentage beside each tax is READ FROM GUESTY, never calculated.
  // `rate` arrives on the tax line from the listing's own tax configuration
  // (see QuoteTaxLineItem). Do not compute one here, however tempting.
  //
  // This component used to divide the tax amount by `accommodationAdjusted +
  // cleaning` and call the result the rate. That guess is wrong in Crested
  // Butte, where Guesty's base also includes the service fee, so every CB
  // listing advertised a Colorado state sales tax of 3.1% against an actual
  // 2.9% — on a receipt, to guests, for months. Our accountant caught it.
  //
  // Adding those fees to the denominator does not fix it either. Across 228
  // real bookings the state line lands on exactly 2.9% only with a DIFFERENT
  // base per jurisdiction, because Guesty is configured that way per listing:
  //
  //   Crested Butte  appliedOnFees: [AF, CF, SERVICE, DAMAGE_WAIVER]
  //   Leadville      appliedOnFees: [AF, CF]
  //
  // So no formula can be right everywhere. The listing config states both the
  // rate and its base; we show the rate it states, and show nothing when the
  // config is missing or ambiguous.
  const formatTaxRate = (rate: number | undefined): string | null => {
    if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
      return null;
    }
    // Two decimals max, trailing zeros dropped: 9.9 → "9.9%", 6 → "6%",
    // 5.42 → "5.42%".
    return `${Number(rate.toFixed(2))}%`;
  };

  return (
    <div className="space-y-2 text-sm">
      {/* Subtotal — accommodation, cleaning, damage waiver, pet fee and any
          other extra, folded into one line. Only rendered when there are taxes
          to separate it from; with no taxes it would just restate the Total. */}
      {taxes > 0 && subtotal > 0 && (
        <div className="flex justify-between">
          <span className="text-muted-foreground">
            Subtotal · {nights} {nights === 1 ? "night" : "nights"}
          </span>
          <span>{$(subtotal)}</span>
        </div>
      )}
      {/* A promotion stays visible — burying money we told the guest they'd
          save is a different thing from tidying away a fee. But it reads as a
          NOTE rather than an arithmetic row: the subtotal above is already net
          of it, so a "-$50" line underneath would look like a second deduction
          the guest never receives. */}
      {hasDiscount && promotion && (
        <p className="text-xs font-medium text-green-600">
          {promoDisplay(promotion)?.label ?? promotion.name} applied — you saved{" "}
          {$(accommodation - accommodationAdjusted)}
        </p>
      )}
      {taxes > 0 && (
        <>
          {hasTaxBreakdown ? (
            <>
              <button
                type="button"
                onClick={() => setTaxesExpanded((v) => !v)}
                aria-expanded={taxesExpanded}
                className="flex w-full items-center justify-between rounded-md text-left transition-colors hover:bg-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 -mx-1 px-1 py-0.5"
              >
                <span className="flex items-center gap-1 text-muted-foreground">
                  Taxes
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform ${taxesExpanded ? "rotate-180" : ""}`}
                    aria-hidden="true"
                  />
                </span>
                <span>{$(taxes)}</span>
              </button>
              {taxesExpanded && (
                <div className="pl-3 space-y-1 text-xs">
                  {taxBreakdown!.map((tax) => {
                    const rate = formatTaxRate(tax.rate);
                    return (
                      <div
                        key={tax.name}
                        className="flex justify-between text-muted-foreground"
                      >
                        <span>
                          {tax.name}
                          {rate && (
                            <span className="ml-1 text-muted-foreground/70">
                              ({rate})
                            </span>
                          )}
                        </span>
                        <span>{$(tax.amount)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Taxes</span>
              <span>{$(taxes)}</span>
            </div>
          )}
        </>
      )}
      {/* The "Extras" group (damage waiver, pet fee, any selected upsell) used
          to be itemised here. It is inside the Subtotal now — the guest still
          picked each one on the previous step, where they are named and priced
          individually. */}
      <Separator />
      <div className="flex justify-between font-semibold text-base">
        <span>Total</span>
        <span>{$(grandTotal)}</span>
      </div>
      {vrboSavings >= 20 && (
        <p className="text-center text-xs text-green-600 font-medium mt-1">
          You&apos;re saving {$(vrboSavings)} vs VRBO
        </p>
      )}
    </div>
  );
}
