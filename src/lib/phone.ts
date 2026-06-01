/**
 * Phone-number helpers for Guesty + Stripe + Klaviyo integration.
 *
 * Why E.164: Guesty's OpenAPI silently drops phone numbers that aren't in
 * E.164 format (+<country><digits>). For US/NANP numbers stored as bare
 * 10 digits in our form ("5082371715"), this means the guest profile in
 * Guesty ends up with an empty phone field — even though the form did
 * collect it. See memory `project_traverse_e164_phone_fix` for the bug
 * that surfaced on the first organic reservation (2026-05-15).
 *
 * Stripe accepts any format and normalizes internally, but we still send
 * E.164 for consistency.
 */

/**
 * Convert a raw or formatted phone string to E.164 for North American
 * numbers. Returns "" if input is empty or unrecognizable.
 *
 * Examples:
 *   "5082371715"      → "+15082371715"
 *   "(508) 237-1715"  → "+15082371715"
 *   "15082371715"     → "+15082371715"
 *   "+15082371715"    → "+15082371715"  (already E.164, returned as-is)
 *   ""                → ""
 *   undefined         → ""
 */
export function toE164US(phone: string | null | undefined): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 0) return "";
  // 11 digits starting with "1" → already has country code, just add "+"
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  // 10 digits → assume US/Canada, prepend "+1"
  if (digits.length === 10) return `+1${digits}`;
  // Other lengths: probably international or invalid — best effort.
  // Returning with "+" prefix lets downstream APIs decide whether to accept.
  return `+${digits}`;
}
