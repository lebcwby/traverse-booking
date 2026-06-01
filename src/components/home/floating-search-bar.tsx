"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import {
  format,
  parse,
  addDays,
  addMonths,
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
import {
  CalendarIcon,
  ChevronLeft,
  Globe,
  MapPin,
  Minus,
  Plus,
  Search,
  Users2,
  X,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { getLandingPagePath } from "@/lib/landing-page-paths";
import { DateRange } from "react-day-picker";

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function GuestCounter({
  label,
  subtitle,
  value,
  onChange,
  min = 0,
}: {
  label: string;
  subtitle: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
}) {
  return (
    <div className="flex items-center justify-between py-4">
      <div>
        <div className="text-sm font-medium text-foreground">{label}</div>
        <div className="text-xs text-muted-foreground">{subtitle}</div>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-foreground/70 transition-colors hover:bg-muted disabled:opacity-30"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <span className="w-6 text-center text-sm font-medium text-foreground">
          {value}
        </span>
        <button
          onClick={() => onChange(value + 1)}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-foreground/70 transition-colors hover:bg-muted"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

function MobileScrollCalendar({
  dateRange,
  onSelect,
  onComplete,
}: {
  dateRange: DateRange | undefined;
  onSelect: (range: DateRange | undefined) => void;
  onComplete?: () => void;
}) {
  const [pickingCheckout, setPickingCheckout] = useState(false);
  const localFrom = dateRange?.from;
  const localTo = dateRange?.to;
  const scrollRef = useRef<HTMLDivElement>(null);
  const checkinMonthRef = useRef<HTMLDivElement>(null);

  const monthCount = useMemo(() => {
    if (!localFrom) return 12;
    const today = new Date();
    const diffMonths =
      (localFrom.getFullYear() - today.getFullYear()) * 12 +
      (localFrom.getMonth() - today.getMonth());
    return Math.max(12, diffMonths + 3);
  }, [localFrom]);

  const months = useMemo(() => {
    const result: { month: Date; days: Date[] }[] = [];
    const today = new Date();
    for (let i = 0; i < monthCount; i++) {
      const monthDate = addMonths(today, i);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);
      const calStart = startOfWeek(monthStart);
      const calEnd = endOfWeek(monthEnd);
      const days = eachDayOfInterval({ start: calStart, end: calEnd });
      result.push({ month: monthDate, days });
    }
    return result;
  }, [monthCount]);

  useEffect(() => {
    if (localFrom && checkinMonthRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const el = checkinMonthRef.current;
      const offset = el.offsetTop - container.offsetTop - 16;
      container.scrollTop = offset;
    }
  }, [localFrom]);

  const isInRange = useCallback(
    (date: Date) => {
      if (!localFrom || !localTo) return false;
      return date > localFrom && date < localTo;
    },
    [localFrom, localTo]
  );

  const isDayDisabled = useCallback((date: Date) => {
    const yesterday = addDays(new Date(), 0);
    yesterday.setHours(0, 0, 0, 0);
    return isBefore(date, yesterday);
  }, []);

  const handleDayClick = useCallback(
    (date: Date) => {
      if (isDayDisabled(date)) return;

      if (!pickingCheckout) {
        onSelect({ from: date, to: undefined });
        setPickingCheckout(true);
      } else if (localFrom) {
        if (date.getTime() <= localFrom.getTime()) {
          onSelect({ from: date, to: undefined });
          return;
        }
        onSelect({ from: localFrom, to: date });
        setPickingCheckout(false);
        if (onComplete) setTimeout(() => onComplete(), 300);
      }
    },
    [pickingCheckout, localFrom, isDayDisabled, onSelect, onComplete]
  );

  return (
    <div className="flex flex-1 flex-col min-h-0 border-t border-border">
      {/* Sticky weekday header */}
      <div className="shrink-0 border-b border-border px-5 py-2">
        <div className="grid grid-cols-7 text-center">
          {WEEKDAYS.map((day, i) => (
            <span key={i} className="text-xs font-medium text-muted-foreground">
              {day}
            </span>
          ))}
        </div>
      </div>

      {/* Scrollable months */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 pb-4">
        {months.map(({ month, days }) => {
          const isCheckinMonth = localFrom && isSameMonth(month, localFrom);
          return (
            <div
              key={format(month, "yyyy-MM")}
              ref={isCheckinMonth ? checkinMonthRef : undefined}
              className="mt-5"
            >
              <h3 className="mb-2 text-base font-bold">
                {format(month, "MMMM yyyy")}
              </h3>
              <div className="grid grid-cols-7 gap-y-0.5">
                {days.map((day, i) => {
                  const inMonth = isSameMonth(day, month);
                  if (!inMonth) return <div key={i} />;

                  const disabled = isDayDisabled(day);
                  const isStart = localFrom && isSameDay(day, localFrom);
                  const isEnd = localTo && isSameDay(day, localTo);
                  const inRange = isInRange(day);

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
                        <div className="absolute inset-y-0 left-1/2 right-0 bg-muted" />
                      )}
                      {isEnd && localFrom && (
                        <div className="absolute inset-y-0 left-0 right-1/2 bg-muted" />
                      )}

                      <button
                        onClick={() => handleDayClick(day)}
                        disabled={disabled}
                        className={`relative z-[1] flex h-10 w-10 items-center justify-center rounded-full text-sm transition-colors
                        ${isStart || isEnd ? "bg-primary text-primary-foreground font-semibold" : ""}
                        ${inRange ? "text-foreground" : ""}
                        ${!isStart && !isEnd && !inRange && isToday(day) ? "font-semibold text-primary" : ""}
                        ${disabled ? "text-muted-foreground/40" : ""}
                        ${!disabled && !isStart && !isEnd && !inRange ? "hover:bg-muted" : ""}
                      `}
                      >
                        {day.getDate()}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const DESTINATIONS = [
  { city: "Crested Butte", label: "Crested Butte, CO", subtitle: "70+ properties" },
  { city: "Leadville", label: "Leadville, CO", subtitle: "70+ properties" },
  { city: "Twin Lakes", label: "Twin Lakes, CO", subtitle: "14ers & alpine lakes" },
  { city: "Vail", label: "Vail, CO", subtitle: "Rentals available" },
  { city: "Avon", label: "Avon, CO", subtitle: "Near Beaver Creek" },
  { city: "Granby", label: "Granby, CO", subtitle: "Near Winter Park" },
] as const;

export const CB_BUILDINGS = [
  { tag: "The Grand Lodge Crested Butte", label: "Grand Lodge Crested Butte" },
  { tag: "The Plaza Crested Butte", label: "The Plaza Condominiums" },
  { tag: "The Lodge at Mountaineer Square", label: "Lodge at Mountaineer Square" },
] as const;

export const LV_CATEGORIES = [
  { tag: "Grand West Village Resort", label: "Grand West Village" },
  { tag: "OSV", label: "Old St Vincent's" },
  { tag: "cabin", label: "Cabin Rentals" },
] as const;

const TAG_LABELS: Record<string, string> = Object.fromEntries([
  ...DESTINATIONS.map((d) => [d.city, d.label]),
  ...CB_BUILDINGS.map((n) => [n.tag, n.label]),
  ...LV_CATEGORIES.map((n) => [n.tag, n.label]),
  ["Pet Friendly", "Pet-Friendly"],
  ["Luxury Collection", "Luxury"],
  ["Group Getaways", "Large Groups"],
  ["Family Friendly", "Family-Friendly"],
  ["Extended Stay", "Extended Stay"],
  ["Budget Friendly", "Budget-Friendly"],
  ["Mt.Hood", "Mt. Hood"],
  ["NW Pomeroy", "The Pomeroy"],
]);

export function FloatingSearchBar({
  compact = false,
  desktopOnly = false,
  initialTag,
  children,
}: {
  compact?: boolean;
  desktopOnly?: boolean;
  initialTag?: string;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(() => {
    const q = searchParams.get("q");
    if (q) return q;
    const tag = searchParams.get("tag") || initialTag;
    if (tag && TAG_LABELS[tag]) return TAG_LABELS[tag];
    const city = searchParams.get("city");
    if (city) return city;
    return "";
  });
  const [suggestions, setSuggestions] = useState<{
    cities: string[];
    listings: string[];
    landingPages: { title: string; slug: string }[];
  }>({ cities: [], listings: [], landingPages: [] });
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [locationFocused, setLocationFocused] = useState(false);
  const suggestionsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const checkIn = searchParams.get("checkIn");
    const checkOut = searchParams.get("checkOut");
    if (checkIn && checkOut) {
      return {
        from: parse(checkIn, "yyyy-MM-dd", new Date()),
        to: parse(checkOut, "yyyy-MM-dd", new Date()),
      };
    }
    return undefined;
  });
  const [adults, setAdults] = useState(() => {
    const g = searchParams.get("guests");
    return g ? Number(g) : 0;
  });
  const [childCount, setChildCount] = useState(0);
  const [pets, setPets] = useState(0);

  const fetchSuggestions = useCallback((q: string) => {
    if (suggestionsTimer.current) clearTimeout(suggestionsTimer.current);
    if (q.length < 2) {
      setSuggestions({ cities: [], listings: [], landingPages: [] });
      return;
    }
    suggestionsTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search-suggestions?q=${encodeURIComponent(q)}`
        );
        if (res.ok) {
          const data = await res.json();
          setSuggestions({
            cities: data.cities || [],
            listings: data.listings || [],
            landingPages: data.landingPages || [],
          });
          setShowSuggestions(
            data.cities?.length > 0 ||
              data.listings?.length > 0 ||
              data.landingPages?.length > 0
          );
        }
      } catch {
        // Non-critical
      }
    }, 50);
  }, []);
  const [selectedTag, setSelectedTag] = useState(
    () => searchParams.get("tag") || initialTag || ""
  );
  const [selectedCity, setSelectedCity] = useState(
    () => searchParams.get("city") || ""
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileSection, setMobileSection] = useState<
    "where" | "when" | "who" | null
  >(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [pendingRange, setPendingRange] = useState<DateRange | undefined>();
  const placeholderRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);
  const [phase, setPhase] = useState<"inline" | "fixed">(
    compact ? "fixed" : "inline"
  );
  const [morphT, setMorphT] = useState(compact ? 1 : 0);
  const [mounted, setMounted] = useState(false);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  // Guard against browser auto-focus triggering location dropdown on page load
  const hasUserInteracted = useRef(false);

  useEffect(() => setMounted(true), []);

  // Mobile pill is always pinned to top on home page, hidden on compact (search results) pages
  const mobilePinned = !compact;

  const totalGuests = adults + childCount;

  // Track where the bar detaches so we can morph smoothly
  const detachScrollY = useRef<number | null>(null);

  useEffect(() => {
    if (compact) return;

    function handleScroll() {
      if (!placeholderRef.current) return;

      const scrollY = window.scrollY;
      const rect = placeholderRef.current.getBoundingClientRect();
      const isDesktop = window.innerWidth >= 768;
      const detachPoint = isDesktop ? 90 : 74; // headerBottom (80 or 64) + 10

      if (rect.top <= detachPoint) {
        // Bar should be fixed in header
        if (detachScrollY.current === null) {
          detachScrollY.current = scrollY;
        }
        if (phaseRef.current !== "fixed") setPhase("fixed");

        const extraScroll = scrollY - detachScrollY.current;
        const morphRange = 200;
        const raw = Math.max(0, Math.min(1, extraScroll / morphRange));
        setMorphT(easeOutCubic(raw));
      } else {
        // Bar should be inline in hero
        if (phaseRef.current !== "inline") {
          detachScrollY.current = null;
          setPhase("inline");
          setMorphT(0);
        }
      }
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [compact]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      // Check if click is inside the bar or the location dropdown
      if (barRef.current && !barRef.current.contains(target)) {
        // Don't unfocus if clicking inside a popover (portaled outside the bar)
        const popover = (target as Element).closest?.(
          "[data-radix-popper-content-wrapper]"
        );
        if (popover) return;
        // Also check if clicking inside a location dropdown (which is inside the bar but may be outside barRef if ref switched)
        const locationDropdown = (target as Element).closest?.(
          "[data-location-dropdown]"
        );
        if (locationDropdown) return;
        setFocused(false);
        setShowSuggestions(false);
        setLocationFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function doSearch() {
    const params = new URLSearchParams();
    if (selectedCity) params.set("city", selectedCity);
    else if (selectedTag) params.set("tag", selectedTag);
    else if (search.trim()) params.set("q", search.trim());
    if (dateRange?.from)
      params.set("checkIn", format(dateRange.from, "yyyy-MM-dd"));
    if (dateRange?.to)
      params.set("checkOut", format(dateRange.to, "yyyy-MM-dd"));
    if (totalGuests > 0) params.set("guests", String(totalGuests));
    if (pets > 0) params.set("pets", "true");
    setMobileOpen(false);
    setMobileSection(null);
    setDesktopExpanded(false);
    setFocused(false);
    router.push(`/properties?${params.toString()}`);
  }

  function guestSummary() {
    if (totalGuests === 0 && pets === 0) return "Guests";
    const parts: string[] = [];
    if (totalGuests > 0)
      parts.push(`${totalGuests} guest${totalGuests !== 1 ? "s" : ""}`);
    if (pets > 0) parts.push(`${pets} pet${pets !== 1 ? "s" : ""}`);
    return parts.join(", ");
  }

  // Dimensions interpolated by morph progress
  const maxWidth = lerp(720, 460, morphT);
  const height = lerp(58, 42, morphT);
  const padY = lerp(10, 6, morphT);
  const padLeft = lerp(22, 14, morphT);
  const iconSz = lerp(19, 15, morphT);
  const btnSz = lerp(44, 30, morphT);
  const btnIconSz = lerp(18, 13, morphT);
  const fSz = lerp(13.5, 12.5, morphT);
  const shadow =
    morphT > 0.5 ? "0 1px 6px rgba(0,0,0,0.1)" : "0 4px 20px rgba(0,0,0,0.15)";

  const bar = (
    <div
      ref={barRef}
      className="inline-flex items-center rounded-full bg-white"
      onFocus={() => setFocused(true)}
      style={{
        height: `${height}px`,
        boxShadow: shadow,
      }}
    >
      {/* Fixed-width content area (button reserves ~110px) */}
      <div
        className="flex items-center"
        style={{ width: `${maxWidth - 110}px` }}
      >
        {/* Location */}
        <Popover
          open={locationFocused && phase === "inline"}
          onOpenChange={(open) => {
            setLocationFocused(open);
            if (open) {
              setShowSuggestions(true);
              setCalendarOpen(false);
            } else {
              setShowSuggestions(false);
            }
          }}
        >
          <PopoverTrigger asChild>
            <div
              className="flex flex-1 items-center gap-2 cursor-text"
              style={{
                paddingLeft: `${padLeft}px`,
                paddingTop: `${padY}px`,
                paddingBottom: `${padY}px`,
              }}
            >
              <Globe
                style={{ width: iconSz, height: iconSz }}
                className="shrink-0 text-foreground/70"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  hasUserInteracted.current = true;
                  setSearch(e.target.value);
                  fetchSuggestions(e.target.value);
                }}
                onFocus={() => {
                  if (!hasUserInteracted.current) return;
                  setLocationFocused(true);
                  setShowSuggestions(true);
                  if (search.length >= 2) fetchSuggestions(search);
                }}
                onClick={() => {
                  hasUserInteracted.current = true;
                  setLocationFocused(true);
                  setShowSuggestions(true);
                  if (search.length >= 2) fetchSuggestions(search);
                }}
                placeholder="Search Destinations"
                style={{ fontSize: `${fSz}px` }}
                className="w-full min-w-0 bg-transparent leading-snug text-foreground outline-none placeholder:text-muted-foreground"
                onKeyDown={(e) => {
                  hasUserInteracted.current = true;
                  if (e.key === "Enter") {
                    setShowSuggestions(false);
                    setLocationFocused(false);
                    doSearch();
                  }
                  if (e.key === "Escape") {
                    setShowSuggestions(false);
                    setLocationFocused(false);
                  }
                }}
              />
            </div>
          </PopoverTrigger>
          <PopoverContent
            className="z-[100] w-96 p-0"
            align="start"
            side="bottom"
            sideOffset={12}
            avoidCollisions={false}
          >
            <div className="py-2">
              {showSuggestions &&
              (suggestions.cities.length > 0 ||
                suggestions.listings.length > 0 ||
                suggestions.landingPages.length > 0) ? (
                <>
                  {suggestions.landingPages.map((page) => (
                    <a
                      key={`lp-${page.slug}`}
                      href={getLandingPagePath(page.slug)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-muted"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/20">
                        <Search className="h-4 w-4 text-foreground/70" />
                      </div>
                      <span className="truncate font-medium">{page.title}</span>
                    </a>
                  ))}
                  {suggestions.cities.map((city) => (
                    <button
                      key={`city-${city}`}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-muted"
                      onClick={() => {
                        setSearch(city);
                        setSelectedCity(city);
                        setSelectedTag("");
                        setShowSuggestions(false);
                        setLocationFocused(false);
                        setSuggestions({
                          cities: [],
                          listings: [],
                          landingPages: [],
                        });
                      }}
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                        <MapPin className="h-4 w-4 text-foreground/70" />
                      </div>
                      <span className="truncate font-medium">{city}</span>
                    </button>
                  ))}
                  {suggestions.listings.map((name) => (
                    <button
                      key={`listing-${name}`}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-muted"
                      onClick={() => {
                        setSearch(name);
                        setShowSuggestions(false);
                        setLocationFocused(false);
                        setSuggestions({
                          cities: [],
                          listings: [],
                          landingPages: [],
                        });
                      }}
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                        <Globe className="h-4 w-4 text-foreground/70" />
                      </div>
                      <span className="truncate">{name}</span>
                    </button>
                  ))}
                </>
              ) : (
                <>
                  <p className="px-4 pb-1 pt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Colorado Markets
                  </p>
                  {DESTINATIONS.map((dest) => (
                    <button
                      key={dest.city}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-muted"
                      onClick={() => {
                        setSearch(dest.label);
                        setSelectedCity(dest.city);
                        setSelectedTag("");
                        setShowSuggestions(false);
                        setLocationFocused(false);
                      }}
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                        <MapPin className="h-4 w-4 text-foreground/70" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{dest.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {dest.subtitle}
                        </p>
                      </div>
                    </button>
                  ))}
                  <p className="px-4 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Slopeside Buildings in Crested Butte
                  </p>
                  {CB_BUILDINGS.map((hood) => (
                    <button
                      key={hood.tag}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-muted"
                      onClick={() => {
                        setSearch(hood.label);
                        setSelectedCity("");
                        setSelectedTag(hood.tag);
                        setShowSuggestions(false);
                        setLocationFocused(false);
                      }}
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                        <MapPin className="h-4 w-4 text-foreground/70" />
                      </div>
                      <p className="text-sm font-medium">{hood.label}</p>
                    </button>
                  ))}
                  <p className="px-4 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Leadville Categories
                  </p>
                  {LV_CATEGORIES.map((hood) => (
                    <button
                      key={hood.tag}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-muted"
                      onClick={() => {
                        setSearch(hood.label);
                        setSelectedCity("");
                        setSelectedTag(hood.tag);
                        setShowSuggestions(false);
                        setLocationFocused(false);
                      }}
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                        <MapPin className="h-4 w-4 text-foreground/70" />
                      </div>
                      <p className="text-sm font-medium">{hood.label}</p>
                    </button>
                  ))}
                </>
              )}
            </div>
          </PopoverContent>
        </Popover>

        <div className="h-1/2 w-px shrink-0 bg-border" />

        {/* Dates — only open popover when inline bar is visible (not when fixed/expanded) */}
        <Popover
          open={calendarOpen && phase === "inline"}
          onOpenChange={(open) => {
            setCalendarOpen(open);
            if (open) {
              setPendingRange(dateRange);
              setShowSuggestions(false);
              setLocationFocused(false);
            }
          }}
        >
          <PopoverTrigger asChild>
            <button
              className="flex flex-1 items-center gap-2 text-left"
              style={{ padding: `${padY}px 10px` }}
              onClick={() => setFocused(true)}
            >
              <CalendarIcon
                style={{ width: iconSz, height: iconSz }}
                className="shrink-0 text-foreground/70"
              />
              <span
                style={{ fontSize: `${fSz}px` }}
                className="whitespace-nowrap leading-snug text-muted-foreground"
              >
                {dateRange?.from
                  ? dateRange.to
                    ? `${format(dateRange.from, "MMM d")} – ${format(dateRange.to, "MMM d")}`
                    : format(dateRange.from, "MMM d")
                  : "Dates"}
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="z-[100] w-auto p-0"
            align="center"
            side="bottom"
            sideOffset={12}
            avoidCollisions={false}
          >
            <div className="p-4 pb-0">
              <Calendar
                mode="range"
                selected={pendingRange}
                onSelect={(range) => {
                  setPendingRange(range);
                  setDateRange(range);
                }}
                numberOfMonths={2}
                disabled={{ before: addDays(new Date(), 1) }}
                showOutsideDays={false}
                className="[--cell-size:2.75rem]"
                classNames={{
                  months: "relative flex flex-col gap-4 md:flex-row",
                  month: "flex w-full flex-col gap-4",
                  month_caption: "flex h-10 w-full items-center justify-center",
                  caption_label: "text-base font-semibold",
                  nav: "absolute inset-x-0 top-0 flex w-full items-center justify-between",
                  weekdays: "flex w-full",
                  weekday:
                    "flex-1 text-center text-xs font-medium text-muted-foreground uppercase tracking-wide",
                  week: "mt-1 flex w-full",
                  day: "group/day relative flex-1 aspect-square select-none p-0 text-center text-sm [&:first-child[data-selected=true]_button]:rounded-l-md [&:last-child[data-selected=true]_button]:rounded-r-md",
                }}
              />
            </div>
            <div className="flex items-center justify-end border-t border-border px-4 py-3">
              <button
                onClick={() => {
                  setPendingRange(undefined);
                  setDateRange(undefined);
                }}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                Clear dates
              </button>
            </div>
          </PopoverContent>
        </Popover>

        <div className="h-1/2 w-px shrink-0 bg-border" />

        {/* Guests */}
        <Popover
          onOpenChange={(open) => {
            if (open) {
              setShowSuggestions(false);
              setLocationFocused(false);
            }
          }}
        >
          <PopoverTrigger asChild>
            <button
              className="flex flex-1 items-center gap-2 text-left"
              style={{ padding: `${padY}px 6px ${padY}px 10px` }}
              onClick={() => setFocused(true)}
            >
              <Users2
                style={{ width: iconSz, height: iconSz }}
                className="shrink-0 text-foreground/70"
              />
              <span
                style={{ fontSize: `${fSz}px` }}
                className="whitespace-nowrap leading-snug text-muted-foreground"
              >
                {guestSummary()}
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="z-[100] w-[280px] p-4" align="end">
            <GuestCounter
              label="Adults"
              subtitle="Age 13+"
              value={adults}
              onChange={setAdults}
            />
            <div className="border-t border-border" />
            <GuestCounter
              label="Children"
              subtitle="Ages 2–12"
              value={childCount}
              onChange={setChildCount}
            />
            <div className="border-t border-border" />
            <GuestCounter
              label="Pets"
              subtitle=""
              value={pets}
              onChange={setPets}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Search button — pill with icon + label, brand-aligned to /no-fees
          (forest green, matches the Search button on the home page bar). */}
      <button
        onClick={doSearch}
        className="mr-1.5 flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-[#2d3e2c] text-white transition-colors duration-200 hover:bg-[#384e36]"
        style={{
          height: `${btnSz}px`,
          paddingLeft: "14px",
          paddingRight: "16px",
        }}
      >
        <Search
          className="shrink-0"
          style={{ width: btnIconSz, height: btnIconSz }}
        />
        <span className="whitespace-nowrap text-sm font-semibold">Search</span>
      </button>
    </div>
  );

  const mobilePill = (
    <button
      onClick={openMobile}
      className="flex w-full items-center gap-3 rounded-full bg-white py-1.5 pl-1.5 pr-6 shadow-lg transition-shadow hover:shadow-xl"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary">
        <Search className="h-4 w-4 text-primary-foreground" />
      </div>
      <span className="flex-1 text-center text-sm font-medium text-muted-foreground">
        Start your search
      </span>
    </button>
  );

  function openMobile() {
    setMobileSection("where");
    setMobileOpen(true);
  }

  function dateSummary() {
    if (!dateRange?.from) return "Anytime";
    if (!dateRange.to) return format(dateRange.from, "MMM d");
    return `${format(dateRange.from, "MMM d")} – ${format(dateRange.to, "MMM d")}`;
  }

  function mobileClear() {
    setSearch("");
    setSelectedCity("");
    setSelectedTag("");
    setDateRange(undefined);
    setAdults(0);
    setChildCount(0);
    setPets(0);
    setSuggestions({ cities: [], listings: [], landingPages: [] });
  }

  const mobileOverlay =
    mobileOpen && mounted
      ? createPortal(
          <div className="fixed inset-0 z-[100] flex flex-col bg-background md:hidden animate-[fadeIn_0.2s_ease-out]">
            {/* Header */}
            <div className="flex items-center justify-center px-4 py-4 relative">
              <h2 className="text-lg font-semibold">Search</h2>
              <button
                onClick={() => {
                  setMobileOpen(false);
                  setMobileSection(null);
                }}
                className="absolute right-4 flex h-8 w-8 items-center justify-center rounded-full border border-border hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Card rows */}
            <div
              className={`flex-1 flex flex-col gap-3 px-5 pb-4 ${mobileSection === "when" || mobileSection === "where" ? "overflow-hidden" : "overflow-y-auto"}`}
            >
              {/* Where */}
              <div
                className={`overflow-hidden rounded-2xl border border-border bg-white ${mobileSection === "where" ? "flex flex-1 flex-col min-h-0" : ""}`}
              >
                <button
                  onClick={() =>
                    setMobileSection(mobileSection === "where" ? null : "where")
                  }
                  className="flex w-full items-center gap-4 px-5 py-4 shrink-0"
                >
                  {mobileSection !== "where" && (
                    <MapPin className="h-5 w-5 shrink-0 text-foreground/60" />
                  )}
                  <span
                    className={`font-medium text-foreground ${mobileSection === "where" ? "text-xl" : "text-[15px]"}`}
                  >
                    {mobileSection === "where" ? "Where?" : "Where"}
                  </span>
                  {mobileSection !== "where" && (
                    <span className="ml-auto text-[15px] text-foreground/80">
                      {search.trim() || "Anywhere"}
                    </span>
                  )}
                </button>
                {mobileSection === "where" && (
                  <div className="flex flex-1 flex-col min-h-0 border-t border-border px-5 pb-4 pt-3">
                    <div className="relative shrink-0">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input
                        type="text"
                        value={search}
                        onChange={(e) => {
                          setSearch(e.target.value);
                          setSelectedCity("");
                          setSelectedTag("");
                          fetchSuggestions(e.target.value);
                        }}
                        onFocus={() => {
                          setLocationFocused(true);
                          setShowSuggestions(true);
                          if (search.length >= 2) fetchSuggestions(search);
                        }}
                        placeholder="Search markets"
                        className="w-full rounded-xl border bg-muted/50 py-3 pl-10 pr-4 text-base outline-none focus:border-primary"
                      />
                    </div>
                    {showSuggestions &&
                    locationFocused &&
                    (suggestions.cities.length > 0 ||
                      suggestions.listings.length > 0 ||
                      suggestions.landingPages.length > 0) ? (
                      <div className="mt-3 flex-1 overflow-y-auto">
                        {suggestions.landingPages.map((page) => (
                          <a
                            key={`m-lp-${page.slug}`}
                            href={getLandingPagePath(page.slug)}
                            className="flex w-full items-center gap-3 px-1 py-3 text-left hover:bg-muted rounded-lg"
                          >
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/20">
                              <Search className="h-5 w-5 text-foreground/70" />
                            </div>
                            <span className="text-[15px] font-medium">
                              {page.title}
                            </span>
                          </a>
                        ))}
                        {suggestions.cities.map((city) => (
                          <button
                            key={`m-city-${city}`}
                            className="flex w-full items-center gap-3 px-1 py-3 text-left hover:bg-muted rounded-lg"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setSearch(city);
                              setSelectedCity(city);
                              setSelectedTag("");
                              setShowSuggestions(false);
                              setLocationFocused(false);
                              setSuggestions({
                                cities: [],
                                listings: [],
                                landingPages: [],
                              });
                              setMobileSection("when");
                            }}
                          >
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted">
                              <MapPin className="h-5 w-5 text-foreground/70" />
                            </div>
                            <span className="text-[15px] font-medium">
                              {city}
                            </span>
                          </button>
                        ))}
                        {suggestions.listings.map((name) => (
                          <button
                            key={`m-listing-${name}`}
                            className="flex w-full items-center gap-3 px-1 py-3 text-left hover:bg-muted rounded-lg"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setSearch(name);
                              setShowSuggestions(false);
                              setLocationFocused(false);
                              setSuggestions({
                                cities: [],
                                listings: [],
                                landingPages: [],
                              });
                              setMobileSection("when");
                            }}
                          >
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted">
                              <Globe className="h-5 w-5 text-foreground/70" />
                            </div>
                            <span className="text-[15px]">{name}</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-3 flex-1 overflow-y-auto">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                          Colorado Markets
                        </p>
                        {DESTINATIONS.map((dest) => (
                          <button
                            key={dest.city}
                            className="flex w-full items-center gap-3 px-1 py-3 text-left active:bg-muted rounded-lg"
                            onClick={() => {
                              setSearch(dest.label);
                              setSelectedCity(dest.city);
                              setSelectedTag("");
                              setMobileSection("when");
                            }}
                          >
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted">
                              <MapPin className="h-5 w-5 text-foreground/70" />
                            </div>
                            <div>
                              <p className="text-[15px] font-medium">
                                {dest.label}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {dest.subtitle}
                              </p>
                            </div>
                          </button>
                        ))}
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-4 mb-2">
                          Slopeside Buildings in Crested Butte
                        </p>
                        {CB_BUILDINGS.map((hood) => (
                          <button
                            key={hood.tag}
                            className="flex w-full items-center gap-3 px-1 py-3 text-left active:bg-muted rounded-lg"
                            onClick={() => {
                              setSearch(hood.label);
                              setSelectedCity("");
                              setSelectedTag(hood.tag);
                              setMobileSection("when");
                            }}
                          >
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted">
                              <MapPin className="h-5 w-5 text-foreground/70" />
                            </div>
                            <p className="text-[15px] font-medium">
                              {hood.label}
                            </p>
                          </button>
                        ))}
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-4 mb-2">
                          Leadville Categories
                        </p>
                        {LV_CATEGORIES.map((hood) => (
                          <button
                            key={hood.tag}
                            className="flex w-full items-center gap-3 px-1 py-3 text-left active:bg-muted rounded-lg"
                            onClick={() => {
                              setSearch(hood.label);
                              setSelectedCity("");
                              setSelectedTag(hood.tag);
                              setMobileSection("when");
                            }}
                          >
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted">
                              <MapPin className="h-5 w-5 text-foreground/70" />
                            </div>
                            <p className="text-[15px] font-medium">
                              {hood.label}
                            </p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* When */}
              <div
                className={`overflow-hidden rounded-2xl border border-border bg-white ${mobileSection === "when" ? "flex flex-1 flex-col min-h-0" : ""}`}
              >
                <button
                  onClick={() =>
                    setMobileSection(mobileSection === "when" ? null : "when")
                  }
                  className="flex w-full items-center gap-4 px-5 py-4 shrink-0"
                >
                  <CalendarIcon className="h-5 w-5 shrink-0 text-foreground/60" />
                  <span className="text-[15px] font-medium text-foreground">
                    {mobileSection === "when" ? "When?" : "When"}
                  </span>
                  <span className="ml-auto text-[15px] text-foreground/80">
                    {dateSummary()}
                  </span>
                </button>
                {mobileSection === "when" && (
                  <MobileScrollCalendar
                    dateRange={dateRange}
                    onSelect={setDateRange}
                  />
                )}
              </div>

              {/* Who — hidden while picking dates */}
              {mobileSection !== "when" && (
                <div className="overflow-hidden rounded-2xl border border-border bg-white">
                  <button
                    onClick={() =>
                      setMobileSection(mobileSection === "who" ? null : "who")
                    }
                    className="flex w-full items-center gap-4 px-5 py-5"
                  >
                    <Users2 className="h-5 w-5 shrink-0 text-foreground/60" />
                    <span className="text-[15px] font-medium text-foreground">
                      {mobileSection === "who" ? "Who?" : "Who"}
                    </span>
                    <span className="ml-auto text-[15px] text-foreground/80">
                      {totalGuests === 0 && pets === 0
                        ? "Anyone"
                        : guestSummary()}
                    </span>
                  </button>
                  {mobileSection === "who" && (
                    <div className="border-t border-border px-5 pb-3">
                      <GuestCounter
                        label="Adults"
                        subtitle="Age 13+"
                        value={adults}
                        onChange={setAdults}
                      />
                      <div className="border-t border-border" />
                      <GuestCounter
                        label="Children"
                        subtitle="Ages 2–12"
                        value={childCount}
                        onChange={setChildCount}
                      />
                      <div className="border-t border-border" />
                      <GuestCounter
                        label="Pets"
                        subtitle=""
                        value={pets}
                        onChange={setPets}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bottom bar */}
            <div className="border-t border-border px-5 py-4 flex items-center gap-3">
              <button
                onClick={mobileClear}
                className="flex-1 rounded-xl border border-border py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
              >
                Clear
              </button>
              <button
                onClick={() => {
                  if (mobileSection === "when") {
                    setMobileSection("who");
                  } else {
                    doSearch();
                  }
                }}
                className="flex-1 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                {mobileSection === "when" ? "Next" : "Search"}
              </button>
            </div>
          </div>,
          document.body
        )
      : null;

  // Build a compact summary for the mobile pill on results pages
  const compactSummary = useMemo(() => {
    if (!compact) return null;
    const parts: string[] = [];
    if (search.trim()) {
      parts.push(search.trim());
    }
    if (dateRange?.from) {
      parts.push(
        dateRange.to
          ? `${format(dateRange.from, "MMM d")} – ${format(dateRange.to, "MMM d")}`
          : format(dateRange.from, "MMM d")
      );
    }
    if (totalGuests > 0) {
      parts.push(`${totalGuests} guest${totalGuests !== 1 ? "s" : ""}`);
    }
    return parts.length > 0 ? parts.join(" · ") : null;
  }, [compact, search, dateRange, totalGuests]);

  const compactMobilePill = (
    <button
      onClick={openMobile}
      className="flex flex-1 items-center gap-2.5 rounded-full bg-white py-1.5 pl-1.5 pr-4 shadow-lg transition-shadow hover:shadow-xl"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary">
        <Search className="h-3.5 w-3.5 text-primary-foreground" />
      </div>
      <span className="truncate text-sm font-medium text-foreground">
        {compactSummary || "Start your search"}
      </span>
    </button>
  );

  // Desktop expanded state for compact mode — clicking compact bar opens full-size bar
  const [desktopExpanded, setDesktopExpanded] = useState(false);
  const expandedRef = useRef<HTMLDivElement>(null);
  // Which section to auto-open when expanding: "location" | "dates" | "guests" | null
  const pendingSection = useRef<"location" | "dates" | "guests" | null>(null);

  function expandTo(section: "location" | "dates" | "guests") {
    pendingSection.current = section;
    setDesktopExpanded(true);
    setFocused(true);
    setLocationFocused(false);
    setCalendarOpen(false);
    if (section === "location") {
      setTimeout(() => {
        pendingSection.current = null;
        setLocationFocused(true);
        setShowSuggestions(true);
      }, 100);
    } else if (section === "dates") {
      setTimeout(() => {
        pendingSection.current = null;
        setCalendarOpen(true);
      }, 150);
    } else if (section === "guests") {
      setTimeout(() => {
        pendingSection.current = null;
        const guestBtn = expandedRef.current?.querySelector<HTMLButtonElement>(
          "[data-guest-trigger]"
        );
        guestBtn?.click();
      }, 150);
    }
  }

  function collapseDesktop() {
    setDesktopExpanded(false);
    setFocused(false);
    setShowSuggestions(false);
    setLocationFocused(false);
  }

  // No longer expanding the header — the expanded bar overlays content below it

  useEffect(() => {
    if (!desktopExpanded) return;
    // Lock body scroll while expanded
    document.body.style.overflow = "hidden";
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      // Don't collapse if clicking inside expanded bar or a popover
      if (expandedRef.current?.contains(target)) return;
      // Target may have been removed from DOM (e.g. location dropdown closing),
      // check if it's still connected to the document
      if (!document.contains(target)) return;
      const popover = (target as Element).closest?.(
        "[data-radix-popper-content-wrapper]"
      );
      if (popover) return;
      collapseDesktop();
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") collapseDesktop();
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [desktopExpanded]);

  // Full-size bar for expanded state
  const expandedBar = (
    <div
      ref={barRef}
      className="inline-flex items-center rounded-full bg-white"
      onFocus={() => setFocused(true)}
      style={{
        height: "58px",
        boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
      }}
    >
      <div className="flex items-center" style={{ width: "670px" }}>
        {/* Location */}
        <div
          className="relative flex flex-1 items-center gap-2 overflow-visible"
          style={{
            paddingLeft: "22px",
            paddingTop: "10px",
            paddingBottom: "10px",
          }}
        >
          <Globe
            style={{ width: 19, height: 19 }}
            className="shrink-0 text-foreground/70"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              fetchSuggestions(e.target.value);
            }}
            onFocus={() => {
              // Only open location dropdown if we're not opening dates or guests
              if (
                pendingSection.current &&
                pendingSection.current !== "location"
              )
                return;
              setLocationFocused(true);
              setShowSuggestions(true);
              if (search.length >= 2) fetchSuggestions(search);
            }}
            placeholder="Search Destinations"
            style={{ fontSize: "13.5px" }}
            className="w-full min-w-0 bg-transparent leading-snug text-foreground outline-none placeholder:text-muted-foreground"
            autoFocus={desktopExpanded && pendingSection.current === "location"}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setShowSuggestions(false);
                setLocationFocused(false);
                setDesktopExpanded(false);
                doSearch();
              }
              if (e.key === "Escape") {
                setShowSuggestions(false);
                setLocationFocused(false);
                setDesktopExpanded(false);
              }
            }}
          />
          {locationFocused && (
            <div className="absolute left-0 top-full z-[100] mt-2 w-96 overflow-hidden rounded-xl border border-border bg-white py-2 shadow-lg">
              {showSuggestions &&
              (suggestions.cities.length > 0 ||
                suggestions.listings.length > 0 ||
                suggestions.landingPages.length > 0) ? (
                <>
                  {suggestions.landingPages.map((page) => (
                    <a
                      key={`lp-${page.slug}`}
                      href={getLandingPagePath(page.slug)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-muted"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/20">
                        <Search className="h-4 w-4 text-foreground/70" />
                      </div>
                      <span className="truncate font-medium">{page.title}</span>
                    </a>
                  ))}
                  {suggestions.cities.map((city) => (
                    <button
                      key={`city-${city}`}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-muted"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setSearch(city);
                        setSelectedCity(city);
                        setSelectedTag("");
                        setShowSuggestions(false);
                        setLocationFocused(false);
                        setSuggestions({
                          cities: [],
                          listings: [],
                          landingPages: [],
                        });
                      }}
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                        <MapPin className="h-4 w-4 text-foreground/70" />
                      </div>
                      <span className="truncate font-medium">{city}</span>
                    </button>
                  ))}
                  {suggestions.listings.map((name) => (
                    <button
                      key={`listing-${name}`}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-muted"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setSearch(name);
                        setShowSuggestions(false);
                        setLocationFocused(false);
                        setSuggestions({
                          cities: [],
                          listings: [],
                          landingPages: [],
                        });
                      }}
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                        <Globe className="h-4 w-4 text-foreground/70" />
                      </div>
                      <span className="truncate">{name}</span>
                    </button>
                  ))}
                </>
              ) : (
                <>
                  <p className="px-4 pb-1 pt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Colorado Markets
                  </p>
                  {DESTINATIONS.map((dest) => (
                    <button
                      key={dest.city}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-muted"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setSearch(dest.label);
                        setSelectedCity(dest.city);
                        setSelectedTag("");
                        setShowSuggestions(false);
                        setLocationFocused(false);
                      }}
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                        <MapPin className="h-4 w-4 text-foreground/70" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{dest.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {dest.subtitle}
                        </p>
                      </div>
                    </button>
                  ))}
                  <p className="px-4 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Slopeside Buildings in Crested Butte
                  </p>
                  {CB_BUILDINGS.map((hood) => (
                    <button
                      key={hood.tag}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-muted"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setSearch(hood.label);
                        setSelectedCity("");
                        setSelectedTag(hood.tag);
                        setShowSuggestions(false);
                        setLocationFocused(false);
                      }}
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                        <MapPin className="h-4 w-4 text-foreground/70" />
                      </div>
                      <p className="text-sm font-medium">{hood.label}</p>
                    </button>
                  ))}
                  <p className="px-4 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Leadville Categories
                  </p>
                  {LV_CATEGORIES.map((hood) => (
                    <button
                      key={hood.tag}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-muted"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setSearch(hood.label);
                        setSelectedCity("");
                        setSelectedTag(hood.tag);
                        setShowSuggestions(false);
                        setLocationFocused(false);
                      }}
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                        <MapPin className="h-4 w-4 text-foreground/70" />
                      </div>
                      <p className="text-sm font-medium">{hood.label}</p>
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        <div className="h-1/2 w-px shrink-0 bg-border" />

        {/* Dates */}
        <Popover
          open={calendarOpen}
          onOpenChange={(open) => {
            setCalendarOpen(open);
            if (open) {
              setPendingRange(dateRange);
              setShowSuggestions(false);
              setLocationFocused(false);
            }
          }}
        >
          <PopoverTrigger asChild>
            <button
              className="flex flex-1 items-center gap-2 text-left"
              style={{ padding: "10px 10px" }}
              onClick={() => setFocused(true)}
            >
              <CalendarIcon
                style={{ width: 19, height: 19 }}
                className="shrink-0 text-foreground/70"
              />
              <span
                style={{ fontSize: "13.5px" }}
                className="whitespace-nowrap leading-snug text-muted-foreground"
              >
                {dateRange?.from
                  ? dateRange.to
                    ? `${format(dateRange.from, "MMM d")} – ${format(dateRange.to, "MMM d")}`
                    : format(dateRange.from, "MMM d")
                  : "Dates"}
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="z-[100] w-auto p-0"
            align="center"
            side="bottom"
            sideOffset={12}
            avoidCollisions={false}
          >
            <div className="p-4 pb-0">
              <Calendar
                mode="range"
                selected={pendingRange}
                onSelect={(range) => {
                  setPendingRange(range);
                  setDateRange(range);
                }}
                numberOfMonths={2}
                disabled={{ before: addDays(new Date(), 1) }}
                showOutsideDays={false}
                className="[--cell-size:2.75rem]"
                classNames={{
                  months: "relative flex flex-col gap-4 md:flex-row",
                  month: "flex w-full flex-col gap-4",
                  month_caption: "flex h-10 w-full items-center justify-center",
                  caption_label: "text-base font-semibold",
                  nav: "absolute inset-x-0 top-0 flex w-full items-center justify-between",
                  weekdays: "flex w-full",
                  weekday:
                    "flex-1 text-center text-xs font-medium text-muted-foreground uppercase tracking-wide",
                  week: "mt-1 flex w-full",
                  day: "group/day relative flex-1 aspect-square select-none p-0 text-center text-sm [&:first-child[data-selected=true]_button]:rounded-l-md [&:last-child[data-selected=true]_button]:rounded-r-md",
                }}
              />
            </div>
            <div className="flex items-center justify-end border-t border-border px-4 py-3">
              <button
                onClick={() => {
                  setPendingRange(undefined);
                  setDateRange(undefined);
                }}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                Clear dates
              </button>
            </div>
          </PopoverContent>
        </Popover>

        <div className="h-1/2 w-px shrink-0 bg-border" />

        {/* Guests */}
        <Popover
          onOpenChange={(open) => {
            if (open) {
              setShowSuggestions(false);
              setLocationFocused(false);
            }
          }}
        >
          <PopoverTrigger asChild>
            <button
              data-guest-trigger
              className="flex flex-1 items-center gap-2 text-left"
              style={{ padding: "10px 6px 10px 10px" }}
              onClick={() => setFocused(true)}
            >
              <Users2
                style={{ width: 19, height: 19 }}
                className="shrink-0 text-foreground/70"
              />
              <span
                style={{ fontSize: "13.5px" }}
                className="whitespace-nowrap leading-snug text-muted-foreground"
              >
                {guestSummary()}
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="z-[100] w-[280px] p-4" align="end">
            <GuestCounter
              label="Adults"
              subtitle="Age 13+"
              value={adults}
              onChange={setAdults}
            />
            <div className="border-t border-border" />
            <GuestCounter
              label="Children"
              subtitle="Ages 2–12"
              value={childCount}
              onChange={setChildCount}
            />
            <div className="border-t border-border" />
            <GuestCounter
              label="Pets"
              subtitle=""
              value={pets}
              onChange={setPets}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Search button */}
      <button
        onClick={() => {
          doSearch();
        }}
        className="mr-1.5 flex shrink-0 items-center justify-center gap-1 rounded-full bg-primary text-primary-foreground transition-all duration-300 ease-in-out hover:bg-primary/90"
        style={{ height: "44px", width: "96px" }}
      >
        <Search className="shrink-0" style={{ width: 18, height: 18 }} />
        <span className="text-sm font-medium">Search</span>
      </button>
    </div>
  );

  if (compact) {
    if (!mounted) return null;
    return (
      <>
        {createPortal(
          <div
            className="pointer-events-none fixed inset-x-0 z-[80]"
            style={{ top: 0 }}
          >
            {/* Mobile: back arrow + search pill + filter button */}
            {!desktopOnly && (
              <div
                className="pointer-events-none flex flex-1 items-center gap-2 pl-2 pr-4 md:hidden [&>*]:pointer-events-auto bg-white"
                style={{ height: "64px" }}
              >
                <button
                  onClick={() => window.history.back()}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-foreground/70 active:bg-black/5 transition-colors"
                  aria-label="Go back"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                {compactMobilePill}
                {children}
              </div>
            )}

            {/* Desktop: compact bar in header row, expands below on click */}
            <div className="hidden md:block pointer-events-none">
              {/* Compact bar + filter button always in header row */}
              <div
                className="pointer-events-none flex items-center justify-center gap-3 pl-14 pr-14"
                style={{
                  height: "80px",
                  opacity: desktopExpanded ? 0 : 1,
                  transition: "opacity 0.2s ease-out",
                }}
              >
                <div
                  className="pointer-events-auto inline-flex items-center rounded-full bg-white"
                  style={{
                    height: `${height}px`,
                    boxShadow: shadow,
                    maxWidth: `${maxWidth}px`,
                    width: "100%",
                  }}
                >
                  <div
                    className="flex flex-1 items-center"
                    style={{ padding: `${padY}px 0 ${padY}px ${padLeft}px` }}
                  >
                    <button
                      onClick={() => expandTo("location")}
                      className="flex flex-1 items-center justify-center gap-2 hover:opacity-70 transition-opacity"
                    >
                      <Globe
                        style={{ width: iconSz, height: iconSz }}
                        className="shrink-0 text-foreground/70"
                      />
                      <span
                        className="text-foreground"
                        style={{ fontSize: `${fSz}px` }}
                      >
                        {search.trim() || "Location"}
                      </span>
                    </button>
                    <div className="mx-2 h-4 w-px bg-border" />
                    <button
                      onClick={() => expandTo("dates")}
                      className="flex flex-1 items-center justify-center gap-2 hover:opacity-70 transition-opacity"
                    >
                      <CalendarIcon
                        style={{ width: iconSz, height: iconSz }}
                        className="shrink-0 text-foreground/70"
                      />
                      <span
                        className="text-muted-foreground"
                        style={{ fontSize: `${fSz}px` }}
                      >
                        {dateRange?.from
                          ? dateRange.to
                            ? `${format(dateRange.from, "MMM d")} – ${format(dateRange.to, "MMM d")}`
                            : format(dateRange.from, "MMM d")
                          : "Dates"}
                      </span>
                    </button>
                    <div className="mx-2 h-4 w-px bg-border" />
                    <button
                      onClick={() => expandTo("guests")}
                      className="flex flex-1 items-center justify-center gap-2 hover:opacity-70 transition-opacity"
                    >
                      <Users2
                        style={{ width: iconSz, height: iconSz }}
                        className="shrink-0 text-foreground/70"
                      />
                      <span
                        className="text-muted-foreground"
                        style={{ fontSize: `${fSz}px` }}
                      >
                        {guestSummary()}
                      </span>
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={doSearch}
                    aria-label="Search properties"
                    className="mr-1.5 flex shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90"
                    style={{ height: `${btnSz}px`, width: `${btnSz}px` }}
                  >
                    <Search style={{ width: btnIconSz, height: btnIconSz }} />
                  </button>
                </div>
                {children && (
                  <div className="pointer-events-auto">{children}</div>
                )}
              </div>

              {/* Expanded full-size bar — overlays content below header */}
              <div
                ref={expandedRef}
                className="pointer-events-auto absolute inset-x-0 flex items-center justify-center bg-white shadow-md"
                style={{
                  top: "0px",
                  height: "84px",
                  opacity: desktopExpanded ? 1 : 0,
                  transform: desktopExpanded
                    ? "translateY(0)"
                    : "translateY(-8px)",
                  transition: "opacity 0.2s ease-out, transform 0.2s ease-out",
                  pointerEvents: desktopExpanded ? "auto" : "none",
                }}
              >
                {desktopExpanded && expandedBar}
              </div>
            </div>

            {!desktopOnly && mobileOverlay}
          </div>,
          document.body
        )}
        {desktopExpanded &&
          createPortal(
            <div
              className="fixed inset-0 hidden md:block animate-[fadeIn_0.15s_ease-out]"
              style={{
                top: "84px",
                zIndex: 60,
                backgroundColor: "rgba(0,0,0,0.15)",
              }}
              onClick={collapseDesktop}
            />,
            document.body
          )}
      </>
    );
  }

  return (
    <>
      {/* Placeholder — reserves space when bar/pill detaches */}
      <div ref={placeholderRef} className="relative z-[80]">
        {/* Mobile pill is always fixed at top — no inline pill in hero */}

        {/* Desktop bar — always rendered to maintain consistent height */}
        <div
          className="mx-auto hidden md:flex"
          style={{
            width: "720px",
            opacity: phase === "inline" ? 1 : 0,
            pointerEvents: phase === "inline" ? "auto" : "none",
            transition: "opacity 0.15s ease-out",
          }}
        >
          {bar}
        </div>
      </div>

      {mobileOverlay}

      {/* Mobile pill — fixed to header when scrolled past hero */}
      {mounted &&
        createPortal(
          <div
            className="fixed left-4 right-4 z-[90] flex justify-center md:hidden"
            style={{
              top: "10px",
              opacity: mobilePinned ? 1 : 0,
              transform: mobilePinned ? "scale(1)" : "scale(0.95)",
              transition: mobilePinned
                ? "opacity 0.3s ease-out, transform 0.3s ease-out"
                : "opacity 0.3s ease-out, transform 0.3s ease-out",
              pointerEvents: mobilePinned ? "auto" : "none",
            }}
          >
            {mobilePill}
          </div>,
          document.body
        )}

      {/* Fixed desktop bar — sticks to header on scroll, click to expand */}
      {mounted &&
        createPortal(
          <div
            className="pointer-events-none fixed inset-x-0 z-[80] hidden md:block"
            style={{
              top: 0,
              opacity: phase === "fixed" ? 1 : 0,
              transition: "opacity 0.15s ease-out",
            }}
          >
            {/* Compact clickable pill */}
            <div
              className="pointer-events-none flex items-center justify-center px-14"
              style={{
                height: "80px",
                opacity: desktopExpanded ? 0 : 1,
                transition: "opacity 0.2s ease-out",
              }}
            >
              <div
                className="pointer-events-auto inline-flex items-center rounded-full bg-white"
                style={{
                  height: `${height}px`,
                  boxShadow: shadow,
                  maxWidth: `${maxWidth}px`,
                  width: "100%",
                }}
              >
                <div
                  className="flex flex-1 items-center"
                  style={{ padding: `${padY}px 0 ${padY}px ${padLeft}px` }}
                >
                  <button
                    onClick={() => expandTo("location")}
                    className="flex flex-1 items-center justify-center gap-2 hover:opacity-70 transition-opacity"
                  >
                    <Globe
                      style={{ width: iconSz, height: iconSz }}
                      className="shrink-0 text-foreground/70"
                    />
                    <span
                      className="text-foreground"
                      style={{ fontSize: `${fSz}px` }}
                    >
                      {search.trim() || "Location"}
                    </span>
                  </button>
                  <div className="mx-2 h-4 w-px bg-border" />
                  <button
                    onClick={() => expandTo("dates")}
                    className="flex flex-1 items-center justify-center gap-2 hover:opacity-70 transition-opacity"
                  >
                    <CalendarIcon
                      style={{ width: iconSz, height: iconSz }}
                      className="shrink-0 text-foreground/70"
                    />
                    <span
                      className="text-muted-foreground"
                      style={{ fontSize: `${fSz}px` }}
                    >
                      {dateRange?.from
                        ? dateRange.to
                          ? `${format(dateRange.from, "MMM d")} – ${format(dateRange.to, "MMM d")}`
                          : format(dateRange.from, "MMM d")
                        : "Dates"}
                    </span>
                  </button>
                  <div className="mx-2 h-4 w-px bg-border" />
                  <button
                    onClick={() => expandTo("guests")}
                    className="flex flex-1 items-center justify-center gap-2 hover:opacity-70 transition-opacity"
                  >
                    <Users2
                      style={{ width: iconSz, height: iconSz }}
                      className="shrink-0 text-foreground/70"
                    />
                    <span
                      className="text-muted-foreground"
                      style={{ fontSize: `${fSz}px` }}
                    >
                      {guestSummary()}
                    </span>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={doSearch}
                  aria-label="Search properties"
                  className="mr-1.5 flex shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90"
                  style={{ height: `${btnSz}px`, width: `${btnSz}px` }}
                >
                  <Search style={{ width: btnIconSz, height: btnIconSz }} />
                </button>
              </div>
            </div>

            {/* Expanded full-size bar — overlays content below header */}
            <div
              ref={expandedRef}
              className="pointer-events-auto absolute inset-x-0 flex items-center justify-center bg-white shadow-md"
              style={{
                top: "0px",
                height: "84px",
                opacity: desktopExpanded ? 1 : 0,
                transform: desktopExpanded
                  ? "translateY(0)"
                  : "translateY(-8px)",
                transition: "opacity 0.2s ease-out, transform 0.2s ease-out",
                pointerEvents: desktopExpanded ? "auto" : "none",
              }}
            >
              {desktopExpanded && expandedBar}
            </div>
          </div>,
          document.body
        )}
      {phase === "fixed" &&
        desktopExpanded &&
        mounted &&
        createPortal(
          <div
            className="fixed inset-0 hidden md:block animate-[fadeIn_0.15s_ease-out]"
            style={{
              top: "84px",
              zIndex: 60,
              backgroundColor: "rgba(0,0,0,0.15)",
            }}
            onClick={collapseDesktop}
          />,
          document.body
        )}
    </>
  );
}
