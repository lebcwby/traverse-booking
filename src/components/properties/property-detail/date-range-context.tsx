"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { type DateRange } from "react-day-picker";

export interface QuotePricing {
  total: number;
  nights: number;
}

export interface SharedQuoteMoney {
  fareAccommodation: number;
  fareAccommodationAdjusted: number;
  fareCleaning: number;
  totalTaxes: number;
  hostPayout: number;
}

interface DateRangeContextValue {
  dateRange: DateRange | undefined;
  setDateRange: (range: DateRange | undefined) => void;
  guests: number;
  setGuests: (g: number) => void;
  quotePricing: QuotePricing | null;
  setQuotePricing: (p: QuotePricing | null) => void;
  sharedQuoteMoney: SharedQuoteMoney | null;
  setSharedQuoteMoney: (m: SharedQuoteMoney | null) => void;
}

const DateRangeContext = createContext<DateRangeContextValue | null>(null);

/**
 * Read ?checkIn/?checkOut/?guests here rather than taking them as props.
 *
 * The listing page used to await `searchParams` and pass them down, which
 * made the whole route dynamic and meant /properties/[id] could never be
 * cached despite declaring `revalidate = 300` (issue #82). Reading them in
 * this already-client component keeps the prefill working while letting the
 * page be prerendered.
 *
 * ⚠️ `useSearchParams` requires a <Suspense> boundary in a prerendered route.
 * The page wraps this provider in one.
 */
function readInitialStay(params: URLSearchParams) {
  const checkIn = params.get("checkIn");
  const checkOut = params.get("checkOut");
  let dateRange: DateRange | undefined;
  if (checkIn && checkOut) {
    // Noon avoids the stay sliding a day either way across a timezone or DST
    // boundary, which is what the server-side version did too.
    const from = new Date(`${checkIn}T12:00:00`);
    const to = new Date(`${checkOut}T12:00:00`);
    if (!Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime())) {
      dateRange = { from, to };
    }
  }
  const rawGuests = Number.parseInt(params.get("guests") ?? "", 10);
  const guests =
    Number.isFinite(rawGuests) && rawGuests > 0 ? rawGuests : undefined;
  return { dateRange, guests };
}

export function DateRangeProvider({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  // Computed once for the initial state only. Later navigation that changes
  // the query should not stomp a selection the guest has made since.
  const [initial] = useState(() => readInitialStay(searchParams));
  const [dateRange, setDateRange] = useState<DateRange | undefined>(
    initial.dateRange
  );
  const [guests, setGuests] = useState(initial.guests || 2);
  const [quotePricing, setQuotePricing] = useState<QuotePricing | null>(null);
  const [sharedQuoteMoney, setSharedQuoteMoney] =
    useState<SharedQuoteMoney | null>(null);
  return (
    <DateRangeContext.Provider
      value={{
        dateRange,
        setDateRange,
        guests,
        setGuests,
        quotePricing,
        setQuotePricing,
        sharedQuoteMoney,
        setSharedQuoteMoney,
      }}
    >
      {children}
    </DateRangeContext.Provider>
  );
}

export function useDateRange() {
  const ctx = useContext(DateRangeContext);
  if (!ctx)
    throw new Error("useDateRange must be used within DateRangeProvider");
  return ctx;
}
