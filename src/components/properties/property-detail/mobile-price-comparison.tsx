"use client";

import { useMemo } from "react";
import Image from "next/image";
import { useDateRange } from "./date-range-context";
import { formatCurrency } from "@/lib/utils";

export function MobilePriceComparison() {
  const { sharedQuoteMoney } = useDateRange();

  const comparison = useMemo(() => {
    if (!sharedQuoteMoney) return null;

    const accommodation = sharedQuoteMoney.fareAccommodationAdjusted;
    const cleaning = sharedQuoteMoney.fareCleaning;
    const taxes = sharedQuoteMoney.totalTaxes;
    const spTotal = sharedQuoteMoney.hostPayout;

    const baseAccom = accommodation / 1.1;
    const taxRate =
      accommodation + cleaning > 0 ? taxes / (accommodation + cleaning) : 0;

    const airbnbAccom = baseAccom * 1.155;
    const airbnbPretax = airbnbAccom + cleaning;
    const airbnbTotal = airbnbPretax * (1 + taxRate);

    const vrboAccom = baseAccom * 1.2;
    const vrboPretax = vrboAccom + cleaning;
    const vrboServiceFee = vrboPretax * 0.08;
    const vrboTotal = vrboPretax * (1 + taxRate) + vrboServiceFee;

    const bookingAccom = baseAccom * 1.2;
    const bookingPretax = bookingAccom + cleaning;
    const bookingTotal = bookingPretax * (1 + taxRate);

    const airbnbSavings = airbnbTotal - spTotal;
    const vrboSavings = vrboTotal - spTotal;
    const bookingSavings = bookingTotal - spTotal;
    const maxSavings = Math.max(airbnbSavings, vrboSavings, bookingSavings);

    return {
      spTotal,
      airbnbTotal,
      vrboTotal,
      bookingTotal,
      airbnbSavings,
      vrboSavings,
      bookingSavings,
      maxSavings,
    };
  }, [sharedQuoteMoney]);

  // Pre-quote filler state
  if (!comparison || comparison.maxSavings <= 0) {
    return (
      <div className="sm:hidden -mx-0.5 mt-2 overflow-hidden rounded-xl border border-border">
        {/* Gold header banner — pre-quote */}
        <div className="flex items-center justify-center gap-1.5 bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="h-4 w-4 shrink-0 text-accent"
          >
            <path
              fillRule="evenodd"
              d="M8.603 3.799A4.49 4.49 0 0 1 12 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 0 1 3.498 1.307 4.491 4.491 0 0 1 1.307 3.497A4.49 4.49 0 0 1 21.75 12a4.49 4.49 0 0 1-1.549 3.397 4.491 4.491 0 0 1-1.307 3.497 4.491 4.491 0 0 1-3.497 1.307A4.49 4.49 0 0 1 12 21.75a4.49 4.49 0 0 1-3.397-1.549 4.49 4.49 0 0 1-3.498-1.306 4.491 4.491 0 0 1-1.307-3.498A4.49 4.49 0 0 1 2.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 0 1 1.307-3.497 4.49 4.49 0 0 1 3.497-1.307Zm7.007 6.387a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z"
              clipRule="evenodd"
            />
          </svg>
          Book direct and save up to 20%
        </div>

        {/* Filler rows */}
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-[80px] shrink-0">
              <Image
                src="/book-traverse-wordmark-dark.png"
                alt="Book Traverse"
                width={200}
                height={40}
                className="h-5 w-auto object-contain object-left"
              />
            </div>
            <span className="ml-auto text-[11px] text-muted-foreground">
              Lowest price guaranteed
            </span>
          </div>
          {[
            { src: "/logo-vrbo.png", alt: "Vrbo", w: 346, h: 111, imgH: "h-5" },
            {
              src: "/logo-booking.png",
              alt: "Booking.com",
              w: 763,
              h: 128,
              imgH: "h-4",
            },
            {
              src: "/logo-airbnb.png",
              alt: "Airbnb",
              w: 800,
              h: 251,
              imgH: "h-5",
            },
          ].map((comp) => (
            <div key={comp.alt} className="flex items-center gap-3">
              <div className="w-[80px] shrink-0">
                <Image
                  src={comp.src}
                  alt={comp.alt}
                  width={comp.w}
                  height={comp.h}
                  className={`${comp.imgH} w-auto object-contain object-left opacity-40`}
                />
              </div>
              <span className="ml-auto">
                <span className="inline-block h-2.5 w-16 rounded bg-muted" />
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const competitors = [
    {
      name: "vrbo",
      src: "/logo-vrbo.png",
      alt: "Vrbo",
      w: 346,
      h: 111,
      imgH: "h-5",
      total: comparison.vrboTotal,
      savings: comparison.vrboSavings,
    },
    {
      name: "booking",
      src: "/logo-booking.png",
      alt: "Booking.com",
      w: 763,
      h: 128,
      imgH: "h-4",
      total: comparison.bookingTotal,
      savings: comparison.bookingSavings,
    },
    {
      name: "airbnb",
      src: "/logo-airbnb.png",
      alt: "Airbnb",
      w: 800,
      h: 251,
      imgH: "h-5",
      total: comparison.airbnbTotal,
      savings: comparison.airbnbSavings,
    },
  ].sort((a, b) => b.total - a.total);

  return (
    <div className="sm:hidden -mx-0.5 mt-2 overflow-hidden rounded-xl border border-border">
      {/* Gold header banner */}
      <div className="flex items-center justify-center gap-1.5 bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="h-4 w-4 shrink-0 text-accent"
        >
          <path
            fillRule="evenodd"
            d="M8.603 3.799A4.49 4.49 0 0 1 12 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 0 1 3.498 1.307 4.491 4.491 0 0 1 1.307 3.497A4.49 4.49 0 0 1 21.75 12a4.49 4.49 0 0 1-1.549 3.397 4.491 4.491 0 0 1-1.307 3.497 4.491 4.491 0 0 1-3.497 1.307A4.49 4.49 0 0 1 12 21.75a4.49 4.49 0 0 1-3.397-1.549 4.49 4.49 0 0 1-3.498-1.306 4.491 4.491 0 0 1-1.307-3.498A4.49 4.49 0 0 1 2.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 0 1 1.307-3.497 4.49 4.49 0 0 1 3.497-1.307Zm7.007 6.387a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z"
            clipRule="evenodd"
          />
        </svg>
        You&apos;ll save {formatCurrency(comparison.maxSavings)}! Best price
        verified.
      </div>

      {/* Rows */}
      <div className="p-4 space-y-3">
        {/* Book Traverse */}
        <div className="flex items-center gap-3">
          <div className="w-[80px] shrink-0">
            <Image
              src="/book-traverse-wordmark-dark.png"
              alt="Book Traverse"
              width={200}
              height={40}
              className="h-5 w-auto object-contain object-left"
            />
          </div>
          <span className="ml-auto flex items-center gap-2 whitespace-nowrap">
            <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-foreground">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-3 w-3 shrink-0 text-accent"
              >
                <path
                  fillRule="evenodd"
                  d="M8.603 3.799A4.49 4.49 0 0 1 12 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 0 1 3.498 1.307 4.491 4.491 0 0 1 1.307 3.497A4.49 4.49 0 0 1 21.75 12a4.49 4.49 0 0 1-1.549 3.397 4.491 4.491 0 0 1-1.307 3.497 4.491 4.491 0 0 1-3.497 1.307A4.49 4.49 0 0 1 12 21.75a4.49 4.49 0 0 1-3.397-1.549 4.49 4.49 0 0 1-3.498-1.306 4.491 4.491 0 0 1-1.307-3.498A4.49 4.49 0 0 1 2.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 0 1 1.307-3.497 4.49 4.49 0 0 1 3.497-1.307Zm7.007 6.387a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z"
                  clipRule="evenodd"
                />
              </svg>
              You save {formatCurrency(comparison.maxSavings)}
            </span>
            <span className="text-sm font-bold text-foreground">
              {formatCurrency(comparison.spTotal)}
            </span>
          </span>
        </div>

        {/* Competitors */}
        {competitors.map((comp, i) => (
          <div key={comp.name} className="flex items-center gap-3">
            <div className="w-[80px] shrink-0">
              <Image
                src={comp.src}
                alt={comp.alt}
                width={comp.w}
                height={comp.h}
                className={`${comp.imgH} w-auto object-contain object-left`}
              />
            </div>
            <span className="ml-auto whitespace-nowrap text-right text-[11px] text-muted-foreground">
              {i === 0 ? (
                <>Most expensive: {formatCurrency(comp.savings)} more</>
              ) : (
                `You\u2019ll pay ${formatCurrency(comp.savings)} more`
              )}{" "}
              <span className="text-sm">{formatCurrency(comp.total)}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
