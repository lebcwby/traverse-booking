/**
 * Whether a listing allows pets.
 *
 * ── Display only ────────────────────────────────────────────────────────
 *
 * This decides what we SAY about a listing — the checkout note, the JSON-LD
 * `petsAllowed` flag, and the agent API field. It must never gate a charge:
 * as of 2026-10-17 the website charges nothing for pets on any listing.
 * Guests disclose pets and pay any fee through the guest portal after
 * booking.
 *
 * ── Why exact matching ──────────────────────────────────────────────────
 *
 * The listing page previously derived this as:
 *
 *     amenityNames.some(a => a.includes("pet") || a.includes("dog"))
 *
 * `includes("pet")` matches **"carpet"**. Any listing with "Carpeted floors"
 * was published to Google and to every AI assistant as pet-friendly. Hence
 * exact, normalized comparisons here and no substring matching anywhere.
 *
 * ── Missing data means NOT pet-friendly ─────────────────────────────────
 *
 * The three sources disagree in production — `LEAD:427W3:Miller` carries both
 * the tag and the amenity while the BEAPI flag is `false`. We treat any
 * positive signal as pet-friendly because the downside is asymmetric: saying
 * "no pets" about a pet-friendly home loses a booking, while saying "pets
 * allowed" about a home that forbids them puts a guest and a dog on a
 * doorstep. Absent data is therefore "no", but a present signal is "yes".
 */

/** Exact tag that marks a listing pet-friendly, normalized. */
const PET_TAG = "pet friendly";

/** Exact amenity that marks a listing pet-friendly, normalized. */
const PET_AMENITY = "pets allowed";

function normalize(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export interface PetPolicyInput {
  /** BEAPI listing detail: unitTypeHouseRules.houseRules.petsAllowed.enabled */
  houseRulesPetsAllowed?: boolean | null;
  tags?: readonly string[] | null;
  amenities?: readonly string[] | null;
}

export function isPetFriendly(
  listing: PetPolicyInput | null | undefined
): boolean {
  if (!listing) return false;

  // Explicit true from Guesty's house rules is authoritative on its own.
  // NOTE: an explicit `false` is deliberately NOT treated as a veto — see the
  // LEAD:427W3:Miller mismatch in the header.
  if (listing.houseRulesPetsAllowed === true) return true;

  const tags = Array.isArray(listing.tags) ? listing.tags : [];
  if (tags.some((t) => normalize(t) === PET_TAG)) return true;

  const amenities = Array.isArray(listing.amenities) ? listing.amenities : [];
  if (amenities.some((a) => normalize(a) === PET_AMENITY)) return true;

  return false;
}

/**
 * The single sentence shown wherever a guest might expect to pay for a pet.
 * Kept here so the checkout sidebar, the guests dialog, the agent API and
 * llms.txt cannot drift apart.
 */
export const PET_POLICY_NOTE =
  "Bringing a pet? Please disclose it and pay any pet fee through your guest portal after booking. Pets are only allowed at pet-friendly homes.";

/** Shown instead of the note on listings that do not accept pets. */
export const NO_PETS_NOTE = "This home does not allow pets";

/** The note appropriate to one listing. */
export function petPolicyNoteFor(petsAllowed: boolean): string {
  return petsAllowed ? PET_POLICY_NOTE : NO_PETS_NOTE;
}
