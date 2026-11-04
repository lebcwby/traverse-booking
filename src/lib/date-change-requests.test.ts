import { describe, expect, it } from "vitest";
import {
  DATE_CHANGE_REQUEST_LEAD,
  buildDateChangeRequestAlert,
  dateChangePriceCopy,
  parseDateChangeRequest,
} from "./date-change-requests";

const CURRENT_IN = "2026-11-10";
const CURRENT_OUT = "2026-11-14";

describe("parseDateChangeRequest", () => {
  it("accepts a new stay and an optional note", () => {
    const parsed = parseDateChangeRequest(
      {
        requestedCheckIn: "2026-11-12",
        requestedCheckOut: "2026-11-16",
        note: "  Arriving later  ",
      },
      CURRENT_IN,
      CURRENT_OUT
    );
    expect(parsed).toEqual({
      ok: true,
      value: {
        requestedCheckIn: "2026-11-12",
        requestedCheckOut: "2026-11-16",
        note: "Arriving later",
      },
    });
  });

  it("treats a blank note as no note", () => {
    const parsed = parseDateChangeRequest(
      {
        requestedCheckIn: "2026-11-12",
        requestedCheckOut: "2026-11-16",
        note: "   ",
      },
      CURRENT_IN,
      CURRENT_OUT
    );
    expect(parsed.ok && parsed.value.note).toBeNull();
  });

  it("rejects the stay the guest already has", () => {
    const parsed = parseDateChangeRequest(
      { requestedCheckIn: CURRENT_IN, requestedCheckOut: CURRENT_OUT },
      CURRENT_IN,
      CURRENT_OUT
    );
    expect(parsed.ok).toBe(false);
  });

  it("rejects a check-out that is not after check-in", () => {
    const parsed = parseDateChangeRequest(
      { requestedCheckIn: "2026-11-16", requestedCheckOut: "2026-11-16" },
      CURRENT_IN,
      CURRENT_OUT
    );
    expect(parsed.ok).toBe(false);
  });

  it("rejects a calendar date that does not exist", () => {
    const parsed = parseDateChangeRequest(
      { requestedCheckIn: "2026-02-31", requestedCheckOut: "2026-03-02" },
      CURRENT_IN,
      CURRENT_OUT
    );
    expect(parsed.ok).toBe(false);
  });
});

describe("date change copy", () => {
  it("says the form is a request and that nothing is charged", () => {
    expect(DATE_CHANGE_REQUEST_LEAD).toMatch(/request/i);
    expect(DATE_CHANGE_REQUEST_LEAD).toMatch(/does not charge/i);
  });

  it("says a cheaper stay can be refunded 14 or more days out", () => {
    const copy = dateChangePriceCopy(
      "2026-11-10",
      new Date("2026-10-26T18:00:00.000Z")
    );
    expect(copy).toMatch(/14 or more days/);
    expect(copy).toMatch(/before any charge/);
  });

  it("says the stay is non-refundable inside 14 days", () => {
    const copy = dateChangePriceCopy(
      "2026-10-28",
      new Date("2026-10-26T18:00:00.000Z")
    );
    expect(copy).toMatch(/within 14 days/i);
    expect(copy).toMatch(/non-refundable/);
    expect(copy).toMatch(/before any charge/);
  });
});

describe("buildDateChangeRequestAlert", () => {
  it("escapes the guest note and names the request row", () => {
    const alert = buildDateChangeRequestAlert({
      requestId: "req_1",
      reservationId: "res_1",
      confirmationCode: "GY-ABC",
      guestName: "Ava <script>",
      guestEmail: "ava@example.com",
      currentCheckIn: CURRENT_IN,
      currentCheckOut: CURRENT_OUT,
      requestedCheckIn: "2026-11-12",
      requestedCheckOut: "2026-11-16",
      note: `Please <b>move</b> us\nThanks`,
    });
    expect(alert.subject).toBe("Date change request — GY-ABC");
    expect(alert.alertKey).toBe("date-change-request-req_1");
    expect(alert.html).toContain("Ava &lt;script&gt;");
    expect(alert.html).toContain(
      "Please &lt;b&gt;move&lt;/b&gt; us<br/>Thanks"
    );
    expect(alert.html).toContain("date_change_requests");
    expect(alert.html).toContain("Nothing was charged, refunded, or changed");
    expect(alert.html).not.toContain("<script>");
    expect(alert.html).not.toContain("<b>move</b>");
  });
});
