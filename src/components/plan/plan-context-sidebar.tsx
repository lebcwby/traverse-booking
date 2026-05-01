"use client";
// src/components/plan/plan-context-sidebar.tsx
// Left-rail workspace that replaces the raw chat transcript once an
// itinerary is ready. Compact layout: prompt recap + plan meta in one
// header, a prominent Ask-a-follow-up composer, and a quick refine chip
// grid. Chat messages continue to flow through plan-client's useChat.

import { useEffect, useMemo, useRef } from "react";
import type { UIMessage } from "ai";
import type { UseChatHelpers } from "@ai-sdk/react";
import type { Itinerary } from "@/lib/plan/schema";
import { formatNeighborhood } from "@/lib/plan/neighborhood-match";
import { ArrowUp, CheckCircle2, Loader2, Sparkles } from "lucide-react";

interface PlanContextSidebarProps {
  itinerary: Itinerary;
  messages: UIMessage[];
  status: UseChatHelpers<UIMessage>["status"];
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: (text: string) => void;
  onRefine: (prompt: string) => void;
}

// Same chip prompts the ItineraryView used to surface — kept here because
// the reference design embeds them directly into the left workspace.
const QUICK_REFINES: Array<{ label: string; prompt: string }> = [
  {
    label: "More local",
    prompt:
      "Refine this plan: make it feel more local and less touristy. Lean hidden gems, neighborhood spots, and places only Portlanders know — skip the obvious tourist stops.",
  },
  {
    label: "Less touristy",
    prompt:
      "Refine this plan: strip out the touristy stops. Replace them with neighborhood spots locals actually go to.",
  },
  {
    label: "More iconic",
    prompt:
      "Refine this plan: lean into iconic Portland — Powell's Books, Voodoo Doughnut, Pittock Mansion, Lan Su Garden, Saturday Market, Multnomah Falls. Bucket-list stuff.",
  },
  {
    label: "More walkable",
    prompt:
      "Refine this plan: keep everything walkable within one or two neighborhoods — no driving between stops if possible.",
  },
  {
    label: "More kid-friendly",
    prompt:
      "Refine this plan: add more kid-friendly activities — OMSI, the Zoo, Oaks Amusement Park, splash pads, family-friendly restaurants.",
  },
  {
    label: "Cheaper",
    prompt:
      "Refine this plan: make it more budget-friendly. Swap splurge spots for cheaper neighborhood joints, food carts, and free activities.",
  },
  {
    label: "Skip places I've been",
    prompt:
      "Refine this plan: I've been to Portland before. Swap out the obvious picks for something fresh — surprise me with spots I probably haven't tried.",
  },
  {
    label: "Swap neighborhoods",
    prompt:
      "Refine this plan: try a different anchor neighborhood. Pick one that fits our vibe but changes the feel of the trip.",
  },
];

const FOLLOWUP_CHIPS = ["Best coffee shops?", "Rooftop bars", "Brunch spots"];

function extractOpener(messages: UIMessage[]): string | null {
  for (const msg of messages) {
    if (msg.role !== "user") continue;
    const parts = msg.parts as unknown[];
    for (const p of parts) {
      if (
        typeof p === "object" &&
        p !== null &&
        "type" in p &&
        (p as { type: unknown }).type === "text" &&
        typeof (p as { text?: string }).text === "string"
      ) {
        return (p as unknown as { text: string }).text.trim();
      }
    }
  }
  return null;
}

// Pull the post-itinerary turns for the transcript. The opener + interview
// + first generate are all represented by the prompt-recap pill and the
// itinerary itself, so showing them again is noise. Every turn AFTER the
// FIRST successful generate_itinerary is the follow-up conversation and
// must stay visible — anchoring on the LAST settled generate would erase
// the user's refinement the moment the refinement completes (each new
// generate_itinerary becomes the new "last", pushing the cutoff past the
// very messages we want to keep).
interface TranscriptTurn {
  id: string;
  role: "user" | "assistant";
  text: string;
}

function buildTranscript(messages: UIMessage[]): TranscriptTurn[] {
  let firstGenerateIdx = -1;
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.role !== "assistant") continue;
    const parts = msg.parts as unknown as Array<{
      type?: string;
      state?: string;
    }>;
    const hasSettledGenerate = parts.some(
      (p) =>
        p?.type === "tool-generate_itinerary" && p.state === "output-available"
    );
    if (hasSettledGenerate) {
      firstGenerateIdx = i;
      break;
    }
  }
  if (firstGenerateIdx === -1) return [];

  const turns: TranscriptTurn[] = [];
  for (let i = firstGenerateIdx + 1; i < messages.length; i++) {
    const msg = messages[i];
    const parts = msg.parts as unknown as Array<{
      type?: string;
      text?: string;
      state?: string;
    }>;
    const text = parts
      .filter((p) => p?.type === "text" && typeof p.text === "string")
      .map((p) => p.text as string)
      .join(" ")
      .trim();
    if (!text) continue;
    turns.push({ id: msg.id, role: msg.role as "user" | "assistant", text });
  }
  return turns;
}

function formatShortRange(checkIn: string, checkOut: string): string {
  const start = new Date(`${checkIn}T12:00:00Z`);
  const end = new Date(`${checkOut}T12:00:00Z`);
  const startMonth = start.toLocaleDateString("en-US", {
    month: "short",
    timeZone: "UTC",
  });
  const endMonth = end.toLocaleDateString("en-US", {
    month: "short",
    timeZone: "UTC",
  });
  const startDay = start.getUTCDate();
  const endDay = end.getUTCDate();
  return startMonth === endMonth
    ? `${startMonth} ${startDay} – ${endDay}`
    : `${startMonth} ${startDay} – ${endMonth} ${endDay}`;
}

function vibeLabel(vibe: Itinerary["party"]["vibe"]): string {
  if (vibe === "chill") return "Chill";
  if (vibe === "packed") return "Packed";
  return "Balanced";
}

export function PlanContextSidebar({
  itinerary,
  messages,
  status,
  input,
  onInputChange,
  onSubmit,
  onRefine,
}: PlanContextSidebarProps) {
  const busy = status === "streaming" || status === "submitted";
  const errored = status === "error";
  const opener = extractOpener(messages);
  const transcript = useMemo(() => buildTranscript(messages), [messages]);
  const transcriptScrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = transcriptScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [transcript, busy, errored]);
  const anchor = itinerary.anchorNeighborhood
    ? formatNeighborhood(itinerary.anchorNeighborhood)
    : null;
  const metaLine = [
    !itinerary.dates.isTentative
      ? formatShortRange(itinerary.dates.checkIn, itinerary.dates.checkOut)
      : "Flexible dates",
    `${itinerary.dates.nights} night${itinerary.dates.nights === 1 ? "" : "s"}`,
    `${itinerary.party.adults} adult${itinerary.party.adults === 1 ? "" : "s"}${
      itinerary.party.kids ? ` + ${itinerary.party.kids} kids` : ""
    }`,
    vibeLabel(itinerary.party.vibe),
  ].join(" · ");

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto px-4 py-5">
      {/* Prompt recap + plan meta combined in one compact header. */}
      <section className="rounded-2xl bg-primary p-4 text-primary-foreground">
        {opener && (
          <h2 className="text-[15px] font-semibold leading-snug">
            {opener.length > 120 ? `${opener.slice(0, 117)}…` : opener}
          </h2>
        )}
        <p className="mt-1.5 flex items-start gap-1.5 text-[11.5px] leading-snug text-primary-foreground/85">
          <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0" strokeWidth={2.5} />
          <span>
            Plan ready · {metaLine}
            {anchor ? ` · ${anchor}` : ""}
          </span>
        </p>
      </section>

      {/* Ask a follow-up composer — primary action surface. */}
      <section className="rounded-2xl border-2 border-primary/30 bg-white p-4 shadow-[0_4px_16px_rgba(43,74,78,0.08)]">
        <div className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-neutral-900">
          <Sparkles className="h-4 w-4 text-primary" strokeWidth={2} />
          Ask a follow-up
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!input.trim() || busy) return;
            onSubmit(input);
          }}
        >
          <textarea
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (!input.trim() || busy) return;
                onSubmit(input);
              }
            }}
            placeholder="Ask for a tweak, a swap, or something new…"
            rows={2}
            className="block w-full resize-none bg-transparent text-[13.5px] leading-6 text-neutral-900 outline-none placeholder:text-neutral-400"
            style={{ maxHeight: "120px" }}
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              {FOLLOWUP_CHIPS.map((c) => (
                <button
                  key={c}
                  type="button"
                  disabled={busy}
                  onClick={() => onSubmit(c)}
                  className="rounded-full border border-neutral-200 bg-white px-2.5 py-0.5 text-[11.5px] font-medium text-neutral-600 transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {c}
                </button>
              ))}
            </div>
            <button
              type="submit"
              disabled={!input.trim() || busy}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-400"
              aria-label="Send follow-up"
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ArrowUp className="h-3.5 w-3.5" strokeWidth={2.5} />
              )}
            </button>
          </div>
        </form>
      </section>

      {/* Conversation transcript — only renders once the user has started a
        follow-up after the first itinerary landed. Without this, clicking
        a chip or typing a follow-up produced a silent pending state. */}
      {(transcript.length > 0 || busy || errored) && (
        <section className="flex flex-col gap-2 rounded-2xl border border-neutral-200 bg-white p-3">
          <h3 className="text-[12.5px] font-semibold text-neutral-900">
            Conversation
          </h3>
          <div
            ref={transcriptScrollRef}
            className="flex max-h-[280px] flex-col gap-2 overflow-y-auto pr-1"
          >
            {transcript.map((t) =>
              t.role === "user" ? (
                <div key={t.id} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3 py-2 text-[12.5px] leading-snug text-primary-foreground">
                    {t.text}
                  </div>
                </div>
              ) : (
                <div
                  key={t.id}
                  className="whitespace-pre-wrap text-[12.5px] leading-snug text-neutral-800"
                >
                  {t.text}
                </div>
              )
            )}
            {busy && (
              <div className="flex items-center gap-2 text-[12px] text-neutral-500">
                <Loader2 className="h-3 w-3 animate-spin text-primary" />
                <span>Working on it…</span>
              </div>
            )}
            {errored && !busy && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11.5px] leading-snug text-amber-800">
                Something broke on that last turn. Try rephrasing or click a
                Quick refine chip below — we&apos;ll recover.
              </div>
            )}
          </div>
        </section>
      )}

      {/* Quick refine chips */}
      <section className="rounded-2xl border border-neutral-200 bg-white p-3">
        <h3 className="text-[12.5px] font-semibold text-neutral-900">
          Quick refine
        </h3>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {QUICK_REFINES.map((chip) => (
            <button
              key={chip.label}
              type="button"
              disabled={busy}
              onClick={() => onRefine(chip.prompt)}
              className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-[12px] font-medium text-neutral-700 transition hover:border-primary hover:bg-primary/5 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {chip.label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
