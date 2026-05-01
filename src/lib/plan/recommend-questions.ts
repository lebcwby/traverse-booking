// src/lib/plan/recommend-questions.ts
// Long-tail example questions surfaced by the rotating "What others ask"
// section in the empty state, AND mirrored into the FAQPage JSON-LD on
// /portland-recommendations/page.tsx. Lives in lib/ (not in the
// "use client" recommend-chat.tsx) so server components can import it
// across the RSC boundary without webpack mangling the array shape.
//
// Designed for breadth: cuisine, vibe, neighborhood, occasion, day trip.
// Each entry is a query the recommender's search_pois catalog can actually
// answer (verified against the active sp_pois set) — so a crawler-driven
// arrival from any of these searches lands on a tool that delivers.

export const EXAMPLE_QUESTIONS = [
  "Best ramen in Portland",
  "Where to brunch on a Sunday",
  "Coffee with strong wifi",
  "Cheap eats on Hawthorne",
  "Romantic dinner under $80",
  "Best food cart pods",
  "Live music venues with good drinks",
  "Family-friendly spots in NE Portland",
  "Sushi worth the splurge",
  "Indie bookstores worth a stop",
  "Best spots in the Pearl District",
  "Where to watch the sunset",
  "Vegan dinner I won't forget",
  "Day trip to the Columbia Gorge",
  "Cocktail bars in Sellwood",
  "Best pinball or arcade bars",
] as const;

export type ExampleQuestion = (typeof EXAMPLE_QUESTIONS)[number];
