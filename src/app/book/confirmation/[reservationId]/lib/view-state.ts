export interface MoneySummary {
  total: number;
  currency: string;
  stay: number | null;
  cleaning: number | null;
  taxes: number | null;
  hasDetailedBreakdown: boolean;
}

export interface PaymentMethodSummary {
  /** Card brand, e.g. "visa", "mastercard". */
  brand: string | null;
  /** Last 4 digits of the card number. */
  last4: string | null;
  /** ISO 8601 timestamp when the payment was settled. */
  paidAt: string | null;
  /**
   * Stripe-hosted receipt URL for the charge. Opens a page with a proper
   * receipt, official card brand logo, and a downloadable PDF.
   */
  receiptUrl: string | null;
}

export interface ConfirmationData {
  reservationId: string;
  confirmationCode: string;
  listingId: string | null;
  listingTitle: string | null;
  listingPicture: string | null;
  checkIn: string | null;
  checkOut: string | null;
  guests: number | null;
  money: MoneySummary | null;
  payment: PaymentMethodSummary | null;
}

export interface ExistingAccountInfo {
  /** The email address the existing account is registered under. */
  email: string;
  /**
   * Auth providers attached to the account, e.g. ["email"] for password,
   * ["google"] for Google OAuth only, or ["email", "google"] for both.
   */
  providers: string[];
}

export type ViewState =
  | {
      kind: "owner";
      data: ConfirmationData;
      /** SSR-private; strip before passing into client components. */
      firstName: string | null;
    }
  | { kind: "stranger" }
  | {
      kind: "existing-account";
      data: ConfirmationData;
      account: ExistingAccountInfo;
    }
  | { kind: "guest"; data: ConfirmationData };

export type ClientSafeViewState =
  | { kind: "owner"; data: ConfirmationData }
  | { kind: "stranger" }
  | {
      kind: "existing-account";
      data: ConfirmationData;
      account: ExistingAccountInfo;
    }
  | { kind: "guest"; data: ConfirmationData };

export function toClientSafeViewState(state: ViewState): ClientSafeViewState {
  if (state.kind === "owner") {
    return {
      kind: "owner",
      data: state.data,
    };
  }

  return state;
}
