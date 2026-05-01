// src/lib/plan/starter-chips.ts
// Canonical list of vibe + duration starter chips for /plan, plus the
// opener-composition helper used to turn a chip pair into a user message.
//
// Kept server-friendly (pure data + pure function, no client imports) so the
// template seed script (scripts/seed-plan-templates.ts) can reuse the exact
// same combo list the landing page exposes.

export type VibeChip = {
  key: string;
  label: string;
  vibeText: string;
  defaultParty: string;
};

export type DurationChip = {
  key: string;
  label: string;
  durationText: string;
};

export const VIBE_CHIPS: VibeChip[] = [
  {
    key: "food",
    label: "Food & drinks",
    vibeText: "food, coffee, and craft drinks",
    defaultParty: "two adults",
  },
  {
    key: "firsttime",
    label: "First-time highlights",
    vibeText: "first-time Portland highlights — the classic places",
    defaultParty: "two adults",
  },
  {
    key: "outdoors",
    label: "Outdoors",
    vibeText: "outdoors — parks, hikes, viewpoints",
    defaultParty: "two adults",
  },
  {
    key: "kids",
    label: "Kid-friendly",
    vibeText: "kid-friendly",
    defaultParty: "two adults and two kids ages 7 and 10",
  },
  {
    key: "hiddengems",
    label: "Hidden gems",
    vibeText: "hidden gems and local-only spots",
    defaultParty: "two adults",
  },
  {
    key: "surprise",
    label: "Surprise me",
    vibeText: "a good mix — pick the vibe for us",
    defaultParty: "two adults",
  },
];

export const DURATION_CHIPS: DurationChip[] = [
  { key: "weekend", label: "Weekend", durationText: "a weekend (2 nights)" },
  {
    key: "long",
    label: "Long weekend",
    durationText: "a long weekend (3 nights)",
  },
  { key: "week", label: "Full week", durationText: "a full week (7 nights)" },
  {
    key: "pickforme",
    label: "Surprise me",
    durationText: "pick a good length for us",
  },
];

export function composeOpener(vibe: VibeChip, duration: DurationChip): string {
  // The "in the next month or so" phrase gives the agent enough of a time
  // signal to pick specific dates without asking a follow-up. Without it,
  // the agent (correctly) asks which month the trip is in and the whole
  // zero-interview fast path collapses into a 1-question interview.
  return `Plan me ${duration.durationText} in Portland in the next month or so for ${vibe.defaultParty}, focused on ${vibe.vibeText}. Pick specific dates for me.`;
}

// Combos that intentionally bypass the template cache — "Surprise me" on
// either slot should give each visitor a fresh, varied plan rather than the
// same cached result.
export function isCacheableCombo(
  vibe: VibeChip,
  duration: DurationChip
): boolean {
  return vibe.key !== "surprise" && duration.key !== "pickforme";
}

export function cacheKeyFor(vibe: VibeChip, duration: DurationChip): string {
  return `${vibe.key}:${duration.key}`;
}
