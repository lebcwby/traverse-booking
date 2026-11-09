/**
 * Turning a wallet's billing details into the guest record Guesty needs.
 *
 * Apple Pay and Google Pay return ONE `name` string. Guesty's reservation
 * endpoint requires `guest.firstName` and `guest.lastName` separately and
 * rejects either being empty:
 *
 *   400 WRONG_REQUEST_PARAMETERS
 *   "guest.firstName" is not allowed to be empty
 *
 * On 2026-11-08 a guest paid $477.44 through a wallet that returned no name
 * at all. The payment succeeded, Guesty refused the reservation, and the
 * booking sat unfinalised for 27 hours with the money taken. The split lives
 * here, apart from the React component, so the cases that produce an
 * unbookable record are pinned by tests rather than discovered in production.
 */

export interface ExpressCheckoutBillingDetails {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

/**
 * Split a wallet's single name field into first and last.
 *
 * First whitespace-separated token is the first name, everything after it is
 * the last name — so "Ana María del Bosque" keeps the whole surname rather
 * than dropping it. A single-token name yields an empty lastName, which
 * `isBookableBillingName` then rejects: it is not something this function can
 * fix, and inventing a placeholder would put a fake surname on a real booking.
 */
export function splitWalletName(fullName: string | null | undefined): {
  firstName: string;
  lastName: string;
} {
  const trimmed = (fullName || "").trim();
  if (!trimmed) return { firstName: "", lastName: "" };
  const parts = trimmed.split(/\s+/);
  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" "),
  };
}

/** Build the guest record from what the wallet gave us. */
export function toExpressBillingDetails(billing: {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
}): ExpressCheckoutBillingDetails {
  const { firstName, lastName } = splitWalletName(billing.name);
  return {
    firstName,
    lastName,
    email: billing.email || "",
    phone: billing.phone || "",
  };
}

/**
 * Can this become a Guesty reservation?
 *
 * Deliberately only the two fields Guesty rejects on. Email and phone are
 * requested from the wallet too, but a missing one of those does not make the
 * booking impossible, and blocking a payment for them would turn a recoverable
 * gap into a lost booking.
 */
export function isBookableBillingName(
  details: Pick<ExpressCheckoutBillingDetails, "firstName" | "lastName">
): boolean {
  return (
    details.firstName.trim().length > 0 && details.lastName.trim().length > 0
  );
}
