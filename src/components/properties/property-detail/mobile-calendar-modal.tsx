"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
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
import { X, Loader2, Minus, Plus } from "lucide-react";
import { useDateRange } from "./date-range-context";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { trackCheckAvailability } from "@/lib/tracking";

interface CalendarDay {
  date: string;
  status: string;
  minNights: number;
  cta: boolean;
  ctd: boolean;
}

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const DISMISS_THRESHOLD = 120;

export function MobileCalendarModal({
  listingId,
  listingTitle,
  open,
  onClose,
  pointofsale,
  onSaveWithQuote,
  onReserve,
  maxGuests,
}: {
  listingId: string;
  listingTitle?: string;
  open: boolean;
  onClose: () => void;
  reviewScore?: number;
  reviewCount?: number;
  basePrice?: number;
  pointofsale?: string;
  onSaveWithQuote?: (quote: Record<string, unknown> | null) => void;
  onReserve?: (quote: Record<string, unknown>) => void;
  maxGuests?: number;
}) {
  const { dateRange, setDateRange, guests, setGuests } = useDateRange();
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);
  const [pickingCheckout, setPickingCheckout] = useState(false);
  const [checkoutOnlyTooltip, setCheckoutOnlyTooltip] = useState<string | null>(
    null
  );
  const [quotePrice, setQuotePrice] = useState<{
    total: number;
    nights: number;
    perNight: number;
  } | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteRaw, setQuoteRaw] = useState<Record<string, unknown> | null>(
    null
  );

  // Local selection state — commit to context on Save
  const [localFrom, setLocalFrom] = useState<Date | undefined>(dateRange?.from);
  const [localTo, setLocalTo] = useState<Date | undefined>(dateRange?.to);

  // Sheet animation & drag state
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const [dragY, setDragY] = useState(0);
  const dragStartY = useRef(0);
  const isDragging = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Open animation
  useEffect(() => {
    if (open) {
      // Small delay so the mount + transition both fire
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
    } else {
      setVisible(false);
      setClosing(false);
      setDragY(0);
    }
  }, [open]);

  function animateClose() {
    setClosing(true);
    setVisible(false);
    setTimeout(() => {
      setClosing(false);
      setDragY(0);
      onClose();
    }, 500);
  }

  // Touch drag to dismiss (only from the handle/header area, or when scrolled to top)
  function handleTouchStart(e: React.TouchEvent) {
    const scrollTop = scrollRef.current?.scrollTop ?? 0;
    // Only allow drag-to-dismiss when scrolled to top
    if (scrollTop > 0) return;
    dragStartY.current = e.touches[0].clientY;
    isDragging.current = true;
    setDragY(0);
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!isDragging.current) return;
    const delta = e.touches[0].clientY - dragStartY.current;
    // Only allow dragging down
    if (delta > 0) {
      setDragY(delta);
    }
  }

  function handleTouchEnd() {
    if (!isDragging.current) return;
    isDragging.current = false;
    if (dragY > DISMISS_THRESHOLD) {
      animateClose();
    } else {
      setDragY(0);
    }
  }

  // Sync local state when modal opens
  useEffect(() => {
    if (open) {
      setLocalFrom(dateRange?.from);
      setLocalTo(dateRange?.to);
      setPickingCheckout(!!dateRange?.from && !dateRange?.to);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lock body scroll
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [open]);

  // Fetch calendar data
  useEffect(() => {
    async function fetchCalendar() {
      try {
        const from = format(new Date(), "yyyy-MM-dd");
        const to = format(addMonths(new Date(), 24), "yyyy-MM-dd");
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
    if (calendarDays.length === 0) fetchCalendar();
  }, [listingId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch quote when both dates are selected
  const localFromMs = localFrom?.getTime();
  const localToMs = localTo?.getTime();

  useEffect(() => {
    if (!localFromMs || !localToMs) {
      setQuotePrice(null);
      setQuoteRaw(null);
      return;
    }
    const fromDate = new Date(localFromMs);
    const toDate = new Date(localToMs);
    const checkIn = format(fromDate, "yyyy-MM-dd");
    const checkOut = format(toDate, "yyyy-MM-dd");
    if (checkOut <= checkIn) return;

    setQuoteLoading(true);
    setQuotePrice(null);
    setQuoteRaw(null);

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        trackCheckAvailability({
          listingId,
          listingTitle: listingTitle || "Property",
          checkIn,
          checkOut,
          guests: Math.max(1, guests),
        });
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
          signal: controller.signal,
        });
        if (res.ok) {
          const data = await res.json();
          setQuoteRaw(data);
          const rp = data.rates?.ratePlans?.[0];
          const money = rp?.ratePlan?.money;
          if (money) {
            const nights = rp.days.length;
            setQuotePrice({
              total: money.hostPayout,
              nights,
              perNight: Math.round(money.fareAccommodationAdjusted / nights),
            });
          }
        }
      } catch {
        // Non-critical — price just won't show
      } finally {
        setQuoteLoading(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [guests, listingId, listingTitle, localFromMs, localToMs, pointofsale]);

  // Calendar logic (same as booking sidebar)
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

  const unavailableSet = useMemo(() => {
    const set = new Set<string>();
    for (const d of calendarDays) {
      if (d.status !== "available") set.add(d.date);
    }
    return set;
  }, [calendarDays]);

  const maxCheckoutDate = useMemo((): Date | null => {
    if (!localFrom) return null;
    const checkinStr = format(localFrom, "yyyy-MM-dd");
    const blocked = calendarDays
      .filter((d) => d.status !== "available" && d.date > checkinStr)
      .sort((a, b) => a.date.localeCompare(b.date));
    return blocked.length > 0 ? new Date(blocked[0].date + "T12:00:00") : null;
  }, [localFrom, calendarDays]);

  const minNights = useMemo(() => {
    if (!localFrom) return null;
    const fromStr = format(localFrom, "yyyy-MM-dd");
    const day = calendarDays.find((d) => d.date === fromStr);
    return day?.minNights && day.minNights > 1 ? day.minNights : null;
  }, [localFrom, calendarDays]);

  const noCheckoutDates = useMemo(
    () =>
      new Set(
        calendarDays
          .filter((d) => d.status === "available" && d.ctd)
          .map((d) => d.date)
      ),
    [calendarDays]
  );

  const checkinDateStr = localFrom ? format(localFrom, "yyyy-MM-dd") : null;

  // Generate 6 months of data
  const months = useMemo(() => {
    const result: { month: Date; days: Date[] }[] = [];
    const today = new Date();
    for (let i = 0; i < 24; i++) {
      const monthDate = addMonths(today, i);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);
      const calStart = startOfWeek(monthStart);
      const calEnd = endOfWeek(monthEnd);
      const days = eachDayOfInterval({ start: calStart, end: calEnd });
      result.push({ month: monthDate, days });
    }
    return result;
  }, []);

  const isDayDisabled = useCallback(
    (date: Date) => {
      const dateStr = format(date, "yyyy-MM-dd");
      const isUnavailable =
        unavailableSet.has(dateStr) && !checkoutOnlySet.has(dateStr);
      const yesterday = addDays(new Date(), 0);
      yesterday.setHours(0, 0, 0, 0);

      if (pickingCheckout && localFrom) {
        const cutoffTime = maxCheckoutDate?.getTime();
        const earliestCheckout = addDays(localFrom, minNights || 1);
        if (date < earliestCheckout) return true;
        if (isUnavailable && (!cutoffTime || date.getTime() !== cutoffTime))
          return true;
        if (noCheckoutDates.has(dateStr)) return true;
        if (cutoffTime && date.getTime() > cutoffTime) return true;
        return false;
      }

      if (isBefore(date, yesterday)) return true;
      return isUnavailable;
    },
    [
      pickingCheckout,
      localFrom,
      unavailableSet,
      checkoutOnlySet,
      maxCheckoutDate,
      minNights,
      noCheckoutDates,
    ]
  );

  const isInRange = useCallback(
    (date: Date) => {
      if (!localFrom || !localTo) return false;
      return date > localFrom && date < localTo;
    },
    [localFrom, localTo]
  );

  const handleDayClick = useCallback(
    (date: Date) => {
      const dateStr = format(date, "yyyy-MM-dd");

      if (!pickingCheckout) {
        if (checkoutOnlySet.has(dateStr)) {
          setCheckoutOnlyTooltip(dateStr);
          setTimeout(() => setCheckoutOnlyTooltip(null), 2000);
          return;
        }
        if (isDayDisabled(date)) return;
        setLocalFrom(date);
        setLocalTo(undefined);
        setPickingCheckout(true);
      } else if (localFrom) {
        if (date.getTime() <= localFrom.getTime()) {
          if (checkoutOnlySet.has(dateStr)) {
            setCheckoutOnlyTooltip(dateStr);
            setTimeout(() => setCheckoutOnlyTooltip(null), 2000);
            return;
          }
          setLocalFrom(date);
          setLocalTo(undefined);
          return;
        }
        if (isDayDisabled(date)) return;
        const fromStr = format(localFrom, "yyyy-MM-dd");
        const toStr = dateStr;
        if (
          calendarDays.some(
            (d) =>
              d.status !== "available" && d.date > fromStr && d.date < toStr
          )
        )
          return;
        setLocalTo(date);
        setPickingCheckout(false);
      }
    },
    [pickingCheckout, localFrom, checkoutOnlySet, isDayDisabled, calendarDays]
  );

  function handleClear() {
    setLocalFrom(undefined);
    setLocalTo(undefined);
    setPickingCheckout(false);
  }

  function handleSave() {
    setDateRange(
      localFrom && localTo ? { from: localFrom, to: localTo } : undefined
    );
    if (onSaveWithQuote) onSaveWithQuote(quoteRaw);
    animateClose();
  }

  if (!open && !closing) return null;

  const bothSelected = !!localFrom && !!localTo;
  const isDragTransition = dragY > 0 && isDragging.current;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[80] bg-black/40 transition-opacity duration-500 ${visible && !closing ? "opacity-100" : "opacity-0"}`}
        onClick={animateClose}
      />

      {/* Bottom sheet */}
      <div
        className="fixed inset-x-0 bottom-0 z-[81] flex flex-col rounded-t-2xl bg-background shadow-2xl"
        style={{
          height: "92vh",
          transform: `translateY(${visible && !closing ? dragY : closing ? window.innerHeight : window.innerHeight}px)`,
          transition: isDragTransition
            ? "none"
            : "transform 500ms cubic-bezier(0.32, 0.72, 0, 1)",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-2">
          <button
            onClick={animateClose}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
          <button
            onClick={handleClear}
            className="text-sm font-semibold underline"
          >
            Clear dates
          </button>
        </div>

        {/* Title */}
        <div className="px-5 pb-2">
          <h2 className="text-xl font-bold">
            {bothSelected
              ? `${format(localFrom!, "MMM d")} – ${format(localTo!, "MMM d")}`
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
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-y-auto px-5 pb-4"
        >
          {months.map(({ month, days }) => (
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
                  const disabled = isDayDisabled(day);
                  const isStart = localFrom && isSameDay(day, localFrom);
                  const isEnd = localTo && isSameDay(day, localTo);
                  const inRange = isInRange(day);
                  const showMinNightsTooltip =
                    pickingCheckout && checkinDateStr === dateStr && minNights;
                  const showCheckoutOnlyTooltip =
                    checkoutOnlyTooltip === dateStr;

                  return (
                    <div
                      key={i}
                      className="relative flex items-center justify-center"
                    >
                      {/* Range background */}
                      {inRange && (
                        <div className="absolute inset-y-0 left-0 right-0 bg-muted" />
                      )}
                      {isStart && localTo && (
                        <div className="absolute inset-y-0 left-1/2 right-0 bg-muted rounded-r-none" />
                      )}
                      {isEnd && localFrom && (
                        <div className="absolute inset-y-0 left-0 right-1/2 bg-muted rounded-l-none" />
                      )}

                      <button
                        onClick={() => handleDayClick(day)}
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
                        showCheckoutOnlyTooltip && (
                          <div className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 z-20 whitespace-nowrap rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-foreground shadow-sm">
                            Check-out only
                          </div>
                        )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Guest counter — only show when dates are selected */}
        {bothSelected && (
          <div className="shrink-0 flex items-center justify-between border-t border-border px-5 py-3">
            <span className="text-sm font-semibold text-foreground">
              Guests
            </span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setGuests(Math.max(1, guests - 1))}
                disabled={guests <= 1}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-foreground disabled:opacity-30"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="w-6 text-center text-sm font-medium">
                {guests}
              </span>
              <button
                onClick={() => setGuests(Math.min(maxGuests || 16, guests + 1))}
                disabled={guests >= (maxGuests || 16)}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-foreground disabled:opacity-30"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Bottom bar — outside scroll area, pinned to bottom of flex container */}
        <div className="shrink-0 flex items-center justify-between border-t border-border bg-background px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div>
            {quotePrice ? (
              <>
                <p className="text-base font-bold text-foreground">
                  {formatCurrency(quotePrice.total)}{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    total
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {quotePrice.nights}{" "}
                  {quotePrice.nights === 1 ? "night" : "nights"} · {guests}{" "}
                  {guests === 1 ? "guest" : "guests"}
                </p>
              </>
            ) : quoteLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Getting price...
                </span>
              </div>
            ) : (
              <p className="text-sm font-semibold text-foreground">
                {bothSelected
                  ? `${format(localFrom!, "MMM d")} – ${format(localTo!, "MMM d")}`
                  : "Add dates for prices"}
              </p>
            )}
          </div>
          <div className="shrink-0 w-[48%] flex flex-col items-center">
            {quotePrice && quoteRaw && onReserve ? (
              <>
                <Button
                  onClick={() => {
                    setDateRange(
                      localFrom && localTo
                        ? { from: localFrom, to: localTo }
                        : undefined
                    );
                    if (onSaveWithQuote) onSaveWithQuote(quoteRaw);
                    onReserve(quoteRaw);
                  }}
                  className="relative w-full overflow-hidden rounded-full bg-accent text-accent-foreground hover:bg-accent/90 py-6 text-base font-semibold after:absolute after:inset-0 after:animate-shimmer after:bg-gradient-to-r after:from-transparent after:via-white/20 after:via-50% after:to-transparent"
                >
                  Reserve
                </Button>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  You won&apos;t be charged yet
                </p>
              </>
            ) : quoteLoading ? (
              <Button
                disabled
                className="w-full rounded-full bg-accent text-accent-foreground py-6 text-base font-semibold opacity-50"
              >
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Reserve
              </Button>
            ) : (
              <Button
                onClick={() => {
                  if (bothSelected) handleSave();
                }}
                disabled={!bothSelected}
                className="w-full rounded-full py-6 text-base font-semibold"
              >
                Select dates
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
