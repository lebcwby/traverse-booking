"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format, addDays } from "date-fns";
import { CalendarIcon, Globe, Search, Users2 } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { DateRange } from "react-day-picker";

export function SearchBar({ className }: { className?: string }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [guests, setGuests] = useState(0);

  function handleSearch() {
    const params = new URLSearchParams();
    if (search.trim()) params.set("q", search.trim());
    if (dateRange?.from)
      params.set("checkIn", format(dateRange.from, "yyyy-MM-dd"));
    if (dateRange?.to)
      params.set("checkOut", format(dateRange.to, "yyyy-MM-dd"));
    if (guests > 0) params.set("guests", String(guests));
    router.push(`/properties?${params.toString()}`);
  }

  return (
    <div
      className={`flex items-center rounded-full bg-white shadow-lg ${className}`}
    >
      {/* Location */}
      <div className="flex flex-1 items-center gap-3 py-3 pl-6 pr-4">
        <Globe className="h-5 w-5 shrink-0 text-foreground/70" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">Location</p>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Wherever"
            className="w-full bg-transparent text-sm text-muted-foreground outline-none placeholder:text-muted-foreground"
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
        </div>
      </div>

      {/* Divider */}
      <div className="hidden h-10 w-px bg-border sm:block" />

      {/* Dates */}
      <Popover>
        <PopoverTrigger asChild>
          <button className="flex flex-1 items-center gap-3 py-3 pl-4 pr-4 text-left">
            <CalendarIcon className="h-5 w-5 shrink-0 text-foreground/70" />
            <div>
              <p className="text-sm font-medium text-foreground">Dates</p>
              <p className="text-sm text-muted-foreground">
                {dateRange?.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, "MMM d")} –{" "}
                      {format(dateRange.to, "MMM d")}
                    </>
                  ) : (
                    format(dateRange.from, "MMM d, yyyy")
                  )
                ) : (
                  "Whenever"
                )}
              </p>
            </div>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="center">
          <Calendar
            mode="range"
            selected={dateRange}
            onSelect={setDateRange}
            numberOfMonths={2}
            disabled={{ before: addDays(new Date(), 1) }}
          />
        </PopoverContent>
      </Popover>

      {/* Divider */}
      <div className="hidden h-10 w-px bg-border sm:block" />

      {/* Guests */}
      <div className="flex flex-1 items-center gap-3 py-3 pl-4 pr-2">
        <Users2 className="h-5 w-5 shrink-0 text-foreground/70" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">Guests</p>
          <select
            value={guests}
            onChange={(e) => setGuests(Number(e.target.value))}
            className="w-full bg-transparent text-sm text-muted-foreground outline-none"
          >
            <option value={0}>Whoever</option>
            {Array.from({ length: 16 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? "guest" : "guests"}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Search button */}
      <button
        onClick={handleSearch}
        className="mr-2 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90"
      >
        <Search className="h-5 w-5" />
      </button>
    </div>
  );
}
