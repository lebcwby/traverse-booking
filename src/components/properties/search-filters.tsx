"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useCallback } from "react";
import { format, addDays } from "date-fns";
import { CalendarIcon, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateRange } from "react-day-picker";

export function SearchFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const checkIn = searchParams.get("checkIn");
    const checkOut = searchParams.get("checkOut");
    return checkIn && checkOut
      ? {
          from: new Date(checkIn + "T12:00:00"),
          to: new Date(checkOut + "T12:00:00"),
        }
      : undefined;
  });
  const [guests, setGuests] = useState(searchParams.get("guests") || "");
  const [bedrooms, setBedrooms] = useState(searchParams.get("bedrooms") || "");
  const [propertyType, setPropertyType] = useState(
    searchParams.get("propertyType") || ""
  );

  const applyFilters = useCallback(() => {
    const params = new URLSearchParams();
    if (dateRange?.from)
      params.set("checkIn", format(dateRange.from, "yyyy-MM-dd"));
    if (dateRange?.to)
      params.set("checkOut", format(dateRange.to, "yyyy-MM-dd"));
    if (guests) params.set("guests", guests);
    if (bedrooms) params.set("bedrooms", bedrooms);
    if (propertyType) params.set("propertyType", propertyType);
    router.push(`/properties?${params.toString()}`);
  }, [dateRange, guests, bedrooms, propertyType, router]);

  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Dates
          </label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-start text-left font-normal"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange?.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, "MMM d")} -{" "}
                      {format(dateRange.to, "MMM d")}
                    </>
                  ) : (
                    format(dateRange.from, "MMM d, yyyy")
                  )
                ) : (
                  <span className="text-muted-foreground">Any dates</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={dateRange}
                onSelect={setDateRange}
                numberOfMonths={2}
                disabled={{ before: addDays(new Date(), 1) }}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="w-full sm:w-36">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Guests
          </label>
          <Select value={guests} onValueChange={setGuests}>
            <SelectTrigger>
              <SelectValue placeholder="Any" />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 16 }, (_, i) => i + 1).map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}+ guests
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-full sm:w-36">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Bedrooms
          </label>
          <Select value={bedrooms} onValueChange={setBedrooms}>
            <SelectTrigger>
              <SelectValue placeholder="Any" />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4, 5].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}+ bedrooms
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-full sm:w-40">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Property Type
          </label>
          <Select value={propertyType} onValueChange={setPropertyType}>
            <SelectTrigger>
              <SelectValue placeholder="Any" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="House">House</SelectItem>
              <SelectItem value="Apartment">Apartment</SelectItem>
              <SelectItem value="Condominium">Condominium</SelectItem>
              <SelectItem value="Townhouse">Townhouse</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={applyFilters}
          className="h-10 gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Search className="h-4 w-4" />
          Search
        </Button>
      </div>
    </div>
  );
}
