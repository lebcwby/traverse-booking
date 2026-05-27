/**
 * Admin listings export — downloads a CSV of every Guesty listing with its
 * booktraverse.com URL and key metadata. Built 2026-05-20 so the team can
 * easily share/audit the full property catalog.
 *
 * USAGE (browser, while logged in as an admin email):
 *   /api/admin/listings-export
 *     → Triggers a download of `traverse-listings-<date>.csv`
 *
 *   /api/admin/listings-export?format=json
 *     → Returns the same data as JSON (useful for debugging)
 *
 * Auth: same admin allowlist as reservation-tools (Supabase session for
 *       nadim@/ngtannous@/alex@/sabrina@ or Bearer CRON_SECRET).
 */

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-auth-server";
import { getOpenAPIListingsPage } from "@/lib/guesty-openapi";
import { getListingSlug } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const ADMIN_EMAILS = new Set([
  "nadim@traversehospitality.com",
  "ngtannous@gmail.com",
  "alex@traversehospitality.com",
  "sabrina@traversehospitality.com",
]);

async function authorize(request: Request): Promise<boolean> {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && auth === `Bearer ${secret}`) return true;
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.email && ADMIN_EMAILS.has(user.email.toLowerCase())) return true;
  } catch {
    /* fall through */
  }
  return false;
}

interface GuestyListing {
  _id?: string;
  nickname?: string;
  title?: string;
  active?: boolean;
  address?: { city?: string; state?: string };
  accommodates?: number;
  bedrooms?: number;
  prices?: { basePrice?: number; currency?: string };
  tags?: string[];
}

interface ExportRow {
  nickname: string;
  title: string;
  city: string;
  state: string;
  bedrooms: string;
  accommodates: string;
  base_price: string;
  active: string;
  listing_id: string;
  url: string;
  tags: string;
}

const BASE_URL = "https://www.booktraverse.com";

function csvEscape(value: string): string {
  // Escape per RFC 4180: wrap in quotes when value contains comma, quote, or
  // newline; double-up any embedded quotes.
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function rowsToCsv(rows: ExportRow[]): string {
  const headers: (keyof ExportRow)[] = [
    "nickname",
    "title",
    "city",
    "state",
    "bedrooms",
    "accommodates",
    "base_price",
    "active",
    "listing_id",
    "url",
    "tags",
  ];
  const headerLine = headers.join(",");
  const dataLines = rows.map((row) =>
    headers.map((h) => csvEscape(row[h] ?? "")).join(",")
  );
  // Excel-friendly: UTF-8 BOM so emoji/accented chars render correctly.
  return "﻿" + [headerLine, ...dataLines].join("\n");
}

async function fetchAllListings(): Promise<GuestyListing[]> {
  const results: GuestyListing[] = [];
  const pageSize = 100;
  let skip = 0;
  for (let page = 0; page < 50; page++) {
    const response = (await getOpenAPIListingsPage({
      // Request only the fields we need to keep payload small.
      fields: "_id nickname title active address accommodates bedrooms prices tags",
      limit: pageSize,
      skip,
    })) as { results?: GuestyListing[]; count?: number };
    const batch = Array.isArray(response?.results) ? response.results : [];
    if (batch.length === 0) break;
    results.push(...batch);
    skip += batch.length;
    if (batch.length < pageSize) break;
    if (typeof response.count === "number" && skip >= response.count) break;
  }
  return results;
}

function listingToRow(l: GuestyListing): ExportRow {
  const id = l._id ?? "";
  const title = (l.title ?? "").trim();
  const nickname = (l.nickname ?? "").trim();
  const slug = id ? getListingSlug(title || nickname || null, id) : "";
  return {
    nickname,
    title,
    city: l.address?.city ?? "",
    state: l.address?.state ?? "",
    bedrooms: l.bedrooms != null ? String(l.bedrooms) : "",
    accommodates: l.accommodates != null ? String(l.accommodates) : "",
    base_price: l.prices?.basePrice != null ? String(l.prices.basePrice) : "",
    active: l.active === false ? "no" : "yes",
    listing_id: id,
    url: slug ? `${BASE_URL}/properties/${slug}` : "",
    tags: Array.isArray(l.tags) ? l.tags.join("; ") : "",
  };
}

export async function GET(request: Request) {
  if (!(await authorize(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const format = (url.searchParams.get("format") || "csv").toLowerCase();

  let listings: GuestyListing[];
  try {
    listings = await fetchAllListings();
  } catch (err) {
    return NextResponse.json(
      {
        error: "Failed to fetch listings from Guesty OpenAPI",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }

  // Sort by city then nickname for a stable, readable order.
  const rows: ExportRow[] = listings.map(listingToRow);
  rows.sort((a, b) => {
    const c = a.city.localeCompare(b.city);
    if (c !== 0) return c;
    return a.nickname.localeCompare(b.nickname);
  });

  if (format === "json") {
    return NextResponse.json({
      count: rows.length,
      generatedAt: new Date().toISOString(),
      rows,
    });
  }

  const csv = rowsToCsv(rows);
  const today = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="traverse-listings-${today}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
