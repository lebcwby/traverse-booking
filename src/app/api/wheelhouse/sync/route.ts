import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  buildWheelhouseSnapshot,
  chunkArray,
  getWheelhouseGuestyId,
  getWheelhousePreferencesByListingIds,
  listAllWheelhouseListings,
} from "@/lib/wheelhouse-rm";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const SYNC_TYPE = "wheelhouse";
const SUPABASE_BATCH_SIZE = 200;
const WHEELHOUSE_PREFERENCE_BATCH_SIZE = 100;

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const authHeader = request.headers.get("authorization");
  const explicitHeader = request.headers.get("x-cron-secret");

  return authHeader === `Bearer ${cronSecret}` || explicitHeader === cronSecret;
}

function isTruthy(value: string | null) {
  return value === "1" || value === "true" || value === "yes";
}

async function loadExistingGuestyIds(guestyIds: string[]) {
  const supabase = getSupabaseAdmin();
  const existingIds = new Set<string>();

  for (const batch of chunkArray(guestyIds, SUPABASE_BATCH_SIZE)) {
    if (batch.length === 0) continue;

    const { data, error } = await supabase
      .from("listings")
      .select("guesty_id")
      .in("guesty_id", batch);

    if (error) {
      throw new Error(`Failed to load existing listings: ${error.message}`);
    }

    for (const row of data ?? []) {
      existingIds.add(row.guesty_id);
    }
  }

  return existingIds;
}

async function writeSnapshots(
  rows: Array<{ guesty_id: string; wheelhouse_data: Record<string, unknown> }>
) {
  const supabase = getSupabaseAdmin();

  for (const row of rows) {
    const { error } = await supabase
      .from("listings")
      .update({ wheelhouse_data: row.wheelhouse_data })
      .eq("guesty_id", row.guesty_id);

    if (error) {
      throw new Error(`Failed to update Wheelhouse data: ${error.message}`);
    }
  }
}

async function updateSyncMetadata(payload: {
  last_sync_status: string;
  items_synced: number;
  total_items?: number | null;
  error_message?: string | null;
  initial_sync_complete?: boolean;
}) {
  const supabase = getSupabaseAdmin();

  const { error } = await supabase.from("sync_metadata").upsert(
    {
      sync_type: SYNC_TYPE,
      last_sync_at: Date.now(),
      current_offset: null,
      ...payload,
    },
    { onConflict: "sync_type" }
  );

  if (error) {
    throw new Error(`Failed to update sync metadata: ${error.message}`);
  }
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const dryRun = isTruthy(searchParams.get("dryRun"));
  const limitParam = searchParams.get("limit");
  const maxListings = limitParam ? Number.parseInt(limitParam, 10) : undefined;

  if (
    limitParam &&
    (!Number.isFinite(maxListings) || (maxListings ?? 0) <= 0)
  ) {
    return NextResponse.json(
      { error: "limit must be a positive integer" },
      { status: 400 }
    );
  }

  try {
    if (!dryRun) {
      await updateSyncMetadata({
        last_sync_status: "in_progress",
        items_synced: 0,
        total_items: null,
        error_message: null,
      });
    }

    const syncedAt = new Date().toISOString();
    const remoteListings = await listAllWheelhouseListings({ maxListings });
    const preferenceMap = await getWheelhousePreferencesByListingIds(
      remoteListings.map((listing) => listing.id),
      WHEELHOUSE_PREFERENCE_BATCH_SIZE
    );

    const existingGuestyIds = await loadExistingGuestyIds(
      remoteListings
        .map((listing) => getWheelhouseGuestyId(listing))
        .filter((guestyId): guestyId is string => Boolean(guestyId))
    );

    const rowsToWrite: Array<{
      guesty_id: string;
      wheelhouse_data: Record<string, unknown>;
    }> = [];
    const unmatchedListings: Array<Record<string, unknown>> = [];

    for (const listing of remoteListings) {
      const guestyId = getWheelhouseGuestyId(listing);

      if (!guestyId || !existingGuestyIds.has(guestyId)) {
        unmatchedListings.push({
          partner_listing_id: listing.id,
          guesty_id: guestyId,
          channel: listing.channel ?? null,
          title: listing.title ?? listing.nickname ?? null,
        });
        continue;
      }

      rowsToWrite.push({
        guesty_id: guestyId,
        wheelhouse_data: buildWheelhouseSnapshot(
          listing,
          preferenceMap.get(listing.id),
          syncedAt
        ),
      });
    }

    if (!dryRun) {
      await writeSnapshots(rowsToWrite);
      await updateSyncMetadata({
        last_sync_status: "success",
        items_synced: rowsToWrite.length,
        total_items: remoteListings.length,
        error_message: null,
        initial_sync_complete: true,
      });
    }

    return NextResponse.json({
      ok: true,
      dryRun,
      syncedAt,
      remoteListings: remoteListings.length,
      preferencesFetched: preferenceMap.size,
      matchedListings: rowsToWrite.length,
      unmatchedListings: unmatchedListings.length,
      unmatchedSample: unmatchedListings.slice(0, 10),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to sync Wheelhouse data";

    if (!dryRun) {
      try {
        await updateSyncMetadata({
          last_sync_status: "error",
          items_synced: 0,
          total_items: null,
          error_message: message,
        });
      } catch {
        // Best effort
      }
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
