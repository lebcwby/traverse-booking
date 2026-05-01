/**
 * One-time script to backfill reviewer_name on existing reviews.
 * Finds all reviews with a guest_id but no reviewer_name,
 * fetches the name from Guesty /guests/{id}, and updates the row.
 *
 * Usage: npx tsx scripts/backfill-reviewer-names.ts
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

// Load .env.local manually
const envFile = readFileSync(".env.local", "utf-8");
for (const line of envFile.split("\n")) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const GUESTY_API_BASE = "https://open-api.guesty.com/v1";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function getToken(): Promise<string> {
  const { data } = await supabase
    .from("guesty_tokens")
    .select("access_token")
    .eq("token_type", "openapi")
    .single();
  if (!data?.access_token) throw new Error("No cached Guesty token");
  return data.access_token;
}

async function main() {
  const token = await getToken();

  // Get all unique guest_ids that have no reviewer_name
  const { data: reviews, error } = await supabase
    .from("reviews")
    .select("guest_id")
    .is("reviewer_name", null)
    .not("guest_id", "is", null);

  if (error) throw error;
  if (!reviews?.length) {
    console.log("No reviews missing names!");
    return;
  }

  const uniqueGuestIds = Array.from(
    new Set(reviews.map((r) => r.guest_id).filter(Boolean))
  );
  console.log(
    `Found ${uniqueGuestIds.length} unique guests needing name lookup`
  );

  let updated = 0;
  let failed = 0;

  for (let i = 0; i < uniqueGuestIds.length; i++) {
    const guestId = uniqueGuestIds[i];

    try {
      const res = await fetch(`${GUESTY_API_BASE}/guests/${guestId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      if (res.status === 429) {
        console.log(
          `Rate limited at guest ${i}/${uniqueGuestIds.length} — waiting 60s`
        );
        await new Promise((r) => setTimeout(r, 60000));
        i--; // retry this one
        continue;
      }

      if (!res.ok) {
        failed++;
        continue;
      }

      const guest = await res.json();
      const name = guest.firstName || null;

      if (name) {
        const { error: updateError } = await supabase
          .from("reviews")
          .update({ reviewer_name: name })
          .eq("guest_id", guestId)
          .is("reviewer_name", null);

        if (!updateError) updated++;
        else failed++;
      }
    } catch {
      failed++;
    }

    if (i % 50 === 0 && i > 0) {
      console.log(
        `Progress: ${i}/${uniqueGuestIds.length} (updated: ${updated}, failed: ${failed})`
      );
    }

    // 200ms delay = ~300 req/min, well under limit
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(
    `Done! Updated: ${updated}, Failed: ${failed}, Total guests: ${uniqueGuestIds.length}`
  );
}

main().catch(console.error);
