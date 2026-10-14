import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockUpsert, mockFrom } = vi.hoisted(() => {
  const mockUpsert = vi.fn();
  const mockFrom = vi.fn(() => ({ upsert: mockUpsert }));
  return { mockUpsert, mockFrom };
});

vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: () => ({ from: mockFrom }),
}));

import { upsertMetaVisitor } from "./meta-visitor-store";

const VISITOR = "db624164-9203-4663-b485-38f9c501a26d";

/** The row object handed to PostgREST on the most recent call. */
function sentRow(): Record<string, unknown> {
  return mockUpsert.mock.calls.at(-1)![0] as Record<string, unknown>;
}

beforeEach(() => {
  mockUpsert.mockReset().mockResolvedValue({ error: null });
  mockFrom.mockClear();
});

describe("upsertMetaVisitor", () => {
  it("writes to sp_meta_visitors keyed on visitor_id", async () => {
    await upsertMetaVisitor({ visitorId: VISITOR, fbp: "fb.1.1.1" });
    expect(mockFrom).toHaveBeenCalledWith("sp_meta_visitors");
    expect(mockUpsert.mock.calls[0][1]).toEqual({ onConflict: "visitor_id" });
    expect(sentRow().visitor_id).toBe(VISITOR);
  });

  it("ignores a call with no visitor id rather than writing a null key", async () => {
    await upsertMetaVisitor({ visitorId: "" });
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  // ⚠️ This is the defect this test exists for. PostgREST builds the
  // `ON CONFLICT DO UPDATE SET` clause from the keys in the payload, so
  // sending `email_hash: null` on an anonymous event ERASES the hash stored
  // when the guest booked. The hash is the cross-device join key, so the
  // damage is invisible and total. Absent fields must be OMITTED, not nulled.
  it("omits absent identifiers instead of nulling them", async () => {
    await upsertMetaVisitor({ visitorId: VISITOR, fbp: "fb.1.1.1" });

    const row = sentRow();
    expect(row).not.toHaveProperty("email_hash");
    expect(row).not.toHaveProperty("fbc");
    expect(row).not.toHaveProperty("fbclid");
    expect(row).not.toHaveProperty("fbclid_ts");
    // Nothing may be sent as an explicit null, whatever the key.
    expect(Object.values(row)).not.toContain(null);
  });

  it("does not resend email_hash on a later anonymous event", async () => {
    // Event 1: the guest books and supplies an email.
    await upsertMetaVisitor({
      visitorId: VISITOR,
      fbp: "fb.1.1.1",
      emailHash: "a".repeat(64),
    });
    expect(sentRow().email_hash).toBe("a".repeat(64));

    // Event 2: the same visitor loads another page, no email in context.
    await upsertMetaVisitor({ visitorId: VISITOR, fbp: "fb.1.1.1" });
    expect(sentRow()).not.toHaveProperty("email_hash");
  });

  it("carries every identifier through when all are present", async () => {
    await upsertMetaVisitor({
      visitorId: VISITOR,
      fbp: "fb.1.1.1",
      fbc: "fb.1.1.1.IwAR",
      fbclid: "IwAR",
      fbclidTs: 1791972594249,
      emailHash: "b".repeat(64),
    });

    expect(sentRow()).toMatchObject({
      visitor_id: VISITOR,
      fbp: "fb.1.1.1",
      fbc: "fb.1.1.1.IwAR",
      fbclid: "IwAR",
      fbclid_ts: 1791972594249,
      email_hash: "b".repeat(64),
    });
  });

  it("drops a non-finite fbclid timestamp rather than writing NaN", async () => {
    await upsertMetaVisitor({ visitorId: VISITOR, fbclidTs: Number.NaN });
    expect(sentRow()).not.toHaveProperty("fbclid_ts");
  });

  it("always refreshes last_seen_at", async () => {
    await upsertMetaVisitor({ visitorId: VISITOR });
    expect(typeof sentRow().last_seen_at).toBe("string");
  });

  // first_seen_at is column-defaulted and must never be written, or every
  // event would reset the visitor's first-seen date to now.
  it("never writes first_seen_at", async () => {
    await upsertMetaVisitor({ visitorId: VISITOR, emailHash: "c".repeat(64) });
    expect(sentRow()).not.toHaveProperty("first_seen_at");
  });

  it("swallows a database error so tracking never breaks a request", async () => {
    mockUpsert.mockResolvedValue({ error: { message: "boom" } });
    await expect(
      upsertMetaVisitor({ visitorId: VISITOR })
    ).resolves.toBeUndefined();
  });
});
