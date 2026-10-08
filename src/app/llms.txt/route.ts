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
