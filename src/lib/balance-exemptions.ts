/**
 * Which booking sources are allowed to carry a balance after check-out.
 *
 * `audit-payment-records` flags a departed stay that still owes money. For
 * most sources that is a real problem. For two kinds of source it is the
 * normal, permanent state of the ledger, and alerting on it trains people to
 * ignore the alert — which costs us the one case that mattered.
 *
 *   owner stays        no guest, no money, nothing to collect, ever.
 *
 *   channel-collected  the OTA takes the guest's money itself and remits to
 *                      us on its own schedule. Guesty shows `totalPaid: 0`
 *                      and a full `balanceDue` forever, because we never
 *                      charge this guest. BC-EvJKG1Yyg (Booking.com, $452.55
 *                      host payout, $0 paid, checked out 2026-09-09) is the
 *                      shape of it.
 *
 * ⚠️ Channel-collected is NOT the same as hotel-collect, and the distinction
 * decides whether a source belongs in this list. Under hotel-collect WE charge
 * the card, so a balance there is real money we have not taken — Expedia and
 * VRBO are hotel-collect for us and their auto-payment rules exist precisely
 * to collect it (see the GuestyPay note in CLAUDE.md). Do not add them here
 * because their names look like OTAs.
 *
 * The strings are Guesty's own `source` values, taken from the 32k-row
 * reservations mirror rather than guessed — Homes & Villas is
 * `homesVillasByMarriott`, which no reasonable guess would have produced, and
 * a wrong string here fails silently by matching nothing.
 *
 * This suppresses the BALANCE check only. A duplicate charge, a GuestyPay
 * shadow charge or a negative balance on one of these reservations is still a
 * real defect and is still reported.
 */

export type BalanceExemption = "owner_stay" | "channel_collected";

/** No guest, so no money is ever expected. */
const UNBILLED_SOURCES = ["owner", "owner-guest"];

/** The channel bills the guest and remits to us later. */
const CHANNEL_COLLECTED_SOURCES = ["Booking.com", "homesVillasByMarriott"];

/**
 * Guesty is inconsistent about case and punctuation in `source` — the mirror
 * holds both "expedia" and "Expedia", "manual" and "Manual". Compare on a
 * flattened key so a casing change upstream cannot quietly re-enable alerts.
 */
function normalize(source: string): string {
  return source.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const UNBILLED = new Set(UNBILLED_SOURCES.map(normalize));
const CHANNEL_COLLECTED = new Set(CHANNEL_COLLECTED_SOURCES.map(normalize));

/**
 * Why a post-check-out balance on this source is not worth waking anyone for,
 * or null when it is.
 *
 * An unknown or missing source returns null: a reservation we cannot classify
 * must stay loud. Being noisy about an unrecognised source is recoverable;
 * being silent about one is how money goes uncollected.
 */
export function balanceExemption(
  source: string | null | undefined
): BalanceExemption | null {
  if (!source) return null;
  const key = normalize(source);
  if (UNBILLED.has(key)) return "owner_stay";
  if (CHANNEL_COLLECTED.has(key)) return "channel_collected";
  return null;
}

/** For the human-readable summary on the response. */
export const EXEMPTION_LABELS: Record<BalanceExemption, string> = {
  owner_stay: "owner stay — no guest payment expected",
  channel_collected: "channel collects and remits — balance is permanent",
};
