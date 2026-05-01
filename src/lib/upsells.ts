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

export const UPSELLS: UpsellItem[] = [
  {
    id: "early-checkin",
    title: "Early Check-in (1 PM)",
    description:
      "Arrive 3 hours early and settle in before the standard check-in time.",
    amount: 50,
    currency: "USD",
    icon: "clock",
    normalType: "AFE",
    secondIdentifier: "EARLY_CHECK_IN",
    accountFeeId: "67fdc056e74723000f56bf8a",
  },
  {
    id: "late-checkout",
    title: "Late Check-out (1 PM)",
    description:
      "Enjoy a relaxed departure with an extra 3 hours past the standard check-out.",
    amount: 50,
    currency: "USD",
    icon: "moon",
    normalType: "AFE",
    secondIdentifier: "LATE_CHECKOUT",
    accountFeeId: "69aa99b902095a1abf37713a",
  },
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
