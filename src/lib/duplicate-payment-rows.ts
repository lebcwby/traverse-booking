/**
 * Identifies Guesty auto-payment-rule rows that are DUPLICATES of a payment we
 * already collected through Stripe.
 *
 * ── The problem ─────────────────────────────────────────────────────────
 *
 * On listings where Guesty's auto-payment rule is enabled ("charge 100% at
 * confirmation using guest card"), every direct booking gets a second,
 * note-less payment row alongside ours. It starts PENDING because the only
 * card we hand Guesty is a Stripe `pm_...`, which GuestyPay cannot charge.
 *
 * It then sits dormant — and fires later, for the FULL original amount, once a
 * real card is vaulted in Guesty. In all four confirmed cases the capture used
 * the same `paymentMethodId` as a later manual charge (a pet fee, an added
 * night), and that payment method was created 51 minutes to 4 DAYS after the
 * booking. Survey on 2026-10-14: 4 already fired ($3,289.15), 109 dormant
 * ($102,875.15) across 319 direct reservations.
 *
 * ⚠️ The long-standing explanation — that `ccToken` hands Guesty a chargeable
 * card and the rule uses it — is contradicted by that timing. Our ccToken
 * exists at t=0; the card actually charged did not exist yet. Removing
 * ccToken would not have prevented any of them.
 *
 * ── Why the matching rule is strict ─────────────────────────────────────
 *
 * A PENDING auto-rule row is NOT automatically a duplicate. Where its amount
 * is *complementary* rather than equal, the rule is collecting a genuine
 * remaining balance:
 *
 *   GY-reaVneZq   Stripe $8,567.65 + auto $1,261.56 = $9,829.21 = hostPayout
 *   GY-x9pmWpCq   Stripe $1,317.24 + auto   $251.10 = $1,568.34 = hostPayout
 *
 * Voiding those would stop us collecting money we are actually owed — 9 of
 * them existed at the time of the survey. A duplicate has the SAME amount as a
 * payment already collected, which is the same signal
 * `/api/cron/audit-payment-records` uses for `guestypay_shadow_charge`.
 *
 * This module is pure: it decides, it does not call Guesty.
 */

/** Money equality, to the cent. */
export function sameAmount(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.005;
}

export interface GuestyPaymentRow {
  _id?: string;
  amount?: number;
  status?: string;
  note?: string | null;
  attempts?: unknown[];
}

export interface DuplicateVerdict {
  /** Safe to cancel. */
  duplicate: boolean;
  /** The row to cancel, when duplicate. */
  paymentId?: string;
  amount?: number;
  /** Why, in words — logged and included in alerts. */
  reason: string;
}

const STRIPE_NOTE = "Stripe PI";

/**
 * Decide whether a reservation carries a dormant duplicate worth voiding.
 *
 * Deliberately conservative — every guard must pass. When in doubt this
 * returns `duplicate: false` and a human looks at it, which is the same
 * posture `audit-payment-records` takes.
 */
export function findDormantDuplicate(
  payments: GuestyPaymentRow[],
  balanceDue: number
): DuplicateVerdict {
  if (!Array.isArray(payments) || payments.length < 2) {
    return { duplicate: false, reason: "fewer than two payment rows" };
  }

  // A balance genuinely outstanding means something here is owed. Refuse,
  // rather than risk voiding the row that would collect it.
  if (!(Math.abs(balanceDue) < 0.005)) {
    return {
      duplicate: false,
      reason: `balanceDue is ${balanceDue}, not zero — something may be genuinely owed`,
    };
  }

  const collected = payments.filter(
    (p) =>
      typeof p.note === "string" &&
      p.note.includes(STRIPE_NOTE) &&
      p.status === "SUCCEEDED"
  );
  if (!collected.length) {
    return {
      duplicate: false,
      reason: "no SUCCEEDED Stripe-collected payment to duplicate",
    };
  }

  const candidates = payments.filter(
    (p) =>
      !p.note &&
      p.status === "PENDING" &&
      Number(p.amount ?? 0) > 0 &&
      // A row that has already attempted capture is not dormant; whatever
      // happened to it needs a human, not an automated void.
      (!Array.isArray(p.attempts) || p.attempts.length === 0)
  );
  if (!candidates.length) {
    return { duplicate: false, reason: "no dormant note-less PENDING row" };
  }

  for (const c of candidates) {
    const amt = Number(c.amount ?? 0);
    const twin = collected.find((s) => sameAmount(Number(s.amount ?? 0), amt));
    if (twin && c._id) {
      return {
        duplicate: true,
        paymentId: c._id,
        amount: amt,
        reason: `PENDING auto-rule row for $${amt.toFixed(2)} duplicates a SUCCEEDED Stripe payment of the same amount`,
      };
    }
  }

  // Reaching here means a dormant row exists but its amount is complementary
  // — a real balance the rule is scheduled to collect. Leave it alone.
  return {
    duplicate: false,
    reason:
      "dormant row's amount does not match a collected payment — likely a genuine scheduled balance",
  };
}
