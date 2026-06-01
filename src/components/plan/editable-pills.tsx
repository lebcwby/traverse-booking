"use client";
// src/components/plan/editable-pills.tsx
// Clickable trip-meta pills for the itinerary header. Each pill opens a
// popover with an editor for that field; on confirm we fire a refinement
// message via onRefine() and the agent re-runs generate_itinerary.

import { useEffect, useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";
import { Calendar as CalendarIcon, Minus, Plus } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { formatNeighborhood } from "@/lib/plan/neighborhood-match";
import type { Itinerary, Vibe } from "@/lib/plan/schema";

const PILL_BASE =
  "inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-[11.5px] text-neutral-600 transition hover:border-neutral-300 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2b4a4e]/40 disabled:cursor-not-allowed disabled:opacity-60 data-[state=open]:border-[#2b4a4e] data-[state=open]:text-neutral-900";

interface BasePillProps {
  busy?: boolean;
}

// ─────────────────────────────────────────────────────────────────────
// DatePill — calendar range picker. Replaces both the date pill AND the
// "N nights" pill (collapsed into one — nights derive from the range).
// ─────────────────────────────────────────────────────────────────────

interface DatePillProps extends BasePillProps {
  itinerary: Itinerary;
  onRefine: (prompt: string) => void;
}

export function DatePill({ itinerary, onRefine, busy }: DatePillProps) {
  const [open, setOpen] = useState(false);
  const initial = useMemo<DateRange | undefined>(() => {
    if (itinerary.dates.isTentative) return undefined;
    const from = isoToDate(itinerary.dates.checkIn);
    const to = isoToDate(itinerary.dates.checkOut);
    if (!from || !to) return undefined;
    return { from, to };
  }, [itinerary.dates]);
  const [range, setRange] = useState<DateRange | undefined>(initial);
  const [pickingCheckout, setPickingCheckout] = useState(false);

  useEffect(() => {
    if (open) {
      setRange(initial);
      setPickingCheckout(false);
    }
  }, [open, initial]);

  function handleSelect(_range: DateRange | undefined, clicked: Date) {
    if (!pickingCheckout) {
      setRange({ from: clicked, to: undefined });
      setPickingCheckout(true);
      return;
    }
    const checkin = range?.from;
    if (checkin && clicked.getTime() > checkin.getTime()) {
      setRange({ from: checkin, to: clicked });
      setPickingCheckout(false);
    } else {
      setRange({ from: clicked, to: undefined });
    }
  }

  const nights =
    range?.from && range?.to ? nightsBetween(range.from, range.to) : 0;
  const canApply = !!range?.from && !!range?.to && nights >= 1;

  const triggerLabel = itinerary.dates.isTentative
    ? `${itinerary.dates.nights} night${itinerary.dates.nights === 1 ? "" : "s"} (flexible)`
    : `${formatShortRange(itinerary.dates.checkIn, itinerary.dates.checkOut)} · ${itinerary.dates.nights} night${itinerary.dates.nights === 1 ? "" : "s"}`;

  function apply() {
    if (!canApply || !range?.from || !range?.to) return;
    const from = dateToIso(range.from);
    const to = dateToIso(range.to);
    const n = nightsBetween(range.from, range.to);
    onRefine(
      `Refine this plan: change my trip dates to ${formatShortRange(from, to)} (${from} to ${to}, ${n} night${n === 1 ? "" : "s"}). Keep the rest of the trip the same.`
    );
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className={PILL_BASE} disabled={busy}>
        <CalendarIcon className="h-3 w-3 text-neutral-500" />
        {triggerLabel}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex flex-col">
          <Calendar
            mode="range"
            selected={range}
            onSelect={handleSelect}
            numberOfMonths={1}
            showOutsideDays={false}
            disabled={{ before: new Date() }}
            defaultMonth={range?.from ?? new Date()}
          />
          <div className="flex items-center justify-between gap-3 border-t border-neutral-200 px-3 py-2.5">
            <span className="text-[12.5px] text-neutral-600">
              {nights > 0
                ? `${nights} night${nights === 1 ? "" : "s"}`
                : range?.from
                  ? "Pick a check-out"
                  : "Pick a check-in and check-out"}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full px-3 py-1.5 text-[12.5px] text-neutral-600 hover:text-neutral-900"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={apply}
                disabled={!canApply}
                className="rounded-full bg-[#2b4a4e] px-3.5 py-1.5 text-[12.5px] font-medium text-white transition hover:bg-[#345a5f] disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-400"
              >
                Update
              </button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─────────────────────────────────────────────────────────────────────
// PartyPill — adults + kids steppers.
// ─────────────────────────────────────────────────────────────────────

interface PartyPillProps extends BasePillProps {
  itinerary: Itinerary;
  onRefine: (prompt: string) => void;
}

export function PartyPill({ itinerary, onRefine, busy }: PartyPillProps) {
  const [open, setOpen] = useState(false);
  const [adults, setAdults] = useState(itinerary.party.adults);
  const [kids, setKids] = useState(itinerary.party.kids ?? 0);

  useEffect(() => {
    if (open) {
      setAdults(itinerary.party.adults);
      setKids(itinerary.party.kids ?? 0);
    }
  }, [open, itinerary.party.adults, itinerary.party.kids]);

  const triggerLabel = `${itinerary.party.adults} adult${itinerary.party.adults === 1 ? "" : "s"}${
    itinerary.party.kids
      ? ` + ${itinerary.party.kids} kid${itinerary.party.kids === 1 ? "" : "s"}`
      : ""
  }`;

  const dirty =
    adults !== itinerary.party.adults || kids !== (itinerary.party.kids ?? 0);

  function apply() {
    if (!dirty) {
      setOpen(false);
      return;
    }
    const partyText = `${adults} adult${adults === 1 ? "" : "s"}${
      kids > 0 ? ` and ${kids} kid${kids === 1 ? "" : "s"}` : ""
    }`;
    onRefine(
      `Refine this plan: change my party to ${partyText}. Keep the rest of the trip the same.`
    );
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className={PILL_BASE} disabled={busy}>
        {triggerLabel}
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        <Stepper
          label="Adults"
          sublabel="Ages 13+"
          value={adults}
          min={1}
          max={16}
          onChange={setAdults}
        />
        <div className="my-2 h-px bg-neutral-100" />
        <Stepper
          label="Kids"
          sublabel="Ages 2–12"
          value={kids}
          min={0}
          max={10}
          onChange={setKids}
        />
        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-full px-3 py-1.5 text-[12.5px] text-neutral-600 hover:text-neutral-900"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={apply}
            disabled={!dirty}
            className="rounded-full bg-[#2b4a4e] px-3.5 py-1.5 text-[12.5px] font-medium text-white transition hover:bg-[#345a5f] disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-400"
          >
            Update
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Stepper({
  label,
  sublabel,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  sublabel?: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="text-sm font-medium text-neutral-900">{label}</div>
        {sublabel && (
          <div className="text-[11.5px] text-neutral-500">{sublabel}</div>
        )}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          aria-label={`Decrease ${label.toLowerCase()}`}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-300 text-neutral-700 transition hover:border-[#2b4a4e] hover:text-neutral-900 disabled:cursor-not-allowed disabled:border-neutral-200 disabled:text-neutral-300"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <div className="w-5 text-center text-sm font-medium tabular-nums text-neutral-900">
          {value}
        </div>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          aria-label={`Increase ${label.toLowerCase()}`}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-300 text-neutral-700 transition hover:border-[#2b4a4e] hover:text-neutral-900 disabled:cursor-not-allowed disabled:border-neutral-200 disabled:text-neutral-300"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// VibePill — chill / balanced / packed segmented choice.
// ─────────────────────────────────────────────────────────────────────

const VIBES: { value: Vibe; label: string; sub: string }[] = [
  { value: "chill", label: "Chill", sub: "6 stops/day, slower pace" },
  { value: "balanced", label: "Balanced", sub: "7 stops/day, classic flow" },
  { value: "packed", label: "Packed", sub: "8 stops/day, see it all" },
];

interface VibePillProps extends BasePillProps {
  itinerary: Itinerary;
  onRefine: (prompt: string) => void;
}

export function VibePill({ itinerary, onRefine, busy }: VibePillProps) {
  const [open, setOpen] = useState(false);

  function pick(vibe: Vibe) {
    setOpen(false);
    if (vibe === itinerary.party.vibe) return;
    onRefine(
      `Refine this plan: change the vibe to ${vibe}. Keep the rest of the trip the same.`
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className={`${PILL_BASE} capitalize`} disabled={busy}>
        {itinerary.party.vibe}
      </PopoverTrigger>
      <PopoverContent className="w-64 p-1.5" align="start">
        {VIBES.map((v) => {
          const active = v.value === itinerary.party.vibe;
          return (
            <button
              key={v.value}
              type="button"
              onClick={() => pick(v.value)}
              className={`flex w-full flex-col items-start gap-0.5 rounded-lg px-2.5 py-2 text-left transition hover:bg-neutral-100 ${
                active ? "bg-[#f4f1ec]" : ""
              }`}
            >
              <span className="text-sm font-medium text-neutral-900">
                {v.label}
                {active && (
                  <span className="ml-2 text-[11px] font-normal text-[#2b4a4e]">
                    Current
                  </span>
                )}
              </span>
              <span className="text-[11.5px] text-neutral-500">{v.sub}</span>
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}

// ─────────────────────────────────────────────────────────────────────
// NeighborhoodPill — anchor neighborhood select. Restricted to slugs that
// actually map to Book Traverse rental inventory (POI_NEIGHBORHOOD_TO_TAGS
// keys with primary or quadrant != null), plus a "no anchor" option for
// users who want to roam.
// ─────────────────────────────────────────────────────────────────────

const ANCHOR_OPTIONS: { slug: string; label: string }[] = [
  { slug: "downtown_cb", label: "Downtown Crested Butte" },
  { slug: "mt_cb", label: "Mt. Crested Butte" },
  { slug: "elk_avenue", label: "Elk Avenue" },
  { slug: "downtown_leadville", label: "Downtown Leadville" },
  { slug: "twin_lakes", label: "Twin Lakes" },
  { slug: "vail", label: "Vail Village" },
  { slug: "avon", label: "Avon" },
  { slug: "granby", label: "Granby" },
];

interface NeighborhoodPillProps extends BasePillProps {
  itinerary: Itinerary;
  onRefine: (prompt: string) => void;
}

export function NeighborhoodPill({
  itinerary,
  onRefine,
  busy,
}: NeighborhoodPillProps) {
  const [open, setOpen] = useState(false);
  const current = itinerary.anchorNeighborhood ?? null;
  const triggerLabel =
    formatNeighborhood(current ?? undefined) || "Pick a neighborhood";

  function pick(slug: string | null) {
    setOpen(false);
    if (slug === current) return;
    if (slug == null) {
      onRefine(
        "Refine this plan: don't anchor the trip to a single neighborhood — let it roam across the region. Keep the rest of the trip the same."
      );
    } else {
      const label = formatNeighborhood(slug);
      onRefine(
        `Refine this plan: anchor the trip in ${label}. Keep the rest of the trip the same.`
      );
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className={PILL_BASE} disabled={busy}>
        {triggerLabel}
      </PopoverTrigger>
      <PopoverContent
        className="max-h-[320px] w-64 overflow-y-auto p-1.5"
        align="start"
      >
        <button
          type="button"
          onClick={() => pick(null)}
          className={`flex w-full flex-col items-start gap-0.5 rounded-lg px-2.5 py-2 text-left transition hover:bg-neutral-100 ${
            current == null ? "bg-[#f4f1ec]" : ""
          }`}
        >
          <span className="text-sm font-medium text-neutral-900">
            No anchor
            {current == null && (
              <span className="ml-2 text-[11px] font-normal text-[#2b4a4e]">
                Current
              </span>
            )}
          </span>
          <span className="text-[11.5px] text-neutral-500">
            Let the trip roam across the region
          </span>
        </button>
        <div className="my-1 h-px bg-neutral-100" />
        {ANCHOR_OPTIONS.map((o) => {
          const active = o.slug === current;
          return (
            <button
              key={o.slug}
              type="button"
              onClick={() => pick(o.slug)}
              className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm transition hover:bg-neutral-100 ${
                active ? "bg-[#f4f1ec]" : ""
              }`}
            >
              <span className="font-medium text-neutral-900">{o.label}</span>
              {active && (
                <span className="text-[11px] text-[#2b4a4e]">Current</span>
              )}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

function isoToDate(iso: string): Date | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function dateToIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function nightsBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

function formatShortRange(checkIn: string, checkOut: string): string {
  const start = isoToDate(checkIn);
  const end = isoToDate(checkOut);
  if (!start || !end) return `${checkIn}–${checkOut}`;
  const startMonth = start.toLocaleDateString("en-US", { month: "short" });
  const endMonth = end.toLocaleDateString("en-US", { month: "short" });
  const startDay = start.getDate();
  const endDay = end.getDate();
  return startMonth === endMonth
    ? `${startMonth} ${startDay}–${endDay}`
    : `${startMonth} ${startDay} – ${endMonth} ${endDay}`;
}
