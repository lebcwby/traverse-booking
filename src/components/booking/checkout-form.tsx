"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  format,
  addMonths,
  addDays,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  isBefore,
} from "date-fns";
import type { DateRange, DayButton as DayButtonType } from "react-day-picker";
import {
  identifyUser,
  trackAddShippingInfo,
  trackAddPaymentInfo,
  trackBookingCompleted,
  trackCheckoutError,
  trackInitiateCheckoutEnriched,
} from "@/lib/tracking";
import { getEffectiveClientConsent } from "@/lib/consent";
import { createClient } from "@/lib/supabase-auth";
import Link from "next/link";
import { GuestForm, type GuestInfo, isValidEmail } from "./guest-form";
import {
  StripePayment,
  type ExpressCheckoutBillingDetails,
} from "./stripe-payment";
import { PriceBreakdown } from "./price-breakdown";
import { CouponInput } from "./coupon-input";
import { UpsellSelector } from "./upsell-selector";
import {
  getSelectedUpsells,
  resolveUpsellsForListing,
  resolvePetFeePerPet,
} from "@/lib/upsells";
import { extractQuotePricing, getQuoteIdentifiers } from "@/lib/quote-response";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Lock,
  Minus,
  Plus,
  X,
} from "lucide-react";
import Image from "next/image";
import { getPhotoUrl } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils";

export interface QuoteData {
  quoteId: string;
  ratePlanId: string;
  listingId: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  listingTitle: string;
  /** Internal short name for ops (e.g. "Slopeside Escape 314"). Surfaces in
   *  GA4 Ecommerce reports as Item variant alongside the marketing title. */
  listingNickname?: string | null;
  picture?: string | null;
  propertyType?: string | null;
  city?: string | null;
  pricing: {
    nights: number;
    accommodation: number;
    accommodationAdjusted: number;
    cleaning: number;
    taxes: number;
    /** Per-tax line items extracted from invoiceItems by extractQuotePricing.
     *  When present, PriceBreakdown renders the Taxes row as an expandable
     *  dropdown. See src/lib/quote-response.ts:extractTaxBreakdown. */
    taxBreakdown?: Array<{ name: string; amount: number }>;
    total: number;
    days: Array<{ date: string; price: number }>;
    invoiceItems?: Array<{ title: string; amount: number; type: string }>;
    cancellationPolicy?: string;
  };
  promotion?: { name: string; type: string };
  photos?: Array<{ original: string; thumbnail: string; caption?: string }>;
  reviewRating?: number | null;
  reviewCount?: number | null;
  /** Per-listing pet config from Guesty BEAPI listing detail.
   *  petFeePerPet is in dollars (matches UpsellItem.amount). When pets are
   *  not allowed, Pet Fee is hidden from the upsell picker entirely. */
  petsAllowed?: boolean;
  petFeePerPet?: number | null;
}

function getCheckoutCancellationText(
  _policy: string | undefined,
  checkIn: string
): string {
  // Traverse Direct uses ONE unified cancellation policy on all direct bookings:
  // full refund up to 14 days before check-in (matches the property sidebar and
  // /cancellation page). BEAPI's per-listing policy enums (flexible/moderate/
  // firm/strict) reflect OTA-channel terms and do NOT apply here — using them
  // produced a refund deadline that contradicted the stated 14-day policy.
  const TRAVERSE_DIRECT_CANCEL_DAYS = 14;
  const checkInDate = new Date(checkIn + "T12:00:00");
  const deadline = addDays(checkInDate, -TRAVERSE_DIRECT_CANCEL_DAYS);
  if (deadline <= new Date()) return "";
  return `Cancel before check-in on ${format(deadline, "MMM d")} for a full refund. `;
}

export function CheckoutForm({ quote: initialQuote }: { quote: QuoteData }) {
  const router = useRouter();
  const [quote, setQuote] = useState(initialQuote);
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [mobileSummaryExpanded, setMobileSummaryExpanded] = useState(false);
  const [guest, setGuest] = useState<GuestInfo>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  });
  const [marketingOptIn, setMarketingOptIn] = useState(true);
  const [cardReady, setCardReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bookingComplete, setBookingComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedUpsells, setSelectedUpsells] = useState<string[]>([]);
  const [pets, setPets] = useState(0);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [checkoutToken, setCheckoutToken] = useState<string | null>(null);
  const [piVersion, setPiVersion] = useState(0);
  const [stripeCustomerId, setStripeCustomerId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [expressMissingInfo, setExpressMissingInfo] = useState<{
    paymentIntentId: string;
    guest: GuestInfo;
    missingFields: string[];
  } | null>(null);
  const lastPaymentIntentRequestKey = useRef<string | null>(null);
  const lastPaymentIntentGuestDetailsKey = useRef<string | null>(null);

  // Lock body scroll when gallery is open
  useEffect(() => {
    if (!galleryOpen) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [galleryOpen]);

  // Sync photos from parent when they arrive after async fetch
  useEffect(() => {
    if (initialQuote.photos && initialQuote.photos.length > 0) {
      setQuote((prev) => ({
        ...prev,
        photos: initialQuote.photos,
        picture: initialQuote.picture || prev.picture,
      }));
    }
  }, [initialQuote.photos, initialQuote.picture]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Prefill guest info from logged-in user
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      const meta = user.user_metadata || {};
      const fullName: string = meta.full_name || "";
      const [first, ...rest] = fullName.split(" ");
      setGuest((prev) => ({
        firstName: prev.firstName || first || meta.first_name || "",
        lastName: prev.lastName || rest.join(" ") || "",
        email: prev.email || user.email || "",
        phone: prev.phone || meta.phone || "",
      }));
    });
  }, []);

  // Identify to Klaviyo on email blur — waits until the user finishes
  // typing and tabs/clicks away, so we send their complete email (not a
  // partial mid-keystroke match). Enables Started Checkout and Browse
  // Abandonment flows via retroactive anonymous event stitching.
  const klaviyoIdentifiedRef = useRef(false);
  const klaviyoFullIdentifyRef = useRef(false);

  const handleEmailBlur = useCallback(() => {
    if (!klaviyoIdentifiedRef.current && isValidEmail(guest.email)) {
      klaviyoIdentifiedRef.current = true;
      identifyUser(
        guest.email,
        guest.phone || undefined,
        guest.firstName || undefined,
        guest.lastName || undefined
      );
      // Re-fire Meta InitiateCheckout with whatever identity we have at this
      // moment (usually just email + whatever else the user typed first).
      // Uses the same eventId from the initial page-load fire so Meta merges
      // them into one enriched event. Fires once per session+listing —
      // subsequent field fills enrich the known-guest store for downstream
      // ViewContent/Search/PageView events, but don't re-fire IC.
      trackInitiateCheckoutEnriched({
        listingId: quote.listingId,
        listingTitle: quote.listingTitle,
        checkIn: quote.checkIn,
        checkOut: quote.checkOut,
        guests: quote.guests,
        total: quote.pricing.total,
      });
    }
  }, [
    guest.email,
    guest.phone,
    guest.firstName,
    guest.lastName,
    quote.listingId,
    quote.listingTitle,
    quote.checkIn,
    quote.checkOut,
    quote.guests,
    quote.pricing.total,
  ]);

  useEffect(() => {
    if (
      !klaviyoFullIdentifyRef.current &&
      guest.firstName &&
      guest.lastName &&
      isValidEmail(guest.email) &&
      guest.phone
    ) {
      klaviyoFullIdentifyRef.current = true;
      identifyUser(guest.email, guest.phone, guest.firstName, guest.lastName);
      // Re-fire Meta InitiateCheckout with full user_data, reusing the same
      // eventId from the initial page-load fire so Meta merges them into one
      // enriched event (not a duplicate). Moves IC EMQ from ~6.2 to ~8.5+.
      trackInitiateCheckoutEnriched({
        listingId: quote.listingId,
        listingTitle: quote.listingTitle,
        checkIn: quote.checkIn,
        checkOut: quote.checkOut,
        guests: quote.guests,
        total: quote.pricing.total,
      });
    }
  }, [
    guest.firstName,
    guest.lastName,
    guest.email,
    guest.phone,
    quote.listingId,
    quote.listingTitle,
    quote.checkIn,
    quote.checkOut,
    quote.guests,
    quote.pricing.total,
  ]);

  // Create Stripe PaymentIntent when quote is available (or total changes from coupon)
  const paymentIntentGuestEmail = useMemo(
    () => (isValidEmail(guest.email) ? guest.email.trim().toLowerCase() : ""),
    [guest.email]
  );
  const paymentIntentGuestPhone = useMemo(() => {
    const digits = guest.phone.replace(/\D/g, "");
    return digits.length >= 10 ? digits : "";
  }, [guest.phone]);
  const chargeableUpsellIds = useMemo(
    () => selectedUpsells.filter((id) => id !== "pet-fee"),
    [selectedUpsells]
  );
  const effectivePets = useMemo(
    () => (pets > 0 ? pets : selectedUpsells.includes("pet-fee") ? 1 : 0),
    [pets, selectedUpsells]
  );

  const syncPaymentIntentGuestDetails = useCallback(
    async ({
      paymentIntentId,
      checkoutToken,
      guestEmail,
      guestPhone,
      signal,
    }: {
      paymentIntentId: string;
      checkoutToken: string;
      guestEmail?: string;
      guestPhone?: string;
      signal?: AbortSignal;
    }) => {
      const normalizedEmail =
        guestEmail && isValidEmail(guestEmail)
          ? guestEmail.trim().toLowerCase()
          : "";
      const digits = (guestPhone || "").replace(/\D/g, "");
      const normalizedPhone = digits.length >= 10 ? digits : "";

      if (!normalizedEmail && !normalizedPhone) {
        return null;
      }

      const guestDetailsKey = [
        paymentIntentId,
        normalizedEmail,
        normalizedPhone,
      ].join("|");
      if (lastPaymentIntentGuestDetailsKey.current === guestDetailsKey) {
        return null;
      }
      lastPaymentIntentGuestDetailsKey.current = guestDetailsKey;

      try {
        const res = await fetch("/api/payment-intent", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          signal,
          body: JSON.stringify({
            paymentIntentId,
            checkoutToken,
            guestEmail: normalizedEmail || undefined,
            guestPhone: normalizedPhone || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(
            data.error || "Failed to update payment intent guest details"
          );
        }
        setStripeCustomerId(data.stripeCustomerId || null);
        return data;
      } catch (err) {
        if (
          !signal?.aborted &&
          lastPaymentIntentGuestDetailsKey.current === guestDetailsKey
        ) {
          lastPaymentIntentGuestDetailsKey.current = null;
        }
        throw err;
      }
    },
    []
  );

  useEffect(() => {
    if (!quote.pricing.total || !quote.quoteId) return;
    const requestKey = [quote.quoteId, quote.pricing.total].join("|");
    if (lastPaymentIntentRequestKey.current === requestKey) return;
    lastPaymentIntentRequestKey.current = requestKey;
    const controller = new AbortController();

    fetch("/api/payment-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        quoteId: quote.quoteId,
        upsellIds: chargeableUpsellIds,
        pets: effectivePets,
      }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (lastPaymentIntentRequestKey.current !== requestKey) {
          return;
        }
        if (!res.ok || !data.clientSecret || !data.checkoutToken) {
          console.error("[Checkout] PaymentIntent failed:", data);
          if (!data.pendingRecovery) {
            lastPaymentIntentRequestKey.current = null;
          }
          const errorMsg = data.pendingRecovery
            ? data.error ||
              "Your payment was already received and your reservation is being finalized. Please do not retry."
            : data.error ||
              "Failed to initialize payment. Please refresh and try again.";
          setError(errorMsg);
          trackCheckoutError({
            listingId: quote.listingId,
            listingTitle: quote.listingTitle,
            total: quote.pricing.total,
            step: "payment_init",
            errorMessage: errorMsg,
            errorCode: data.pendingRecovery
              ? "pending_recovery"
              : `http_${res.status}`,
          });
          return;
        }
        setClientSecret(data.clientSecret);
        setPaymentIntentId(data.paymentIntentId);
        setCheckoutToken(data.checkoutToken);
        setStripeCustomerId(data.stripeCustomerId || null);
        setPiVersion((v) => v + 1);
      })
      .catch((err) => {
        if (controller.signal.aborted) {
          return;
        }
        console.error("[Checkout] PaymentIntent fetch error:", err);
        if (lastPaymentIntentRequestKey.current === requestKey) {
          lastPaymentIntentRequestKey.current = null;
        }
        setError("Failed to initialize payment. Please refresh and try again.");
        trackCheckoutError({
          listingId: quote.listingId,
          listingTitle: quote.listingTitle,
          total: quote.pricing.total,
          step: "payment_init",
          errorMessage: err instanceof Error ? err.message : "Network error",
          errorCode: "fetch_error",
        });
      });
    return () => {
      controller.abort();
      lastPaymentIntentRequestKey.current = null;
    };
  }, [
    quote.pricing.total,
    quote.quoteId,
    quote.listingId,
    quote.listingTitle,
    chargeableUpsellIds,
    effectivePets,
  ]);

  useEffect(() => {
    if (!paymentIntentId || !checkoutToken) {
      lastPaymentIntentGuestDetailsKey.current = null;
      return;
    }
    if (!paymentIntentGuestEmail && !paymentIntentGuestPhone) return;

    const controller = new AbortController();
    syncPaymentIntentGuestDetails({
      paymentIntentId,
      checkoutToken,
      guestEmail: paymentIntentGuestEmail,
      guestPhone: paymentIntentGuestPhone,
      signal: controller.signal,
    }).catch((err) => {
      if (controller.signal.aborted) {
        return;
      }
      console.error("[Checkout] Failed to sync PI guest details:", err);
    });

    return () => controller.abort();
  }, [
    paymentIntentId,
    checkoutToken,
    paymentIntentGuestEmail,
    paymentIntentGuestPhone,
    syncPaymentIntentGuestDetails,
  ]);

  // Update PI amount when upsells or pets change (skip initial empty state)
  const upsellsInitialized = useRef(false);
  useEffect(() => {
    if (!paymentIntentId || !checkoutToken) return;
    if (!upsellsInitialized.current) {
      upsellsInitialized.current = true;
      if (chargeableUpsellIds.length === 0 && effectivePets === 0) {
        return;
      }
    }
    fetch("/api/payment-intent", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentIntentId,
        checkoutToken,
        upsellIds: chargeableUpsellIds,
        pets: effectivePets,
      }),
    })
      .then(() => setPiVersion((v) => v + 1))
      .catch((err) =>
        console.error("[Checkout] Failed to update PI for upsells:", err)
      );
  }, [paymentIntentId, checkoutToken, chargeableUpsellIds, effectivePets]);

  const handleBeforeExpressConfirm = useCallback(
    async (billingDetails: ExpressCheckoutBillingDetails) => {
      if (!paymentIntentId || !checkoutToken) return;
      await syncPaymentIntentGuestDetails({
        paymentIntentId,
        checkoutToken,
        guestEmail: billingDetails.email,
        guestPhone: billingDetails.phone,
      });
    },
    [paymentIntentId, checkoutToken, syncPaymentIntentGuestDetails]
  );

  const [datesDialogOpen, setDatesDialogOpen] = useState(false);
  const [guestsDialogOpen, setGuestsDialogOpen] = useState(false);
  const [requoting, setRequoting] = useState(false);
  const [requoteError, setRequoteError] = useState<string | null>(null);
  const [pendingDateRange, setPendingDateRange] = useState<
    DateRange | undefined
  >(undefined);
  const [pendingAdults, setPendingAdults] = useState(1);
  const [pendingChildren, setPendingChildren] = useState(0);
  const [pendingPets, setPendingPets] = useState(0);
  const [calendarDays, setCalendarDays] = useState<
    Array<{
      date: string;
      status: string;
      minNights: number;
      cta: boolean;
      ctd: boolean;
    }>
  >([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [pickingCheckout, setPickingCheckout] = useState(false);
  const [checkoutOnlyTooltip, setCheckoutOnlyTooltip] = useState<string | null>(
    null
  );

  const paymentSubmitRef = useRef<(() => void) | null>(null);

  // Mobile dates bottom sheet state
  const [mobileDatesOpen, setMobileDatesOpen] = useState(false);
  const [mobileDatesVisible, setMobileDatesVisible] = useState(false);
  const [mobileDatesClosing, setMobileDatesClosing] = useState(false);
  const [mobileDatesDragY, setMobileDatesDragY] = useState(0);
  const mobileDatesDragStartY = useRef(0);
  const mobileDatesDragging = useRef(false);
  const mobileDatesScrollRef = useRef<HTMLDivElement>(null);

  // Fetch calendar data when dates dialog/sheet opens
  useEffect(() => {
    if (!datesDialogOpen && !mobileDatesOpen) return;
    let cancelled = false;
    async function fetchCalendar() {
      setCalendarLoading(true);
      try {
        const from = format(new Date(), "yyyy-MM-dd");
        const to = format(addMonths(new Date(), 24), "yyyy-MM-dd");
        const res = await fetch(
          `/api/listings/${quote.listingId}/calendar?from=${from}&to=${to}`
        );
        if (res.ok && !cancelled) {
          const data = await res.json();
          setCalendarDays(Array.isArray(data) ? data : data.days || []);
        }
      } catch {
        // non-critical
      } finally {
        if (!cancelled) setCalendarLoading(false);
      }
    }
    fetchCalendar();
    return () => {
      cancelled = true;
    };
  }, [datesDialogOpen, mobileDatesOpen, quote.listingId]);

  // Sync pickingCheckout with pendingDateRange
  useEffect(() => {
    if (pendingDateRange?.from && !pendingDateRange?.to) {
      setPickingCheckout(true);
    } else {
      setPickingCheckout(false);
    }
  }, [pendingDateRange?.from, pendingDateRange?.to]);

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

  // Unavailable dates excluding checkout-only (so rdp doesn't disable them)
  const unavailableDates = useMemo(
    () =>
      calendarDays
        .filter((d) => d.status !== "available" && !checkoutOnlySet.has(d.date))
        .map((d) => new Date(d.date + "T12:00:00")),
    [calendarDays, checkoutOnlySet]
  );

  const noCheckoutDates = useMemo(
    () =>
      calendarDays
        .filter((d) => d.status === "available" && d.ctd)
        .map((d) => new Date(d.date + "T12:00:00")),
    [calendarDays]
  );

  // First unavailable date after check-in (checkout allowed on this day)
  const maxCheckoutDate = useMemo((): Date | null => {
    if (!pendingDateRange?.from) return null;
    const checkinStr = format(pendingDateRange.from, "yyyy-MM-dd");
    const blocked = calendarDays
      .filter((d) => d.status !== "available" && d.date > checkinStr)
      .sort((a, b) => a.date.localeCompare(b.date));
    return blocked.length > 0 ? new Date(blocked[0].date + "T12:00:00") : null;
  }, [pendingDateRange?.from, calendarDays]);

  // All unavailable date strings for strikethrough styling
  const unavailableSet = useMemo(() => {
    const set = new Set<string>();
    for (const d of calendarDays) {
      if (d.status !== "available") set.add(d.date);
    }
    return set;
  }, [calendarDays]);

  const checkinDateStr = pendingDateRange?.from
    ? format(pendingDateRange.from, "yyyy-MM-dd")
    : null;

  const minNights = useMemo(() => {
    if (!pendingDateRange?.from) return null;
    const fromStr = format(pendingDateRange.from, "yyyy-MM-dd");
    const day = calendarDays.find((d) => d.date === fromStr);
    return day?.minNights && day.minNights > 1 ? day.minNights : null;
  }, [pendingDateRange?.from, calendarDays]);

  // Build disabled dates based on selection state
  const disabledDates = useMemo(() => {
    if (pickingCheckout && pendingDateRange?.from) {
      const cutoffTime = maxCheckoutDate?.getTime();
      const checkoutUnavailable = cutoffTime
        ? unavailableDates.filter((d) => d.getTime() !== cutoffTime)
        : unavailableDates;
      const earliestCheckout = addDays(pendingDateRange.from, minNights || 1);
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
    return [{ before: addDays(new Date(), 1) }, ...unavailableDates];
  }, [
    pickingCheckout,
    pendingDateRange?.from,
    unavailableDates,
    noCheckoutDates,
    maxCheckoutDate,
    minNights,
  ]);

  // Custom day button with strikethrough, checkout-only styling, and tooltips
  const CustomDayButton = useCallback(
    (props: React.ComponentProps<typeof DayButtonType>) => {
      const dateStr = format(props.day.date, "yyyy-MM-dd");
      const isUnavailable = unavailableSet.has(dateStr);
      const isCheckoutOnly = checkoutOnlySet.has(dateStr);
      // Check if this date is currently selected as range start or end
      const isSelected =
        (pendingDateRange?.from &&
          format(pendingDateRange.from, "yyyy-MM-dd") === dateStr) ||
        (pendingDateRange?.to &&
          format(pendingDateRange.to, "yyyy-MM-dd") === dateStr);
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
            <div className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 z-20 whitespace-nowrap rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-foreground shadow-sm">
              {minNights}-night minimum
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-2 w-2 rotate-45 border-b border-r border-border bg-background" />
            </div>
          )}
          {isCheckoutOnly && !pickingCheckout && !isSelected && (
            <div
              className={`pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 z-20 whitespace-nowrap rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-foreground shadow-sm transition-opacity ${showCheckoutOnly ? "opacity-100" : "opacity-0 group-hover/co:opacity-100"}`}
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
      pendingDateRange?.from,
      pendingDateRange?.to,
    ]
  );

  // ── Mobile bottom-sheet calendar helpers ──
  const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
  const DISMISS_THRESHOLD = 120;

  const calendarMonths = useMemo(() => {
    const result: { month: Date; days: Date[] }[] = [];
    const today = new Date();
    for (let i = 0; i < 24; i++) {
      const monthDate = addMonths(today, i);
      const calStart = startOfWeek(startOfMonth(monthDate));
      const calEnd = endOfWeek(endOfMonth(monthDate));
      result.push({
        month: monthDate,
        days: eachDayOfInterval({ start: calStart, end: calEnd }),
      });
    }
    return result;
  }, []);

  const noCheckoutSet = useMemo(
    () =>
      new Set(
        calendarDays
          .filter((d) => d.status === "available" && d.ctd)
          .map((d) => d.date)
      ),
    [calendarDays]
  );

  const isMobileDayDisabled = useCallback(
    (date: Date) => {
      const dateStr = format(date, "yyyy-MM-dd");
      const isUnavail =
        unavailableSet.has(dateStr) && !checkoutOnlySet.has(dateStr);
      const yesterday = new Date();
      yesterday.setHours(0, 0, 0, 0);

      if (pickingCheckout && pendingDateRange?.from) {
        const cutoffTime = maxCheckoutDate?.getTime();
        const earliestCheckout = addDays(pendingDateRange.from, minNights || 1);
        if (date < earliestCheckout) return true;
        if (isUnavail && (!cutoffTime || date.getTime() !== cutoffTime))
          return true;
        if (noCheckoutSet.has(dateStr)) return true;
        if (cutoffTime && date.getTime() > cutoffTime) return true;
        return false;
      }

      if (isBefore(date, yesterday)) return true;
      return isUnavail;
    },
    [
      pickingCheckout,
      pendingDateRange?.from,
      unavailableSet,
      checkoutOnlySet,
      maxCheckoutDate,
      minNights,
      noCheckoutSet,
    ]
  );

  const isMobileInRange = useCallback(
    (date: Date) => {
      if (!pendingDateRange?.from || !pendingDateRange?.to) return false;
      return date > pendingDateRange.from && date < pendingDateRange.to;
    },
    [pendingDateRange?.from, pendingDateRange?.to]
  );

  const handleMobileDayClick = useCallback(
    (date: Date) => {
      const dateStr = format(date, "yyyy-MM-dd");

      if (!pickingCheckout) {
        if (checkoutOnlySet.has(dateStr)) {
          setCheckoutOnlyTooltip(dateStr);
          setTimeout(() => setCheckoutOnlyTooltip(null), 2000);
          return;
        }
        if (isMobileDayDisabled(date)) return;
        setPendingDateRange({ from: date, to: undefined });
        setPickingCheckout(true);
      } else if (pendingDateRange?.from) {
        if (date.getTime() <= pendingDateRange.from.getTime()) {
          if (checkoutOnlySet.has(dateStr)) {
            setCheckoutOnlyTooltip(dateStr);
            setTimeout(() => setCheckoutOnlyTooltip(null), 2000);
            return;
          }
          setPendingDateRange({ from: date, to: undefined });
          return;
        }
        if (isMobileDayDisabled(date)) return;
        const fromStr = format(pendingDateRange.from, "yyyy-MM-dd");
        if (
          calendarDays.some(
            (d) =>
              d.status !== "available" && d.date > fromStr && d.date < dateStr
          )
        )
          return;
        setPendingDateRange({ from: pendingDateRange.from, to: date });
        setPickingCheckout(false);
      }
    },
    [
      pickingCheckout,
      pendingDateRange?.from,
      checkoutOnlySet,
      isMobileDayDisabled,
      calendarDays,
    ]
  );

  // Open animation for mobile dates sheet
  useEffect(() => {
    if (mobileDatesOpen) {
      document.body.style.overflow = "hidden";
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setMobileDatesVisible(true));
      });
      return () => {
        document.body.style.overflow = "";
      };
    } else {
      setMobileDatesVisible(false);
      setMobileDatesClosing(false);
      setMobileDatesDragY(0);
    }
  }, [mobileDatesOpen]);

  function closeMobileDates() {
    setMobileDatesClosing(true);
    setMobileDatesVisible(false);
    setTimeout(() => {
      setMobileDatesClosing(false);
      setMobileDatesDragY(0);
      setMobileDatesOpen(false);
    }, 500);
  }

  function handleMobileDatesTouchStart(e: React.TouchEvent) {
    const scrollTop = mobileDatesScrollRef.current?.scrollTop ?? 0;
    if (scrollTop > 0) return;
    mobileDatesDragStartY.current = e.touches[0].clientY;
    mobileDatesDragging.current = true;
    setMobileDatesDragY(0);
  }

  function handleMobileDatesTouchMove(e: React.TouchEvent) {
    if (!mobileDatesDragging.current) return;
    const delta = e.touches[0].clientY - mobileDatesDragStartY.current;
    if (delta > 0) setMobileDatesDragY(delta);
  }

  function handleMobileDatesTouchEnd() {
    if (!mobileDatesDragging.current) return;
    mobileDatesDragging.current = false;
    if (mobileDatesDragY > DISMISS_THRESHOLD) {
      closeMobileDates();
    } else {
      setMobileDatesDragY(0);
    }
  }

  async function handleMobileDatesUpdate() {
    if (!pendingDateRange?.from || !pendingDateRange?.to) return;
    const checkIn = format(pendingDateRange.from, "yyyy-MM-dd");
    const checkOut = format(pendingDateRange.to, "yyyy-MM-dd");
    const ok = await requote(checkIn, checkOut, quote.guests);
    if (ok) closeMobileDates();
  }

  async function requote(
    checkIn: string,
    checkOut: string,
    guestsCount: number
  ) {
    setRequoting(true);
    setRequoteError(null);
    try {
      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId: quote.listingId,
          checkIn,
          checkOut,
          guestsCount,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to get updated quote");
      }
      const quoteResponse = await res.json();
      const { promotion, ...pricing } = extractQuotePricing(quoteResponse);
      const identifiers = getQuoteIdentifiers(quoteResponse);
      const newQuoteId = identifiers.quoteId || quote.quoteId;
      const ratePlanId = identifiers.ratePlanId || quote.ratePlanId;
      const updatedQuote: QuoteData = {
        ...quote,
        quoteId: newQuoteId,
        ratePlanId,
        checkIn,
        checkOut,
        guests: guestsCount,
        pricing,
        promotion,
      };
      setQuote(updatedQuote);
      sessionStorage.setItem(
        `quote_${newQuoteId}`,
        JSON.stringify(updatedQuote)
      );
      setAppliedCoupon(null);
      setCardReady(false);
      return true;
    } catch (err) {
      setRequoteError(
        err instanceof Error ? err.message : "Something went wrong"
      );
      return false;
    } finally {
      setRequoting(false);
    }
  }

  const isGuestValid =
    guest.firstName &&
    guest.lastName &&
    guest.email &&
    isValidEmail(guest.email) &&
    guest.phone;

  // T&C acceptance is now passive — "By booking, you agree to..."
  const policiesAccepted = true;

  const PET_FEE_PER_PET = useMemo(
    () => resolvePetFeePerPet(quote.petFeePerPet),
    [quote.petFeePerPet]
  );

  const petsAllowed = quote.petsAllowed !== false;

  const applicableUpsells = useMemo(
    () =>
      resolveUpsellsForListing({
        petsAllowed,
        petFeePerPet: quote.petFeePerPet,
      }),
    [petsAllowed, quote.petFeePerPet]
  );

  const handleUpsellToggle = useCallback((id: string) => {
    setSelectedUpsells((prev) =>
      prev.includes(id) ? prev.filter((u) => u !== id) : [...prev, id]
    );
  }, []);

  const petFeeTotal = useMemo(() => {
    if (!petsAllowed) return 0;
    if (pets > 0) return pets * PET_FEE_PER_PET;
    if (selectedUpsells.includes("pet-fee")) return PET_FEE_PER_PET;
    return 0;
  }, [pets, selectedUpsells, petsAllowed, PET_FEE_PER_PET]);

  const upsellItems = useMemo(() => {
    const items = getSelectedUpsells(selectedUpsells)
      .filter((u) => u.id !== "pet-fee")
      .map((u) => ({ title: u.title, amount: u.amount }));
    if (petFeeTotal > 0) {
      const label = pets > 1 ? `Pet Fee (${pets} pets)` : "Pet Fee";
      items.push({ title: label, amount: petFeeTotal });
    }
    return items;
  }, [selectedUpsells, petFeeTotal, pets]);

  const upsellTotal = useMemo(() => {
    const nonPetTotal = getSelectedUpsells(selectedUpsells)
      .filter((u) => u.id !== "pet-fee")
      .reduce((sum, u) => sum + u.amount, 0);
    return nonPetTotal + petFeeTotal;
  }, [selectedUpsells, petFeeTotal]);

  function buildPendingPayload(piId: string, eventId: string) {
    const consent = getEffectiveClientConsent();

    return {
      paymentIntentId: piId,
      quoteId: quote.quoteId,
      ratePlanId: quote.ratePlanId,
      guest: {
        firstName: guest.firstName,
        lastName: guest.lastName,
        email: guest.email,
        phone: guest.phone,
      },
      listingId: quote.listingId,
      listingTitle: quote.listingTitle,
      picture: quote.picture,
      checkIn: quote.checkIn,
      checkOut: quote.checkOut,
      guests: quote.guests,
      total: quote.pricing.total + upsellTotal,
      upsells: chargeableUpsellIds,
      pets: effectivePets,
      eventId,
      pendingCheckoutToken: null as string | null,
      consent,
      marketingOptIn,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handleCouponApplied(updatedQuoteResponse: any, couponCode: string) {
    try {
      const { promotion, ...pricing } =
        extractQuotePricing(updatedQuoteResponse);
      setQuote((prev) => {
        const updatedQuote = {
          ...prev,
          pricing,
          promotion,
        };
        sessionStorage.setItem(
          `quote_${updatedQuote.quoteId}`,
          JSON.stringify(updatedQuote)
        );
        return updatedQuote;
      });
      setAppliedCoupon(couponCode);
    } catch (err) {
      console.error("Failed to parse updated quote:", err);
    }
  }

  async function handlePaymentSuccess(piId: string) {
    setLoading(true);
    setError(null);

    trackAddShippingInfo({
      listingId: quote.listingId,
      listingTitle: quote.listingTitle,
      guests: quote.guests,
      total: quote.pricing.total + upsellTotal,
    });

    trackAddPaymentInfo({
      listingId: quote.listingId,
      listingTitle: quote.listingTitle,
      total: quote.pricing.total + upsellTotal,
      propertyType: quote.propertyType || undefined,
      checkIn: quote.checkIn,
      checkOut: quote.checkOut,
      guests: quote.guests,
    });

    // Store booking data for 3DS redirect recovery before calling API
    const eventId = `purchase_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const consent = getEffectiveClientConsent();
    const pendingPayload = buildPendingPayload(piId, eventId);
    sessionStorage.setItem("booking_pending", JSON.stringify(pendingPayload));

    try {
      const lookupToken = await persistPendingCheckout(piId, eventId);
      pendingPayload.pendingCheckoutToken = lookupToken;
      sessionStorage.setItem("booking_pending", JSON.stringify(pendingPayload));
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentIntentId: piId,
          quoteId: quote.quoteId,
          ratePlanId: quote.ratePlanId,
          guest: {
            firstName: guest.firstName,
            lastName: guest.lastName,
            email: guest.email,
            phone: guest.phone,
          },
          upsells: chargeableUpsellIds,
          pets: effectivePets,
          tracking: {
            listingId: quote.listingId,
            listingTitle: quote.listingTitle,
            checkIn: quote.checkIn,
            checkOut: quote.checkOut,
            guests: quote.guests,
            total: quote.pricing.total + upsellTotal,
            eventId,
            consent,
          },
          marketingOptIn,
        }),
      });

      const data = await res.json();
      if (res.status === 202 && data.pendingRecovery) {
        throw new Error(
          data.error ||
            "Your payment was received and our team is finalizing your reservation. Please do not retry."
        );
      }
      if (!res.ok) {
        throw new Error(data.error || "Booking failed");
      }
      const stayTotal = quote.pricing.total;
      const totalPaid = data.chargedAmount || quote.pricing.total + upsellTotal;

      const confirmationData = {
        listingId: quote.listingId,
        listingTitle: quote.listingTitle,
        listingNickname: quote.listingNickname,
        picture: quote.picture,
        checkIn: quote.checkIn,
        checkOut: quote.checkOut,
        guests: quote.guests,
        stayTotal,
        totalPaid,
        reservationId: data.reservationId,
        confirmationCode: data.confirmationCode,
        guestEmail: guest.email,
        guestPhone: guest.phone,
        guestFirstName: guest.firstName,
        guestLastName: guest.lastName,
        guestPostalCode: data.billingPostalCode || undefined,
        guestCountry: data.billingCountry || undefined,
        marketingOptIn,
        tracked: false,
        eventId: data.eventId || eventId,
        upsells: Array.isArray(data.appliedUpsells)
          ? data.appliedUpsells
          : chargeableUpsellIds,
        pets:
          typeof data.appliedPets === "number"
            ? data.appliedPets
            : effectivePets,
      };
      sessionStorage.setItem(
        "booking_confirmation",
        JSON.stringify(confirmationData)
      );

      try {
        identifyUser(guest.email, guest.phone, guest.firstName, guest.lastName);
      } catch {
        // Klaviyo identify failure must not block conversion tracking
      }
      trackBookingCompleted({
        listingId: quote.listingId,
        listingTitle: quote.listingTitle,
        listingNickname: quote.listingNickname,
        checkIn: quote.checkIn,
        checkOut: quote.checkOut,
        guests: quote.guests,
        total: totalPaid,
        reservationId: data.reservationId,
        confirmationCode: data.confirmationCode,
        guestEmail: guest.email,
        guestPhone: guest.phone,
        guestFirstName: guest.firstName,
        guestLastName: guest.lastName,
        guestPostalCode: data.billingPostalCode || undefined,
        guestCountry: data.billingCountry || undefined,
        eventId: data.eventId || eventId,
        propertyType: quote.propertyType || undefined,
        ctaVariant: "dark" as const,
      });
      confirmationData.tracked = true;
      sessionStorage.setItem(
        "booking_confirmation",
        JSON.stringify(confirmationData)
      );

      setBookingComplete(true);
      router.push(`/book/confirmation/${data.reservationId}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setError(msg);
      trackCheckoutError({
        listingId: quote.listingId,
        listingTitle: quote.listingTitle,
        total: quote.pricing.total,
        step: "payment_submit",
        errorMessage: msg,
      });
      setLoading(false);
    }
  }

  async function handleExpressPaymentSuccess(
    piId: string,
    billingDetails: ExpressCheckoutBillingDetails
  ) {
    const expressGuest: GuestInfo = {
      firstName: billingDetails.firstName || guest.firstName,
      lastName: billingDetails.lastName || guest.lastName,
      email: billingDetails.email || guest.email,
      phone: billingDetails.phone || guest.phone,
    };

    // Update guest form with wallet data
    setGuest(expressGuest);

    // Check for missing required fields
    const missing: string[] = [];
    if (!expressGuest.firstName.trim()) missing.push("firstName");
    if (!expressGuest.lastName.trim()) missing.push("lastName");
    if (!expressGuest.email.trim() || !isValidEmail(expressGuest.email))
      missing.push("email");
    if (!expressGuest.phone.trim()) missing.push("phone");

    if (missing.length > 0) {
      // Show modal to collect missing fields
      setExpressMissingInfo({
        paymentIntentId: piId,
        guest: expressGuest,
        missingFields: missing,
      });
      return;
    }

    // All fields present — proceed directly to create reservation
    // Temporarily set guest so handlePaymentSuccess uses it
    setGuest(expressGuest);
    // Need to wait for state to update, so call directly with the guest data
    await handleExpressReservation(piId, expressGuest);
  }

  async function handleExpressReservation(
    piId: string,
    expressGuest: GuestInfo
  ) {
    setLoading(true);
    setError(null);

    trackAddShippingInfo({
      listingId: quote.listingId,
      listingTitle: quote.listingTitle,
      guests: quote.guests,
      total: quote.pricing.total + upsellTotal,
    });

    trackAddPaymentInfo({
      listingId: quote.listingId,
      listingTitle: quote.listingTitle,
      total: quote.pricing.total + upsellTotal,
      propertyType: quote.propertyType || undefined,
      checkIn: quote.checkIn,
      checkOut: quote.checkOut,
      guests: quote.guests,
    });

    const eventId = `purchase_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const consent = getEffectiveClientConsent();

    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentIntentId: piId,
          quoteId: quote.quoteId,
          ratePlanId: quote.ratePlanId,
          guest: {
            firstName: expressGuest.firstName,
            lastName: expressGuest.lastName,
            email: expressGuest.email,
            phone: expressGuest.phone,
          },
          upsells: chargeableUpsellIds,
          pets: effectivePets,
          tracking: {
            listingId: quote.listingId,
            listingTitle: quote.listingTitle,
            checkIn: quote.checkIn,
            checkOut: quote.checkOut,
            guests: quote.guests,
            total: quote.pricing.total + upsellTotal,
            eventId,
            consent,
          },
          marketingOptIn,
        }),
      });

      const data = await res.json();
      if (res.status === 202 && data.pendingRecovery) {
        throw new Error(
          data.error ||
            "Your payment was received and our team is finalizing your reservation. Please do not retry."
        );
      }
      if (!res.ok) {
        throw new Error(data.error || "Booking failed");
      }

      const stayTotal = quote.pricing.total;
      const totalPaid = data.chargedAmount || quote.pricing.total + upsellTotal;

      const confirmationData = {
        listingId: quote.listingId,
        listingTitle: quote.listingTitle,
        listingNickname: quote.listingNickname,
        picture: quote.picture,
        checkIn: quote.checkIn,
        checkOut: quote.checkOut,
        guests: quote.guests,
        stayTotal,
        totalPaid,
        reservationId: data.reservationId,
        confirmationCode: data.confirmationCode,
        guestEmail: expressGuest.email,
        guestPhone: expressGuest.phone,
        guestFirstName: expressGuest.firstName,
        guestLastName: expressGuest.lastName,
        guestPostalCode: data.billingPostalCode || undefined,
        guestCountry: data.billingCountry || undefined,
        marketingOptIn,
        tracked: false,
        eventId: data.eventId || eventId,
        upsells: Array.isArray(data.appliedUpsells)
          ? data.appliedUpsells
          : chargeableUpsellIds,
        pets:
          typeof data.appliedPets === "number"
            ? data.appliedPets
            : effectivePets,
      };
      sessionStorage.setItem(
        "booking_confirmation",
        JSON.stringify(confirmationData)
      );

      try {
        identifyUser(
          expressGuest.email,
          expressGuest.phone,
          expressGuest.firstName,
          expressGuest.lastName
        );
      } catch {
        // Klaviyo identify failure must not block conversion tracking
      }
      trackBookingCompleted({
        listingId: quote.listingId,
        listingTitle: quote.listingTitle,
        listingNickname: quote.listingNickname,
        checkIn: quote.checkIn,
        checkOut: quote.checkOut,
        guests: quote.guests,
        total: totalPaid,
        reservationId: data.reservationId,
        confirmationCode: data.confirmationCode,
        guestEmail: expressGuest.email,
        guestPhone: expressGuest.phone,
        guestFirstName: expressGuest.firstName,
        guestLastName: expressGuest.lastName,
        guestPostalCode: data.billingPostalCode || undefined,
        guestCountry: data.billingCountry || undefined,
        eventId: data.eventId || eventId,
        propertyType: quote.propertyType || undefined,
        ctaVariant: "dark" as const,
      });
      confirmationData.tracked = true;
      sessionStorage.setItem(
        "booking_confirmation",
        JSON.stringify(confirmationData)
      );

      setBookingComplete(true);
      router.push(`/book/confirmation/${data.reservationId}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setError(msg);
      trackCheckoutError({
        listingId: quote.listingId,
        listingTitle: quote.listingTitle,
        total: quote.pricing.total,
        step: "payment_submit",
        errorMessage: msg,
        errorCode: "express_checkout",
      });
      setLoading(false);
    }
  }

  async function handleConfirmBooking() {
    setLoading(true);
    setError(null);

    if (!paymentIntentId) {
      setError(
        "Payment is still initializing. Please wait a moment and try again."
      );
      trackCheckoutError({
        listingId: quote.listingId,
        listingTitle: quote.listingTitle,
        total: quote.pricing.total,
        step: "payment_submit",
        errorMessage: "PaymentIntent not ready when user clicked confirm",
        errorCode: "pi_not_ready",
      });
      setLoading(false);
      return;
    }

    // Store booking data BEFORE triggering payment — redirect payment methods
    // (Affirm, Klarna, etc.) navigate away immediately, so handlePaymentSuccess
    // never runs. The 3ds-callback page needs this data when the user returns.
    const eventId = `purchase_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const pendingPayload = buildPendingPayload(paymentIntentId, eventId);
    sessionStorage.setItem("booking_pending", JSON.stringify(pendingPayload));

    try {
      const lookupToken = await persistPendingCheckout(
        paymentIntentId,
        eventId
      );
      pendingPayload.pendingCheckoutToken = lookupToken;
      sessionStorage.setItem("booking_pending", JSON.stringify(pendingPayload));
    } catch (err) {
      console.error("[Checkout] Failed to persist pending checkout:", err);
      trackCheckoutError({
        listingId: quote.listingId,
        listingTitle: quote.listingTitle,
        total: quote.pricing.total,
        step: "payment_submit",
        errorMessage:
          err instanceof Error
            ? err.message
            : "Failed to persist pending checkout",
        errorCode: "persist_pending_failed",
      });
      setLoading(false);
      return;
    }

    paymentSubmitRef.current?.();
  }

  async function persistPendingCheckout(piId: string, eventId: string) {
    const consent = getEffectiveClientConsent();
    const res = await fetch("/api/pending-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentIntentId: piId,
        quoteId: quote.quoteId,
        ratePlanId: quote.ratePlanId,
        stripeCustomerId,
        guest: {
          firstName: guest.firstName,
          lastName: guest.lastName,
          email: guest.email,
          phone: guest.phone,
        },
        tracking: {
          listingId: quote.listingId,
          listingTitle: quote.listingTitle,
          picture: quote.picture,
          propertyType: quote.propertyType || null,
          city: quote.city || null,
          checkIn: quote.checkIn,
          checkOut: quote.checkOut,
          guests: quote.guests,
          stayTotal: quote.pricing.total,
          totalPaid: quote.pricing.total + upsellTotal,
          eventId,
          consent,
          marketingOptIn,
        },
        upsells: chargeableUpsellIds,
        pets: effectivePets,
        quoteSnapshot: {
          quoteId: quote.quoteId,
          ratePlanId: quote.ratePlanId,
          listingId: quote.listingId,
          checkIn: quote.checkIn,
          checkOut: quote.checkOut,
          guests: quote.guests,
          stayTotal: quote.pricing.total,
          totalPaid: quote.pricing.total + upsellTotal,
        },
      }),
    });
    if (!res.ok) {
      throw new Error("Failed to persist pending checkout");
    }
    const data = await res.json();
    if (!data.lookupToken) {
      throw new Error("Missing pending checkout lookup token");
    }
    return data.lookupToken as string;
  }

  const formattedCheckIn = quote.checkIn
    ? format(new Date(quote.checkIn + "T12:00:00"), "MMM d, yyyy")
    : "";
  const formattedCheckOut = quote.checkOut
    ? format(new Date(quote.checkOut + "T12:00:00"), "MMM d, yyyy")
    : "";

  // Single payment component instance shared between desktop and mobile layouts
  const middleContent = (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6">
          <GuestForm
            guest={guest}
            onChange={setGuest}
            onEmailBlur={handleEmailBlur}
          />
          <div className="mt-5 pt-4 border-t border-border">
            <label
              htmlFor={isMobile ? "marketing-mobile" : "marketing"}
              className="flex items-center gap-3 cursor-pointer select-none"
            >
              <input
                type="checkbox"
                id={isMobile ? "marketing-mobile" : "marketing"}
                checked={marketingOptIn}
                onChange={(e) => setMarketingOptIn(e.target.checked)}
                className="h-4 w-4 shrink-0 cursor-pointer rounded accent-primary"
              />
              <span className="text-sm text-muted-foreground">
                Send me Colorado travel tips and deals
              </span>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Upsells — only in mobile (desktop has them in sidebar) */}
      <div className="md:hidden">
        <UpsellSelector
          selectedUpsells={selectedUpsells}
          onToggle={handleUpsellToggle}
          upsells={applicableUpsells}
        />
      </div>
    </div>
  );

  const paymentElement =
    !clientSecret || !paymentIntentId ? (
      <div className="flex items-center gap-3 py-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading payment method…
      </div>
    ) : (
      <StripePayment
        clientSecret={clientSecret}
        billingDetails={{
          firstName: guest.firstName,
          lastName: guest.lastName,
          email: guest.email,
          phone: guest.phone,
        }}
        onPaymentSuccess={handlePaymentSuccess}
        onExpressPaymentSuccess={handleExpressPaymentSuccess}
        onBeforeExpressConfirm={handleBeforeExpressConfirm}
        onError={(err) => {
          setError(err);
          setLoading(false);
          trackCheckoutError({
            listingId: quote.listingId,
            listingTitle: quote.listingTitle,
            total: quote.pricing.total,
            step: "payment_submit",
            errorMessage: err,
          });
        }}
        loading={loading}
        disabled={!isGuestValid || !policiesAccepted}
        hideButton
        onCardReady={setCardReady}
        onSubmitRef={paymentSubmitRef}
        middleContent={middleContent}
        piVersion={piVersion}
      />
    );

  const openDatesDialog = () => {
    setPendingDateRange({
      from: new Date(quote.checkIn + "T12:00:00"),
      to: new Date(quote.checkOut + "T12:00:00"),
    });
    setPickingCheckout(false);
    setRequoteError(null);
    if (isMobile) {
      setMobileDatesOpen(true);
    } else {
      setDatesDialogOpen(true);
    }
  };

  const openGuestsDialog = () => {
    setPendingAdults(quote.guests);
    setPendingChildren(0);
    setPendingPets(pets);
    setRequoteError(null);
    setGuestsDialogOpen(true);
  };

  // Full-screen processing overlay (shown after successful booking until navigation completes)
  if (bookingComplete || (loading && !error)) {
    if (bookingComplete) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="mt-4 text-lg font-medium text-foreground">
            Confirming your booking...
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Please don&apos;t close this page.
          </p>
        </div>
      );
    }
  }

  return (
    <form method="post" autoComplete="on" onSubmit={(e) => e.preventDefault()}>
      {/* ── Desktop layout ── */}
      <div className="hidden md:grid grid-cols-1 gap-16 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          {!isMobile && paymentElement}

          {/* Trust signals + inline CTA */}
          <div className="pt-4 border-t border-border">
            {/* Cancellation reassurance */}
            {(() => {
              const text = getCheckoutCancellationText(
                quote.pricing.cancellationPolicy,
                quote.checkIn
              );
              return text ? (
                <div className="flex items-center gap-2 mb-2">
                  <svg
                    className="h-4 w-4 text-green-600 flex-shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
                    <path d="m9 12 2 2 4-4" />
                  </svg>
                  <span className="text-sm text-green-600 font-medium">
                    {text.trim()}
                  </span>
                </div>
              ) : null;
            })()}

            {/* Savings badge */}
            {Math.round((quote.pricing.total + upsellTotal) * 0.16) >= 20 && (
              <div className="mb-4">
                <span className="inline-flex items-center text-xs font-semibold text-green-600 bg-green-50 px-3 py-1 rounded-full">
                  You&apos;re saving{" "}
                  {formatCurrency(
                    Math.round((quote.pricing.total + upsellTotal) * 0.16),
                    { cents: true }
                  )}{" "}
                  vs VRBO
                </span>
              </div>
            )}

            {/* Policy text */}
            <p className="text-xs text-muted-foreground mb-4">
              By selecting the button, I agree to the{" "}
              <Link
                href="/terms"
                target="_blank"
                className="underline text-foreground/70 hover:text-foreground"
              >
                Terms & Conditions
              </Link>
              ,{" "}
              <Link
                href="/cancellation"
                target="_blank"
                className="underline text-foreground/70 hover:text-foreground"
              >
                Cancellation Policy
              </Link>
              , and{" "}
              <Link
                href="/privacy"
                target="_blank"
                className="underline text-foreground/70 hover:text-foreground"
              >
                Privacy Policy
              </Link>
              .
            </p>

            {/* Confirm and Pay button */}
            <Button
              type="button"
              onClick={handleConfirmBooking}
              disabled={
                loading || !isGuestValid || !policiesAccepted || !cardReady
              }
              className="w-full bg-foreground text-background hover:bg-foreground/90 rounded-xl py-7 text-lg font-semibold transition-all hover:-translate-y-0.5 hover:shadow-lg flex items-center justify-center gap-2.5"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4 opacity-60" />
                  Confirm and Pay{" "}
                  <span className="font-normal opacity-80">
                    {formatCurrency(quote.pricing.total + upsellTotal, {
                      cents: true,
                    })}
                  </span>
                </>
              )}
            </Button>

            {/* Post-CTA info */}
            <div className="flex items-center justify-center gap-1.5 mt-3 text-xs text-muted-foreground">
              <svg
                className="h-3 w-3 opacity-50"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span>Instant confirmation</span>
              <span className="opacity-40">&middot;</span>
              <span>Details sent to your email</span>
              <span className="opacity-40">&middot;</span>
              <a
                href="tel:+17207592013"
                className="underline hover:text-foreground transition-colors"
              >
                Need help? (720) 759-2013
              </a>
            </div>

            {error && (
              <p className="mt-4 text-center text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
        </div>

        {/* ── Sidebar (both steps) ── */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Booking Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-4">
                {quote.picture && (
                  <button
                    type="button"
                    onClick={() => setGalleryOpen(true)}
                    className="flex-shrink-0 cursor-pointer"
                  >
                    <Image
                      src={quote.picture}
                      alt={quote.listingTitle}
                      width={80}
                      height={80}
                      className="h-20 w-20 rounded-xl object-cover hover:opacity-80 transition-opacity"
                    />
                  </button>
                )}
                <div className="min-w-0">
                  {quote.listingTitle && (
                    <p className="font-semibold text-base leading-tight">
                      {quote.listingTitle}
                    </p>
                  )}
                  {(quote.reviewRating || quote.reviewCount) && (
                    <div className="mt-1.5 flex items-center gap-2 text-sm text-foreground">
                      {quote.reviewRating && quote.reviewCount ? (
                        <span className="flex items-center gap-1">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            className="h-3.5 w-3.5"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z"
                              clipRule="evenodd"
                            />
                          </svg>
                          {quote.reviewRating.toFixed(2)} ({quote.reviewCount})
                        </span>
                      ) : null}
                      {quote.reviewRating && quote.reviewRating >= 4.8 && (
                        <span className="flex items-center gap-1 text-xs">
                          <span className="text-base">⭐</span>
                          {quote.reviewRating >= 4.9
                            ? "Traverse Favorite"
                            : quote.reviewRating >= 4.85
                              ? "Guest Favorite"
                              : "Guest Approved"}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {/* Cancellation policy */}
              {(() => {
                const text = getCheckoutCancellationText(
                  quote.pricing.cancellationPolicy,
                  quote.checkIn
                );
                return text ? (
                  <>
                    <Separator />
                    <p className="text-sm text-foreground leading-relaxed">
                      {text}
                      <Link
                        href="/cancellation"
                        target="_blank"
                        className="underline font-semibold"
                      >
                        Full policy
                      </Link>
                    </p>
                  </>
                ) : null;
              })()}
              <Separator />
              {/* Dates section */}
              {formattedCheckIn && formattedCheckOut && (
                <div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground">
                      Dates
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1 px-2 text-xs"
                      onClick={openDatesDialog}
                    >
                      Change
                    </Button>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formattedCheckIn} &ndash; {formattedCheckOut}
                  </p>
                </div>
              )}
              <Separator />
              {/* Guests section */}
              {quote.guests && (
                <div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground">
                      Guests
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1 px-2 text-xs"
                      onClick={openGuestsDialog}
                    >
                      Change
                    </Button>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {quote.guests} {quote.guests === 1 ? "guest" : "guests"}
                    {pets > 0 && `, ${pets} ${pets === 1 ? "pet" : "pets"}`}
                  </p>
                </div>
              )}
              <Separator />
              <p className="text-sm font-semibold text-foreground">
                Price details
              </p>
              <PriceBreakdown
                nights={quote.pricing.nights}
                accommodation={quote.pricing.accommodation}
                accommodationAdjusted={quote.pricing.accommodationAdjusted}
                cleaning={quote.pricing.cleaning}
                taxes={quote.pricing.taxes}
                taxBreakdown={quote.pricing.taxBreakdown}
                total={quote.pricing.total}
                promotion={quote.promotion}
                upsells={upsellItems.length > 0 ? upsellItems : undefined}
              />
              <Separator />
              <CouponInput
                quoteId={quote.quoteId}
                onCouponApplied={handleCouponApplied}
                appliedCoupon={appliedCoupon}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Mobile layout ── */}
      <div className="pb-24 md:hidden">
        {/* Collapsible booking summary — single card */}
        <div className="mb-6 rounded-xl border bg-card overflow-hidden">
          <button
            type="button"
            className="flex w-full items-center gap-4 p-4 text-left"
            onClick={() => setMobileSummaryExpanded((v) => !v)}
          >
            {quote.picture && (
              <div
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  setGalleryOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.stopPropagation();
                    setGalleryOpen(true);
                  }
                }}
                className="flex-shrink-0 cursor-pointer"
              >
                <Image
                  src={quote.picture}
                  alt={quote.listingTitle}
                  width={64}
                  height={64}
                  className="h-16 w-16 rounded-lg object-cover hover:opacity-80 transition-opacity"
                />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{quote.listingTitle}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {formattedCheckIn} &ndash; {formattedCheckOut} · {quote.guests}{" "}
                {quote.guests === 1 ? "guest" : "guests"}
                {pets > 0
                  ? `, ${pets} ${pets === 1 ? "pet" : "pets"}`
                  : ""} · {quote.pricing.nights}{" "}
                {quote.pricing.nights === 1 ? "night" : "nights"}
              </p>
              {getCheckoutCancellationText(
                quote.pricing.cancellationPolicy,
                quote.checkIn
              ) && (
                <p className="mt-0.5 text-xs text-foreground">
                  {getCheckoutCancellationText(
                    quote.pricing.cancellationPolicy,
                    quote.checkIn
                  )}
                  <Link
                    href="/cancellation"
                    target="_blank"
                    className="underline"
                  >
                    Full policy
                  </Link>
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="font-semibold">
                {formatCurrency(quote.pricing.total + upsellTotal, {
                  cents: true,
                })}
              </span>
              {mobileSummaryExpanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </button>

          {mobileSummaryExpanded && (
            <div className="border-t px-5 py-6 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">Dates</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formattedCheckIn} &ndash; {formattedCheckOut}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 px-4 text-sm"
                  onClick={openDatesDialog}
                >
                  Change
                </Button>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Guests
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {quote.guests} {quote.guests === 1 ? "guest" : "guests"}
                    {pets > 0 && `, ${pets} ${pets === 1 ? "pet" : "pets"}`}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 px-4 text-sm"
                  onClick={openGuestsDialog}
                >
                  Change
                </Button>
              </div>
              <Separator />
              <PriceBreakdown
                nights={quote.pricing.nights}
                accommodation={quote.pricing.accommodation}
                accommodationAdjusted={quote.pricing.accommodationAdjusted}
                cleaning={quote.pricing.cleaning}
                taxes={quote.pricing.taxes}
                taxBreakdown={quote.pricing.taxBreakdown}
                total={quote.pricing.total}
                promotion={quote.promotion}
                upsells={upsellItems.length > 0 ? upsellItems : undefined}
              />
              <CouponInput
                quoteId={quote.quoteId}
                onCouponApplied={handleCouponApplied}
                appliedCoupon={appliedCoupon}
              />
            </div>
          )}
        </div>

        <div className="space-y-6">
          {isMobile && paymentElement}
          <p className="text-xs text-muted-foreground">
            By booking, you agree to our{" "}
            <Link
              href="/terms"
              target="_blank"
              className="underline text-foreground/70 hover:text-foreground"
            >
              Terms & Conditions
            </Link>
            ,{" "}
            <Link
              href="/cancellation"
              target="_blank"
              className="underline text-foreground/70 hover:text-foreground"
            >
              Cancellation Policy
            </Link>
            , and{" "}
            <Link
              href="/privacy"
              target="_blank"
              className="underline text-foreground/70 hover:text-foreground"
            >
              Privacy Policy
            </Link>
            .
          </p>
          {error && (
            <p className="text-center text-sm text-destructive">{error}</p>
          )}
        </div>

        {/* Sticky bottom CTA bar */}
        <div className="fixed inset-x-0 bottom-0 z-50 border-t bg-background px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {/* Cancellation reassurance — one centered line above button */}
          {(() => {
            const text = getCheckoutCancellationText(
              quote.pricing.cancellationPolicy,
              quote.checkIn
            );
            return text ? (
              <p className="flex items-center justify-center gap-1.5 text-[13px] text-green-600 mb-2.5">
                <svg
                  className="h-3.5 w-3.5 flex-shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
                {text.trim()}
              </p>
            ) : null;
          })()}
          <Button
            type="button"
            onClick={handleConfirmBooking}
            disabled={
              loading || !isGuestValid || !policiesAccepted || !cardReady
            }
            className="w-full bg-foreground text-background hover:bg-foreground/90 rounded-xl py-7 text-lg font-semibold flex items-center justify-center gap-2.5"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Lock className="h-4 w-4 opacity-60" />
                Confirm & Pay{" "}
                <span className="font-normal opacity-70">
                  {formatCurrency(quote.pricing.total + upsellTotal, {
                    cents: true,
                  })}
                </span>
              </>
            )}
          </Button>
          <a
            href="tel:+17207592013"
            className="mt-2 block w-full text-center text-xs text-muted-foreground underline"
          >
            Need help? Call (720) 759-2013
          </a>
        </div>
      </div>

      {/* Express Checkout — Missing Info Modal */}
      {expressMissingInfo && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setExpressMissingInfo(null);
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Complete your details</DialogTitle>
              <DialogDescription>
                We need a few more details to finalize your reservation.
              </DialogDescription>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const updatedGuest: GuestInfo = {
                  firstName:
                    (formData.get("firstName") as string) ||
                    expressMissingInfo.guest.firstName,
                  lastName:
                    (formData.get("lastName") as string) ||
                    expressMissingInfo.guest.lastName,
                  email:
                    (formData.get("email") as string) ||
                    expressMissingInfo.guest.email,
                  phone:
                    (formData.get("phone") as string) ||
                    expressMissingInfo.guest.phone,
                };
                // Validate
                if (
                  !updatedGuest.firstName.trim() ||
                  !updatedGuest.lastName.trim() ||
                  !isValidEmail(updatedGuest.email) ||
                  !updatedGuest.phone.trim()
                ) {
                  setError("Please fill in all required fields.");
                  trackCheckoutError({
                    listingId: quote.listingId,
                    total: quote.pricing.total,
                    step: "form_validation",
                    errorMessage:
                      "Missing required guest fields (express checkout)",
                  });
                  return;
                }
                setGuest(updatedGuest);
                setExpressMissingInfo(null);
                await handleExpressReservation(
                  expressMissingInfo.paymentIntentId,
                  updatedGuest
                );
              }}
            >
              {expressMissingInfo.missingFields.includes("firstName") && (
                <div>
                  <label
                    htmlFor="express-firstName"
                    className="block text-sm font-medium mb-1"
                  >
                    First Name *
                  </label>
                  <input
                    id="express-firstName"
                    name="firstName"
                    type="text"
                    required
                    defaultValue={expressMissingInfo.guest.firstName}
                    className="w-full rounded-md border border-input px-3 py-2 text-base sm:text-sm"
                  />
                </div>
              )}
              {expressMissingInfo.missingFields.includes("lastName") && (
                <div>
                  <label
                    htmlFor="express-lastName"
                    className="block text-sm font-medium mb-1"
                  >
                    Last Name *
                  </label>
                  <input
                    id="express-lastName"
                    name="lastName"
                    type="text"
                    required
                    defaultValue={expressMissingInfo.guest.lastName}
                    className="w-full rounded-md border border-input px-3 py-2 text-base sm:text-sm"
                  />
                </div>
              )}
              {expressMissingInfo.missingFields.includes("email") && (
                <div>
                  <label
                    htmlFor="express-email"
                    className="block text-sm font-medium mb-1"
                  >
                    Email *
                  </label>
                  <input
                    id="express-email"
                    name="email"
                    type="email"
                    required
                    defaultValue={expressMissingInfo.guest.email}
                    className="w-full rounded-md border border-input px-3 py-2 text-base sm:text-sm"
                  />
                </div>
              )}
              {expressMissingInfo.missingFields.includes("phone") && (
                <div>
                  <label
                    htmlFor="express-phone"
                    className="block text-sm font-medium mb-1"
                  >
                    Phone *
                  </label>
                  <input
                    id="express-phone"
                    name="phone"
                    type="tel"
                    required
                    defaultValue={expressMissingInfo.guest.phone}
                    className="w-full rounded-md border border-input px-3 py-2 text-base sm:text-sm"
                  />
                </div>
              )}
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="express-marketing"
                  checked={marketingOptIn}
                  onChange={(e) => setMarketingOptIn(e.target.checked)}
                  className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-primary"
                />
                <label
                  htmlFor="express-marketing"
                  className="text-sm text-muted-foreground cursor-pointer select-none"
                >
                  Send me Colorado travel tips and deals
                </label>
              </div>
              <DialogFooter>
                <Button
                  type="submit"
                  className="w-full bg-warm text-warm-foreground hover:bg-warm/90 rounded-full py-6 text-base font-semibold"
                >
                  Complete Reservation
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Photo Gallery — same layout as property detail page */}
      {galleryOpen &&
        (() => {
          const galleryPhotos =
            quote.photos && quote.photos.length > 0
              ? quote.photos
              : quote.picture
                ? [
                    {
                      original: quote.picture,
                      thumbnail: quote.picture,
                      caption: quote.listingTitle,
                    },
                  ]
                : [];
          if (galleryPhotos.length === 0) return null;
          return (
            <>
              {/* Mobile: vertical scroll viewer */}
              <div className="sm:hidden fixed inset-0 z-[100] bg-white">
                <div className="sticky top-0 z-10 flex items-center justify-between bg-white/95 backdrop-blur-sm px-4 py-3 border-b border-border">
                  <span className="text-sm font-medium text-muted-foreground">
                    {galleryPhotos.length} photos
                  </span>
                  <button
                    type="button"
                    onClick={() => setGalleryOpen(false)}
                    className="flex items-center justify-center h-8 w-8 rounded-full bg-muted"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div
                  className="overflow-y-auto"
                  style={{ height: "calc(100vh - 49px)" }}
                >
                  <div className="flex flex-col gap-1 pb-8">
                    {galleryPhotos.map((photo, i) => (
                      <div key={i} className="relative w-full aspect-[4/3]">
                        <Image
                          src={getPhotoUrl(photo.original, 800)}
                          alt={photo.caption || `Photo ${i + 1}`}
                          fill
                          className="object-cover"
                          sizes="100vw"
                          priority={i < 3}
                          loading={i < 3 ? "eager" : "lazy"}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Desktop: scrollable grid viewer */}
              <div className="hidden sm:block fixed inset-0 z-[100] bg-background">
                <div className="sticky top-0 z-10 flex items-center justify-between bg-background border-b border-border px-6 py-3">
                  <button
                    type="button"
                    onClick={() => setGalleryOpen(false)}
                    className="flex items-center justify-center h-8 w-8 rounded-full hover:bg-muted transition-colors"
                  >
                    <X className="h-5 w-5 text-foreground" />
                  </button>
                  <span className="text-sm font-medium text-muted-foreground">
                    {galleryPhotos.length} photos
                  </span>
                  <div className="w-8" />
                </div>
                <div
                  className="overflow-y-auto"
                  style={{ height: "calc(100vh - 53px)" }}
                >
                  <div className="mx-auto max-w-3xl px-6 py-8 space-y-2">
                    {galleryPhotos.map((photo, i) => {
                      const posInGroup = i % 3;
                      if (posInGroup === 0) {
                        return (
                          <div
                            key={i}
                            className="relative w-full aspect-[3/2] rounded-sm overflow-hidden"
                          >
                            <Image
                              src={getPhotoUrl(photo.original, 1200)}
                              alt={photo.caption || `Photo ${i + 1}`}
                              fill
                              className="object-cover"
                              sizes="(max-width: 768px) 100vw, 768px"
                              priority={i < 3}
                              loading={i < 3 ? "eager" : "lazy"}
                            />
                          </div>
                        );
                      }
                      if (posInGroup === 1) {
                        const nextPhoto = galleryPhotos[i + 1];
                        return (
                          <div key={i} className="grid grid-cols-2 gap-2">
                            <div className="relative aspect-[4/3] rounded-sm overflow-hidden">
                              <Image
                                src={getPhotoUrl(photo.original, 800)}
                                alt={photo.caption || `Photo ${i + 1}`}
                                fill
                                className="object-cover"
                                sizes="(max-width: 768px) 50vw, 384px"
                                loading="lazy"
                              />
                            </div>
                            {nextPhoto && (
                              <div className="relative aspect-[4/3] rounded-sm overflow-hidden">
                                <Image
                                  src={getPhotoUrl(nextPhoto.original, 800)}
                                  alt={nextPhoto.caption || `Photo ${i + 2}`}
                                  fill
                                  className="object-cover"
                                  sizes="(max-width: 768px) 50vw, 384px"
                                  loading="lazy"
                                />
                              </div>
                            )}
                          </div>
                        );
                      }
                      return null;
                    })}
                  </div>
                </div>
              </div>
            </>
          );
        })()}

      {/* Mobile Change Dates Bottom Sheet */}
      {(mobileDatesOpen || mobileDatesClosing) && (
        <>
          <div
            className={`fixed inset-0 z-[80] bg-black/40 transition-opacity duration-500 ${mobileDatesVisible && !mobileDatesClosing ? "opacity-100" : "opacity-0"}`}
            onClick={closeMobileDates}
          />
          <div
            className="fixed inset-x-0 bottom-0 z-[81] flex flex-col rounded-t-2xl bg-background shadow-2xl"
            style={{
              height: "92vh",
              transform: `translateY(${mobileDatesVisible && !mobileDatesClosing ? mobileDatesDragY : window.innerHeight}px)`,
              transition:
                mobileDatesDragY > 0 && mobileDatesDragging.current
                  ? "none"
                  : "transform 500ms cubic-bezier(0.32, 0.72, 0, 1)",
            }}
            onTouchStart={handleMobileDatesTouchStart}
            onTouchMove={handleMobileDatesTouchMove}
            onTouchEnd={handleMobileDatesTouchEnd}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-2 pb-1">
              <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 pb-2">
              <button
                type="button"
                onClick={closeMobileDates}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setPendingDateRange(undefined);
                  setPickingCheckout(false);
                }}
                className="text-sm font-semibold underline"
              >
                Clear dates
              </button>
            </div>

            {/* Title */}
            <div className="px-5 pb-2">
              <h2 className="text-xl font-bold">
                {pendingDateRange?.from && pendingDateRange?.to
                  ? `${format(pendingDateRange.from, "MMM d")} – ${format(pendingDateRange.to, "MMM d")}`
                  : pickingCheckout
                    ? "Select check-out date"
                    : "Select check-in date"}
              </h2>
              {minNights && pickingCheckout && (
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {minNights}-night minimum
                </p>
              )}
            </div>

            {/* Sticky weekday header */}
            <div className="border-b border-border px-5 py-2">
              <div className="grid grid-cols-7 text-center">
                {WEEKDAYS.map((day, i) => (
                  <span
                    key={i}
                    className="text-xs font-medium text-muted-foreground"
                  >
                    {day}
                  </span>
                ))}
              </div>
            </div>

            {/* Scrollable months */}
            <div
              ref={mobileDatesScrollRef}
              className="min-h-0 flex-1 overflow-y-auto px-5 pb-4"
            >
              {calendarLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                calendarMonths.map(({ month, days }) => (
                  <div key={format(month, "yyyy-MM")} className="mt-6">
                    <h3 className="mb-3 text-base font-bold">
                      {format(month, "MMMM yyyy")}
                    </h3>
                    <div className="grid grid-cols-7 gap-y-1">
                      {days.map((day, i) => {
                        const inMonth = isSameMonth(day, month);
                        if (!inMonth) return <div key={i} />;

                        const dateStr = format(day, "yyyy-MM-dd");
                        const isUnavailable = unavailableSet.has(dateStr);
                        const isCheckoutOnly = checkoutOnlySet.has(dateStr);
                        const disabled = isMobileDayDisabled(day);
                        const isStart =
                          pendingDateRange?.from &&
                          isSameDay(day, pendingDateRange.from);
                        const isEnd =
                          pendingDateRange?.to &&
                          isSameDay(day, pendingDateRange.to);
                        const inRange = isMobileInRange(day);
                        const showMinNightsTooltip =
                          pickingCheckout &&
                          checkinDateStr === dateStr &&
                          minNights;
                        const showCoTooltip = checkoutOnlyTooltip === dateStr;

                        return (
                          <div
                            key={i}
                            className="relative flex items-center justify-center"
                          >
                            {inRange && (
                              <div className="absolute inset-y-0 left-0 right-0 bg-muted" />
                            )}
                            {isStart && pendingDateRange?.to && (
                              <div className="absolute inset-y-0 left-1/2 right-0 bg-muted" />
                            )}
                            {isEnd && pendingDateRange?.from && (
                              <div className="absolute inset-y-0 left-0 right-1/2 bg-muted" />
                            )}

                            <button
                              type="button"
                              onClick={() => handleMobileDayClick(day)}
                              disabled={disabled && !isCheckoutOnly}
                              className={`relative z-[1] flex h-10 w-10 items-center justify-center rounded-full text-sm transition-colors
                                  ${isStart || isEnd ? "bg-primary text-primary-foreground font-semibold" : ""}
                                  ${inRange ? "text-foreground" : ""}
                                  ${!isStart && !isEnd && !inRange && isToday(day) ? "font-semibold text-primary" : ""}
                                  ${disabled && !isCheckoutOnly ? "text-muted-foreground/40" : ""}
                                  ${isUnavailable && !isCheckoutOnly && !isStart && !isEnd ? "line-through text-muted-foreground/40" : ""}
                                  ${isCheckoutOnly && !isEnd ? "text-muted-foreground/60" : ""}
                                  ${!disabled && !isStart && !isEnd && !inRange ? "hover:bg-muted" : ""}
                                `}
                            >
                              {day.getDate()}
                            </button>

                            {showMinNightsTooltip && (
                              <div className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 z-20 whitespace-nowrap rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-foreground shadow-sm">
                                {minNights}-night minimum
                              </div>
                            )}
                            {isCheckoutOnly &&
                              !pickingCheckout &&
                              showCoTooltip && (
                                <div className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 z-20 whitespace-nowrap rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-foreground shadow-sm">
                                  Check-out only
                                </div>
                              )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Bottom bar */}
            <div className="shrink-0 flex items-center justify-between border-t border-border bg-background px-5 py-4">
              <div>
                {pendingDateRange?.from && pendingDateRange?.to ? (
                  <p className="text-sm font-semibold text-foreground">
                    {format(pendingDateRange.from, "MMM d")} –{" "}
                    {format(pendingDateRange.to, "MMM d")}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">Select dates</p>
                )}
                {requoteError && (
                  <p className="text-xs text-destructive">{requoteError}</p>
                )}
              </div>
              <Button
                type="button"
                onClick={handleMobileDatesUpdate}
                disabled={
                  !pendingDateRange?.from || !pendingDateRange?.to || requoting
                }
                className="rounded-full px-8 py-6 text-base font-semibold"
                size="lg"
              >
                {requoting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Update Dates"
                )}
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Change Dates Dialog (desktop only) */}
      <Dialog open={datesDialogOpen} onOpenChange={setDatesDialogOpen}>
        <DialogContent className="max-w-fit">
          <DialogHeader>
            <DialogTitle>Change Dates</DialogTitle>
            <DialogDescription>
              Select new check-in and check-out dates
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-visible py-4">
            {calendarLoading ? (
              <Skeleton className="h-[300px] w-full rounded-xl" />
            ) : (
              <>
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  {pickingCheckout
                    ? "Select check-out date"
                    : pendingDateRange?.from && pendingDateRange?.to
                      ? "Click a date to adjust"
                      : "Select check-in date"}
                </p>
                <Calendar
                  mode="range"
                  selected={pendingDateRange}
                  onSelect={(range) => {
                    const checkin = pendingDateRange?.from;
                    const checkout = pendingDateRange?.to;
                    let clicked: Date | null = null;

                    if (range?.from && range?.to) {
                      if (checkin && range.from.getTime() !== checkin.getTime())
                        clicked = range.from;
                      else if (
                        checkin &&
                        range.to.getTime() !== checkin.getTime()
                      )
                        clicked = range.to;
                      else clicked = range.from;
                    } else {
                      clicked = range?.from || range?.to || null;
                    }
                    if (!clicked) return;

                    const clickedStr = format(clicked, "yyyy-MM-dd");

                    const rejectIfCta = () => {
                      if (checkoutOnlySet.has(clickedStr)) {
                        setCheckoutOnlyTooltip(clickedStr);
                        setTimeout(() => setCheckoutOnlyTooltip(null), 2000);
                        return true;
                      }
                      return false;
                    };

                    if (checkin && checkout && !pickingCheckout) {
                      if (clicked.getTime() < checkin.getTime()) {
                        if (rejectIfCta()) return;
                        setPendingDateRange({ from: clicked, to: undefined });
                        setPickingCheckout(true);
                      } else if (clicked.getTime() === checkin.getTime()) {
                        setPendingDateRange({ from: clicked, to: undefined });
                        setPickingCheckout(true);
                      } else if (clicked.getTime() === checkout.getTime()) {
                        if (rejectIfCta()) return;
                        setPendingDateRange({ from: clicked, to: undefined });
                        setPickingCheckout(true);
                      } else {
                        const fromStr = format(checkin, "yyyy-MM-dd");
                        const hasBlocks = calendarDays.some(
                          (d) =>
                            d.status !== "available" &&
                            !checkoutOnlySet.has(d.date) &&
                            d.date > fromStr &&
                            d.date < clickedStr
                        );
                        if (hasBlocks) {
                          if (rejectIfCta()) return;
                          setPendingDateRange({ from: clicked, to: undefined });
                          setPickingCheckout(true);
                        } else {
                          setPendingDateRange({ from: checkin, to: clicked });
                        }
                      }
                      return;
                    }

                    if (!pickingCheckout) {
                      if (rejectIfCta()) return;
                      setPendingDateRange({ from: clicked, to: undefined });
                      setPickingCheckout(true);
                    } else if (checkin) {
                      if (clicked.getTime() <= checkin.getTime()) {
                        if (rejectIfCta()) return;
                        setPendingDateRange({ from: clicked, to: undefined });
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
                      setPendingDateRange({ from: checkin, to: clicked });
                      setPickingCheckout(false);
                    }
                  }}
                  components={{ DayButton: CustomDayButton }}
                  numberOfMonths={2}
                  disabled={disabledDates}
                  showOutsideDays={false}
                  className="rounded-xl border p-6 [--cell-size:3.25rem]"
                  classNames={{
                    months: "relative flex flex-col gap-8 md:flex-row",
                    month: "flex w-full flex-col gap-4",
                    month_caption:
                      "flex h-10 w-full items-center justify-center",
                    caption_label: "text-lg font-semibold",
                    nav: "absolute inset-x-0 top-0 flex w-full items-center justify-between px-4",
                    weekdays: "flex w-full",
                    weekday:
                      "flex-1 text-center text-sm font-medium text-muted-foreground uppercase tracking-wide",
                    week: "mt-1 flex w-full",
                    day: "group/day relative flex-1 aspect-square select-none p-0 text-center text-base",
                    range_start: "rdp-no-gradient bg-muted rounded-l-full",
                    range_middle: "rdp-no-gradient bg-muted",
                    range_end: "rdp-no-gradient bg-muted rounded-r-full",
                  }}
                />
                <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-3 w-3 rounded-sm bg-primary/15" />
                    Available
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-3 w-3 rounded-sm bg-muted" />
                    Unavailable
                  </span>
                </div>
              </>
            )}
            {requoteError && (
              <p className="mt-3 text-center text-sm text-destructive">
                {requoteError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDatesDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={
                !pendingDateRange?.from || !pendingDateRange?.to || requoting
              }
              onClick={async () => {
                if (!pendingDateRange?.from || !pendingDateRange?.to) return;
                const checkIn = format(pendingDateRange.from, "yyyy-MM-dd");
                const checkOut = format(pendingDateRange.to, "yyyy-MM-dd");
                const ok = await requote(checkIn, checkOut, quote.guests);
                if (ok) setDatesDialogOpen(false);
              }}
            >
              {requoting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update Dates"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Guests Dialog */}
      <Dialog open={guestsDialogOpen} onOpenChange={setGuestsDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Change Guests</DialogTitle>
            <DialogDescription>Update the number of guests</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <div className="flex items-center justify-between py-4">
              <div>
                <div className="text-sm font-medium text-foreground">
                  Adults
                </div>
                <div className="text-xs text-muted-foreground">Age 13+</div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setPendingAdults((v) => Math.max(1, v - 1))}
                  disabled={pendingAdults <= 1}
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-foreground/70 transition-colors hover:bg-muted disabled:opacity-30"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="w-6 text-center text-sm font-medium text-foreground">
                  {pendingAdults}
                </span>
                <button
                  type="button"
                  onClick={() => setPendingAdults((v) => v + 1)}
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-foreground/70 transition-colors hover:bg-muted"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="border-t border-border" />
            <div className="flex items-center justify-between py-4">
              <div>
                <div className="text-sm font-medium text-foreground">
                  Children
                </div>
                <div className="text-xs text-muted-foreground">Ages 2–12</div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setPendingChildren((v) => Math.max(0, v - 1))}
                  disabled={pendingChildren <= 0}
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-foreground/70 transition-colors hover:bg-muted disabled:opacity-30"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="w-6 text-center text-sm font-medium text-foreground">
                  {pendingChildren}
                </span>
                <button
                  type="button"
                  onClick={() => setPendingChildren((v) => v + 1)}
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-foreground/70 transition-colors hover:bg-muted"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="border-t border-border" />
            <div className="flex items-center justify-between py-4">
              <div>
                <div className="text-sm font-medium text-foreground">Pets</div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setPendingPets((v) => Math.max(0, v - 1))}
                  disabled={pendingPets <= 0}
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-foreground/70 transition-colors hover:bg-muted disabled:opacity-30"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="w-6 text-center text-sm font-medium text-foreground">
                  {pendingPets}
                </span>
                <button
                  type="button"
                  onClick={() => setPendingPets((v) => v + 1)}
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-foreground/70 transition-colors hover:bg-muted"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
          {requoteError && (
            <p className="text-center text-sm text-destructive">
              {requoteError}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setGuestsDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              disabled={
                (pendingAdults + pendingChildren === quote.guests &&
                  pendingPets === pets) ||
                requoting
              }
              onClick={async () => {
                const newGuests = pendingAdults + pendingChildren;
                const ok =
                  newGuests === quote.guests ||
                  (await requote(quote.checkIn, quote.checkOut, newGuests));
                if (ok) {
                  setPets(pendingPets);
                  if (pendingPets > 0) {
                    setSelectedUpsells((prev) =>
                      prev.filter((id) => id !== "pet-fee")
                    );
                  }
                  setGuestsDialogOpen(false);
                }
              }}
            >
              {requoting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update Guests"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}
