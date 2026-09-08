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
  cleaning: number;
  taxes: number;
  /** Per-tax line items (e.g. State Tax, Transient Occupancy Tax,
   *  County Tax). When provided, the Taxes row becomes an expandable
   *  dropdown that reveals the individual breakdown. */
  taxBreakdown?: Array<{ name: string; amount: number }>;
  total: number;
  promotion?: { name: string; type: string };
  upsells?: Array<{ title: string; amount: number }>;
}

export function PriceBreakdown({
  nights,
  accommodation,
  accommodationAdjusted,
  cleaning,
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

  // Percentages stay keyed to what tax is actually levied on (accommodation
  // after discount, plus cleaning) rather than the displayed subtotal, so the
  // rate shown is the real rate. The two are equal unless upsells are present,
  // since upsells are added after tax.
  const taxBase = accommodationAdjusted + cleaning;
  const formatTaxRate = (amount: number): string | null => {
    if (taxBase <= 0) return null;
    const pct = (amount / taxBase) * 100;
    if (!Number.isFinite(pct) || pct <= 0) return null;
    // One decimal, but drop trailing ".0" so 6.0% reads as 6%.
    return `${pct.toFixed(1).replace(/\.0$/, "")}%`;
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
                    const rate = formatTaxRate(tax.amount);
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
