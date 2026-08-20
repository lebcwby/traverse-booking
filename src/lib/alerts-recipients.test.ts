import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Recipient resolution for sendAlert.
 *
 * On 2026-08-03 we found ALERT_TO_EMAIL had never been set in production, so
 * ~36 of 51 alert call sites — including "PAID BOOKING NEEDS MANUAL RECOVERY",
 * the one that fires when a guest is charged with no reservation — returned
 * early at the empty-recipients check and vanished into console.error.
 *
 * Setting it to a comma-separated pair then exposed a second latent bug:
 * ALERT_TO was passed to Resend as ONE string, and Resend does not split a
 * comma-joined `to` — it would have rejected the send as a malformed address,
 * leaving alerting just as broken while looking configured.
 *
 * These cover both, since the whole point of this path is that it works on the
 * day something expensive goes wrong.
 */

const sendMock = vi.fn();

// Must be a real constructor — alerts.ts does `new Resend(apiKey)`.
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: sendMock };
  },
}));

// No Supabase env in tests → getSupabaseAdmin() returns null and the shared
// cooldown lookups no-op, so each call goes straight through.
vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn(() => null) }));

const ENV = { ...process.env };

async function loadSendAlert(alertTo: string | undefined) {
  vi.resetModules();
  process.env.RESEND_API_KEY = "re_test_key";
  process.env.ALERT_FROM_EMAIL = "Alerts <noreply@booktraverse.com>";
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (alertTo === undefined) delete process.env.ALERT_TO_EMAIL;
  else process.env.ALERT_TO_EMAIL = alertTo;
  return (await import("./alerts")).sendAlert;
}

const recipientsOfLastSend = () =>
  (sendMock.mock.calls.at(-1)?.[0] as { to: string[] }).to;

describe("sendAlert recipients", () => {
  beforeEach(() => {
    sendMock.mockReset();
    sendMock.mockResolvedValue({ id: "email_1" });
  });
  afterEach(() => {
    process.env = { ...ENV };
  });

  it("splits a comma-separated ALERT_TO_EMAIL into separate addresses", async () => {
    const sendAlert = await loadSendAlert(
      "admin@traversehospitality.com,nadim@traversehospitality.com"
    );
    await sendAlert("Test subject", "body", "key-comma");

    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(recipientsOfLastSend()).toEqual([
      "admin@traversehospitality.com",
      "nadim@traversehospitality.com",
    ]);
  });

  it("tolerates semicolons and stray whitespace", async () => {
    const sendAlert = await loadSendAlert(
      " admin@x.com ;  ops@x.com , \tdev@x.com "
    );
    await sendAlert("Test subject", "body", "key-messy");

    expect(recipientsOfLastSend()).toEqual([
      "admin@x.com",
      "ops@x.com",
      "dev@x.com",
    ]);
  });

  it("adds per-alert overrides to the base list without duplicating", async () => {
    const sendAlert = await loadSendAlert("admin@x.com,ops@x.com");
    await sendAlert("Test subject", "body", "key-override", {
      to: "admin@x.com", // already in the base list
    });

    expect(recipientsOfLastSend()).toEqual(["admin@x.com", "ops@x.com"]);
  });

  it("still delivers via an override when ALERT_TO_EMAIL is unset", async () => {
    // This is why the ~15 call sites carrying an explicit `to:` kept working
    // while everything else silently died.
    const sendAlert = await loadSendAlert(undefined);
    await sendAlert("Test subject", "body", "key-only-override", {
      to: "admin@traversehospitality.com",
    });

    expect(recipientsOfLastSend()).toEqual(["admin@traversehospitality.com"]);
  });

  it("sends nothing when there is no recipient anywhere", async () => {
    const sendAlert = await loadSendAlert("");
    await sendAlert("Test subject", "body", "key-none");

    expect(sendMock).not.toHaveBeenCalled();
  });
});
