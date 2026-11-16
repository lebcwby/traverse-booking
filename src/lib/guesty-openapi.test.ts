import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

// `openapiFetch` reads a token from Supabase. Pretend one is cached so the
// code path reaches `fetch` — then we intercept fetch itself.
vi.mock("./supabase-admin", () => ({
  getSupabaseAdmin: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: {
              access_token: "test-token",
              expires_at: Date.now() + 24 * 60 * 60 * 1000,
            },
            error: null,
          }),
        }),
      }),
    }),
  }),
}));

vi.mock("./alerts", () => ({
  sendAlert: vi.fn(async () => {}),
}));

const originalFetch = globalThis.fetch;

type FetchCall = {
  url: string;
  method: string;
  body: unknown;
};

const fetchCalls: FetchCall[] = [];
type Responder = () => { status: number; json: unknown };
let responders: Responder[] = [];

beforeEach(() => {
  fetchCalls.length = 0;
  responders = [];
  (globalThis as unknown as { fetch: typeof fetch }).fetch = (async (
    input: string | URL | Request,
    init?: { method?: string; body?: string }
  ) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = (init?.method || "GET").toUpperCase();
    const body = init?.body ? JSON.parse(init.body as string) : undefined;
    fetchCalls.push({ url, method, body });
    const next = responders.shift();
    if (!next) throw new Error(`No fetch responder set for ${method} ${url}`);
    const { status, json } = next();
    return new Response(JSON.stringify(json ?? {}), {
      status,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
});

afterEach(() => {
  vi.clearAllMocks();
});

afterAll(() => {
  globalThis.fetch = originalFetch;
});

function queueResponders(items: Array<{ status: number; json: unknown }>) {
  responders.push(...items.map((it) => () => it));
}

describe("recordPaymentCapped", () => {
  it("records the full amount on a happy path and returns outcome:full", async () => {
    const { recordPaymentCapped } = await import("./guesty-openapi");
    queueResponders([{ status: 200, json: { ok: true } }]);

    const result = await recordPaymentCapped("res_full", 5793, "pi_test");
    expect(result).toEqual({ outcome: "full", recordedCents: 5793 });

    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0].method).toBe("POST");
    expect(fetchCalls[0].url).toMatch(/\/v1\/reservations\/res_full\/payments/);
    expect((fetchCalls[0].body as { amount: number }).amount).toBe(57.93);
  });

  it("returns no_op when balance is already 0 (prior record / duplicate webhook)", async () => {
    const { recordPaymentCapped } = await import("./guesty-openapi");
    queueResponders([
      {
        status: 400,
        json: { message: "Payment amount can't be greater than balance due" },
      },
      { status: 200, json: { money: { balanceDue: 0 } } },
    ]);

    const result = await recordPaymentCapped("res_noop", 10000, "pi_noop");
    expect(result).toEqual({ outcome: "no_op" });
    expect(fetchCalls).toHaveLength(2);
  });

  it("records exactly the Guesty balance when 0 < balance < requested (the $50 shortfall case)", async () => {
    // Stripe captured $100 (10000c); Guesty balance is $50. Record $50 only.
    const { recordPaymentCapped } = await import("./guesty-openapi");
    queueResponders([
      {
        status: 400,
        json: { message: "Payment amount can't be greater than balance due" },
      },
      { status: 200, json: { money: { balanceDue: 50 } } },
      { status: 200, json: { ok: true } },
    ]);

    const result = await recordPaymentCapped("res_short", 10000, "pi_short");
    expect(result).toEqual({
      outcome: "short",
      recordedCents: 5000,
      shortfallCents: 5000,
      balanceCents: 5000,
    });

    // Three HTTP calls: initial POST (rejected), GET reservation, POST balance.
    expect(fetchCalls[2].method).toBe("POST");
    expect((fetchCalls[2].body as { amount: number }).amount).toBe(50);
  });

  it("asserts the exact dollar amount on a $5.77 top-up (post-migration cron re-entry)", async () => {
    const { recordPaymentCapped } = await import("./guesty-openapi");
    queueResponders([{ status: 200, json: { ok: true } }]);

    const result = await recordPaymentCapped("res_topup", 577, "pi_topup");
    expect(result).toEqual({ outcome: "full", recordedCents: 577 });

    expect((fetchCalls[0].body as { amount: number }).amount).toBe(5.77);
  });

  it("caps at requestedCents when the balance has raced UP past requested", async () => {
    // Balance is $1.50, requested is $1.00. Guesty would accept 1.00; we
    // MUST never record 1.50 (that would exceed Stripe captured).
    const { recordPaymentCapped } = await import("./guesty-openapi");
    queueResponders([
      {
        status: 400,
        json: { message: "Payment amount can't be greater than balance due" },
      },
      { status: 200, json: { money: { balanceDue: 1.5 } } },
      { status: 200, json: { ok: true } },
    ]);

    const result = await recordPaymentCapped("res_race_up", 100, "pi_race_up");
    expect(result).toEqual({ outcome: "full", recordedCents: 100 });
    // The second POST must be $1.00, NOT $1.50.
    expect((fetchCalls[2].body as { amount: number }).amount).toBe(1);
  });

  it("returns no_op when the balance-raced-up retry fails as 'amount > balance' again", async () => {
    const { recordPaymentCapped } = await import("./guesty-openapi");
    queueResponders([
      {
        status: 400,
        json: { message: "Payment amount can't be greater than balance due" },
      },
      { status: 200, json: { money: { balanceDue: 1.5 } } },
      {
        status: 400,
        json: { message: "Payment amount can't be greater than balance due" },
      },
    ]);

    const result = await recordPaymentCapped("res_race_down", 100, "pi_rd");
    expect(result).toEqual({ outcome: "no_op" });
  });

  it("rethrows unrelated errors instead of treating them as settled", async () => {
    const { recordPaymentCapped } = await import("./guesty-openapi");
    queueResponders([
      { status: 503, json: { message: "service unavailable" } },
    ]);

    await expect(
      recordPaymentCapped("res_err", 1000, "pi_err")
    ).rejects.toThrow(/503/);
  });

  it("rejects non-positive or non-finite requests", async () => {
    const { recordPaymentCapped } = await import("./guesty-openapi");
    await expect(recordPaymentCapped("res_zero", 0, "pi_zero")).rejects.toThrow(
      /positive finite integer/
    );
    await expect(
      recordPaymentCapped("res_nan", Number.NaN, "pi_nan")
    ).rejects.toThrow(/positive finite integer/);
  });
});
