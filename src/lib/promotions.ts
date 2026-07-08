// Guest-facing labels for Guesty promotions (early-bird / last-minute) that come
// back on quotes. Raw Guesty promo objects use internal names ("EB - All Units")
// and machine types ("early_booker"); map them to friendly copy for the UI.

interface RawPromotion {
  name?: string;
  type?: string; // 'early_booker' | 'last_minute' | ...
  rule?: { discountType?: string; discountAmount?: number };
}

export interface PromoDisplay {
  /** Specific, guest-facing label, e.g. "Last-minute deal". */
  label: string;
  /** Discount percentage if it's a percent promo (e.g. 10). */
  pct?: number;
  /** Short badge, e.g. "10% off". */
  badge: string;
}

const TYPE_LABELS: Record<string, string> = {
  early_booker: "Early-bird deal",
  last_minute: "Last-minute deal",
};

/** Quote `promotions` can be a single object or an array — take the first. */
function firstPromo(raw: unknown): RawPromotion | null {
  const p = Array.isArray(raw) ? raw[0] : raw;
  if (!p || typeof p !== "object") return null;
  return p as RawPromotion;
}

/** Build guest-facing promo copy from a raw quote promotion, or null if none. */
export function promoDisplay(raw: unknown): PromoDisplay | null {
  const p = firstPromo(raw);
  if (!p) return null;
  const label = (p.type && TYPE_LABELS[p.type]) || p.name || "Special offer";
  const pct =
    p.rule?.discountType === "percent" && typeof p.rule.discountAmount === "number"
      ? p.rule.discountAmount
      : undefined;
  return { label, pct, badge: pct ? `${pct}% off` : "Deal" };
}
