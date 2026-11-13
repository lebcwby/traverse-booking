/**
 * The one place dollars and cents cross. Stripe gives us integer cents;
 * Guesty's `recordPayment` body expects dollars. Everywhere our new payment-
 * recording code tracks amounts, it uses integer cents — these helpers are
 * the only conversion.
 */

export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

export function centsToDollars(cents: number): number {
  return cents / 100;
}
