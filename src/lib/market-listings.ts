import {
  getListingPricingCache,
  getListings,
  type Listing,
} from "@/lib/supabase";

/**
 * The bookable listings in one market, for the market landing pages.
 *
 * These pages indexed fine but linked to almost nothing — /crested-butte,
 * /vail and /twin-lakes carried ZERO listing links and /leadville six — so
 * everything outside the three Crested Butte buildings had no hub except
 * /properties. That is the gap this closes, the same way PR #65 closed it for
 * the building pages.
 *
 * Reads the Supabase `listings` mirror rather than BEAPI, deliberately:
 * CLAUDE.md designates the mirror as the source for SEO and feed surfaces,
 * and these are exactly that. It also means a BEAPI outage cannot empty a
 * market page the way it used to empty /properties.
 *
 * Matches on the listing's own city, NOT on Guesty's "Market - X" tags, and
 * not via the looser two-way/tag matching /properties uses for search.
 *
 * Those tags are Traverse's operational grouping and they are wider than the
 * place: "Market - Vail" covers listings whose cities are Frisco, Granby and
 * Avon. Grouping that way put a Granby riverfront cabin on /vail, a page whose
 * own copy promises "Vail Mountain Resort... Gore Range... a pedestrian
 * village". Granby and Avon have their own pages saying their own things.
 * Tag-based grouping would also have cross-listed Twin Lakes onto /leadville.
 *
 * Forward containment only, so "Crested Butte" still catches
 * "Mt. Crested Butte" without "Vail" catching everything. No tag fallback is
 * needed: every bookable listing in the mirror has an address city.
 *
 * Consequence worth knowing: the handful of listings in cities with no page
 * of their own (Denver, Frisco) appear on no market page. They are still
 * linked from /properties, which carries all 208 and is now indexable, so
 * nothing is stranded — and a page is better thin and true than padded.
 */
function matchesMarketCity(listing: Listing, city: string): boolean {
  const wanted = city.trim().toLowerCase();
  const actual = (listing.address?.city || "").trim().toLowerCase();
  if (!wanted || !actual) return false;
  return actual === wanted || actual.includes(wanted);
}
export async function getMarketListings(city: string): Promise<Listing[]> {
  let all: Listing[];
  try {
    all = await getListings({ limit: 500 });
  } catch (err) {
    // A market page without its link list is a worse page, not a broken one.
    // Render the rest rather than failing the route.
    console.error(`[market-listings] mirror read failed for "${city}":`, err);
    return [];
  }

  const listings = all.filter((l) => matchesMarketCity(l, city));

  // Guesty's `prices.basePrice` is a $95 placeholder on many listings; the
  // pricing-cache cron stores the real lowest nightly rate. Same overlay the
  // building pages use, so "from $X" means the same thing everywhere.
  try {
    const pricingCache = await getListingPricingCache();
    if (pricingCache?.size) {
      for (const l of listings) {
        const cached = pricingCache.get(l.guesty_id);
        if (cached?.nightlyFrom && l.prices) {
          l.prices.basePrice = cached.nightlyFrom;
        }
      }
    }
  } catch {
    // Prices are decoration here — the links are the point.
  }

  return listings;
}
