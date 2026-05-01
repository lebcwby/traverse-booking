#!/usr/bin/env tsx
// scripts/seed-recommend-topics.ts
// Pre-warm the /portland-recommendations slug landers. Runs the live
// recommend agent once per slug and saves the resulting UIMessage[] to
// sp_plans with the slug's cache_key (e.g. recommend:best-italian-restaurants).
// After this runs, /portland-recommendations/<slug> hydrates RecommendChat
// with the cached Q&A so the visitor lands mid-answer with POI cards already
// on screen.
//
// Run: npx tsx --env-file=.env.local scripts/seed-recommend-topics.ts
//
// Options:
//   --skip-existing        Skip slugs that already have a ≤7d cached row
//   --only <cacheKey>      Seed only the slug with this cacheKey
//
// Sequential so we stay under Anthropic + Postgres limits.

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
  buildRecommendSystem,
  recommendModel,
  recommendTools,
} from "../src/lib/plan/recommend-agent";
import { RECOMMEND_SLUGS } from "../src/lib/plan/recommend-slug-map";

const argv = process.argv.slice(2);
const skipExisting = argv.includes("--skip-existing");
const onlyIdx = argv.indexOf("--only");
const onlyKey = onlyIdx >= 0 && argv[onlyIdx + 1] ? argv[onlyIdx + 1]! : null;

interface SeedResult {
  cacheKey: string;
  status: "seeded" | "skipped" | "failed";
  planId?: string;
  poiCount?: number;
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
    content: buildRecommendSystem(),
    providerOptions: {
      anthropic: { cacheControl: { type: "ephemeral" } },
    },
  };

  // Mirror /api/plan/recommend exactly — same model, tools, stopWhen,
  // maxOutputTokens, temperature. If the production endpoint changes those,
  // update this block too.
  const result = streamText({
    model: recommendModel,
    tools: recommendTools,
    messages: [cachedSystem, ...modelMessages],
    stopWhen: stepCountIs(3),
    maxOutputTokens: 1200,
    temperature: 0.6,
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

function poiCount(messages: UIMessage[]): number {
  const ids = new Set<string>();
  for (const msg of messages) {
    if (msg.role !== "assistant") continue;
    for (const part of msg.parts as Array<{
      type?: string;
      state?: string;
      output?: { pois?: Array<{ id?: string }> };
    }>) {
      if (part?.type !== "tool-search_pois") continue;
      if (part.state !== "output-available") continue;
      for (const poi of part.output?.pois ?? []) {
        if (poi.id) ids.add(poi.id);
      }
    }
  }
  return ids.size;
}

async function seedOne(
  client: Client,
  entry: (typeof RECOMMEND_SLUGS)[keyof typeof RECOMMEND_SLUGS]
): Promise<SeedResult> {
  const started = Date.now();
  if (skipExisting) {
    const { rows } = await client.query(
      `select id from public.sp_plans
         where cache_key = $1 and updated_at > now() - interval '7 days'
         order by updated_at desc limit 1`,
      [entry.cacheKey]
    );
    if (rows.length > 0) {
      return {
        cacheKey: entry.cacheKey,
        status: "skipped",
        planId: rows[0].id,
      };
    }
  }

  let messages: UIMessage[];
  try {
    messages = await runAgent(entry.opener);
  } catch (e) {
    return {
      cacheKey: entry.cacheKey,
      status: "failed",
      error: (e as Error).message,
      durationMs: Date.now() - started,
    };
  }

  const count = poiCount(messages);
  if (count === 0) {
    const debug = messages
      .filter((m) => m.role === "assistant")
      .flatMap((m) =>
        (m.parts as Array<{ type?: string; text?: string }>)
          .filter((p) => p.type === "text" && typeof p.text === "string")
          .map((p) => p.text!.slice(0, 200))
      )
      .join(" | ");
    return {
      cacheKey: entry.cacheKey,
      status: "failed",
      error: `agent produced no search_pois output. Last text: "${debug}"`,
      durationMs: Date.now() - started,
    };
  }

  const { rows } = await client.query(
    `insert into public.sp_plans (messages, cache_key)
       values ($1, $2)
       returning id`,
    [JSON.stringify(messages), entry.cacheKey]
  );

  return {
    cacheKey: entry.cacheKey,
    status: "seeded",
    planId: rows[0].id,
    poiCount: count,
    durationMs: Date.now() - started,
  };
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY is required (pull with vercel env pull)"
    );
  }
  if (!process.env.SHARED_DATABASE_URL) {
    throw new Error("SHARED_DATABASE_URL is required");
  }

  const allEntries = Object.values(RECOMMEND_SLUGS);
  const targets = onlyKey
    ? allEntries.filter((e) => e.cacheKey === onlyKey)
    : allEntries;
  if (onlyKey && targets.length === 0) {
    throw new Error(`no recommend slug matches --only ${onlyKey}`);
  }

  console.log(
    `seeding ${targets.length} recommend topic${
      targets.length === 1 ? "" : "s"
    }${skipExisting ? " (skipping <7d cached)" : ""}`
  );

  const client = new Client({
    connectionString: process.env.SHARED_DATABASE_URL,
  });
  await client.connect();

  const results: SeedResult[] = [];
  try {
    for (const entry of targets) {
      const started = Date.now();
      process.stdout.write(`  ${entry.cacheKey}… `);
      const result = await seedOne(client, entry);
      results.push(result);
      const ms = result.durationMs ?? Date.now() - started;
      const secs = (ms / 1000).toFixed(1);
      if (result.status === "seeded") {
        console.log(
          `seeded (${result.poiCount} pois, ${secs}s) → ${result.planId}`
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
