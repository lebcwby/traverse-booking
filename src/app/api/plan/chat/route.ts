// src/app/api/plan/chat/route.ts
// Streaming chat endpoint for the /plan trip planner.
// Vercel AI SDK v6: accepts UI messages from the client, runs the Claude
// agent with our tool set, streams back the UI message stream.
//
// When the agent calls `generate_itinerary`, this route re-parses the tool
// input, hydrates POIs from sp_pois, and streams the hydrated result as a
// custom data part the client can pick up.

import {
  convertToModelMessages,
  generateText,
  stepCountIs,
  streamText,
  type ModelMessage,
  type UIMessage,
} from "ai";
import { buildPlanSystem, planModelSonnet, planTools } from "@/lib/plan/agent";
import type { z } from "zod";
import {
  detectAnchorNeighborhoods,
  detectPartyType,
  detectVibe,
  preloadPoiCandidates,
  renderCandidatesForPrompt,
} from "@/lib/plan/poi-preload";
import {
  enforceRateLimit,
  rejectOversizedRequest,
} from "@/lib/plan/route-guards";

export const runtime = "nodejs";
// 300s covers the worst-case refinement: generate_itinerary JSON stream +
// BEAPI availability across 1 primary + 4 alternate date ranges + ranking.
// Observed 90s+ locally on a cold cache.
export const maxDuration = 300;

const MAX_MESSAGES = 30;
const MAX_REQUEST_BYTES = 200_000;

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

// True iff any prior assistant message has a successful generate_itinerary.
// If true we skip the preload — this is a refinement turn and the agent may
// legitimately need search_pois to find something not in the slate.
function hasSuccessfulItinerary(msgs: UIMessage[]): boolean {
  for (const msg of msgs) {
    if (msg.role !== "assistant") continue;
    const parts = msg.parts as unknown as Array<Record<string, unknown>>;
    for (const p of parts) {
      const type = typeof p?.type === "string" ? p.type : "";
      if (
        type === "tool-generate_itinerary" &&
        p.state === "output-available"
      ) {
        return true;
      }
    }
  }
  return false;
}

export async function POST(req: Request) {
  const sizeError = rejectOversizedRequest(req, MAX_REQUEST_BYTES);
  if (sizeError) return sizeError;

  const limited = await enforceRateLimit(req, "plan:chat", {
    limit: 24,
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

  // Strip broken tool parts before handing to convertToModelMessages. A tool
  // part with state "output-error" (or any non-settled state) can have
  // `input: null` when the model emitted malformed JSON the Zod parser
  // rejected — replaying that to Anthropic fails with
  // "tool_use.input: Input should be a valid dictionary". We drop the part
  // entirely; surrounding text parts are kept so the agent still has the
  // narrative context and can retry the tool call cleanly.
  const messages = rawMessages.map(sanitizeBrokenToolParts);

  const modelMessages = await convertToModelMessages(messages);
  if (modelMessages.length === 0) {
    // convertToModelMessages can drop empty messages — belt-and-suspenders
    return new Response("no valid messages to send", { status: 400 });
  }

  // Prompt caching: the system prompt is static (~10k tokens) across all
  // turns of a conversation AND across conversations. Marking it with an
  // ephemeral cache breakpoint lets Anthropic reuse the prefix — first hit
  // writes the cache, every subsequent turn reads it, cutting input-token
  // latency and cost on follow-ups substantially. Note: caches are keyed per
  // model, so the Sonnet→Haiku handoff at generation time doesn't reuse the
  // interview's warm cache — Haiku pays one cache-miss on its first turn.
  const cachedSystem: ModelMessage = {
    role: "system",
    content: buildPlanSystem(),
    providerOptions: {
      anthropic: { cacheControl: { type: "ephemeral" } },
    },
  };

  // Preload POI candidates for fresh plans. Skips refinement turns (where a
  // successful itinerary already exists) because those legitimately need
  // search_pois for "find me X" follow-ups the slate wouldn't cover. Kills
  // the 5-8 sequential search_pois round-trips on the hot path.
  const preloadEligible = !hasSuccessfulItinerary(rawMessages);
  let preloadSystem: ModelMessage | null = null;
  if (preloadEligible) {
    // Concatenate every user message so anchor detection catches a
    // neighborhood named in a follow-up answer, not just the opener.
    const opener = rawMessages
      .filter((m) => m.role === "user")
      .map((m) => {
        const parts = m.parts as unknown as Array<{
          type?: string;
          text?: string;
        }>;
        return parts
          .filter((p) => p?.type === "text" && typeof p.text === "string")
          .map((p) => p.text as string)
          .join(" ");
      })
      .join(" ");
    const anchors = detectAnchorNeighborhoods(opener);
    try {
      const candidates = await preloadPoiCandidates({
        vibe: detectVibe(opener),
        partyType: detectPartyType(opener),
        anchorNeighborhoods: anchors,
      });
      const anchorBlock =
        anchors.length > 0
          ? `\n\nAnchor neighborhood(s) the visitor named: ${anchors.join(", ")}. Build the itinerary AROUND these — most picks should be in one of them, and anything outside should have a concrete reason (a specific request, a day trip, an iconic spot like Pittock or Powell's). Do NOT scatter picks across unrelated neighborhoods when the user named where they're staying.`
          : "";
      preloadSystem = {
        role: "system",
        content: `PRELOADED_CANDIDATES

You have a curated slate of real Portland POIs below — already filtered to match the visitor's vibe and balanced across categories. IDs are stable sp_pois ids, safe to use directly in generate_itinerary.

Rules for this turn:
- Build the itinerary by picking ids from this list. DO NOT call search_pois on this turn — the slate covers what you need.
- Aim for a FULL day: 5-6 items per day with time-slot coverage across morning / midday / afternoon / evening. Not every item needs to be food — include at least one non-food activity (park, viewpoint, activity, shop, museum) per day.
- Max 2 restaurants per day. Pair a breakfast/coffee, a walk or activity, a lunch, an afternoon thing, a dinner, and optionally a nightcap.
- Favorites (marked [FAV]) should anchor the plan but shouldn't be more than ~40% of picks — pull in fresh discoveries too so the plan isn't just the greatest hits.
- Any [FAV — order: X] tag means mention X verbatim in that item's reason.${anchorBlock}

search_pois is still available if a user later asks for something specific not in the slate ("find me a Spanish restaurant", "something closer to downtown"). That's a REFINEMENT flow, not the initial generate.

${renderCandidatesForPrompt(candidates)}`,
        providerOptions: {
          // Don't cache — candidates vary per request (random tiebreak +
          // different vibes). Caching would force staleness.
          anthropic: {},
        },
      };
      console.log(
        `[plan/chat] preloaded ${candidates.length} candidates (vibe=${detectVibe(opener) ?? "default"}, anchors=[${anchors.join(",")}])`
      );
    } catch (e) {
      // Non-fatal — fall back to the old search_pois flow.
      console.error("[plan/chat] preload failed:", (e as Error).message);
    }
  }

  // Sonnet on every turn. Haiku empirically malforms generate_itinerary's
  // nested JSON often enough that retrying through the repair hook hurts UX
  // more than just running Sonnet from the start. Preload already removed
  // the 20s of sequential search_pois round-trips, so Sonnet's slower token
  // stream is tolerable on fresh plans; refinement turns (the hot path for
  // this decision) now also stay on Sonnet for reliability.
  const userMessageCount = modelMessages.filter(
    (m) => m.role === "user"
  ).length;
  const onRefinement = hasSuccessfulItinerary(rawMessages);
  const chosenModel = planModelSonnet;
  console.log(
    `[plan/chat] userMessages=${userMessageCount} refinement=${onRefinement} model=sonnet-4-6`
  );

  const systemMessages: ModelMessage[] = [cachedSystem];
  if (preloadSystem) systemMessages.push(preloadSystem);

  const result = streamText({
    model: chosenModel,
    tools: planTools,
    messages: [...systemMessages, ...modelMessages],
    stopWhen: stepCountIs(8),
    temperature: 0.7,
    // Safety net: when the model emits a tool_use whose JSON input fails
    // Zod validation, ask Sonnet to re-emit it correctly. Without this
    // hook, the broken tool_use gets included in the next step's messages
    // and Anthropic rejects the whole turn with
    // "tool_use.input: Input should be a valid dictionary".
    //
    // We use generateText + manual JSON.parse + Zod.parse instead of
    // generateObject because Anthropic's structured-output path rejects
    // our schema ("For 'integer' type, properties maximum, minimum are
    // not supported") — our Zod schema has min/max on integer fields like
    // durationMinutes, dayNumber, adults. Freeform text avoids that
    // constraint; Zod re-validates on our side to keep the guarantees.
    experimental_repairToolCall: async ({
      toolCall,
      tools,
      inputSchema,
      error,
    }) => {
      console.error(
        `[plan/chat] tool repair triggered: ${toolCall.toolName} — ${error.message}`
      );
      const tool = tools[toolCall.toolName as keyof typeof tools];
      if (!tool) return null;
      const schema = await inputSchema({ toolName: toolCall.toolName });
      try {
        const { text } = await generateText({
          model: planModelSonnet,
          prompt:
            `The previous model emitted the tool "${toolCall.toolName}" with invalid arguments.\n\n` +
            `Error: ${error.message}\n\n` +
            `Broken arguments (may be malformed JSON):\n${JSON.stringify(toolCall.input)}\n\n` +
            `Schema (JSON Schema):\n${JSON.stringify(schema)}\n\n` +
            `Return ONLY a valid JSON object matching the schema — no markdown fences, no prose, nothing else. Preserve the original intent; only fix structural errors.`,
        });
        const jsonText = text
          .trim()
          .replace(/^```(?:json)?\s*/i, "")
          .replace(/\s*```$/i, "")
          .trim();
        const parsed = JSON.parse(jsonText) as unknown;
        // inputSchema is typed as FlexibleSchema by the SDK but is always a
        // Zod schema at runtime (see tools/*.ts); cast so .parse() works.
        const validated = (
          tool.inputSchema as unknown as z.ZodType<unknown>
        ).parse(parsed);
        console.log(
          `[plan/chat] tool repair succeeded for ${toolCall.toolName}`
        );
        return {
          ...toolCall,
          input: JSON.stringify(validated),
        };
      } catch (repairErr) {
        console.error(
          `[plan/chat] tool repair failed:`,
          (repairErr as Error).message
        );
        return null;
      }
    },
  });

  return result.toUIMessageStreamResponse();
}
