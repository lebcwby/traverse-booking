"use client";
// src/components/plan/plan-mobile-action-bar.tsx
// Sticky bottom bar on mobile while viewing an itinerary. Renders a
// horizontal-scroll row of refine chips above a compact composer so users
// can adjust their plan without scrolling or hunting for controls.
// Desktop surfaces the same affordances in PlanContextSidebar (`lg:hidden`).

import { useRef } from "react";
import { ArrowUp, Loader2 } from "lucide-react";
import { REFINEMENT_CHIPS } from "./refinement-chips";

interface PlanMobileActionBarProps {
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: (text: string) => void;
  onRefine: (prompt: string) => void;
  busy: boolean;
}

export function PlanMobileActionBar({
  input,
  onInputChange,
  onSubmit,
  onRefine,
  busy,
}: PlanMobileActionBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      className="shrink-0 border-t border-neutral-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {/* Horizontal-scroll refine chips — one-tap quick refinements */}
      <div className="overflow-x-auto scrollbar-none">
        <div className="flex gap-2 px-3 py-2.5">
          {REFINEMENT_CHIPS.map((chip) => (
            <button
              key={chip.label}
              type="button"
              disabled={busy}
              onClick={() => onRefine(chip.prompt)}
              className="shrink-0 whitespace-nowrap rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-[12.5px] font-medium text-neutral-700 transition hover:border-[#2b4a4e] hover:bg-[#f4f1ec] hover:text-neutral-900 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* Compact composer */}
      <form
        className="flex items-center gap-2 px-3 pb-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!input.trim() || busy) return;
          onSubmit(input);
          inputRef.current?.blur();
        }}
      >
        <div className="flex min-w-0 flex-1 items-center rounded-full border border-neutral-300 bg-white px-4 py-2.5 focus-within:border-[#2b4a4e] focus-within:ring-2 focus-within:ring-[#2b4a4e]/15">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder="Ask for a tweak or swap…"
            className="min-w-0 flex-1 bg-transparent text-[14px] leading-5 text-neutral-900 outline-none placeholder:text-neutral-400"
            disabled={busy}
          />
        </div>
        <button
          type="submit"
          disabled={!input.trim() || busy}
          aria-label="Send follow-up"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#2b4a4e] text-white shadow-sm transition hover:bg-[#345a5f] active:scale-95 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-400 disabled:shadow-none"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
          )}
        </button>
      </form>
    </div>
  );
}
