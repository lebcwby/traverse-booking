/**
 * Client-side recovery polling for the "paid but not yet finalized" case.
 *
 * When Stripe captures the payment but Guesty reservation creation fails, the
 * finalizer throws ReservationPendingRecoveryError and /api/reservations answers
 * 202 { pendingRecovery: true }. Server-side that is handled well — the payment
 * is safe, ops is alerted, and the recovery crons (`record-payments` every 5
 * min, `recover-checkouts` every 10) retry until the reservation exists.
 *
 * The gap this closes is purely client-side: the checkout page used to render
 * that 202 as a red error and then stop listening. Minutes later the booking
 * would quietly succeed and the guest would never learn. Some call support;
 * worse, some assume failure and re-book DIFFERENT dates or a different unit —
 * which the same-stay double-charge guards in /api/payment-intent cannot catch,
 * because it is indistinguishable from a genuine new booking. The result is two
 * real reservations and two real charges.
 *
 * So: keep watching the pending-checkout record until the reservation appears.
 */

export interface RecoveredReservation {
  reservationId: string;
  confirmationCode?: string | null;
}

export interface PollOptions {
  paymentIntentId: string;
  /** HMAC token minted by POST /api/pending-checkout; scopes the lookup. */
  lookupToken: string;
  /**
   * How long to keep watching. Defaults to 6 min — `record-payments` runs every
   * 5, so this spans at least one full recovery cycle plus slack.
   */
  timeoutMs?: number;
  /** Called after each poll so the UI can show honest elapsed progress. */
  onTick?: (elapsedMs: number) => void;
  signal?: AbortSignal;
}

const DEFAULT_TIMEOUT_MS = 6 * 60 * 1000;

/** Backoff: fast at first (many recoveries land in seconds), then relax. */
function delayForAttempt(attempt: number): number {
  if (attempt < 5) return 2000; // first 10s
  if (attempt < 15) return 5000; // next ~50s
  return 10000;
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException("Aborted", "AbortError"));
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true }
    );
  });

/**
 * Polls until the reservation exists, or the timeout elapses.
 * Resolves null on timeout — the caller should then show the "we have your
 * payment, we'll email you" fallback rather than anything that reads as failure.
 */
export async function pollForRecoveredReservation({
  paymentIntentId,
  lookupToken,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  onTick,
  signal,
}: PollOptions): Promise<RecoveredReservation | null> {
  if (!paymentIntentId || !lookupToken || lookupToken === "fallback") {
    // Without a valid token the lookup endpoint 401s; don't spin pointlessly.
    return null;
  }

  const startedAt = Date.now();
  const url = `/api/pending-checkout?paymentIntentId=${encodeURIComponent(
    paymentIntentId
  )}&token=${encodeURIComponent(lookupToken)}`;

  for (let attempt = 0; ; attempt++) {
    const elapsed = Date.now() - startedAt;
    if (elapsed >= timeoutMs) return null;

    try {
      const res = await fetch(url, { signal, cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as {
          reservationId?: string | null;
          confirmationCode?: string | null;
        };
        if (data.reservationId) {
          return {
            reservationId: data.reservationId,
            confirmationCode: data.confirmationCode ?? null,
          };
        }
      }
      // 404 (row cleaned) and 5xx are both transient from here — the crons may
      // still be working. Keep polling until the timeout decides.
    } catch (err) {
      if ((err as Error)?.name === "AbortError") throw err;
      // Network blip — keep waiting.
    }

    onTick?.(Date.now() - startedAt);
    await sleep(delayForAttempt(attempt), signal);
  }
}
