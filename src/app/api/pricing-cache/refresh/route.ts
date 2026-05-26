import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  searchListings,
  getListingCalendar,
  createQuote,
  type CalendarDay,
} from "@/lib/guesty-beapi";
import { format, addDays } from "date-fns";

export const maxDuration = 300;

interface PricingCacheEntry {
  guesty_id: string;
  checkIn: string;
  checkOut: string;
  nightCount: number;
  estimatedTotal: number;
  basePrice: number;
}

function findFirst5NightWindow(
  calendar: CalendarDay[]
): { startIdx: number; endIdx: number } | null {
  for (let i = 0; i <= calendar.length - 5; i++) {
    // First day: must be available, can arrive (cta === false), and minNights <= 5
    if (
      calendar[i].status !== "available" ||
      calendar[i].cta !== false ||
      calendar[i].minNights > 5
    )
      continue;

    // Days 2-5 must all be available
    let allAvailable = true;
    for (let j = i + 1; j < i + 5; j++) {
      if (calendar[j].status !== "available") {
        allAvailable = false;
        break;
      }
    }
    if (!allAvailable) continue;

    // Departure day (day after last night) must allow departure (ctd === false)
    // The 5th night's index is i+4, departure day is i+5
    if (i + 5 < calendar.length && calendar[i + 5].ctd !== false) continue;

    return { startIdx: i, endIdx: i + 4 };
  }
  return null;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  try {
    // Phase 1: Fetch all BEAPI listings (paginated)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let allResults: any[] = [];
    const data = await searchListings({ limit: 100 });
    allResults = data.results || [];
    let cursor = data.pagination?.cursor?.next;
    while (cursor && allResults.length < 1000) {
      const more = await searchListings({ limit: 100, cursor });
      allResults = allResults.concat(more.results || []);
      cursor = more.pagination?.cursor?.next;
    }

    // Mark which listings are in the BEAPI (booking engine enabled)
    const beapiIds = new Set(allResults.map((r) => r._id as string));
    if (beapiIds.size > 0) {
      // Set beapi_enabled = true for listings returned by BEAPI
      await supabase
        .from("listings")
        .update({ beapi_enabled: true })
        .in("guesty_id", Array.from(beapiIds));
      // Set beapi_enabled = false for listings NOT in BEAPI
      await supabase
        .from("listings")
        .update({ beapi_enabled: false })
        .not("guesty_id", "in", `(${Array.from(beapiIds).join(",")})`);
    }

    const today = new Date();
    const fromDate = format(addDays(today, 3), "yyyy-MM-dd"); // Start 3 days out to avoid last-minute availability issues
    const toDate = format(addDays(today, 150), "yyyy-MM-dd");

    // Phase 2: Fetch calendars and find 5-night windows
    // Guesty rate limits: 15 req/s burst, 120 req/min sustained
    // 5 concurrent with 1500ms gap = ~3.3 req/s avg, well under limits
    const windows: {
      guesty_id: string;
      checkIn: string;
      checkOut: string;
      basePrice: number;
    }[] = [];
    const CAL_BATCH = 5;
    const CAL_DELAY = 1500;
    let noBasePrice = 0;
    let calendarErrors = 0;
    let noWindow = 0;
    const calErrorSamples: string[] = [];

    for (let i = 0; i < allResults.length; i += CAL_BATCH) {
      const batch = allResults.slice(i, i + CAL_BATCH);
      const results = await Promise.all(
        batch.map(async (r) => {
          const basePrice = r.prices?.basePrice;
          if (!basePrice || basePrice <= 0) {
            noBasePrice++;
            return null;
          }

          try {
            const calendar = await getListingCalendar(r._id, fromDate, toDate);
            const window = findFirst5NightWindow(calendar);
            if (!window) {
              noWindow++;
              return null;
            }

            const checkIn = calendar[window.startIdx].date;
            const checkOut = format(
              addDays(new Date(calendar[window.endIdx].date), 1),
              "yyyy-MM-dd"
            );
            return { guesty_id: r._id, checkIn, checkOut, basePrice };
          } catch (err) {
            calendarErrors++;
            if (calErrorSamples.length < 5) {
              calErrorSamples.push(
                `${r._id}: ${err instanceof Error ? err.message : String(err)}`
              );
            }
            return null;
          }
        })
      );

      for (const entry of results) {
        if (entry) windows.push(entry);
      }

      if (i + CAL_BATCH < allResults.length) {
        await new Promise((resolve) => setTimeout(resolve, CAL_DELAY));
      }
    }

    // Phase 3: Get actual quotes for each window
    // 3 concurrent with 1500ms gap to stay under rate limits
    const cache: PricingCacheEntry[] = [];
    const QUOTE_BATCH = 3;
    const QUOTE_DELAY = 1500;
    let quoteErrors = 0;
    let noMoney = 0;

    for (let i = 0; i < windows.length; i += QUOTE_BATCH) {
      const batch = windows.slice(i, i + QUOTE_BATCH);
      const results = await Promise.all(
        batch.map(async (w) => {
          try {
            const quote = await createQuote({
              listingId: w.guesty_id,
              checkIn: w.checkIn,
              checkOut: w.checkOut,
              guestsCount: 2,
            });

            // Extract total price (hostPayout = accommodation + cleaning + taxes)
            const rp = quote?.rates?.ratePlans?.[0];
            const money = rp?.ratePlan?.money;
            if (!money) {
              noMoney++;
              return null;
            }

            const estimatedTotal = money.hostPayout;
            if (!estimatedTotal || estimatedTotal <= 0) {
              noMoney++;
              return null;
            }

            return {
              guesty_id: w.guesty_id,
              checkIn: w.checkIn,
              checkOut: w.checkOut,
              nightCount: 5,
              estimatedTotal: Math.round(estimatedTotal),
              basePrice: w.basePrice,
            };
          } catch {
            quoteErrors++;
            return null;
          }
        })
      );

      for (const entry of results) {
        if (entry) cache.push(entry);
      }

      if (i + QUOTE_BATCH < windows.length) {
        await new Promise((resolve) => setTimeout(resolve, QUOTE_DELAY));
      }
    }

    const { error: upsertError } = await supabase.from("kv_store").upsert(
      {
        key: "listing_pricing_cache",
        value: cache,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );

    return NextResponse.json({
      ok: true,
      totalListings: allResults.length,
      windowsFound: windows.length,
      cachedEntries: cache.length,
      debug: {
        noBasePrice,
        calendarErrors,
        calErrorSamples,
        noWindow,
        quoteErrors,
        noMoney,
        upsertError: upsertError?.message || null,
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to refresh pricing cache",
      },
      { status: 500 }
    );
  }
}
