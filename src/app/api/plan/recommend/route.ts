// src/app/api/plan/recommend/route.ts
// Streaming chat endpoint for the /plan/chat recommender surface.
// Vercel AI SDK v6: accepts UI messages from the client, runs the recommend
// agent (search_pois only — no itinerary, no listings), streams back the
// UI message stream.
//
// Abuse / cost guards (in order of cheapness — short-circuit early):
//   1. Content-Length too large → 413 (no parse)
//   2. Rate limit per IP → 429 (no parse)
//   3. JSON parse + shape validation → 400
//   4. Per-user-message char cap → 400 (catches single-message bombs)
//   5. Portland-topic keyword gate → 400 (catches off-topic before LLM call)
//   6. Hardened system prompt with explicit refusal for anything that
//      slipped through (1-sentence refusal, no tool call)
//   7. maxOutputTokens + lowered stopWhen on the actual LLM call
// Each layer cuts the most expensive layers from firing.

import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type ModelMessage,
  type UIMessage,
} from "ai";
import {
  buildRecommendSystem,
  recommendModel,
  recommendTools,
} from "@/lib/plan/recommend-agent";
import {
  enforceRateLimit,
  rejectOversizedRequest,
} from "@/lib/plan/route-guards";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_MESSAGES = 30;
const MAX_REQUEST_BYTES = 200_000;
const MAX_USER_MESSAGE_CHARS = 600;

// Permissive whitelist of tokens that signal a Portland-area recommendation
// query. Checked across the WHOLE conversation (not just the latest message)
// so a one-word follow-up like "Gorge" or "vegan" passes once an earlier
// turn established Portland context. Lowercased; matched as whole words via
// the regex below.
const PORTLAND_KEYWORDS = [
  // Geo identifiers
  "portland",
  "pdx",
  "oregon",
  "rose city",
  "willamette",
  // Day-trip destinations + qualifying nouns
  "gorge",
  "hood river",
  "astoria",
  "cannon beach",
  "seaside",
  "tillamook",
  "mt hood",
  "mount hood",
  "mcminnville",
  "carlton",
  "dundee",
  "wine country",
  "coast",
  "day trip",
  "day trips",
  // Common Portland neighborhoods (sample — anything in this set is enough)
  "pearl",
  "alberta",
  "hawthorne",
  "sellwood",
  "division",
  "downtown",
  "nob hill",
  "kerns",
  "buckman",
  "st johns",
  "richmond",
  "lloyd",
  "mt tabor",
  "tabor",
  "hollywood",
  "woodstock",
  "north portland",
  "northeast",
  "northwest",
  "southeast",
  "southwest",
  // Recommendation intent verbs
  "recommend",
  "recommends",
  "recommendation",
  "recommendations",
  "suggest",
  "suggests",
  "suggestion",
  "suggestions",
  "best",
  "favorite",
  "favourites",
  "favorites",
  "top",
  "great",
  "good",
  "where",
  "should i",
  "try",
  "go to",
  "visit",
  "visiting",
  // Place-category nouns
  "restaurant",
  "restaurants",
  "food",
  "eat",
  "eating",
  "dining",
  "dinner",
  "lunch",
  "breakfast",
  "brunch",
  "coffee",
  "cafe",
  "cafes",
  "café",
  "bar",
  "bars",
  "drink",
  "drinks",
  "cocktail",
  "cocktails",
  "wine",
  "beer",
  "brewery",
  "breweries",
  "pub",
  "pubs",
  "park",
  "parks",
  "museum",
  "museums",
  "shop",
  "shops",
  "shopping",
  "vintage",
  "bookstore",
  "bookstores",
  "music",
  "venue",
  "venues",
  "activity",
  "activities",
  "things to do",
  "thing to do",
  "attractions",
  "viewpoint",
  "view",
  "hike",
  "hikes",
  "hiking",
  "trail",
  "beach",
  "beaches",
  "food cart",
  "food carts",
  "cart pod",
  "rooftop",
  // Cuisines
  "italian",
  "thai",
  "japanese",
  "sushi",
  "ramen",
  "mexican",
  "taco",
  "tacos",
  "pizza",
  "pizzeria",
  "indian",
  "chinese",
  "korean",
  "vietnamese",
  "burger",
  "burgers",
  "vegan",
  "vegetarian",
  "gluten",
  "bbq",
  "barbecue",
  "seafood",
  // Vibe words
  "romantic",
  "kid friendly",
  "kid-friendly",
  "kids",
  "family",
  "date night",
  "date-night",
  "splurge",
  "cheap",
  "patio",
  "outdoor",
] as const;

// Pre-compiled regex: any whole-word match (with word-boundary semantics)
// against the keyword list, case-insensitive. Phrases like "hood river" use
// a flexible space match.
const PORTLAND_REGEX = new RegExp(
  "(?:^|[^a-z0-9])(?:" +
    PORTLAND_KEYWORDS.map((k) =>
      k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+")
    ).join("|") +
    ")(?:$|[^a-z0-9])",
  "i"
);

function extractAllUserText(messages: UIMessage[]): string {
  const out: string[] = [];
  for (const m of messages) {
    if (m.role !== "user") continue;
    for (const p of m.parts as unknown[]) {
      if (
        typeof p === "object" &&
        p !== null &&
        (p as { type?: unknown }).type === "text" &&
        typeof (p as { text?: unknown }).text === "string"
      ) {
        out.push((p as { text: string }).text);
      }
    }
  }
  return out.join(" ");
}

function violatesUserMessageCap(messages: UIMessage[]): string | null {
  for (const m of messages) {
    if (m.role !== "user") continue;
    let total = 0;
    for (const p of m.parts as unknown[]) {
      if (
        typeof p === "object" &&
        p !== null &&
        (p as { type?: unknown }).type === "text" &&
        typeof (p as { text?: unknown }).text === "string"
      ) {
        total += (p as { text: string }).text.length;
      }
    }
    if (total > MAX_USER_MESSAGE_CHARS) {
      return `user message too long (max ${MAX_USER_MESSAGE_CHARS} chars per message)`;
    }
  }
  return null;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function sanitizeBrokenToolParts(msg: UIMessage): UIMessage {
  if (msg.role !== "assistant") return msg;
  const parts = msg.parts as unknown as Array<Record<string, unknown>>;
  const keep = parts.filter((p) => {
    const type = typeof p?.type === "string" ? p.type : "";
    if (!type.startsWith("tool-")) return true;
    if (p.state !== "output-available") return false;
    if (!isPlainObject(p.input)) return false;
    return true;
  });
  if (keep.length === parts.length) return msg;
  return { ...msg, parts: keep as UIMessage["parts"] };
}

export async function POST(req: Request) {
  const sizeError = rejectOversizedRequest(req, MAX_REQUEST_BYTES);
  if (sizeError) return sizeError;

  // Tighter than other plan endpoints — every request streams LLM tokens.
  // 18 / 10min lets a real user iterate (~6 starter clicks + 12 follow-ups
  // in a 10-min session) but caps an attacker at ~$2/hr per IP at Haiku
  // 4.5 prices.
  const limited = await enforceRateLimit(req, "plan:recommend", {
    limit: 18,
    windowMs: 10 * 60 * 1000,
  });
  if (limited) return limited;

  let body: { messages?: UIMessage[] };
  try {
    body = (await req.json()) as { messages?: UIMessage[] };
  } catch {
    return new Response("invalid json body", { status: 400 });
  }

  const rawMessages = body.messages ?? [];
  if (!Array.isArray(rawMessages)) {
    return new Response("messages must be an array", { status: 400 });
  }
  if (rawMessages.length === 0) {
    return new Response("messages must not be empty", { status: 400 });
  }
  if (rawMessages.length > MAX_MESSAGES) {
    return new Response(`too many messages (max ${MAX_MESSAGES})`, {
      status: 400,
    });
  }
  if (JSON.stringify(rawMessages).length > MAX_REQUEST_BYTES) {
    return new Response(`messages too large (max ${MAX_REQUEST_BYTES} bytes)`, {
      status: 413,
    });
  }

  // Per-user-message cap: stops a single bombed-in 50K-char message even
  // when total request bytes are under MAX_REQUEST_BYTES.
  const tooLong = violatesUserMessageCap(rawMessages);
  if (tooLong) {
    return new Response(tooLong, { status: 400 });
  }

  // Topic gate. If NO Portland-related keyword appears anywhere in the
  // user's side of the conversation, refuse without ever calling the LLM.
  // The keyword list is permissive (anything food/coffee/bar/park/PDX/etc
  // passes); the goal is to catch off-topic abuse like "write me Python"
  // or generic prompt injection attempts. False rejections are fixable by
  // adding a keyword; the cost of letting through is real LLM tokens.
  const userText = extractAllUserText(rawMessages);
  if (!PORTLAND_REGEX.test(userText)) {
    return Response.json(
      {
        error:
          "I only help with Portland-area recommendations — try asking about restaurants, coffee, bars, parks, or things to do.",
      },
      { status: 400 }
    );
  }

  const messages = rawMessages.map(sanitizeBrokenToolParts);
  const modelMessages = await convertToModelMessages(messages);
  if (modelMessages.length === 0) {
    return new Response("no valid messages to send", { status: 400 });
  }

  const cachedSystem: ModelMessage = {
    role: "system",
    content: buildRecommendSystem(),
    providerOptions: {
      anthropic: { cacheControl: { type: "ephemeral" } },
    },
  };

  const result = streamText({
    model: recommendModel,
    tools: recommendTools,
    messages: [cachedSystem, ...modelMessages],
    // Tight ceiling on tool steps — search_pois → reply is 2 steps, a
    // single mid-stream refinement is 3. Cap at 3 to prevent runaway
    // tool-call chains.
    stopWhen: stepCountIs(3),
    // Output ceiling — a 6-pick reply with one-line takes runs ~400-600
    // tokens. 1200 is generous headroom; anything beyond is the model
    // rambling and gets cut.
    maxOutputTokens: 1200,
    temperature: 0.6,
  });

  return result.toUIMessageStreamResponse();
}
