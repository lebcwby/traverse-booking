/**
 * Tax-configuration drift detection.
 *
 * Why this exists. On 2026-11-11 our accountant — not us — noticed that the
 * website was publishing wrong tax rates. Chasing it down turned up three
 * separate problems that had been sitting in Guesty unnoticed:
 *
 *   - `800PopUnitB1bed` and `800PopUnitC1Bed` had NO taxes configured at all,
 *     while the two other units in the same building did. They had been
 *     quoting direct bookings with zero tax.
 *   - Six Crested Butte listings carry a 12.9% lodging tax where 98 others
 *     carry 9.9%.
 *   - `GL279-281:Turk` sits at 9% where its neighbours are at 9.9%.
 *
 * Every one of those is obvious once the configs are lined up side by side,
 * and invisible otherwise. This module lines them up.
 *
 * It is READ-ONLY. It reports; a human decides and edits Guesty. Nothing here
 * writes to Guesty, and it deliberately does not try to "correct" anything —
 * which of two differing rates is right is a filing question, not a
 * programmatic one.
 */

export interface ListingTaxSnapshot {
  listingId: string;
  nickname: string;
  city: string;
  /** Guesty's configured taxes for the listing. */
  taxes: Array<{
    type?: string;
    units?: string;
    amount?: number;
  }>;
}

export type TaxFindingKind =
  | "no_tax_config"
  | "rare_rates"
  | "non_percentage"
  | "duplicate_type";

export interface TaxFinding {
  kind: TaxFindingKind;
  listingId: string;
  nickname: string;
  city: string;
  /** This listing's rates, rendered for a human. */
  rates: string;
  /** What the rest of the city does, when that is the point of the finding. */
  peers?: string;
  detail: string;
}

/**
 * A city needs this many listings sharing one configuration before we are
 * willing to call anything else an outlier.
 *
 * Vail, Avon, Frisco and Granby have one to three listings each, every one a
 * different jurisdiction. There is no "norm" to deviate from there, and
 * flagging them would be pure noise — the check would cry wolf on its first
 * run and get muted, which is the usual fate of audits like this.
 */
const MIN_DOMINANT_FOR_COMPARISON = 10;

/**
 * An alternative configuration is an outlier when it is held by no more than
 * 10% of the dominant group (floor of 2).
 *
 * This number is set by the real data, not by taste. Leadville legitimately
 * runs TWO configurations — 53 listings inside the city at 5.42% lodging tax
 * and 28 outside it at 1.9% — and a check that flags those 28 every night is
 * worthless. Against a dominant group of 53 the threshold is 6, so they are
 * safe. Crested Butte's dominant group is 98, giving a threshold of 10, which
 * is what catches the six listings at 12.9% and the one at 9%.
 *
 * An earlier draft used a flat "2 or fewer" and MISSED the 12.9% group
 * entirely — six listings looked unremarkable by count alone. Proportion is
 * what distinguishes a second jurisdiction from a mistake.
 */
const OUTLIER_FRACTION_OF_DOMINANT = 0.1;
const OUTLIER_MIN_THRESHOLD = 2;

/** "COUNTY_TAX=4, STATE_TAX=2.9, TOT=5.42" — stable across runs. */
export function ratesSignature(taxes: ListingTaxSnapshot["taxes"]): string {
  const parts = taxes
    .filter((t) => typeof t?.type === "string" && t.type.length > 0)
    .map((t) => `${t.type}=${Number(t.amount ?? 0)}`)
    .sort();
  return parts.length > 0 ? parts.join(", ") : "(none)";
}

export function outlierThreshold(dominantCount: number): number {
  return Math.max(
    OUTLIER_MIN_THRESHOLD,
    Math.ceil(dominantCount * OUTLIER_FRACTION_OF_DOMINANT)
  );
}

export function auditListingTaxes(
  listings: ListingTaxSnapshot[]
): TaxFinding[] {
  const findings: TaxFinding[] = [];

  // ── Per-listing problems, independent of any peer group ────────────────
  for (const l of listings) {
    const rates = ratesSignature(l.taxes);

    if (l.taxes.length === 0) {
      findings.push({
        kind: "no_tax_config",
        listingId: l.listingId,
        nickname: l.nickname,
        city: l.city,
        rates,
        detail:
          "Active and listed, but Guesty has NO taxes configured — a direct booking is quoted with zero tax.",
      });
      // No config means nothing to compare; don't also report it as rare.
      continue;
    }

    // A FIXED per-night levy has no rate, so the checkout shows no percentage
    // for it. Worth knowing about rather than silently degrading.
    const fixed = l.taxes.filter(
      (t) => String(t.units ?? "").toUpperCase() !== "PERCENTAGE"
    );
    if (fixed.length > 0) {
      findings.push({
        kind: "non_percentage",
        listingId: l.listingId,
        nickname: l.nickname,
        city: l.city,
        rates,
        detail: `${fixed.length} tax entr${fixed.length === 1 ? "y is" : "ies are"} not PERCENTAGE, so no rate can be shown at checkout for ${fixed.length === 1 ? "it" : "them"}.`,
      });
    }

    // Two entries of one type make the rate ambiguous, and the checkout
    // suppresses the percentage rather than guess. Surface the cause.
    const byType = new Map<string, number>();
    for (const t of l.taxes) {
      const key = String(t.type ?? "");
      if (key) byType.set(key, (byType.get(key) ?? 0) + 1);
    }
    const dupes = [...byType.entries()].filter(([, n]) => n > 1);
    if (dupes.length > 0) {
      findings.push({
        kind: "duplicate_type",
        listingId: l.listingId,
        nickname: l.nickname,
        city: l.city,
        rates,
        detail: `Configured more than once: ${dupes.map(([t, n]) => `${t} ×${n}`).join(", ")}. The checkout hides the rate when it cannot pick one.`,
      });
    }
  }

  // ── Outliers within a city ─────────────────────────────────────────────
  const byCity = new Map<string, ListingTaxSnapshot[]>();
  for (const l of listings) {
    if (l.taxes.length === 0) continue; // already reported
    const key = l.city || "(unknown)";
    byCity.set(key, [...(byCity.get(key) ?? []), l]);
  }

  for (const [city, group] of byCity) {
    const counts = new Map<string, ListingTaxSnapshot[]>();
    for (const l of group) {
      const sig = ratesSignature(l.taxes);
      counts.set(sig, [...(counts.get(sig) ?? []), l]);
    }

    const sizes = [...counts.values()].map((v) => v.length);
    const dominantCount = Math.max(...sizes);
    if (dominantCount < MIN_DOMINANT_FOR_COMPARISON) continue;

    const dominantSig =
      [...counts.entries()].find(([, v]) => v.length === dominantCount)?.[0] ??
      "";
    const threshold = outlierThreshold(dominantCount);

    for (const [sig, members] of counts) {
      if (sig === dominantSig) continue;
      if (members.length > threshold) continue; // a second jurisdiction, not a mistake
      for (const l of members) {
        findings.push({
          kind: "rare_rates",
          listingId: l.listingId,
          nickname: l.nickname,
          city,
          rates: sig,
          peers: dominantSig,
          detail: `${members.length} of ${group.length} ${city} listings use this; ${dominantCount} use "${dominantSig}".`,
        });
      }
    }
  }

  return findings.sort(
    (a, b) =>
      a.kind.localeCompare(b.kind) ||
      a.city.localeCompare(b.city) ||
      a.nickname.localeCompare(b.nickname)
  );
}

/**
 * A stable fingerprint of a finding set, so the cron can alert when the
 * picture CHANGES rather than every single night. A standing problem someone
 * has consciously accepted should go quiet; a new one should not.
 */
export function findingsFingerprint(findings: TaxFinding[]): string {
  return findings
    .map((f) => `${f.kind}:${f.listingId}:${f.rates}`)
    .sort()
    .join("|");
}
