// src/app/api/plan/state/route.ts
// Persistence for the trip planner. Upserts the full useChat message array
// into public.sp_plans and returns (or mints) a stable plan id that the
// client puts in the URL. On first save we insert and return a new uuid;
// subsequent saves carry that id back and update the existing row.
//
// Anonymous on purpose — anyone with the uuid can read/write. The plan is
// non-sensitive content (a list of Portland places) and the product wants
// shareable links. Revisit if we ever store PII here.

import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  enforceRateLimit,
  rejectOversizedRequest,
} from "@/lib/plan/route-guards";
import type { UIMessage } from "ai";

export const runtime = "nodejs";

interface SaveBody {
  id?: string;
  messages?: UIMessage[];
  // Deprecated and intentionally rejected. Template cache writes are
  // server-side only (seed scripts use the DB directly); browsers must not
  // be able to promote a saved plan into the shared template slot.
  cacheKey?: string;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_MESSAGES = 40;
const MAX_MESSAGES_BYTES = 250_000;

export async function POST(req: Request) {
  const sizeError = rejectOversizedRequest(req, MAX_MESSAGES_BYTES);
  if (sizeError) return sizeError;

  const limited = await enforceRateLimit(req, "plan:state:post", {
    limit: 60,
    windowMs: 10 * 60 * 1000,
  });
  if (limited) return limited;

  let body: SaveBody;
  try {
    body = (await req.json()) as SaveBody;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (!Array.isArray(body.messages)) {
    return NextResponse.json({ error: "messages[] required" }, { status: 400 });
  }
  if (body.messages.length > MAX_MESSAGES) {
    return NextResponse.json(
      { error: `too many messages (max ${MAX_MESSAGES})` },
      { status: 400 }
    );
  }
  if (JSON.stringify(body.messages).length > MAX_MESSAGES_BYTES) {
    return NextResponse.json(
      { error: `messages too large (max ${MAX_MESSAGES_BYTES} bytes)` },
      { status: 413 }
    );
  }

  if (body.id !== undefined && !UUID_RE.test(body.id)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  if (body.cacheKey !== undefined) {
    return NextResponse.json(
      { error: "cacheKey is server-managed" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  const messages = body.messages;

  if (body.id) {
    const { error } = await supabase
      .from("sp_plans")
      .update({
        messages,
        updated_at: now,
        last_viewed_at: now,
      })
      .eq("id", body.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ id: body.id });
  }

  const { data, error } = await supabase
    .from("sp_plans")
    .insert({ messages })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "insert failed" },
      { status: 500 }
    );
  }
  return NextResponse.json({ id: data.id });
}

export async function GET(req: Request) {
  const limited = await enforceRateLimit(req, "plan:state:get", {
    limit: 120,
    windowMs: 10 * 60 * 1000,
  });
  if (limited) return limited;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id || !UUID_RE.test(id)) {
    return NextResponse.json({ error: "valid id required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("sp_plans")
    .select("id,messages,updated_at")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // Fire-and-forget last_viewed_at bump for stats.
  void supabase
    .from("sp_plans")
    .update({ last_viewed_at: new Date().toISOString() })
    .eq("id", id);

  return NextResponse.json({
    id: data.id,
    messages: data.messages as UIMessage[],
  });
}
