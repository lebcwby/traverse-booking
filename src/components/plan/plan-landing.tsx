"use client";
// src/components/plan/plan-landing.tsx
// Pre-submit hero / landing view for /plan. Renders instead of the chat
// sidebar + itinerary workspace while the user hasn't sent their first
// message. Once useChat has messages, plan-client.tsx swaps this out for
// the sidebar layout — this component is not re-used after submit.
//
// Brand-aligned to Traverse: navy #14142b on light backgrounds, accent
// blue #3b82f6 on dark. "perfect" rendered in Dancing Script italic blue
// (matches the home-page hero script-word convention via --gold token).
// Full-bleed hero image with dark forest gradient overlay; white text.

import Link from "next/link";
import { Dancing_Script } from "next/font/google";
import {
  Sparkles,
  Star,
  Utensils,
  Mountain,
  Compass,
  Landmark,
  ArrowRight,
  CheckCircle2,
  MapPin,
  Bookmark,
} from "lucide-react";
import { POPULAR_IDEAS, type PopularIdea } from "@/lib/plan/popular-ideas";
import { allPlanSlugs } from "@/lib/plan/slug-map";

// Per-idea icon overrides. Keep here (not in the data module) so the data
// module stays icon-free and server-safe. Keys must match POPULAR_IDEAS.
const IDEA_ICONS: Record<PopularIdea["key"], typeof Utensils> = {
  food: Utensils,
  outdoors: Mountain,
  neighborhoods: Compass,
  classic: Landmark,
};

const script = Dancing_Script({
  subsets: ["latin"],
  weight: ["600", "700"],
});

// Custom brand mark for the "instant" signal on popular-trip-idea cards.
// 4-point sparkle (geometric diamond) — deliberately distinct from the
// 5-point review stars. Inherits currentColor so it works on gold, forest,
// or ink backgrounds.
function InstantSpark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M8 0 L9.4 6.6 L16 8 L9.4 9.4 L8 16 L6.6 9.4 L0 8 L6.6 6.6 Z" />
    </svg>
  );
}

type CategoryChip = { label: string; starter: string };

const CATEGORY_CHIPS: CategoryChip[] = [
  { label: "Food & Drink", starter: "Food and drink highlights in Crested Butte" },
  { label: "14er Hikes", starter: "Mount Elbert 14er weekend in Leadville" },
  { label: "Wildflowers", starter: "Crested Butte wildflower weekend in July" },
  { label: "Family Fun", starter: "Family weekend with kids in Crested Butte or Leadville" },
  { label: "Ski Weekend", starter: "Ski weekend in Crested Butte" },
  { label: "Race Weekend", starter: "Leadville race weekend (Trail 100, Silver Rush, Marathon)" },
];

const TRUST_PILLS = [
  { icon: CheckCircle2, bold: "Free forever", detail: "no signup required" },
  { icon: MapPin, bold: "Local picks", detail: "by the team in CB & Leadville" },
  { icon: Bookmark, bold: "Save & share", detail: "keep your trip plan" },
  { icon: Star, bold: "Real rentals", detail: "189+ Colorado homes" },
] as const;

export interface PlanLandingProps {
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: (text: string) => void;
  // Fast-path for the Popular-trip-ideas cards. Plan-client tries the
  // template cache first; on hit the agent never runs. Falls through to
  // onSubmit on miss.
  onPickPremade?: (idea: PopularIdea) => void;
  placeholder?: string;
}

export function PlanLanding({
  input,
  onInputChange,
  onSubmit,
  onPickPremade,
  placeholder,
}: PlanLandingProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) onSubmit(input);
  };

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-[#faf8f5]">
      {/* Global nav (NoFeesHeader) is rendered by plan-client above this
        component — no per-component sticky header needed. The "Trip Planner ·
        Free" pill in the hero copy below carries the surface identity. */}

      {/* ── HERO (full-bleed image, forest overlay, white text) ──── */}
      <section className="relative shrink-0 overflow-hidden lg:min-h-[520px]">
        <div className="pointer-events-none absolute inset-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/markets/crested-butte.jpg"
            alt=""
            className="h-full w-full object-cover"
            style={{ objectPosition: "center 55%" }}
          />
          {/* Forest gradient overlay — brand primary */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(110deg, rgba(45, 62, 44, 0.78) 0%, rgba(45, 62, 44, 0.55) 50%, rgba(45, 62, 44, 0.35) 100%)",
            }}
          />
        </div>

        <div className="relative mx-auto w-full max-w-[1280px] px-4 pb-12 pt-10 sm:px-7 sm:pb-20 sm:pt-20 lg:pb-16 lg:pt-14">
          <div className="grid items-start gap-8 sm:gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
            {/* Left: copy + stats.
              Mobile-CRO: render AFTER the popular-ideas card via `order-2`
              so the primary CTA is above the fold on mobile. Desktop grid
              positioning overrides via `lg:order-none`. */}
            <div className="order-2 max-w-[620px] text-white lg:order-none">
              <span className="hidden items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-white backdrop-blur sm:inline-flex">
                <Sparkles
                  className="h-3 w-3 text-[#3b82f6]"
                  strokeWidth={2.4}
                />
                Trip Planner · Free
              </span>

              <h1
                className="mt-4 font-bold leading-[1.02] tracking-[-0.015em] text-white sm:mt-5"
                style={{
                  fontSize: "clamp(30px, 5.2vw, 64px)",
                  textShadow: "0 2px 24px rgba(0,0,0,0.25)",
                }}
              >
                Plan your{" "}
                <em
                  className={script.className}
                  style={{
                    fontStyle: "italic",
                    fontWeight: 700,
                    color: "#3b82f6",
                    fontSize: "1.12em",
                    paddingLeft: "4px",
                  }}
                >
                  perfect
                </em>
                <br />
                Colorado trip.
              </h1>

              <p className="mt-4 max-w-[540px] text-[14.5px] leading-[1.55] text-white/92 sm:mt-5 sm:text-[17px]">
                Built by the team managing 189+ vacation rentals across Crested
                Butte, Leadville, and the Colorado mountains. Tell us your vibe
                — we&apos;ll draft your day-by-day with real spots, a map, and
                matching places to stay.{" "}
                <strong className="font-bold text-[#3b82f6]">
                  No signup. Free forever.
                </strong>
              </p>

              {/* Stats. Hidden on small mobile to keep the hero compact —
                the INSTANT pill + "We'll draft in under a second" on the
                card above carry more weight for mobile CRO than stats. */}
              <div className="mt-6 hidden flex-wrap items-center gap-0 text-[13px] text-white/92 sm:flex sm:mt-7">
                <div className="inline-flex items-center gap-2 border-r border-white/30 pr-4 first:pl-0">
                  <div className="inline-flex gap-[1px]">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className="h-3 w-3 fill-[#fbbf24]"
                        strokeWidth={0}
                      />
                    ))}
                  </div>
                  <span>
                    <strong className="font-bold text-white">87%</strong> 5-star
                    reviews
                  </span>
                </div>
                <div className="inline-flex items-center gap-1.5 border-r border-white/30 px-4">
                  <strong className="font-bold text-white">189+</strong>
                  <span>homes</span>
                </div>
                <div className="inline-flex items-center gap-1.5 pl-4">
                  <strong className="font-bold text-white">80,000+</strong>
                  <span>guests</span>
                </div>
              </div>
            </div>

            {/* Right: Popular trip ideas — primary CTA.
              These hit the template cache (sp_plans.cache_key) and render
              in ~200ms vs ~15s for the search-bar agent run. The gold
              "INSTANT" pill signals that speed advantage.
              On mobile (order-1) this renders above the copy so the primary
              CTA is above the fold — desktop grid position wins via
              `lg:order-none`. */}
            <div className="order-1 rounded-[14px] border border-white/20 bg-white p-5 shadow-[0_18px_50px_rgba(28,29,29,0.22)] sm:p-6 lg:order-none">
              <div className="flex items-center gap-2.5">
                <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#2d3e2c]">
                  Popular trip ideas
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-[#14142b] px-2 py-[3px] text-[9.5px] font-extrabold uppercase tracking-[0.1em] text-white">
                  <InstantSpark className="h-[9px] w-[9px]" />
                  Instant
                </span>
              </div>
              <p className="mt-1 text-[13px] text-[#6f7274]">
                One click. We&apos;ll draft your trip in under a second.
              </p>
              <div className="mt-4 flex flex-col gap-2">
                {POPULAR_IDEAS.map((idea) => {
                  const Icon = IDEA_ICONS[idea.key] ?? Utensils;
                  return (
                    <button
                      key={idea.key}
                      type="button"
                      onClick={() =>
                        onPickPremade
                          ? onPickPremade(idea)
                          : onSubmit(idea.prompt)
                      }
                      className="group relative flex items-center gap-3 rounded-[10px] border border-[#e6e3dd] bg-white p-3 text-left transition hover:-translate-y-0.5 hover:border-[#2d3e2c] hover:shadow-[0_10px_28px_rgba(28,29,29,0.08)]"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#efe9df] text-[#2d3e2c] transition group-hover:bg-[#14142b] group-hover:text-[#3b82f6]">
                        <Icon className="h-4 w-4" strokeWidth={2} />
                      </span>
                      <span className="flex-1 text-[13.5px] font-medium leading-snug text-[#1c1d1d]">
                        {idea.label}
                      </span>
                      <InstantSpark className="h-3 w-3 shrink-0 text-[#14142b] opacity-0 transition group-hover:opacity-100" />
                      <ArrowRight
                        className="h-4 w-4 shrink-0 text-[#8b8e90] transition group-hover:translate-x-0.5 group-hover:text-[#2d3e2c]"
                        strokeWidth={2}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECONDARY CTA: search bar for custom trips ──────────── */}
      <section className="mx-auto w-full max-w-[1100px] shrink-0 px-4 pt-12 sm:px-7 sm:pt-16 lg:pt-8">
        <div className="flex flex-col items-center text-center">
          <span className="inline-block text-[11px] font-bold uppercase tracking-[0.12em] text-[#6f7274]">
            Or describe your own trip
          </span>
          <p className="mt-1.5 max-w-[480px] text-[13.5px] text-[#6f7274]">
            Tell us dates, who&apos;s coming, what you love — we&apos;ll build
            from scratch.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="mt-5 flex items-stretch gap-1.5 rounded-full border border-[#1c1d1d]/[0.04] bg-white p-2 shadow-[0_14px_50px_rgba(28,29,29,0.14),0_2px_6px_rgba(28,29,29,0.05)]"
        >
          <label className="flex min-w-0 flex-1 flex-col justify-center rounded-full px-5 py-1 sm:px-6">
            <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#8b8e90]">
              Tell us about your trip
            </span>
            <input
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (input.trim()) onSubmit(input);
                }
              }}
              placeholder={placeholder ?? "e.g. Food, coffee, and live music"}
              className="mt-0.5 w-full bg-transparent text-[15px] leading-6 text-[#1c1d1d] outline-none placeholder:text-[#8b8e90]"
            />
          </label>
          <button
            type="submit"
            disabled={!input.trim()}
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#2d3e2c] px-5 py-3 text-[13px] font-semibold text-white transition hover:-translate-y-[1px] hover:bg-[#384e36] hover:shadow-md disabled:cursor-not-allowed disabled:bg-[#c3c7ba] disabled:text-white/70 disabled:hover:translate-y-0 disabled:hover:shadow-none sm:px-6"
          >
            Build my trip
            <ArrowRight className="h-4 w-4" strokeWidth={2.4} />
          </button>
        </form>

        {/* Try these: */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-[12.5px]">
          <span className="font-semibold text-[#6f7274]">Try:</span>
          {CATEGORY_CHIPS.map((c) => (
            <button
              key={c.label}
              type="button"
              onClick={() => onInputChange(c.starter)}
              className="rounded-full border border-[#d8d5cd] bg-white px-3 py-1.5 font-medium text-[#1c1d1d] transition hover:-translate-y-[1px] hover:border-[#2d3e2c] hover:bg-[#efe9df]"
            >
              {c.label}
            </button>
          ))}
        </div>
      </section>

      {/* ── SAMPLE ITINERARIES (SEO surface + discoverability) ─── */}
      <section className="mx-auto w-full max-w-[1100px] shrink-0 px-4 pt-12 sm:px-7 sm:pt-16">
        <div className="flex flex-col items-center text-center">
          <span className="inline-block text-[11px] font-bold uppercase tracking-[0.12em] text-[#6f7274]">
            Or read a sample Colorado trip plan
          </span>
          <p className="mt-1.5 max-w-[520px] text-[13.5px] text-[#6f7274]">
            Full day-by-day itineraries with a map, real places, and matching
            vacation rentals. Tweak any of them to fit your dates and party.
          </p>
        </div>
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {allPlanSlugs().map((s) => (
            <Link
              key={s.slug}
              href={`/plan/${s.slug}`}
              className="group rounded-[12px] border border-[#e6e3dd] bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-[#2d3e2c] hover:shadow-[0_10px_28px_rgba(28,29,29,0.08)]"
            >
              <h3 className="text-[13.5px] font-semibold text-[#1c1d1d]">
                {s.h1}
              </h3>
              <p className="mt-1.5 line-clamp-3 text-[12.5px] leading-snug text-[#6f7274]">
                {s.subtitle}
              </p>
              <span className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-semibold text-[#2d3e2c] group-hover:gap-1.5">
                Read itinerary
                <ArrowRight className="h-3 w-3" strokeWidth={2.4} />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── TRUST PILLS ─────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-[1280px] shrink-0 px-4 pt-10 sm:px-7 sm:pt-12">
        <div className="flex flex-wrap items-center justify-center gap-x-7 gap-y-3 text-[12.5px] text-[#2a2b2b]">
          {TRUST_PILLS.map(({ icon: Icon, bold, detail }) => (
            <div
              key={bold}
              className="inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Icon className="h-4 w-4 text-[#2d3e2c]" strokeWidth={2.2} />
              <span>
                <strong className="font-bold text-[#1c1d1d]">{bold}</strong> —{" "}
                {detail}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ── FOOTER WORDMARK ─────────────────────────────────────── */}
      <div className="mt-auto shrink-0 px-4 py-10 text-center sm:py-12">
        <p className="text-[13px] text-[#6f7274]">
          Built by the team behind{" "}
          <Link
            href="/"
            className="font-semibold text-[#1c1d1d] underline-offset-2 hover:underline"
          >
            booktraverse.com
          </Link>{" "}
          · Colorado mountain-town direct-booking vacation rentals
        </p>
      </div>
    </div>
  );
}
