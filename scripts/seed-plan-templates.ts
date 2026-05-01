#!/usr/bin/env tsx
// scripts/seed-plan-templates.ts
// Pre-warm the /plan template cache by running the live agent once per
// (vibe, duration) chip combo and saving each resulting plan to sp_plans
// with a stable cache_key. After this runs, every chip click on /plan hits
// the template cache and renders instantly instead of waiting ~15–25s for
// the live agent.
//
// Run: npx tsx --env-file=.env.local scripts/seed-plan-templates.ts
//
// Skip combos that already exist in the cache with:
//   --skip-existing
//
// Re-seed a single combo (useful during development):
//   --only food:long
//
// The script runs sequentially to stay well below Anthropic and Guesty
// BEAPI rate limits. Expected total runtime: ~5–7 minutes for all 15
// cacheable combos.

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
  pickPlanModel,
  planTools,
} from "../src/lib/plan/agent";
import {
  VIBE_CHIPS,
  DURATION_CHIPS,
  cacheKeyFor,
  composeOpener,
  isCacheableCombo,
} from "../src/lib/plan/starter-chips";

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

function buildCombos() {
  const combos: Array<{
    vibe: (typeof VIBE_CHIPS)[number];
    duration: (typeof DURATION_CHIPS)[number];
    key: string;
  }> = [];
  for (const vibe of VIBE_CHIPS) {
    for (const duration of DURATION_CHIPS) {
      if (!isCacheableCombo(vibe, duration)) continue;
      combos.push({ vibe, duration, key: cacheKeyFor(vibe, duration) });
    }
  }
  return combos;
}

async function runAgent(opener: string): Promise<UIMessage[]> {
  // Build the user message the same way the live client does: one text part.
  const userMessage: UIMessage = {
    id: randomUUID(),
    role: "user",
    parts: [{ type: "text", text: opener }],
  };

  const modelMessages = await convertToModelMessages([userMessage]);
  if (modelMessages.length === 0) {
    throw new Error("convertToModelMessages returned nothing");
  }

  // Match the live chat route exactly: cached system prompt + the same model
  // picker. With one user message, pickPlanModel returns Sonnet 4.6 — the
  // same model a cache-miss visitor would see.
  const cachedSystem: ModelMessage = {
    role: "system",
    content: buildPlanSystem(),
    providerOptions: {
      anthropic: { cacheControl: { type: "ephemeral" } },
    },
  };

  const model = pickPlanModel(1);

  const result = streamText({
    model,
    tools: planTools,
    messages: [cachedSystem, ...modelMessages],
    stopWhen: stepCountIs(8),
    temperature: 0.7,
  });

  // Drain the UI message stream and accumulate the latest version of each
  // assistant message. readUIMessageStream yields progressive snapshots as
  // parts arrive — keeping only the most recent snapshot per id gives us
  // the final UIMessage[] ready for sp_plans persistence.
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
  combo: ReturnType<typeof buildCombos>[number]
): Promise<SeedResult> {
  const { vibe, duration, key } = combo;
  const opener = composeOpener(vibe, duration);
  const started = Date.now();

  if (skipExisting) {
    const { rows } = await client.query(
      `select id from public.sp_plans
         where cache_key = $1 and updated_at > now() - interval '7 days'
         order by updated_at desc limit 1`,
      [key]
    );
    if (rows.length > 0) {
      return { cacheKey: key, status: "skipped", planId: rows[0].id };
    }
  }

  let messages: UIMessage[];
  try {
    messages = await runAgent(opener);
  } catch (e) {
    return {
      cacheKey: key,
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
      cacheKey: key,
      status: "failed",
      error: `agent finished without emitting generate_itinerary. Last text: "${debug}"`,
      durationMs: Date.now() - started,
    };
  }

  // Insert a fresh sp_plans row. We don't reuse an existing row because the
  // live-flow persistence is keyed by id, not cache_key — the template is
  // just "the newest sp_plans row with this cache_key."
  const { rows } = await client.query(
    `insert into public.sp_plans (messages, cache_key)
       values ($1, $2)
       returning id`,
    [JSON.stringify(messages), key]
  );

  return {
    cacheKey: key,
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
  if (!process.env.SHARED_DATABASE_URL) {
    throw new Error("SHARED_DATABASE_URL is required");
  }

  const combos = buildCombos();
  const targets = onlyKey ? combos.filter((c) => c.key === onlyKey) : combos;
  if (onlyKey && targets.length === 0) {
    throw new Error(`no combo matches --only ${onlyKey}`);
  }

  console.log(
    `seeding ${targets.length} combo${targets.length === 1 ? "" : "s"}${
      skipExisting ? " (skipping existing <7d cached)" : ""
    }`
  );

  const client = new Client({
    connectionString: process.env.SHARED_DATABASE_URL,
  });
  await client.connect();

  const results: SeedResult[] = [];
  try {
    for (const combo of targets) {
      const started = Date.now();
      process.stdout.write(`  ${combo.key}… `);
      const result = await seedOne(client, combo);
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
