#!/usr/bin/env tsx
// scripts/seed-popular-ideas.ts
// Pre-warm the /plan template cache for the "Popular trip ideas" cards on
// the landing hero. Runs the live agent once per card and saves the result
// to sp_plans with the card's cacheKey. After this runs, every Popular-idea
// click on /plan hits /api/plan/from-template → clones cached plan →
// renders in ~200ms instead of waiting 15–25s for the live agent.
//
// Run: npx tsx --env-file=.env.local scripts/seed-popular-ideas.ts
//
// Options:
//   --skip-existing        Skip cards that already have a ≤7d cached row
//   --only <cacheKey>      Seed only the card with this cacheKey
//
// Sequential so we stay well under Anthropic + Guesty BEAPI rate limits.

import { randomUUID } from "node:crypto";
import {
  convertToModelMessages,
  readUIMessageStream,
  stepCountIs,
  streamText,
  type ModelMessage,
  type UIMessage,
} from "ai";
import { Client } from "pg";
import {
  buildPlanSystem,
  planModelSonnet,
  planTools,
} from "../src/lib/plan/agent";
import { POPULAR_IDEAS } from "../src/lib/plan/popular-ideas";
import {
  detectPartyType,
  detectVibe,
  preloadPoiCandidates,
  renderCandidatesForPrompt,
} from "../src/lib/plan/poi-preload";

const argv = process.argv.slice(2);
const skipExisting = argv.includes("--skip-existing");
const onlyIdx = argv.indexOf("--only");
const onlyKey = onlyIdx >= 0 && argv[onlyIdx + 1] ? argv[onlyIdx + 1]! : null;

interface SeedResult {
  cacheKey: string;
  status: "seeded" | "skipped" | "failed";
  planId?: string;
  dayCount?: number;
  durationMs?: number;
  error?: string;
}

async function runAgent(opener: string): Promise<UIMessage[]> {
  const userMessage: UIMessage = {
    id: randomUUID(),
    role: "user",
    parts: [{ type: "text", text: opener }],
  };

  const modelMessages = await convertToModelMessages([userMessage]);
  if (modelMessages.length === 0) {
    throw new Error("convertToModelMessages returned nothing");
  }

  const cachedSystem: ModelMessage = {
    role: "system",
    content: buildPlanSystem(),
    providerOptions: {
      anthropic: { cacheControl: { type: "ephemeral" } },
    },
  };

  // Mirror the production chat route: preload a vibe-balanced POI slate and
  // inject as a second system block. Without this, the seed agent runs
  // search_pois from scratch and sometimes emits hallucinated ids that get
  // filtered out server-side, leaving days with 1-2 items.
  const candidates = await preloadPoiCandidates({
    vibe: detectVibe(opener),
    partyType: detectPartyType(opener),
  });
  const preloadSystem: ModelMessage = {
    role: "system",
    content: `PRELOADED_CANDIDATES

You have a curated slate of real Portland POIs below — already filtered to match the visitor's vibe and balanced across categories. IDs are stable sp_pois ids, safe to use directly in generate_itinerary.

Rules for this turn:
- Build the itinerary by picking ids from this list. DO NOT call search_pois on this turn — the slate covers what you need.
- MINIMUM 4 items per day. A full day = 5 items across morning/midday/afternoon/evening/late. Even day-trip days need morning coffee + lunch near the trip + the main activity + dinner back in town.
- Max 2 restaurants per day. Bar category goes to "late" not "evening". Restaurant goes to "midday" or "evening", never "afternoon".

${renderCandidatesForPrompt(candidates)}`,
  };

  const result = streamText({
    model: planModelSonnet,
    tools: planTools,
    messages: [cachedSystem, preloadSystem, ...modelMessages],
    stopWhen: stepCountIs(8),
    temperature: 0.7,
  });

  const latestById = new Map<string, UIMessage>();
  const stream = result.toUIMessageStream();
  for await (const msg of readUIMessageStream({ stream })) {
    latestById.set(msg.id, msg as UIMessage);
  }

  const assistantMessages = [...latestById.values()].filter(
    (m) => m.role === "assistant"
  );
  if (assistantMessages.length === 0) {
    throw new Error("agent produced no assistant messages");
  }
  return [userMessage, ...assistantMessages];
}

function itineraryDayCount(messages: UIMessage[]): number {
  for (const msg of messages) {
    if (msg.role !== "assistant") continue;
    for (const part of msg.parts as Array<{
      type?: string;
      output?: { ok?: boolean; itinerary?: { days?: unknown[] } };
    }>) {
      if (part?.type !== "tool-generate_itinerary") continue;
      const days = part.output?.itinerary?.days;
      if (Array.isArray(days)) return days.length;
    }
  }
  return 0;
}

async function seedOne(
  client: Client,
  idea: (typeof POPULAR_IDEAS)[number]
): Promise<SeedResult> {
  const started = Date.now();
  if (skipExisting) {
    const { rows } = await client.query(
      `select id from public.sp_plans
         where cache_key = $1 and updated_at > now() - interval '7 days'
         order by updated_at desc limit 1`,
      [idea.cacheKey]
    );
    if (rows.length > 0) {
      return { cacheKey: idea.cacheKey, status: "skipped", planId: rows[0].id };
    }
  }

  let messages: UIMessage[];
  try {
    messages = await runAgent(idea.prompt);
  } catch (e) {
    return {
      cacheKey: idea.cacheKey,
      status: "failed",
      error: (e as Error).message,
      durationMs: Date.now() - started,
    };
  }

  const dayCount = itineraryDayCount(messages);
  if (dayCount === 0) {
    const debug = messages
      .filter((m) => m.role === "assistant")
      .flatMap((m) =>
        (m.parts as Array<{ type?: string; text?: string }>)
          .filter((p) => p.type === "text" && typeof p.text === "string")
          .map((p) => p.text!.slice(0, 200))
      )
      .join(" | ");
    return {
      cacheKey: idea.cacheKey,
      status: "failed",
      error: `agent finished without emitting generate_itinerary. Last text: "${debug}"`,
      durationMs: Date.now() - started,
    };
  }

  const { rows } = await client.query(
    `insert into public.sp_plans (messages, cache_key)
       values ($1, $2)
       returning id`,
    [JSON.stringify(messages), idea.cacheKey]
  );

  return {
    cacheKey: idea.cacheKey,
    status: "seeded",
    planId: rows[0].id,
    dayCount,
    durationMs: Date.now() - started,
  };
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY is required (pull with vercel env pull)"
    );
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }

  const targets = onlyKey
    ? POPULAR_IDEAS.filter((i) => i.cacheKey === onlyKey)
    : POPULAR_IDEAS;
  if (onlyKey && targets.length === 0) {
    throw new Error(`no popular idea matches --only ${onlyKey}`);
  }

  console.log(
    `seeding ${targets.length} popular idea${targets.length === 1 ? "" : "s"}${
      skipExisting ? " (skipping <7d cached)" : ""
    }`
  );

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  await client.connect();

  const results: SeedResult[] = [];
  try {
    for (const idea of targets) {
      const started = Date.now();
      process.stdout.write(`  ${idea.cacheKey}… `);
      const result = await seedOne(client, idea);
      results.push(result);
      const ms = result.durationMs ?? Date.now() - started;
      const secs = (ms / 1000).toFixed(1);
      if (result.status === "seeded") {
        console.log(
          `seeded (${result.dayCount}d, ${secs}s) → ${result.planId}`
        );
      } else if (result.status === "skipped") {
        console.log(`skipped (cached ${result.planId})`);
      } else {
        console.log(`FAILED (${secs}s): ${result.error}`);
      }
    }
  } finally {
    await client.end();
  }

  const seeded = results.filter((r) => r.status === "seeded").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  const failed = results.filter((r) => r.status === "failed");
  console.log(
    `\ndone: ${seeded} seeded, ${skipped} skipped, ${failed.length} failed`
  );
  if (failed.length > 0) {
    for (const f of failed) {
      console.log(`  - ${f.cacheKey}: ${f.error}`);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
