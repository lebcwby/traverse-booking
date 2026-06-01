export interface UpsellItem {
  id: string;
  title: string;
  description: string;
  amount: number;
  currency: string;
  icon: string;
  /** Guesty invoice normalType (AFE = additional fee) */
  normalType: string;
  /** Guesty secondIdentifier for AFE items */
  secondIdentifier: string;
  /** Guesty predefined account fee ID — links to account fee so tax rules are respected */
  accountFeeId?: string;
}

// Early check-in and late checkout removed from the website on 2026-05-20 —
// these need to be REQUESTED (not guaranteed) by the guest. Per Nadim's
// direction, we'll collect these via SuiteOp post-booking once that's wired
// up. The Guesty `accountFeeId` and `secondIdentifier` constants are kept in
// comments below for easy re-add if we ever surface them again.
//   early-checkin: accountFeeId "67fdc056e74723000f56bf8a", secondIdentifier "EARLY_CHECK_IN", $50
//   late-checkout: accountFeeId "69aa99b902095a1abf37713a", secondIdentifier "LATE_CHECKOUT", $50

export const UPSELLS: UpsellItem[] = [
  {
    id: "pet-fee",
    title: "Pet Fee",
    description: "Bring your furry friend along for the stay.",
    amount: 99,
    currency: "USD",
    icon: "paw",
    normalType: "AFE",
    secondIdentifier: "PET",
    accountFeeId: "67fc4907f2cc23000e67992c",
  },
];

export function getSelectedUpsells(selectedIds: string[]): UpsellItem[] {
  return UPSELLS.filter((u) => selectedIds.includes(u.id));
}

export function getUpsellTotal(selectedIds: string[]): number {
  return getSelectedUpsells(selectedIds).reduce((sum, u) => sum + u.amount, 0);
}

/**
 * Default fallback when Guesty hasn't configured a per-listing pet fee.
 * Lowered from $99 to $50 on 2026-05-20 per Nadim — the previous default
 * was inflating fees on listings where BEAPI doesn't expose `prices.petFee`
 * (e.g. Grand Lodge configures pet fee as a Guesty "Additional Fee" that
 * isn't surfaced in the listing-detail `prices` field).
 */
export const DEFAULT_PET_FEE_PER_PET = 50;

/**
 * Resolves the per-listing list of selectable upsells.
 * - Pet Fee is now always offered as an opt-in extra regardless of the
 *   listing's `petsAllowed` flag (per 2026-05-20 product call — guests
 *   are allowed to bring pets if they pay the fee; the `petsAllowed`
 *   field in BEAPI was unreliable across listings).
 * - Substitutes the listing-specific pet fee amount when Guesty has one
 *   configured (`prices.petFee` from BEAPI). Falls back to
 *   `DEFAULT_PET_FEE_PER_PET` ($50) when Guesty's value is missing or zero.
 *
 * Early/late checkout were removed from the website 2026-05-20 — those
 * requests are now handled post-booking via SuiteOp.
 */
export function resolveUpsellsForListing(opts: {
  petsAllowed?: boolean;
  petFeePerPet?: number | null;
}): UpsellItem[] {
  return UPSELLS.flatMap((u) => {
    if (u.id !== "pet-fee") return [u];
    const amount =
      opts.petFeePerPet && opts.petFeePerPet > 0
        ? opts.petFeePerPet
        : DEFAULT_PET_FEE_PER_PET;
    return [{ ...u, amount }];
  });
}

/** Returns the listing's effective per-pet fee (used by payment-intent). */
export function resolvePetFeePerPet(petFeeFromBeapi?: number | null): number {
  return petFeeFromBeapi && petFeeFromBeapi > 0
    ? petFeeFromBeapi
    : DEFAULT_PET_FEE_PER_PET;
}
