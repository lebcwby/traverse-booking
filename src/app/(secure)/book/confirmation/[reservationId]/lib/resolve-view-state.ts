import { createServerSupabaseClient } from "@/lib/supabase-auth-server";
import { getPool } from "@/lib/db";
import { lookupAuthUserByEmail } from "@/lib/auth-lookup";
import { lookupReservationPaymentMethod } from "@/lib/payment-method-lookup";
import type {
  ConfirmationData,
  MoneySummary,
  PaymentMethodSummary,
  ViewState,
} from "./view-state";

export class ReservationNotFoundError extends Error {
  constructor(reservationId: string) {
    super(`Reservation not found: ${reservationId}`);
    this.name = "ReservationNotFoundError";
  }
}

export class AuthResolutionError extends Error {
  constructor(message = "Failed to resolve auth state") {
    super(message);
    this.name = "AuthResolutionError";
  }
}

interface ReservationRow {
  guesty_id: string;
  confirmation_code: string | null;
  user_id: string | null;
  guest: {
    email?: string | null;
    firstName?: string | null;
    first_name?: string | null;
  } | null;
  listing_id: string | null;
  listing_title: string | null;
  listing_picture: string | null;
  check_in: string | null;
  check_out: string | null;
  guests_count: number | null;
  money: Record<string, unknown> | null;
  stripe_payment_intent_id: string | null;
}

function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const normalized = email.trim().toLowerCase();
  return normalized || null;
}

function toOptionalNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeMoney(money: ReservationRow["money"]): MoneySummary | null {
  if (!money) return null;

  const total = toOptionalNumber(money.totalPaid ?? money.total_paid) ?? 0;
  const stay = toOptionalNumber(money.subTotalPrice ?? money.sub_total_price);
  const cleaning = toOptionalNumber(money.fareCleaning ?? money.fare_cleaning);
  const taxes = toOptionalNumber(money.totalTaxes ?? money.total_taxes);
  const currency =
    typeof money.currency === "string" && money.currency
      ? money.currency
      : "USD";

  return {
    total,
    currency,
    stay,
    cleaning,
    taxes,
    hasDetailedBreakdown: stay !== null || cleaning !== null || taxes !== null,
  };
}

function rowToData(
  row: ReservationRow,
  payment: PaymentMethodSummary | null
): ConfirmationData {
  return {
    reservationId: row.guesty_id,
    confirmationCode:
      row.confirmation_code || `GY-${row.guesty_id.slice(-8).toUpperCase()}`,
    listingId: row.listing_id,
    listingTitle: row.listing_title,
    listingPicture: row.listing_picture,
    checkIn: row.check_in,
    checkOut: row.check_out,
    guests: row.guests_count,
    money: normalizeMoney(row.money),
    payment,
  };
}

async function resolvePaymentMethod(
  row: ReservationRow
): Promise<PaymentMethodSummary | null> {
  return lookupReservationPaymentMethod({
    stripePaymentIntentId: row.stripe_payment_intent_id,
    money: row.money,
  });
}

function getGuestEmail(row: ReservationRow): string | null {
  return normalizeEmail(row.guest?.email ?? null);
}

function getGuestFirstName(row: ReservationRow): string | null {
  const firstName = row.guest?.firstName ?? row.guest?.first_name ?? null;
  return typeof firstName === "string" && firstName.trim()
    ? firstName.trim()
    : null;
}

function isAnonymousSessionError(error: unknown): boolean {
  if (!error) return false;

  if (typeof error === "object") {
    const maybeError = error as { name?: unknown; message?: unknown };
    if (maybeError.name === "AuthSessionMissingError") return true;
    if (
      typeof maybeError.message === "string" &&
      maybeError.message.toLowerCase().includes("auth session missing")
    ) {
      return true;
    }
  }

  return false;
}

async function resolveAuthenticatedUser(): Promise<{
  id: string;
  email: string | null;
} | null> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      if (!user && isAnonymousSessionError(error)) {
        return null;
      }
      throw new AuthResolutionError(error.message);
    }

    if (!user) return null;

    return {
      id: user.id,
      email: normalizeEmail(user.email),
    };
  } catch (error) {
    if (isAnonymousSessionError(error)) {
      return null;
    }

    if (error instanceof AuthResolutionError) {
      throw error;
    }

    throw new AuthResolutionError(
      error instanceof Error ? error.message : undefined
    );
  }
}

const RESERVATION_SELECT = `SELECT
       r.guesty_id,
       r.confirmation_code,
       r.user_id,
       r.guest,
       r.listing_id,
       r.check_in,
       r.check_out,
       r.guests_count,
       r.money,
       r.stripe_payment_intent_id,
       l.title AS listing_title,
       l.picture AS listing_picture
     FROM reservations r
     LEFT JOIN listings l ON l.guesty_id = r.listing_id
     WHERE r.guesty_id = $1
     LIMIT 1`;

// The confirmation page is hit immediately after the Stripe webhook fires the
// checkout finalizer, which races against the local reservations INSERT. If
// the row isn't there yet, retry briefly before giving up — far better than
// showing a 404 to a guest who just paid.
const FETCH_RETRY_ATTEMPTS = 6;
const FETCH_RETRY_DELAY_MS = 500;

async function fetchReservationRow(
  reservationId: string
): Promise<ReservationRow | null> {
  const pool = getPool();
  for (let attempt = 0; attempt < FETCH_RETRY_ATTEMPTS; attempt++) {
    const result = await pool.query<ReservationRow>(RESERVATION_SELECT, [
      reservationId,
    ]);
    if (result.rows.length > 0) return result.rows[0];
    if (attempt < FETCH_RETRY_ATTEMPTS - 1) {
      await new Promise((resolve) => setTimeout(resolve, FETCH_RETRY_DELAY_MS));
    }
  }
  return null;
}

export async function resolveViewState(
  reservationId: string
): Promise<ViewState> {
  const row = await fetchReservationRow(reservationId);

  if (!row) {
    throw new ReservationNotFoundError(reservationId);
  }
  const payment = await resolvePaymentMethod(row);
  const data = rowToData(row, payment);
  const guestEmail = getGuestEmail(row);
  const guestFirstName = getGuestFirstName(row);
  const user = await resolveAuthenticatedUser();

  if (user) {
    const ownsByUserId = row.user_id === user.id;
    const ownsByEmail = Boolean(
      user.email && guestEmail && user.email === guestEmail
    );

    if (ownsByUserId || ownsByEmail) {
      if (!row.user_id && user.email) {
        // Best-effort optimization: backfill user_id so future queries find
        // the reservation by id directly. The FK constraint
        // reservations_user_id_fkey references the shared DB's auth.users
        // table, but our actual users live in the book-traverse auth DB —
        // so this UPDATE can throw a FK violation. Email-match ownership
        // still works without it; do not let a backfill failure 500 the
        // confirmation page.
        try {
          await getPool().query(
            `UPDATE reservations
             SET user_id = $1
             WHERE guesty_id = $2
               AND user_id IS NULL
               AND lower(guest->>'email') = lower($3)`,
            [user.id, reservationId, user.email]
          );
        } catch (backfillErr) {
          console.warn(
            "[resolveViewState] user_id backfill skipped:",
            backfillErr instanceof Error ? backfillErr.message : backfillErr
          );
        }
      }

      return {
        kind: "owner",
        data,
        firstName: guestFirstName,
      };
    }

    return { kind: "stranger" };
  }

  if (guestEmail) {
    const lookup = await lookupAuthUserByEmail(guestEmail);
    if (lookup.exists) {
      return {
        kind: "existing-account",
        data,
        account: {
          email: guestEmail,
          providers: lookup.providers,
        },
      };
    }
  }

  return {
    kind: "guest",
    data,
  };
}
