"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
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

export function DateRangeProvider({
  children,
  initialDateRange,
  initialGuests,
}: {
  children: ReactNode;
  initialDateRange?: DateRange;
  initialGuests?: number;
}) {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(
    initialDateRange
  );
  const [guests, setGuests] = useState(initialGuests || 2);
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
