"use client";
// src/components/plan/plan-build-progress.tsx
// Stage-based progress for the /plan loading state. Collapses every tool
// call the agent makes into three semantic stages so the user sees
// momentum toward a result, not a 13-row checklist of mechanical searches.
//
// Stage 1 — Understanding your trip. Done as soon as any tool fires.
// Stage 2 — Exploring Portland. Aggregates every search_pois + get_neighborhood
//           call into a single row with a counter + the latest in-flight
//           search as a sub-detail ("Bars in Alberta").
// Stage 3 — Writing your day-by-day plan. Tracks generate_itinerary.
//
// Design goal per user CRO feedback: "forward motion toward a result" —
// the user should feel the plan being ADDED to, not watch a bureaucratic
// tool-call log.

import { useMemo } from "react";
import type { UIMessage } from "ai";
import { CheckCircle2, Loader2, Circle, AlertCircle } from "lucide-react";
import { formatNeighborhood } from "@/lib/plan/neighborhood-match";

type StageState = "pending" | "running" | "done" | "failed";

type Stage = {
  key: "understanding" | "exploring" | "building";
  title: string;
  detail?: string;
  state: StageState;
};

const CATEGORY_LABELS: Record<string, string> = {
  restaurant: "Restaurants",
  food_cart_pod: "Food carts",
  bar: "Bars & breweries",
  coffee: "Coffee shops",
  shop: "Shops",
  activity: "Things to do",
  park: "Parks",
  museum: "Museums",
  viewpoint: "Viewpoints",
  transit: "Transit",
};

interface ToolPart {
  type?: string;
  state?: string;
  input?: Record<string, unknown>;
}

function describePoiSearch(part: ToolPart): string | null {
  const t = part.type;
  if (!t?.startsWith("tool-")) return null;
  const input = part.input ?? {};

  if (t === "tool-search_pois") {
    const cat = input.category as string | undefined;
    const neighborhoods = input.neighborhoods as string[] | undefined;
    const catLabel = (cat && CATEGORY_LABELS[cat]) ?? "Local spots";
    if (neighborhoods?.length === 1) {
      const pretty = formatNeighborhood(neighborhoods[0]);
      if (pretty) return `${catLabel} in ${pretty}`;
    }
    return catLabel;
  }

  if (t === "tool-get_neighborhood") {
    const slug = input.slug as string | undefined;
    const pretty = formatNeighborhood(slug);
    return pretty ? `${pretty} neighborhood` : "Neighborhood notes";
  }

  return null;
}

function deriveStages(messages: UIMessage[]): Stage[] {
  let hasAnyToolCall = false;
  let poisTotal = 0;
  let poisDone = 0;
  let latestRunningDetail: string | undefined;
  let generateState: "none" | "running" | "done" | "failed" = "none";

  for (const msg of messages) {
    if (msg.role !== "assistant") continue;
    const parts = msg.parts as unknown as ToolPart[];
    for (const part of parts) {
      if (!part || typeof part !== "object") continue;
      const type = part.type;
      const state = part.state;
      if (!type?.startsWith("tool-")) continue;
      hasAnyToolCall = true;

      if (type === "tool-search_pois" || type === "tool-get_neighborhood") {
        poisTotal += 1;
        if (state === "output-available" || state === "output-error") {
          poisDone += 1;
        } else {
          const detail = describePoiSearch(part);
          if (detail) latestRunningDetail = detail;
        }
      } else if (
        type === "tool-search_listings" ||
        type === "tool-generate_itinerary"
      ) {
        if (state === "output-available") {
          generateState = "done";
        } else if (state === "output-error") {
          // Failed tool call — mark terminal so the spinner stops. A later
          // successful call in the same message history still wins via the
          // "done" branch above.
          if (generateState !== "done") generateState = "failed";
        } else if (generateState !== "done" && generateState !== "failed") {
          generateState = "running";
        }
      }
    }
  }

  // Stage 1: Understanding — flips to done the moment any tool fires.
  const understanding: Stage = {
    key: "understanding",
    title: "Got your trip details",
    state: hasAnyToolCall ? "done" : "running",
  };

  // Stage 2: Exploring Portland
  let exploringState: StageState = "pending";
  let exploringDetail: string | undefined;
  if (poisTotal > 0) {
    if (poisDone < poisTotal) {
      exploringState = "running";
      exploringDetail = latestRunningDetail
        ? `${poisDone} of ${poisTotal} · ${latestRunningDetail}`
        : `${poisDone} of ${poisTotal} searches running`;
    } else {
      exploringState = "done";
      exploringDetail = `${poisDone} Portland ${poisDone === 1 ? "category" : "categories"} searched`;
    }
  } else if (hasAnyToolCall) {
    // Tools fired but none were POI searches yet — skip ahead visually
    exploringState = "running";
  }
  const exploring: Stage = {
    key: "exploring",
    title: "Pulling real Portland spots",
    detail: exploringDetail,
    state: exploringState,
  };

  // Stage 3: Building — generate_itinerary
  let buildingState: StageState = "pending";
  let buildingDetail: string | undefined;
  let buildingTitle = "Writing your day-by-day plan";
  if (generateState === "running") {
    buildingState = "running";
    buildingDetail = "Checking real-time rental availability";
  } else if (generateState === "done") {
    buildingState = "done";
  } else if (generateState === "failed") {
    // Terminal error — swap the icon + label so the user knows something
    // went wrong and can retry. The chat route's sanitizer drops the broken
    // part on the next submit, so a new message re-runs cleanly.
    buildingState = "failed";
    buildingTitle = "Hit a snag — send another message to retry";
  }
  const building: Stage = {
    key: "building",
    title: buildingTitle,
    detail: buildingDetail,
    state: buildingState,
  };

  return [understanding, exploring, building];
}

function StageIcon({ state }: { state: StageState }) {
  if (state === "done") {
    return <CheckCircle2 className="h-5 w-5 text-[#2b4a4e]" />;
  }
  if (state === "running") {
    return <Loader2 className="h-5 w-5 animate-spin text-[#2b4a4e]" />;
  }
  if (state === "failed") {
    return <AlertCircle className="h-5 w-5 text-amber-500" />;
  }
  return <Circle className="h-5 w-5 text-neutral-300" strokeWidth={1.5} />;
}

export function PlanBuildProgress({ messages }: { messages: UIMessage[] }) {
  const stages = useMemo(() => deriveStages(messages), [messages]);
  const anyActive = stages.some((s) => s.state !== "pending");
  if (!anyActive) return null;

  const completed = stages.filter((s) => s.state === "done").length;
  const total = stages.length;
  const pct = Math.round((completed / total) * 100);

  return (
    <div className="w-full max-w-md rounded-2xl border border-[#d6cfc4] bg-white p-5 shadow-sm">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-neutral-900">
          Building your Portland trip
        </h3>
        <span className="text-[11px] font-medium tabular-nums text-neutral-500">
          {completed}/{total}
        </span>
      </div>

      {/* Progress bar — fills in sync with stage completion */}
      <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-neutral-100">
        <div
          className="h-full rounded-full bg-[#2b4a4e] transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>

      <ol className="mt-4 space-y-3.5">
        {stages.map((s) => (
          <li key={s.key} className="flex items-start gap-3">
            <div className="mt-0.5 shrink-0">
              <StageIcon state={s.state} />
            </div>
            <div className="min-w-0 flex-1">
              <div
                className={`text-sm font-medium leading-snug ${
                  s.state === "pending"
                    ? "text-neutral-400"
                    : "text-neutral-900"
                }`}
              >
                {s.title}
              </div>
              {s.detail && s.state !== "pending" && (
                <div className="mt-0.5 truncate text-xs text-neutral-600">
                  {s.detail}
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
