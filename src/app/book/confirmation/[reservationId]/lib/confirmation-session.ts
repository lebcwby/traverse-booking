const STORAGE_KEY = "booking_confirmation";

export interface ConfirmationSession {
  reservationId?: string;
  confirmationCode?: string;
  listingId?: string;
  listingTitle?: string;
  picture?: string;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  stayTotal?: number;
  totalPaid?: number;
  guestEmail?: string;
  guestPhone?: string;
  guestFirstName?: string;
  guestLastName?: string;
  // Stripe billing address — required to send name signal in Google Ads
  // browser EC (firstName + lastName + postalCode + country, all-or-nothing).
  guestPostalCode?: string;
  guestCountry?: string;
  marketingOptIn?: boolean;
  tracked?: boolean;
  eventId?: string;
  upsells?: string[];
  pets?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function toOptionalNumber(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return value;
}

function toOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

export function readConfirmationSession(
  expectedReservationId?: string
): ConfirmationSession | null {
  if (typeof window === "undefined") return null;

  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!isRecord(parsed)) return null;

    const reservationId = toOptionalString(parsed.reservationId);
    if (expectedReservationId && reservationId !== expectedReservationId) {
      return null;
    }

    return {
      reservationId,
      confirmationCode: toOptionalString(parsed.confirmationCode),
      listingId: toOptionalString(parsed.listingId),
      listingTitle: toOptionalString(parsed.listingTitle),
      picture: toOptionalString(parsed.picture),
      checkIn: toOptionalString(parsed.checkIn),
      checkOut: toOptionalString(parsed.checkOut),
      guests: toOptionalNumber(parsed.guests),
      stayTotal: toOptionalNumber(parsed.stayTotal),
      totalPaid: toOptionalNumber(parsed.totalPaid),
      guestEmail: toOptionalString(parsed.guestEmail),
      guestPhone: toOptionalString(parsed.guestPhone),
      guestFirstName: toOptionalString(parsed.guestFirstName),
      guestLastName: toOptionalString(parsed.guestLastName),
      guestPostalCode: toOptionalString(parsed.guestPostalCode),
      guestCountry: toOptionalString(parsed.guestCountry),
      marketingOptIn: toOptionalBoolean(parsed.marketingOptIn),
      tracked: toOptionalBoolean(parsed.tracked),
      eventId: toOptionalString(parsed.eventId),
      upsells: Array.isArray(parsed.upsells)
        ? parsed.upsells.filter(
            (item): item is string => typeof item === "string"
          )
        : undefined,
      pets: toOptionalNumber(parsed.pets),
    };
  } catch {
    return null;
  }
}

export function updateConfirmationSession(
  patch: Partial<ConfirmationSession>
): ConfirmationSession | null {
  if (typeof window === "undefined") return null;

  const current = readConfirmationSession();
  if (!current) return null;

  const next = { ...current, ...patch };
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
