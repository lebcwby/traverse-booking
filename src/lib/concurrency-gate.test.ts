import { describe, expect, it } from "vitest";
import { ConcurrencyGate } from "./concurrency-gate";

/** A promise you resolve by hand, so a test controls when work finishes. */
function deferred<T = void>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("ConcurrencyGate", () => {
  it("rejects a nonsensical limit rather than silently letting everything through", () => {
    expect(() => new ConcurrencyGate(0)).toThrow();
    expect(() => new ConcurrencyGate(-1)).toThrow();
    expect(() => new ConcurrencyGate(1.5)).toThrow();
  });

  it("never exceeds the limit, and queues the rest", async () => {
    const gate = new ConcurrencyGate(2);
    const gates = [deferred(), deferred(), deferred(), deferred()];
    let peak = 0;

    const runs = gates.map((d) =>
      gate.run(async () => {
        peak = Math.max(peak, gate.inFlight);
        await d.promise;
      })
    );

    // Two running, two queued, before anything is allowed to finish.
    await Promise.resolve();
    expect(gate.inFlight).toBe(2);
    expect(gate.queued).toBe(2);

    gates.forEach((d) => d.resolve());
    await Promise.all(runs);

    expect(peak).toBe(2);
    expect(gate.inFlight).toBe(0);
    expect(gate.queued).toBe(0);
  });

  it("releases the slot when the work throws, so the pool cannot shrink", async () => {
    const gate = new ConcurrencyGate(1);

    await expect(
      gate.run(async () => {
        throw new Error("boom");
      })
    ).rejects.toThrow("boom");

    expect(gate.inFlight).toBe(0);

    // The next caller must still get through. A leaked slot would hang here,
    // which in production means a permanently smaller pool and eventual
    // deadlock of every BEAPI-backed route.
    await expect(gate.run(async () => "ok")).resolves.toBe("ok");
  });

  it("admits a queued caller as soon as one finishes, not in a batch", async () => {
    const gate = new ConcurrencyGate(1);
    const first = deferred();
    const order: string[] = [];

    const a = gate.run(async () => {
      order.push("a:start");
      await first.promise;
      order.push("a:end");
    });
    const b = gate.run(async () => {
      order.push("b:start");
    });

    await Promise.resolve();
    expect(order).toEqual(["a:start"]); // b is still queued

    first.resolve();
    await Promise.all([a, b]);
    expect(order).toEqual(["a:start", "a:end", "b:start"]);
  });

  it("runs queued callers first-in-first-out", async () => {
    const gate = new ConcurrencyGate(1);
    const block = deferred();
    const finished: number[] = [];

    const head = gate.run(async () => {
      await block.promise;
    });
    const rest = [1, 2, 3].map((n) =>
      gate.run(async () => {
        finished.push(n);
      })
    );

    block.resolve();
    await Promise.all([head, ...rest]);
    expect(finished).toEqual([1, 2, 3]);
  });

  it("returns the value the work produced", async () => {
    const gate = new ConcurrencyGate(4);
    const values = await Promise.all(
      [1, 2, 3, 4, 5, 6].map((n) => gate.run(async () => n * 2))
    );
    expect(values).toEqual([2, 4, 6, 8, 10, 12]);
  });

  it("bounds a 183-call catalogue sweep to the limit", async () => {
    // The 2026-10-25 burst, reproduced: 183 simultaneous callers.
    const gate = new ConcurrencyGate(8);
    let peak = 0;
    await Promise.all(
      Array.from({ length: 183 }, () =>
        gate.run(async () => {
          peak = Math.max(peak, gate.inFlight);
          await new Promise((r) => setTimeout(r, 0));
        })
      )
    );
    expect(peak).toBe(8);
    expect(gate.inFlight).toBe(0);
  });
});
