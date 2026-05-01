import { loadStripe, Stripe } from "@stripe/stripe-js";
import StripeServer from "stripe";
import { createHash } from "crypto";

const stripeCache = new Map<string, Promise<Stripe | null>>();

export function getStripe(publishableKey?: string) {
  const key = publishableKey || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!;
  if (!stripeCache.has(key)) {
    stripeCache.set(key, loadStripe(key));
  }
  return stripeCache.get(key)!;
}

export function getStripeServer() {
  // Trim defensively — Vercel env values for credentials have been observed
  // to retain trailing literal "\n" characters that break HMAC signature
  // verification and Authorization headers without surfacing a clear error.
  const secretKey = (process.env.STRIPE_SECRET_KEY || "").trim();
  return new StripeServer(secretKey);
}

function stringifyIdempotencyValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map(stringifyIdempotencyValue).join(",");
  }
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
}

export function buildStripeIdempotencyKey(
  scope: string,
  payload: Record<string, unknown>
) {
  const normalized = Object.keys(payload)
    .sort()
    .map((key) => {
      const value = payload[key];
      if (Array.isArray(value)) {
        return `${key}=${[...value].map(stringifyIdempotencyValue).sort().join(",")}`;
      }
      return `${key}=${stringifyIdempotencyValue(value)}`;
    })
    .join("|");

  const digest = createHash("sha256")
    .update(`${scope}|${normalized}`)
    .digest("hex");
  return `${scope}:${digest}`;
}
