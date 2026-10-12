/**
 * Normalisers for listing data that goes into structured data.
 *
 * Everything here exists because the Guesty address fields are entered by
 * hand and are inconsistent in ways that matter to Google and to AI
 * assistants reading our JSON-LD. Measured across the 208 active listings on
 * 2026-10-12:
 *
 *   - `state` is the word "Colorado" on 203 rows and "CO" on 4.
 *   - 78 listings carry postcode 81225 while naming the city "Crested Butte".
 *     81225 is Mount Crested Butte; 81224 is Crested Butte. Those are two
 *     different towns about three miles apart, and the slope-side buildings
 *     (Grand Lodge, The Plaza, Lodge at Mountaineer Square) are all in the
 *     former. Publishing the wrong one puts our best inventory in the wrong
 *     place on a map.
 *
 * These are presentation-layer corrections only. Nothing here writes back to
 * Guesty or to the mirror.
 */

/**
 * schema.org and Google want the two-letter code for a US state, not the
 * spelled-out name. Anything already two letters is passed through uppercased;
 * anything unrecognised is returned unchanged rather than guessed at, since a
 * wrong code is worse than a verbose one.
 */
export function normalizeStateCode(
  state: string | null | undefined
): string | undefined {
  const raw = (state || "").trim();
  if (!raw) return undefined;
  if (/^[A-Za-z]{2}$/.test(raw)) return raw.toUpperCase();
  const byName: Record<string, string> = {
    colorado: "CO",
  };
  return byName[raw.toLowerCase()] ?? raw;
}

/**
 * Postcodes where the Guesty city field is reliably wrong. Keyed on the 5-digit
 * prefix so ZIP+4 values ("80461-9709", of which there are several) match too.
 *
 * Deliberately tiny: only add an entry when the mismatch has been counted
 * across the catalogue, not when one listing looks odd. A listing whose
 * postcode is absent or unlisted keeps whatever Guesty says.
 */
const LOCALITY_BY_POSTCODE: Record<string, string> = {
  "81225": "Mount Crested Butte",
};

export function resolveLocality(
  city: string | null | undefined,
  postalCode: string | null | undefined
): string | undefined {
  const zip5 = (postalCode || "").trim().slice(0, 5);
  const corrected = LOCALITY_BY_POSTCODE[zip5];
  if (corrected) return corrected;
  const raw = (city || "").trim();
  return raw || undefined;
}

/**
 * Guesty titles arrive with stray leading/trailing whitespace (" Plaza 2 BR
 * mtn view"), which leaked into the page <title>, the breadcrumb and every
 * generated FAQ answer. Collapses internal runs of whitespace too, so a title
 * broken across lines renders as one line.
 */
export function normalizeListingName(
  name: string | null | undefined
): string | undefined {
  const cleaned = (name || "").replace(/\s+/g, " ").trim();
  return cleaned || undefined;
}
