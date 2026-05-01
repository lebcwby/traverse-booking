// src/lib/plan/popular-ideas.ts
// Canonical "Popular trip ideas" shown on the /plan landing hero. Extracted
// into its own module so the seed script can consume the exact same prompt
// + cache_key pairs the client sends.
//
// cacheKey is the stable identifier we write on the sp_plans row. When a
// visitor clicks the card, the client POSTs cacheKey to
// /api/plan/from-template — a ≤7-day-old cache hit clones the template and
// redirects to /plan/<uuid> in ~200ms, no live agent run.
//
// Design rule: labels + prompts stay INTEREST-based (food, outdoors, arts,
// classics) rather than party-specific (wife + me, kids ages 7–10, etc.).
// Narrow openers exclude anyone who doesn't match — a solo traveller skips
// "my wife and I", a couple skips "kids ages 7 and 10". Universal interests
// maximise click-through across party type, age, and trip occasion. The
// agent handles the dates/party interview on the other side.
//
// Every prompt MUST include "in the next month or so" + "Pick specific
// dates" so the zero-interview fast path kicks in. See trip-planner.md.

export type PopularIdea = {
  key: string;
  cacheKey: string;
  label: string;
  prompt: string;
};

export const POPULAR_IDEAS: PopularIdea[] = [
  {
    key: "food",
    cacheKey: "premade:food",
    label: "Food & drink highlights",
    prompt:
      "Plan me a weekend in Portland for 2 adults in the next month or so, focused on food and drink — the restaurants, coffee, and craft drinks locals actually love. Pick specific dates for me and generate the itinerary now — no follow-up questions.",
  },
  {
    key: "outdoors",
    cacheKey: "premade:outdoors",
    label: "Outdoor adventure",
    prompt:
      "Plan me a weekend in Portland for 2 adults in the next month or so, focused on the outdoors — parks, viewpoints, and a day out at Mt. Hood or the Columbia Gorge. Pick specific dates for me and generate the itinerary now — no follow-up questions.",
  },
  {
    key: "neighborhoods",
    cacheKey: "premade:neighborhoods",
    label: "Arts, shops & neighborhoods",
    prompt:
      "Plan me a weekend in Portland for 2 adults in the next month or so, exploring the best neighborhoods — bookstores, galleries, vintage shops, and local finds. Pick specific dates for me and generate the itinerary now — no follow-up questions.",
  },
  {
    key: "classic",
    cacheKey: "premade:classic",
    label: "Classic Portland first-timer",
    prompt:
      "Plan me a weekend in Portland for 2 adults in the next month or so, showing me the classic first-time Portland must-sees. Pick specific dates for me and generate the itinerary now — no follow-up questions.",
  },
  {
    key: "kids",
    cacheKey: "premade:kids",
    label: "Portland with kids",
    prompt:
      "Plan me a weekend in Portland in the next month or so for 2 adults and 2 kids ages 7 and 10 — kid-friendly food, parks, hands-on activities, and one fun outing. Pick specific dates for me and generate the itinerary now — no follow-up questions.",
  },
];
