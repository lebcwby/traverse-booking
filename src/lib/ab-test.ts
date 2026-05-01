/**
 * Lightweight cookie-based A/B testing.
 * Assigns a variant on first visit and persists for 90 days.
 */

export type CTAVariant = "gold" | "teal" | "green";

const COOKIE_NAME = "sp_cta_variant";
const COOKIE_DAYS = 90;

const VARIANTS: CTAVariant[] = ["gold", "teal", "green"];

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string, days: number) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

export function getCTAVariant(): CTAVariant {
  const existing = getCookie(COOKIE_NAME);
  if (existing && VARIANTS.includes(existing as CTAVariant)) {
    return existing as CTAVariant;
  }

  const variant = VARIANTS[Math.floor(Math.random() * VARIANTS.length)];
  setCookie(COOKIE_NAME, variant, COOKIE_DAYS);
  return variant;
}

/** Tailwind classes per variant */
export const CTA_STYLES: Record<
  CTAVariant,
  { bg: string; hover: string; shimmerVia: string }
> = {
  gold: {
    bg: "bg-warm text-warm-foreground",
    hover: "hover:bg-warm/90",
    shimmerVia: "after:via-white/20",
  },
  teal: {
    bg: "bg-teal text-teal-foreground",
    hover: "hover:bg-teal/90",
    shimmerVia: "after:via-white/25",
  },
  green: {
    bg: "bg-[hsl(152_45%_38%)] text-white",
    hover: "hover:bg-[hsl(152_45%_33%)]",
    shimmerVia: "after:via-white/25",
  },
};
