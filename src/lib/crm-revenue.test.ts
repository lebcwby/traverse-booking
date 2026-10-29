import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { crmConfigured, fetchListingHistory } from "./crm-revenue";

const saved = process.env.CRM_DATABASE_URL;

afterEach(() => {
  if (saved === undefined) delete process.env.CRM_DATABASE_URL;
  else process.env.CRM_DATABASE_URL = saved;
});

describe("crmConfigured", () => {
  it("is false when the variable is unset", () => {
    delete process.env.CRM_DATABASE_URL;
    expect(crmConfigured()).toBe(false);
  });

  // Vercel's env storage has been seen to keep a trailing newline, and an
  // all-whitespace value would otherwise look configured and then fail to
  // connect on every alert.
  it("is false when the variable is only whitespace", () => {
    process.env.CRM_DATABASE_URL = "  \n ";
    expect(crmConfigured()).toBe(false);
  });

  it("is true for a real connection string", () => {
    process.env.CRM_DATABASE_URL = "postgres://u:p@host:5432/postgres";
    expect(crmConfigured()).toBe(true);
  });
});

describe("fetchListingHistory", () => {
  beforeEach(() => {
    delete process.env.CRM_DATABASE_URL;
  });

  // The whole point of the optional second database: with nothing
  // configured, the booking alert must behave exactly as it does today —
  // a blank last-year column, not an exception that kills the email.
  it("returns an empty history, without connecting, when unconfigured", async () => {
    const h = await fetchListingHistory("listing-1", ["2025-10-28"]);
    expect(h.earnedByDate.size).toBe(0);
    expect(h.firstStayDate).toBeNull();
  });

  it("does not connect for an empty date list even when configured", async () => {
    // An unreachable host: if this tried to connect, the test would hang or
    // throw rather than return promptly.
    process.env.CRM_DATABASE_URL = "postgres://u:p@127.0.0.1:1/none";
    const h = await fetchListingHistory("listing-1", []);
    expect(h.earnedByDate.size).toBe(0);
  });

  it("does not connect when the listing id is blank", async () => {
    process.env.CRM_DATABASE_URL = "postgres://u:p@127.0.0.1:1/none";
    const h = await fetchListingHistory("", ["2025-10-28"]);
    expect(h.firstStayDate).toBeNull();
  });
});
