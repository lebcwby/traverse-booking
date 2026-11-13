/**
 * A counting semaphore: at most `limit` holders at once, the rest queued FIFO.
 *
 * Exists because BEAPI calls had backoff but no concurrency ceiling, so a burst
 * of traffic mapped 1:1 onto Guesty. On 2026-10-25 a single sweep of the
 * property catalogue sent 183 listing-detail requests inside 3 seconds —
 * roughly 3,660/min against Guesty's ~120/min account ceiling — and the
 * exponential backoff then retried on top of the breach. Every 429 burst in
 * the preceding 7 days had that same shape: one path, one catalogue sweep,
 * 1-8 seconds. See src/lib/guesty-beapi.ts.
 *
 * Queueing rather than rejecting is deliberate. These calls render pages a
 * visitor is waiting on; a slow property page beats a broken one, and the
 * queue drains in well under a second at realistic burst sizes.
 *
 * Per-instance, not global. Vercel runs many lambdas, so this caps the damage
 * any one instance can do rather than enforcing an account-wide budget — the
 * bursts observed came from a single instance regenerating many pages, which
 * is exactly what this bounds.
 */
export class ConcurrencyGate {
  private active = 0;
  private readonly waiting: Array<() => void> = [];

  constructor(private readonly limit: number) {
    if (!Number.isInteger(limit) || limit < 1) {
      throw new Error(`ConcurrencyGate limit must be a positive integer, got ${limit}`);
    }
  }

  /** In-flight holders right now. Exposed for tests and health reporting. */
  get inFlight(): number {
    return this.active;
  }

  /** Callers queued behind the limit right now. */
  get queued(): number {
    return this.waiting.length;
  }

  /**
   * Run `fn` once a slot is free. The slot is released in a finally, so a
   * throwing or rejecting `fn` can never leak one — a leaked slot would
   * permanently shrink the pool and eventually deadlock the route.
   */
  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (this.active < this.limit) {
      this.active += 1;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      this.waiting.push(() => {
        this.active += 1;
        resolve();
      });
    });
  }

  private release(): void {
    this.active -= 1;
    const next = this.waiting.shift();
    if (next) next();
  }
}
