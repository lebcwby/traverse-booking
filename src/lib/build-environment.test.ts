import { afterEach, describe, expect, it } from "vitest";
import {
  hasUsableBeapiEnv,
  hasUsableSupabasePublicEnv,
  shouldSkipCiBeapiFetches,
  shouldSkipCiSupabaseFetches,
} from "./build-environment";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("build-environment", () => {
  it("detects usable public Supabase env", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL =
      "https://abcdefghijklmnop.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "real-anon-key";

    expect(hasUsableSupabasePublicEnv()).toBe(true);
  });

  it("detects placeholder Supabase env", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "public-anon-key-placeholder";
    process.env.GITHUB_ACTIONS = "true";

    expect(hasUsableSupabasePublicEnv()).toBe(false);
    expect(shouldSkipCiSupabaseFetches()).toBe(true);
  });

  it("detects placeholder BEAPI env", () => {
    process.env.GUESTY_BEAPI_CLIENT_ID = "guesty-beapi-client-id";
    process.env.GUESTY_BEAPI_CLIENT_SECRET = "guesty-beapi-client-secret";
    process.env.GITHUB_ACTIONS = "true";

    expect(hasUsableBeapiEnv()).toBe(false);
    expect(shouldSkipCiBeapiFetches()).toBe(true);
  });
});
