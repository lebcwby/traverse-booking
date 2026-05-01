export type GoogleAdsPurchaseMode = "client" | "server";

const DEFAULT_GOOGLE_ADS_ID = "AW-16519101211";
const DEFAULT_GOOGLE_ADS_CHECKOUT_LABEL = "ke_mCI3t2_0bEJv29cQ9";
const DEFAULT_GOOGLE_ADS_PURCHASE_LABEL = "ie2vCLzmhZUbEJv29cQ9";

function trimEnv(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeGoogleAdsId(value?: string): string | undefined {
  const trimmed = trimEnv(value);
  if (!trimmed) return undefined;

  if (trimmed.startsWith("AW-")) return trimmed;

  const digits = trimmed.replace(/\D/g, "");
  return digits ? `AW-${digits}` : undefined;
}

export function getGoogleAdsId(): string {
  return (
    normalizeGoogleAdsId(process.env.NEXT_PUBLIC_GOOGLE_ADS_ID) ||
    DEFAULT_GOOGLE_ADS_ID
  );
}

export function getGoogleAdsCheckoutLabel(): string {
  return (
    trimEnv(process.env.NEXT_PUBLIC_GOOGLE_ADS_CHECKOUT_LABEL) ||
    DEFAULT_GOOGLE_ADS_CHECKOUT_LABEL
  );
}

export function getGoogleAdsPurchaseLabel(): string {
  return (
    trimEnv(process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL) ||
    DEFAULT_GOOGLE_ADS_PURCHASE_LABEL
  );
}

export function getGoogleAdsCheckoutSendTo(): string {
  return `${getGoogleAdsId()}/${getGoogleAdsCheckoutLabel()}`;
}

export function getGoogleAdsPurchaseSendTo(): string {
  return `${getGoogleAdsId()}/${getGoogleAdsPurchaseLabel()}`;
}

export function getGoogleAdsPurchaseMode(): GoogleAdsPurchaseMode {
  const mode = trimEnv(process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_MODE);
  return mode?.toLowerCase() === "server" ? "server" : "client";
}
