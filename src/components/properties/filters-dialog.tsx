"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  SlidersHorizontal,
  Minus,
  Plus,
  X,
  ChevronDown,
  ChevronUp,
  PawPrint,
  Baby,
  Gem,
  Wifi,
  Tv,
  CookingPot,
  Wind,
  Snowflake,
  Thermometer,
  WashingMachine,
  Briefcase,
  Waves as HairDryerIcon,
  ShirtIcon,
  Bath,
  CircleParking,
  Dumbbell,
  Flame,
  UtensilsCrossed,
  Fence,
  type LucideIcon,
} from "lucide-react";

// ─── Amenity data with icons, grouped by category ───────────────────

interface AmenityItem {
  label: string;
  code: string;
  Icon: LucideIcon;
}

const AMENITIES_POPULAR: AmenityItem[] = [
  { label: "WiFi", code: "WIRELESS_INTERNET", Icon: Wifi },
  { label: "TV", code: "TV", Icon: Tv },
  { label: "Kitchen", code: "KITCHEN", Icon: CookingPot },
  { label: "Washer", code: "WASHER", Icon: WashingMachine },
  { label: "Dryer", code: "DRYER", Icon: Wind },
  { label: "Air conditioning", code: "AIR_CONDITIONING", Icon: Snowflake },
  { label: "Heating", code: "HEATING", Icon: Thermometer },
];

const AMENITIES_ESSENTIALS: AmenityItem[] = [
  { label: "Workspace", code: "LAPTOP_FRIENDLY_WORKSPACE", Icon: Briefcase },
  { label: "Hair dryer", code: "HAIR_DRYER", Icon: HairDryerIcon },
  { label: "Iron", code: "IRON", Icon: ShirtIcon },
  { label: "Dishwasher", code: "DISHWASHER", Icon: CookingPot },
];

const AMENITIES_FEATURES: AmenityItem[] = [
  {
    label: "Free parking",
    code: "FREE_PARKING_ON_PREMISES",
    Icon: CircleParking,
  },
  { label: "Hot tub", code: "HOT_TUB", Icon: Bath },
  { label: "Gym", code: "GYM", Icon: Dumbbell },
  { label: "BBQ grill", code: "BBQ_GRILL", Icon: UtensilsCrossed },
  { label: "Patio/Balcony", code: "PATIO_OR_BALCONY", Icon: Fence },
  { label: "Fireplace", code: "INDOOR_FIREPLACE", Icon: Flame },
];

const PROPERTY_TYPES = [
  { label: "Any type", value: "" },
  { label: "House", value: "House" },
  { label: "Apartment", value: "Apartment" },
] as const;

// ─── Counter component ─────────────────────────────────────────────

function Counter({
  label,
  value,
  onChange,
  min = 0,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <span className="text-base text-foreground">{label}</span>
      <div className="flex items-center gap-3">
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-foreground/70 transition-colors hover:border-foreground hover:text-foreground disabled:opacity-30 disabled:hover:border-border disabled:hover:text-foreground/70"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <span className="w-8 text-center text-sm font-medium text-foreground">
          {value === 0 ? "Any" : value}
        </span>
        <button
          onClick={() => onChange(value + 1)}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-foreground/70 transition-colors hover:border-foreground hover:text-foreground"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Toggle pill component ──────────────────────────────────────────

// ─── Amenity pill with icon ──────────────────────────────────────────

function AmenityPill({
  label,
  Icon,
  active,
  onClick,
}: {
  label: string;
  Icon: LucideIcon;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition-colors ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-white text-foreground hover:border-primary"
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </button>
  );
}

// ─── Price histogram ────────────────────────────────────────────────

function PriceHistogram({
  prices,
  minPrice,
  maxPrice,
  maxRange,
}: {
  prices: number[];
  minPrice: number;
  maxPrice: number;
  maxRange: number;
}) {
  const bucketCount = 30;
  const bucketSize = maxRange / bucketCount;

  const buckets = useMemo(() => {
    const b = new Array(bucketCount).fill(0);
    prices.forEach((p) => {
      const idx = Math.min(Math.floor(p / bucketSize), bucketCount - 1);
      b[idx]++;
    });
    return b;
  }, [prices, bucketSize]);

  const maxBucket = Math.max(...buckets, 1);

  return (
    <div
      className="flex h-16 items-end gap-[2px]"
      style={{ padding: "0 10px" }}
    >
      {buckets.map((count, i) => {
        const bucketStart = i * bucketSize;
        const bucketEnd = (i + 1) * bucketSize;
        const inRange = bucketEnd > minPrice && bucketStart < maxPrice;
        const height = count > 0 ? Math.max(4, (count / maxBucket) * 64) : 0;

        return (
          <div
            key={i}
            className="flex-1 rounded-t-sm transition-colors"
            style={{
              height: `${height}px`,
              backgroundColor: inRange ? "hsl(var(--accent))" : "#e5e5e5",
            }}
          />
        );
      })}
    </div>
  );
}

// ─── Recommended card tile ──────────────────────────────────────────

const RECOMMENDED_ITEMS = [
  {
    label: "Allows pets",
    Icon: PawPrint,
    color: "text-amber-700",
    type: "pets" as const,
  },
  {
    label: "Family friendly",
    Icon: Baby,
    color: "text-rose-500",
    type: "tag" as const,
    tagValue: "Family Friendly",
  },
  {
    label: "Luxury stays",
    Icon: Gem,
    color: "text-blue-600",
    type: "tag" as const,
    tagValue: "Luxury Collection",
  },
];

function RecommendedCard({
  label,
  Icon,
  color,
  active,
  onClick,
}: {
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  color: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-2.5 rounded-2xl border p-4 min-w-[110px] flex-1 transition-all ${
        active
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-border bg-white hover:border-neutral-300"
      }`}
    >
      <Icon className={`h-7 w-7 ${color}`} />
      <span className="text-xs font-medium text-foreground text-center leading-tight">
        {label}
      </span>
    </button>
  );
}

// ─── Filters content (shared between mobile & desktop) ──────────────

function FiltersContent({
  prices,
  minPrice,
  setMinPrice,
  maxPrice,
  setMaxPrice,
  maxRange,
  bedrooms,
  setBedrooms,
  beds,
  setBeds,
  bathrooms,
  setBathrooms,
  propertyType,
  setPropertyType,
  selectedAmenities,
  toggleAmenity,
  petsAllowed,
  setPetsAllowed,
  selectedTags,
  toggleTag,
}: {
  prices: number[];
  minPrice: number;
  setMinPrice: (v: number) => void;
  maxPrice: number;
  setMaxPrice: (v: number) => void;
  maxRange: number;
  bedrooms: number;
  setBedrooms: (v: number) => void;
  beds: number;
  setBeds: (v: number) => void;
  bathrooms: number;
  setBathrooms: (v: number) => void;
  propertyType: string;
  setPropertyType: (v: string) => void;
  selectedAmenities: Set<string>;
  toggleAmenity: (code: string) => void;
  petsAllowed: boolean;
  setPetsAllowed: (v: boolean) => void;
  selectedTags: Set<string>;
  toggleTag: (tag: string) => void;
}) {
  const [showMoreAmenities, setShowMoreAmenities] = useState(false);

  function isRecommendedActive(
    item: (typeof RECOMMENDED_ITEMS)[number]
  ): boolean {
    if (item.type === "pets") return petsAllowed;
    if (item.type === "tag") return selectedTags.has(item.tagValue);
    return false;
  }

  function toggleRecommended(item: (typeof RECOMMENDED_ITEMS)[number]) {
    if (item.type === "pets") setPetsAllowed(!petsAllowed);
    else if (item.type === "tag") toggleTag(item.tagValue);
  }

  return (
    <div className="space-y-0">
      {/* Recommended for you */}
      <div className="px-6 py-6">
        <h3 className="mb-4 text-lg font-semibold text-foreground">
          Recommended for you
        </h3>
        <div className="flex gap-3">
          {RECOMMENDED_ITEMS.map((item) => (
            <RecommendedCard
              key={item.label}
              label={item.label}
              Icon={item.Icon}
              color={item.color}
              active={isRecommendedActive(item)}
              onClick={() => toggleRecommended(item)}
            />
          ))}
        </div>
      </div>

      <div className="mx-6 border-t border-border" />

      {/* Property type — segmented control */}
      <div className="px-6 py-6">
        <h3 className="mb-4 text-lg font-semibold text-foreground">
          Type of place
        </h3>
        <div className="flex rounded-xl border border-border bg-muted/40 p-1">
          {PROPERTY_TYPES.map((pt) => (
            <button
              key={pt.value}
              onClick={() => setPropertyType(pt.value)}
              className={`flex-1 rounded-lg py-3 text-sm font-medium transition-all ${
                propertyType === pt.value
                  ? "bg-white text-foreground shadow-sm ring-1 ring-foreground/80"
                  : "text-foreground/70 hover:text-foreground"
              }`}
            >
              {pt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-6 border-t border-border" />

      {/* Price range */}
      <div className="px-6 py-6">
        <h3 className="mb-4 text-base font-semibold text-foreground">
          Price range
        </h3>

        {prices.length > 0 && (
          <div className="mb-2">
            <PriceHistogram
              prices={prices}
              minPrice={minPrice}
              maxPrice={maxPrice}
              maxRange={maxRange}
            />
          </div>
        )}

        {/* Dual range slider */}
        <div className="relative mb-2 h-6">
          <div className="absolute top-1/2 h-1 w-full -translate-y-1/2 rounded-full bg-border" />
          <div
            className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full"
            style={{
              backgroundColor: "hsl(var(--accent))",
              left: `${(minPrice / maxRange) * 100}%`,
              right: `${100 - (maxPrice / maxRange) * 100}%`,
            }}
          />
          <input
            type="range"
            min={0}
            max={maxRange}
            step={10}
            value={minPrice}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (v < maxPrice) setMinPrice(v);
            }}
            className="pointer-events-none absolute top-0 h-6 w-full appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-accent [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer"
            style={{ zIndex: 3 }}
          />
          <input
            type="range"
            min={0}
            max={maxRange}
            step={10}
            value={maxPrice}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (v > minPrice) setMaxPrice(v);
            }}
            className="pointer-events-none absolute top-0 h-6 w-full appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-accent [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer"
            style={{ zIndex: 4 }}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">From</span>
            <span className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground">
              ${minPrice}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">To</span>
            <span className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground">
              ${maxPrice}
              {maxPrice >= maxRange ? "+" : ""}
            </span>
          </div>
        </div>
      </div>

      <div className="mx-6 border-t border-border" />

      {/* Rooms and beds */}
      <div className="px-6 py-6">
        <h3 className="mb-2 text-base font-semibold text-foreground">
          Rooms and beds
        </h3>
        <Counter label="Bedrooms" value={bedrooms} onChange={setBedrooms} />
        <Counter label="Beds" value={beds} onChange={setBeds} />
        <Counter label="Bathrooms" value={bathrooms} onChange={setBathrooms} />
      </div>

      <div className="mx-6 border-t border-border" />

      {/* Amenities */}
      <div className="px-6 py-6">
        <h3 className="mb-4 text-base font-semibold text-foreground">
          Amenities
        </h3>

        {/* Popular — always shown */}
        <p className="mb-3 text-sm font-medium text-muted-foreground">
          Popular
        </p>
        <div className="flex flex-wrap gap-2 mb-4">
          {AMENITIES_POPULAR.map((a) => (
            <AmenityPill
              key={a.code}
              label={a.label}
              Icon={a.Icon}
              active={selectedAmenities.has(a.code)}
              onClick={() => toggleAmenity(a.code)}
            />
          ))}
        </div>

        {showMoreAmenities && (
          <>
            {/* Essentials */}
            <p className="mb-3 text-sm font-medium text-muted-foreground">
              Essentials
            </p>
            <div className="flex flex-wrap gap-2 mb-4">
              {AMENITIES_ESSENTIALS.map((a) => (
                <AmenityPill
                  key={a.code}
                  label={a.label}
                  Icon={a.Icon}
                  active={selectedAmenities.has(a.code)}
                  onClick={() => toggleAmenity(a.code)}
                />
              ))}
            </div>

            {/* Features */}
            <p className="mb-3 text-sm font-medium text-muted-foreground">
              Features
            </p>
            <div className="flex flex-wrap gap-2 mb-2">
              {AMENITIES_FEATURES.map((a) => (
                <AmenityPill
                  key={a.code}
                  label={a.label}
                  Icon={a.Icon}
                  active={selectedAmenities.has(a.code)}
                  onClick={() => toggleAmenity(a.code)}
                />
              ))}
            </div>
          </>
        )}

        <button
          onClick={() => setShowMoreAmenities(!showMoreAmenities)}
          className="mt-3 flex items-center gap-1 text-sm font-medium text-foreground underline underline-offset-4 hover:text-foreground/80"
        >
          {showMoreAmenities ? (
            <>
              Show less <ChevronUp className="h-3.5 w-3.5" />
            </>
          ) : (
            <>
              Show more <ChevronDown className="h-3.5 w-3.5" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Swipeable sheet wrapper (mobile) / modal (desktop) ─────────────

function FiltersSheet({
  onClose,
  children,
  footer,
}: {
  onClose: () => void;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startY: number } | null>(null);
  const dismissing = useRef(false);
  const [entered, setEntered] = useState(false);

  // Animate in on mount — double rAF ensures the browser has painted the
  // initial off-screen position before we trigger the transition
  useEffect(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setEntered(true));
    });
  }, []);

  // Swipe-to-dismiss: free movement to halfway, then resistance, dismiss if pushed past resistance
  const HALFWAY =
    typeof window !== "undefined" ? window.innerHeight * 0.15 : 120;
  const RESIST_ZONE = 80; // pixels of resistance after halfway before dismiss

  function onTouchStart(e: React.TouchEvent) {
    if (dismissing.current) return;
    dragRef.current = { startY: e.touches[0].clientY };
    if (sheetRef.current) {
      sheetRef.current.style.transition = "none";
      sheetRef.current.style.willChange = "transform";
    }
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!dragRef.current || dismissing.current) return;
    const dy = e.touches[0].clientY - dragRef.current.startY;

    if (dy > 0) {
      e.preventDefault();
      let visualDy: number;
      if (dy <= HALFWAY) {
        visualDy = dy;
      } else {
        const overHalf = dy - HALFWAY;
        visualDy = HALFWAY + overHalf * 0.3;
      }
      if (sheetRef.current) {
        sheetRef.current.style.transform = `translateY(${visualDy}px)`;
      }
      // Fade backdrop proportionally during drag
      if (overlayRef.current) {
        const progress = Math.min(dy / (HALFWAY + RESIST_ZONE), 1);
        overlayRef.current.style.transition = "none";
        overlayRef.current.style.backgroundColor = `rgba(0,0,0,${0.4 * (1 - progress * 0.7)})`;
      }
    }
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (!dragRef.current || dismissing.current) {
      dragRef.current = null;
      return;
    }

    const dy = e.changedTouches[0].clientY - dragRef.current.startY;
    dragRef.current = null;

    const sheet = sheetRef.current;
    if (!sheet) return;

    const matrix = new DOMMatrix(getComputedStyle(sheet).transform);
    const currentY = matrix.m42;

    if (dy > HALFWAY + RESIST_ZONE) {
      // Past resistance — smoothly slide to bottom
      dismissing.current = true;
      // Keep top at 5vh during animation — setEntered(false) would jump it to 100vh
      sheet.style.transition = "none";
      sheet.style.willChange = "";
      const remaining = window.innerHeight - currentY;
      const duration = Math.max(
        500,
        Math.min(1100, (remaining / window.innerHeight) * 1100)
      );
      const anim = sheet.animate(
        [
          { transform: `translateY(${currentY}px)`, opacity: 1, offset: 0 },
          {
            transform: `translateY(${currentY + (window.innerHeight - currentY) * 0.75}px)`,
            opacity: 1,
            offset: 0.75,
          },
          {
            transform: `translateY(${currentY + (window.innerHeight - currentY) * 0.95}px)`,
            opacity: 0,
            offset: 0.95,
          },
          {
            transform: `translateY(${window.innerHeight}px)`,
            opacity: 0,
            offset: 1,
          },
        ],
        { duration, easing: "cubic-bezier(0.32, 0.72, 0, 1)", fill: "forwards" }
      );
      // Fade backdrop immediately when dismiss animation starts
      if (overlayRef.current) {
        overlayRef.current.style.transition = `background-color ${Math.min(duration, 400)}ms ease-out`;
        overlayRef.current.style.backgroundColor = "rgba(0,0,0,0)";
      }
      setEntered(false);
      anim.onfinish = () => onClose();
    } else {
      // Snap back to top
      sheet.style.transition = "none";
      sheet.style.willChange = "";
      sheet.animate(
        [
          { transform: `translateY(${currentY}px)` },
          { transform: "translateY(0px)" },
        ],
        { duration: 250, easing: "ease-out" }
      );
      // Restore backdrop
      if (overlayRef.current) {
        overlayRef.current.style.transition = "background-color 0.2s ease-out";
        overlayRef.current.style.backgroundColor = "rgba(0,0,0,0.4)";
      }
      setTimeout(() => {
        if (sheet) {
          sheet.style.willChange = "";
          sheet.style.transform = "";
        }
      }, 260);
    }
  }

  // Content-area pull-down: only activates when scrolled to top and pulling down
  const contentDragRef = useRef<{ startY: number; activated: boolean } | null>(
    null
  );

  function onContentTouchStart(e: React.TouchEvent) {
    if (dismissing.current) return;
    // Just record — no style changes until we confirm a pull-down gesture
    contentDragRef.current = { startY: e.touches[0].clientY, activated: false };
  }

  function onContentTouchMove(e: React.TouchEvent) {
    if (!contentDragRef.current || dismissing.current) return;
    const scrollTop = scrollRef.current?.scrollTop ?? 0;
    const dy = e.touches[0].clientY - contentDragRef.current.startY;

    if (!contentDragRef.current.activated) {
      // Only take over if: scrolled to top, pulling down, past 12px dead zone
      if (dy > 12 && scrollTop <= 0) {
        contentDragRef.current.activated = true;
        contentDragRef.current.startY = e.touches[0].clientY;
        if (scrollRef.current) {
          scrollRef.current.style.overflowY = "hidden";
        }
        if (sheetRef.current) {
          sheetRef.current.style.transition = "none";
          sheetRef.current.style.willChange = "transform";
        }
      }
      return;
    }

    // Activated — move the sheet (same resistance model as handle)
    const pullDy = e.touches[0].clientY - contentDragRef.current.startY;
    if (pullDy > 0) {
      e.preventDefault();
      let visualDy: number;
      if (pullDy <= HALFWAY) {
        visualDy = pullDy;
      } else {
        const overHalf = pullDy - HALFWAY;
        visualDy = HALFWAY + overHalf * 0.3;
      }
      if (sheetRef.current) {
        sheetRef.current.style.transform = `translateY(${visualDy}px)`;
      }
      // Fade backdrop proportionally during drag
      if (overlayRef.current) {
        const progress = Math.min(pullDy / (HALFWAY + RESIST_ZONE), 1);
        overlayRef.current.style.transition = "none";
        overlayRef.current.style.backgroundColor = `rgba(0,0,0,${0.4 * (1 - progress * 0.7)})`;
      }
    }
  }

  function onContentTouchEnd(e: React.TouchEvent) {
    if (!contentDragRef.current || dismissing.current) {
      contentDragRef.current = null;
      return;
    }

    const wasActivated = contentDragRef.current.activated;
    const dy = wasActivated
      ? e.changedTouches[0].clientY - contentDragRef.current.startY
      : 0;
    contentDragRef.current = null;

    // Restore scroll
    if (scrollRef.current) {
      scrollRef.current.style.overflowY = "auto";
    }

    if (!wasActivated) return;

    // Reuse same dismiss/snap logic as handle
    const sheet = sheetRef.current;
    if (!sheet) return;

    const matrix = new DOMMatrix(getComputedStyle(sheet).transform);
    const currentY = matrix.m42;

    if (dy > HALFWAY + RESIST_ZONE) {
      dismissing.current = true;
      sheet.style.transition = "none";
      sheet.style.willChange = "";
      const remaining = window.innerHeight - currentY;
      const duration = Math.max(
        500,
        Math.min(1100, (remaining / window.innerHeight) * 1100)
      );
      const anim = sheet.animate(
        [
          { transform: `translateY(${currentY}px)`, opacity: 1, offset: 0 },
          {
            transform: `translateY(${currentY + (window.innerHeight - currentY) * 0.75}px)`,
            opacity: 1,
            offset: 0.75,
          },
          {
            transform: `translateY(${currentY + (window.innerHeight - currentY) * 0.95}px)`,
            opacity: 0,
            offset: 0.95,
          },
          {
            transform: `translateY(${window.innerHeight}px)`,
            opacity: 0,
            offset: 1,
          },
        ],
        { duration, easing: "cubic-bezier(0.32, 0.72, 0, 1)", fill: "forwards" }
      );
      // Fade backdrop immediately when dismiss animation starts
      if (overlayRef.current) {
        overlayRef.current.style.transition = `background-color ${Math.min(duration, 400)}ms ease-out`;
        overlayRef.current.style.backgroundColor = "rgba(0,0,0,0)";
      }
      setEntered(false);
      anim.onfinish = () => onClose();
    } else {
      sheet.style.transition = "none";
      sheet.style.willChange = "";
      sheet.animate(
        [
          { transform: `translateY(${currentY}px)` },
          { transform: "translateY(0px)" },
        ],
        { duration: 250, easing: "ease-out" }
      );
      // Restore backdrop
      if (overlayRef.current) {
        overlayRef.current.style.transition = "background-color 0.2s ease-out";
        overlayRef.current.style.backgroundColor = "rgba(0,0,0,0.4)";
      }
      setTimeout(() => {
        if (sheet) {
          sheet.style.willChange = "";
          sheet.style.transform = "";
        }
      }, 260);
    }
  }

  function animateClose() {
    if (dismissing.current) return;
    dismissing.current = true;
    if (sheetRef.current) {
      sheetRef.current.style.transform = "";
      sheetRef.current.style.transition =
        "top 0.5s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.45s ease-out";
      sheetRef.current.style.top = "100vh";
      sheetRef.current.style.opacity = "0.3";
    }
    // Fade backdrop immediately
    if (overlayRef.current) {
      overlayRef.current.style.transition = "background-color 0.35s ease-out";
      overlayRef.current.style.backgroundColor = "rgba(0,0,0,0)";
    }
    setEntered(false);
    setTimeout(onClose, 500);
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] md:flex md:items-center md:justify-center transition-colors duration-400"
      style={{ backgroundColor: entered ? "rgba(0,0,0,0.4)" : "rgba(0,0,0,0)" }}
      onClick={animateClose}
    >
      {/* Mobile: 95% height card pinned to bottom / Desktop: centered modal */}
      <div
        ref={sheetRef}
        className="absolute inset-x-0 bottom-0 flex flex-col rounded-t-2xl bg-white shadow-2xl md:static md:relative md:max-h-[85vh] md:max-w-lg md:rounded-2xl md:inset-auto"
        style={{
          top: dismissing.current ? "5vh" : entered ? "5vh" : "100vh",
          transition: dismissing.current
            ? "none"
            : "top 0.45s cubic-bezier(0.32, 0.72, 0, 1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle + header — only this area triggers swipe-to-dismiss */}
        <div
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {/* Drag handle (mobile) */}
          <div className="flex justify-center pt-2 pb-0 md:hidden">
            <div className="h-1 w-10 rounded-full bg-neutral-300" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-6 py-4 shrink-0">
            <button
              onClick={animateClose}
              className="text-foreground/60 hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
            <h2 className="text-base font-semibold text-foreground">Filters</h2>
            <div className="w-5" />
          </div>
        </div>

        {/* Scrollable body — pull down from top to dismiss */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto overscroll-contain"
          onTouchStart={onContentTouchStart}
          onTouchMove={onContentTouchMove}
          onTouchEnd={onContentTouchEnd}
        >
          {children}
        </div>

        {/* Fixed footer */}
        {footer}
      </div>
    </div>
  );
}

// ─── Main FiltersDialog ─────────────────────────────────────────────

export function FiltersDialog({ prices = [] }: { prices?: number[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  // Scale max range to actual highest price so histogram fills the full width
  const maxRange = prices.length > 0 ? Math.max(...prices) : 2600;

  // Initialize state from URL params
  const [minPrice, setMinPrice] = useState(
    Number(searchParams.get("minPrice")) || 100
  );
  const [maxPrice, setMaxPrice] = useState(
    Number(searchParams.get("maxPrice")) || maxRange
  );
  const [bedrooms, setBedrooms] = useState(
    Number(searchParams.get("bedrooms")) || 0
  );
  const [beds, setBeds] = useState(Number(searchParams.get("beds")) || 0);
  const [bathrooms, setBathrooms] = useState(
    Number(searchParams.get("bathrooms")) || 0
  );
  const [petsAllowed, setPetsAllowed] = useState(
    searchParams.get("pets") === "true"
  );
  const [propertyType, setPropertyType] = useState(
    searchParams.get("propertyType") || ""
  );
  const [selectedAmenities, setSelectedAmenities] = useState<Set<string>>(
    () => {
      const param = searchParams.get("amenities");
      return param ? new Set(param.split(",")) : new Set();
    }
  );
  const [selectedTags, setSelectedTags] = useState<Set<string>>(() => {
    const tags = searchParams.getAll("filterTag");
    return new Set(tags);
  });

  const toggleAmenity = useCallback((code: string) => {
    setSelectedAmenities((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }, []);

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }, []);

  const handleConfirm = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());

    // Price
    if (minPrice > 100) params.set("minPrice", String(minPrice));
    else params.delete("minPrice");
    if (maxPrice < maxRange) params.set("maxPrice", String(maxPrice));
    else params.delete("maxPrice");

    // Rooms
    if (bedrooms > 0) params.set("bedrooms", String(bedrooms));
    else params.delete("bedrooms");
    if (beds > 0) params.set("beds", String(beds));
    else params.delete("beds");
    if (bathrooms > 0) params.set("bathrooms", String(bathrooms));
    else params.delete("bathrooms");

    // Pets
    if (petsAllowed) params.set("pets", "true");
    else params.delete("pets");

    // Property type
    if (propertyType) params.set("propertyType", propertyType);
    else params.delete("propertyType");

    // Amenities
    if (selectedAmenities.size > 0)
      params.set("amenities", Array.from(selectedAmenities).join(","));
    else params.delete("amenities");

    // Tags (filterTag — separate from the location tag)
    params.delete("filterTag");
    selectedTags.forEach((t) => params.append("filterTag", t));

    router.push(`/properties?${params.toString()}`);
    setOpen(false);
  }, [
    searchParams,
    minPrice,
    maxPrice,
    maxRange,
    bedrooms,
    beds,
    bathrooms,
    petsAllowed,
    propertyType,
    selectedAmenities,
    selectedTags,
    router,
  ]);

  const handleClear = () => {
    setMinPrice(100);
    setMaxPrice(maxRange);
    setBedrooms(0);
    setBeds(0);
    setBathrooms(0);
    setPetsAllowed(false);
    setPropertyType("");
    setSelectedAmenities(new Set());
    setSelectedTags(new Set());
  };

  const activeCount = [
    minPrice > 100,
    maxPrice < maxRange,
    bedrooms > 0,
    beds > 0,
    bathrooms > 0,
    petsAllowed,
    propertyType !== "",
    selectedAmenities.size > 0,
    selectedTags.size > 0,
  ].filter(Boolean).length;

  const contentProps = {
    prices,
    minPrice,
    setMinPrice,
    maxPrice,
    setMaxPrice,
    maxRange,
    bedrooms,
    setBedrooms,
    beds,
    setBeds,
    bathrooms,
    setBathrooms,
    propertyType,
    setPropertyType,
    selectedAmenities,
    toggleAmenity,
    petsAllowed,
    setPetsAllowed,
    selectedTags,
    toggleTag,
  };

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="relative inline-flex shrink-0 items-center justify-center rounded-full border border-border bg-white shadow-sm transition-colors hover:bg-muted h-8 w-8 md:h-auto md:w-auto md:gap-2 md:px-4 md:py-2"
      >
        <SlidersHorizontal className="h-4 w-4" />
        <span className="hidden md:inline text-sm font-medium text-foreground">
          Filters
        </span>
        {activeCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground md:static md:h-5 md:w-5 md:text-[10px]">
            {activeCount}
          </span>
        )}
      </button>

      {/* Dialog overlay */}
      {open && (
        <FiltersSheet
          onClose={() => setOpen(false)}
          footer={
            <div className="flex items-center justify-between border-t border-border px-6 py-4 shrink-0">
              <button
                onClick={handleClear}
                className="text-sm font-medium text-foreground underline underline-offset-4 hover:text-foreground/80"
              >
                Clear all
              </button>
              <button
                onClick={handleConfirm}
                className="rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Show places
              </button>
            </div>
          }
        >
          <FiltersContent {...contentProps} />
        </FiltersSheet>
      )}
    </>
  );
}
