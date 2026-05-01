/**
 * Session-scoped guest identity store for Meta Advanced Matching + CAPI.
 *
 * Populated whenever SP learns the guest's identity during a session:
 *   - Supabase auth state change (login, restore)
 *   - Checkout form email blur / full identify
 *   - Listing inquiry email capture
 *
 * Read by every Meta tracking call site (fbq init, /api/track/* callers)
 * so that ViewContent, Search, PageView, and InitiateCheckout after the
 * first identity capture are enriched with the same user_data that
 * Purchase already carries.
 *
 * IMPORTANT: This stores raw PII in memory and sessionStorage. It must
 * NEVER be logged, serialized into analytics events outside the
 * consent-gated CAPI path, or sent to any third party other than Meta
 * (which hashes it server-side in server-tracking.ts::sendMetaEvent).
 * Cleared immediately on consent revoke via clearKnownGuest().
 */

export interface KnownGuest {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}

const STORAGE_KEY = "_sp_known_guest";
const UPDATED_EVENT = "sp:known-guest-updated";

let _guest: KnownGuest = {};
let _hydrated = false;

function normalize(partial: KnownGuest): KnownGuest {
  const out: KnownGuest = {};
  if (partial.email) out.email = partial.email.toLowerCase().trim();
  if (partial.phone) out.phone = partial.phone.trim();
  if (partial.firstName) out.firstName = partial.firstName.trim();
  if (partial.lastName) out.lastName = partial.lastName.trim();
  if (partial.city) out.city = partial.city.trim();
  if (partial.state) out.state = partial.state.trim();
  if (partial.zip) out.zip = partial.zip.trim();
  if (partial.country) out.country = partial.country.trim();
  return out;
}

function hydrateFromSessionStorage() {
  if (_hydrated || typeof window === "undefined") return;
  _hydrated = true;
  try {
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === "object") {
        _guest = normalize(parsed);
      }
    }
  } catch {
    /* sessionStorage unavailable or corrupt — ignore */
  }
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    if (Object.keys(_guest).length === 0) {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } else {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(_guest));
    }
  } catch {
    /* quota exceeded or unavailable — in-memory is still fine */
  }
}

export function setKnownGuest(partial: KnownGuest) {
  hydrateFromSessionStorage();
  const next = normalize(partial);

  // Email is the identity anchor. If an email is supplied and it differs
  // from the stored email, this is a new user — wipe the store first so
  // we don't mix the previous guest's phone/name with the new email.
  if (next.email && _guest.email && _guest.email !== next.email) {
    _guest = {};
  }

  let changed = false;
  for (const key of Object.keys(next) as (keyof KnownGuest)[]) {
    const value = next[key];
    if (value && _guest[key] !== value) {
      _guest[key] = value;
      changed = true;
    }
  }
  if (!changed) return;
  persist();
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(UPDATED_EVENT, { detail: { ..._guest } })
    );
  }
}

export function getKnownGuest(): KnownGuest {
  hydrateFromSessionStorage();
  return { ..._guest };
}

export function clearKnownGuest() {
  _guest = {};
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new CustomEvent(UPDATED_EVENT, { detail: {} }));
  }
}

export const KNOWN_GUEST_UPDATED_EVENT = UPDATED_EVENT;
