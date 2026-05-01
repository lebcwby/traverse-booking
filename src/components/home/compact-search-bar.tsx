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

export function CompactSearchBar() {
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
    <div className="flex items-center rounded-full border bg-white shadow-sm">
      {/* Location */}
      <div className="flex items-center gap-2 py-2 pl-4 pr-3">
        <Globe className="h-4 w-4 shrink-0 text-foreground/60" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Wherever"
          className="w-24 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
        />
      </div>

      {/* Divider */}
      <div className="h-6 w-px bg-border" />

      {/* Dates */}
      <Popover>
        <PopoverTrigger asChild>
          <button className="flex items-center gap-2 py-2 pl-3 pr-3 text-left">
            <CalendarIcon className="h-4 w-4 shrink-0 text-foreground/60" />
            <span className="text-sm text-muted-foreground">
              {dateRange?.from
                ? dateRange.to
                  ? `${format(dateRange.from, "MMM d")} – ${format(dateRange.to, "MMM d")}`
                  : format(dateRange.from, "MMM d")
                : "Whenever"}
            </span>
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
      <div className="h-6 w-px bg-border" />

      {/* Guests */}
      <div className="flex items-center gap-2 py-2 pl-3 pr-2">
        <Users2 className="h-4 w-4 shrink-0 text-foreground/60" />
        <select
          value={guests}
          onChange={(e) => setGuests(Number(e.target.value))}
          className="bg-transparent text-sm text-muted-foreground outline-none"
        >
          <option value={0}>Whoever</option>
          {Array.from({ length: 16 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n} {n === 1 ? "guest" : "guests"}
            </option>
          ))}
        </select>
      </div>

      {/* Search button */}
      <button
        onClick={handleSearch}
        className="mr-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90"
      >
        <Search className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
