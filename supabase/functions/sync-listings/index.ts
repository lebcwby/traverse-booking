import {
  getSupabaseClient,
  getValidToken,
  transformListing,
  jsonResponse,
  recoverStaleSync,
  GUESTY_API_BASE,
  PAGE_SIZE,
  PAGE_DELAY_MS,
  INCREMENTAL_MAX_PAGES,
  SYNC_BUFFER_MS,
} from "../_shared/guesty-api.ts";

Deno.serve(async (req: Request) => {
  try {
    const supabase = getSupabaseClient();
    const body = await req.json().catch(() => ({}));

    // Allow overriding mode: "full" for initial sync, default "incremental"
    const mode = body.mode ?? "incremental";
    const maxPages =
      body.maxPages ?? (mode === "full" ? 50 : INCREMENTAL_MAX_PAGES);
    const startOffset = body.startOffset ?? 0;

    // ── Read sync metadata ──────────────────────────────────────
    const { data: meta } = await supabase
      .from("sync_metadata")
      .select("*")
      .eq("sync_type", "listings")
      .single();

    // Auto-recover from stale in_progress status
    await recoverStaleSync(supabase, "listings", meta);

    // For incremental mode, skip if initial sync not done
    if (mode === "incremental" && meta && !meta.initial_sync_complete) {
      console.log("Listings initial sync not complete — skipping incremental.");
      return jsonResponse({
        success: true,
        itemsSynced: 0,
        message: "Initial sync not complete — use mode='full' for initial load",
      });
    }

    // ── Resume from saved offset if previous run didn't finish ──
    let resumeOffset = startOffset;
    if (
      meta?.last_sync_status === "in_progress" &&
      meta?.current_offset != null &&
      meta.current_offset > 0 &&
      startOffset === 0
    ) {
      resumeOffset = meta.current_offset;
      console.log(`Resuming listings sync from offset ${resumeOffset}`);
    }

    // ── Compute updatedSince window ─────────────────────────────
    let updatedSince: string | null = null;
    if (mode === "incremental" && meta?.last_sync_at) {
      updatedSince = new Date(meta.last_sync_at - SYNC_BUFFER_MS).toISOString();
    }

    console.log(
      mode === "full"
        ? `Full listings sync from offset ${resumeOffset}`
        : `Incremental listings sync since ${updatedSince}, offset ${resumeOffset}`
    );

    // ── Get Guesty token ────────────────────────────────────────
    const token = await getValidToken(supabase);

    // ── Paginated fetch loop ────────────────────────────────────
    let skip = resumeOffset;
    let totalSynced = 0;
    let pagesProcessed = 0;
    let hasMore = true;

    while (hasMore && pagesProcessed < maxPages) {
      let url = `${GUESTY_API_BASE}/listings?limit=${PAGE_SIZE}&skip=${skip}`;

      if (updatedSince) {
        url += `&filters[lastUpdatedAt][$gte]=${updatedSince}`;
      }

      console.log(
        `Fetching listings: skip=${skip}, page ${pagesProcessed + 1}/${maxPages}`
      );

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      if (response.status === 429) {
        const retryAfter = response.headers.get("Retry-After") || "unknown";
        console.log(
          `Rate limited (429) — retry after: ${retryAfter}. Stopping batch.`
        );
        break;
      }

      if (!response.ok) {
        throw new Error(
          `Failed to fetch listings: ${response.status} ${await response.text()}`
        );
      }

      const data = await response.json();
      const listings = data.results || [];

      if (listings.length > 0) {
        const rows = listings.map((l: any) => transformListing(l));

        const { error: upsertError } = await supabase
          .from("listings")
          .upsert(rows, { onConflict: "guesty_id" });

        if (upsertError) {
          console.error("Upsert error:", upsertError);
          throw new Error(`Upsert failed: ${upsertError.message}`);
        }

        totalSynced += listings.length;
      }

      hasMore = listings.length === PAGE_SIZE;
      skip += PAGE_SIZE;
      pagesProcessed++;

      if (hasMore && pagesProcessed < maxPages) {
        await new Promise((resolve) => setTimeout(resolve, PAGE_DELAY_MS));
      }
    }

    const isComplete = !hasMore;

    console.log(
      `Listings sync done: ${totalSynced} synced, complete=${isComplete}`
    );

    // ── Update sync metadata ────────────────────────────────────
    const syncData: Record<string, unknown> = {
      sync_type: "listings",
      last_sync_at: isComplete
        ? Date.now()
        : (meta?.last_sync_at ?? Date.now()),
      last_sync_status: isComplete ? "success" : "in_progress",
      items_synced: totalSynced,
      error_message: null,
    };

    if (!isComplete) {
      syncData.current_offset = skip;
    } else {
      syncData.current_offset = null;
      syncData.initial_sync_complete = true;
    }

    const { error: metaError } = await supabase
      .from("sync_metadata")
      .upsert(syncData, { onConflict: "sync_type" });

    if (metaError) {
      console.error("Failed to update sync metadata:", metaError);
    }

    return jsonResponse({
      success: true,
      mode,
      itemsSynced: totalSynced,
      isComplete,
      nextOffset: hasMore ? skip : null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Listings sync failed:", message);

    try {
      const supabase = getSupabaseClient();
      await supabase.from("sync_metadata").upsert(
        {
          sync_type: "listings",
          last_sync_at: Date.now(),
          last_sync_status: "error",
          items_synced: 0,
          error_message: message,
        },
        { onConflict: "sync_type" }
      );
    } catch {
      // Best-effort
    }

    return jsonResponse({ success: false, error: message }, 500);
  }
});
