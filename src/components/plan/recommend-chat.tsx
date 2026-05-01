"use client";
// src/components/plan/recommend-chat.tsx
// ChatGPT-style single-column chat for the /plan/chat recommender surface.
// Different surface from the trip-planner /plan: no itinerary, no day cards,
// no booking sidebar — the assistant just calls search_pois and the UI
// renders a grid of POI cards inline with each assistant turn.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Dancing_Script } from "next/font/google";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import {
  ArrowRight,
  ArrowUp,
  Bookmark,
  Check,
  CheckCircle2,
  Coffee,
  GlassWater,
  Heart,
  Loader2,
  LogIn,
  Mail,
  MapPin,
  Mountain,
  Plus,
  Share2,
  Sparkles,
  Star,
  StopCircle,
  Truck,
  User as UserIcon,
  Utensils,
  X,
} from "lucide-react";
import type { Poi } from "@/lib/pois/types";
import { createClient } from "@/lib/supabase-auth";
import { EXAMPLE_QUESTIONS } from "@/lib/plan/recommend-questions";

// Brand script font for the headline accent — matches /plan landing,
// /no-fees hero, and the rest of the Book Traverse identity system.
const script = Dancing_Script({
  subsets: ["latin"],
  weight: ["600", "700"],
});

const CHAT_TRANSPORT = new DefaultChatTransport({
  api: "/api/plan/recommend",
});

interface Starter {
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  prompt: string;
}

// Starter prompts — every label has been audit-mapped to actual sp_pois
// catalog coverage so the chat never returns "no results" on a hero card.
// "Natural wine bars" was originally here and got cut: zero matches in the
// catalog. Cocktail bars (26+) and food carts (18+) are the replacements.
const STARTERS: Starter[] = [
  {
    icon: Utensils,
    label: "Best Italian restaurants",
    prompt: "What are the best Italian restaurants in Portland?",
  },
  {
    icon: Coffee,
    label: "Coffee worth a detour",
    prompt: "Which coffee shops in Portland are worth a special trip?",
  },
  {
    icon: GlassWater,
    label: "Best cocktail bars",
    prompt: "Where are the best cocktail bars in Portland?",
  },
  {
    icon: Truck,
    label: "Iconic food cart pods",
    prompt: "What are the best food cart pods in Portland?",
  },
  {
    icon: Heart,
    label: "Date-night restaurants",
    prompt: "Recommend romantic restaurants for a date night in Portland.",
  },
  {
    icon: Mountain,
    label: "Best day trips",
    prompt:
      "What's a great day trip from Portland for someone visiting for the first time?",
  },
];

// Trust pills shown below the starters — mirrors the plan-landing trust row
// pattern so /portland-recommendations and /plan share visual language.
const TRUST_PILLS = [
  { icon: CheckCircle2, bold: "Free forever", detail: "no signup required" },
  { icon: MapPin, bold: "Local picks", detail: "curated by Portlanders" },
  { icon: Bookmark, bold: "Real spots", detail: "places we'd send a friend" },
  { icon: Star, bold: "275+ homes", detail: "if you need a place to stay" },
] as const;

// EXAMPLE_QUESTIONS lives in lib/plan/recommend-questions.ts — both this
// "use client" component and the server page import it from there. Don't
// re-declare it here or the RSC boundary will mangle the array shape on
// import (webpack rewrites the export into a Server Reference indirection).

// ── Tool-output extraction ─────────────────────────────────────────
type SearchPoisOutput = {
  count?: number;
  pois?: Array<{
    id?: string;
    name?: string;
    favorite?: { orderThis?: string; note?: string };
  }>;
};

function getToolPart(
  part: unknown
): { type: string; state?: string; output?: unknown } | null {
  if (typeof part !== "object" || part === null) return null;
  const p = part as { type?: unknown; state?: unknown; output?: unknown };
  if (typeof p.type !== "string") return null;
  return {
    type: p.type,
    state: typeof p.state === "string" ? p.state : undefined,
    output: p.output,
  };
}

function extractPoiIdsAndFavorites(msg: UIMessage): {
  ids: string[];
  favorites: Map<string, { orderThis?: string; note?: string }>;
} {
  const ids: string[] = [];
  const favorites = new Map<string, { orderThis?: string; note?: string }>();
  if (msg.role !== "assistant") return { ids, favorites };
  for (const part of msg.parts as unknown[]) {
    const tp = getToolPart(part);
    if (!tp || tp.type !== "tool-search_pois") continue;
    if (tp.state !== "output-available") continue;
    const out = tp.output as SearchPoisOutput | undefined;
    for (const poi of out?.pois ?? []) {
      if (!poi.id || ids.includes(poi.id)) continue;
      ids.push(poi.id);
      if (poi.favorite) favorites.set(poi.id, poi.favorite);
    }
  }
  return { ids, favorites };
}

// ── Top-level POI hydration cache ──────────────────────────────────
// Single fetch per new id across the whole conversation. Pass the cache
// down to each MessageBubble so cards can render as soon as their POIs
// land.
//
// Important: we do NOT cancel in-flight fetches on effect re-runs. During
// streaming, every text-delta updates `messages` and re-runs this effect.
// If we cancelled the fetch, cards would stay as skeletons forever because
// the hydration call is killed before it can populate the cache. Instead
// we dedupe by id (cache + inFlightRef) and let every kicked-off fetch
// resolve. setCache is functional, so concurrent fetches merge cleanly.
function usePoiCache(messages: UIMessage[]): Record<string, Poi> {
  const [cache, setCache] = useState<Record<string, Poi>>({});
  const inFlightRef = useRef<Set<string>>(new Set());

  // Collect every POI id referenced by any assistant message tool call.
  // The Set + sort gives a stable string identity we can use as a useEffect
  // dep — we only kick off a hydration when the *set* of ids actually grows.
  const allIds = useMemo(() => {
    const set = new Set<string>();
    for (const msg of messages) {
      const { ids } = extractPoiIdsAndFavorites(msg);
      for (const id of ids) set.add(id);
    }
    return Array.from(set).sort();
  }, [messages]);
  const allIdsKey = allIds.join(",");

  useEffect(() => {
    const wanted = allIds.filter(
      (id) => !cache[id] && !inFlightRef.current.has(id)
    );
    if (wanted.length === 0) return;
    const batch = wanted.slice(0, 50);
    for (const id of batch) inFlightRef.current.add(id);

    fetch("/api/plan/pois", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: batch }),
    })
      .then((r) => r.json())
      .then((data: { pois?: Poi[] }) => {
        setCache((prev) => {
          const next = { ...prev };
          for (const p of data.pois ?? []) next[p.id] = p;
          return next;
        });
      })
      .catch(() => {
        // best-effort — cards just stay in skeleton state
      })
      .finally(() => {
        for (const id of batch) inFlightRef.current.delete(id);
      });
    // allIdsKey is the stable dep; cache changes naturally re-run when new
    // ids land. We intentionally do NOT depend on `cache` because that would
    // re-run on every successful merge.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allIdsKey]);

  return cache;
}

// ── Main client ─────────────────────────────────────────────────────
interface RecommendChatProps {
  initialId?: string;
  initialMessages?: UIMessage[];
}

export function RecommendChat({
  initialId,
  initialMessages,
}: RecommendChatProps = {}) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status, error, stop, setMessages } = useChat({
    transport: CHAT_TRANSPORT,
    messages: initialMessages,
    onError: (err) => {
      console.error("[/portland-recommendations] chat error:", err);
    },
  });

  const poiCache = usePoiCache(messages);

  const busy = status === "streaming" || status === "submitted";
  const isEmpty = messages.length === 0;

  // ── Auto-save / persistence ──────────────────────────────────────
  // Reuses the trip-planner /api/plan/state endpoint — both surfaces
  // store anonymous UIMessage[] arrays in sp_plans keyed by uuid. After
  // the first save, we push the uuid into the URL so refresh + share
  // keep working.
  const planIdRef = useRef<string | null>(initialId ?? null);
  const lastSavedLenRef = useRef<number>(initialMessages?.length ?? 0);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Re-render trigger so the share/email buttons un-disable the moment a
  // planId mints — the ref alone won't trigger React updates.
  const [planIdReady, setPlanIdReady] = useState<string | null>(
    initialId ?? null
  );

  const handleSubmit = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || busy) return;
      sendMessage({ text: trimmed });
      setInput("");
    },
    [busy, sendMessage]
  );

  const handleNewChat = useCallback(() => {
    if (busy) stop();
    setMessages([]);
    setInput("");
    planIdRef.current = null;
    setPlanIdReady(null);
    lastSavedLenRef.current = 0;
    router.push("/portland-recommendations", { scroll: false });
  }, [busy, setMessages, stop, router]);

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
          setPlanIdReady(data.id);
          router.push(`/portland-recommendations/${data.id}`, {
            scroll: false,
          });
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

  // ── Auth state ───────────────────────────────────────────────────
  // Anonymous saves work fine (the planId-in-URL is the share key), but
  // a logged-in user gets a "Saved to your account" affordance instead of
  // the "Sign in to keep it" pitch. Read once on mount + listen for changes.
  const [userEmail, setUserEmail] = useState<string | null>(null);
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      setUserEmail(data.user?.email ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserEmail(session?.user?.email ?? null);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  // ── Share / Email modals ─────────────────────────────────────────
  const [shareCopied, setShareCopied] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);

  // Latest assistant message that produced POI cards — drives the email send.
  const latestRecsMessageId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role !== "assistant") continue;
      const { ids } = extractPoiIdsAndFavorites(m);
      if (ids.length > 0) return m.id;
    }
    return null;
  }, [messages]);

  const handleShare = useCallback(async () => {
    if (!planIdReady) return;
    const url = `${window.location.origin}/portland-recommendations/${planIdReady}`;
    const shareData = {
      title: "Portland Recommendations",
      text: "Local Portland picks from Book Traverse",
      url,
    };
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // User dismissed — fall through to clipboard so they still get a URL.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch {
      // No clipboard — last resort: select the URL in a prompt.
      window.prompt("Copy this link to share:", url);
    }
  }, [planIdReady]);

  // Anchor the latest *user* message to the top of the scroll area when it
  // arrives, then leave the viewport alone while the assistant streams in
  // below. ChatGPT/Claude pattern — prevents the page from being yanked to
  // the bottom on every text-delta. Triggered by the id of the newest user
  // message, not the message array, so streaming text doesn't re-fire it.
  const latestUserId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") return messages[i].id;
    }
    return null;
  }, [messages]);
  useEffect(() => {
    const root = scrollRef.current;
    if (!root || !latestUserId) return;
    const node = root.querySelector<HTMLElement>(
      `[data-msg-id="${CSS.escape(latestUserId)}"]`
    );
    if (!node) return;
    // requestAnimationFrame so the DOM has actually painted before measuring.
    requestAnimationFrame(() => {
      const rootRect = root.getBoundingClientRect();
      const nodeRect = node.getBoundingClientRect();
      const target = root.scrollTop + (nodeRect.top - rootRect.top) - 16;
      root.scrollTo({ top: target, behavior: "smooth" });
    });
  }, [latestUserId]);

  const canShare = Boolean(planIdReady);
  const canEmail = Boolean(latestRecsMessageId);

  return (
    <div data-plan-chrome className="flex h-full w-full flex-col bg-[#faf8f5]">
      {/* ── Top bar ─────────────────────────────────── */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-[#1c1d1d]/[0.06] bg-[#faf8f5]/95 px-3 backdrop-blur-md sm:h-14 sm:px-6">
        <Link
          href="/portland-recommendations"
          className="flex items-center"
          aria-label="Portland Recommendations home"
        >
          <Image
            src="/book-traverse-wordmark-dark.png"
            alt="Book Traverse"
            width={150}
            height={40}
            priority
            className="h-7 w-auto sm:h-8"
          />
        </Link>
        {/* Mobile rule: every interactive element is at least 36px tall so
            it clears Apple's 44pt safe-tap budget once the touch slop is
            included. Email + Share were sm:inline-flex previously — they're
            now icon-only on mobile so capture / share work without scrolling
            up to a hidden menu. New-chat + Sign-in stay desktop-only to keep
            the bar uncluttered on a 360px viewport. */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {canEmail && (
            <button
              type="button"
              onClick={() => setEmailModalOpen(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[#e6e3dd] bg-white px-2.5 text-[12.5px] font-semibold text-[#1c1d1d] transition hover:border-[#2d3e2c] hover:bg-white sm:px-3"
              aria-label="Email these picks"
            >
              <Mail className="h-4 w-4" strokeWidth={2.4} />
              <span className="hidden sm:inline">Email</span>
            </button>
          )}
          {canShare && (
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[#e6e3dd] bg-white px-2.5 text-[12.5px] font-semibold text-[#1c1d1d] transition hover:border-[#2d3e2c] hover:bg-white sm:px-3"
              aria-label={shareCopied ? "Link copied" : "Share"}
            >
              {shareCopied ? (
                <>
                  <Check className="h-4 w-4" strokeWidth={2.6} />
                  <span className="hidden sm:inline">Copied</span>
                </>
              ) : (
                <>
                  <Share2 className="h-4 w-4" strokeWidth={2.4} />
                  <span className="hidden sm:inline">Share</span>
                </>
              )}
            </button>
          )}
          {!isEmpty && (
            <button
              type="button"
              onClick={handleNewChat}
              className="hidden h-9 items-center gap-1.5 rounded-full border border-[#e6e3dd] bg-white px-3 text-[12.5px] font-semibold text-[#1c1d1d] transition hover:border-[#2d3e2c] hover:bg-white sm:inline-flex"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.4} />
              New chat
            </button>
          )}
          {userEmail ? (
            <span
              className="hidden h-9 items-center gap-1.5 rounded-full bg-[#efe9df] px-3 text-[12px] font-semibold text-[#2d3e2c] sm:inline-flex"
              title={userEmail}
            >
              <UserIcon className="h-3.5 w-3.5" strokeWidth={2.4} />
              <span className="max-w-[140px] truncate">{userEmail}</span>
            </span>
          ) : (
            <Link
              href={
                planIdReady
                  ? `/login?redirect=/portland-recommendations/${planIdReady}`
                  : "/login?redirect=/portland-recommendations"
              }
              className="hidden h-9 items-center gap-1.5 rounded-full border border-[#e6e3dd] bg-white px-3 text-[12.5px] font-semibold text-[#1c1d1d] transition hover:border-[#2d3e2c] hover:bg-white sm:inline-flex"
            >
              <LogIn className="h-3.5 w-3.5" strokeWidth={2.4} />
              Sign in
            </Link>
          )}
          <Link
            href="/properties"
            aria-label="Find a stay"
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#2d3e2c] px-3 text-[12.5px] font-semibold text-white transition hover:bg-[#384e36] sm:px-3.5"
          >
            <span className="hidden sm:inline">Find a stay</span>
            <span className="sm:hidden">Stays</span>
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.4} />
          </Link>
        </div>
      </header>
      {emailModalOpen && latestRecsMessageId && (
        <EmailPicksModal
          messageId={latestRecsMessageId}
          chatId={planIdReady ?? null}
          poiCache={poiCache}
          messages={messages}
          defaultEmail={userEmail ?? ""}
          onClose={() => setEmailModalOpen(false)}
        />
      )}

      {/* ── Scrollable transcript ───────────────────── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {isEmpty ? (
          <EmptyState onPick={handleSubmit} />
        ) : (
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-3 py-4 sm:gap-6 sm:px-6 sm:py-8">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} poiCache={poiCache} />
            ))}
            {busy && <ThinkingIndicator messages={messages} status={status} />}
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                Something went wrong: {error.message}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Composer (sticky at bottom) ─────────────── */}
      {/* env(safe-area-inset-bottom) keeps the send button above the iOS
          home-bar handle. Hide the trailing trust line on mobile so the
          composer + textarea claim more vertical space when the keyboard
          is up. */}
      <div
        className="shrink-0 border-t border-neutral-200 bg-[#faf8f5] px-3 pb-3 pt-2 sm:px-6 sm:pb-4 sm:pt-3"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto w-full max-w-3xl">
          <Composer
            value={input}
            onChange={setInput}
            onSubmit={handleSubmit}
            onStop={stop}
            busy={busy}
            isEmpty={isEmpty}
          />
          <p className="mt-2 hidden text-center text-[11px] text-neutral-500 sm:block">
            Picks come from the Book Traverse team&rsquo;s curated catalog of
            local spots.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────
// Brand-aligned hero with forest gradient + cream body, mirrors the
// /plan landing identity (Dancing Script accent, gold "ask" word, trust
// pills, popular-asks card grid). The chat composer is sticky below this
// — these starter cards are the primary above-the-fold conversion path.
function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="flex w-full flex-col bg-[#faf8f5]">
      {/* ── HERO ─────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/no-fees/img/hero-desktop.jpg"
            alt=""
            className="h-full w-full object-cover"
            style={{ objectPosition: "center 60%" }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(115deg, rgba(45, 62, 44, 0.86) 0%, rgba(45, 62, 44, 0.7) 55%, rgba(45, 62, 44, 0.45) 100%)",
            }}
          />
        </div>

        <div className="relative mx-auto w-full max-w-3xl px-4 pb-4 pt-4 text-white sm:px-6 sm:pb-7 sm:pt-8">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.12em] text-white backdrop-blur">
            <Sparkles className="h-3 w-3 text-[#f2c070]" strokeWidth={2.4} />
            Free Local Recommender
          </span>

          <h1
            className="mt-2.5 font-bold leading-[1.05] tracking-[-0.015em] text-white sm:mt-3"
            style={{
              fontSize: "clamp(20px, 4vw, 36px)",
              textShadow: "0 2px 24px rgba(0,0,0,0.25)",
            }}
          >
            Ask a Portland{" "}
            <em
              className={script.className}
              style={{
                fontStyle: "italic",
                fontWeight: 700,
                color: "#f2c070",
                fontSize: "1.12em",
              }}
            >
              local
            </em>
            . Get the short list back.
          </h1>

          <p className="mt-2 max-w-[560px] text-[13px] leading-[1.45] text-white/92 sm:text-[14.5px] sm:leading-[1.5]">
            Cuisine, neighborhood, vibe — just tell us. We&apos;ve hosted{" "}
            <strong className="font-bold text-[#f2c070]">80,000+ guests</strong>{" "}
            across 275+ Portland stays, so we know what&apos;s actually worth
            your time.
          </p>
        </div>
      </section>

      {/* ── POPULAR ASKS ─────────────────────────── */}
      {/* Mobile: 2-col grid w/ icon-above-label so each card is half-width
          and the user can see all 6 starters at once instead of scrolling
          through 6 stacked rows. Desktop: 2-col rows w/ icon-left-label. */}
      <section className="mx-auto w-full max-w-3xl px-4 pt-3 sm:px-6 sm:pt-5">
        <div className="flex items-center gap-2">
          <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-[#2d3e2c]">
            Try one of these
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-[#f2c070] px-1.5 py-[2px] text-[9px] font-extrabold uppercase tracking-[0.1em] text-[#1c1d1d]">
            Instant
          </span>
        </div>

        <div className="mt-2.5 grid grid-cols-2 gap-2 sm:mt-3 sm:grid-cols-2">
          {STARTERS.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => onPick(s.prompt)}
              className="group relative flex flex-col items-start gap-2 rounded-[10px] border border-[#e6e3dd] bg-white p-3 text-left transition hover:-translate-y-0.5 hover:border-[#2d3e2c] hover:shadow-[0_10px_28px_rgba(28,29,29,0.08)] sm:flex-row sm:items-center sm:gap-3"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#efe9df] text-[#2d3e2c] transition group-hover:bg-[#2d3e2c] group-hover:text-[#f2c070] sm:h-9 sm:w-9">
                <s.icon className="h-4 w-4" strokeWidth={2} />
              </span>
              <span className="flex-1 text-[12.5px] font-semibold leading-snug text-[#1c1d1d] sm:text-[13.5px] sm:font-medium">
                {s.label}
              </span>
              <ArrowRight
                className="hidden h-4 w-4 shrink-0 text-[#8b8e90] transition group-hover:translate-x-0.5 group-hover:text-[#2d3e2c] sm:block"
                strokeWidth={2}
              />
            </button>
          ))}
        </div>
      </section>

      {/* ── WHAT OTHERS ASK ──────────────────────────
          Rotating long-tail prompts — 4 visible at a time, cycles through
          the full EXAMPLE_QUESTIONS list every 5s. Fills the previously
          dead vertical space on tall mobile viewports without tipping the
          page into "selling too soon" (the curated list compounds the chat
          affordance, doesn't surface a second commercial CTA). */}
      <WhatOthersAsk onPick={onPick} />

      {/* ── TRUST PILLS ─────────────────────────── */}
      {/* Hide the long-form pills on mobile — the headline + 80k-guests
          stat in the hero already carry the trust signal, and the
          composer + starters need the vertical space. Re-show on sm+. */}
      <section className="mx-auto hidden w-full max-w-3xl px-4 pb-5 pt-4 sm:block sm:px-6 sm:pb-6 sm:pt-5">
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-[11.5px] text-[#2a2b2b]">
          {TRUST_PILLS.map(({ icon: Icon, bold, detail }) => (
            <div
              key={bold}
              className="inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Icon className="h-3.5 w-3.5 text-[#2d3e2c]" strokeWidth={2.2} />
              <span>
                <strong className="font-bold text-[#1c1d1d]">{bold}</strong> —{" "}
                {detail}
              </span>
            </div>
          ))}
        </div>
      </section>
      {/* Bottom spacer on mobile so starters don't kiss the composer */}
      <div className="h-3 sm:hidden" />
    </div>
  );
}

// ── What others ask (rotating long-tail prompts) ──────────────────
// 4 question pills visible at a time, fades through the full
// EXAMPLE_QUESTIONS list every ~5 s. ALL questions are mirrored into a
// .sr-only <ul> so search crawlers see the full breadth on first paint
// (rotation is JS-driven; without the mirror, only the initial 4 would
// be in the SSR HTML). Pair this with the FAQPage JSON-LD on
// /portland-recommendations/page.tsx — that's the structured route Google
// uses to surface the page for these queries. Respects
// prefers-reduced-motion: skips the rotation entirely for those users.
function WhatOthersAsk({ onPick }: { onPick: (text: string) => void }) {
  const PAGE_SIZE = 4;
  const totalPages = Math.ceil(EXAMPLE_QUESTIONS.length / PAGE_SIZE);
  const [page, setPage] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (reduce) return;
    const id = setInterval(() => {
      setFading(true);
      // Match the CSS opacity-transition duration before swapping the slice.
      window.setTimeout(() => {
        setPage((p) => (p + 1) % totalPages);
        setFading(false);
      }, 280);
    }, 5000);
    return () => clearInterval(id);
  }, [totalPages]);

  const visible = EXAMPLE_QUESTIONS.slice(
    page * PAGE_SIZE,
    page * PAGE_SIZE + PAGE_SIZE
  );

  return (
    <section
      aria-labelledby="what-others-ask"
      className="mx-auto w-full max-w-3xl px-4 pt-4 sm:px-6 sm:pt-6"
    >
      <div className="flex items-center gap-2">
        <h2
          id="what-others-ask"
          className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-[#2d3e2c]"
        >
          What others ask
        </h2>
        <span className="inline-flex items-center gap-1 rounded-full bg-[#efe9df] px-1.5 py-[2px] text-[9px] font-extrabold uppercase tracking-[0.1em] text-[#2d3e2c]">
          Live
        </span>
      </div>
      <div
        className={`mt-2.5 grid grid-cols-2 gap-2 transition-opacity duration-300 sm:grid-cols-4 ${
          fading ? "opacity-0" : "opacity-100"
        }`}
      >
        {visible.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => onPick(q)}
            className="group rounded-full border border-[#e6e3dd] bg-white px-3 py-2.5 text-left text-[12px] font-medium text-[#1c1d1d] transition hover:-translate-y-0.5 hover:border-[#2d3e2c] hover:bg-[#efe9df] hover:text-[#2d3e2c] sm:text-[12.5px]"
          >
            {q}
          </button>
        ))}
      </div>
      {/* SEO + a11y mirror: every question is in the rendered HTML so
          crawlers index the breadth, not just whichever 4 happen to be
          on screen at first paint. .sr-only is offscreen but indexed —
          do NOT swap to display:none or aria-hidden, both would defeat
          the purpose. */}
      <ul className="sr-only">
        <li>
          Other Portland recommendation queries our local concierge answers:
        </li>
        {EXAMPLE_QUESTIONS.map((q) => (
          <li key={`sr-${q}`}>{q}</li>
        ))}
      </ul>
    </section>
  );
}

// ── Status indicator ───────────────────────────────────────────────
const TOOL_LABELS: Record<string, string> = {
  search_pois: "Searching the catalog",
};

function getStatusLabel(messages: UIMessage[], status: string): string {
  if (status === "submitted") return "Thinking";
  const last = messages[messages.length - 1];
  if (!last || last.role !== "assistant") return "Thinking";
  const parts = last.parts as unknown[];
  if (parts.length === 0) return "Thinking";
  const lastPart = getToolPart(parts[parts.length - 1]);
  if (lastPart && lastPart.type.startsWith("tool-")) {
    if (
      lastPart.state !== "output-available" &&
      lastPart.state !== "output-error"
    ) {
      const name = lastPart.type.slice("tool-".length);
      return TOOL_LABELS[name] ?? "Searching";
    }
  }
  return "Writing";
}

function ThinkingIndicator({
  messages,
  status,
}: {
  messages: UIMessage[];
  status: string;
}) {
  const label = getStatusLabel(messages, status);
  return (
    <div className="flex items-center gap-2 text-sm text-neutral-500">
      <div className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#2d3e2c] opacity-50" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-[#2d3e2c]" />
      </div>
      <span>{label}…</span>
    </div>
  );
}

// ── Message bubble ─────────────────────────────────────────────────
interface TextPart {
  type: "text";
  text: string;
}
function isTextPart(p: unknown): p is TextPart {
  return (
    typeof p === "object" &&
    p !== null &&
    (p as { type?: unknown }).type === "text" &&
    typeof (p as { text?: unknown }).text === "string"
  );
}
function isToolPart(p: unknown): boolean {
  const tp = getToolPart(p);
  return !!tp && tp.type.startsWith("tool-");
}

function MessageBubble({
  message,
  poiCache,
}: {
  message: UIMessage;
  poiCache: Record<string, Poi>;
}) {
  const isUser = message.role === "user";
  const parts = message.parts as unknown[];

  if (isUser) {
    const text = parts
      .filter(isTextPart)
      .map((p) => p.text)
      .join("\n");
    if (!text) return null;
    return (
      <div className="flex justify-end" data-msg-id={message.id}>
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-[#2d3e2c] px-4 py-2.5 text-[14.5px] text-white">
          {text}
        </div>
      </div>
    );
  }

  // Assistant: split text into bridge (before tool) and final (after tool).
  // POI cards are rendered between bridge and final based on the tool output.
  const hasTool = parts.some(isToolPart);
  let bridgeText = "";
  let finalText = "";
  if (!hasTool) {
    finalText = parts
      .filter(isTextPart)
      .map((p) => p.text)
      .join("\n");
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
      const p = parts[i];
      if (isTextPart(p)) bridgeText += (bridgeText ? "\n" : "") + p.text;
    }
    for (let i = lastToolIdx + 1; i < parts.length; i++) {
      const p = parts[i];
      if (isTextPart(p)) finalText += (finalText ? "\n" : "") + p.text;
    }
  }

  const { ids, favorites } = extractPoiIdsAndFavorites(message);
  const cards = ids.map((id) => poiCache[id]).filter((p): p is Poi => !!p);
  const stillLoading = ids.length > 0 && cards.length < ids.length;

  // Pure tool message with no surrounding text and no rendered cards yet:
  // suppress the bubble so we don't render an empty assistant slot.
  if (!bridgeText && !finalText && cards.length === 0 && ids.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      {bridgeText && <AssistantText text={bridgeText} />}
      {ids.length > 0 && (
        <PoiCardGrid
          cards={cards}
          favorites={favorites}
          loading={stillLoading}
        />
      )}
      {finalText && <AssistantText text={finalText} />}
      {/* Booking nudge — appears once cards have hydrated AND the model has
          finished writing the closing text, so it never lands above the prose
          mid-stream. */}
      {cards.length > 0 && finalText && <NearbyStaysCTA cards={cards} />}
    </div>
  );
}

// ── Lightweight markdown renderer ──────────────────────────────────
// Supports **bold**, line breaks, and bulleted/numbered list lines. Avoids
// pulling in react-markdown for ~1% of its capability.
function renderInline(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIdx) {
      out.push(text.slice(lastIdx, match.index));
    }
    out.push(
      <strong key={`b${key++}`} className="font-semibold text-neutral-900">
        {match[1]}
      </strong>
    );
    lastIdx = match.index + match[0].length;
  }
  if (lastIdx < text.length) out.push(text.slice(lastIdx));
  return out;
}

function AssistantText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="text-[14.5px] leading-relaxed text-neutral-800">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="h-2" aria-hidden />;
        const bulletMatch = trimmed.match(/^(?:[-*•]|\d+\.)\s+(.*)$/);
        if (bulletMatch) {
          return (
            <div key={i} className="flex gap-2 py-0.5">
              <span className="select-none text-neutral-400">•</span>
              <span className="flex-1 whitespace-pre-wrap">
                {renderInline(bulletMatch[1])}
              </span>
            </div>
          );
        }
        return (
          <p key={i} className="whitespace-pre-wrap py-0.5">
            {renderInline(line)}
          </p>
        );
      })}
    </div>
  );
}

// ── POI cards ──────────────────────────────────────────────────────
const CATEGORY_LABEL: Record<string, string> = {
  restaurant: "Restaurant",
  coffee: "Coffee",
  bar: "Bar",
  park: "Park",
  shop: "Shop",
  museum: "Museum",
  viewpoint: "Viewpoint",
  activity: "Activity",
  food_cart_pod: "Food carts",
  transit: "Transit",
};

// Surface-worthy tags that read well as small pills. Filters out audience /
// dietary tags that are noise on a card (kid_friendly/dog_friendly belong in
// the descriptive text the agent emits, not the visual hierarchy).
const TAG_PILL_LABELS: Record<string, string> = {
  romantic: "Romantic",
  splurge: "Splurge",
  cheap_eats: "Cheap eats",
  rooftop: "Rooftop",
  waterfront: "Waterfront",
  view: "View",
  live_music: "Live music",
  hidden_gem: "Hidden gem",
  local_legend: "Local legend",
  outdoor: "Outdoor",
};

function prettifyNeighborhood(slug: string): string {
  return slug
    .split(/[_-]/)
    .filter(Boolean)
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");
}

function PoiCardGrid({
  cards,
  favorites,
  loading,
}: {
  cards: Poi[];
  favorites: Map<string, { orderThis?: string; note?: string }>;
  loading: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {cards.map((poi) => (
        <PoiCard key={poi.id} poi={poi} favorite={favorites.get(poi.id)} />
      ))}
      {loading &&
        Array.from({ length: Math.max(0, 4 - cards.length) }).map((_, i) => (
          <div
            key={`sk${i}`}
            className="aspect-[16/10] animate-pulse rounded-xl border border-neutral-200 bg-neutral-100 sm:aspect-auto sm:h-72"
          />
        ))}
    </div>
  );
}

function PoiCard({
  poi,
  favorite,
}: {
  poi: Poi;
  favorite?: { orderThis?: string; note?: string };
}) {
  const categoryLabel = CATEGORY_LABEL[poi.category] ?? poi.category;
  const price = poi.priceLevel ? "$".repeat(poi.priceLevel) : null;
  const neighborhood = poi.neighborhood
    ? prettifyNeighborhood(poi.neighborhood)
    : null;
  const tagPills = (poi.tags ?? [])
    .map((t) => ({
      key: t as string,
      label: TAG_PILL_LABELS[t] as string | undefined,
    }))
    .filter(
      (t): t is { key: string; label: string } => typeof t.label === "string"
    )
    .slice(0, 2);
  const mapsHref = poi.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${poi.name} ${poi.address}`)}`
    : null;

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-xl border border-[#e6e3dd] bg-white shadow-[0_1px_2px_rgba(28,29,29,0.04)] transition hover:-translate-y-0.5 hover:border-[#2d3e2c] hover:shadow-[0_12px_32px_rgba(28,29,29,0.1)]">
      {poi.photoUrl ? (
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-neutral-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={poi.photoUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
          />
          {favorite && (
            <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-[#f2c070] px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#1c1d1d] shadow-md ring-1 ring-black/5">
              <Sparkles className="h-2.5 w-2.5" strokeWidth={2.6} />
              Team pick
            </span>
          )}
          {neighborhood && (
            <span className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-black/65 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
              <MapPin className="h-3 w-3" strokeWidth={2.4} />
              {neighborhood}
            </span>
          )}
        </div>
      ) : (
        // No photo on the row — show a branded forest gradient with the
        // first letter as a monogram + the neighborhood pill so the card
        // never looks broken or empty. Photo-coverage backfill is a
        // separate cleanup task in sp_pois.
        <div
          className="relative flex aspect-[16/10] w-full items-center justify-center text-white"
          style={{
            background:
              "linear-gradient(135deg, #2d3e2c 0%, #384e36 60%, #4a6248 100%)",
          }}
        >
          <span
            className="select-none text-5xl font-bold tracking-tight text-[#f2c070]"
            style={{ textShadow: "0 2px 12px rgba(0,0,0,0.25)" }}
          >
            {(poi.name?.[0] ?? "?").toUpperCase()}
          </span>
          {favorite && (
            <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-[#f2c070] px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#1c1d1d] shadow-md ring-1 ring-black/5">
              <Sparkles className="h-2.5 w-2.5" strokeWidth={2.6} />
              Team pick
            </span>
          )}
          {neighborhood && (
            <span className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-black/40 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
              <MapPin className="h-3 w-3" strokeWidth={2.4} />
              {neighborhood}
            </span>
          )}
        </div>
      )}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-[15.5px] font-semibold leading-tight tracking-tight text-[#1c1d1d]">
            {poi.name}
          </h3>
          {price && (
            <span className="shrink-0 text-[13px] font-semibold text-[#6f7274]">
              {price}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="rounded-full bg-[#efe9df] px-2 py-0.5 font-semibold uppercase tracking-wide text-[#2d3e2c]">
            {categoryLabel}
          </span>
          {tagPills.map((t) => (
            <span
              key={t.key}
              className="rounded-full border border-[#e6e3dd] px-2 py-0.5 font-medium text-[#6f7274]"
            >
              {t.label}
            </span>
          ))}
        </div>
        {favorite?.orderThis ? (
          <p className="rounded-md bg-[#fff7e6] px-2.5 py-1.5 text-[12.5px] leading-snug text-[#1c1d1d]">
            <span className="font-bold text-[#2d3e2c]">Order: </span>
            {favorite.orderThis}
          </p>
        ) : null}
        {poi.description && (
          <p className="line-clamp-3 text-[13px] leading-relaxed text-[#4a4d4f]">
            {poi.description}
          </p>
        )}
        {poi.address &&
          (mapsHref ? (
            <a
              href={mapsHref}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-auto flex items-start gap-1 pt-1 text-[11.5px] text-[#6f7274] transition hover:text-[#2d3e2c]"
            >
              <MapPin className="mt-[1px] h-3 w-3 shrink-0" strokeWidth={2} />
              <span className="line-clamp-1 underline-offset-2 hover:underline">
                {poi.address}
              </span>
            </a>
          ) : (
            <p className="mt-auto flex items-start gap-1 pt-1 text-[11.5px] text-[#6f7274]">
              <MapPin className="mt-[1px] h-3 w-3 shrink-0" strokeWidth={2} />
              <span className="line-clamp-1">{poi.address}</span>
            </p>
          ))}
      </div>
    </article>
  );
}

// Post-results CTA — shows the same admin-curated featured listings the
// home page renders (kv_store.featured_listings via /api/recs/featured).
// Keeps the recommender's booking nudge editorially aligned with the
// homepage hero instead of pulling random rows from /api/listings.
//
// `dominantNeighborhood` still pulls double-duty: it deep-links the "See
// all" button to the matching /neighborhoods/<slug> when ≥half the picks
// share one, otherwise to the unfiltered /properties browse.
type ListingMini = {
  guesty_id: string;
  slug: string;
  title: string;
  picture: string | null;
  bedrooms: number | null;
  accommodates: number | null;
  basePrice: number | null;
  property_type: string | null;
};

// In-process cache so every assistant turn doesn't re-fetch the same
// listings — we only need them once per page load. Module-scoped so it
// survives across NearbyStaysCTA mounts.
const listingsCache: {
  promise: Promise<ListingMini[]> | null;
  data: ListingMini[] | null;
} = {
  promise: null,
  data: null,
};

function fetchFeaturedListings(): Promise<ListingMini[]> {
  if (listingsCache.data) return Promise.resolve(listingsCache.data);
  if (listingsCache.promise) return listingsCache.promise;
  listingsCache.promise = fetch("/api/recs/featured")
    .then((r) => r.json())
    .then((data: { listings?: ListingMini[] }) => {
      const list = data.listings ?? [];
      listingsCache.data = list;
      listingsCache.promise = null;
      return list;
    })
    .catch(() => {
      listingsCache.promise = null;
      return [];
    });
  return listingsCache.promise;
}

function listingHref(l: ListingMini): string {
  return `/properties/${l.slug}`;
}

function NearbyStaysCTA({ cards }: { cards: Poi[] }) {
  const [listings, setListings] = useState<ListingMini[] | null>(
    listingsCache.data
  );

  useEffect(() => {
    if (listings) return;
    let cancelled = false;
    void fetchFeaturedListings().then((data) => {
      if (!cancelled) setListings(data);
    });
    return () => {
      cancelled = true;
    };
  }, [listings]);

  const dominantNeighborhood = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of cards) {
      if (!c.neighborhood) continue;
      counts.set(c.neighborhood, (counts.get(c.neighborhood) ?? 0) + 1);
    }
    let best: { slug: string; count: number } | null = null;
    for (const [slug, count] of counts) {
      if (!best || count > best.count) best = { slug, count };
    }
    return best && best.count >= Math.ceil(cards.length / 2) ? best.slug : null;
  }, [cards]);

  const seeAllHref = dominantNeighborhood
    ? `/neighborhoods/${dominantNeighborhood.replace(/_/g, "-")}`
    : "/properties";
  const headlineNeighborhood = dominantNeighborhood
    ? prettifyNeighborhood(dominantNeighborhood)
    : null;

  const visible = (listings ?? []).slice(0, 4);
  const showSkeleton = listings === null;

  return (
    <section className="rounded-2xl border border-[#e6e3dd] bg-white p-4 shadow-[0_2px_6px_rgba(28,29,29,0.04)] sm:p-5">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-[#2d3e2c]">
            Book Traverse · No booking fees
          </p>
          <h3 className="mt-0.5 text-[16px] font-semibold tracking-tight text-[#1c1d1d] sm:text-[17px]">
            {headlineNeighborhood
              ? `Homes near ${headlineNeighborhood}`
              : "Need a place to stay nearby?"}
          </h3>
          <p className="mt-0.5 text-[12.5px] text-[#6f7274]">
            275+ Portland homes · best price guaranteed when booked direct.
          </p>
        </div>
        <Link
          href={seeAllHref}
          className="hidden shrink-0 items-center gap-1.5 rounded-full border border-[#e6e3dd] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#1c1d1d] transition hover:border-[#2d3e2c] sm:inline-flex"
        >
          See all
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.4} />
        </Link>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {showSkeleton &&
          Array.from({ length: 4 }).map((_, i) => (
            <div
              key={`l-sk-${i}`}
              className="aspect-[4/5] animate-pulse rounded-xl border border-[#e6e3dd] bg-[#f3efe8]"
            />
          ))}
        {!showSkeleton &&
          visible.map((l) => <ListingMiniCard key={l.guesty_id} listing={l} />)}
        {!showSkeleton && visible.length === 0 && (
          <div className="col-span-2 rounded-xl border border-dashed border-[#e6e3dd] p-4 text-center text-[12.5px] text-[#6f7274] sm:col-span-4">
            Browse all 275+ homes →{" "}
            <Link
              href={seeAllHref}
              className="font-semibold text-[#2d3e2c] underline"
            >
              booktraverse.com/properties
            </Link>
          </div>
        )}
      </div>

      <Link
        href={seeAllHref}
        className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-[#2d3e2c] px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#384e36] sm:hidden"
      >
        See all homes
        <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.4} />
      </Link>
    </section>
  );
}

function ListingMiniCard({ listing }: { listing: ListingMini }) {
  const price =
    listing.basePrice != null
      ? `$${Math.round(listing.basePrice)}/night`
      : null;
  const bedroomsLabel =
    listing.bedrooms != null
      ? `${listing.bedrooms} BR`
      : listing.accommodates != null
        ? `Sleeps ${listing.accommodates}`
        : null;
  const photo = listing.picture;

  return (
    <Link
      href={listingHref(listing)}
      className="group block overflow-hidden rounded-xl border border-[#e6e3dd] bg-white transition hover:-translate-y-0.5 hover:border-[#2d3e2c] hover:shadow-[0_10px_28px_rgba(28,29,29,0.08)]"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#efe9df]">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[#2d3e2c]">
            <MapPin className="h-5 w-5" strokeWidth={2} />
          </div>
        )}
        {price && (
          <span className="absolute bottom-1.5 left-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[10.5px] font-semibold text-white backdrop-blur-sm">
            {price}
          </span>
        )}
      </div>
      <div className="px-2.5 py-2">
        <p className="line-clamp-2 text-[12px] font-semibold leading-tight text-[#1c1d1d]">
          {listing.title ?? "Book Traverse home"}
        </p>
        {bedroomsLabel && (
          <p className="mt-0.5 text-[11px] text-[#6f7274]">{bedroomsLabel}</p>
        )}
      </div>
    </Link>
  );
}

// ── Composer ───────────────────────────────────────────────────────
function Composer({
  value,
  onChange,
  onSubmit,
  onStop,
  busy,
  isEmpty,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (text: string) => void;
  onStop: () => void;
  busy: boolean;
  isEmpty: boolean;
}) {
  const taRef = useRef<HTMLTextAreaElement>(null);

  const resize = useCallback(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, []);

  useEffect(() => {
    if (!value) {
      const el = taRef.current;
      if (el) el.style.height = "auto";
    }
  }, [value]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(value);
      }}
      className="flex items-end gap-2 rounded-3xl border border-neutral-200 bg-white px-4 py-3 shadow-sm transition focus-within:border-[#2d3e2c] focus-within:shadow-md"
    >
      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          resize();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSubmit(value);
          }
        }}
        placeholder={
          isEmpty
            ? "Ask for a cuisine, a vibe, a neighborhood…"
            : "Ask a follow-up…"
        }
        rows={1}
        // text-base on mobile (16px) prevents iOS Safari's auto-zoom on
        // focus — anything <16px triggers the viewport zoom.
        className="flex-1 resize-none self-center bg-transparent py-1 text-base leading-6 text-neutral-900 outline-none placeholder:text-neutral-400 sm:text-[15px]"
        style={{ maxHeight: "160px" }}
      />
      {busy ? (
        <button
          type="button"
          onClick={onStop}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-white transition hover:bg-neutral-700 sm:h-9 sm:w-9"
          aria-label="Stop"
        >
          <StopCircle className="h-5 w-5 sm:h-4 sm:w-4" />
        </button>
      ) : (
        <button
          type="submit"
          disabled={!value.trim()}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#2d3e2c] text-white transition hover:bg-[#384e36] disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-400 sm:h-9 sm:w-9"
          aria-label="Send"
        >
          <ArrowUp className="h-5 w-5 sm:h-4 sm:w-4" strokeWidth={2.6} />
        </button>
      )}
    </form>
  );
}

// ── Email picks modal ─────────────────────────────────────────────
// Sends the most recent set of POI cards to the supplied email via
// /api/recs/email. The endpoint hydrates POI rows server-side so the
// email stays valid even if the cache here is stale.
function EmailPicksModal({
  messageId,
  chatId,
  poiCache,
  messages,
  defaultEmail,
  onClose,
}: {
  messageId: string;
  chatId: string | null;
  poiCache: Record<string, Poi>;
  messages: UIMessage[];
  defaultEmail: string;
  onClose: () => void;
}) {
  const [email, setEmail] = useState(defaultEmail);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Snapshot data for the email — pull POI ids + favorites + the assistant's
  // closing prose from the matching message.
  const payload = useMemo(() => {
    const msg = messages.find((m) => m.id === messageId);
    if (!msg) return null;
    const { ids, favorites } = extractPoiIdsAndFavorites(msg);
    const intro = (() => {
      const parts = msg.parts as unknown[];
      let firstToolIdx = -1;
      let lastToolIdx = -1;
      for (let i = 0; i < parts.length; i++) {
        if (isToolPart(parts[i])) {
          if (firstToolIdx === -1) firstToolIdx = i;
          lastToolIdx = i;
        }
      }
      const before: string[] = [];
      const after: string[] = [];
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        if (!isTextPart(p)) continue;
        if (i < firstToolIdx) before.push(p.text);
        if (lastToolIdx >= 0 && i > lastToolIdx) after.push(p.text);
      }
      return (before.join("\n").trim() ||
        after.join("\n").trim() ||
        "Local Portland recommendations from Book Traverse.") as string;
    })();
    return {
      poiIds: ids,
      favorites: Array.from(favorites.entries()).map(([id, f]) => ({
        id,
        orderThis: f.orderThis,
        note: f.note,
      })),
      intro,
    };
  }, [messages, messageId]);

  const cardCount = payload?.poiIds.filter((id) => poiCache[id]).length ?? 0;

  const handleSend = async () => {
    if (!email.trim() || !payload) return;
    setSending(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/recs/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          chatId,
          intro: payload.intro,
          poiIds: payload.poiIds,
          favorites: payload.favorites,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error || `Error ${res.status}`);
      }
      setSent(true);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSending(false);
    }
  };

  // Layout: bottom-sheet on mobile (anchored to the bottom edge so the
  // user's thumb reaches the email field + send button without stretching),
  // centered modal at sm+. The grab-handle bar at the top is the universal
  // "this slides" affordance on iOS/Android. safe-area-inset-bottom keeps
  // the send button above the iOS home-bar handle.
  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/45 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl bg-white p-5 pt-4 shadow-xl sm:rounded-2xl sm:p-6 sm:pt-6"
        style={{
          paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[#e6e3dd] sm:hidden" />
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-[17px] font-semibold tracking-tight text-[#1c1d1d]">
              {sent ? "Picks sent!" : "Email these picks"}
            </h3>
            {!sent && (
              <p className="mt-1 text-[13px] text-[#6f7274]">
                We&rsquo;ll send {cardCount > 0 ? `${cardCount} ` : ""}Portland
                {cardCount === 1 ? " pick" : " picks"} to your inbox — easy to
                reference later.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-m-1 inline-flex h-9 w-9 items-center justify-center rounded-full text-[#8b8e90] hover:bg-[#efe9df] hover:text-[#1c1d1d]"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {sent ? (
          <div className="mt-6 flex flex-col items-center gap-3 py-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
              <Check className="h-6 w-6 text-emerald-600" />
            </div>
            <p className="text-center text-[13.5px] text-[#4a4d4f]">
              Check your inbox at <strong>{email}</strong> — your Portland picks
              are on their way.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 inline-flex h-11 items-center justify-center rounded-full bg-[#2d3e2c] px-7 text-[13.5px] font-semibold text-white hover:bg-[#384e36]"
            >
              Done
            </button>
          </div>
        ) : (
          <form
            className="mt-5 flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSend();
            }}
          >
            <label
              htmlFor="recs-email"
              className="text-[12px] font-semibold uppercase tracking-wide text-[#6f7274]"
            >
              Your email
            </label>
            <input
              id="recs-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              // text-base prevents iOS Safari's auto-zoom on focus (any
              // text input <16px triggers a viewport zoom on focus).
              className="w-full rounded-xl border border-[#e6e3dd] px-4 py-3 text-base text-[#1c1d1d] outline-none focus:border-[#2d3e2c] focus:ring-1 focus:ring-[#2d3e2c]"
            />
            {errorMsg && (
              <div className="rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-700">
                {errorMsg}
              </div>
            )}
            <button
              type="submit"
              disabled={sending || !email.trim() || !payload}
              className="mt-1 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#2d3e2c] px-4 text-[14px] font-semibold text-white transition hover:bg-[#384e36] disabled:cursor-not-allowed disabled:bg-neutral-300"
            >
              {sending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending…
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4" />
                  Send picks
                </>
              )}
            </button>
            <p className="text-center text-[11px] text-[#8b8e90]">
              We&rsquo;ll only use your email for this send and the occasional
              Portland tip. Unsubscribe anytime.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
