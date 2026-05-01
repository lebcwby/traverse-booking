import crypto from "crypto";

const TOKEN_TTL_MS = 2 * 24 * 60 * 60 * 1000;

function getSigningSecret() {
  const secret =
    process.env.PENDING_CHECKOUT_LOOKUP_SECRET || process.env.CRON_SECRET;
  if (!secret) {
    throw new Error(
      "PENDING_CHECKOUT_LOOKUP_SECRET or CRON_SECRET must be set"
    );
  }
  return secret;
}

function signPayload(payload: string) {
  return crypto
    .createHmac("sha256", getSigningSecret())
    .update(payload)
    .digest("base64url");
}

export function createPendingCheckoutLookupToken(paymentIntentId: string) {
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const payload = `${paymentIntentId}.${expiresAt}`;
  const signature = signPayload(payload);
  return `${payload}.${signature}`;
}

export function verifyPendingCheckoutLookupToken(
  token: string,
  paymentIntentId: string
) {
  const parts = token.split(".");
  if (parts.length !== 3) return false;

  const [tokenPaymentIntentId, expiresAtRaw, signature] = parts;
  if (!tokenPaymentIntentId || tokenPaymentIntentId !== paymentIntentId)
    return false;

  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return false;

  const payload = `${tokenPaymentIntentId}.${expiresAt}`;
  const expectedSignature = signPayload(payload);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (actualBuffer.length !== expectedBuffer.length) return false;
  return crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}
