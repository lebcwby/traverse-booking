"use client";
// src/components/plan/plan-client.tsx
// Top-level client component for /plan. Owns the useChat state and derives
// the current itinerary from the assistant's tool calls.
//
// Two layout modes:
//   INTERVIEW — chat is centered on screen (like ChatGPT) while the
//               concierge is asking the user questions. Clean, focused,
//               conversational.
//   BUILDING  — once the agent starts calling tools, chat slides to a
//               narrow sidebar on the left and the itinerary view appears
//               on the right. Triggered by the first tool-call part in
//               any assistant message. Once latched, never reverts.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import {
  BookOpen,
  Building2,
  Heart,
  Home,
  Luggage,
  Mail,
  MapPin,
  Menu,
  LogOut,
  Tag,
  User,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase-auth";
import {
  ChatPanel,
  PLACEHOLDER_PROMPTS,
  useTypewriterPlaceholder,
} from "./chat-panel";
import { ItineraryView } from "./itinerary-view";
import { PortlandAnimation } from "./portland-animation";
import { PlanBuildProgress } from "./plan-build-progress";
import { PlanTopBar } from "./plan-top-bar";
import { PlanContextSidebar } from "./plan-context-sidebar";
import { PlanLanding } from "./plan-landing";
import { PlanMobileActionBar } from "./plan-mobile-action-bar";
import type { PopularIdea } from "@/lib/plan/popular-ideas";
import type { Itinerary } from "@/lib/plan/schema";

const CHAT_TRANSPORT = new DefaultChatTransport({ api: "/api/plan/chat" });

function PlanMobileHeader() {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null);
    });
    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  return (
    <div className="flex h-12 shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-4 lg:hidden">
      <Link href="/plan" className="flex items-center">
        <Image
          src="/book-traverse-icon.png"
          alt="Book Traverse"
          width={28}
          height={32}
          className="h-7 w-auto"
        />
      </Link>

      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-600 transition hover:bg-neutral-100"
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full z-50 mt-1 w-64 rounded-xl border border-neutral-200 bg-white py-1 shadow-lg">
            <Link
              href="/"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50"
            >
              <Home className="h-4 w-4" /> Home
            </Link>
            <Link
              href="/properties"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50"
            >
              <Building2 className="h-4 w-4" /> Browse Properties
            </Link>
            <Link
              href="/guide"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50"
            >
              <BookOpen className="h-4 w-4" /> Travel Guide
            </Link>
            <Link
              href="/neighborhoods"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50"
            >
              <MapPin className="h-4 w-4" /> Neighborhoods
            </Link>
            <Link
              href="/book-direct"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50"
            >
              <Tag className="h-4 w-4" /> Why Book Direct
            </Link>
            <Link
              href="/contact"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50"
            >
              <Mail className="h-4 w-4" /> Contact
            </Link>
            <div className="mx-3 my-1 border-t border-neutral-100" />
            {userEmail ? (
              <>
                <Link
                  href="/account/wishlists"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50"
                >
                  <Heart className="h-4 w-4" /> Wishlists
                </Link>
                <Link
                  href="/account/reservations"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50"
                >
                  <Luggage className="h-4 w-4" /> Trips
                </Link>
                <div className="mx-3 my-1 border-t border-neutral-100" />
                <button
                  onClick={async () => {
                    setMenuOpen(false);
                    await supabase.auth.signOut();
                    router.refresh();
                  }}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-neutral-700 hover:bg-neutral-50"
                >
                  <LogOut className="h-4 w-4" /> Log out
                </button>
              </>
            ) : (
              <Link
                href="/login"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50"
              >
                <User className="h-4 w-4" /> Log in
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Progressive itinerary extraction. Prefers the enriched server output (which
// has availableListings from BEAPI), but falls through to the agent's raw
// INPUT as soon as it's complete — so the day cards, POIs, and map render
// ~2–5s earlier, while the server is still running BEAPI in the execute
// handler. The property sidebar's own cascade fills in rentals in parallel.
function extractLatestItinerary(messages: UIMessage[]): Itinerary | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (!msg || msg.role !== "assistant") continue;
    for (let j = msg.parts.length - 1; j >= 0; j--) {
      const part = msg.parts[j] as unknown as {
        type?: string;
        state?: string;
        input?: Itinerary;
        output?: { ok?: boolean; itinerary?: Itinerary } | unknown;
      };
      if (!part || part.type !== "tool-generate_itinerary") continue;

      // Preferred: enriched server output with availableListings.
      if (part.state === "output-available") {
        const out = part.output as
          | { ok?: boolean; itinerary?: Itinerary }
          | undefined;
        if (out && out.itinerary && out.itinerary.days) {
          return out.itinerary;
        }
      }

      // Progressive fallback: show the raw input the moment the agent finishes
      // writing it, even before the server-side execute (BEAPI + ranking) has
      // returned. The agent's input already contains days + POIs — the only
      // thing missing is availableListings, which the client sidebar fetches
      // on its own in parallel.
      if (
        part.state === "input-available" ||
        part.state === "output-streaming"
      ) {
        const input = part.input;
        if (input && Array.isArray(input.days) && input.days.length > 0) {
          return input;
        }
      }
    }
  }
  return null;
}

interface PlanClientProps {
  initialPlanId?: string;
  initialMessages?: UIMessage[];
}

export function PlanClient({
  initialPlanId,
  initialMessages,
}: PlanClientProps = {}) {
  const router = useRouter();
  const [input, setInput] = useState("");
  // Switch to sidebar layout after the first message so the right pane
  // can show engaging visuals during the interview. Latches — never reverts.
  // `transitioning` keeps both layers mounted during the 500ms crossfade.
  // Seed directly from initialMessages so a shared /plan/[id] renders the
  // itinerary view on first paint instead of flashing the hero.
  const hadInitial = (initialMessages?.length ?? 0) > 0;
  const [isSidebar, setIsSidebar] = useState(hadInitial);
  const [transitioning, setTransitioning] = useState(false);
  const latchedRef = useRef(hadInitial);

  const { messages, sendMessage, status, error, stop } = useChat({
    transport: CHAT_TRANSPORT,
    messages: initialMessages,
    onError: (err) => {
      console.error("[/plan] chat error:", err);
    },
  });

  const itinerary = useMemo(() => extractLatestItinerary(messages), [messages]);

  // Typewriter placeholder for the hero textarea. Only animates in hero mode —
  // once the conversation latches into sidebar mode, the hero input is unmounted.
  const animatedHeroPlaceholder = useTypewriterPlaceholder(
    PLACEHOLDER_PROMPTS,
    !isSidebar
  );
  const heroPlaceholder =
    animatedHeroPlaceholder || "Tell me about your trip...";

  // Detect when the agent is ACTIVELY generating — tool calls started AND at
  // least one is still mid-flight (anything other than output-available /
  // output-error). On mobile this swaps the chat for a loading animation; if
  // the only tool parts are terminal-failed, we must NOT hide the chat,
  // otherwise the user has no composer to retry from.
  const mobileGenerating = useMemo(() => {
    if (itinerary) return false;
    if (status === "streaming" || status === "submitted") return true;
    return messages.some((msg) => {
      if (msg.role !== "assistant") return false;
      return (msg.parts as unknown[]).some((p) => {
        if (typeof p !== "object" || p === null) return false;
        const type = (p as { type?: unknown }).type;
        const state = (p as { state?: unknown }).state;
        if (typeof type !== "string" || !type.startsWith("tool-")) return false;
        return state !== "output-available" && state !== "output-error";
      });
    });
  }, [messages, itinerary, status]);

  useEffect(() => {
    if (!latchedRef.current && messages.length > 0) {
      latchedRef.current = true;
      setTransitioning(true);
      const timer = setTimeout(() => {
        setIsSidebar(true);
        setTransitioning(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [messages]);

  // ── Server-side persistence ────────────────────────────────────────
  // Plans are saved to sp_plans so refresh + shareable /plan/[id] URLs
  // work. Messages are the source of truth — the itinerary is derived.
  // Saves fire ~800ms after each settled assistant message.
  const planIdRef = useRef<string | null>(initialPlanId ?? null);
  const lastSavedLenRef = useRef<number>(initialMessages?.length ?? 0);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const savePlan = useCallback(
    async (snapshot: UIMessage[]) => {
      try {
        const res = await fetch("/api/plan/state", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: planIdRef.current ?? undefined,
            messages: snapshot,
          }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as { id?: string };
        if (data.id && !planIdRef.current) {
          planIdRef.current = data.id;
          router.push(`/plan/${data.id}`, { scroll: false });
        }
      } catch {
        // Best-effort — don't break the chat on save failures.
      }
    },
    [router]
  );

  useEffect(() => {
    if (messages.length === 0) return;
    if (status === "streaming" || status === "submitted") return;
    if (messages.length === lastSavedLenRef.current && planIdRef.current) {
      return;
    }
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      lastSavedLenRef.current = messages.length;
      void savePlan(messages);
    }, 800);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [messages, status, savePlan]);

  const handleSubmit = useCallback(
    (text: string) => {
      if (!text.trim() || status === "streaming" || status === "submitted") {
        return;
      }
      sendMessage({ text: text.trim() });
      setInput("");
    },
    [sendMessage, status]
  );

  // Popular-trip-idea cards ship with a cacheKey. We try /api/plan/from-template
  // first — on a ≤7-day-old cache hit the server clones the cached plan into a
  // fresh sp_plans row and we router.push to it in ~200ms, skipping the live
  // agent entirely. On miss (or any error) we fall through to the live flow.
  // Template writes are server-only (seed script); browsers never promote.
  const handlePickPremade = useCallback(
    async (idea: PopularIdea) => {
      if (status === "streaming" || status === "submitted") return;
      try {
        const res = await fetch("/api/plan/from-template", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cacheKey: idea.cacheKey }),
        });
        if (res.ok) {
          const data = (await res.json()) as {
            id?: string | null;
            hit?: boolean;
          };
          if (data.hit && data.id) {
            router.push(`/plan/${data.id}`);
            return;
          }
        }
      } catch {
        // fall through to live agent
      }
      handleSubmit(idea.prompt);
    },
    [handleSubmit, router, status]
  );

  const chatHeader = (
    <div className="border-b border-neutral-200 px-5 py-3">
      <div className="text-xs font-medium leading-snug text-neutral-700">
        Where Portlanders eat, drink and hang out
      </div>
    </div>
  );

  // ── Unified render: hero and sidebar as crossfading layers ─────────
  return (
    <div data-plan-chrome className="flex h-full w-full flex-col">
      {/* Site nav surfaces only live alongside the sidebar/workspace.
        Landing mode renders its own full-width top bar inside PlanLanding. */}
      {isSidebar && <PlanMobileHeader />}
      {isSidebar && <PlanTopBar itinerary={itinerary} />}
      <div className="relative flex-1 overflow-hidden">
        {/* Landing layer — redesigned hero (top bar, 2-col, green input,
          trust bar). Crossfades with the sidebar layer during the 500ms
          transition after the first message. */}
        {!isSidebar && (
          <div
            className={`absolute inset-0 z-40 transition-opacity duration-500 ${
              transitioning ? "pointer-events-none opacity-0" : "opacity-100"
            }`}
          >
            <PlanLanding
              input={input}
              onInputChange={setInput}
              onSubmit={handleSubmit}
              onPickPremade={handlePickPremade}
              placeholder={heroPlaceholder}
            />
          </div>
        )}

        {/* Sidebar layer — split pane. Mounts during transition, fades in. */}
        {(isSidebar || transitioning) && (
          <div className="absolute inset-0 flex h-full w-full flex-col duration-500 ease-out animate-in fade-in slide-in-from-bottom-4 lg:flex-row">
            {/* ── Left workspace / chat section ──
              Desktop: always visible. Shows the chat during the interview,
              then swaps to the plan-context workspace once an itinerary
              lands (prompt recap + refine chips + follow-up composer).
              Mobile: visible during interview only. Hidden once generating
              or once an itinerary is ready. */}
            <section
              data-plan-chat
              className={`h-full w-full flex-col border-b border-neutral-200 bg-neutral-50 lg:w-[320px] lg:shrink-0 lg:border-b-0 lg:border-r xl:w-[340px] ${
                mobileGenerating || itinerary
                  ? "hidden lg:flex"
                  : "flex lg:flex"
              }`}
            >
              {itinerary ? (
                <PlanContextSidebar
                  itinerary={itinerary}
                  messages={messages}
                  status={status}
                  input={input}
                  onInputChange={setInput}
                  onSubmit={handleSubmit}
                  onRefine={handleSubmit}
                />
              ) : (
                <>
                  {chatHeader}
                  <ChatPanel
                    messages={messages}
                    status={status}
                    error={error}
                    input={input}
                    onInputChange={setInput}
                    onSubmit={handleSubmit}
                    onStop={stop}
                    keyboardOffset={0}
                  />
                </>
              )}
            </section>

            {/* ── Mobile loading screen ──
              Shown while the agent is calling tools (search_pois + generate_itinerary).
              The PortlandAnimation footer slot carries live progress pills so the
              user can see real forward motion instead of a static spinner. */}
            {mobileGenerating && !itinerary && (
              <div className="flex h-full w-full flex-col items-center justify-center bg-neutral-50 lg:hidden">
                <PortlandAnimation
                  footerSlot={<PlanBuildProgress messages={messages} />}
                />
              </div>
            )}

            {/* ── Mobile itinerary (full-screen) ──
              Replaces the loading screen once the itinerary is ready.
              Follow-up composer + refine chips live in the sticky
              PlanMobileActionBar below so the timeline is always at the
              top of the scroll area. */}
            {itinerary && (
              <>
                <section className="flex-1 overflow-y-auto bg-neutral-50 lg:hidden">
                  <ItineraryView
                    itinerary={itinerary}
                    status={status}
                    onRefine={handleSubmit}
                  />
                </section>
                <PlanMobileActionBar
                  input={input}
                  onInputChange={setInput}
                  onSubmit={handleSubmit}
                  onRefine={handleSubmit}
                  busy={status === "streaming" || status === "submitted"}
                />
              </>
            )}

            {/* ── Desktop itinerary (right pane) ──
              Always in the DOM on lg+; shows animation while generating,
              then the itinerary once ready. During building, the
              PortlandAnimation footer slot shows live progress pills. */}
            <section
              data-plan-itinerary
              className="hidden flex-1 overflow-y-auto bg-neutral-50 lg:block"
            >
              {itinerary ? (
                <ItineraryView
                  itinerary={itinerary}
                  status={status}
                  onRefine={handleSubmit}
                />
              ) : (
                <PortlandAnimation
                  footerSlot={
                    mobileGenerating ? (
                      <PlanBuildProgress messages={messages} />
                    ) : undefined
                  }
                />
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
