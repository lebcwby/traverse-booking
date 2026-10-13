/**
 * Anonymous matching data for the browser Meta pixel.
 *
 * Exists so the root layout no longer has to. It used to inline
 * `window.__sp_anon_match` via `readAnonymousMatching()`, which reads
 * `headers()` and `cookies()` — and a root layout touching either forces
 * dynamic rendering for EVERY route beneath it. That is why
 * `/properties/[id]`'s `revalidate = 300` never once took effect and every
 * page view was a full origin render (issue #82).
 *
 * The data is edge geo (city/state/zip/country, derived from the requester's
 * own IP) plus the visitor uuid from their own cookie. Nothing here is
 * personal beyond what Meta already receives with every pixel event — the
 * pixel sends the IP regardless. No PII, no listing or booking data.
 *
 * Deliberately uncacheable: the response is specific to one requester's IP
 * and cookie, so a shared cache would hand one visitor's city to another.
 * The client caches it in sessionStorage instead, so only the first page view
 * of a session pays the round trip.
 */
import { NextResponse } from "next/server";
import { readAnonymousMatching } from "@/lib/anonymous-matching-server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const matching = await readAnonymousMatching();
    return NextResponse.json(matching, {
      headers: {
        "cache-control": "no-store, private",
        "content-type": "application/json; charset=utf-8",
      },
    });
  } catch {
    // Advanced matching is an enhancement. Returning an empty object keeps the
    // pixel firing with whatever the client already has (its own cookie) rather
    // than failing the page.
    return NextResponse.json(
      {},
      { headers: { "cache-control": "no-store, private" } }
    );
  }
}
