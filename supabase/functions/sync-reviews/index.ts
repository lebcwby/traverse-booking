import {
  getSupabaseClient,
  guestyFetch,
  jsonResponse,
  PAGE_DELAY_MS,
} from "../_shared/guesty-api.ts";

const PAGE_SIZE = 100;

// Reduced delay for reviews — each listing is a single small request,
// so we can safely go faster than the 1s default while staying well
// under 120 req/min.
const LISTING_DELAY_MS = 500;

/**
 * Syncs reviews from Guesty Open API into the reviews table.
 * Tracks progress via sync_metadata so each invocation resumes
 * from where the last one stopped.
 *
 * Supports ?mode=full to restart from the beginning.
 *
 * Schedule: hourly via pg_cron.
 */
Deno.serve(async (req: Request) => {
  try {
    const supabase = getSupabaseClient();
    const runStartedAt = Date.now();
    const url = new URL(req.url);
    const mode = url.searchParams.get("mode");
    const skipNames = url.searchParams.get("skipNames") === "true";

    console.log(
      `Starting reviews sync (mode: ${mode || "incremental"}, skipNames: ${skipNames})`
    );

    // Get active listings — inactive/unlisted units aren't shown on the site
    const { data: listings, error: listingsError } = await supabase
      .from("listings")
      .select("guesty_id")
      .eq("active", true)
      .order("guesty_id", { ascending: true });

    if (listingsError) {
      throw new Error(`Failed to fetch listings: ${listingsError.message}`);
    }

    if (!listings || listings.length === 0) {
      return jsonResponse({
        success: true,
        message: "No listings to sync",
        totalSynced: 0,
      });
    }

    // Determine starting offset from sync_metadata (unless mode=full)
    let startIndex = 0;
    if (mode !== "full") {
      const { data: meta } = await supabase
        .from("sync_metadata")
        .select("current_offset")
        .eq("sync_type", "reviews")
        .single();

      if (
        meta?.current_offset != null &&
        meta.current_offset < listings.length
      ) {
        startIndex = meta.current_offset;
        console.log(
          `Resuming from listing index ${startIndex}/${listings.length}`
        );
      }
    }

    let totalSynced = 0;
    let listingsProcessed = 0;
    let currentIndex = startIndex;

    for (let i = startIndex; i < listings.length; i++) {
      // Safety: stop before Edge Function timeout (150s limit)
      if (Date.now() - runStartedAt > 130_000) {
        console.log("Approaching timeout — stopping batch");
        break;
      }

      const listingId = listings[i].guesty_id;
      let skip = 0;
      let hasMore = true;

      while (hasMore) {
        if (Date.now() - runStartedAt > 130_000) break;

        const path = `/reviews?listingId=${listingId}&limit=${PAGE_SIZE}&skip=${skip}`;

        const response = await guestyFetch(supabase, path);

        if (response.status === 429) {
          console.log("Rate limited (429) — saving progress and stopping.");
          // Save where we left off
          await supabase.from("sync_metadata").upsert(
            {
              sync_type: "reviews",
              last_sync_at: runStartedAt,
              last_sync_status: "partial",
              items_synced: totalSynced,
              error_message: null,
              current_offset: currentIndex,
            },
            { onConflict: "sync_type" }
          );

          return jsonResponse({
            success: true,
            partial: true,
            startedAt: startIndex,
            stoppedAt: currentIndex,
            listingsProcessed,
            totalListings: listings.length,
            totalSynced,
          });
        }

        if (!response.ok) {
          const errorText = await response.text();
          console.error(
            `Failed to fetch reviews for listing ${listingId}: ${response.status} ${errorText}`
          );
          break;
        }

        const data = await response.json();
        const reviews = data.results || data.data || [];

        if (reviews.length > 0) {
          // Look up guest names — skip API calls if skipNames is set (for fast initial sync)
          const guestNameCache: Record<string, string> = {};

          if (!skipNames) {
            const guestIds = [
              ...new Set(
                reviews.map((r: any) => r.guestId).filter(Boolean) as string[]
              ),
            ];

            // Check which guest names we already have cached in our reviews table
            const { data: existingReviews } = await supabase
              .from("reviews")
              .select("guest_id, reviewer_name")
              .in("guest_id", guestIds)
              .not("reviewer_name", "is", null);

            if (existingReviews) {
              for (const r of existingReviews) {
                if (r.guest_id && r.reviewer_name) {
                  guestNameCache[r.guest_id] = r.reviewer_name;
                }
              }
            }

            // Fetch names for guests we don't have yet
            const missingGuestIds = guestIds.filter(
              (id) => !guestNameCache[id]
            );
            for (const guestId of missingGuestIds) {
              if (Date.now() - runStartedAt > 130_000) break;
              try {
                const guestRes = await guestyFetch(
                  supabase,
                  `/guests/${guestId}`
                );
                if (guestRes.ok) {
                  const guest = await guestRes.json();
                  if (guest.firstName) {
                    guestNameCache[guestId] = guest.firstName;
                  }
                }
                await new Promise((resolve) => setTimeout(resolve, 200));
              } catch {
                // Non-fatal — we'll just show "Guest" in the UI
              }
            }
          }

          const rows = reviews.map((review: any) => {
            const raw = review.rawReview || {};
            const categoryRatings = raw.category_ratings || [];

            const categories: Record<string, number | null> = {};
            for (const cat of categoryRatings) {
              if (cat.category && cat.rating != null) {
                categories[cat.category] = cat.rating;
              }
            }

            let reviewerName: string | null = null;
            if (review.guestId && guestNameCache[review.guestId]) {
              reviewerName = guestNameCache[review.guestId];
            }

            return {
              guesty_id: review._id,
              listing_id: listingId,
              reservation_id: review.reservationId || null,
              guest_id: review.guestId || null,
              channel: review.channelId || null,
              overall_rating:
                raw.overall_rating != null
                  ? Math.round(raw.overall_rating)
                  : null,
              public_review: raw.public_review || null,
              category_cleanliness:
                categories.cleanliness != null
                  ? Math.round(categories.cleanliness)
                  : null,
              category_accuracy:
                categories.accuracy != null
                  ? Math.round(categories.accuracy)
                  : null,
              category_checkin:
                categories.checkin != null
                  ? Math.round(categories.checkin)
                  : null,
              category_communication:
                categories.communication != null
                  ? Math.round(categories.communication)
                  : null,
              category_location:
                categories.location != null
                  ? Math.round(categories.location)
                  : null,
              category_value:
                categories.value != null ? Math.round(categories.value) : null,
              reviewer_name: reviewerName,
              review_date: review.createdAt || null,
              guesty_created_at: review.createdAt || null,
              guesty_updated_at: review.updatedAt || null,
              last_synced_at: Date.now(),
            };
          });

          const { error: upsertError } = await supabase
            .from("reviews")
            .upsert(rows, { onConflict: "guesty_id" });

          if (upsertError) {
            console.error(
              `Upsert failed for listing ${listingId}: ${upsertError.message}`
            );
          } else {
            totalSynced += rows.length;
          }
        }

        hasMore = reviews.length === PAGE_SIZE;
        skip += PAGE_SIZE;

        if (hasMore) {
          await new Promise((resolve) => setTimeout(resolve, PAGE_DELAY_MS));
        }
      }

      listingsProcessed++;
      currentIndex = i + 1;

      // Shorter delay between listings since most have < 100 reviews (single request)
      await new Promise((resolve) => setTimeout(resolve, LISTING_DELAY_MS));
    }

    const isComplete = currentIndex >= listings.length;

    console.log(
      `Reviews sync done: ${totalSynced} reviews synced, listings ${startIndex}-${currentIndex}/${listings.length}, complete=${isComplete}`
    );

    // Save progress — reset offset to 0 if complete so next run starts fresh
    await supabase.from("sync_metadata").upsert(
      {
        sync_type: "reviews",
        last_sync_at: runStartedAt,
        last_sync_status: isComplete ? "success" : "partial",
        items_synced: totalSynced,
        error_message: null,
        current_offset: isComplete ? 0 : currentIndex,
        initial_sync_complete: isComplete,
      },
      { onConflict: "sync_type" }
    );

    return jsonResponse({
      success: true,
      startedAt: startIndex,
      stoppedAt: currentIndex,
      listingsProcessed,
      totalListings: listings.length,
      totalSynced,
      isComplete,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("sync-reviews failed:", message);

    try {
      const supabase = getSupabaseClient();
      await supabase.from("sync_metadata").upsert(
        {
          sync_type: "reviews",
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
