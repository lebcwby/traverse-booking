"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { addDays, format } from "date-fns";
import type { DateRange } from "react-day-picker";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

type GuestKey = "adults" | "children" | "infants" | "pets";

const GUEST_ROWS: Array<{
  key: GuestKey;
  label: string;
  sub: string;
  min: number;
  countsAsGuest: boolean;
}> = [
  {
    key: "adults",
    label: "Adults",
    sub: "Ages 13+",
    min: 1,
    countsAsGuest: true,
  },
  {
    key: "children",
    label: "Children",
    sub: "Ages 2–12",
    min: 0,
    countsAsGuest: true,
  },
  {
    key: "infants",
    label: "Infants",
    sub: "Under 2",
    min: 0,
    countsAsGuest: false,
  },
  {
    key: "pets",
    label: "Pets",
    sub: "Bringing a pet?",
    min: 0,
    countsAsGuest: false,
  },
];

export function NoFeesSearchBar() {
  const router = useRouter();
  const [range, setRange] = useState<DateRange | undefined>(undefined);
  const [counts, setCounts] = useState<Record<GuestKey, number>>({
    adults: 2,
    children: 0,
    infants: 0,
    pets: 0,
  });
  const [datesOpen, setDatesOpen] = useState(false);
  const [guestsOpen, setGuestsOpen] = useState(false);
  const [calendarMonths, setCalendarMonths] = useState(2);

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 720px)");
    const update = () => setCalendarMonths(mql.matches ? 1 : 2);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  const totalGuests = counts.adults + counts.children;
  const totalParty = totalGuests + counts.infants;
  const guestLabel =
    totalParty === 0
      ? "Add guests"
      : `${totalGuests} guest${totalGuests === 1 ? "" : "s"}${
          counts.infants > 0
            ? `, ${counts.infants} infant${counts.infants === 1 ? "" : "s"}`
            : ""
        }${counts.pets > 0 ? `, ${counts.pets} pet${counts.pets === 1 ? "" : "s"}` : ""}`;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    params.set("city", "Crested Butte, CO");
    if (range?.from) params.set("checkIn", format(range.from, "yyyy-MM-dd"));
    if (range?.to) params.set("checkOut", format(range.to, "yyyy-MM-dd"));
    if (totalGuests > 0) params.set("guests", String(totalGuests));
    if (counts.pets > 0) params.set("pets", "true");
    router.push(`/properties?${params.toString()}`);
  }

  const checkInLabel = range?.from ? format(range.from, "MMM d") : "Add dates";
  const checkOutLabel = range?.to ? format(range.to, "MMM d") : "Add dates";
  const datesMobileLabel =
    range?.from && range?.to
      ? `${format(range.from, "MMM d")} – ${format(range.to, "MMM d")}`
      : range?.from
        ? format(range.from, "MMM d")
        : "Add dates";

  const CalendarIcon = (
    <svg
      viewBox="0 0 24 24"
      width="15"
      height="15"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );

  return (
    <div className="wrap search-wrap">
      <form className="search-bar" onSubmit={handleSubmit}>
        <div className="search-field search-field--where">
          <span className="search-label">WHERE</span>
          <span className="search-value">
            <svg
              viewBox="0 0 24 24"
              width="15"
              height="15"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            Crested Butte, CO
          </span>
        </div>

        <Popover open={datesOpen} onOpenChange={setDatesOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={`search-field search-field-button search-field--check-in${
                datesOpen ? " is-active" : ""
              }`}
              aria-label="Check-in date"
            >
              <span className="search-label">CHECK IN</span>
              <span
                className={`search-value${range?.from ? "" : " search-placeholder"}`}
              >
                {CalendarIcon}
                {checkInLabel}
              </span>
            </button>
          </PopoverTrigger>
          <button
            type="button"
            className={`search-field search-field-button search-field--check-out${
              datesOpen ? " is-active" : ""
            }`}
            onClick={() => setDatesOpen(true)}
            aria-label="Check-out date"
          >
            <span className="search-label">CHECK OUT</span>
            <span
              className={`search-value${range?.to ? "" : " search-placeholder"}`}
            >
              {CalendarIcon}
              {checkOutLabel}
            </span>
          </button>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={`search-field search-field-button search-field--dates-mobile${
                datesOpen ? " is-active" : ""
              }`}
              aria-label="Dates"
            >
              <span className="search-label">DATES</span>
              <span
                className={`search-value${range?.from ? "" : " search-placeholder"}`}
              >
                {CalendarIcon}
                {datesMobileLabel}
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="dates-popover w-auto p-0"
            align="start"
            side="bottom"
            sideOffset={12}
            avoidCollisions={false}
          >
            <Calendar
              mode="range"
              selected={range}
              onSelect={setRange}
              numberOfMonths={calendarMonths}
              showOutsideDays={false}
              disabled={{ before: addDays(new Date(), 1) }}
            />
            <div className="flex items-center justify-between border-t border-neutral-200 px-3 py-2">
              <button
                type="button"
                onClick={() => setRange(undefined)}
                className="text-sm font-medium text-foreground underline underline-offset-4 hover:opacity-70 disabled:pointer-events-none disabled:opacity-40"
                disabled={!range?.from && !range?.to}
              >
                Clear dates
              </button>
              <button
                type="button"
                onClick={() => setDatesOpen(false)}
                className="rounded-full bg-[var(--forest)] px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--forest-2)]"
              >
                Done
              </button>
            </div>
          </PopoverContent>
        </Popover>

        <Popover open={guestsOpen} onOpenChange={setGuestsOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={`search-field search-field-button search-field--last search-field--guests${
                guestsOpen ? " is-active" : ""
              }`}
              aria-label="Guests"
            >
              <span className="search-label">GUESTS</span>
              <span
                className={`search-value${totalParty === 0 ? " search-placeholder" : ""}`}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="15"
                  height="15"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                {guestLabel}
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-4" align="end" sideOffset={12}>
            <div className="divide-y divide-neutral-200">
              {GUEST_ROWS.map((row) => (
                <div
                  key={row.key}
                  className="flex items-center justify-between py-3"
                >
                  <div>
                    <div className="text-sm font-medium text-foreground">
                      {row.label}
                    </div>
                    <div className="text-xs text-neutral-500">{row.sub}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      aria-label={`Decrease ${row.label.toLowerCase()}`}
                      disabled={counts[row.key] <= row.min}
                      onClick={() =>
                        setCounts((c) => ({
                          ...c,
                          [row.key]: Math.max(row.min, c[row.key] - 1),
                        }))
                      }
                      className="flex h-7 w-7 items-center justify-center rounded-full border border-neutral-300 text-base leading-none transition-colors hover:border-neutral-600 disabled:pointer-events-none disabled:opacity-40"
                    >
                      −
                    </button>
                    <span className="min-w-[1.5ch] text-center text-sm font-semibold tabular-nums">
                      {counts[row.key]}
                    </span>
                    <button
                      type="button"
                      aria-label={`Increase ${row.label.toLowerCase()}`}
                      onClick={() =>
                        setCounts((c) => ({
                          ...c,
                          [row.key]: Math.min(16, c[row.key] + 1),
                        }))
                      }
                      className="flex h-7 w-7 items-center justify-center rounded-full border border-neutral-300 text-base leading-none transition-colors hover:border-neutral-600 disabled:pointer-events-none disabled:opacity-40"
                      disabled={counts[row.key] >= 16}
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <button type="submit" className="btn btn-primary btn-search">
          <svg
            viewBox="0 0 24 24"
            width="15"
            height="15"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.2}
            strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          Search
        </button>
      </form>
    </div>
  );
}
