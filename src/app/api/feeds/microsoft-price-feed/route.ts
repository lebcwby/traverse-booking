import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { addDays, format } from "date-fns";
import {
  buildPriceFeed,
  buildResult,
  parseQuery,
  type PriceResult,
} from "@/lib/ms-price-feed";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function unauthorized(): NextResponse {
  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?>\n<error>unauthorized</error>`,
    {
      status: 401,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "WWW-Authenticate": 'Basic realm="ms-price-feed"',
      },
    }
  );
}

function verifyBasicAuth(header: string | null): boolean {
  const user = process.env.MS_PRICE_FEED_USER;
  const password = process.env.MS_PRICE_FEED_PASSWORD;
  if (!user || !password) return false;
  if (!header?.startsWith("Basic ")) return false;
  try {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf-8");
    const idx = decoded.indexOf(":");
    if (idx < 0) return false;
    return (
      decoded.slice(0, idx) === user && decoded.slice(idx + 1) === password
    );
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!verifyBasicAuth(request.headers.get("authorization"))) {
    return unauthorized();
  }

  const body = await request.text();
  let query;
  try {
    query = parseQuery(body);
  } catch (err) {
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?>\n<error>${
        err instanceof Error ? err.message : "invalid query"
      }</error>`,
      {
        status: 400,
        headers: { "Content-Type": "application/xml; charset=utf-8" },
      }
    );
  }

  if (query.properties.length === 0) {
    return new NextResponse(buildPriceFeed([]), {
      status: 200,
      headers: { "Content-Type": "application/xml; charset=utf-8" },
    });
  }

  const supabase = getSupabaseAdmin();

  const { data: listings, error: listErr } = await supabase
    .from("listings")
    .select("guesty_id, prices")
    .in("guesty_id", query.properties);

  if (listErr) {
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?>\n<error>${listErr.message}</error>`,
      {
        status: 500,
        headers: { "Content-Type": "application/xml; charset=utf-8" },
      }
    );
  }

  const cleaningByListing = new Map<string, number>();
  for (const l of listings ?? []) {
    const fee =
      (l.prices as { cleaningFee?: number | null } | null)?.cleaningFee ?? 0;
    cleaningByListing.set(l.guesty_id, fee || 0);
  }

  const firstDate = query.checkin;
  const lastDate = format(
    addDays(new Date(`${query.checkin}T00:00:00Z`), query.nights - 1),
    "yyyy-MM-dd"
  );

  const ratesByListing = new Map<string, Map<string, number>>();
  const pageSize = 1000;
  let offset = 0;
  while (true) {
    const { data: days, error: calErr } = await supabase
      .from("calendar_days")
      .select("listing_id, date, status, price")
      .in("listing_id", query.properties)
      .gte("date", firstDate)
      .lte("date", lastDate)
      .range(offset, offset + pageSize - 1);

    if (calErr) {
      return new NextResponse(
        `<?xml version="1.0" encoding="UTF-8"?>\n<error>${calErr.message}</error>`,
        {
          status: 500,
          headers: { "Content-Type": "application/xml; charset=utf-8" },
        }
      );
    }

    for (const d of days ?? []) {
      if (d.status !== "available") continue;
      if (typeof d.price !== "number" || d.price <= 0) continue;
      let rates = ratesByListing.get(d.listing_id);
      if (!rates) {
        rates = new Map();
        ratesByListing.set(d.listing_id, rates);
      }
      rates.set(d.date, d.price);
    }

    if (!days || days.length < pageSize) break;
    offset += pageSize;
  }

  const results: PriceResult[] = [];
  for (const property of query.properties) {
    const rates = ratesByListing.get(property);
    if (!rates || rates.size < query.nights) continue;
    const cleaning = cleaningByListing.get(property) ?? 0;
    const result = buildResult(
      property,
      query.checkin,
      query.nights,
      rates,
      cleaning
    );
    if (result) results.push(result);
  }

  return new NextResponse(buildPriceFeed(results), {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "X-Feed-Requested": String(query.properties.length),
      "X-Feed-Results": String(results.length),
    },
  });
}
