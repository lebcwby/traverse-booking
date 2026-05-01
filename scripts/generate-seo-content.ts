/**
 * SEO Content Generation Script
 * Generates all Track 1 landing page content via Claude Opus 4
 * and inserts into the shared Supabase DB via direct Postgres.
 *
 * Usage: npx tsx scripts/generate-seo-content.ts [category]
 *   category: neighborhoods | usecases | events | comparison | all (default: all)
 *
 * Requires .env.local with: ANTHROPIC_API_KEY, DATABASE_URL
 */

import Anthropic from "@anthropic-ai/sdk";
import pg from "pg";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(__dirname, "../.env.local") });

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
  max: 3,
});

const MODEL = "claude-opus-4-20250514";
const DELAY_MS = 2000;

// ─── Internal Links Context ─────────────────────────────────────

async function getInternalLinks(): Promise<string> {
  const { rows } = await pool.query(
    "SELECT anchor_text, target_path, context FROM seo_internal_links"
  );
  if (!rows.length) return "No internal links found.";
  return rows
    .map(
      (l: { anchor_text: string; target_path: string; context: string }) =>
        `- [${l.anchor_text}](${l.target_path}) — ${l.context}`
    )
    .join("\n");
}

// ─── Helpers ─────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function callClaude(system: string, userMsg: string): Promise<string> {
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system,
    messages: [{ role: "user", content: userMsg }],
  });
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text")
    throw new Error("No text in Claude response");
  return textBlock.text;
}

function parseJSON<T>(raw: string): T {
  const cleaned = raw.replace(/```json\s*|```\s*/g, "").trim();
  // Find the first { or [ and last } or ]
  const start = cleaned.search(/[{[]/);
  const end = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]")) + 1;
  if (start === -1 || end === 0) throw new Error("No JSON found in response");
  return JSON.parse(cleaned.substring(start, end));
}

// ─── Neighborhood Pages ──────────────────────────────────────────

interface NeighborhoodDef {
  slug: string;
  name: string;
  guestyTag: string;
  listingCount: number;
  tagline: string;
  landmarks: string[];
}

const NEIGHBORHOODS: NeighborhoodDef[] = [
  {
    slug: "pearl-district",
    name: "The Pearl District",
    guestyTag: "Pearl District",
    listingCount: 25,
    tagline:
      "Portland's most walkable urban neighborhood — converted warehouses, art galleries, upscale dining.",
    landmarks: [
      "Powell's City of Books",
      "Jamison Square",
      "Lan Su Chinese Garden",
      "Portland Saturday Market",
    ],
  },
  {
    slug: "alberta-arts-district",
    name: "The Alberta Arts District",
    guestyTag: "Alberta",
    listingCount: 36,
    tagline:
      "Vibrant murals, independent shops, craft cocktail bars, and Portland's best brunch spots.",
    landmarks: [
      "Salt & Straw",
      "Tin Shed Garden Cafe",
      "Alberta Park",
      "Pine State Biscuits",
    ],
  },
  {
    slug: "hawthorne-belmont",
    name: "Hawthorne & Belmont",
    guestyTag: "Hawthorne Belmont",
    listingCount: 40,
    tagline:
      "Eclectic vintage shops, independent bookstores, and walkable dining along two iconic streets.",
    landmarks: [
      "Powell's Books on Hawthorne",
      "Mt. Tabor Park",
      "Ladd's Addition Rose Gardens",
      "Division Street restaurants",
    ],
  },
  {
    slug: "mississippi-avenue",
    name: "Mississippi Avenue",
    guestyTag: "Mississippi",
    listingCount: 7,
    tagline:
      "A compact stretch of independent shops, restaurants, and live music venues with string lights overhead.",
    landmarks: [
      "Mississippi Studios",
      "Lovely's Fifty Fifty",
      "Prost! Beer Hall",
      "Mississippi Marketplace",
    ],
  },
  {
    slug: "nob-hill",
    name: "Nob Hill",
    guestyTag: "NW 23rd",
    listingCount: 17,
    tagline:
      "Boutique shopping, cozy restaurants, and tree-lined Victorian streets at the base of Forest Park.",
    landmarks: [
      "Forest Park",
      "NW 23rd Avenue shops",
      "Pittock Mansion",
      "Washington Park",
    ],
  },
  {
    slug: "sellwood",
    name: "Sellwood-Moreland",
    guestyTag: "Sellwood Moreland",
    listingCount: 14,
    tagline:
      "Antique Row, riverfront parks, and tree-lined streets that feel like a small town within the city.",
    landmarks: [
      "Antique Row (SE 13th)",
      "Sellwood Riverfront Park",
      "Oaks Amusement Park",
      "Springwater Corridor Trail",
    ],
  },
  {
    slug: "nw-portland",
    name: "Northwest Portland",
    guestyTag: "Northwest",
    listingCount: 34,
    tagline:
      "Urban walkability meets nature — NW 23rd boutiques, Pearl District galleries, and Forest Park trails.",
    landmarks: [
      "NW 23rd Avenue",
      "Pearl District",
      "Forest Park",
      "Pittock Mansion",
    ],
  },
  {
    slug: "ne-portland",
    name: "Northeast Portland",
    guestyTag: "Northeast",
    listingCount: 89,
    tagline:
      "Creative energy, tree-lined streets, and Portland's best food scene.",
    landmarks: [
      "Alberta Street",
      "Mississippi Avenue",
      "Hollywood Theatre",
      "Grant Park",
    ],
  },
  {
    slug: "se-portland",
    name: "Southeast Portland",
    guestyTag: "Southeast",
    listingCount: 100,
    tagline:
      "Portland's most eclectic, walkable neighborhoods — Hawthorne, Division, Belmont, and Clinton.",
    landmarks: [
      "Hawthorne Boulevard",
      "Division Street",
      "Mt. Tabor Park",
      "Eastside Esplanade",
    ],
  },
  {
    slug: "north-portland",
    name: "North Portland",
    guestyTag: "North",
    listingCount: 22,
    tagline:
      "Mississippi Avenue's creative scene, St. Johns' small-town charm, and Cathedral Park's gothic bridge.",
    landmarks: [
      "Mississippi Avenue",
      "St. Johns Bridge",
      "Cathedral Park",
      "University of Portland",
    ],
  },
];

async function generateNeighborhoodPages(links: string) {
  console.log("\n=== Generating Neighborhood Pages ===\n");

  const systemPrompt = `You are an expert SEO copywriter for Book Traverse, a short-term rental company managing ~300 properties across Portland, Oregon. You write with genuine local authority — specific streets, real landmarks, actual neighborhood character. Never generic travel copy. Your tone is warm, knowledgeable, and practical — like a well-traveled local friend giving advice.

You must return ONLY valid JSON, no markdown fencing, no preamble.`;

  for (const hood of NEIGHBORHOODS) {
    console.log(`Generating: ${hood.name} (${hood.listingCount} listings)...`);

    const userMsg = `Generate a complete SEO landing page for vacation rentals in ${hood.name}, Portland, Oregon.

NEIGHBORHOOD CONTEXT:
- Guesty tag: "${hood.guestyTag}"
- Active listings: ${hood.listingCount}
- Tagline: ${hood.tagline}
- Key landmarks: ${hood.landmarks.join(", ")}

INTERNAL LINKS TO USE (use at least 3-4 where natural):
${links}

REQUIREMENTS:
1. headline: H1 tag, format "Vacation Rentals in ${hood.name}, Portland" (vary if it sounds better)
2. meta_title: 55-60 chars, includes "${hood.name}" and "vacation rentals"
3. meta_description: 150-160 chars, enticing, includes primary keyword
4. intro_content_markdown: 2-3 paragraphs that signal local authority — specific streets, vibe, what makes this area special for visitors. Mention real places.
5. highlights: Array of 4-6 objects [{icon: "emoji", label: "short label", description: "1-2 sentences"}] covering walkability, dining, nightlife, transit, parks, or unique draws
6. nearby_attractions: Array of 6-8 real attractions/landmarks within walking distance of our properties
7. content_sections_markdown: 3-4 sections with H2 headings covering: "What to Do in ${hood.name}", "Getting Around", "Where to Eat & Drink", and optionally one more relevant section. Include internal links naturally.
8. schema_markup: LocalBusiness JSON-LD with name "Book Traverse - ${hood.name}", address info for Portland OR 97XXX, and LodgingBusiness type
9. An FAQ section embedded at the end of content_sections_markdown with 4-5 H3 questions people actually search (e.g., "Is ${hood.name} safe for tourists?", "How far is ${hood.name} from the airport?"). Use real distances and transit times.

Return JSON: { headline, meta_title, meta_description, intro_content_markdown, highlights, nearby_attractions, content_sections_markdown, schema_markup }`;

    try {
      const raw = await callClaude(systemPrompt, userMsg);
      const data = parseJSON<Record<string, unknown>>(raw);

      await pool.query(
        `INSERT INTO seo_neighborhood_pages
          (slug, neighborhood_name, guesty_tag, headline, meta_title, meta_description,
           intro_content_markdown, highlights, nearby_attractions, content_sections_markdown,
           schema_markup, status, last_refreshed_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'published',now())
         ON CONFLICT (slug) DO UPDATE SET
           headline=EXCLUDED.headline, meta_title=EXCLUDED.meta_title,
           meta_description=EXCLUDED.meta_description, intro_content_markdown=EXCLUDED.intro_content_markdown,
           highlights=EXCLUDED.highlights, nearby_attractions=EXCLUDED.nearby_attractions,
           content_sections_markdown=EXCLUDED.content_sections_markdown, schema_markup=EXCLUDED.schema_markup,
           last_refreshed_at=now()`,
        [
          hood.slug,
          hood.name,
          hood.guestyTag,
          data.headline,
          data.meta_title,
          data.meta_description,
          data.intro_content_markdown,
          JSON.stringify(data.highlights),
          data.nearby_attractions,
          data.content_sections_markdown,
          JSON.stringify(data.schema_markup),
        ]
      );
      console.log(`  ✓ ${hood.name} inserted`);
    } catch (err) {
      console.error(`  ✗ ${hood.name} failed:`, err);
    }

    await sleep(DELAY_MS);
  }
}

// ─── Use-Case Pages ──────────────────────────────────────────────

interface UseCaseDef {
  slug: string;
  useCase: string;
  targetAudience: string;
  conversionHook: string;
}

const USE_CASES: UseCaseDef[] = [
  {
    slug: "travel-nurse-housing-portland",
    useCase: "Travel Nurse Housing",
    targetAudience:
      "Travel nurses, healthcare professionals on 8-13 week assignments",
    conversionHook:
      "Fully furnished homes with fast WiFi, in-unit laundry, and flexible monthly pricing — no corporate housing middleman",
  },
  {
    slug: "corporate-housing-portland",
    useCase: "Corporate Housing",
    targetAudience:
      "Business travelers, remote workers, consultants on multi-week assignments",
    conversionHook:
      "Private homes with dedicated workspaces, high-speed WiFi, and walkable neighborhoods — better than extended-stay hotels at comparable rates",
  },
  {
    slug: "wedding-guest-accommodations-portland",
    useCase: "Wedding Guest Accommodations",
    targetAudience:
      "Wedding parties, out-of-town guests attending Portland weddings",
    conversionHook:
      "Book multiple homes on the same block — your guests stay together, not scattered across hotels",
  },
  {
    slug: "relocation-housing-portland",
    useCase: "Relocation Housing",
    targetAudience:
      "People moving to Portland, between homes, waiting for closing",
    conversionHook:
      "Month-to-month furnished rentals while you get settled — no 12-month lease required",
  },
  {
    slug: "extended-book-traverse",
    useCase: "Extended Book Traverse",
    targetAudience:
      "Anyone needing 30+ night stays — digital nomads, sabbaticals, insurance claims",
    conversionHook:
      "Significant monthly discounts on fully furnished homes — real kitchens, real laundry, real neighborhoods",
  },
  {
    slug: "family-vacation-rentals-portland",
    useCase: "Family Vacation Rentals",
    targetAudience: "Families with kids visiting Portland",
    conversionHook:
      "Homes with yards, multiple bedrooms, full kitchens, and kid-friendly neighborhoods — no cramped hotel rooms",
  },
  {
    slug: "pet-friendly-rentals-portland",
    useCase: "Pet-Friendly Rentals",
    targetAudience: "Travelers with dogs visiting Portland",
    conversionHook:
      "No breed restrictions, no weight limits, fenced yards available — Portland is one of America's most dog-friendly cities",
  },
  {
    slug: "film-production-housing-portland",
    useCase: "Film & Production Housing",
    targetAudience:
      "Film crews, production teams, actors on location in Portland",
    conversionHook:
      "Block-book multiple units near set locations with flexible check-in/out, fast WiFi for dailies review, and quiet homes for early call times",
  },
];

async function generateUseCasePages(links: string) {
  console.log("\n=== Generating Use-Case Pages ===\n");

  const systemPrompt = `You are an expert SEO copywriter for Book Traverse, a short-term rental company managing ~300 properties across Portland, Oregon. You write conversion-focused landing pages that speak directly to a specific audience's pain points and show how Book Traverse solves them better than hotels or corporate housing. Tone: professional but warm, specific, never salesy-sounding.

You must return ONLY valid JSON, no markdown fencing, no preamble.`;

  for (const uc of USE_CASES) {
    console.log(`Generating: ${uc.useCase}...`);

    const userMsg = `Generate a complete SEO landing page for "${uc.useCase}" in Portland, Oregon.

TARGET AUDIENCE: ${uc.targetAudience}
CONVERSION HOOK: ${uc.conversionHook}

INTERNAL LINKS TO USE (use at least 3-4 where natural):
${links}

REQUIREMENTS:
1. headline: H1 optimized for the search query "${uc.useCase} Portland" — don't use a rigid formula, write what would make this person click
2. meta_title: 55-60 chars, includes primary keyword
3. meta_description: 150-160 chars, speaks to the audience's specific need
4. target_audience: one-line description
5. content_markdown: 800-1200 words of compelling copy structured as:
   - Opening that names the specific pain point this audience faces
   - "Why Book Traverse" section with 4-6 concrete benefits (not generic — specific to this audience)
   - "What's Included" section listing what our rentals offer (furnished, WiFi speed, laundry, kitchen, etc.)
   - "Best Neighborhoods For [Use Case]" section recommending 2-3 Portland neighborhoods with links
   - A booking CTA after the benefits section AND at the end
   - FAQ section (4-5 H3 questions with FAQPage schema-ready answers) using questions this audience actually searches
   Include internal links to relevant neighborhood and other pages naturally.
6. conversion_hook: the single most compelling one-liner for this audience
7. schema_markup: FAQPage JSON-LD with the FAQ questions and answers

Return JSON: { headline, meta_title, meta_description, target_audience, content_markdown, conversion_hook, schema_markup }`;

    try {
      const raw = await callClaude(systemPrompt, userMsg);
      const data = parseJSON<Record<string, unknown>>(raw);

      await pool.query(
        `INSERT INTO seo_usecase_pages
          (slug, use_case, headline, meta_title, meta_description, target_audience,
           content_markdown, conversion_hook, schema_markup, status, last_refreshed_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'published',now())
         ON CONFLICT (slug) DO UPDATE SET
           headline=EXCLUDED.headline, meta_title=EXCLUDED.meta_title,
           meta_description=EXCLUDED.meta_description, target_audience=EXCLUDED.target_audience,
           content_markdown=EXCLUDED.content_markdown, conversion_hook=EXCLUDED.conversion_hook,
           schema_markup=EXCLUDED.schema_markup, last_refreshed_at=now()`,
        [
          uc.slug,
          uc.useCase,
          data.headline,
          data.meta_title,
          data.meta_description,
          data.target_audience,
          data.content_markdown,
          data.conversion_hook,
          JSON.stringify(data.schema_markup),
        ]
      );
      console.log(`  ✓ ${uc.useCase} inserted`);
    } catch (err) {
      console.error(`  ✗ ${uc.useCase} failed:`, err);
    }

    await sleep(DELAY_MS);
  }
}

// ─── Event Pages ─────────────────────────────────────────────────

interface EventDef {
  slug: string;
  eventName: string;
  typicalDates: string;
  bookingUrgency: string;
  nearbyNeighborhoods: string[];
}

const EVENTS: EventDef[] = [
  {
    slug: "portland-rose-festival",
    eventName: "Portland Rose Festival",
    typicalDates: "Late May through mid-June (3+ weeks)",
    bookingUrgency: "Books out 6-8 weeks in advance for parade weekends",
    nearbyNeighborhoods: ["Pearl District", "Northwest", "Northeast"],
  },
  {
    slug: "oregon-brewfest",
    eventName: "Oregon Brewers Festival",
    typicalDates: "Last full weekend of July (Thursday-Sunday)",
    bookingUrgency: "Waterfront-adjacent properties book 2-3 months out",
    nearbyNeighborhoods: ["Pearl District", "Northwest", "Hawthorne Belmont"],
  },
  {
    slug: "portland-marathon",
    eventName: "Portland Marathon",
    typicalDates: "First Sunday of October",
    bookingUrgency: "Downtown and waterfront properties book 6-8 weeks out",
    nearbyNeighborhoods: ["Pearl District", "Northwest", "Northeast"],
  },
  {
    slug: "waterfront-blues-festival",
    eventName: "Waterfront Blues Festival",
    typicalDates: "Fourth of July weekend (4 days)",
    bookingUrgency: "High demand — overlaps with holiday weekend",
    nearbyNeighborhoods: ["Pearl District", "Southeast", "Hawthorne Belmont"],
  },
  {
    slug: "portland-winter-light-festival",
    eventName: "Portland Winter Light Festival",
    typicalDates: "Early-to-mid February (2-3 days)",
    bookingUrgency:
      "Moderate — winter travel is lighter but festival draws crowds",
    nearbyNeighborhoods: ["Pearl District", "Northeast", "Southeast"],
  },
  {
    slug: "oregon-convention-center",
    eventName: "Oregon Convention Center Events",
    typicalDates: "Year-round (major expos, conferences, trade shows)",
    bookingUrgency:
      "Varies by event — large conventions book up NE Portland weeks in advance",
    nearbyNeighborhoods: ["Northeast", "Alberta", "Mississippi"],
  },
  {
    slug: "portland-timbers",
    eventName: "Portland Timbers Home Games",
    typicalDates: "March through October (MLS season), Providence Park",
    bookingUrgency:
      "Rivalry matches and playoffs sell out nearby properties fast",
    nearbyNeighborhoods: ["Pearl District", "Northwest", "Nob Hill"],
  },
  {
    slug: "portland-thorns",
    eventName: "Portland Thorns Home Games",
    typicalDates: "March through November (NWSL season), Providence Park",
    bookingUrgency:
      "Portland has one of the highest-attendance women's soccer fanbases in the world",
    nearbyNeighborhoods: ["Pearl District", "Northwest", "Nob Hill"],
  },
  {
    slug: "pickathon",
    eventName: "Pickathon Music Festival",
    typicalDates: "First weekend of August (Friday-Sunday)",
    bookingUrgency:
      "Happy Valley area is limited — many attendees stay in SE Portland, 20 min drive",
    nearbyNeighborhoods: [
      "Southeast",
      "Sellwood Moreland",
      "Hawthorne Belmont",
    ],
  },
  {
    slug: "feast-portland",
    eventName: "Feast Portland",
    typicalDates: "Mid-September (4 days of food events across the city)",
    bookingUrgency:
      "Moderate — events spread across neighborhoods, central locations preferred",
    nearbyNeighborhoods: ["Pearl District", "Alberta", "Southeast"],
  },
];

async function generateEventPages(links: string) {
  console.log("\n=== Generating Event Pages ===\n");

  const systemPrompt = `You are an expert SEO copywriter for Book Traverse, a short-term rental company managing ~300 properties across Portland, Oregon. For event pages, your job is to briefly explain the event then immediately pivot to accommodations — which Book Traverse properties are closest, why booking early matters, and practical tips. These are booking trigger pages, not editorial content.

You must return ONLY valid JSON, no markdown fencing, no preamble.`;

  for (const evt of EVENTS) {
    console.log(`Generating: ${evt.eventName}...`);

    const userMsg = `Generate a complete SEO landing page for staying near "${evt.eventName}" in Portland, Oregon.

EVENT CONTEXT:
- Typical dates: ${evt.typicalDates}
- Booking urgency: ${evt.bookingUrgency}
- Best neighborhoods to stay: ${evt.nearbyNeighborhoods.join(", ")}

INTERNAL LINKS TO USE (use at least 3-4 where natural):
${links}

REQUIREMENTS:
1. headline: H1 optimized for "[Event Name] Accommodations Portland" or similar high-intent query
2. meta_title: 55-60 chars
3. meta_description: 150-160 chars, emphasizes booking urgency
4. event_description: 2-3 sentences explaining the event — brief, factual, not a travel article
5. typical_dates: "${evt.typicalDates}"
6. content_markdown: 600-900 words structured as:
   - Brief event overview (2-3 sentences then pivot to accommodations)
   - "Where to Stay" section recommending specific neighborhoods with internal links and approximate walk/drive times to the venue
   - "What to Know Before You Book" with booking lead time, parking notes, transit tips, and any event-specific advice
   - "Why Book Direct with Book Traverse" — brief pitch with link to /book-direct
   - FAQ section (3-4 H3 questions) with practical questions like "How far is [venue] from [neighborhood]?", "Is parking available?", "When should I book for [event]?"
7. booking_urgency_note: one compelling sentence about why to book early
8. schema_markup: Event JSON-LD with name, location (Portland, OR), approximate dates for 2026, and LodgingBusiness offers

Return JSON: { headline, meta_title, meta_description, event_description, typical_dates, content_markdown, booking_urgency_note, schema_markup }`;

    try {
      const raw = await callClaude(systemPrompt, userMsg);
      const data = parseJSON<Record<string, unknown>>(raw);

      await pool.query(
        `INSERT INTO seo_event_pages
          (slug, event_name, headline, meta_title, meta_description, event_description,
           typical_dates, content_markdown, booking_urgency_note, schema_markup, status, last_refreshed_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'published',now())
         ON CONFLICT (slug) DO UPDATE SET
           headline=EXCLUDED.headline, meta_title=EXCLUDED.meta_title,
           meta_description=EXCLUDED.meta_description, event_description=EXCLUDED.event_description,
           typical_dates=EXCLUDED.typical_dates, content_markdown=EXCLUDED.content_markdown,
           booking_urgency_note=EXCLUDED.booking_urgency_note, schema_markup=EXCLUDED.schema_markup,
           last_refreshed_at=now()`,
        [
          evt.slug,
          evt.eventName,
          data.headline,
          data.meta_title,
          data.meta_description,
          data.event_description,
          data.typical_dates,
          data.content_markdown,
          data.booking_urgency_note,
          JSON.stringify(data.schema_markup),
        ]
      );
      console.log(`  ✓ ${evt.eventName} inserted`);
    } catch (err) {
      console.error(`  ✗ ${evt.eventName} failed:`, err);
    }

    await sleep(DELAY_MS);
  }
}

// ─── Comparison Page (Book Direct) ───────────────────────────────

async function generateComparisonPage(links: string) {
  console.log("\n=== Generating Book Direct Page ===\n");

  const systemPrompt = `You are an expert SEO copywriter for Book Traverse, a short-term rental company managing ~300 properties across Portland, Oregon. You are writing the single highest-ROI page on the site: the "Book Direct" comparison page. This page must show real fee math, concrete savings, and a price-match guarantee. Be thorough, persuasive, and factual. No fluff.

You must return ONLY valid JSON, no markdown fencing, no preamble.`;

  const userMsg = `Generate a complete "Why Book Direct" comparison landing page for Book Traverse.

KEY FACTS:
- Book Traverse manages ~300 properties in Portland, Oregon
- Airbnb charges guests a 14-16% service fee on top of the nightly rate
- Booking.com charges guests 10-15% in fees
- Book Traverse (booktraverse.com) charges ZERO guest service fees when booking direct
- Book Traverse offers a PRICE-MATCH GUARANTEE: "We'll match any Airbnb price you find for our properties"
- Additional direct booking benefits: direct communication with property manager, flexible cancellation (case-by-case), no platform middleman, faster response times, loyalty perks for returning guests
- Example math: A $150/night property for 5 nights = $750 base. On Airbnb: $750 + ~$112 service fee + $75 cleaning = $937. On booktraverse.com: $750 + $75 cleaning = $825. Savings: ~$112.

INTERNAL LINKS TO USE:
${links}

REQUIREMENTS:
1. headline: H1 — something like "Skip the Airbnb Fees. Book Direct with Book Traverse."
2. meta_title: 55-60 chars
3. meta_description: 150-160 chars, emphasizes savings
4. content_markdown: 1000-1500 words structured as:
   - Opening that names the problem: you're overpaying on Airbnb/VRBO and might not know it
   - "The Fee Math" section with a clear comparison table in markdown showing the same property on Airbnb vs. booktraverse.com for a 3-night, 5-night, and 7-night stay at $150/night and $250/night. Show actual dollar savings.
   - "Our Price-Match Guarantee" section: if you find one of our properties listed for less on Airbnb, we'll match that price — and you still save the service fees
   - "What You Get When You Book Direct" section with 6-8 concrete benefits (not just "better service" — specific things like "direct text line to your property manager" and "flexible check-in times when available")
   - "Same Properties, Same Quality, Lower Price" section addressing the trust objection — these are the exact same listings, same photos, same reviews, just without the middleman fee
   - Strong CTA: "Browse All Portland Vacation Rentals" linking to /properties
   - FAQ section (4-5 H3 questions): "Is it really the same property?", "What if I need to cancel?", "How do I know my payment is secure?", "Do you offer any loyalty perks?"
5. schema_markup: FAQPage JSON-LD

Return JSON: { headline, meta_title, meta_description, content_markdown, schema_markup }`;

  try {
    const raw = await callClaude(systemPrompt, userMsg);
    const data = parseJSON<Record<string, unknown>>(raw);

    await pool.query(
      `INSERT INTO seo_comparison_pages
        (slug, headline, meta_title, meta_description, content_markdown, schema_markup, status, last_refreshed_at)
       VALUES ($1,$2,$3,$4,$5,$6,'published',now())
       ON CONFLICT (slug) DO UPDATE SET
         headline=EXCLUDED.headline, meta_title=EXCLUDED.meta_title,
         meta_description=EXCLUDED.meta_description, content_markdown=EXCLUDED.content_markdown,
         schema_markup=EXCLUDED.schema_markup, last_refreshed_at=now()`,
      [
        "book-direct",
        data.headline,
        data.meta_title,
        data.meta_description,
        data.content_markdown,
        JSON.stringify(data.schema_markup),
      ]
    );
    console.log("  ✓ Book Direct page inserted");
  } catch (err) {
    console.error("  ✗ Book Direct page failed:", err);
  }
}

// ─── Main ────────────────────────────────────────────────────────

async function main() {
  const category = process.argv[2] || "all";
  console.log(`\nSEO Content Generation — Category: ${category}`);
  console.log(`Model: ${MODEL}\n`);

  const links = await getInternalLinks();
  console.log(`Loaded ${links.split("\n").length} internal links\n`);

  const generators: Record<string, () => Promise<void>> = {
    neighborhoods: () => generateNeighborhoodPages(links),
    usecases: () => generateUseCasePages(links),
    events: () => generateEventPages(links),
    comparison: () => generateComparisonPage(links),
  };

  if (category === "all") {
    for (const [name, fn] of Object.entries(generators)) {
      console.log(`\n── Starting ${name} ──`);
      await fn();
    }
  } else if (generators[category]) {
    await generators[category]();
  } else {
    console.error(
      `Unknown category: ${category}. Use: neighborhoods | usecases | events | comparison | all`
    );
    process.exit(1);
  }

  console.log("\n=== Generation Complete ===\n");
  await pool.end();
}

main().catch(async (err) => {
  console.error("Fatal error:", err);
  await pool.end();
  process.exit(1);
});
