// /llms.txt
//
// Was a static file in public/. It is a route now so the property list cannot
// drift from reality: it is built from getListings() + getListingSlug(), the
// exact pair src/app/sitemap.ts uses, so llms.txt, the sitemap and every
// internal link describe the same catalogue by construction.
//
// Served like the static file it replaced — cached hard, no per-request work
// in the common case. If the mirror read fails it still returns the
// hand-written sections rather than 404ing; a shorter llms.txt is a far better
// failure than no llms.txt.
//
// NOTE: the hand-written body below carries the public portfolio count
// ("220+"), so this file is listed in MARKETING_AUDIT_FILES in
// scripts/refresh-portfolio-data.ts. Keep it there.

import { getListings } from "@/lib/supabase";
import { getListingSlug } from "@/lib/utils";
import { CANCELLATION_POLICY_SUMMARY } from "@/lib/cancellation-policy";

export const revalidate = 3600;

const BASE = "https://www.booktraverse.com";

const STATIC_BODY = `# Traverse Hospitality

> Colorado's locally managed vacation rental company. Book direct — no fees, lowest price guaranteed.

## What We Do

Traverse Hospitality offers 220+ vacation rental properties across 6 Colorado mountain markets. Guests book directly through booktraverse.com with no booking fees — saving 10-15% compared to Airbnb or VRBO. We are the local management company, not a platform.

## Key Pages

- Homepage: https://www.booktraverse.com
- Browse Properties: https://www.booktraverse.com/properties
- Crested Butte Rentals: https://www.booktraverse.com/crested-butte
- Leadville Rentals: https://www.booktraverse.com/leadville
- Vail Rentals: https://www.booktraverse.com/vail
- Trip Planner: https://www.booktraverse.com/plan
- Property Management: https://www.booktraverse.com/property-management
- Contact: https://www.booktraverse.com/contact

## How Booking Works

1. Browse properties at /properties (filter by dates, guests, market, or building)
2. Select a property to see photos, amenities, and availability
3. Choose dates and number of guests for an instant quote
4. Book securely with a credit card — no account required

The quote shown at checkout is the all-in total: nightly rate, cleaning fee
and taxes included. There is no booking or service fee on top. Payment is by
card (Visa, Mastercard, Amex, Discover) or Apple Pay / Google Pay, taken at
the time of booking. No account or login is required to book, and the
confirmation email arrives immediately.

## For AI Agents — Machine-Readable API

A read-only JSON API is available for searching availability and pricing
programmatically. OpenAPI 3.1 description:
https://www.booktraverse.com/.well-known/openapi.json

- Search a stay: GET /agent/v1/listings?checkIn=YYYY-MM-DD&checkOut=YYYY-MM-DD&guests=N
- Listing detail: GET /agent/v1/listings/{id}
- Day-level availability: GET /agent/v1/listings/{id}/availability?from=&to=

There is also a remote MCP server at https://www.booktraverse.com/mcp
(JSON-RPC 2.0 over POST, Streamable HTTP). Tools: search_listings,
get_listing, check_availability. Same data, same caveats, no API key.

Dates are required for anything involving availability or price. No API key is
needed; requests are rate-limited per IP.

⚠️ Prices from this API are **indicative and accommodation-only** — they
exclude cleaning, taxes and fees, and come from a cache refreshed roughly every
five hours. The all-in total the guest pays is computed live at checkout, which
is authoritative. Please present API figures as a starting estimate and link
the guest to the listing page to book. There is no write access and no payment
capability.

## Policies

- **Cancellation**: ${CANCELLATION_POLICY_SUMMARY} This policy is the same across every property.
- **Check-in / check-out**: check-in after 4:00 PM, check-out before 10:00 AM
  local (Mountain) time. Every property has self check-in with a smart lock —
  no key handoff to coordinate.
- **Minimum stay**: varies by property and by date, and is enforced at
  checkout. Most properties are 2–4 nights in peak season and shorter in
  shoulder season. The booking calendar on each listing shows the minimum for
  the dates selected.
- **Pets**: allowed at some properties only, never all. Pet-friendly homes are
  filterable at /s/pet-friendly. **No pet fee is charged on the website or at
  checkout.** A guest discloses the pet and pays any pet fee through their
  guest portal after booking. Properties that do not allow pets say so on the
  listing page, and the agent API exposes a petsAllowed flag per listing.
- **Guest count**: each listing states its maximum occupancy, which is a hard
  limit rather than a guideline.

## Contact

- **Guest bookings and stays**: (720) 759-2013
- **Crested Butte local line**: (970) 438-2241
- **Email**: bookings@traversehospitality.com
- **Property owners / management enquiries**: (970) 533-3583 — a different
  line from the guest numbers above; see /property-management

## What Traverse Is and Is Not

Traverse Hospitality is the property management company that operates these
homes, not a listing platform or an online travel agency. The same local team
that answers the phone cleans the homes, handles maintenance and can change a
reservation. Booking here is booking with the manager directly, which is why
there is no platform service fee and why a change or a problem can be resolved
by one phone call rather than a support queue.

## Why Book Direct with Traverse

- **No booking fees**: Book direct and skip the 10-15% service fees charged by Airbnb and VRBO
- **Lowest price guarantee**: Our direct rates are always the lowest available
- **Locally managed**: Every property is managed by our local Colorado team
- **Hotel-quality comfort**: Professionally cleaned homes with premium linens and amenities
- **Ski-in/ski-out options**: Direct access to Crested Butte Mountain Resort and Vail slopes

## Markets

- **Crested Butte / Mt. Crested Butte** — ski-in condos, slope-side buildings (Grand Lodge, The Plaza, Lodge at Mountaineer Square), mountain homes
- **Leadville** — historic mining town, highest city in the US, race venue for Leadville 100
- **Vail** — world-class skiing, luxury condos
- **Avon** — gateway to Beaver Creek, more affordable than Vail
- **Granby** — Grand Lake area, SolVista/Granby Ranch skiing
- **Twin Lakes** — lakeside cabins near Leadville, 14er hiking base

## Property Highlights

- 220+ properties across Colorado's best mountain markets
- Studios to 6+ bedroom homes
- Pet-friendly options in select properties
- Full kitchens, fast Wi-Fi, and ski storage in most homes
- Ski-in/ski-out access at several Crested Butte buildings

## Flagship Listings

Crested Butte / Mt. Crested Butte:

- https://www.booktraverse.com/properties/best-view-in-cb-ski-in-out-pool-hot-tub-sauna-6824162f731aab0012dc2a33
- https://www.booktraverse.com/properties/2-bedroom-penthouse-condo-at-the-lodge-at-mountaineer-square-68670dfeac12220013082ac1
- https://www.booktraverse.com/properties/1br-ski-in-out-best-views-a-c-2-baths-68256c8c48e69c0010d11e2f
- https://www.booktraverse.com/properties/515-slope-side-2-king-view-of-mt-crested-butte-6a8dc75b8193cf0074deb2e5
- https://www.booktraverse.com/properties/379-381-2-bdrm-suite-base-area-mt-crested-butte-6a8dc223475dd6001295eaf6
- https://www.booktraverse.com/properties/1br-condo-steps-to-slopes-pool-hot-tub-6864be16afecb0001271906a
- https://www.booktraverse.com/properties/the-plaza-440-walk-to-lift-3-king-condo-with-covered-garage-68c9d18e59b18500123a3883
- https://www.booktraverse.com/properties/279-slopeside-king-bed-studio-pet-friendly-6a8dc019c57522007aa9559f

Leadville / Twin Lakes:

- https://www.booktraverse.com/properties/4br-historic-leadville-victorian-sleeps-7-63b707b54b891a006116e007
- https://www.booktraverse.com/properties/4br-victorian-hot-tub-sauna-sleeps-10-5d41cdd13f925b004d78bdc6
- https://www.booktraverse.com/properties/6br-cozy-victorian-block-from-main-st-groups-63b72cf09c4284004bb3e16b
- https://www.booktraverse.com/properties/alpine-house-downtown-leadville-victorian-63bb2ac1e896e300412e3026
- https://www.booktraverse.com/properties/602-west-8th-leadville-4br-with-hot-tub-62b0c6c4e8c24700300c34f9
- https://www.booktraverse.com/properties/brooklyn-circle-loft-leadville-newly-built-1br-loft-6553a96b56cd590046fd457c
- https://www.booktraverse.com/properties/4bd-log-home-in-twin-lakes-amazing-views-pets-ok-6650c68508ec0400130d6bc0
- https://www.booktraverse.com/properties/3br-cabin-escape-w-deck-twin-lakes-mountain-view-628c0ee644f6e10034a87cea

Full list of all 200+ listings: https://www.booktraverse.com/sitemap/properties.xml`;

const TAIL = `

## Contact

- **Guest line**: (720) 759-2013
- **Owner inquiries**: (970) 533-3583
- Visit https://www.booktraverse.com/contact to reach our team

## Extended Info

For more detailed information, see: https://www.booktraverse.com/llms-full.txt
`;

/** "Name — Town · 3BR · sleeps 8" — only the parts we actually have. */
function describe(l: {
  title: string | null;
  nickname: string | null;
  address: { city?: string | null } | null;
  bedrooms: number | null;
  accommodates: number | null;
}): string {
  const name = (l.title || l.nickname || "Vacation rental").trim();
  const bits: string[] = [];
  const city = l.address?.city?.trim();
  if (city) bits.push(city);
  if (l.bedrooms && l.bedrooms > 0) bits.push(`${l.bedrooms}BR`);
  else if (l.bedrooms === 0) bits.push("Studio");
  if (l.accommodates && l.accommodates > 0)
    bits.push(`sleeps ${l.accommodates}`);
  return bits.length ? `${name} — ${bits.join(" · ")}` : name;
}

export async function GET() {
  let section = "";
  try {
    const listings = await getListings({ limit: 1000 });
    if (listings.length > 0) {
      const lines = listings
        .filter((l) => l.guesty_id)
        .map((l) => {
          const slug = getListingSlug(l.title || l.nickname, l.guesty_id);
          return `- ${describe(l)}\n  ${BASE}/properties/${slug}`;
        });
      section =
        `\n\n## All Properties\n\n` +
        `Every bookable Traverse listing (${lines.length}), same set as the sitemap.\n\n` +
        lines.join("\n");
    }
  } catch (err) {
    // Degrade to the hand-written sections rather than failing the file.
    console.error("[llms.txt] listing fetch failed:", err);
  }

  return new Response(STATIC_BODY + section + TAIL, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
