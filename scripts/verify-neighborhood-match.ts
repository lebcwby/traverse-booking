// scripts/verify-neighborhood-match.ts
// Synthetic smoke test for src/lib/plan/neighborhood-match.ts.
// Feeds three itinerary shapes (Pearl-heavy, Alberta-heavy, weak/mixed)
// plus a synthetic listing pool and verifies both the match signal and
// the post-boost ordering.
//
// Run: npx tsx --env-file=.env.local scripts/verify-neighborhood-match.ts

import {
  boostListingsByNeighborhood,
  matchItineraryNeighborhood,
} from "../src/lib/plan/neighborhood-match";
import type { Itinerary } from "../src/lib/plan/schema";
import type { Poi } from "../src/lib/pois/types";
import type { Listing } from "../src/lib/supabase";

function makePoi(id: string, neighborhood: string): Poi {
  return {
    id,
    name: id,
    category: "restaurant",
    neighborhood,
    description: "",
    address: "",
    lat: 0,
    lng: 0,
    tags: [],
    timeSlots: ["midday"],
    partyTypes: ["couple"],
    priceLevel: null,
    hoursSummary: null,
    photoUrl: null,
    sourceUrl: null,
    sourceGuideSlug: null,
    status: "active",
    createdAt: "",
    updatedAt: "",
  };
}

function makeItinerary(poiNeighborhoods: string[]): {
  itinerary: Itinerary;
  poisById: Map<string, Poi>;
} {
  const pois = poiNeighborhoods.map((nb, i) => makePoi(`poi-${i}`, nb));
  const poisById = new Map(pois.map((p) => [p.id, p]));
  const itinerary: Itinerary = {
    title: "t",
    summary: "s",
    party: { adults: 2, vibe: "balanced" },
    dates: {
      checkIn: "2026-07-09",
      checkOut: "2026-07-12",
      nights: 3,
      isTentative: false,
    },
    days: [
      {
        dayNumber: 1,
        label: "d1",
        items: pois.map((p) => ({
          poiId: p.id,
          timeSlot: "midday" as const,
          reason: "r",
          durationMinutes: 60,
        })),
      },
    ],
  };
  return { itinerary, poisById };
}

function makeListing(id: string, tags: string[]): Listing {
  return {
    id: Number(id.replace(/\D/g, "")) || 0,
    guesty_id: id,
    nickname: id,
    title: id,
    property_type: "apt",
    room_type: null,
    bedrooms: 2,
    bathrooms: 1,
    beds: 2,
    accommodates: 4,
    area_square_feet: null,
    address: null,
    prices: null,
    active: true,
    is_listed: true,
    picture: null,
    pictures: null,
    picture_count: null,
    amenities: null,
    tags,
    default_check_in_time: null,
    default_check_out_time: null,
    terms: null,
  };
}

function expect(label: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  const mark = ok ? "PASS" : "FAIL";
  console.log(`${mark} ${label}`);
  if (!ok) {
    console.log(`  expected: ${JSON.stringify(expected)}`);
    console.log(`  actual:   ${JSON.stringify(actual)}`);
  }
}

// ---------------------------------------------------------------
// Test 1: Pearl-heavy itinerary → Pearl District + Northwest
// ---------------------------------------------------------------
{
  const { itinerary, poisById } = makeItinerary([
    "pearl",
    "pearl",
    "pearl",
    "pearl",
    "alberta",
  ]);
  const match = matchItineraryNeighborhood(itinerary, poisById);
  expect("pearl-heavy hasSignal", match.hasSignal, true);
  expect("pearl-heavy primary", match.primaryTags, ["Pearl District"]);
  expect("pearl-heavy quadrant", match.quadrantTags, ["Northwest"]);
}

// ---------------------------------------------------------------
// Test 2: Alberta-heavy via kerns roll-up → Alberta + Northeast
// ---------------------------------------------------------------
{
  const { itinerary, poisById } = makeItinerary([
    "alberta",
    "alberta",
    "kerns",
    "kerns",
    "hollywood",
  ]);
  const match = matchItineraryNeighborhood(itinerary, poisById);
  expect("alberta-roll-up hasSignal", match.hasSignal, true);
  expect("alberta-roll-up primary", match.primaryTags, ["Alberta"]);
  expect("alberta-roll-up quadrant", match.quadrantTags, ["Northeast"]);
}

// ---------------------------------------------------------------
// Test 3: Balanced 3-way mix → no signal (tiebreak rule)
// ---------------------------------------------------------------
{
  const { itinerary, poisById } = makeItinerary([
    "pearl",
    "pearl",
    "alberta",
    "alberta",
    "hawthorne",
    "hawthorne",
  ]);
  const match = matchItineraryNeighborhood(itinerary, poisById);
  expect("balanced mix hasSignal", match.hasSignal, false);
}

// ---------------------------------------------------------------
// Test 4: Anchor-only signal (2 Pearl POIs + anchor=pearl → +3 votes)
// ---------------------------------------------------------------
{
  const { itinerary, poisById } = makeItinerary(["pearl", "pearl"]);
  itinerary.anchorNeighborhood = "pearl";
  const match = matchItineraryNeighborhood(itinerary, poisById);
  expect("anchor-weighted primary", match.primaryTags, ["Pearl District"]);
  expect("anchor-weighted signal", match.hasSignal, true);
}

// ---------------------------------------------------------------
// Test 5: Anchor as listing-tag label form ("Pearl District")
// ---------------------------------------------------------------
{
  const { itinerary, poisById } = makeItinerary(["pearl", "pearl"]);
  itinerary.anchorNeighborhood = "Pearl District";
  const match = matchItineraryNeighborhood(itinerary, poisById);
  expect("anchor-label primary", match.primaryTags, ["Pearl District"]);
}

// ---------------------------------------------------------------
// Test 6: Quadrant-only signal (only lloyd POIs → Northeast quadrant)
// ---------------------------------------------------------------
{
  const { itinerary, poisById } = makeItinerary([
    "lloyd",
    "lloyd",
    "lloyd",
    "lloyd",
  ]);
  const match = matchItineraryNeighborhood(itinerary, poisById);
  expect("lloyd quadrant-only primary", match.primaryTags, []);
  expect("lloyd quadrant-only quadrant", match.quadrantTags, ["Northeast"]);
  expect("lloyd quadrant-only signal", match.hasSignal, true);
}

// ---------------------------------------------------------------
// Test 7: Day-trip POIs don't dilute an otherwise-clear signal
// ---------------------------------------------------------------
{
  const { itinerary, poisById } = makeItinerary([
    "pearl",
    "pearl",
    "pearl",
    "pearl",
    "mt_hood",
    "cannon_beach",
  ]);
  const match = matchItineraryNeighborhood(itinerary, poisById);
  expect("day-trip primary", match.primaryTags, ["Pearl District"]);
}

// ---------------------------------------------------------------
// Test 8: boostListingsByNeighborhood reorders tagged listings first
// ---------------------------------------------------------------
{
  const listings = [
    makeListing("a", ["Hawthorne Belmont", "Southeast"]),
    makeListing("b", ["Pearl District", "Northwest"]),
    makeListing("c", ["Alberta", "Northeast"]),
    makeListing("d", ["Northwest"]),
    makeListing("e", ["Southeast"]),
  ];
  const match = {
    primaryTags: ["Pearl District"],
    quadrantTags: ["Northwest"],
    hasSignal: true,
  };
  const boosted = boostListingsByNeighborhood(listings, match);
  expect(
    "boost order",
    boosted.map((l) => l.guesty_id),
    ["b", "d", "a", "c", "e"]
  );
}

// ---------------------------------------------------------------
// Test 9: no-signal match leaves listings untouched
// ---------------------------------------------------------------
{
  const listings = [
    makeListing("a", ["Pearl District"]),
    makeListing("b", ["Alberta"]),
    makeListing("c", ["Hawthorne Belmont"]),
  ];
  const boosted = boostListingsByNeighborhood(listings, {
    primaryTags: [],
    quadrantTags: [],
    hasSignal: false,
  });
  expect(
    "no-signal order unchanged",
    boosted.map((l) => l.guesty_id),
    ["a", "b", "c"]
  );
}

console.log("\ndone");
