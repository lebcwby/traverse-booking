import { afterEach, describe, expect, it } from "vitest";
import {
  buildStripeDashboardPaymentUrl,
  formatDurationMs,
  renderAlertDetails,
  renderAlertLinks,
} from "./alerts";

const originalStripeSecretKey = process.env.STRIPE_SECRET_KEY;

afterEach(() => {
  process.env.STRIPE_SECRET_KEY = originalStripeSecretKey;
});

describe("alerts helpers", () => {
  it("builds live and test Stripe dashboard links correctly", () => {
    process.env.STRIPE_SECRET_KEY = "sk_live_123";
    expect(buildStripeDashboardPaymentUrl("pi_live")).toBe(
      "https://dashboard.stripe.com/payments/pi_live"
    );

    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    expect(buildStripeDashboardPaymentUrl("pi_test")).toBe(
      "https://dashboard.stripe.com/test/payments/pi_test"
    );
  });

  it("formats duration values for alerts", () => {
    expect(formatDurationMs(5 * 60 * 1000)).toBe("5m");
    expect(formatDurationMs(125 * 60 * 1000)).toBe("2h 5m");
    expect(formatDurationMs(26 * 60 * 60 * 1000)).toBe("1d 2h");
  });

  it("renders escaped detail tables and link lists", () => {
    const details = renderAlertDetails([
      ["Guest email", "guest@example.com"],
      ["Error", "<script>alert(1)</script>"],
      ["Blank", ""],
    ]);
    const links = renderAlertLinks([
      {
        label: "Stripe payment",
        url: "https://dashboard.stripe.com/payments/pi_123",
      },
      { label: "Ignore me", url: "" },
    ]);

    expect(details).toContain("guest@example.com");
    expect(details).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(details).not.toContain(">Blank<");
    expect(links).toContain("Stripe payment");
    expect(links).toContain("https://dashboard.stripe.com/payments/pi_123");
  });
});
