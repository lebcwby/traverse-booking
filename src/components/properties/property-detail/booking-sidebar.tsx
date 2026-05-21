"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { format, addMonths, addDays, parse, isValid } from "date-fns";
import {
  Loader2,
  X,
  AlertCircle,
  Send,
  Mail,
  Bell,
  CheckCircle2,
} from "lucide-react";
import { useDateRange } from "./date-range-context";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import type { DayButton as DayButtonType } from "react-day-picker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { extractTaxBreakdown } from "@/lib/quote-response";
import Image from "next/image";
import { PricingBadge } from "./pricing-badge";
import {
  trackCheckAvailability,
  trackClickBookNow,
  identifyUser,
} from "@/lib/tracking";
import { getEmailCaptureAttribution } from "@/lib/attribution";
import { RareFindBadge } from "./rare-find-badge";
import { AddToCartButton } from "@/components/cart/add-to-cart-button";

interface InvoiceItem {
  title: string;
  amount: number;
  currency: string;
  type: string;
  normalType: string;
  description?: string;
}

interface RatePlanMoney {
  currency: string;
  fareAccommodation: number;
  fareAccommodationAdjusted: number;
  fareCleaning: number;
  totalFees: number;
  subTotalPrice: number;
  hostPayout: number;
  totalTaxes: number;
  invoiceItems: InvoiceItem[];
}

interface QuoteResponse {
  _id: string;
  expiresAt: string;
  checkInDateLocalized: string;
  checkOutDateLocalized: string;
  guestsCount: number;
  rates: {
    ratePlans: Array<{
      ratePlan: {
        _id: string;
        name: string;
        cancellationPolicy: string;
        money: RatePlanMoney;
      };
      days: Array<{
        date: string;
        price: number;
        basePrice: number;
        currency: string;
      }>;
    }>;
  };
  promotions?: {
    name: string;
    type: string;
    rule?: { discountType: string; discountAmount: number };
  };
}

interface CalendarDay {
  date: string;
  status: string;
  minNights: number;
  cta: boolean;
  ctd: boolean;
}

/**
 * Traverse Direct uses a UNIFIED cancellation policy across every property:
 * full refund up to 14 days before check-in; non-refundable within 14 days.
 * BEAPI's per-listing terms.cancellation enums (strict, moderate, firm, etc.)
 * reflect what's set on OTA channels (Airbnb/VRBO) — those don't apply to
 * direct bookings, so we ignore the per-listing policy and always show the
 * unified 14-day window. Single source of truth: /cancellation page.
 */
const TRAVERSE_DIRECT_CANCEL_DAYS = 14;

function getCancellationLabel(
  _policy: string | undefined,
  checkIn?: Date | null
): string {
  if (checkIn) {
    const deadline = addDays(checkIn, -TRAVERSE_DIRECT_CANCEL_DAYS);
    if (deadline <= new Date()) return "";
    return `Free cancellation before ${format(deadline, "MMM d")}`;
  }
  return `Free cancellation up to ${TRAVERSE_DIRECT_CANCEL_DAYS} days before check-in`;
}

export function BookingSidebar({
  listingId,
  listingTitle,
  basePrice,
  pointofsale,
  picture,
  isRareFind,
  cancellationPolicy,
  reviewRating,
  reviewCount,
  bedrooms,
  bathrooms,
  accommodates,
  amenities,
  listingSlug,
  city,
}: {
  listingId: string;
  listingTitle: string;
  basePrice: number;
  pointofsale?: string;
  picture?: string | null;
  isRareFind?: boolean;
  cancellationPolicy?: string;
  reviewRating?: number;
  reviewCount?: number;
  bedrooms?: number;
  bathrooms?: number;
  accommodates?: number;
  amenities?: string[];
  listingSlug?: string;
  city?: string;
}) {
  const router = useRouter();
  const { dateRange, setDateRange, guests, setQuotePricing } = useDateRange();
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [datesUnavailable, setDatesUnavailable] = useState(false);
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [pickingCheckout, setPickingCheckout] = useState(false);
  const [checkinInput, setCheckinInput] = useState("");
  const [checkoutInput, setCheckoutInput] = useState("");
  const [focusedInput, setFocusedInput] = useState<
    "checkin" | "checkout" | null
  >(null);
  const [inputError, setInputError] = useState<{
    field: "checkin" | "checkout";
    message: string;
  } | null>(null);
  // Email capture state — "Email me this quote" + "Notify me when available"
  const [quoteEmail, setQuoteEmail] = useState("");
  const [quoteEmailStatus, setQuoteEmailStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [notifyEmail, setNotifyEmail] = useState("");
  const [notifyEmailStatus, setNotifyEmailStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [showQuoteEmail, setShowQuoteEmail] = useState(false);

  // Track the check-in date string for min-nights tooltip positioning
  const checkinDateStr = dateRange?.from
    ? format(dateRange.from, "yyyy-MM-dd")
    : null;

  // Sync input fields when dates change via calendar clicks
  useEffect(() => {
    setCheckinInput(
      dateRange?.from ? format(dateRange.from, "MM/dd/yyyy") : ""
    );
    if (inputError?.field === "checkin") setInputError(null);
  }, [dateRange?.from?.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    setCheckoutInput(dateRange?.to ? format(dateRange.to, "MM/dd/yyyy") : "");
    if (inputError?.field === "checkout") setInputError(null);
  }, [dateRange?.to?.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps

  const isDateUnavailable = useCallback(
    (dateStr: string) => {
      const day = calendarDays.find((d) => d.date === dateStr);
      return !day || day.status !== "available";
    },
    [calendarDays]
  );

  // Fetch calendar for the date picker
  useEffect(() => {
    async function fetchCalendar() {
      try {
        const from = format(new Date(), "yyyy-MM-dd");
        const to = format(addMonths(new Date(), 6), "yyyy-MM-dd");
        const res = await fetch(
          `/api/listings/${listingId}/calendar?from=${from}&to=${to}`
        );
        if (res.ok) {
          const data = await res.json();
          setCalendarDays(Array.isArray(data) ? data : []);
        }
      } catch {
        // Non-critical
      }
    }
    fetchCalendar();
  }, [listingId]);

  // Checkout-only dates: cta dates + first blocked day after each available stretch
  const checkoutOnlySet = useMemo(() => {
    const set = new Set<string>();
    for (const d of calendarDays) {
      if (d.status === "available" && d.cta) set.add(d.date);
    }
    const sorted = [...calendarDays].sort((a, b) =>
      a.date.localeCompare(b.date)
    );
    for (let i = 1; i < sorted.length; i++) {
      if (
        sorted[i].status !== "available" &&
        sorted[i - 1].status === "available"
      ) {
        set.add(sorted[i].date);
      }
    }
    return set;
  }, [calendarDays]);

  const handleCheckinInputChange = useCallback(
    (value: string) => {
      setCheckinInput(value);
      setInputError(null);
      const parsed = parse(value, "MM/dd/yyyy", new Date());
      if (!isValid(parsed) || value.length < 10) return;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (parsed < addDays(today, 1)) {
        setInputError({
          field: "checkin",
          message: "This date is unavailable",
        });
        return;
      }
      const dateStr = format(parsed, "yyyy-MM-dd");
      if (isDateUnavailable(dateStr)) {
        setInputError({
          field: "checkin",
          message: "This date is unavailable",
        });
        return;
      }
      setDateRange({ from: parsed, to: dateRange?.to });
      setPickingCheckout(true);
      setFocusedInput("checkout");
    },
    [dateRange?.to, setDateRange, isDateUnavailable]
  );

  const handleCheckoutInputChange = useCallback(
    (value: string) => {
      setCheckoutInput(value);
      setInputError(null);
      if (!dateRange?.from) return;
      const parsed = parse(value, "MM/dd/yyyy", new Date());
      if (!isValid(parsed) || value.length < 10) return;
      if (parsed <= dateRange.from) {
        setInputError({
          field: "checkout",
          message: "Check-out must be after check-in",
        });
        return;
      }
      const dateStr = format(parsed, "yyyy-MM-dd");
      // Allow checkout-only dates for checkout
      if (isDateUnavailable(dateStr) && !checkoutOnlySet.has(dateStr)) {
        setInputError({
          field: "checkout",
          message: "This date is unavailable",
        });
        return;
      }
      // Check for unavailable dates between check-in and check-out (exclude checkout-only)
      const fromStr = format(dateRange.from, "yyyy-MM-dd");
      if (
        calendarDays.some(
          (d) =>
            d.status !== "available" &&
            !checkoutOnlySet.has(d.date) &&
            d.date > fromStr &&
            d.date < dateStr
        )
      ) {
        setInputError({
          field: "checkout",
          message: "This date is unavailable",
        });
        return;
      }
      setDateRange({ from: dateRange.from, to: parsed });
      setPickingCheckout(false);
    },
    [
      dateRange?.from,
      setDateRange,
      isDateUnavailable,
      calendarDays,
      checkoutOnlySet,
    ]
  );

  // Dates that are completely unavailable, excluding checkout-only (so they're not disabled by rdp)
  const unavailableDates = useMemo(
    () =>
      calendarDays
        .filter((d) => d.status !== "available" && !checkoutOnlySet.has(d.date))
        .map((d) => new Date(d.date + "T12:00:00")),
    [calendarDays, checkoutOnlySet]
  );

  // Dates where check-out is not allowed (ctd = close to departure)
  const noCheckoutDates = useMemo(
    () =>
      calendarDays
        .filter((d) => d.status === "available" && d.ctd)
        .map((d) => new Date(d.date + "T12:00:00")),
    [calendarDays]
  );

  // Find the first unavailable date after check-in
  const maxCheckoutDate = useMemo((): Date | null => {
    if (!dateRange?.from) return null;
    const checkinStr = format(dateRange.from, "yyyy-MM-dd");
    const blocked = calendarDays
      .filter((d) => d.status !== "available" && d.date > checkinStr)
      .sort((a, b) => a.date.localeCompare(b.date));
    return blocked.length > 0 ? new Date(blocked[0].date + "T12:00:00") : null;
  }, [dateRange?.from, calendarDays]);

  // Set of all unavailable date strings for strikethrough styling
  const unavailableSet = useMemo(() => {
    const set = new Set<string>();
    for (const d of calendarDays) {
      if (d.status !== "available") set.add(d.date);
    }
    return set;
  }, [calendarDays]);

  // Min nights for the selected check-in date
  const minNights = useMemo(() => {
    if (!dateRange?.from) return null;
    const fromStr = format(dateRange.from, "yyyy-MM-dd");
    const day = calendarDays.find((d) => d.date === fromStr);
    return day?.minNights && day.minNights > 1 ? day.minNights : null;
  }, [dateRange?.from, calendarDays]);

  // Build disabled dates based on selection state
  const disabledDates = useMemo(() => {
    if (pickingCheckout && dateRange?.from) {
      const cutoffTime = maxCheckoutDate?.getTime();
      const checkoutUnavailable = cutoffTime
        ? unavailableDates.filter((d) => d.getTime() !== cutoffTime)
        : unavailableDates;
      // Earliest checkout = checkin + minNights (or checkin + 1 if no min)
      const earliestCheckout = addDays(dateRange.from, minNights || 1);
      const matchers: Array<
        Date | { before: Date } | ((date: Date) => boolean)
      > = [
        { before: earliestCheckout },
        ...checkoutUnavailable,
        ...noCheckoutDates,
      ];
      if (cutoffTime) {
        matchers.push((date: Date) => date.getTime() > cutoffTime);
      }
      return matchers;
    }
    // Don't include noCheckinDates here — they're styled as half-gray and rejected in onSelect
    return [{ before: addDays(new Date(), 1) }, ...unavailableDates];
  }, [
    pickingCheckout,
    dateRange?.from,
    unavailableDates,
    noCheckoutDates,
    maxCheckoutDate,
    minNights,
  ]);

  // Track which date to show "Check-out only" tooltip on
  const [checkoutOnlyTooltip, setCheckoutOnlyTooltip] = useState<string | null>(
    null
  );

  // Custom DayButton with strikethrough, checkout-only tooltip, min-nights tooltip
  const CustomDayButton = useCallback(
    (props: React.ComponentProps<typeof DayButtonType>) => {
      const dateStr = format(props.day.date, "yyyy-MM-dd");
      const isUnavailable = unavailableSet.has(dateStr);
      const isCheckoutOnly = checkoutOnlySet.has(dateStr);
      // Check if this date is currently selected as range start or end
      const isSelected =
        (dateRange?.from && format(dateRange.from, "yyyy-MM-dd") === dateStr) ||
        (dateRange?.to && format(dateRange.to, "yyyy-MM-dd") === dateStr);
      // Checkout-only: same gray as unavailable + strikethrough (like Airbnb)
      const strikethrough = isUnavailable && !isCheckoutOnly;
      const showMinNights =
        pickingCheckout &&
        checkinDateStr &&
        dateStr === checkinDateStr &&
        minNights;
      const showCheckoutOnly = checkoutOnlyTooltip === dateStr;

      return (
        <div
          className="group/co relative"
          onClick={() => {
            if (isCheckoutOnly && !pickingCheckout) {
              setCheckoutOnlyTooltip(dateStr);
              setTimeout(() => setCheckoutOnlyTooltip(null), 2000);
            }
          }}
        >
          <CalendarDayButton
            {...props}
            className={`${props.className || ""} ${strikethrough ? "line-through !text-muted-foreground !opacity-50" : ""} ${isCheckoutOnly && !isSelected ? "!text-muted-foreground/80" : ""}`}
          />
          {showMinNights && (
            <div className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 z-20 whitespace-nowrap rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-foreground shadow-sm">
              {minNights}-night minimum
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-2 w-2 rotate-45 border-b border-r border-border bg-background" />
            </div>
          )}
          {isCheckoutOnly && !pickingCheckout && !isSelected && (
            <div
              className={`pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 z-20 whitespace-nowrap rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-foreground shadow-sm transition-opacity ${showCheckoutOnly ? "opacity-100" : "opacity-0 group-hover/co:opacity-100"}`}
            >
              Check-out only
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-2 w-2 rotate-45 border-b border-r border-border bg-background" />
            </div>
          )}
        </div>
      );
    },
    [
      unavailableSet,
      checkoutOnlySet,
      pickingCheckout,
      checkinDateStr,
      minNights,
      checkoutOnlyTooltip,
      dateRange?.from,
      dateRange?.to,
    ]
  );

  const checkAvailability = useCallback(async () => {
    if (!dateRange?.from || !dateRange?.to) return;

    const checkIn = format(dateRange.from, "yyyy-MM-dd");
    const checkOut = format(dateRange.to, "yyyy-MM-dd");

    if (checkOut <= checkIn) {
      setError("Check-out date must be after check-in date");
      return;
    }

    setLoading(true);
    setError(null);
    setDatesUnavailable(false);
    setQuote(null);
    setShowQuoteEmail(false);
    setQuoteEmailStatus("idle");
    setNotifyEmailStatus("idle");
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
            const data: QuoteResponse = await retry.json();
            setQuote(data);
            return;
          }
          throw new Error("Please wait a moment and try again.");
        }
        const data = await res.json();
        const msg = data.error || "";
        if (
          msg.includes("LISTING_IS_NOT_AVAILABLE") ||
          msg.includes("not applicable")
        ) {
          setDatesUnavailable(true);
          setLoading(false);
          return;
        }
        if (
          msg.includes("checkOutDateLocalized") ||
          msg.includes("checkInDateLocalized")
        ) {
          throw new Error("Please select valid check-in and check-out dates.");
        }
        if (msg.includes("WRONG_REQUEST_PARAMETERS")) {
          throw new Error("Something went wrong. Please try different dates.");
        }
        throw new Error("Unable to get pricing. Please try again.");
      }

      const data: QuoteResponse = await res.json();
      setQuote(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [dateRange, guests, listingId, listingTitle, pointofsale]);

  // Auto-fetch quote whenever both dates are selected
  useEffect(() => {
    if (!dateRange?.from || !dateRange?.to) return;
    const timer = setTimeout(() => checkAvailability(), 300);
    return () => clearTimeout(timer);
  }, [dateRange?.from?.getTime(), dateRange?.to?.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps

  // Extract pricing from the first rate plan
  const pricing = useMemo(() => {
    if (!quote) return null;
    const rp = quote.rates?.ratePlans?.[0];
    if (!rp) return null;
    const money = rp.ratePlan?.money;
    const days = rp.days || [];
    if (!money) return null;

    return {
      ratePlanId: rp.ratePlan._id,
      ratePlanName: rp.ratePlan.name,
      cancellationPolicy: rp.ratePlan.cancellationPolicy,
      nights: days.length,
      accommodation: money.fareAccommodation,
      accommodationAdjusted: money.fareAccommodationAdjusted,
      cleaning: money.fareCleaning,
      taxes: money.totalTaxes,
      total: money.hostPayout,
      invoiceItems: money.invoiceItems,
      // Per-tax breakdown surfaced to the checkout PriceBreakdown dropdown.
      // Has to be computed here (not on /book) because the "Book Now" path
      // caches this pricing object in sessionStorage, and /book reads from
      // cache without re-fetching. Without this, fresh searches lose the
      // tax breakdown until the cache expires.
      taxBreakdown: extractTaxBreakdown(money.invoiceItems),
      days,
    };
  }, [quote]);

  // Sync pricing to shared context for sticky nav
  useEffect(() => {
    setQuotePricing(
      pricing ? { total: pricing.total, nights: pricing.nights } : null
    );
  }, [pricing, setQuotePricing]);

  // Compute competitor pricing for comparison
  const comparison = useMemo(() => {
    if (!pricing) return null;
    const accommodation = pricing.accommodationAdjusted;
    const cleaning = pricing.cleaning;
    const taxes = pricing.taxes;
    const spTotal = pricing.total;

    const baseAccom = accommodation / 1.1;
    const taxRate =
      accommodation + cleaning > 0 ? taxes / (accommodation + cleaning) : 0;

    // Airbnb: 15.5% markup + cleaning + proportional taxes
    const airbnbAccom = baseAccom * 1.155;
    const airbnbPretax = airbnbAccom + cleaning;
    const airbnbTotal = airbnbPretax * (1 + taxRate);

    // VRBO: 20% markup + cleaning + 8% guest service fee + proportional taxes
    const vrboAccom = baseAccom * 1.2;
    const vrboPretax = vrboAccom + cleaning;
    const vrboServiceFee = vrboPretax * 0.08;
    const vrboTotal = vrboPretax * (1 + taxRate) + vrboServiceFee;

    // Booking.com: 20% markup + cleaning (no markup) + proportional taxes, no guest service fee
    const bookingAccom = baseAccom * 1.2;
    const bookingPretax = bookingAccom + cleaning;
    const bookingTotal = bookingPretax * (1 + taxRate);

    const airbnbSavings = airbnbTotal - spTotal;
    const vrboSavings = vrboTotal - spTotal;
    const bookingSavings = bookingTotal - spTotal;
    const maxSavings = Math.max(airbnbSavings, vrboSavings, bookingSavings);

    return {
      airbnbTotal,
      vrboTotal,
      bookingTotal,
      airbnbSavings,
      vrboSavings,
      bookingSavings,
      maxSavings,
    };
  }, [pricing]);

  function handleBookNow() {
    if (!quote || !pricing) return;
    trackClickBookNow({
      listingId,
      listingTitle,
      checkIn: quote.checkInDateLocalized,
      checkOut: quote.checkOutDateLocalized,
      guests,
      value: pricing.total,
    });
    sessionStorage.setItem(
      `quote_${quote._id}`,
      JSON.stringify({
        quoteId: quote._id,
        ratePlanId: pricing.ratePlanId,
        listingId,
        listingTitle,
        picture: picture || null,
        checkIn: quote.checkInDateLocalized,
        checkOut: quote.checkOutDateLocalized,
        guests,
        pricing,
        promotion: quote.promotions,
        reviewRating: reviewRating || null,
        reviewCount: reviewCount || null,
      })
    );
    router.push(`/book/${quote._id}`);
  }

  async function handleQuoteEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!quoteEmail.trim() || !pricing || !quote) return;
    setQuoteEmailStatus("loading");
    try {
      const email = quoteEmail.trim().toLowerCase();
      identifyUser(email);
      const attribution = getEmailCaptureAttribution(
        "inline",
        "quote",
        listingId
      );
      const nights = pricing.nights || 1; // guard against division by zero
      const nightlyRate = Math.round(pricing.accommodationAdjusted / nights);
      const nightlySubtotal = pricing.accommodationAdjusted.toFixed(2);
      const feesTaxes = (pricing.total - pricing.accommodationAdjusted).toFixed(
        2
      );
      // Build hero photo URL (600w for email) — handles both t_ prefix and /image/upload/ URLs
      let photoUrl = "";
      if (picture) {
        if (/\/t_[a-z_]+\//.test(picture)) {
          photoUrl = picture.replace(
            /\/t_[a-z_]+\//,
            "/w_600,h_360,c_fill,q_auto,f_auto/"
          );
        } else if (picture.includes("/image/upload/")) {
          photoUrl = picture.replace(
            "/image/upload/",
            "/image/upload/w_600,h_360,c_fill,q_auto,f_auto/"
          );
        } else {
          photoUrl = picture;
        }
      }
      // Pick top amenities for email display
      const topAmenities = (amenities || [])
        .filter((a) =>
          /parking|kitchen|air cond|washer|dryer|hot tub|fireplace|patio|balcon|pool|wifi|wireless|dishwasher/i.test(
            a
          )
        )
        .slice(0, 4);
      const listingUrl = listingSlug
        ? `https://www.booktraverse.com/properties/${listingSlug}`
        : `https://www.booktraverse.com/properties/${listingId}`;

      const res = await fetch("/api/track/listing-email-capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          event: "Requested Quote Email",
          properties: {
            "Listing ID": listingId,
            Listing_ID: listingId,
            "Listing Title": listingTitle,
            Listing_Title: listingTitle,
            "Check-In": quote.checkInDateLocalized,
            Check_In: quote.checkInDateLocalized,
            "Check-Out": quote.checkOutDateLocalized,
            Check_Out: quote.checkOutDateLocalized,
            Guests: guests,
            Total: pricing.total,
            Nights: pricing.nights,
            "Nightly Rate": nightlyRate,
            Nightly_Rate: nightlyRate,
            Nightly_Subtotal: nightlySubtotal,
            Fees_Taxes: feesTaxes,
            Photo: photoUrl,
            Rating: reviewRating ? reviewRating.toFixed(1) : "",
            Review_Count: reviewCount ?? "",
            Bedrooms: bedrooms ?? "",
            Bathrooms: bathrooms ?? "",
            Sleeps: accommodates ?? "",
            City: city || "Colorado",
            Amenities: topAmenities,
            Listing_URL: listingUrl,
          },
          attribution,
        }),
      });
      if (!res.ok) throw new Error();
      setQuoteEmailStatus("success");
      setQuoteEmail("");
    } catch {
      setQuoteEmailStatus("error");
    }
  }

  async function handleNotifyEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!notifyEmail.trim()) return;
    setNotifyEmailStatus("loading");
    try {
      const email = notifyEmail.trim().toLowerCase();
      identifyUser(email);
      const attribution = getEmailCaptureAttribution(
        "inline",
        "notify",
        listingId
      );
      const res = await fetch("/api/track/listing-email-capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          event: "Requested Availability Notification",
          properties: {
            "Listing ID": listingId,
            "Listing Title": listingTitle,
            "Check-In": dateRange?.from
              ? format(dateRange.from, "yyyy-MM-dd")
              : "",
            "Check-Out": dateRange?.to
              ? format(dateRange.to, "yyyy-MM-dd")
              : "",
            Guests: guests,
          },
          attribution,
        }),
      });
      if (!res.ok) throw new Error();
      setNotifyEmailStatus("success");
      setNotifyEmail("");
    } catch {
      setNotifyEmailStatus("error");
    }
  }

  return (
    <Card className="sticky top-24 pt-0 gap-0">
      <PricingBadge />
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="flex items-baseline gap-2">
          {pricing ? (
            <>
              <span className="text-3xl font-bold">
                {formatCurrency(pricing.total)}
              </span>
              <span className="text-base font-normal text-muted-foreground">
                for {pricing.nights} nights
              </span>
            </>
          ) : loading ? (
            <span className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-base">Calculating...</span>
            </span>
          ) : (
            <>
              <span className="text-3xl font-bold">
                {formatCurrency(basePrice)}
              </span>
              <span className="text-base font-normal text-muted-foreground">
                / night
              </span>
            </>
          )}
        </CardTitle>
      </CardHeader>
      {isRareFind && <RareFindBadge className="mx-6 mb-2" />}
      <CardContent className="space-y-4">
        {/* Check-in / Check-out boxes */}
        <Popover
          open={calendarOpen}
          onOpenChange={(open) => {
            setCalendarOpen(open);
            if (open) {
              // Preserve existing dates when reopening to modify
              if (dateRange?.from && dateRange?.to) {
                setFocusedInput("checkin");
              } else {
                setDateRange(undefined);
                setPickingCheckout(false);
                setFocusedInput("checkin");
              }
              setQuote(null);
              setError(null);
              setDatesUnavailable(false);
            } else {
              setFocusedInput(null);
            }
          }}
        >
          <PopoverTrigger asChild>
            <div className="grid cursor-pointer grid-cols-2 gap-3">
              <div
                className={`rounded-xl border px-4 py-3 transition-colors ${datesUnavailable ? "border-red-500 border-2" : "border-border hover:border-foreground/30"}`}
              >
                <p
                  className={`text-xs font-medium ${datesUnavailable ? "text-red-500" : "text-muted-foreground"}`}
                >
                  Check-in
                </p>
                <p className="mt-0.5 text-sm font-semibold text-foreground">
                  {dateRange?.from
                    ? format(dateRange.from, "MMM dd, yyyy")
                    : "Select date"}
                </p>
              </div>
              <div
                className={`rounded-xl border px-4 py-3 transition-colors ${datesUnavailable ? "border-red-500 border-2" : "border-border hover:border-foreground/30"}`}
              >
                <p
                  className={`text-xs font-medium ${datesUnavailable ? "text-red-500" : "text-muted-foreground"}`}
                >
                  Check-out
                </p>
                <p className="mt-0.5 text-sm font-semibold text-foreground">
                  {dateRange?.to
                    ? format(dateRange.to, "MMM dd, yyyy")
                    : "Select date"}
                </p>
              </div>
            </div>
          </PopoverTrigger>
          {datesUnavailable && (
            <div className="mt-2 space-y-3">
              <p className="text-center text-sm font-medium text-red-500">
                Dates are not available
              </p>
              {notifyEmailStatus === "success" ? (
                <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-3 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span>We&apos;ll notify you if these dates open up.</span>
                </div>
              ) : (
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                    <Bell className="h-3.5 w-3.5" />
                    Notify me if these dates open up
                  </div>
                  <form
                    onSubmit={handleNotifyEmail}
                    className="mt-2 flex gap-2"
                  >
                    <input
                      type="email"
                      required
                      placeholder="you@example.com"
                      value={notifyEmail}
                      onChange={(e) => {
                        setNotifyEmail(e.target.value);
                        if (notifyEmailStatus === "error")
                          setNotifyEmailStatus("idle");
                      }}
                      className="h-9 flex-1 rounded-lg border border-border bg-white px-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
                    />
                    <button
                      type="submit"
                      disabled={notifyEmailStatus === "loading"}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                    >
                      {notifyEmailStatus === "loading" ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Send className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </form>
                  {notifyEmailStatus === "error" && (
                    <p className="mt-1.5 text-xs text-red-500">
                      Something went wrong. Please try again.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
          <PopoverContent className="w-auto p-0" align="center" sideOffset={8}>
            <div className="flex items-start justify-between px-5 pt-4 pb-1">
              {/* Header — left side */}
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  {dateRange?.from && dateRange?.to
                    ? `${Math.round((dateRange.to.getTime() - dateRange.from.getTime()) / 86400000)} nights`
                    : "Select dates"}
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {dateRange?.from && dateRange?.to
                    ? `${format(dateRange.from, "MMM d, yyyy")} – ${format(dateRange.to, "MMM d, yyyy")}`
                    : "Add your travel dates for exact pricing"}
                </p>
              </div>

              {/* Date input fields — right side */}
              <div className="relative pb-5">
                <div className="flex">
                  <div
                    className={`w-[8rem] rounded-l-lg border px-2.5 py-1 cursor-pointer transition-colors ${
                      inputError?.field === "checkin"
                        ? "z-10 border-red-500 border-2 -m-px"
                        : focusedInput === "checkin"
                          ? "z-10 border-foreground border-2 -m-px"
                          : "border-border"
                    }`}
                    onClick={() => {
                      setFocusedInput("checkin");
                      setPickingCheckout(false);
                      setInputError(null);
                    }}
                  >
                    <p
                      className={`text-[9px] font-bold uppercase tracking-wider ${inputError?.field === "checkin" ? "text-red-500" : "text-muted-foreground"}`}
                    >
                      Check-in
                    </p>
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        placeholder={
                          focusedInput === "checkin" ? "MM/DD/YYYY" : "Add date"
                        }
                        value={checkinInput}
                        onChange={(e) =>
                          handleCheckinInputChange(e.target.value)
                        }
                        onFocus={() => {
                          setFocusedInput("checkin");
                          setPickingCheckout(false);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="block w-full bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
                      />
                      {checkinInput && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setCheckinInput("");
                            setDateRange(undefined);
                            setInputError(null);
                            setFocusedInput("checkin");
                            setPickingCheckout(false);
                          }}
                          className="shrink-0 text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div
                    className={`w-[8rem] -ml-px rounded-r-lg border px-2.5 py-1 cursor-pointer transition-colors ${
                      inputError?.field === "checkout"
                        ? "z-10 border-red-500 border-2 -m-px"
                        : focusedInput === "checkout"
                          ? "z-10 border-foreground border-2 -m-px"
                          : "border-border"
                    }`}
                    onClick={() => {
                      setFocusedInput("checkout");
                      setInputError(null);
                      if (dateRange?.from) {
                        setPickingCheckout(true);
                        setDateRange({ from: dateRange.from, to: undefined });
                        setQuote(null);
                        setError(null);
                      }
                    }}
                  >
                    <p
                      className={`text-[9px] font-bold uppercase tracking-wider ${inputError?.field === "checkout" ? "text-red-500" : "text-muted-foreground"}`}
                    >
                      Checkout
                    </p>
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        placeholder={
                          focusedInput === "checkout"
                            ? "MM/DD/YYYY"
                            : "Add date"
                        }
                        value={checkoutInput}
                        onChange={(e) =>
                          handleCheckoutInputChange(e.target.value)
                        }
                        onFocus={() => {
                          setFocusedInput("checkout");
                          if (dateRange?.from) setPickingCheckout(true);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="block w-full bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
                      />
                      {checkoutInput && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setCheckoutInput("");
                            if (dateRange?.from) {
                              setDateRange({
                                from: dateRange.from,
                                to: undefined,
                              });
                            }
                            setInputError(null);
                            setFocusedInput("checkout");
                            setPickingCheckout(true);
                          }}
                          className="shrink-0 text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                {inputError && (
                  <div className="absolute left-0 right-0 top-full -mt-4 flex items-center gap-1 text-red-500">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    <span className="text-[11px]">{inputError.message}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Two-month calendar */}
            <Calendar
              mode="range"
              selected={dateRange}
              onSelect={(range) => {
                const checkin = dateRange?.from;
                let clicked: Date | null = null;
                if (range?.from && range?.to) {
                  if (checkin && range.from.getTime() !== checkin.getTime())
                    clicked = range.from;
                  else if (checkin && range.to.getTime() !== checkin.getTime())
                    clicked = range.to;
                  else clicked = range.from;
                } else {
                  clicked = range?.from || range?.to || null;
                }
                if (!clicked) return;

                if (!pickingCheckout) {
                  const clickedStr = format(clicked, "yyyy-MM-dd");
                  if (checkoutOnlySet.has(clickedStr)) {
                    setCheckoutOnlyTooltip(clickedStr);
                    setTimeout(() => setCheckoutOnlyTooltip(null), 2000);
                    return;
                  }
                  setDateRange({ from: clicked, to: undefined });
                  setPickingCheckout(true);
                  setFocusedInput("checkout");
                  setQuote(null);
                  setError(null);
                } else if (checkin) {
                  if (clicked.getTime() <= checkin.getTime()) {
                    const clickedStr = format(clicked, "yyyy-MM-dd");
                    if (checkoutOnlySet.has(clickedStr)) {
                      setCheckoutOnlyTooltip(clickedStr);
                      setTimeout(() => setCheckoutOnlyTooltip(null), 2000);
                      return;
                    }
                    setDateRange({ from: clicked, to: undefined });
                    setFocusedInput("checkout");
                    setQuote(null);
                    setError(null);
                    return;
                  }
                  const fromStr = format(checkin, "yyyy-MM-dd");
                  const toStr = format(clicked, "yyyy-MM-dd");
                  if (
                    calendarDays.some(
                      (d) =>
                        d.status !== "available" &&
                        d.date > fromStr &&
                        d.date < toStr
                    )
                  )
                    return;
                  setDateRange({ from: checkin, to: clicked });
                  setPickingCheckout(false);
                  setFocusedInput(null);
                  setQuote(null);
                  setError(null);
                  // Auto-close after checkout is picked
                  setTimeout(() => setCalendarOpen(false), 150);
                }
              }}
              components={{ DayButton: CustomDayButton }}
              numberOfMonths={2}
              disabled={disabledDates}
              showOutsideDays={false}
              className="px-4 pb-2 [--cell-size:2.25rem]"
              classNames={{
                months: "relative flex flex-row gap-4",
                month: "flex w-full flex-col gap-2",
                month_caption: "flex h-8 w-full items-center justify-center",
                caption_label: "text-sm font-semibold",
                nav: "absolute inset-x-0 top-0 z-10 flex w-full items-center justify-between px-1",
                weekdays: "flex w-full",
                weekday:
                  "flex-1 text-center text-[10px] font-medium text-muted-foreground uppercase tracking-wide",
                week: "mt-0.5 flex w-full",
                day: "group/day relative flex-1 aspect-square select-none p-0 text-center text-xs",
                range_start: "rdp-no-gradient bg-muted rounded-l-full",
                range_middle: "rdp-no-gradient bg-muted",
                range_end: "rdp-no-gradient bg-muted rounded-r-full",
              }}
            />

            {/* Footer */}
            <div className="flex items-center justify-between border-t px-5 py-2.5">
              <button
                className="text-sm font-semibold text-foreground underline underline-offset-2 hover:text-foreground/70"
                onClick={() => {
                  setDateRange(undefined);
                  setPickingCheckout(false);
                  setQuote(null);
                  setError(null);
                }}
              >
                Clear dates
              </button>
              <Button
                size="sm"
                className="rounded-lg bg-foreground px-4 text-background hover:bg-foreground/90"
                onClick={() => setCalendarOpen(false)}
              >
                Close
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        {/* Cancellation policy — above Reserve like Airbnb */}
        {(() => {
          const policy =
            pricing?.cancellationPolicy ||
            cancellationPolicy ||
            "semi_flexible";
          const label = getCancellationLabel(policy, dateRange?.from);
          return label ? (
            <div className="rounded-lg bg-muted px-3 py-2 text-center text-xs text-foreground">
              {label}
            </div>
          ) : null;
        })()}

        <Button
          onClick={pricing ? handleBookNow : checkAvailability}
          disabled={!dateRange?.from || !dateRange?.to || loading}
          variant="accent"
          className="relative w-full overflow-hidden rounded-full py-6 text-base font-semibold after:absolute after:inset-0 after:animate-shimmer after:bg-gradient-to-r after:from-transparent after:via-white/20 after:via-50% after:to-transparent"
          size="lg"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Checking...
            </>
          ) : (
            "Reserve"
          )}
        </Button>
        {pricing && (
          <p className="text-center text-sm text-muted-foreground">
            You won&apos;t be charged yet.
          </p>
        )}

        {/* Group-booking add-to-cart — appears next to Reserve so guests
            building a multi-listing booking can collect listings into a
            single cart. Disabled until dates are picked. The button itself
            handles "already in cart" state. */}
        <AddToCartButton
          listingId={listingId}
          listingTitle={listingTitle}
          listingPicture={picture ?? null}
          bedrooms={bedrooms ?? null}
          accommodates={accommodates ?? null}
          city={city ?? null}
          checkIn={dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : null}
          checkOut={dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : null}
          guests={Math.max(1, guests)}
          nightlyPriceSnapshot={basePrice ?? null}
        />

        {pricing && (
          <div className="border-t pt-3">
            {quoteEmailStatus === "success" ? (
              <div className="flex items-center justify-center gap-2 py-1 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <span>Quote sent! Check your inbox.</span>
              </div>
            ) : showQuoteEmail ? (
              <form onSubmit={handleQuoteEmail} className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  We&apos;ll email you this quote so you can book when
                  you&apos;re ready.
                </p>
                <div className="flex gap-2">
                  <input
                    type="email"
                    required
                    placeholder="you@example.com"
                    value={quoteEmail}
                    onChange={(e) => {
                      setQuoteEmail(e.target.value);
                      if (quoteEmailStatus === "error")
                        setQuoteEmailStatus("idle");
                    }}
                    className="h-9 flex-1 rounded-lg border border-border bg-white px-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
                  />
                  <button
                    type="submit"
                    disabled={quoteEmailStatus === "loading"}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                  >
                    {quoteEmailStatus === "loading" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <>
                        <Send className="h-3.5 w-3.5" />
                        Send
                      </>
                    )}
                  </button>
                </div>
                {quoteEmailStatus === "error" && (
                  <p className="text-xs text-red-500">
                    Something went wrong. Please try again.
                  </p>
                )}
              </form>
            ) : (
              <button
                onClick={() => setShowQuoteEmail(true)}
                className="flex w-full items-center justify-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <Mail className="h-3.5 w-3.5" />
                Email me this quote
              </button>
            )}
          </div>
        )}

        {pricing && comparison && comparison.maxSavings > 0 && (
          <div className="space-y-4 border-t pt-4">
            {/* Book Traverse row */}
            <div className="flex items-center gap-3">
              <div className="w-[100px] shrink-0">
                <Image
                  src="/book-traverse-wordmark-dark.png"
                  alt="Book Traverse"
                  width={200}
                  height={40}
                  className="h-6 w-auto object-contain object-left"
                />
              </div>
              <span className="ml-auto flex items-center gap-2 whitespace-nowrap">
                <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="h-3.5 w-3.5 shrink-0 text-primary"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8.603 3.799A4.49 4.49 0 0 1 12 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 0 1 3.498 1.307 4.491 4.491 0 0 1 1.307 3.497A4.49 4.49 0 0 1 21.75 12a4.49 4.49 0 0 1-1.549 3.397 4.491 4.491 0 0 1-1.307 3.497 4.491 4.491 0 0 1-3.497 1.307A4.49 4.49 0 0 1 12 21.75a4.49 4.49 0 0 1-3.397-1.549 4.49 4.49 0 0 1-3.498-1.306 4.491 4.491 0 0 1-1.307-3.498A4.49 4.49 0 0 1 2.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 0 1 1.307-3.497 4.49 4.49 0 0 1 3.497-1.307Zm7.007 6.387a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Best deal.{" "}
                  <span className="font-bold">
                    You save {formatCurrency(comparison.maxSavings)}
                  </span>
                </span>
                <span className="text-base font-bold text-foreground">
                  {formatCurrency(pricing.total)}
                </span>
              </span>
            </div>

            {[
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
            ]
              .sort((a, b) => b.total - a.total)
              .map((comp, i) => (
                <div key={comp.name} className="flex items-center gap-3">
                  <div className="w-[100px] shrink-0">
                    <Image
                      src={comp.src}
                      alt={comp.alt}
                      width={comp.w}
                      height={comp.h}
                      className={`${comp.imgH} w-auto object-contain object-left`}
                    />
                  </div>
                  <span className="ml-auto whitespace-nowrap text-right text-xs text-muted-foreground">
                    {i === 0 ? (
                      <>Most expensive: {formatCurrency(comp.savings)} more</>
                    ) : (
                      `You\u2019ll pay ${formatCurrency(comp.savings)} more`
                    )}{" "}
                    <span className="text-sm">
                      {formatCurrency(comp.total)}
                    </span>
                  </span>
                </div>
              ))}
          </div>
        )}

        {!pricing && !loading && !error && (
          <div className="space-y-3 border-t pt-4">
            <div className="flex items-center gap-3">
              <div className="w-[100px] shrink-0">
                <Image
                  src="/book-traverse-wordmark-dark.png"
                  alt="Book Traverse"
                  width={200}
                  height={40}
                  className="h-6 w-auto object-contain object-left"
                />
              </div>
              <span className="ml-auto text-xs text-muted-foreground">
                Lowest price guaranteed
              </span>
            </div>
            {[
              {
                src: "/logo-vrbo.png",
                alt: "Vrbo",
                w: 346,
                h: 111,
                imgH: "h-5",
              },
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
                <div className="w-[100px] shrink-0">
                  <Image
                    src={comp.src}
                    alt={comp.alt}
                    width={comp.w}
                    height={comp.h}
                    className={`${comp.imgH} w-auto object-contain object-left opacity-40`}
                  />
                </div>
                <span className="ml-auto">
                  <span className="inline-block h-3 w-20 rounded bg-muted" />
                </span>
              </div>
            ))}
            <p className="text-center text-xs text-muted-foreground">
              Select dates to compare prices
            </p>
          </div>
        )}

        {error && (
          <p className="text-center text-sm text-destructive">{error}</p>
        )}
      </CardContent>
    </Card>
  );
}
