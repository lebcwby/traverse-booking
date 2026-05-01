function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeGuestEmail(value: unknown) {
  return normalizeString(value).toLowerCase();
}

export function normalizeGuestPhone(value: unknown) {
  return normalizeString(value).replace(/\D/g, "");
}

export function buildStayKey(args: {
  listingId?: string | null;
  checkIn?: string | null;
  checkOut?: string | null;
}) {
  const listingId = normalizeString(args.listingId);
  const checkIn = normalizeString(args.checkIn);
  const checkOut = normalizeString(args.checkOut);

  if (!listingId || !checkIn || !checkOut) return null;
  return `${listingId}|${checkIn}|${checkOut}`;
}

export function buildGuestIdentityKey(args: {
  guestEmail?: string | null;
  guestPhone?: string | null;
}) {
  const email = normalizeGuestEmail(args.guestEmail);
  if (email) return `email:${email}`;

  const phone = normalizeGuestPhone(args.guestPhone);
  if (phone) return `phone:${phone}`;

  return null;
}

export function buildBookingFingerprint(args: {
  listingId?: string | null;
  checkIn?: string | null;
  checkOut?: string | null;
  guestEmail?: string | null;
  guestPhone?: string | null;
}) {
  const stayKey = buildStayKey(args);
  const guestIdentityKey = buildGuestIdentityKey(args);

  if (!stayKey || !guestIdentityKey) return null;
  return `${stayKey}|${guestIdentityKey}`;
}
