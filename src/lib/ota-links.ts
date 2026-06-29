// Build deep-links to the SAME listing on Airbnb / Vrbo / Booking.com with the
// guest's exact dates pre-filled, so they can verify our direct price is lower
// on the OTA's own page. Base URLs come from Guesty's listing `integrations[]`
// (externalUrl per platform: airbnb2 / homeaway2 / bookingCom).

export interface OtaBaseLinks {
  airbnb?: string | null;
  vrbo?: string | null;
  booking?: string | null;
}

interface DateParams {
  checkIn?: string; // YYYY-MM-DD
  checkOut?: string; // YYYY-MM-DD
  guests?: number;
}

function withParams(
  base: string,
  params: Record<string, string | number | undefined>,
  { clearExisting = false }: { clearExisting?: boolean } = {}
): string | null {
  try {
    const u = new URL(base);
    if (clearExisting) u.search = "";
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== "") u.searchParams.set(k, String(v));
    }
    return u.toString();
  } catch {
    return base; // malformed URL — return as-is rather than dropping the link
  }
}

/**
 * Append each OTA's date/guest query params in its own format. Without dates,
 * returns the bare listing URL (still useful). Drops platforms with no URL.
 */
export function buildOtaDeepLinks(
  raw: OtaBaseLinks,
  { checkIn, checkOut, guests }: DateParams
): OtaBaseLinks {
  const hasDates = Boolean(checkIn && checkOut);
  const out: OtaBaseLinks = {};

  if (raw.airbnb) {
    out.airbnb = hasDates
      ? withParams(raw.airbnb, {
          check_in: checkIn,
          check_out: checkOut,
          adults: guests,
        })
      : raw.airbnb;
  }

  if (raw.vrbo) {
    // Vrbo externalUrl carries `?dateless=true` — clear it, set startDate/endDate.
    out.vrbo = hasDates
      ? withParams(
          raw.vrbo,
          { startDate: checkIn, endDate: checkOut, adults: guests },
          { clearExisting: true }
        )
      : withParams(raw.vrbo, {}, { clearExisting: true });
  }

  if (raw.booking) {
    out.booking = hasDates
      ? withParams(raw.booking, {
          checkin: checkIn,
          checkout: checkOut,
          group_adults: guests,
          no_rooms: 1,
        })
      : raw.booking;
  }

  return out;
}

/** Pull the per-platform externalUrls out of a Guesty listing `integrations[]`. */
export function extractOtaLinksFromIntegrations(
  integrations: Array<{ platform?: string; externalUrl?: string | null }> | null
): OtaBaseLinks {
  const byPlatform: Record<string, string | null | undefined> = {};
  for (const it of integrations || []) {
    if (it?.platform) byPlatform[it.platform] = it.externalUrl;
  }
  return {
    airbnb: byPlatform.airbnb2 || null,
    vrbo: byPlatform.homeaway2 || null, // homeaway2 = Vrbo
    booking: byPlatform.bookingCom || null,
  };
}
