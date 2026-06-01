"use client";
// src/components/plan/refinement-chips.tsx
// Post-result refinement affordance. Renders below the itinerary header.
// Clicking a chip sends a pre-written refinement prompt via onRefine, which
// triggers the agent to re-run generate_itinerary with the updated plan.
//
// Design principle: never ask the user these questions upfront. Every chip
// here is something we deliberately pushed OUT of the interview because
// answering upfront = friction. Post-result = zero-friction iteration.

import { Sparkles } from "lucide-react";

export type RefinementChip = {
  label: string;
  prompt: string;
};

export const REFINEMENT_CHIPS: RefinementChip[] = [
  {
    label: "Add a day trip",
    prompt:
      "Refine this plan: add a day trip from our base. Good Colorado options are Aspen / Maroon Bells, Black Canyon of the Gunnison, Independence Pass scenic drive, Twin Lakes / Mount Elbert area, or a hot springs day (Mount Princeton / Glenwood). Pick the best fit for our trip and swap a day in.",
  },
  {
    label: "Keep it walkable",
    prompt:
      "Refine this plan: keep everything walkable within one or two neighborhoods (Elk Avenue, downtown Leadville, Mt. CB base) — no driving between stops if possible.",
  },
  {
    label: "Make it cheaper",
    prompt:
      "Refine this plan: make it more budget-friendly. Swap splurge restaurants for casual neighborhood spots, free trails and viewpoints, and lift-free outdoor activities.",
  },
  {
    label: "More local, less touristy",
    prompt:
      "Refine this plan: make it feel more local and less touristy. Lean hidden gems and spots only locals know — skip the obvious tourist stops.",
  },
  {
    label: "More iconic Colorado",
    prompt:
      "Refine this plan: lean into iconic Colorado mountain town experiences — Elk Avenue in Crested Butte, the Leadville 100 trail, Twin Lakes views, classic 14er hikes, historic mining-town saloons. Bucket-list stuff.",
  },
  {
    label: "Skip places I've been",
    prompt:
      "Refine this plan: I've been here before. Swap out the obvious picks for something fresh — surprise me with spots I probably haven't tried.",
  },
  {
    label: "More kid-friendly",
    prompt:
      "Refine this plan: add more kid-friendly activities — easy nature trails, the Crested Butte Mountain Bike Park kid zone, the Mineral Belt Trail in Leadville, family-friendly restaurants, ice cream stops. Keep adult-only spots to a minimum.",
  },
  {
    label: "Swap neighborhoods",
    prompt:
      "Refine this plan: try a different anchor neighborhood (e.g. swap Mt. CB for downtown Crested Butte, or Leadville for Twin Lakes). Pick one that fits our vibe but changes the feel of the trip.",
  },
];

interface RefinementChipsProps {
  onRefine: (prompt: string) => void;
  disabled?: boolean;
}

export function RefinementChips({ onRefine, disabled }: RefinementChipsProps) {
  return (
    <section
      data-plan-refinements
      className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5"
    >
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#2b4a4e] text-white">
          <Sparkles className="h-3.5 w-3.5" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-neutral-900">
            Want to refine it?
          </h3>
          <p className="text-xs text-neutral-600">
            Tap any of these — the plan updates in a few seconds.
          </p>
        </div>
      </div>
      <div className="mt-3.5 flex flex-wrap gap-2">
        {REFINEMENT_CHIPS.map((chip) => (
          <button
            key={chip.label}
            type="button"
            disabled={disabled}
            onClick={() => onRefine(chip.prompt)}
            className="rounded-full border border-neutral-200 bg-white px-3.5 py-1.5 text-sm text-neutral-700 transition hover:border-[#2b4a4e] hover:bg-[#f4f1ec] hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {chip.label}
          </button>
        ))}
      </div>
    </section>
  );
}
