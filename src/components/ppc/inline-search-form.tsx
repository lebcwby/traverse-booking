"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { DateRange } from "react-day-picker";

interface InlineSearchFormProps {
  location?: string;
  defaultAdults?: number;
  extraParams?: Record<string, string>;
}

export function InlineSearchForm({
  location = "Crested Butte, Colorado",
  defaultAdults = 2,
  extraParams,
}: InlineSearchFormProps) {
  const router = useRouter();
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [checkInNative, setCheckInNative] = useState("");
  const [checkOutNative, setCheckOutNative] = useState("");
  const [adults, setAdults] = useState(defaultAdults);
  const [children, setChildren] = useState(0);
  const [dateOpen, setDateOpen] = useState(false);

  // Persist search params to sessionStorage so carousel links can pick them up
  function syncToStorage(ci: string, co: string, g: number) {
    try {
      sessionStorage.setItem(
        "ppc_search_dates",
        JSON.stringify({
          checkIn: ci || "",
          checkOut: co || "",
          guests: g > 0 ? String(g) : "",
        })
      );
    } catch {
      /* SSR / private browsing */
    }
  }

  function handleSearch() {
    const params = new URLSearchParams();
    const ci = dateRange?.from
      ? format(dateRange.from, "yyyy-MM-dd")
      : checkInNative;
    const co = dateRange?.to
      ? format(dateRange.to, "yyyy-MM-dd")
      : checkOutNative;
    if (ci) params.set("checkIn", ci);
    if (co) params.set("checkOut", co);
    const totalGuests = adults + children;
    if (totalGuests > 0) params.set("guests", String(totalGuests));
    syncToStorage(ci, co, totalGuests);
    if (extraParams) {
      for (const [k, v] of Object.entries(extraParams)) {
        params.set(k, v);
      }
    }
    const qs = params.toString();
    router.push(`/properties${qs ? `?${qs}` : ""}`);
  }

  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");

  return (
    <div className="w-full max-w-md space-y-2">
      {/* Location */}
      <div className="rounded-xl border border-border bg-white px-4 py-3">
        <label className="block text-xs font-medium text-muted-foreground">
          Location
        </label>
        <p className="text-sm text-foreground">{location}</p>
      </div>

      {/* ── Dates: Desktop — Popover calendar ── */}
      <div className="hidden md:flex gap-2">
        <Popover open={dateOpen} onOpenChange={setDateOpen}>
          <PopoverTrigger asChild>
            <button type="button" className="flex flex-1 gap-2">
              <div className="flex-1 rounded-xl border border-border bg-white px-4 py-3 text-left">
                <span className="block text-xs font-medium text-muted-foreground">
                  Check in
                </span>
                <span className="text-sm text-foreground">
                  {dateRange?.from ? (
                    format(dateRange.from, "MMM d, yyyy")
                  ) : (
                    <span className="text-muted-foreground/50">Add dates</span>
                  )}
                </span>
              </div>
              <div className="flex-1 rounded-xl border border-border bg-white px-4 py-3 text-left">
                <span className="block text-xs font-medium text-muted-foreground">
                  Check out
                </span>
                <span className="text-sm text-foreground">
                  {dateRange?.to ? (
                    format(dateRange.to, "MMM d, yyyy")
                  ) : (
                    <span className="text-muted-foreground/50">Add dates</span>
                  )}
                </span>
              </div>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start" sideOffset={4}>
            <Calendar
              mode="range"
              selected={dateRange}
              onSelect={(range) => {
                setDateRange(range);
                if (range?.from && range?.to) {
                  setDateOpen(false);
                  syncToStorage(
                    format(range.from, "yyyy-MM-dd"),
                    format(range.to, "yyyy-MM-dd"),
                    adults + children
                  );
                }
              }}
              numberOfMonths={2}
              disabled={{ before: today }}
              showOutsideDays={false}
              className="rounded-xl"
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* ── Dates: Mobile — native date inputs (iOS/Android native picker) ── */}
      <div className="flex gap-2 md:hidden">
        <div className="flex-1 rounded-xl border border-border bg-white px-4 py-3">
          <label
            htmlFor="ppc-checkin-m"
            className="block text-xs font-medium text-muted-foreground"
          >
            Check in
          </label>
          <input
            id="ppc-checkin-m"
            type="date"
            value={checkInNative}
            min={todayStr}
            onChange={(e) => setCheckInNative(e.target.value)}
            className="w-full bg-transparent text-sm text-foreground focus:outline-none"
          />
        </div>
        <div className="flex-1 rounded-xl border border-border bg-white px-4 py-3">
          <label
            htmlFor="ppc-checkout-m"
            className="block text-xs font-medium text-muted-foreground"
          >
            Check out
          </label>
          <input
            id="ppc-checkout-m"
            type="date"
            value={checkOutNative}
            min={checkInNative || todayStr}
            onChange={(e) => setCheckOutNative(e.target.value)}
            className="w-full bg-transparent text-sm text-foreground focus:outline-none"
          />
        </div>
      </div>

      {/* Adults / Children */}
      <div className="flex gap-2">
        <div className="flex-1 rounded-xl border border-border bg-white px-4 py-3">
          <label
            htmlFor="ppc-adults"
            className="block text-xs font-medium text-muted-foreground"
          >
            Adults
          </label>
          <select
            id="ppc-adults"
            value={adults}
            onChange={(e) => setAdults(Number(e.target.value))}
            className="w-full bg-transparent text-sm text-foreground focus:outline-none"
          >
            {Array.from({ length: 16 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 rounded-xl border border-border bg-white px-4 py-3">
          <label
            htmlFor="ppc-children"
            className="block text-xs font-medium text-muted-foreground"
          >
            Children
          </label>
          <select
            id="ppc-children"
            value={children}
            onChange={(e) => setChildren(Number(e.target.value))}
            className="w-full bg-transparent text-sm text-foreground focus:outline-none"
          >
            {Array.from({ length: 7 }, (_, i) => i).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Search button */}
      <button
        onClick={handleSearch}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
      >
        <Search className="h-4 w-4" />
        Search
      </button>
    </div>
  );
}
