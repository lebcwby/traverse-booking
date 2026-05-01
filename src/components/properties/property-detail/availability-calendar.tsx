"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import { addMonths, addDays, format } from "date-fns";
import { useDateRange } from "./date-range-context";
import type { DayButton as DayButtonType } from "react-day-picker";

interface CalendarDay {
  date: string;
  status: "available" | "unavailable" | "reserved" | "booked";
  minNights: number;
  cta: boolean;
  ctd: boolean;
}

export function AvailabilityCalendar({
  listingId,
  numberOfMonths = 2,
}: {
  listingId: string;
  numberOfMonths?: number;
}) {
  const { dateRange, setDateRange } = useDateRange();
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickingCheckout, setPickingCheckout] = useState(false);

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
          setCalendarDays(Array.isArray(data) ? data : data.days || []);
        }
      } catch {
        // Calendar data is non-critical
      } finally {
        setLoading(false);
      }
    }
    fetchCalendar();
  }, [listingId]);

  // Sync pickingCheckout with dateRange — if both dates are set, we have a full range
  // If only from is set, we're picking checkout
  useEffect(() => {
    if (dateRange?.from && !dateRange?.to) {
      setPickingCheckout(true);
    } else if (dateRange?.from && dateRange?.to) {
      setPickingCheckout(false);
    } else {
      setPickingCheckout(false);
    }
  }, [dateRange?.from, dateRange?.to]);

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
    if (!dateRange?.from) return null;
    const checkinStr = format(dateRange.from, "yyyy-MM-dd");
    const blocked = calendarDays
      .filter((d) => d.status !== "available" && d.date > checkinStr)
      .sort((a, b) => a.date.localeCompare(b.date));
    return blocked.length > 0 ? new Date(blocked[0].date + "T12:00:00") : null;
  }, [dateRange?.from, calendarDays]);

  // All unavailable date strings for strikethrough styling
  const unavailableSet = useMemo(() => {
    const set = new Set<string>();
    for (const d of calendarDays) {
      if (d.status !== "available") set.add(d.date);
    }
    return set;
  }, [calendarDays]);

  const checkinDateStr = dateRange?.from
    ? format(dateRange.from, "yyyy-MM-dd")
    : null;

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

  // Custom day button with strikethrough, checkout-only styling, and tooltips
  const CustomDayButton = useCallback(
    (props: React.ComponentProps<typeof DayButtonType>) => {
      const dateStr = format(props.day.date, "yyyy-MM-dd");
      const isUnavailable = unavailableSet.has(dateStr);
      const isCheckoutOnly = checkoutOnlySet.has(dateStr);
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
            if (isCheckoutOnly && !pickingCheckout && !dateRange?.from) {
              setCheckoutOnlyTooltip(dateStr);
              setTimeout(() => setCheckoutOnlyTooltip(null), 2000);
            }
          }}
        >
          <CalendarDayButton
            {...props}
            className={`${props.className || ""} ${strikethrough ? "line-through !text-muted-foreground !opacity-50" : ""} ${isCheckoutOnly ? "!text-muted-foreground/80" : ""}`}
          />
          {showMinNights && (
            <div className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 z-20 whitespace-nowrap rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-foreground shadow-sm">
              {minNights}-night minimum
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-2 w-2 rotate-45 border-b border-r border-border bg-background" />
            </div>
          )}
          {isCheckoutOnly && !pickingCheckout && !dateRange?.from && (
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
    ]
  );

  // Scarcity: count available nights in the next 30 days
  const scarcityMessage = useMemo(() => {
    if (calendarDays.length === 0) return null;
    const today = format(new Date(), "yyyy-MM-dd");
    const thirtyOut = format(addDays(new Date(), 30), "yyyy-MM-dd");
    const availableNights = calendarDays.filter(
      (d) => d.status === "available" && d.date >= today && d.date <= thirtyOut
    ).length;
    if (availableNights === 0) return "Fully booked for the next 30 days";
    if (availableNights <= 7)
      return `Only ${availableNights} nights available in the next 30 days`;
    if (availableNights <= 14)
      return `${availableNights} nights available in the next 30 days`;
    return null;
  }, [calendarDays]);

  if (loading) return <Skeleton className="h-[300px] w-full rounded-xl" />;

  return (
    <div>
      <h3 className="mb-4 text-lg font-semibold">Availability</h3>
      {scarcityMessage && (
        <p className="mb-3 text-sm font-medium text-accent">
          {scarcityMessage}
        </p>
      )}
      <p className="mb-2 text-xs font-medium text-muted-foreground">
        {pickingCheckout
          ? "Select check-out date"
          : dateRange?.from && dateRange?.to
            ? "Click a date to adjust"
            : "Select check-in date"}
      </p>
      <Calendar
        mode="range"
        selected={dateRange}
        onSelect={(range) => {
          const checkin = dateRange?.from;
          const checkout = dateRange?.to;
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

          const clickedStr = format(clicked, "yyyy-MM-dd");

          // Helper: reject cta dates as check-in and show tooltip
          const rejectIfCta = () => {
            if (checkoutOnlySet.has(clickedStr)) {
              setCheckoutOnlyTooltip(clickedStr);
              setTimeout(() => setCheckoutOnlyTooltip(null), 2000);
              return true;
            }
            return false;
          };

          // Have a full range — adjust dates
          if (checkin && checkout && !pickingCheckout) {
            if (clicked.getTime() < checkin.getTime()) {
              // Before check-in → new check-in
              if (rejectIfCta()) return;
              setDateRange({ from: clicked, to: undefined });
              setPickingCheckout(true);
            } else if (clicked.getTime() === checkin.getTime()) {
              // Same as check-in → reset to pick fresh
              setDateRange({ from: clicked, to: undefined });
              setPickingCheckout(true);
            } else if (clicked.getTime() === checkout.getTime()) {
              // Same as checkout → make it the new check-in
              if (rejectIfCta()) return;
              setDateRange({ from: clicked, to: undefined });
              setPickingCheckout(true);
            } else {
              // Any other date after check-in → new checkout (if no blocks between)
              const fromStr = format(checkin, "yyyy-MM-dd");
              const hasBlocks = calendarDays.some(
                (d) =>
                  d.status !== "available" &&
                  !checkoutOnlySet.has(d.date) &&
                  d.date > fromStr &&
                  d.date < clickedStr
              );
              if (hasBlocks) {
                // Blocked days between — start fresh with this as new check-in
                if (rejectIfCta()) return;
                setDateRange({ from: clicked, to: undefined });
                setPickingCheckout(true);
              } else {
                setDateRange({ from: checkin, to: clicked });
              }
            }
            return;
          }

          if (!pickingCheckout) {
            if (rejectIfCta()) return;
            setDateRange({ from: clicked, to: undefined });
            setPickingCheckout(true);
          } else if (checkin) {
            // Pick check-out
            if (clicked.getTime() <= checkin.getTime()) {
              if (rejectIfCta()) return;
              setDateRange({ from: clicked, to: undefined });
              return;
            }
            const fromStr = format(checkin, "yyyy-MM-dd");
            const toStr = format(clicked, "yyyy-MM-dd");
            if (
              calendarDays.some(
                (d) =>
                  d.status !== "available" && d.date > fromStr && d.date < toStr
              )
            )
              return;
            setDateRange({ from: checkin, to: clicked });
            setPickingCheckout(false);
          }
        }}
        components={{ DayButton: CustomDayButton }}
        numberOfMonths={numberOfMonths}
        disabled={disabledDates}
        showOutsideDays={false}
        className="rounded-xl border p-6 [--cell-size:3.25rem]"
        classNames={{
          months: "relative flex flex-col gap-8 md:flex-row",
          month: "flex w-full flex-col gap-4",
          month_caption: "flex h-10 w-full items-center justify-center",
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
    </div>
  );
}
