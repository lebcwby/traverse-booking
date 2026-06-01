// Thin wrapper around @composio/core so the rest of the automation doesn't
// have to know about client construction, userId conventions, or response
// envelope shape.
//
// One Composio account holds the OAuth tokens for both the marketing@ Gmail
// inbox and the Google Drive account that owns the blog-images folder. Both
// connections are bound to userId "default" — the value the Composio CLI uses
// when you run `composio add gmail` / `composio add googledrive` interactively.

import { Composio } from "@composio/core";

const DEFAULT_USER_ID = "default";

let cached: Composio | null = null;

export function getComposio(): Composio {
  if (cached) return cached;
  const apiKey = process.env.COMPOSIO_API_KEY;
  if (!apiKey) throw new Error("COMPOSIO_API_KEY is required for blog automation");
  cached = new Composio({ apiKey });
  return cached;
}

export interface ToolExecOk<T> {
  ok: true;
  data: T;
}
export interface ToolExecErr {
  ok: false;
  error: string;
}
export type ToolExec<T> = ToolExecOk<T> | ToolExecErr;

/**
 * Wrapper around tools.execute that normalizes Composio's success/error
 * envelope into a discriminated union so call sites stay readable.
 *
 * Composio responses look like { successful: boolean, data?: ..., error?: ... }
 * but the SDK types are loose enough that we cast at the boundary.
 */
export async function exec<T = Record<string, unknown>>(
  slug: string,
  args: Record<string, unknown>,
  opts: { userId?: string } = {},
): Promise<ToolExec<T>> {
  const composio = getComposio();
  const userId = opts.userId ?? DEFAULT_USER_ID;
  try {
    // Composio v0.10+ requires either an explicit `version` or this flag to
    // resolve "latest". Pinning versions per tool is brittle in an
    // automation that talks to a half-dozen Drive/Gmail slugs; the SDK
    // warns "use with caution" but for an internal automation that always
    // wants newest schema, this is the right tradeoff.
    const res = (await composio.tools.execute(slug, {
      userId,
      arguments: args,
      dangerouslySkipVersionCheck: true,
    })) as {
      successful?: boolean;
      data?: unknown;
      error?: unknown;
    };
    if (res.successful === false) {
      return {
        ok: false,
        error:
          typeof res.error === "string"
            ? res.error
            : JSON.stringify(res.error ?? {}),
      };
    }
    return { ok: true, data: (res.data ?? res) as T };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export { DEFAULT_USER_ID };
