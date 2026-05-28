"use client";
// src/components/plan/chat-panel.tsx
// Left pane: message list + input. Renders text parts from the AI SDK
// UIMessage parts; collapses tool calls into a single "searching..." pill.

import { useCallback, useEffect, useRef, useState } from "react";
import type { UIMessage } from "ai";
import type { UseChatHelpers } from "@ai-sdk/react";
import { StopCircle } from "lucide-react";

function useAutoResizeTextarea() {
  const ref = useRef<HTMLTextAreaElement>(null);
  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, []);
  const reset = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
  }, []);
  return { ref, resize, reset };
}

// Rotating example prompts shown as ghost text in the textarea placeholder
// on the landing empty state. NN/g onboarding research: broad starters
// outperform niche ones — users bounce off examples that don't apply to them.
export const PLACEHOLDER_PROMPTS = [
  "A 3-day Crested Butte weekend for two",
  "Long weekend in Leadville with kids, ages 7 and 10",
  "Surprise me — 2 nights with no plan",
  "Wildflowers, coffee, and live music in Crested Butte",
];

// Typewriter animation for the placeholder: types a phrase, holds, deletes,
// advances. `enabled=false` tears down the timer so we don't keep an animation
// running once a conversation starts. Respects prefers-reduced-motion.
export function useTypewriterPlaceholder(
  phrases: string[],
  enabled: boolean
): string {
  const [text, setText] = useState(() =>
    enabled && phrases.length > 0 ? phrases[0] : ""
  );

  useEffect(() => {
    if (!enabled || phrases.length === 0) {
      setText("");
      return;
    }

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setText(phrases[0]);
      return;
    }

    setText(phrases[0]);
    let phraseIdx = 0;
    let charIdx = phrases[0].length;
    let deleting = true;
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const schedule = (fn: () => void, ms: number) => {
      if (cancelled) return;
      timeoutId = setTimeout(fn, ms);
    };

    const tick = () => {
      if (cancelled) return;
      const current = phrases[phraseIdx];
      if (!deleting) {
        charIdx += 1;
        setText(current.slice(0, charIdx));
        if (charIdx >= current.length) {
          schedule(() => {
            deleting = true;
            tick();
          }, 1800);
        } else {
          schedule(tick, 45);
        }
      } else {
        charIdx -= 1;
        setText(current.slice(0, Math.max(0, charIdx)));
        if (charIdx <= 0) {
          deleting = false;
          phraseIdx = (phraseIdx + 1) % phrases.length;
          charIdx = 0;
          schedule(tick, 350);
        } else {
          schedule(tick, 20);
        }
      }
    };

    schedule(tick, 1500);

    return () => {
      cancelled = true;
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    };
  }, [phrases, enabled]);

  return text;
}

// Status label is keyed off what the agent is actually doing — we look at the
// most recent part on the latest assistant message and pick a phrase that
// matches. Previously this cycled through a fixed list on a 2.2s timer, which
// often showed (e.g.) "Pinging Guesty…" while the model was actually writing
// the final summary. The phrases below must match planTools keys in
// src/lib/plan/agent.ts.
const TOOL_LABELS: Record<string, string> = {
  search_pois: "Searching spots",
  search_listings: "Checking Guesty availability",
  get_neighborhood: "Pulling neighborhood notes",
  generate_itinerary: "Lining up the day",
};

function getToolPartName(part: unknown): string | null {
  if (
    typeof part === "object" &&
    part !== null &&
    "type" in part &&
    typeof (part as { type: unknown }).type === "string"
  ) {
    const type = (part as { type: string }).type;
    if (type.startsWith("tool-")) return type.slice("tool-".length);
  }
  return null;
}

function getStatusLabel(
  messages: UIMessage[],
  status: UseChatHelpers<UIMessage>["status"]
): string {
  // Server accepted the request but no tokens have streamed back yet.
  if (status === "submitted") return "Thinking";

  const last = messages[messages.length - 1];
  if (!last || last.role !== "assistant") return "Thinking";

  const parts = last.parts as unknown[];
  if (parts.length === 0) return "Thinking";

  const lastPart = parts[parts.length - 1];
  const toolName = getToolPartName(lastPart);
  if (toolName) {
    // AI SDK v6 tool part lifecycle: input-streaming → input-available →
    // output-available (or output-error). The first two are "in flight".
    const state = (lastPart as { state?: string }).state;
    if (state !== "output-available" && state !== "output-error") {
      return TOOL_LABELS[toolName] ?? "Searching";
    }
  }

  // Last part is either streaming text or a finished tool about to be
  // followed by more text — either way the model is writing.
  return "Writing it up";
}

function StreamingIndicator({
  messages,
  status,
}: {
  messages: UIMessage[];
  status: UseChatHelpers<UIMessage>["status"];
}) {
  const label = getStatusLabel(messages, status);
  return (
    <div className="flex items-center gap-2 text-sm text-neutral-500">
      <div className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-neutral-400 opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-neutral-500" />
      </div>
      <span>{label}…</span>
    </div>
  );
}

interface ChatPanelProps {
  messages: UIMessage[];
  status: UseChatHelpers<UIMessage>["status"];
  error: Error | undefined;
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: (text: string) => void;
  onStop: () => void;
  keyboardOffset?: number;
}

const SUGGESTION_CHIPS = [
  "3-day foodie trip for my wife and me in October",
  "Long weekend with kids (ages 7 and 10)",
  "Coffee + bookstore crawl, solo traveler",
  "Romantic anniversary, we love craft beer",
];

export function ChatPanel({
  messages,
  status,
  error,
  input,
  onInputChange,
  onSubmit,
  onStop,
  keyboardOffset = 0,
}: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { ref: taRef, resize, reset } = useAutoResizeTextarea();
  const animatedPlaceholder = useTypewriterPlaceholder(
    PLACEHOLDER_PROMPTS,
    messages.length === 0
  );
  const placeholder =
    messages.length === 0
      ? animatedPlaceholder || "Tell me about your trip..."
      : "Ask a follow-up...";

  // Autoscroll as messages stream in
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  const busy = status === "submitted" || status === "streaming";

  const busyStreaming = status === "streaming" || status === "submitted";

  return (
    <>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4">
        {messages.length === 0 ? (
          <EmptyState onPick={onSubmit} />
        ) : (
          <div className="flex flex-col gap-4">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            {busyStreaming && (
              <StreamingIndicator messages={messages} status={status} />
            )}
          </div>
        )}
        {error && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            Something went wrong: {error.message}
          </div>
        )}
      </div>

      <form
        className="w-full bg-neutral-50 px-4 pb-1 pt-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(input);
          reset();
        }}
      >
        <div className="flex items-end gap-2 rounded-2xl border border-neutral-200 bg-white px-4 py-3 shadow-sm transition-shadow focus-within:border-neutral-400 focus-within:shadow-md">
          <textarea
            ref={taRef}
            value={input}
            onChange={(e) => {
              onInputChange(e.target.value);
              resize();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSubmit(input);
                reset();
              }
            }}
            placeholder={placeholder}
            rows={2}
            className="flex-1 resize-none self-center bg-transparent py-1 text-base leading-6 text-neutral-900 outline-none placeholder:text-neutral-400"
            style={{ maxHeight: "120px" }}
          />
          {busy ? (
            <button
              type="button"
              onClick={onStop}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-white hover:bg-neutral-700"
              aria-label="Stop"
            >
              <StopCircle className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-400"
              aria-label="Send"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="12" y1="19" x2="12" y2="5" />
                <polyline points="5 12 12 5 19 12" />
              </svg>
            </button>
          )}
        </div>
      </form>
    </>
  );
}

function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  // min-h-full so the empty state fills the scroll area even when there's
  // plenty of room; justify-end anchors the welcome copy + suggestion chips
  // to the bottom so they sit right above the input box (keeps the area
  // visually dense instead of having a big empty gap below the chips).
  return (
    <div className="flex min-h-full flex-col justify-end gap-5 pb-4 pt-8">
      <div>
        <h2 className="text-lg font-semibold text-neutral-900">
          What kind of Colorado trip are you planning?
        </h2>
        <p className="mt-1 text-sm text-neutral-600">
          I'll ask a few questions, then build you a day-by-day itinerary with
          real places, a map, and matching vacation rentals.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <div className="text-xs font-medium uppercase tracking-wide text-neutral-400">
          Try a starter
        </div>
        {SUGGESTION_CHIPS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-left text-sm text-neutral-700 transition hover:border-neutral-900 hover:bg-neutral-50"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

interface TextPart {
  type: "text";
  text: string;
}

function isTextPart(p: unknown): p is TextPart {
  return (
    typeof p === "object" &&
    p !== null &&
    "type" in p &&
    (p as { type: unknown }).type === "text"
  );
}

function isToolPart(p: unknown): boolean {
  return (
    typeof p === "object" &&
    p !== null &&
    "type" in p &&
    typeof (p as { type: unknown }).type === "string" &&
    ((p as { type: string }).type.startsWith("tool-") ||
      (p as { type: string }).type === "dynamic-tool")
  );
}

function MessageBubble({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";
  const parts = message.parts as unknown[];

  // Rendering strategy for assistant messages with tool calls:
  //   - SHOW text parts that appear BEFORE the first tool call (the bridge)
  //   - SHOW text parts that appear AFTER the last tool call (the final
  //     summary, e.g. "I planned around October 9-12…")
  //   - HIDE middle text (inner monologue like "Let me search for X...")
  //   - Render bridge and final as TWO SEPARATE bubbles so the summary
  //     doesn't butt up against the bridge.
  const hasTool = parts.some(isToolPart);
  const bridgeTextParts: TextPart[] = [];
  let finalTextParts: TextPart[] = [];
  if (isUser || !hasTool) {
    // User message or single-step assistant: everything is "final"
    finalTextParts = parts.filter(isTextPart);
  } else {
    let firstToolIdx = -1;
    let lastToolIdx = -1;
    for (let i = 0; i < parts.length; i++) {
      if (isToolPart(parts[i])) {
        if (firstToolIdx === -1) firstToolIdx = i;
        lastToolIdx = i;
      }
    }
    for (let i = 0; i < firstToolIdx; i++) {
      if (isTextPart(parts[i])) bridgeTextParts.push(parts[i] as TextPart);
    }
    for (let i = lastToolIdx + 1; i < parts.length; i++) {
      if (isTextPart(parts[i])) finalTextParts.push(parts[i] as TextPart);
    }
  }

  // If the assistant message has no visible text at all (pure tool-only
  // completion with no bridge/final text), suppress it.
  if (!isUser && bridgeTextParts.length === 0 && finalTextParts.length === 0) {
    return null;
  }

  const bubbleClass = isUser
    ? "max-w-[85%] rounded-2xl rounded-br-md bg-neutral-900 px-4 py-2.5 text-sm text-white"
    : "max-w-[92%] text-sm leading-relaxed text-neutral-800";
  const alignClass = isUser ? "flex justify-end" : "flex justify-start";

  return (
    <>
      {bridgeTextParts.length > 0 && (
        <div className={alignClass}>
          <div className={bubbleClass}>
            {bridgeTextParts.map((p, i) => (
              <span key={i} className="whitespace-pre-wrap">
                {p.text}
              </span>
            ))}
          </div>
        </div>
      )}
      {finalTextParts.length > 0 && (
        <div className={alignClass}>
          <div className={bubbleClass}>
            {finalTextParts.map((p, i) => (
              <span key={i} className="whitespace-pre-wrap">
                {p.text}
              </span>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
