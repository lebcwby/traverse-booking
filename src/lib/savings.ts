// Single source of truth for the "book direct vs OTA" savings claim.
// Used by price-breakdown UI and any marketing copy that references the
// percentage. Update here to keep all surfaces consistent.

export const OTA_SAVINGS_FRACTION = 0.15;
export const OTA_SAVINGS_PERCENT_LABEL = "15%";
export const OTA_SAVINGS_RANGE_LABEL = "10–15%";

/**
 * Given a direct-booking price, return the comparable OTA price (the most a
 * guest would pay on Airbnb/VRBO/Booking once their guest service fee is added)
 * and the resulting savings. Uses OTA_SAVINGS_FRACTION (15% — the top of the
 * 10–15% range, i.e. the "maximum") so card strikethroughs are conservative and
 * consistent with the booking-flow "saving $X vs VRBO" line.
 */
export function otaComparison(directTotal: number): {
  otaPrice: number;
  savings: number;
} {
  const direct = Math.round(directTotal);
  const otaPrice = Math.round(directTotal * (1 + OTA_SAVINGS_FRACTION));
  return { otaPrice, savings: otaPrice - direct };
}
