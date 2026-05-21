"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/utils";
import { OTA_SAVINGS_FRACTION } from "@/lib/savings";

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
  // Split out the base (accommodation) and cleaning fee on separate lines
  // per 2026-05-20 product call. Previous version bundled them as
  // "$X × N nights = $base+cleaning" which made it look like cleaning was
  // amortized into the nightly rate. The new layout makes both line items
  // explicit so guests can see exactly what they're paying for.
  const avgNightlyRate = nights > 0 ? accommodation / nights : 0;
  const hasDiscount = accommodationAdjusted < accommodation;
  const grandTotal =
    total + (upsells ? upsells.reduce((s, u) => s + u.amount, 0) : 0);
  const vrboSavings = Math.round(grandTotal * OTA_SAVINGS_FRACTION);
  // Pre-tax subtotal = accommodation (after any promo discount) + cleaning.
  // Upsells aren't included here because they're rendered as a separate
  // "Extras" group below the Taxes row. This subtotal also doubles as the
  // base for per-tax rate %, so guests can verify the math (amount / base).
  const preTaxSubtotal = accommodationAdjusted + cleaning;
  const formatTaxRate = (amount: number): string | null => {
    if (preTaxSubtotal <= 0) return null;
    const pct = (amount / preTaxSubtotal) * 100;
    if (!Number.isFinite(pct) || pct <= 0) return null;
    // One decimal, but drop trailing ".0" so 6.0% reads as 6%.
    return `${pct.toFixed(1).replace(/\.0$/, "")}%`;
  };

  return (
    <div className="space-y-2 text-sm">
      {/* Base fare — accommodation pre-discount, no cleaning, no taxes */}
      <div className="flex justify-between">
        <span className="text-muted-foreground">
          {$(avgNightlyRate)} x {nights} {nights === 1 ? "night" : "nights"}
        </span>
        <span>{$(accommodation)}</span>
      </div>
      {hasDiscount && promotion && (
        <div className="flex justify-between text-green-600">
          <span>{promotion.name}</span>
          <span>-{$(accommodation - accommodationAdjusted)}</span>
        </div>
      )}
      {/* Cleaning fee — broken out on its own line */}
      {cleaning > 0 && (
        <div className="flex justify-between">
          <span className="text-muted-foreground">Cleaning fee</span>
          <span>{$(cleaning)}</span>
        </div>
      )}
      {taxes > 0 && preTaxSubtotal > 0 && (
        <div className="flex justify-between border-t border-border/40 pt-2 text-foreground">
          <span>Subtotal before taxes</span>
          <span>{$(preTaxSubtotal)}</span>
        </div>
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
      {upsells && upsells.length > 0 && (
        <>
          <Separator />
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Extras
          </p>
          {upsells.map((item) => (
            <div key={item.title} className="flex justify-between">
              <span className="text-muted-foreground">{item.title}</span>
              <span>{$(item.amount)}</span>
            </div>
          ))}
        </>
      )}
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
