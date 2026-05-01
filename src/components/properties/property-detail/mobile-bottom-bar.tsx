"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { format, addDays } from "date-fns";
import { Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useDateRange } from "./date-range-context";
import { MobileCalendarModal } from "./mobile-calendar-modal";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { trackCheckAvailability, trackClickBookNow } from "@/lib/tracking";
import { PricingBadgeCompact } from "./pricing-badge";

interface QuoteResponse {
  _id: string;
  checkInDateLocalized: string;
  checkOutDateLocalized: string;
  guestsCount: number;
  rates: {
    ratePlans: Array<{
      ratePlan: {
        _id: string;
        name: string;
        cancellationPolicy: string;
        money: {
          currency: string;
          fareAccommodation: number;
          fareAccommodationAdjusted: number;
          fareCleaning: number;
          totalFees: number;
          subTotalPrice: number;
          hostPayout: number;
          totalTaxes: number;
        };
      };
      days: Array<{
        date: string;
        price: number;
        basePrice: number;
        currency: string;
      }>;
    }>;
  };
  promotions?: { name: string; type: string };
}

export function MobileBottomBar({
  listingId,
  listingTitle,
  basePrice,
  pointofsale,
  picture,
  maxGuests,
  cancellationPolicy,
  reviewRating,
  reviewCount,
}: {
  listingId: string;
  listingTitle: string;
  basePrice: number;
  pointofsale?: string;
  picture?: string | null;
  maxGuests?: number;
  cancellationPolicy?: string;
  reviewRating?: number;
  reviewCount?: number;
}) {
  const router = useRouter();
  const { dateRange, guests, setSharedQuoteMoney } = useDateRange();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [quote, setQuoteRaw] = useState<QuoteResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setQuote = useCallback(
    (q: QuoteResponse | null) => {
      setQuoteRaw(q);
      const money = q?.rates?.ratePlans?.[0]?.ratePlan?.money;
      setSharedQuoteMoney(
        money
          ? {
              fareAccommodation: money.fareAccommodation,
              fareAccommodationAdjusted: money.fareAccommodationAdjusted,
              fareCleaning: money.fareCleaning,
              totalTaxes: money.totalTaxes,
              hostPayout: money.hostPayout,
            }
          : null
      );
    },
    [setSharedQuoteMoney]
  );

  // Accept a pre-fetched quote from the calendar modal
  const handleQuoteFromModal = useCallback(
    (rawQuote: Record<string, unknown> | null) => {
      if (rawQuote) {
        setQuote(rawQuote as unknown as QuoteResponse);
        setLoading(false);
        setError(null);
      }
    },
    [setQuote]
  );

  // Auto-fetch quote when both dates are selected (only if no quote already)
  const fetchQuote = useCallback(async () => {
    if (!dateRange?.from || !dateRange?.to) return;

    const checkIn = format(dateRange.from, "yyyy-MM-dd");
    const checkOut = format(dateRange.to, "yyyy-MM-dd");
    if (checkOut <= checkIn) return;

    setLoading(true);
    setError(null);
    trackCheckAvailability({
      listingId,
      listingTitle,
      checkIn,
      checkOut,
      guests: Math.max(1, guests),
    });

    try {
      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId,
          checkIn,
          checkOut,
          guestsCount: Math.max(1, guests),
          ...(pointofsale ? { pointofsale } : {}),
        }),
      });

      if (!res.ok) {
        if (res.status === 429) {
          await new Promise((r) => setTimeout(r, 2000));
          const retry = await fetch("/api/quotes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              listingId,
              checkIn,
              checkOut,
              guestsCount: Math.max(1, guests),
              ...(pointofsale ? { pointofsale } : {}),
            }),
          });
          if (retry.ok) {
            setQuote(await retry.json());
            return;
          }
        }
        throw new Error("Unable to get pricing");
      }

      setQuote(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [dateRange, guests, listingId, listingTitle, pointofsale, setQuote]);

  // Auto-fetch quote when both dates are selected
  useEffect(() => {
    if (!dateRange?.from || !dateRange?.to) {
      setQuote(null);
      return;
    }
    // Skip fetch if we already have a quote (e.g. from the modal)
    if (quote) return;
    const timer = setTimeout(() => fetchQuote(), 300);
    return () => clearTimeout(timer);
  }, [dateRange?.from?.getTime(), dateRange?.to?.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps

  const [priceDetailsOpen, setPriceDetailsOpen] = useState(false);

  const pricing = useMemo(() => {
    if (!quote) return null;
    const rp = quote.rates?.ratePlans?.[0];
    if (!rp) return null;
    const money = rp.ratePlan?.money;
    if (!money) return null;
    return {
      ratePlanId: rp.ratePlan._id,
      total: money.hostPayout,
      nights: rp.days.length,
      accommodation: money.fareAccommodationAdjusted || money.fareAccommodation,
      cleaning: money.fareCleaning,
      taxes: money.totalTaxes,
      fees: money.totalFees,
      cancellationPolicy: rp.ratePlan.cancellationPolicy,
    };
  }, [quote]);

  function storeQuoteAndNavigate(q: QuoteResponse) {
    const rp = q.rates?.ratePlans?.[0];
    if (!rp) return;
    trackClickBookNow({
      listingId,
      listingTitle,
      checkIn: q.checkInDateLocalized,
      checkOut: q.checkOutDateLocalized,
      guests,
      value: rp.ratePlan.money.hostPayout,
    });
    sessionStorage.setItem(
      `quote_${q._id}`,
      JSON.stringify({
        quoteId: q._id,
        ratePlanId: rp.ratePlan._id,
        listingId,
        listingTitle,
        picture: picture || null,
        checkIn: q.checkInDateLocalized,
        checkOut: q.checkOutDateLocalized,
        guests,
        pricing: {
          ratePlanId: rp.ratePlan._id,
          ratePlanName: rp.ratePlan.name,
          cancellationPolicy: rp.ratePlan.cancellationPolicy,
          nights: rp.days.length,
          accommodation: rp.ratePlan.money.fareAccommodation,
          accommodationAdjusted: rp.ratePlan.money.fareAccommodationAdjusted,
          cleaning: rp.ratePlan.money.fareCleaning,
          taxes: rp.ratePlan.money.totalTaxes,
          total: rp.ratePlan.money.hostPayout,
          invoiceItems: [],
          days: rp.days,
        },
        promotion: q.promotions,
        reviewRating: reviewRating || null,
        reviewCount: reviewCount || null,
      })
    );
    router.push(`/book/${q._id}`);
  }

  function handleReserve() {
    if (!quote) return;
    storeQuoteAndNavigate(quote);
  }

  function handleReserveFromModal(rawQuote: Record<string, unknown>) {
    const q = rawQuote as unknown as QuoteResponse;
    setQuote(q);
    storeQuoteAndNavigate(q);
  }

  const avgNightly =
    pricing && pricing.nights > 0
      ? Math.round(pricing.accommodation / pricing.nights)
      : null;

  const dateLabel =
    dateRange?.from && dateRange?.to
      ? `${format(dateRange.from, "MMM d")} – ${format(dateRange.to, "MMM d")}`
      : pricing
        ? `${pricing.nights} nights`
        : "";

  function getCancellationLabel(
    policy: string | undefined,
    checkIn?: Date | null
  ): string {
    if (!policy) return "";
    const daysMap: Record<string, number> = {
      flexible: 1,
      semi_flexible: 2,
      moderate: 5,
      firm: 30,
      strict: 60,
    };
    const days = daysMap[policy];
    if (days === undefined) return "";
    if (checkIn) {
      const deadline = addDays(checkIn, -days);
      if (deadline <= new Date()) return "";
      return `Free cancellation before ${format(deadline, "MMM d")}`;
    }
    if (days <= 2)
      return `Free cancellation up to ${days * 24} hrs before check-in`;
    return `Free cancellation up to ${days} days before check-in`;
  }

  return (
    <>
      {/* Sticky bottom bar — mobile only */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
        {/* Cancellation policy — full width above the price/button row */}
        {(() => {
          const policy =
            pricing?.cancellationPolicy ||
            cancellationPolicy ||
            "semi_flexible";
          const label = getCancellationLabel(policy, dateRange?.from);
          return pricing && label ? (
            <div className="inline-block rounded-full bg-muted px-2 py-0.5 text-xs text-foreground mb-2">
              {label}
            </div>
          ) : null;
        })()}
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            {pricing ? (
              <>
                <button
                  onClick={() => setPriceDetailsOpen(true)}
                  className="text-left"
                >
                  <p className="text-base font-bold underline">
                    {formatCurrency(pricing.total)}{" "}
                    <span className="text-sm font-normal text-muted-foreground no-underline">
                      total
                    </span>
                  </p>
                </button>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {dateLabel}
                </p>
                <PricingBadgeCompact />
              </>
            ) : loading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Calculating...
                </span>
              </div>
            ) : (
              <>
                <p className="text-sm font-semibold">Add dates for prices</p>
                {basePrice ? (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    From {formatCurrency(basePrice)}/night
                  </p>
                ) : null}
              </>
            )}
            {error && (
              <p className="text-xs text-destructive mt-0.5">{error}</p>
            )}
          </div>

          {pricing ? (
            <div className="shrink-0 w-[48%] flex flex-col items-center">
              <Button
                onClick={handleReserve}
                className="relative w-full overflow-hidden rounded-full bg-accent text-accent-foreground hover:bg-accent/90 py-6 text-base font-semibold after:absolute after:inset-0 after:animate-shimmer after:bg-gradient-to-r after:from-transparent after:via-white/20 after:via-50% after:to-transparent"
              >
                Reserve
              </Button>
              <p className="mt-1 text-[11px] text-muted-foreground">
                You won&apos;t be charged yet
              </p>
            </div>
          ) : loading || (!error && dateRange?.from && dateRange?.to) ? (
            <div className="shrink-0 w-[48%]">
              <Button
                disabled
                className="w-full rounded-full bg-accent/60 text-accent-foreground py-6 text-base font-semibold"
              >
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
                Loading...
              </Button>
            </div>
          ) : (
            <Button
              onClick={() => setCalendarOpen(true)}
              className="shrink-0 w-[48%] rounded-full bg-accent text-accent-foreground hover:bg-accent/90 py-6 text-base font-semibold"
            >
              Select dates
            </Button>
          )}
        </div>
      </div>

      {/* Price details slide-up panel */}
      {priceDetailsOpen && pricing && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setPriceDetailsOpen(false)}
          />
          {/* Panel */}
          <div
            className="absolute bottom-0 left-0 right-0 rounded-t-2xl bg-white px-6 pt-5 pb-8 shadow-[0_-4px_20px_rgba(0,0,0,0.1)]"
            style={{
              animation: "slideUpPanel 0.3s ease-out",
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold">Price details</h2>
              <button
                onClick={() => setPriceDetailsOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Breakdown */}
            <div className="space-y-3 text-sm">
              {avgNightly && (
                <div className="flex items-center justify-between">
                  <span>
                    {pricing.nights} nights x {formatCurrency(avgNightly)}
                  </span>
                  <span>{formatCurrency(pricing.accommodation)}</span>
                </div>
              )}
              {pricing.cleaning > 0 && (
                <div className="flex items-center justify-between">
                  <span>Cleaning fee</span>
                  <span>{formatCurrency(pricing.cleaning)}</span>
                </div>
              )}
              {pricing.taxes > 0 && (
                <div className="flex items-center justify-between">
                  <span>Taxes</span>
                  <span>{formatCurrency(pricing.taxes)}</span>
                </div>
              )}
              {pricing.fees > 0 && pricing.fees !== pricing.cleaning && (
                <div className="flex items-center justify-between">
                  <span>Service fees</span>
                  <span>{formatCurrency(pricing.fees)}</span>
                </div>
              )}

              <div className="border-t border-border pt-3 flex items-center justify-between font-semibold text-base">
                <span>Total</span>
                <span>{formatCurrency(pricing.total)}</span>
              </div>
            </div>

            {/* Dates */}
            {dateRange?.from && dateRange?.to && (
              <div className="mt-5 pt-4 border-t border-border">
                <h3 className="text-sm font-semibold mb-1">Dates</h3>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {format(dateRange.from, "MMM d")} –{" "}
                    {format(dateRange.to, "MMM d")}
                  </span>
                  <button
                    onClick={() => {
                      setPriceDetailsOpen(false);
                      setCalendarOpen(true);
                    }}
                    className="text-sm font-semibold border border-border rounded-full px-4 py-1.5"
                  >
                    Change
                  </button>
                </div>
                {pricing.cancellationPolicy &&
                  getCancellationLabel(
                    pricing.cancellationPolicy,
                    dateRange?.from
                  ) && (
                    <p className="text-xs text-muted-foreground mt-1.5">
                      {getCancellationLabel(
                        pricing.cancellationPolicy,
                        dateRange?.from
                      )}
                    </p>
                  )}
              </div>
            )}

            {/* Reserve button */}
            <Button
              onClick={handleReserve}
              className="relative mt-6 w-full overflow-hidden rounded-full bg-accent text-accent-foreground hover:bg-accent/90 py-6 text-base font-semibold after:absolute after:inset-0 after:animate-shimmer after:bg-gradient-to-r after:from-transparent after:via-white/20 after:via-50% after:to-transparent"
            >
              Reserve
            </Button>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slideUpPanel {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
      `}</style>

      <MobileCalendarModal
        listingId={listingId}
        listingTitle={listingTitle}
        open={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        pointofsale={pointofsale}
        onSaveWithQuote={handleQuoteFromModal}
        onReserve={handleReserveFromModal}
        maxGuests={maxGuests}
      />
    </>
  );
}
