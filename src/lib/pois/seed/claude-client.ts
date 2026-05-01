// src/lib/pois/seed/claude-client.ts
// Thin wrapper around @anthropic-ai/sdk used by Pass 1 (extraction) and Pass 3 (tagging).
// Server/Node only — never bundled into client code.

import Anthropic from "@anthropic-ai/sdk";

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  throw new Error("ANTHROPIC_API_KEY is required for POI seeding");
}

export const claude = new Anthropic({ apiKey });

export const SEED_MODEL = "claude-sonnet-4-6";

/**
 * Run a single completion and return the text content parsed as JSON.
 * Strips markdown code fences if present.
 * Throws on any error, non-text content block, or JSON parse failure.
 */
export async function completeJson<T>(opts: {
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<T> {
  const response = await claude.messages.create({
    model: SEED_MODEL,
    max_tokens: opts.maxTokens ?? 4096,
    system: opts.system,
    messages: [{ role: "user", content: opts.user }],
  });

  const block = response.content[0];
  if (!block || block.type !== "text") {
    throw new Error("Claude returned non-text content");
  }

  // Strip markdown code fences if present
  let raw = block.text.trim();
  if (raw.startsWith("```")) {
    raw = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  try {
    return JSON.parse(raw) as T;
  } catch (e) {
    throw new Error(
      `Claude JSON parse failed: ${(e as Error).message}\nRaw: ${raw.slice(0, 500)}`
    );
  }
}
