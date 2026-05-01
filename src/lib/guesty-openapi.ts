import { getSupabaseAdmin } from "./supabase-admin";
import { sendAlert } from "./alerts";

const OPENAPI_BASE_URL = "https://open-api.guesty.com";

// Read-only token management. Refresh handled by refresh-tokens pg_cron.
const TOKEN_BUFFER_MS = 8 * 60 * 60 * 1000; // Token is "fresh" if > 8h remaining

let memoryToken: { token: string; expiresAt: number } | null = null;

// ─── Token Management ─────────────────────────────────────────────

function isTokenFresh(expiresAt: number): boolean {
  return expiresAt > Date.now() + TOKEN_BUFFER_MS;
}

function isTokenUsable(expiresAt: number): boolean {
  return expiresAt > Date.now();
}

async function getSupabaseCachedToken(): Promise<{
  token: string;
  expiresAt: number;
} | null> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("guesty_tokens")
      .select("access_token, expires_at")
      .eq("token_type", "openapi")
      .single();

    if (error) {
      console.warn("OpenAPI token cache lookup failed:", error.message);
      return null;
    }

    if (data && isTokenUsable(data.expires_at)) {
      return { token: data.access_token, expiresAt: data.expires_at };
    }
  } catch (err) {
    console.error("Unexpected error checking OpenAPI token cache:", err);
  }

  return null;
}

async function getOpenAPIToken(): Promise<string> {
  // Read-only — NEVER refresh tokens here. Token refresh is handled
  // exclusively by the refresh-tokens Supabase edge function via pg_cron.

  // Layer 1: In-memory
  if (memoryToken && isTokenFresh(memoryToken.expiresAt)) {
    return memoryToken.token;
  }

  // Layer 2: Supabase
  const cached = await getSupabaseCachedToken();
  if (cached) {
    memoryToken = { token: cached.token, expiresAt: cached.expiresAt };
    if (isTokenUsable(cached.expiresAt)) return cached.token;
  }

  // Layer 3: In-memory fallback
  if (memoryToken && isTokenUsable(memoryToken.expiresAt)) {
    return memoryToken.token;
  }

  throw new Error(
    "OpenAPI token expired — refresh-tokens pg_cron must refresh it"
  );
}

// ─── Authenticated OpenAPI Fetch ──────────────────────────────────

async function openapiFetch(
  path: string,
  options?: RequestInit,
  retries = 2,
  timeoutMs?: number
) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const token = await getOpenAPIToken();
    const controller = timeoutMs ? new AbortController() : null;
    const timeoutId = controller
      ? setTimeout(
          () =>
            controller.abort(
              new Error(`OpenAPI request timed out after ${timeoutMs}ms`)
            ),
          timeoutMs
        )
      : null;

    let response: Response;
    try {
      response = await fetch(`${OPENAPI_BASE_URL}${path}`, {
        ...options,
        signal: controller?.signal,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
          ...options?.headers,
        },
      });
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }

    if (response.status === 401) {
      console.error(
        `OpenAPI auth failure (401) on ${path} — attempt ${attempt}/${retries}`
      );
      memoryToken = null; // Clear memory only — NEVER delete from Supabase
      if (attempt < retries) continue;
      await sendAlert(
        "OpenAPI Auth Failure — Retries Exhausted",
        `Guesty OpenAPI returned 401 on <code>${path}</code> after ${retries} attempts.`,
        "openapi-auth-exhausted"
      );
    }

    if (response.status === 429) {
      if (attempt < retries) {
        const backoff = 1000 * Math.pow(2, attempt - 1);
        await new Promise((r) => setTimeout(r, backoff));
        continue;
      }
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OpenAPI ${path} failed: ${response.status} ${text}`);
    }

    return response.json();
  }
}

// ─── Invoice Items ────────────────────────────────────────────────

export async function addInvoiceItem(
  reservationId: string,
  item: {
    title: string;
    amount: number;
    normalType: string;
    secondIdentifier: string;
    accountFeeId?: string;
  }
) {
  const body: Record<string, unknown> = {
    title: item.title,
    amount: item.amount,
    normalType: item.normalType,
    secondIdentifier: item.secondIdentifier,
  };
  if (item.accountFeeId) {
    body.accountFeeId = item.accountFeeId;
  }
  return openapiFetch(`/v1/invoice-items/reservation/${reservationId}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// ─── Reservation Management ──────────────────────────────────────

export async function getOpenAPIReservation(reservationId: string) {
  return openapiFetch(`/v1/reservations/${reservationId}`);
}

export async function cancelOpenAPIReservation(reservationId: string) {
  return openapiFetch(`/v1/reservations/${reservationId}`, {
    method: "PUT",
    body: JSON.stringify({ status: "canceled" }),
  });
}

export async function updateReservationDates(
  reservationId: string,
  checkInDateLocalized: string,
  checkOutDateLocalized: string
) {
  // Use v1 PUT /reservations/{id} — the v3 /dates endpoint cancels and
  // recreates the reservation when check-in changes, breaking the ID chain.
  // The v1 general update endpoint modifies dates in-place safely.
  const result = await openapiFetch(`/v1/reservations/${reservationId}`, {
    method: "PUT",
    body: JSON.stringify({ checkInDateLocalized, checkOutDateLocalized }),
  });

  // Verify Guesty actually applied the date change
  if (
    result?.checkOutDateLocalized &&
    result.checkOutDateLocalized !== checkOutDateLocalized
  ) {
    throw new Error(
      `Guesty date update mismatch: requested ${checkOutDateLocalized}, got ${result.checkOutDateLocalized}`
    );
  }

  return result;
}

export async function updateReservationSource(
  reservationId: string,
  source: string
) {
  return openapiFetch(`/v1/reservations-v3/${reservationId}/source`, {
    method: "PUT",
    body: JSON.stringify({ source, recalculateFinancials: false }),
  });
}

export async function recordPayment(
  reservationId: string,
  amount: number,
  paymentIntentId: string,
  options?: { retries?: number; timeoutMs?: number }
) {
  return openapiFetch(
    `/v1/reservations/${reservationId}/payments`,
    {
      method: "POST",
      body: JSON.stringify({
        amount,
        currency: "USD",
        paymentMethod: { method: "CREDIT" },
        note: `Stripe PI ${paymentIntentId} — collected via native Stripe`,
      }),
    },
    options?.retries ?? 2,
    options?.timeoutMs
  );
}

export function isAlreadySettledPaymentError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("Payment amount can't be greater than balance due");
}

export function isTestModePaymentIntentError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("No such payment_intent") &&
    message.includes("similar object exists in test mode")
  );
}

interface GuestyPayment {
  _id?: string;
  status?: string;
  amount?: number;
  isAuthorizationHold?: boolean;
  isSecurityDeposit?: boolean;
  refunds?: Array<{ amount?: number; status?: string }>;
}

interface GuestyReservationMoney {
  money?: { payments?: GuestyPayment[] };
}

/**
 * Find a SUCCEEDED, non-hold payment on a reservation with at least
 * `amount` of unrefunded value remaining. Used to identify which payment
 * record on the reservation a refund should be issued against.
 */
function findRefundablePayment(
  reservation: GuestyReservationMoney,
  amount: number
): GuestyPayment | null {
  const payments = reservation?.money?.payments;
  if (!Array.isArray(payments)) return null;
  for (const p of payments) {
    if (!p || !p._id) continue;
    if (p.status !== "SUCCEEDED") continue;
    if (p.isAuthorizationHold || p.isSecurityDeposit) continue;
    const paid = Number(p.amount || 0);
    const refunded = Array.isArray(p.refunds)
      ? p.refunds
          .filter((r) => r?.status === "SUCCEEDED")
          .reduce((sum, r) => sum + Number(r.amount || 0), 0)
      : 0;
    if (paid - refunded + 0.001 >= amount) {
      return p;
    }
  }
  return null;
}

/**
 * Records a refund on a Guesty reservation by issuing it against the original
 * SUCCEEDED payment. Guesty's `/payments` POST endpoint only accepts positive
 * amounts (negative-amount payments return 400), so refunds must be sent to
 * the per-payment refund endpoint instead.
 */
export async function recordRefund(
  reservationId: string,
  amount: number,
  note: string
) {
  if (!(amount > 0)) {
    throw new Error(`recordRefund: amount must be positive (got ${amount})`);
  }
  const reservation = (await getOpenAPIReservation(
    reservationId
  )) as GuestyReservationMoney;
  const payment = findRefundablePayment(reservation, amount);
  if (!payment || !payment._id) {
    throw new Error(
      `recordRefund: no refundable payment found on reservation ${reservationId} for amount ${amount}`
    );
  }
  return openapiFetch(
    `/v1/reservations/${reservationId}/payments/${payment._id}/refund`,
    {
      method: "POST",
      body: JSON.stringify({ amount, note }),
    }
  );
}

export async function createReservationFromQuote(params: {
  quoteId: string;
  ratePlanId: string;
  guest: { firstName: string; lastName: string; email: string; phone: string };
  source?: string;
}) {
  return openapiFetch("/v1/reservations-v3/quote", {
    method: "POST",
    body: JSON.stringify({
      quoteId: params.quoteId,
      ratePlanId: params.ratePlanId,
      status: "confirmed",
      reservedUntil: -1,
      guest: {
        firstName: params.guest.firstName,
        lastName: params.guest.lastName,
        email: params.guest.email,
        phones: [params.guest.phone],
      },
      source: params.source || "BE-API",
      ignoreCalendar: false,
      ignoreTerms: false,
      ignoreBlocks: false,
    }),
  });
}
