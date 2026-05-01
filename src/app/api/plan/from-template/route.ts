// src/app/api/plan/from-template/route.ts
// Template prefill: on a chip click, the client hands us a cache_key like
// "food:long-weekend". We look up the most recent sp_plans row with that
// cache_key that's still fresh (≤7 days old), clone its messages into a new
// anonymous sp_plans row, and return the new uuid. The client then navigates
// to /plan/<uuid> and renders instantly — no agent run required.
//
// On cache miss, we return { id: null } and the client falls back to the
// live agent flow (composeOpener + sendMessage). The live flow will
// eventually save its own row with this cache_key, so the second visitor of
// the week clicking the same combo gets the instant path.
//
// TTL: 7 days. Dates and rental availability inside the cached plan drift,
// but the itinerary structure (POIs, day layout, reasons) stays relevant.
// For the truly hot combos a pre-warm cron (next iteration) will refresh
// nightly.

import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { POPULAR_IDEAS } from "@/lib/plan/popular-ideas";
import {
  enforceRateLimit,
  rejectOversizedRequest,
} from "@/lib/plan/route-guards";
import type { UIMessage } from "ai";

export const runtime = "nodejs";

const CACHE_KEY_RE = /^[a-z0-9:_-]{1,64}$/;
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const ALLOWED_CACHE_KEYS = new Set(POPULAR_IDEAS.map((idea) => idea.cacheKey));

interface TemplateBody {
  cacheKey?: string;
}

function messagesHaveItinerary(messages: UIMessage[] | null): boolean {
  if (!Array.isArray(messages)) return false;
  for (const msg of messages) {
    if (!msg || msg.role !== "assistant") continue;
    const parts = (msg.parts ?? []) as Array<{
      type?: string;
      state?: string;
      output?: { ok?: boolean; itinerary?: { days?: unknown[] } };
    }>;
    for (const part of parts) {
      if (part?.type !== "tool-generate_itinerary") continue;
      if (part.state !== "output-available") continue;
      const days = part.output?.itinerary?.days;
      if (Array.isArray(days) && days.length > 0) return true;
    }
  }
  return false;
}

export async function POST(req: Request) {
  const sizeError = rejectOversizedRequest(req, 4_096);
  if (sizeError) return sizeError;

  const limited = await enforceRateLimit(req, "plan:from-template", {
    limit: 40,
    windowMs: 10 * 60 * 1000,
  });
  if (limited) return limited;

  let body: TemplateBody;
  try {
    body = (await req.json()) as TemplateBody;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const key = body.cacheKey;
  if (!key || !CACHE_KEY_RE.test(key)) {
    return NextResponse.json(
      { error: "valid cacheKey required" },
      {
        status: 400,
      }
    );
  }
  if (!ALLOWED_CACHE_KEYS.has(key)) {
    return NextResponse.json({ error: "unknown cacheKey" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // Grab the freshest row for this key. Filter by recency client-side to
  // keep the query simple; the composite index covers (cache_key, updated_at).
  const { data, error } = await supabase
    .from("sp_plans")
    .select("messages, updated_at")
    .eq("cache_key", key)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ id: null, hit: false });
  }

  const updatedAt = data.updated_at ? new Date(data.updated_at).getTime() : 0;
  if (Date.now() - updatedAt > CACHE_TTL_MS) {
    return NextResponse.json({ id: null, hit: false });
  }

  // Defense-in-depth: a template with no completed generate_itinerary is a
  // broken seed (or a client save that raced ahead of the agent). Don't
  // serve it — fall through to the live agent so the visitor gets a real
  // plan instead of a dead-end "How many people…" screen.
  if (!messagesHaveItinerary(data.messages as UIMessage[] | null)) {
    return NextResponse.json({ id: null, hit: false });
  }

  // Clone the messages into a fresh anonymous plan so the visitor has their
  // own editable/shareable copy. We don't re-set cache_key on the clone — the
  // clone represents one visitor's plan, not the template itself.
  const { data: insert, error: insertErr } = await supabase
    .from("sp_plans")
    .insert({ messages: data.messages as UIMessage[] })
    .select("id")
    .single();

  if (insertErr || !insert) {
    return NextResponse.json(
      { error: insertErr?.message ?? "insert failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ id: insert.id, hit: true });
}
