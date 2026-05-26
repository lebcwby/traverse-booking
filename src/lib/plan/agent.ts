// src/lib/plan/agent.ts
// Assembles the model + system prompt + tool set into the options bag
// that streamText() wants. Used by app/api/plan/chat/route.ts.

import { anthropic } from "@ai-sdk/anthropic";
import { PLAN_SYSTEM_PROMPT } from "./system-prompt";
import { renderFavoritesForPrompt } from "./favorites";
import { searchPoisTool } from "./tools/search-pois";
import { searchListingsTool } from "./tools/search-listings";
import { getNeighborhoodTool } from "./tools/get-neighborhood";
import { generateItineraryTool } from "./tools/generate-itinerary";

// All /plan turns run on Haiku 4.5 as of 2026-05-26 — including the opening
// interview turn that previously ran on Sonnet 4.6 for voice quality. Haiku's
// ~2× token throughput wins on every turn now that the system prompt is
// tight enough to carry the interview voice on its own. Sonnet stays exported
// for tests and as an escape hatch if we ever want to re-split per turn.
export const PLAN_MODEL_SONNET_ID = "claude-sonnet-4-6";
export const PLAN_MODEL_HAIKU_ID = "claude-haiku-4-5-20251001";

export const planModelSonnet = anthropic(PLAN_MODEL_SONNET_ID);
export const planModelHaiku = anthropic(PLAN_MODEL_HAIKU_ID);

// Backward-compat: anything importing planModel (e.g. tests) keeps Sonnet so
// quality snapshots run against the higher-tier model.
export const planModel = planModelSonnet;

/**
 * Pick the model for an incoming /api/plan/chat POST.
 *
 * Currently always returns Haiku regardless of turn count. The `userMessageCount`
 * arg is retained so callers don't need to change, and to make re-introducing
 * a per-turn split a one-line edit if voice quality regresses on the opener.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function pickPlanModel(userMessageCount: number) {
  return planModelHaiku;
}

// Export the tool set keyed by name — streamText uses these names in its
// tool-call protocol, and the client uses them to discriminate tool UIParts.
export const planTools = {
  search_pois: searchPoisTool,
  search_listings: searchListingsTool,
  get_neighborhood: getNeighborhoodTool,
  generate_itinerary: generateItineraryTool,
} as const;

/**
 * Build the system prompt with a fresh "today is X" preamble baked in.
 *
 * Claude in API mode has no built-in clock and no knowledge of the current
 * date, so if we don't tell it, it guesses based on training-data patterns
 * — and at least for Sonnet 4.5 that guess was landing in 2025 even though
 * we're running in 2026. A past-dated itinerary breaks BEAPI availability
 * checks (rentals aren't bookable for dates in the past) and cascades into
 * the sidebar showing the generic Supabase fallback instead of confirmed
 * availability.
 *
 * Called on every request so the system prompt is always pinned to the
 * current UTC date.
 */
export function buildPlanSystem(): string {
  const today = new Date();
  const y = today.getUTCFullYear();
  const m = String(today.getUTCMonth() + 1).padStart(2, "0");
  const d = String(today.getUTCDate()).padStart(2, "0");
  const todayIso = `${y}-${m}-${d}`;
  const todayPretty = today.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Los_Angeles",
  });

  return `# Today's date
Today is ${todayPretty} (${todayIso} UTC). All dates you pick for a trip MUST be in the future — never pick a date on or before ${todayIso}. When the user says "next month", "this summer", "in July", etc., interpret those relative to today's date, not to 2024 or 2025. If "July" has already passed this year, pick July of next year.

# Book Traverse team favorites

A small, human-maintained list of real Portland spots our team loves, each with the specific thing to order or do. Favorites layer extra human-supplied detail on top of sp_pois — they do NOT replace it. Your flow is unchanged: you still call search_pois for every place.

When search_pois returns a POI that matches a favorite, its row in the tool response includes an extra \`favorite\` field:
  - orderThis: the specific thing to order or do
  - note: optional extra colour

## Where favorites surface

The agent's chat surface is thin — you only ask one short question per turn and emit a one-sentence closing after generate_itinerary. Do NOT try to drop favorites into chat text. The place favorites surface is the itinerary itself: specifically, the \`reason\` field of each ItineraryItem. The UI also renders a small "Local favorite" badge on the day card for any POI that matches — that's automatic, you don't control it.

## Rules when a POI in your itinerary has a \`favorite\` field

1. Prefer favorited POIs — aim for roughly half the itinerary's picks to come from the favorites list when category/neighborhood coverage allows. Never force a favorite that doesn't fit the user's vibe or geography, but when a favorite and a non-favorite are both eligible, pick the favorite. When the user's interests match a known favorite (see list at the bottom), STEER your search_pois queries with the right category + neighborhood filter so the favorite actually appears in results. Favorites are also ranked to the top of search_pois results server-side, so they'll be the first candidates you see.
2. In that item's \`reason\` field, weave in the orderThis detail AND make clear it's a pick from our team — not the agent's general knowledge. Examples of correct reason text:
   - "Our team's go-to for fast, cheap tacos — order the Bryan's Bowl with steak."
   - "A local favorite — ask for the off-menu bacon, spinach, and jack."
   - "The vanilla oat milk latte is the move — trust us on this one."
   - "We love the breakfast sandwich: cream cheese, prosciutto, scrambled egg, arugula."
3. NEVER use a personal first name in the reason text, chat, or any user-facing output. No "Hayden", no invented staff names, no individual attribution of any kind. Always use collective framings: "our team", "we love", "a local favorite", "trust us on". This is a hard product-voice rule.
4. Keep the reason to one short sentence (≤18 words) as usual. The attribution + orderThis is the whole sentence — no extra fluff.
5. Never fabricate a favorite or orderThis detail for a POI that doesn't have a \`favorite\` field in the search_pois response. On-list detail comes only from the tool.

## Known favorites — use to steer your search_pois queries

${renderFavoritesForPrompt()}

${PLAN_SYSTEM_PROMPT}`;
}
