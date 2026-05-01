import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockRpc, mockGetUserById } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  mockGetUserById: vi.fn(),
}));

vi.mock("@/lib/supabase-auth-admin", () => ({
  getAuthAdmin: () => ({
    rpc: mockRpc,
    auth: {
      admin: { getUserById: mockGetUserById },
    },
  }),
}));

import { lookupAuthUserByEmail, userExistsByEmail } from "./auth-lookup";

beforeEach(() => {
  mockRpc.mockReset();
  mockGetUserById.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("lookupAuthUserByEmail", () => {
  it("returns exists + dedupe'd providers from getUserById identities", async () => {
    mockRpc.mockResolvedValue({
      data: [{ id: "u1" }],
      error: null,
    });
    mockGetUserById.mockResolvedValue({
      data: {
        user: {
          id: "u1",
          email: "alex@example.com",
          identities: [
            { provider: "email" },
            { provider: "google" },
            { provider: "google" },
          ],
        },
      },
      error: null,
    });

    const result = await lookupAuthUserByEmail("alex@example.com");
    expect(result.exists).toBe(true);
    expect(result.providers.sort()).toEqual(["email", "google"]);
    expect(mockRpc).toHaveBeenCalledWith("lookup_user_by_email", {
      lookup_email: "alex@example.com",
    });
    expect(mockGetUserById).toHaveBeenCalledWith("u1");
  });

  it("returns exists=true with empty providers when getUserById fails", async () => {
    mockRpc.mockResolvedValue({
      data: [{ id: "u1" }],
      error: null,
    });
    mockGetUserById.mockResolvedValue({
      data: null,
      error: { message: "boom" },
    });

    const result = await lookupAuthUserByEmail("alex@example.com");
    expect(result).toEqual({ exists: true, providers: [] });
  });

  it("returns empty providers when identities array is missing from getUserById", async () => {
    mockRpc.mockResolvedValue({
      data: [{ id: "u1" }],
      error: null,
    });
    mockGetUserById.mockResolvedValue({
      data: { user: { id: "u1", email: "alex@example.com" } },
      error: null,
    });

    const result = await lookupAuthUserByEmail("alex@example.com");
    expect(result.exists).toBe(true);
    expect(result.providers).toEqual([]);
  });

  it("returns exists=false when the RPC returns empty", async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });

    const result = await lookupAuthUserByEmail("nope@example.com");
    expect(result).toEqual({ exists: false, providers: [] });
    expect(mockGetUserById).not.toHaveBeenCalled();
  });

  it("normalizes the email to lowercase before querying", async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });

    await lookupAuthUserByEmail("ALEX@Example.COM");

    expect(mockRpc).toHaveBeenCalledWith(
      "lookup_user_by_email",
      expect.objectContaining({ lookup_email: "alex@example.com" })
    );
  });

  it("returns empty result on RPC error", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "boom" },
    });

    const result = await lookupAuthUserByEmail("alex@example.com");
    expect(result).toEqual({ exists: false, providers: [] });
    expect(mockGetUserById).not.toHaveBeenCalled();
  });

  it("returns empty result for empty input without querying", async () => {
    const result = await lookupAuthUserByEmail("   ");
    expect(result).toEqual({ exists: false, providers: [] });
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockGetUserById).not.toHaveBeenCalled();
  });
});

describe("userExistsByEmail compatibility wrapper", () => {
  it("returns true when the lookup says exists", async () => {
    mockRpc.mockResolvedValue({
      data: [{ id: "u1" }],
      error: null,
    });
    mockGetUserById.mockResolvedValue({
      data: { user: { id: "u1", email: "alex@example.com", identities: [] } },
      error: null,
    });
    await expect(userExistsByEmail("alex@example.com")).resolves.toBe(true);
  });

  it("returns false when the lookup says missing", async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    await expect(userExistsByEmail("nope@example.com")).resolves.toBe(false);
  });
});
