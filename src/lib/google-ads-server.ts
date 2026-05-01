import { createHash } from "crypto";

import { google } from "googleapis";

import { getGoogleAdsPurchaseMode } from "./google-ads-public";

interface GoogleAdsUploadConfig {
  conversionActionId: string;
  customerId: string;
  developerToken: string;
  loginCustomerId?: string;
  serviceAccountEmail: string;
  serviceAccountPrivateKey: string;
}

interface GoogleAdsPurchaseUploadInput {
  consentGranted?: boolean;
  currency?: string;
  // gclid/gbraid/wbraid are mutually exclusive on ClickConversion — only one
  // is attached per upload. gbraid/wbraid land on iOS traffic (App / Web
  // campaigns respectively) where ATT suppresses the gclid, so missing them
  // silently drops iOS conversion attribution.
  gclid?: string;
  gbraid?: string;
  wbraid?: string;
  occurredAt?: Date;
  reservationId: string;
  value: number;
  // Enhanced Conversions inputs. ConversionUploadService only accepts
  // hashed_email and hashed_phone_number — address_info (first/last name) is
  // ignored on this service, so we don't take it.
  email?: string;
  phone?: string;
  // Forwarded from the originating request. Improves attribution diagnostics
  // and gives Google a fallback signal when click IDs are stale.
  userAgent?: string;
}

function hashSha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function normalizePhoneE164(phone?: string): string | undefined {
  const digits = phone?.replace(/\D/g, "");
  if (!digits) return undefined;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return `+${digits}`;
  return undefined;
}

function buildUserIdentifiers(
  input: GoogleAdsPurchaseUploadInput
): Array<Record<string, unknown>> {
  // Only attach hashed PII when marketing consent is granted. If consent is
  // denied the upload still happens (consent.adUserData=DENIED) but with no
  // user identifiers — Google falls back to modeling.
  if (input.consentGranted === false) return [];

  const identifiers: Array<Record<string, unknown>> = [];

  const email = input.email?.trim().toLowerCase();
  if (email) {
    identifiers.push({ hashedEmail: hashSha256(email) });
  }

  const phoneE164 = normalizePhoneE164(input.phone);
  if (phoneE164) {
    identifiers.push({ hashedPhoneNumber: hashSha256(phoneE164) });
  }

  return identifiers;
}

let accessTokenCache:
  | {
      accessToken: string;
      expiresAt: number;
    }
  | undefined;
let warnedMissingConfig = false;
const GOOGLE_ADS_SCOPE = "https://www.googleapis.com/auth/adwords";

function trimEnv(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeCustomerId(value?: string): string | undefined {
  const digits = value?.replace(/\D/g, "");
  return digits ? digits : undefined;
}

function getGoogleAdsUploadConfig(): GoogleAdsUploadConfig | null {
  if (getGoogleAdsPurchaseMode() !== "server") {
    return null;
  }

  const conversionActionId = normalizeCustomerId(
    process.env.GOOGLE_ADS_PURCHASE_CONVERSION_ACTION_ID
  );
  const customerId = normalizeCustomerId(process.env.GOOGLE_ADS_CUSTOMER_ID);
  const developerToken = trimEnv(process.env.GOOGLE_ADS_DEVELOPER_TOKEN);
  const loginCustomerId = normalizeCustomerId(
    process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID
  );
  const serviceAccountEmail = trimEnv(
    process.env.GOOGLE_ADS_SERVICE_ACCOUNT_EMAIL
  );
  const serviceAccountPrivateKey = trimEnv(
    process.env.GOOGLE_ADS_SERVICE_ACCOUNT_PRIVATE_KEY
  )?.replace(/\\n/g, "\n");

  if (
    !conversionActionId ||
    !customerId ||
    !developerToken ||
    !serviceAccountEmail ||
    !serviceAccountPrivateKey
  ) {
    if (!warnedMissingConfig) {
      warnedMissingConfig = true;
      console.warn(
        "[Google Ads] Purchase upload mode is enabled, but the server upload credentials are incomplete."
      );
    }
    return null;
  }

  return {
    conversionActionId,
    customerId,
    developerToken,
    loginCustomerId,
    serviceAccountEmail,
    serviceAccountPrivateKey,
  };
}

function formatConversionDateTime(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const seconds = String(date.getUTCSeconds()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}+00:00`;
}

async function getGoogleAdsAccessToken(
  config: GoogleAdsUploadConfig
): Promise<string | null> {
  if (accessTokenCache && accessTokenCache.expiresAt > Date.now()) {
    return accessTokenCache.accessToken;
  }

  try {
    const auth = new google.auth.JWT({
      email: config.serviceAccountEmail,
      key: config.serviceAccountPrivateKey,
      scopes: [GOOGLE_ADS_SCOPE],
    });

    const tokens = await auth.authorize();
    if (!tokens.access_token) {
      console.error(
        "[Google Ads] Service-account auth did not return an access token."
      );
      return null;
    }

    accessTokenCache = {
      accessToken: tokens.access_token,
      expiresAt:
        typeof tokens.expiry_date === "number"
          ? tokens.expiry_date - 60_000
          : Date.now() + 55 * 60 * 1000,
    };

    return tokens.access_token;
  } catch (error) {
    console.error("[Google Ads] Service-account auth error:", error);
    return null;
  }
}

export async function uploadGoogleAdsPurchaseConversion(
  input: GoogleAdsPurchaseUploadInput
) {
  const config = getGoogleAdsUploadConfig();
  if (!config) return;

  // Pick exactly one click identifier. gclid is preferred (richest signal);
  // gbraid/wbraid are the iOS ATT fallbacks Google emits on App/Web campaigns.
  const clickId = input.gclid
    ? { gclid: input.gclid }
    : input.gbraid
      ? { gbraid: input.gbraid }
      : input.wbraid
        ? { wbraid: input.wbraid }
        : null;
  if (!clickId) return;

  const accessToken = await getGoogleAdsAccessToken(config);
  if (!accessToken) return;

  const userIdentifiers = buildUserIdentifiers(input);
  // Consent Mode v2 requires both adUserData and adPersonalization to be
  // signaled independently — they govern different downstream uses (matching
  // vs. remarketing). Mirror the user's consent state to both.
  const consentSignal = input.consentGranted === false ? "DENIED" : "GRANTED";
  const body = {
    conversions: [
      {
        ...clickId,
        conversionAction: `customers/${config.customerId}/conversionActions/${config.conversionActionId}`,
        conversionDateTime: formatConversionDateTime(
          input.occurredAt || new Date()
        ),
        conversionValue: Number(input.value.toFixed(2)),
        currencyCode: input.currency || "USD",
        orderId: input.reservationId,
        // Diagnostic field: marks this as a web-origin offline upload so
        // Google's troubleshooting UI can distinguish web vs app sources.
        conversionEnvironment: "WEB",
        ...(input.userAgent && { userAgent: input.userAgent }),
        consent: {
          adUserData: consentSignal,
          adPersonalization: consentSignal,
        },
        ...(userIdentifiers.length > 0 && { userIdentifiers }),
      },
    ],
    partialFailure: true,
  };

  try {
    const res = await fetch(
      `https://googleads.googleapis.com/v23/customers/${config.customerId}:uploadClickConversions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "developer-token": config.developerToken,
          ...(config.loginCustomerId
            ? { "login-customer-id": config.loginCustomerId }
            : {}),
        },
        body: JSON.stringify(body),
      }
    );

    const payloadText = await res.text();
    if (!res.ok) {
      console.error(
        `[Google Ads] Purchase upload failed: ${res.status} ${payloadText}`
      );
      return;
    }

    if (!payloadText) return;

    const payload = JSON.parse(payloadText) as {
      partialFailureError?: {
        message?: string;
      };
    };

    if (payload.partialFailureError?.message) {
      console.error(
        `[Google Ads] Purchase upload partial failure: ${payload.partialFailureError.message}`
      );
    }
  } catch (error) {
    console.error("[Google Ads] Purchase upload error:", error);
  }
}
