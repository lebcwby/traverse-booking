// SEO slug → pre-seeded recommender chat mapping. Each slug resolves to the
// newest sp_plans row with the matching cache_key (e.g. `recommend:best-italian-restaurants`).
// Rendered server-side at /portland-recommendations/[slug] as an indexable
// landing surface for Google Ads + organic search.
//
// Pattern mirrors PLAN_SLUGS in slug-map.ts but for the recommender chat
// instead of the full trip-planner. The seed script
// (scripts/seed-recommend-topics.ts) runs the live recommend-agent once per
// slug, persists the resulting UIMessage[] to sp_plans, and the slug page
// hydrates RecommendChat with those messages so the visitor lands mid-answer.
//
// To add a slug: add an entry here, ensure a cached chat exists with the
// corresponding cacheKey (seeded via the script), and it becomes crawlable
// on next deploy.

export interface RecommendSlugEntry {
  slug: string;
  cacheKey: string;
  h1: string;
  subtitle: string;
  metaTitle: string;
  metaDescription: string;
  opener: string;
  keywords: string[];
}

export const RECOMMEND_SLUGS: Record<string, RecommendSlugEntry> = {
  "best-italian-restaurants": {
    slug: "best-italian-restaurants",
    cacheKey: "recommend:best-italian-restaurants",
    h1: "The Best Italian Restaurants in Portland",
    subtitle:
      "Handmade pasta, wood-fired pies, and natural wine — picked by the team that manages 275+ Portland homes.",
    metaTitle: "Best Italian Restaurants in Portland — Local Picks",
    metaDescription:
      "The best Italian restaurants in Portland from locals — handmade pasta, wood-fired pizza, and date-night picks. Curated by Portlanders who manage 275+ vacation rentals.",
    opener: "What are the best Italian restaurants in Portland?",
    keywords: [
      "best italian restaurants portland",
      "italian food portland",
      "portland italian restaurants",
      "best pasta portland",
    ],
  },
  "best-coffee-shops": {
    slug: "best-coffee-shops",
    cacheKey: "recommend:best-coffee-shops",
    h1: "The Best Coffee Shops in Portland",
    subtitle:
      "Third-wave roasters, neighborhood cafés, and laptop-friendly spots — the ones our team actually goes to.",
    metaTitle: "Best Coffee Shops in Portland — Local Picks",
    metaDescription:
      "The best coffee shops in Portland from locals — third-wave roasters, neighborhood cafés, and laptop-friendly spots. Curated by Portlanders who manage 275+ vacation rentals.",
    opener: "Which coffee shops in Portland are worth a special trip?",
    keywords: [
      "best coffee portland",
      "best coffee shops portland",
      "portland coffee shops",
      "third wave coffee portland",
    ],
  },
  "best-cocktail-bars": {
    slug: "best-cocktail-bars",
    cacheKey: "recommend:best-cocktail-bars",
    h1: "The Best Cocktail Bars in Portland",
    subtitle:
      "Craft cocktails, intimate rooms, and the spots Portland bartenders go on their nights off.",
    metaTitle: "Best Cocktail Bars in Portland — Local Picks",
    metaDescription:
      "The best cocktail bars in Portland from locals — craft cocktails, intimate rooms, and the spots bartenders go on their nights off. Curated by 275+ Portland rental managers.",
    opener: "Where are the best cocktail bars in Portland?",
    keywords: [
      "best cocktail bars portland",
      "portland cocktail bars",
      "best bars portland",
      "craft cocktails portland",
    ],
  },
  "best-food-cart-pods": {
    slug: "best-food-cart-pods",
    cacheKey: "recommend:best-food-cart-pods",
    h1: "The Best Food Cart Pods in Portland",
    subtitle:
      "Portland's food carts are an institution — here's where to actually go and what to order at each.",
    metaTitle: "Best Food Cart Pods in Portland — Where to Go",
    metaDescription:
      "The best food cart pods in Portland from locals — where to go, what to order, and which pods are worth a detour. Curated by Portlanders who manage 275+ vacation rentals.",
    opener: "What are the best food cart pods in Portland?",
    keywords: [
      "best food carts portland",
      "portland food cart pods",
      "food carts portland",
      "best food cart pods",
    ],
  },
  "best-day-trips": {
    slug: "best-day-trips",
    cacheKey: "recommend:best-day-trips",
    h1: "The Best Day Trips from Portland",
    subtitle:
      "Columbia Gorge waterfalls, Mt. Hood, the Oregon coast, wine country — all within 90 minutes.",
    metaTitle: "Best Day Trips from Portland — Local Picks",
    metaDescription:
      "The best day trips from Portland from locals — Columbia Gorge waterfalls, Mt. Hood, Oregon coast, wine country. All within 90 minutes. Curated by 275+ Portland rental managers.",
    opener:
      "What's a great day trip from Portland for someone visiting for the first time?",
    keywords: [
      "best day trips from portland",
      "day trips from portland",
      "portland day trips",
      "things to do near portland",
    ],
  },
  "best-brunch-spots": {
    slug: "best-brunch-spots",
    cacheKey: "recommend:best-brunch-spots",
    h1: "The Best Brunch Spots in Portland",
    subtitle:
      "Portland is a brunch town — destination kitchens, neighborhood patios, and the spots locals send out-of-towners to.",
    metaTitle: "Best Brunch Spots in Portland — Local Picks",
    metaDescription:
      "The best brunch spots in Portland from locals — destination kitchens, neighborhood patios, and where to go on a Sunday morning. Curated by 275+ Portland rental managers.",
    opener: "Where are the best brunch spots in Portland on a Sunday?",
    keywords: [
      "best brunch portland",
      "portland brunch spots",
      "best brunch in portland",
      "where to brunch portland",
    ],
  },
  "romantic-restaurants": {
    slug: "romantic-restaurants",
    cacheKey: "recommend:romantic-restaurants",
    h1: "The Most Romantic Restaurants in Portland",
    subtitle:
      "Date-night picks across Portland — intimate rooms, candlelit tables, and the spots that close the deal.",
    metaTitle: "Most Romantic Restaurants in Portland — Date Night Picks",
    metaDescription:
      "The most romantic restaurants in Portland from locals — intimate rooms, candlelit tables, date-night picks across every neighborhood. Curated by 275+ Portland rental managers.",
    opener: "Recommend romantic restaurants for a date night in Portland.",
    keywords: [
      "romantic restaurants portland",
      "date night restaurants portland",
      "best date night portland",
      "intimate restaurants portland",
    ],
  },
  "family-friendly-restaurants": {
    slug: "family-friendly-restaurants",
    cacheKey: "recommend:family-friendly-restaurants",
    h1: "The Best Family-Friendly Restaurants in Portland",
    subtitle:
      "Kid-welcoming kitchens that adults actually want to eat at — picked by Portland parents on our team.",
    metaTitle: "Best Family-Friendly Restaurants in Portland",
    metaDescription:
      "The best family-friendly restaurants in Portland from locals — kid-welcoming kitchens that adults actually want to eat at. Curated by 275+ Portland rental managers.",
    opener:
      "Recommend family-friendly restaurants in Portland for kids and adults.",
    keywords: [
      "family friendly restaurants portland",
      "kid friendly restaurants portland",
      "portland restaurants with kids",
      "best portland restaurants for families",
    ],
  },
};

export function getRecommendSlug(slug: string): RecommendSlugEntry | null {
  return RECOMMEND_SLUGS[slug] ?? null;
}

export function allRecommendSlugs(): RecommendSlugEntry[] {
  return Object.values(RECOMMEND_SLUGS);
}
