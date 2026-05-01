/**
 * Lightweight A/B testing utility.
 * Assigns users to a variant on first visit (localStorage),
 * fires a GA4 event for segmentation.
 */

const STORAGE_PREFIX = "sp_ab_";

export type ABVariant = string;

interface ABTest {
  /** Unique test ID (used as localStorage key suffix) */
  id: string;
  /** Variant names with equal weighting */
  variants: string[];
}

/**
 * Get or assign a variant for a given test.
 * Assignment is sticky via localStorage.
 */
export function getVariant(test: ABTest): string {
  if (typeof window === "undefined") return test.variants[0];

  const key = `${STORAGE_PREFIX}${test.id}`;
  const stored = localStorage.getItem(key);

  if (stored && test.variants.includes(stored)) {
    return stored;
  }

  // Random assignment
  const variant =
    test.variants[Math.floor(Math.random() * test.variants.length)];
  localStorage.setItem(key, variant);
  return variant;
}

/**
 * Fire a GA4 event for A/B test exposure.
 * Call once per page view so we know the user saw the variant.
 */
export function trackABExposure(testId: string, variant: string) {
  if (typeof window === "undefined" || !window.gtag) return;

  window.gtag("event", "ab_test_exposure", {
    test_id: testId,
    variant,
  });
}

// ─── Active Tests ────────────────────────────────────────────

export const PRICING_BADGE_TEST: ABTest = {
  id: "pricing_badge_v1",
  variants: ["rain_check", "full_picture", "no_sticker_shock"],
};

/**
 * Rentals-card CTA text test on /plan right rail.
 * - view_details   → neutral control ("View details")
 * - see_price_dates → commercial, sets shopping intent
 * - stay_here      → emotive, leans on the SP brand verb
 */
export const PLAN_RENTAL_CTA_TEST: ABTest = {
  id: "plan_rental_cta_v1",
  variants: ["view_details", "see_price_dates", "stay_here"],
};
