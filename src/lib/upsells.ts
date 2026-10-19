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
//
// 🐾 Pet Fee removed from the website 2026-10-17 (Nadim). The website now
// charges NOTHING for pets on any listing — guests disclose pets and pay any
// fee through the guest portal after booking. This reverses the 2026-05-20
// "guests can bring pets if they pay the fee" call.
//
// Two reasons it had to go beyond the product decision:
//   - The amount was charged from a `pets` count, NOT from this list, and the
//     server never checked `petsAllowed`. The checkout page zeroed the
//     displayed pet total on no-pet listings while still sending the count,
//     so guests were charged a fee the page did not show.
//   - The Guesty constants for re-adding it, should the policy reverse again:
//     pet-fee: accountFeeId "67fc4907f2cc23000e67992c", secondIdentifier
//     "PET", default $50/pet (was $99 before 2026-05-20).
//
// ⚠️ Nothing in this file may reintroduce a pet charge. Display-only pet
// logic belongs in src/lib/pet-policy.ts.

export const UPSELLS: UpsellItem[] = [];

export function getSelectedUpsells(selectedIds: string[]): UpsellItem[] {
  return UPSELLS.filter((u) => selectedIds.includes(u.id));
}

export function getUpsellTotal(selectedIds: string[]): number {
  return getSelectedUpsells(selectedIds).reduce((sum, u) => sum + u.amount, 0);
}

/**
 * Resolves the per-listing list of selectable upsells.
 *
 * No longer takes a pet argument: there is no per-listing variation left to
 * express, and accepting one would invite a caller to reintroduce pet pricing.
 */
export function resolveUpsellsForListing(): UpsellItem[] {
  return UPSELLS;
}
