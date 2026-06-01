import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockSendEmail,
  mockInsertLead,
  mockGetPoisByIds,
  mockEnforceRateLimit,
  mockRejectOversizedRequest,
} = vi.hoisted(() => ({
  mockSendEmail: vi.fn(),
  mockInsertLead: vi.fn(),
  mockGetPoisByIds: vi.fn(),
  mockEnforceRateLimit: vi.fn(),
  mockRejectOversizedRequest: vi.fn(),
}));

vi.mock("resend", () => ({
  Resend: vi.fn(function Resend() {
    return {
      emails: {
        send: mockSendEmail,
      },
    };
  }),
}));

vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: () => ({
    from: () => ({
      insert: mockInsertLead,
    }),
  }),
}));

vi.mock("@/lib/pois/queries", () => ({
  getPoisByIds: mockGetPoisByIds,
}));

vi.mock("@/lib/plan/route-guards", () => ({
  enforceRateLimit: mockEnforceRateLimit,
  rejectOversizedRequest: mockRejectOversizedRequest,
}));

import { POST } from "./route";

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/plan/save", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function validItinerary(overrides: Record<string, unknown> = {}) {
  return {
    title: "Leadville <script>alert(1)</script>",
    summary: "A summary with <img src=x onerror=alert(1)>",
    party: { adults: 2, kids: 1, vibe: "balanced" },
    dates: {
      checkIn: "2026-06-10",
      checkOut: "2026-06-12",
      nights: 2,
      isTentative: false,
    },
    days: [
      {
        dayNumber: 1,
        label: "Day <b>One</b>",
        items: [
          {
            poiId: "poi-1",
            timeSlot: "midday",
            reason: "Lunch with <strong>bad html</strong>",
            durationMinutes: 60,
          },
          {
            poiId: "poi-2",
            timeSlot: "afternoon",
            reason: "Walk around <script>alert(2)</script>",
            durationMinutes: 90,
          },
        ],
      },
    ],
    notes: ["Bring layers <script>alert(3)</script>"],
    ...overrides,
  };
}

describe("POST /api/plan/save", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnforceRateLimit.mockResolvedValue(null);
    mockRejectOversizedRequest.mockReturnValue(null);
    mockInsertLead.mockResolvedValue({ error: null });
    mockGetPoisByIds.mockResolvedValue([
      {
        id: "poi-1",
        name: "Safe <Cafe>",
        neighborhood: "Leadville",
        category: "restaurant",
      },
    ]);
    mockSendEmail.mockResolvedValue({ error: null });
  });

  it("rejects malformed itineraries before writing or sending email", async () => {
    const response = await POST(
      makeRequest({
        email: "guest@example.com",
        itinerary: { title: "Missing required shape" },
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "valid itinerary required",
    });
    expect(mockInsertLead).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("escapes untrusted itinerary and name fields in the email HTML", async () => {
    const response = await POST(
      makeRequest({
        email: " Guest@Example.com ",
        name: "<img src=x onerror=alert(0)>",
        itinerary: validItinerary(),
      })
    );

    expect(response.status).toBe(200);
    expect(mockInsertLead).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "guest@example.com",
        party_size: 3,
        check_in: "2026-06-10",
        check_out: "2026-06-12",
      })
    );
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "guest@example.com",
        subject: "Your Colorado Trip: Leadville <script>alert(1)</script>",
      })
    );

    const html = mockSendEmail.mock.calls[0]?.[0]?.html as string;
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("<strong>bad html</strong>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("&lt;img src=x onerror=alert(0)&gt;");
    expect(html).toContain("Safe &lt;Cafe&gt;");
    expect(html).toContain("checkIn=2026-06-10");
    expect(html).toContain("checkOut=2026-06-12");
    expect(html).toContain("guests=3");
  });
});
