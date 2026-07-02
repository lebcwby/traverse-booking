// Persisted search selection (dates + guests) so a guest who enters dates in the
// homepage hero keeps them when clicking ANY unit — including the hardcoded
// "Featured properties" links and cards that render without URL params. Backed by
// sessionStorage (cleared when the tab closes). Read/consumed client-side only.
export interface StoredSearch {
  checkIn?: string; // YYYY-MM-DD
  checkOut?: string; // YYYY-MM-DD
  guests?: number;
}

const KEY = "traverse:search-selection";

export function saveSearchSelection(s: StoredSearch): void {
  if (typeof window === "undefined") return;
  try {
    const clean: StoredSearch = {};
    if (s.checkIn) clean.checkIn = s.checkIn;
    if (s.checkOut) clean.checkOut = s.checkOut;
    if (s.guests && s.guests > 0) clean.guests = s.guests;
    if (Object.keys(clean).length === 0) sessionStorage.removeItem(KEY);
    else sessionStorage.setItem(KEY, JSON.stringify(clean));
  } catch {
    // sessionStorage unavailable (private mode / disabled) — non-fatal
  }
}

export function readSearchSelection(): StoredSearch {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(sessionStorage.getItem(KEY) || "{}") as StoredSearch;
  } catch {
    return {};
  }
}

/** Query string (no leading `?`) for a stored selection; empty if nothing set. */
export function buildSearchQuery(s: StoredSearch): string {
  const p = new URLSearchParams();
  if (s.checkIn) p.set("checkIn", s.checkIn);
  if (s.checkOut) p.set("checkOut", s.checkOut);
  if (s.guests) p.set("guests", String(s.guests));
  return p.toString();
}
