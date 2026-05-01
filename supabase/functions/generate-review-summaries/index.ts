import { getSupabaseClient, jsonResponse } from "../_shared/guesty-api.ts";
import { Pool } from "https://deno.land/x/postgres@v0.19.3/mod.ts";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const BATCH_SIZE = 50;

Deno.serve(async (_req: Request) => {
  try {
    const supabase = getSupabaseClient();
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) {
      throw new Error("ANTHROPIC_API_KEY must be set");
    }

    // Use direct Postgres for queries touching the review_summary column
    // (PostgREST schema cache may lag behind on new columns)
    const dbUrl = Deno.env.get("SUPABASE_DB_URL");
    if (!dbUrl) {
      throw new Error("SUPABASE_DB_URL must be set");
    }

    const pool = new Pool(dbUrl, 1);
    const conn = await pool.connect();

    try {
      // Find listings that have reviews but no summary yet
      const listingsResult = await conn.queryObject<{
        guesty_id: string;
        nickname: string;
      }>(
        `SELECT l.guesty_id, l.nickname
         FROM public.listings l
         WHERE l.review_summary IS NULL
           AND l.active = true
           AND EXISTS (
             SELECT 1 FROM public.reviews r
             WHERE r.listing_id = l.guesty_id
               AND r.public_review IS NOT NULL
           )
         LIMIT $1`,
        [BATCH_SIZE]
      );

      const listings = listingsResult.rows;

      if (listings.length === 0) {
        return jsonResponse({
          success: true,
          processed: 0,
          message: "No listings need summaries",
        });
      }

      const startTime = Date.now();
      let processed = 0;
      let skipped = 0;

      for (const listing of listings) {
        // Stop before 130s timeout
        if (Date.now() - startTime > 130_000) {
          console.log("Approaching timeout — stopping batch");
          break;
        }

        // Fetch reviews for this listing
        const { data: reviews, error: reviewsError } = await supabase
          .from("reviews")
          .select("public_review, overall_rating")
          .eq("listing_id", listing.guesty_id)
          .not("public_review", "is", null)
          .order("review_date", { ascending: false })
          .limit(50);

        if (reviewsError) {
          console.error(
            `Failed to fetch reviews for ${listing.guesty_id}:`,
            reviewsError
          );
          continue;
        }

        if (!reviews || reviews.length === 0) {
          skipped++;
          continue;
        }

        // Build review text for the prompt
        const reviewTexts = reviews
          .map((r) => r.public_review)
          .filter(Boolean)
          .join("\n\n---\n\n");

        if (!reviewTexts.trim()) {
          skipped++;
          continue;
        }

        // Call Anthropic API
        const response = await fetch(ANTHROPIC_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": anthropicKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-haiku-4-5",
            max_tokens: 150,
            system:
              "You write brief, positive vacation rental summaries. Output ONLY the summary text — no headers, no markdown, no labels. 1-2 sentences, under 200 characters. Strictly positive — omit ALL negatives, drawbacks, noise mentions, or caveats. Omit addresses, street names, neighborhood names, and host names.",
            messages: [
              {
                role: "user",
                content: `Reviews:\n\n${reviewTexts}\n\nPositive-only summary, 1-2 sentences, under 200 characters. No markdown. No negatives. No addresses or names.`,
              },
            ],
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(
            `Anthropic API error for ${listing.guesty_id}: ${response.status} ${errorText}`
          );
          continue;
        }

        const data = await response.json();
        let summary = data.content?.[0]?.text?.trim();

        if (!summary) {
          console.error(`No summary text in response for ${listing.guesty_id}`);
          continue;
        }

        // Strip markdown headers or labels the model may add
        summary = summary.replace(/^#+\s*.+\n+/m, "").trim();

        // Store summary via direct SQL
        await conn.queryArray(
          "UPDATE public.listings SET review_summary = $1 WHERE guesty_id = $2",
          [summary, listing.guesty_id]
        );

        processed++;
        console.log(
          `Generated summary for ${listing.nickname} (${listing.guesty_id})`
        );
      }

      return jsonResponse({
        success: true,
        processed,
        skipped,
        remaining: listings.length - processed - skipped,
      });
    } finally {
      conn.release();
      await pool.end();
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Generate review summaries failed:", message);
    return jsonResponse({ success: false, error: message }, 500);
  }
});
