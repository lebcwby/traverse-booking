// src/app/portland-recommendations/page.tsx
// SEO-optimized landing page for the local-recommender chat. The visible
// surface (hero + starter chips + "what others ask" rotator) doubles as
// crawlable content for queries like "portland recommendations", "best
// portland restaurants", "things to do in portland". The chat itself
// drives the long-tail.

import type { Metadata } from "next";
import { RecommendChat } from "@/components/plan/recommend-chat";
import { EXAMPLE_QUESTIONS } from "@/lib/plan/recommend-questions";

const CANONICAL = "https://www.booktraverse.com/portland-recommendations";
const TITLE = "Portland Recommendations from a Local — Book Traverse";
const DESCRIPTION =
  "Ask a Portland local for recommendations — best Italian restaurants, standout coffee shops, kid-friendly outings, neighborhood favorites. Curated picks from the team that manages 275+ Portland homes. Free, no signup.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "portland recommendations",
    "best restaurants in portland",
    "things to do in portland",
    "portland coffee shops",
    "portland local picks",
    "ask a portland local",
    "where to eat in portland",
    "portland travel guide",
  ],
  alternates: { canonical: CANONICAL },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: CANONICAL,
    siteName: "Book Traverse",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
    },
  },
};

// Per-question evergreen answer copy for the FAQPage rich snippet.
// Each Q here mirrors an EXAMPLE_QUESTION above so the rotating UI and
// the structured data stay in sync. Answers describe what to expect (real
// signal Google can surface) and end with a soft pointer to the live
// recommender.
const QUESTION_ANSWERS: Record<string, string> = {
  "Best ramen in Portland":
    "Portland's ramen scene runs from Pearl District izakayas to neighborhood shops on Hawthorne, Mississippi, and Division. Ask the Book Traverse local recommender for a curated short list with neighborhoods and what to order.",
  "Where to brunch on a Sunday":
    "Sunday brunch in Portland spans destination spots like Tasty n Sons to quieter neighborhood patios in Alberta Arts and Mt Tabor. The recommender returns a short list, scoped to a neighborhood if you ask.",
  "Coffee with strong wifi":
    "Portland is a third-wave coffee town with plenty of laptop-friendly cafés. Ask the recommender for spots with reliable wifi, comfortable seating, and great espresso — filterable by neighborhood.",
  "Cheap eats on Hawthorne":
    "Hawthorne is one of Portland's best stretches for cheap, great food — taquerias, slice shops, food carts, and noodle counters. The recommender pulls a curated short list with prices and team picks.",
  "Romantic dinner under $80":
    "Portland has plenty of date-night spots that stay under $80 a head — handmade pasta in Sellwood, intimate Pacific Northwest tasting menus on Division, candlelit wine bars in Buckman. Ask the recommender for the current short list.",
  "Best food cart pods":
    "Portland's food cart pods are an institution — from the high-volume downtown blocks to rotating Mississippi and Hawthorne pods. The recommender surfaces the best active pods with what to order at each.",
  "Live music venues with good drinks":
    "Portland has independent music venues across every quadrant — Mississippi Studios, Polaris Hall, Doug Fir, Revolution Hall. The recommender returns spots that pair the show with a strong bar program.",
  "Family-friendly spots in NE Portland":
    "Northeast Portland has kid-friendly restaurants, playgrounds, and weekend outings tightly clustered along Alberta, Mississippi, and Williams. The recommender filters for family-welcoming venues automatically.",
  "Sushi worth the splurge":
    "Portland's sushi scene tops out with omakase counters and chef-driven rooms in the Pearl District and downtown. The recommender returns the splurge-tier picks alongside great mid-range neighborhood options.",
  "Indie bookstores worth a stop":
    "Portland is famously a bookstore town — Powell's is just the start. The recommender lists independent shops worth a detour, including used, rare, and themed bookstores across the city.",
  "Best spots in the Pearl District":
    "The Pearl District is dense with restaurants, galleries, and rooftop bars. The recommender pulls a short list scoped to the Pearl, with the team's current favorites surfaced first.",
  "Where to watch the sunset":
    "Portland has well-known sunset spots — Pittock Mansion, Council Crest, the river bridges, Vista House in the Gorge. The recommender returns a curated set with what each one is best for.",
  "Vegan dinner I won't forget":
    "Portland's vegan dining scene is one of the strongest in the country — fully vegan kitchens, vegan-forward menus, and standout plant-based options at omnivore restaurants. The recommender filters accordingly.",
  "Day trip to the Columbia Gorge":
    "The Columbia River Gorge is 30–60 minutes east of Portland — Multnomah Falls, Cascade Locks, Hood River. The recommender includes Gorge-specific picks (waterfalls, restaurants, breweries) when you ask.",
  "Cocktail bars in Sellwood":
    "Sellwood has a tight cluster of standout cocktail bars and wine spots in walking distance of each other. The recommender surfaces the team's current favorites scoped to the neighborhood.",
  "Best pinball or arcade bars":
    "Portland is the unofficial pinball capital of the country, with bars stocking dozens of machines. The recommender returns the best-stocked rooms with the strongest food and drink programs.",
};

// JSON-LD: WebApplication so Google understands what the page is, plus a
// FAQPage carrying every EXAMPLE_QUESTION as crawlable Q&A. Both render
// in the page body — Next renders <script type="application/ld+json">
// children to the served HTML on App Router pages.
const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebApplication",
      "@id": `${CANONICAL}#app`,
      name: "Portland Recommendations",
      url: CANONICAL,
      applicationCategory: "TravelApplication",
      operatingSystem: "Web",
      description: DESCRIPTION,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      provider: {
        "@type": "Organization",
        name: "Book Traverse",
        url: "https://www.booktraverse.com",
      },
    },
    {
      "@type": "FAQPage",
      "@id": `${CANONICAL}#faq`,
      mainEntity: EXAMPLE_QUESTIONS.map((q) => ({
        "@type": "Question",
        name: q,
        acceptedAnswer: {
          "@type": "Answer",
          text:
            QUESTION_ANSWERS[q] ??
            `The Book Traverse local recommender returns a curated short list for "${q}" — pulled from the same catalog used by the team behind 275+ Portland homes.`,
        },
      })),
    },
  ],
};

export default function PortlandRecommendationsPage() {
  return (
    <>
      <script
        type="application/ld+json"
        // Static, server-rendered JSON-LD — safe to dangerouslySet
        dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
      />
      <RecommendChat />
    </>
  );
}
